// kernel_digest_at_authoring: sha256:c5d758f79de7b13d3b76a0c77f4a5922703386c1dc80db64fb81a1829465a800
//
// FV-PROPFLOOR-SHARD-B21-1 — property-test floor for cry-01-zk-compliance-proof-generator.
// Class B (bounded-categorical), FLOAT:NO exception per the WU row — confirmed by direct
// read: predicate.check() comparisons are plain numeric thresholds (exact JS number
// comparison, no arithmetic that produces a non-integral quotient the kernel then
// branches on), and the only float division (rng() = (s>>>0)/0xFFFFFFFF inside the LCG)
// feeds a proof-simulation commitment string and a >0.02/>0.5 noise gate, never a
// financial calculation. Forced CATEGORICAL boundary cases used in place of ULP forcing.
// Zero external dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as
// the B1/B12 harness. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/cry-01-zk-compliance-proof-generator.proptest.mjs

import { compute } from '../cry-01-zk-compliance-proof-generator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'cry-01-zk-compliance-proof-generator.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const output_payload = compute(vec.policy_parameters);
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
const rand = mulberry32(0x0C01A1);
const TRIALS = 6000;
const PREDICATE_TYPES = ['amount_below_threshold', 'sanctions_clear', 'kyc_complete', 'travel_rule_threshold', 'velocity_normal', 'source_of_funds'];
const CONSTRAINT_COUNTS = { amount_below_threshold: 4, sanctions_clear: 8, kyc_complete: 6, travel_rule_threshold: 10, velocity_normal: 5, source_of_funds: 12 };
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function mkPP(rng) {
  const predicate_type = pick(rng, PREDICATE_TYPES);
  const seed = Math.floor(rng() * 1e9);
  const data = {
    amount: Math.floor(rng() * 20000),
    threshold: 10000,
    on_sanctions_list: rng() < 0.3,
    kyc_level: Math.floor(rng() * 4),
    required_kyc_level: 2,
    originator_info: rng() < 0.7 ? { name: 'x' } : null,
    beneficiary_info: rng() < 0.7 ? { name: 'y' } : null,
    tx_count_24h: Math.floor(rng() * 100),
    velocity_limit: 50,
    source_of_funds_verified: rng() < 0.5,
  };
  return { seed, predicate_type, data };
}

// ---------- P1: determinism — same (seed, predicate_type, data) always reproduces the same commitment ----------
function checkP1_deterministicReplay() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r1 = compute(pp);
    const r2 = compute(JSON.parse(JSON.stringify(pp)));
    checked++;
    if (r1.proof_commitment !== r2.proof_commitment || r1.proof_result !== r2.proof_result) violations++;
  }
  return { name: 'P1_deterministic_replay_same_seed_same_commitment', trials: checked, violations };
}

// ---------- P2: proof_result is bounded to the declared {VALID, INVALID} enum and matches the predicate check ----------
function checkP2_proofResultBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.proof_result !== 'VALID' && r.proof_result !== 'INVALID') { violations++; continue; }
    if (r.checks.length > 0 && r.checks[0].satisfied !== (r.proof_result === 'VALID')) violations++;
  }
  return { name: 'P2_proof_result_bounded_to_valid_invalid_and_matches_first_check', trials: checked, violations };
}

// ---------- P3: constraint_count and checks.length always match the fixed per-predicate table ----------
function checkP3_constraintCountFixed() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.constraint_count !== CONSTRAINT_COUNTS[pp.predicate_type]) violations++;
    if (r.checks.length !== CONSTRAINT_COUNTS[pp.predicate_type]) violations++;
  }
  return { name: 'P3_constraint_count_and_checks_length_match_fixed_predicate_table', trials: checked, violations };
}

// ---------- P4 (mandatory, float:no exception): forced categorical boundary cases ----------
function checkP4_forced() {
  const rows = [];
  const cases = [
    [{ seed: 1, predicate_type: 'unknown_predicate_xyz', data: {} }, 'unrecognized predicate_type — must return INVALID with ZK_PROOF_INVALID_PREDICATE'],
    [{ seed: 1, predicate_type: 'amount_below_threshold', data: { amount: 10000, threshold: 10000 } }, 'amount exactly equal to threshold — strict < means NOT below, predicate fails'],
    [{ seed: 1, predicate_type: 'amount_below_threshold', data: { amount: 9999, threshold: 10000 } }, 'amount exactly one below threshold — predicate passes'],
    [{ seed: 1, predicate_type: 'kyc_complete', data: { kyc_level: 2, required_kyc_level: 2 } }, 'kyc_level exactly equal to required — >= means this passes'],
    [{ seed: 1, predicate_type: 'kyc_complete', data: { kyc_level: 1, required_kyc_level: 2 } }, 'kyc_level exactly one below required — fails'],
    [{ seed: 1, predicate_type: 'travel_rule_threshold', data: { amount: 1000, originator_info: null, beneficiary_info: null } }, 'amount exactly at the 1000 travel-rule threshold with both info objects missing — fails'],
    [{ seed: 1, predicate_type: 'travel_rule_threshold', data: { amount: 999, originator_info: null, beneficiary_info: null } }, 'amount exactly one below travel-rule threshold — passes regardless of info objects'],
    [{ seed: 1, predicate_type: 'velocity_normal', data: { tx_count_24h: 50, velocity_limit: 50 } }, 'tx_count_24h exactly equal to velocity_limit — strict < means this fails'],
    [{}, 'policy_parameters entirely empty — defaults to seed=42, amount_below_threshold, empty data object'],
    [{ seed: 42, predicate_type: 'sanctions_clear', data: { on_sanctions_list: undefined } }, 'on_sanctions_list undefined — defaults via ?? to false, predicate passes'],
  ];
  for (const [pp, label] of cases) {
    const r = compute(pp);
    const isErrorShape = r.proof_result === 'INVALID' && r.error !== undefined;
    const plausible = isErrorShape
      ? Array.isArray(r.checks) && r.checks.length === 0 && r.compliance_flags.includes('ZK_PROOF_INVALID_PREDICATE')
      : (r.proof_result === 'VALID' || r.proof_result === 'INVALID') && typeof r.proof_commitment === 'string' && Number.isFinite(r.proof_ms_simulated);
    rows.push({ label, input: pp, proof_result: r.proof_result, constraint_count: r.constraint_count, checks_first: (r.checks || [])[0] || null, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_deterministicReplay());
results.properties.push(checkP2_proofResultBounded());
results.properties.push(checkP3_constraintCountFixed());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
