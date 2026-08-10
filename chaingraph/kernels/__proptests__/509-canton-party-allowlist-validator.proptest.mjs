// 509-canton-party-allowlist-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C1-1).
// kernel_digest_at_authoring: sha256:83887e461c79e0e1d5966dc6ad1887b4f0e205494e6dda2381001970b364930a
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (categorical/boolean decision logic only — no ULP-forcing required for this kernel).
// Checks: fixture-oracle gate, termination (party-array bounded), decision-escalation monotonicity,
// enum boundedness, and a permutation-invariance metamorphic check (party order must not change the
// portfolio verdict or the compliance-flag set).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/509-canton-party-allowlist-validator.proptest.mjs

import { compute } from '../509-canton-party-allowlist-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', '509-canton-party-allowlist-validator.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    const a = JSON.stringify(output_payload);
    const b = JSON.stringify(vec.output_payload);
    if (a !== b) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
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
const rand = mulberry32(0x509A1);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const FATF = ['none', 'grey_list', 'black_list'];
const TRIALS = 6000;

function randomParty(rng, idx) {
  return {
    party_name: `Party-${idx}`,
    lei: rng() < 0.8 ? `LEI${idx}` : undefined,
    daml_party_id_known: rng() < 0.7,
    fatf_status: pick(rng, FATF),
    pep: rng() < 0.15,
    adverse_media: rng() < 0.1,
    canton_access: rng() < 0.7 ? 'granted' : 'unknown',
  };
}

// ---------- P1: termination — bounded party array, party_count === parties.length always ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 200; i++) {
    const n = Math.floor(rand() * 300);
    const parties = Array.from({ length: n }, (_, idx) => randomParty(rand, idx));
    const { output_payload } = compute({ parties });
    checked++;
    if (output_payload.party_count !== n || output_payload.parties.length !== n) violations++;
  }
  return { name: 'P1_termination_bounded_count', trials: checked, violations };
}

// ---------- P2: enum boundedness — decision always in the 3-value set ----------
const VALID_DECISIONS = new Set(['APPROVED', 'APPROVED_WITH_CONDITIONS', 'REJECTED']);
const VALID_VERDICTS = new Set(['ALL_APPROVED', 'CONDITIONAL', 'ONE_OR_MORE_REJECTED']);
function checkP2_enum_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = 1 + Math.floor(rand() * 6);
    const parties = Array.from({ length: n }, (_, idx) => randomParty(rand, idx));
    const { output_payload } = compute({ parties });
    checked++;
    if (!VALID_VERDICTS.has(output_payload.portfolio_verdict)) violations++;
    for (const p of output_payload.parties) {
      if (!VALID_DECISIONS.has(p.decision)) violations++;
    }
  }
  return { name: 'P2_enum_boundedness', trials: checked, violations };
}

// ---------- P3: decision-escalation monotonicity — any REJECTED party forces portfolio ONE_OR_MORE_REJECTED ----------
function checkP3_rejection_escalation() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = 1 + Math.floor(rand() * 5);
    const parties = Array.from({ length: n }, (_, idx) => randomParty(rand, idx));
    const forcedIdx = Math.floor(rand() * n);
    parties[forcedIdx] = { ...parties[forcedIdx], fatf_status: 'black_list' };
    const { output_payload } = compute({ parties });
    checked++;
    if (output_payload.portfolio_verdict !== 'ONE_OR_MORE_REJECTED') violations++;
    if (output_payload.parties[forcedIdx].decision !== 'REJECTED') violations++;
  }
  return { name: 'P3_rejection_escalation_monotone', trials: checked, violations };
}

// ---------- P4 (differential-shaped metamorphic): permutation-invariance of party order ----------
// Reference computation: reorder the SAME parties, verdict + flag SET must be identical (party_name-
// keyed decisions may reorder in the output array, but as a set they must be unchanged).
function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const n = 2 + Math.floor(rand() * 6);
    const parties = Array.from({ length: n }, (_, idx) => randomParty(rand, idx));
    const shuffled = shuffle(rand, parties);
    const r1 = compute({ parties }).output_payload;
    const r2 = compute({ parties: shuffled }).output_payload;
    checked++;
    if (r1.portfolio_verdict !== r2.portfolio_verdict) violations++;
    const decisions1 = new Set(r1.parties.map((p) => `${p.party_name}:${p.decision}`));
    const decisions2 = new Set(r2.parties.map((p) => `${p.party_name}:${p.decision}`));
    if (decisions1.size !== decisions2.size || [...decisions1].some((d) => !decisions2.has(d))) violations++;
  }
  return { name: 'P4_permutation_invariance', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_enum_bounded());
results.properties.push(checkP3_rejection_escalation());
results.properties.push(checkP4_permutation_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: '509-canton-party-allowlist-validator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
