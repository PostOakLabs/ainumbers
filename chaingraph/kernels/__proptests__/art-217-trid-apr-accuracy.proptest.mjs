// kernel_digest_at_authoring: sha256:a74ebe7cdb837e03a939cbe160d49a4f412192f9c98d5d928c8daddda570f8fd
//
// FV-PROPFLOOR-SHARD-B6-1 — property-test floor for art-217-trid-apr-accuracy.
// Class B (bounded-numeric), FLOAT-SENSITIVE (verdict depends on a continuous APR
// difference compared against a 1e-6 floating-point-margin tolerance) — ULP-boundary
// forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies
// (mulberry32 PRNG + explicit boundary arrays), same shape as B1-B5's float harnesses.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-217-trid-apr-accuracy.proptest.mjs

import { compute } from '../art-217-trid-apr-accuracy.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-217-trid-apr-accuracy.fixtures.json');
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
const rand = mulberry32(0x2170A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 15000;
const r4 = (v) => (Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : 0);

function mkPP(rng, overrides = {}) {
  return {
    disclosed_apr_pct: randRange(rng, 0, 30),
    actual_apr_pct: randRange(rng, 0, 30),
    num_advances: rng() < 0.2 ? 2 : 1,
    irregular_payment_periods: rng() < 0.1,
    irregular_payment_amounts: rng() < 0.1,
    has_demand_feature: rng() < 0.1,
    ...overrides,
  };
}

// ---------- P1: fixed-threshold-tier agreement — within_tolerance matches |diff| <= tolerance + 1e-6 exactly ----------
function checkP1_withinToleranceAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { abs_difference_pct, tolerance_pct, within_tolerance } = r.output_payload;
    const expected = r4(abs_difference_pct) <= tolerance_pct + 1e-6;
    if (within_tolerance !== expected) violations++;
  }
  return { name: 'P1_within_tolerance_matches_fixed_1e6_margin_rule', trials: checked, violations };
}

// ---------- P2: boundedness — tolerance_pct is always exactly one of the two documented values ----------
function checkP2_toleranceBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { tolerance_pct, is_irregular_transaction } = r.output_payload;
    const expected = is_irregular_transaction ? 0.25 : 0.125;
    if (tolerance_pct !== expected) violations++;
  }
  return { name: 'P2_tolerance_pct_bounded_to_two_documented_values', trials: checked, violations };
}

// ---------- P3: round-trip identity — headroom_pct equals r4(tolerance_pct - abs_diff) exactly ----------
function checkP3_headroomIdentity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { tolerance_pct, abs_difference_pct, headroom_pct } = r.output_payload;
    const expected = r4(tolerance_pct - abs_difference_pct);
    if (headroom_pct !== expected) violations++;
  }
  return { name: 'P3_headroom_pct_matches_r4_identity', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ disclosed_apr_pct: 5, actual_apr_pct: 5 }, 'disclosed equals actual exactly — difference must be exactly 0, verdict accurate'],
  [{ disclosed_apr_pct: 5.125, actual_apr_pct: 5 }, 'difference exactly at regular tolerance (0.125) — must be within_tolerance'],
  [{ disclosed_apr_pct: 5.125 + 1e-7, actual_apr_pct: 5 }, 'difference 1e-7 above tolerance (within the 1e-6 float margin) — must still be within_tolerance'],
  [{ disclosed_apr_pct: 5.1251, actual_apr_pct: 5 }, 'difference 1e-4 above tolerance (beyond the 1e-6 float margin) — must be overstated_violation'],
  [{ disclosed_apr_pct: 4.875, actual_apr_pct: 5 }, 'understatement exactly at -0.125 boundary — must be within_tolerance (accurate)'],
  [{ disclosed_apr_pct: 4.8749, actual_apr_pct: 5 }, 'understatement just beyond -0.125 — must be understated_violation'],
  [{ disclosed_apr_pct: 0.1 * 3, actual_apr_pct: 0.3 }, 'disclosed = 0.1*3 (non-exact double) vs actual 0.3 — difference must round to exactly 0 under r4, verdict accurate'],
  [{ disclosed_apr_pct: 5.25, actual_apr_pct: 5, num_advances: 2 }, 'difference exactly at irregular tolerance (0.25) — must be within_tolerance'],
  [{ disclosed_apr_pct: 5.2501, actual_apr_pct: 5, num_advances: 2 }, 'irregular difference just beyond 0.25 — must be overstated_violation'],
  [{ disclosed_apr_pct: 0, actual_apr_pct: 0 }, 'both APRs exactly zero — must not throw, difference exactly 0'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = mkPP(rand, overrides);
    const r = compute(pp);
    const op = r.output_payload;
    const nums = [op.difference_pct, op.abs_difference_pct, op.tolerance_pct, op.headroom_pct];
    const finite = nums.every(Number.isFinite) && ['accurate', 'accurate_overstated_ok', 'overstated_violation', 'understated_violation'].includes(op.verdict);
    rows.push({ label, overrides, verdict: op.verdict, within_tolerance: op.within_tolerance, finite, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_withinToleranceAgreement());
results.properties.push(checkP2_toleranceBounded());
results.properties.push(checkP3_headroomIdentity());
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
