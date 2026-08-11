// art-559-attest-calc-agent-independence.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C28-1).
// kernel_digest_at_authoring: sha256:68c476b24ca693447d4153a954653832e6a9a62a35f2e0da3ac578eb163f74b0
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (matches the WU row, direct read confirms). compute() is pure
// string/enum/boolean logic (safeStr/nonEmpty trimming, enum membership, a regex test for the
// sha256-salted@1 commitment shape) -- zero numeric arithmetic anywhere in the file.
// Forced categorical boundary cases are used in place of ULP-boundary forcing.
// Checks: fixture-oracle gate, termination (interested_parties/rejected_inputs bounded by
// pp.interested_parties.length plus a fixed small constant of structural checks),
// boundedness (independence_asserted === (relationship_declaration==='none'), trigger_tool_id
// always one of the 3 known trigger tool_ids or null), differential re-derivation of
// independence_asserted/rejected_inputs-count/private_input_candidates-count via an independent
// reimplementation, permutation-invariance of interested_parties order (aggregate counts are
// order-independent; per-item "where" strings carry a positional index so only counts are
// compared), and forced categorical boundary cases (missing relationship_declaration, unknown
// commitment scheme, malformed sha256 commitment, trigger tool_id outside the allowed 3, empty
// interested_parties).
// Zero external dependencies -- pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-559-attest-calc-agent-independence.proptest.mjs

import { compute } from '../art-559-attest-calc-agent-independence.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-559-attest-calc-agent-independence.fixtures.json');
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
const rand = mulberry32(0x55900028);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIGGER_TOOL_IDS = ['art-251-compute-parametric-trigger-payout', 'art-252-validate-cat-bond-trigger-terms', 'art-309-parametric-index-deriver', 'art-999-not-a-trigger'];
const PARTY_ROLES = ['cedant', 'sponsor', 'reinsurer', 'other', 'unknown_role'];
const VALID_HEX64 = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

function randomParty(rng, i) {
  const useCommitment = rng() < 0.2;
  const scheme = useCommitment ? 'sha256-salted@1' : (rng() < 0.1 ? 'md5-plain' : undefined);
  const party_id = scheme === 'sha256-salted@1' ? `sha256:${VALID_HEX64}` : (scheme === 'md5-plain' ? `plain-id-${i}` : `party-${i}`);
  return { party_role: pick(rng, PARTY_ROLES), party_id: rng() < 0.1 ? undefined : party_id, ...(scheme ? { party_id_commitment_scheme: scheme } : {}) };
}
function randomPP(rng) {
  const n = Math.floor(rng() * 6);
  return {
    calc_agent_id: rng() < 0.1 ? undefined : `agent-${Math.floor(rng() * 1000)}`,
    interested_parties: Array.from({ length: n }, (_, i) => randomParty(rng, i)),
    relationship_declaration: rng() < 0.1 ? undefined : pick(rng, ['none', 'disclosed']),
    trigger_ref: { execution_hash: rng() < 0.1 ? undefined : 'sha256:' + '1'.repeat(64), tool_id: rng() < 0.15 ? undefined : pick(rng, TRIGGER_TOOL_IDS) },
  };
}

const TRIALS = 3000;

// ---------- P1: termination -- interested_parties echoed 1:1, rejected_inputs finite ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.interested_parties.length !== pp.interested_parties.length) violations++;
    if (output_payload.rejected_inputs.length > pp.interested_parties.length + 5) violations++; // 5 fixed structural checks + per-party
  }
  return { name: 'P1_interested_parties_echoed_1to1_rejected_inputs_finite', trials: checked, violations };
}

// ---------- P2: boundedness -- independence_asserted matches declaration, trigger_tool_id enum ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.independence_asserted !== (output_payload.relationship_declaration === 'none')) violations++;
    const tid = output_payload.trigger_ref.tool_id;
    if (tid !== null && !TRIGGER_TOOL_IDS.slice(0, 3).includes(tid)) violations++;
  }
  return { name: 'P2_independence_asserted_matches_declaration_and_trigger_enum', trials: checked, violations };
}

// ---------- P3 (differential): rejected_inputs / private_input_candidates counts re-derived ----------
function reimplement(pp) {
  let rejected = 0;
  if (!pp.calc_agent_id) rejected++;
  const rel = pp.relationship_declaration === 'none' || pp.relationship_declaration === 'disclosed' ? pp.relationship_declaration : null;
  if (!rel) rejected++;
  const tref = pp.trigger_ref || {};
  if (!tref.execution_hash) rejected++;
  const validTriggerIds = TRIGGER_TOOL_IDS.slice(0, 3);
  if (!tref.tool_id || !validTriggerIds.includes(tref.tool_id)) rejected++;
  let privateCount = 0;
  const parties = Array.isArray(pp.interested_parties) ? pp.interested_parties : [];
  for (const p of parties) {
    if (!PARTY_ROLES.slice(0, 4).includes(p.party_role)) rejected++;
    const scheme = p.party_id_commitment_scheme;
    if (!p.party_id) { rejected++; continue; }
    if (scheme !== undefined) {
      if (scheme !== 'sha256-salted@1') rejected++;
      else if (!/^sha256:[0-9a-f]{64}$/.test(p.party_id)) rejected++;
      else privateCount++;
    }
  }
  if (parties.length === 0) rejected++;
  return { rejected, privateCount };
}
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload, private_input_candidates } = compute(pp);
    checked++;
    const expected = reimplement(pp);
    if (output_payload.rejected_inputs.length !== expected.rejected) violations++;
    if (private_input_candidates.length !== expected.privateCount) violations++;
  }
  return { name: 'P3_rejected_and_private_counts_differential', trials: checked, violations };
}

// ---------- P4: metamorphic -- permutation-invariance of interested_parties order (counts only) ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1200; i++) {
    const pp = randomPP(rand);
    if (pp.interested_parties.length < 2) continue;
    const shuffled = { ...pp, interested_parties: [...pp.interested_parties].reverse() };
    const r1 = compute(pp);
    const r2v = compute(shuffled);
    checked++;
    if (r1.output_payload.independence_asserted !== r2v.output_payload.independence_asserted) violations++;
    if (r1.output_payload.rejected_inputs.length !== r2v.output_payload.rejected_inputs.length) violations++;
    if (r1.private_input_candidates.length !== r2v.private_input_candidates.length) violations++;
  }
  return { name: 'P4_interested_parties_order_invariance_counts', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no) ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  const base = { calc_agent_id: 'A', interested_parties: [{ party_role: 'cedant', party_id: 'x' }], relationship_declaration: 'none', trigger_ref: { execution_hash: 'sha256:' + '1'.repeat(64), tool_id: 'art-251-compute-parametric-trigger-payout' } };
  // missing relationship_declaration -> rejected
  checked++;
  { const r = compute({ ...base, relationship_declaration: undefined }); if (!r.output_payload.rejected_inputs.some((x) => x.where === 'relationship_declaration')) violations++; }
  // unknown commitment scheme -> rejected, party_id excluded (null)
  checked++;
  { const r = compute({ ...base, interested_parties: [{ party_role: 'cedant', party_id: 'plain', party_id_commitment_scheme: 'md5' }] }); if (r.output_payload.interested_parties[0].party_id !== null) violations++; }
  // malformed sha256 commitment -> rejected, party_id excluded
  checked++;
  { const r = compute({ ...base, interested_parties: [{ party_role: 'cedant', party_id: 'sha256:notvalidhex', party_id_commitment_scheme: 'sha256-salted@1' }] }); if (r.output_payload.interested_parties[0].party_id !== null) violations++; }
  // trigger tool_id outside the allowed 3 -> rejected, null in output
  checked++;
  { const r = compute({ ...base, trigger_ref: { execution_hash: base.trigger_ref.execution_hash, tool_id: 'not-a-trigger-id' } }); if (r.output_payload.trigger_ref.tool_id !== null) violations++; }
  // empty interested_parties -> rejected
  checked++;
  { const r = compute({ ...base, interested_parties: [] }); if (!r.output_payload.rejected_inputs.some((x) => x.where === 'interested_parties')) violations++; }
  return { name: 'P5_forced_categorical_boundaries', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_permutation_invariance());
results.properties.push(checkP5_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-559-attest-calc-agent-independence',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
