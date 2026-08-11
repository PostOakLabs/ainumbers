// art-548-vop-readiness-diagnostic.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C28-1).
// kernel_digest_at_authoring: sha256:9d9df2ce31e5a6665cd88ed8ad73de1b8f1ca8cb79273dab000d5ea53ef8fa76
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (matches the WU row, direct read confirms). classifyVopReadiness() does
// zero arithmetic on match_score -- it performs direct >= comparisons of a caller-supplied
// number against caller-supplied thresholds, with no division, multiplication, or rounding
// derivation anywhere in the file (commitPrivateInput()'s hex-to-byte parsing is integer-only).
// This is the "structural comparison only" shape (matches art-544/art-557/art-559 in this
// shard), distinct from a kernel that computes a value via arithmetic before comparing it.
// Forced categorical boundary cases are used at the threshold instead of ULP forcing.
// This is a SPEC.md §25 ocg-private-input@1 node (private_input_profile flag): compute(pp) is a
// deliberate decoy stub -- per SPEC.md §18.3 the verdict is not third-party-recomputable from
// policy_parameters alone, so compute() always returns a fixed not_verifiable/false/null shape
// regardless of input. The real classification runs inside buildArtifact(raw, ...) against the
// PRIVATE witness (iban/payee_name/account_holder_id + salts), never against policy_parameters.
// Checks: fixture-oracle gate (via buildArtifact against the private witness reconstructed from
// the .disclosure.json sidecar, same shape as art-413/art-415 in this repo), a decoy compute()
// contract check (never leaks a verdict from policy_parameters alone), boundedness (private_
// inputs count in {2,3}, classification always one of the four enum values, consistent is
// always boolean via buildArtifact), differential re-derivation of the classification/
// consistency verdict against an independent reimplementation of classifyVopReadiness, and
// forced categorical boundary cases (match_score exactly at each threshold, no match_score
// supplied, an unrecognized psp_vop_response_code).
// Zero external dependencies -- pure Node built-ins only (mulberry32 PRNG, hand-rolled). Uses
// the runtime's real globalThis.crypto.subtle (Node 19+ WebCrypto) for the commitment digest.
//
// Run: node chaingraph/kernels/__proptests__/art-548-vop-readiness-diagnostic.proptest.mjs

import { compute, buildArtifact } from '../art-548-vop-readiness-diagnostic.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

// description-declared match_score for each fixture vector (match_score itself is neither
// committed nor placed in policy_parameters -- per the kernel's own §1.2 comment it is public
// but deliberately excluded from the published artifact, so it must be supplied here from the
// fixture's own human-readable description text, not read back from any JSON field).
const FIXTURE_MATCH_SCORES = {
  exact_match_consistent: 0.97,
  score_response_code_mismatch: 0.55,
  no_score_not_verifiable_consistent: undefined,
};

async function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-548-vop-readiness-diagnostic.fixtures.json');
  const disclosurePath = path.join(__dirname, '..', 'fixtures', 'art-548-vop-readiness-diagnostic.disclosure.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const disclosure = JSON.parse(readFileSync(disclosurePath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const rows = disclosure.vectors.filter((d) => d.name === vec.name);
    const ibanRow = rows.find((r) => r.pointer === '/iban_commitment');
    const nameRow = rows.find((r) => r.pointer === '/payee_name_commitment');
    const acctRow = rows.find((r) => r.pointer === '/account_holder_id_commitment');
    const raw = {
      iban: ibanRow.input_value, iban_salt: ibanRow.salt,
      payee_name: nameRow.input_value, payee_name_salt: nameRow.salt,
      match_score: FIXTURE_MATCH_SCORES[vec.name],
      match_threshold_exact: vec.policy_parameters.match_threshold_exact,
      match_threshold_close: vec.policy_parameters.match_threshold_close,
      psp_vop_response_code: vec.policy_parameters.psp_vop_response_code,
    };
    if (acctRow) { raw.account_holder_id = acctRow.input_value; raw.account_holder_id_salt = acctRow.salt; }
    const artifact = await buildArtifact(raw);
    const a = JSON.stringify(artifact.output_payload);
    const b = JSON.stringify(vec.output_payload);
    if (a !== b) failures.push({ name: vec.name, expected: vec.output_payload, got: artifact.output_payload });
  }
  results.fixture_oracle = { total: fixtures.vectors.length, failures };
  return failures.length === 0;
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x54800028);
const SALT = 'c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0';
const RESPONSE_CODES = ['MTCH', 'CMTCH', 'NMTCH', 'NVRF', 'UNKNOWN_CODE'];
const CODE_TO_CLASS = { MTCH: 'match', CMTCH: 'close_match', NMTCH: 'no_match', NVRF: 'not_verifiable' };

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randomRaw(rng) {
  const hasScore = rng() < 0.85;
  return {
    iban: `DE${Math.floor(rng() * 1e10)}`, iban_salt: SALT,
    payee_name: `Payee ${Math.floor(rng() * 1000)}`, payee_name_salt: SALT,
    match_score: hasScore ? rng() : undefined,
    match_threshold_exact: 0.9,
    match_threshold_close: 0.7,
    psp_vop_response_code: pick(rng, RESPONSE_CODES),
  };
}

function reimplementClassify(match_score, threshExact, threshClose, code) {
  const provided = typeof match_score === 'number' && Number.isFinite(match_score);
  let classification;
  if (!provided) classification = 'not_verifiable';
  else if (match_score >= threshExact) classification = 'match';
  else if (match_score >= threshClose) classification = 'close_match';
  else classification = 'no_match';
  const mapped = Object.prototype.hasOwnProperty.call(CODE_TO_CLASS, code) ? CODE_TO_CLASS[code] : 'unrecognized_code';
  return { classification, provided, mapped, consistent: mapped === classification };
}

const TRIALS = 1500; // WebCrypto digest calls are more expensive than pure JS

// ---------- P0: decoy compute() contract -- never leaks a verdict from policy_parameters alone ----------
function checkP0_decoy() {
  const r = compute({ psp_vop_response_code: 'MTCH' });
  const ok = r.classification === 'not_verifiable' && r.match_score_provided === false && r.consistent === null;
  return { name: 'P0_decoy_compute_never_leaks_verdict', trials: 1, violations: ok ? 0 : 1 };
}

// ---------- P1: boundedness -- private_inputs count, enum membership, consistent always boolean ----------
async function checkP1_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const raw = randomRaw(rand);
    const artifact = await buildArtifact(raw);
    checked++;
    if (artifact.private_inputs.length !== 2) violations++; // this generator never supplies account_holder_id
    if (!['match', 'close_match', 'no_match', 'not_verifiable'].includes(artifact.output_payload.classification)) violations++;
    if (typeof artifact.output_payload.consistent !== 'boolean') violations++;
  }
  return { name: 'P1_boundedness_private_inputs_and_enum', trials: checked, violations };
}

// ---------- P2 (differential): classification/consistency re-derived ----------
async function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const raw = randomRaw(rand);
    const artifact = await buildArtifact(raw);
    checked++;
    const expected = reimplementClassify(raw.match_score, raw.match_threshold_exact, raw.match_threshold_close, raw.psp_vop_response_code);
    if (artifact.output_payload.classification !== expected.classification) violations++;
    if (artifact.output_payload.match_score_provided !== expected.provided) violations++;
    if (artifact.output_payload.psp_declared_maps_to !== expected.mapped) violations++;
    if (artifact.output_payload.consistent !== expected.consistent) violations++;
  }
  return { name: 'P2_classification_and_consistency_differential', trials: checked, violations };
}

// ---------- P3: forced categorical boundary cases (float:no) ----------
async function checkP3_forced_categorical() {
  let violations = 0, checked = 0;
  const base = { iban: 'DE89370400440532013000', iban_salt: SALT, payee_name: 'Test Payee', payee_name_salt: SALT, match_threshold_exact: 0.9, match_threshold_close: 0.7 };
  // exact threshold boundary: match_score === match_threshold_exact -> match
  checked++;
  { const a = await buildArtifact({ ...base, match_score: 0.9, psp_vop_response_code: 'MTCH' }); if (a.output_payload.classification !== 'match') violations++; }
  // just below exact threshold, at close threshold -> close_match
  checked++;
  { const a = await buildArtifact({ ...base, match_score: 0.7, psp_vop_response_code: 'CMTCH' }); if (a.output_payload.classification !== 'close_match') violations++; }
  // just below close threshold -> no_match
  checked++;
  { const a = await buildArtifact({ ...base, match_score: 0.69, psp_vop_response_code: 'NMTCH' }); if (a.output_payload.classification !== 'no_match') violations++; }
  // no match_score supplied -> not_verifiable
  checked++;
  { const a = await buildArtifact({ ...base, psp_vop_response_code: 'NVRF' }); if (a.output_payload.classification !== 'not_verifiable' || a.output_payload.match_score_provided !== false) violations++; }
  // unrecognized psp_vop_response_code -> unrecognized_code, never crashes
  checked++;
  { const a = await buildArtifact({ ...base, match_score: 0.95, psp_vop_response_code: 'ZZZZ' }); if (a.output_payload.psp_declared_maps_to !== 'unrecognized_code' || a.output_payload.consistent !== false) violations++; }
  return { name: 'P3_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = await runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP0_decoy());
results.properties.push(await checkP1_boundedness());
results.properties.push(await checkP2_differential());
results.properties.push(await checkP3_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-548-vop-readiness-diagnostic',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
