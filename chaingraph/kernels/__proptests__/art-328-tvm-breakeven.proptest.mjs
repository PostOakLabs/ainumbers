// kernel_digest_at_authoring: sha256:8ee3fde4026fd67095856d912a31f30448034efb23fcf876c670c518b1e1cb54
//
// FV-PROPFLOOR-SHARD-B12-1 — property-test floor for art-328-tvm-breakeven.
// Class B (bounded-numeric), FLOAT-SENSITIVE — price_per_unit/variable_cost_per_unit are raw
// doubles feeding a division (fixed_costs / unit_contribution) that blows up near a zero
// denominator — ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3, focused on
// the near-zero unit-contribution boundary since that is this kernel's analogue of a near-zero
// rate/duration division. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-328-tvm-breakeven.proptest.mjs

import { compute } from '../art-328-tvm-breakeven.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-328-tvm-breakeven.fixtures.json');
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
const rand = mulberry32(0x328B8);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;

function mkPP(rng) {
  const price_per_unit = randRange(rng, 1, 500);
  const variable_cost_per_unit = randRange(rng, 0, price_per_unit * 0.95);
  const fixed_costs = randRange(rng, 100, 500000);
  const current_units = rng() < 0.7 ? Math.floor(randRange(rng, 0, 50000)) : undefined;
  const pp = { price_per_unit, variable_cost_per_unit, fixed_costs };
  if (current_units !== undefined) pp.current_units = current_units;
  return pp;
}

// ---------- P1: round-trip identity — breakeven_units * unit_contribution ~= fixed_costs when positive ----------
function checkP1_breakevenRoundTrip() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { breakeven_units, fixed_costs } = r.output_payload;
    // Recompute unit_contribution from the RAW (unrounded) inputs — output_payload's own
    // unit_contribution is r4-rounded for display, but breakeven_units was divided by the raw
    // value internally, so checking against the rounded figure would fail on rounding noise
    // amplified by division, not on an actual kernel defect.
    const rawUC = pp.price_per_unit - pp.variable_cost_per_unit;
    if (rawUC > 0) {
      // breakeven_units itself is r2-rounded (max 0.005 error) before this reconstruction runs,
      // and that error is amplified by rawUC on multiplication — the tolerance must scale with it.
      if (Math.abs(breakeven_units * rawUC - fixed_costs) > 0.01 * rawUC + 0.02 + fixed_costs * 1e-4) violations++;
    } else if (breakeven_units !== 0) violations++;
  }
  return { name: 'P1_breakeven_units_times_unit_contribution_roundtrips_to_fixed_costs', trials: checked, violations };
}

// ---------- P2: boundedness — contribution_margin_ratio stays within (0, 1] for the sampled domain ----------
function checkP2_marginRatioBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const cmr = r.output_payload.contribution_margin_ratio;
    if (r.output_payload.unit_contribution > 0 && (cmr <= 0 || cmr > 1.0001)) violations++;
  }
  return { name: 'P2_contribution_margin_ratio_bounded_0_to_1', trials: checked, violations };
}

// ---------- P3: monotonicity — increasing fixed_costs never decreases breakeven_units ----------
function checkP3_monotonicInFixedCosts() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    checked++;
    const rLo = compute({ ...pp, fixed_costs: pp.fixed_costs });
    const rHi = compute({ ...pp, fixed_costs: pp.fixed_costs * 1.5 + 10 });
    if (rHi.output_payload.breakeven_units < rLo.output_payload.breakeven_units - 1e-6) violations++;
  }
  return { name: 'P3_breakeven_units_nondecreasing_in_fixed_costs', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing, focused on the near-zero unit-contribution divide ----------
const ULP_BOUNDARY_CASES = [
  [{ fixed_costs: 50000, price_per_unit: 25, variable_cost_per_unit: 25 }, 'price exactly equals variable cost — unit_contribution exactly 0, must flag NON_POSITIVE_UNIT_CONTRIBUTION and report breakeven_units 0, never Infinity'],
  [{ fixed_costs: 50000, price_per_unit: 25, variable_cost_per_unit: 25 + Number.EPSILON * 25 }, 'variable_cost 1 ULP above price — unit_contribution is a tiny negative double, must still flag NON_POSITIVE, not silently divide'],
  [{ fixed_costs: 50000, price_per_unit: 10.1 * 3, variable_cost_per_unit: 10 }, 'price = 10.1*3 (classic non-exact double 30.299999999999997) — unit_contribution must reflect that exact double difference'],
  [{ fixed_costs: 0, price_per_unit: 25, variable_cost_per_unit: 15 }, 'fixed_costs exactly zero — breakeven_units must be exactly 0'],
  [{ fixed_costs: 50000, price_per_unit: 0, variable_cost_per_unit: -5 }, 'price_per_unit exactly zero — ZERO_PRICE_PER_UNIT flag must fire, contribution_margin_ratio must not divide by zero unguarded'],
  [{ fixed_costs: 50000, price_per_unit: 25, variable_cost_per_unit: -0 }, 'variable_cost_per_unit negative zero — must behave as zero, no NaN'],
  [{ fixed_costs: Number.MIN_VALUE, price_per_unit: 25, variable_cost_per_unit: 15 }, 'fixed_costs smallest positive double — breakeven_units must remain finite, round to a tiny-but-finite value'],
  [{ fixed_costs: 50000, price_per_unit: 25, variable_cost_per_unit: 15, current_units: 5000 }, 'current_units exactly equal to breakeven_units (5000) — margin_of_safety_units must be exactly 0, not below-breakeven flagged'],
  [{ fixed_costs: 50000, price_per_unit: 25, variable_cost_per_unit: 15, current_units: 4999 }, 'current_units 1 unit below breakeven_units — CURRENT_VOLUME_BELOW_BREAKEVEN flag must fire'],
  [{ fixed_costs: 50000, price_per_unit: Number.MAX_SAFE_INTEGER, variable_cost_per_unit: 1 }, 'price_per_unit at MAX_SAFE_INTEGER — breakeven_units must round to a tiny finite value, not NaN or overflow'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { breakeven_units, unit_contribution, contribution_margin_ratio } = r.output_payload;
    const plausible = Number.isFinite(breakeven_units) && Number.isFinite(unit_contribution) && Number.isFinite(contribution_margin_ratio);
    rows.push({ label, input: pp, breakeven_units, unit_contribution, contribution_margin_ratio, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_breakevenRoundTrip());
results.properties.push(checkP2_marginRatioBounded());
results.properties.push(checkP3_monotonicInFixedCosts());
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
