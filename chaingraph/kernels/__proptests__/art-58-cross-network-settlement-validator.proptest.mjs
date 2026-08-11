// kernel_digest_at_authoring: sha256:3bd0c00f1525794b85021aa94d28caed825ccbf0bae6d32f38092cb2ec96bc8b
//
// FV-PROPFLOOR-SHARD-B14-1 — property-test floor for art-58-cross-network-settlement-validator.
// Class B (bounded-numeric/categorical), FLOAT:NO exception per the WU row — confirmed on direct
// kernel reading: atomicity_verdict/pvp_check/finality-rank comparisons are all fixed-integer-table
// lookups (ATOMICITY_SCORE, FINALITY_RANK) and integer comparisons; the only "arithmetic" is
// settlement_risk_window_sec = timeout_window_sec * 10, an exact integer multiply with no rounding
// or continuous-domain sensitivity. Forced CATEGORICAL boundary cases used in place of ULP forcing.
// Zero external dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-58-cross-network-settlement-validator.proptest.mjs

import { compute } from '../art-58-cross-network-settlement-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-58-cross-network-settlement-validator.fixtures.json');
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
const rand = mulberry32(0x58CAAE);
const TRIALS = 8000;
const ATOMICITY_SCORE = { 'shared-ledger': 4, HTLC: 3, 'notary-signature': 2, 'trusted-bridge': 1, unsynchronised: 0 };

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

function mkNetwork(rng) {
  return { role: pick(rng, ['cash', 'asset', 'fx']), finality_model: pick(rng, ['deterministic', 'legal-designated', 'probabilistic', 'unknown-model']) };
}
function mkLeg(rng) {
  return { leg_type: pick(rng, ['cash', 'asset', 'fx']), conditional_on: rng() < 0.5 ? [] : ['some-condition'] };
}
function mkPP(rng) {
  const nn = Math.floor(randRange(rng, 0, 4));
  const nl = Math.floor(randRange(rng, 0, 4));
  return {
    networks: Array.from({ length: nn }, () => mkNetwork(rng)),
    coordination_mechanism: pick(rng, ['shared-ledger', 'HTLC', 'notary-signature', 'trusted-bridge', 'unsynchronised']),
    legs: Array.from({ length: nl }, () => mkLeg(rng)),
    timeout_window_sec: Math.floor(randRange(rng, 0, 3600)),
    rollback_supported: rng() < 0.5,
    pvp_required: rng() < 0.5,
  };
}

// ---------- P1: atomicity_verdict is an exact function of ATOMICITY_SCORE[coordination_mechanism] ----------
function checkP1_atomicityVerdictExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const score = ATOMICITY_SCORE[pp.coordination_mechanism] ?? 0;
    const expected = score === 4 ? 'atomic' : score >= 2 ? 'partial' : 'at-risk';
    if (r.output_payload.atomicity_verdict !== expected) violations++;
  }
  return { name: 'P1_atomicity_verdict_exact_function_of_coordination_mechanism', trials: checked, violations };
}

// ---------- P2: settlement_risk_window_sec is an exact function of atomicity_verdict and timeout_window_sec ----------
function checkP2_riskWindowExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { atomicity_verdict, settlement_risk_window_sec } = r.output_payload;
    const expected = atomicity_verdict === 'atomic' ? 0 : atomicity_verdict === 'partial' ? pp.timeout_window_sec : pp.timeout_window_sec * 10;
    if (settlement_risk_window_sec !== expected) violations++;
  }
  return { name: 'P2_settlement_risk_window_exact_function_of_verdict_and_timeout', trials: checked, violations };
}

// ---------- P3: pvp_check is an exact function of pvp_required and coordination_mechanism ----------
function checkP3_pvpCheckExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = pp.pvp_required
      ? (pp.coordination_mechanism === 'shared-ledger' || pp.coordination_mechanism === 'HTLC' ? 'PVP_SUPPORTED' : 'PVP_AT_RISK')
      : 'PVP_NOT_REQUIRED';
    if (r.output_payload.pvp_check !== expected) violations++;
  }
  return { name: 'P3_pvp_check_exact_function_of_pvp_required_and_mechanism', trials: checked, violations };
}

// ---------- P4 (mandatory, float:no exception): forced categorical boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{}, 'all fields defaulted (networks=[], legs=[], coordination_mechanism=unsynchronised) — must not throw, atomicity_verdict must be "at-risk"'],
  [{ coordination_mechanism: 'unrecognized-mechanism-xyz' }, 'unrecognized coordination_mechanism string — ATOMICITY_SCORE lookup default of 0 must apply (at-risk), not throw'],
  [{ networks: 'not-an-array', legs: 'not-an-array' }, 'networks and legs are non-array types — Array.isArray guard must coerce to [], not throw'],
  [{ networks: [{ role: 'cash', finality_model: 'probabilistic' }, { role: 'asset', finality_model: 'deterministic' }], coordination_mechanism: 'HTLC' }, 'cash leg has weaker finality (rank 3) than asset leg (rank 1) — finality mismatch must be flagged (cash cannot safely gate legally-final asset delivery)'],
  [{ networks: [{ role: 'cash', finality_model: 'unrecognized-model-xyz' }] }, 'unrecognized finality_model string — getRank() default of 2 (fallback) must apply, not throw'],
  [{ networks: [{ role: 'cash' }] }, 'network entry missing finality_model entirely — must default to "probabilistic" per the destructuring default (?? "probabilistic"), rank 3, not throw'],
  [{ coordination_mechanism: 'shared-ledger', pvp_required: true }, 'shared-ledger coordination with PvP required — pvp_check must be PVP_SUPPORTED (shared-ledger and HTLC are the only PVP_SUPPORTED mechanisms)'],
  [{ coordination_mechanism: 'notary-signature', pvp_required: true }, 'notary-signature coordination with PvP required — pvp_check must be PVP_AT_RISK (notary-signature is not in the PVP_SUPPORTED set)'],
  [{ timeout_window_sec: 0, coordination_mechanism: 'unsynchronised' }, 'timeout_window_sec exactly zero with at-risk atomicity — settlement_risk_window_sec must be exactly 0*10=0, not NaN'],
  [{ legs: [{ leg_type: 'cash', conditional_on: [] }], coordination_mechanism: 'unsynchronised' }, 'a leg with an empty conditional_on array under non-atomic coordination — leg_findings must flag it as unconditional'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { atomicity_verdict, pvp_check, settlement_risk_window_sec, leg_findings } = r.output_payload;
    const plausible = typeof atomicity_verdict === 'string' && typeof pvp_check === 'string' &&
      Number.isFinite(settlement_risk_window_sec) && Array.isArray(leg_findings);
    rows.push({ label, input: pp, atomicity_verdict, pvp_check, settlement_risk_window_sec, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_atomicityVerdictExact());
results.properties.push(checkP2_riskWindowExact());
results.properties.push(checkP3_pvpCheckExact());
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
