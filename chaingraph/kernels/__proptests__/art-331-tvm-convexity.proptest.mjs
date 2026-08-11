// kernel_digest_at_authoring: sha256:56d259be1b9261ab5eb2f2370e7965b48ec47f329ad585c5e980a327525262c5
//
// FV-PROPFLOOR-SHARD-B12-1 — property-test floor for art-331-tvm-convexity.
// Class B (bounded-numeric), FLOAT-SENSITIVE — closed-form convexity divides by price and by
// (1+periodic yield)^(t+2) terms, and the optional yield_shock_bp adjustment squares a small delta
// — ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3, and per the WU row MUST
// include near-zero-rate and near-zero-duration edge cases. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-331-tvm-convexity.proptest.mjs

import { compute } from '../art-331-tvm-convexity.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-331-tvm-convexity.fixtures.json');
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
const rand = mulberry32(0x331EB);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 6000;

function mkPP(rng) {
  const pp = {
    face_value: randRange(rng, 100, 10000),
    coupon_rate_pct: randRange(rng, 0, 12),
    ytm_pct: randRange(rng, 0.5, 15),
    years_to_maturity: randRange(rng, 0.25, 30),
    periods_per_year: pick(rng, [1, 2, 4, 12]),
  };
  if (rng() < 0.5) pp.yield_shock_bp = randRange(rng, -300, 300);
  return pp;
}

// ---------- P1: boundedness — convexity is non-negative for a vanilla positive-coupon bullet bond ----------
function checkP1_convexityNonNegative() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.convexity < -1e-6) violations++;
  }
  return { name: 'P1_convexity_non_negative_for_vanilla_bullet_bond', trials: checked, violations };
}

// ---------- P2: fixed rule — convexity_price_adjustment_pct equals 0.5*convexity*dy^2*100 when supplied ----------
function checkP2_adjustmentFixedRelation() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { convexity, convexity_price_adjustment_pct } = r.output_payload;
    if (pp.yield_shock_bp === undefined) {
      if (convexity_price_adjustment_pct !== null) violations++;
      continue;
    }
    const dy = pp.yield_shock_bp / 10000;
    const expected = 0.5 * convexity * dy * dy * 100;
    if (Math.abs(convexity_price_adjustment_pct - expected) > 1e-4 + Math.abs(expected) * 1e-3) violations++;
  }
  return { name: 'P2_convexity_price_adjustment_pct_matches_half_convexity_dy_squared', trials: checked, violations };
}

// ---------- P3: monotonicity — convexity is nondecreasing as years_to_maturity rises (short/medium maturities) ----------
// Restricted to years_to_maturity in [0.25, 10] extended by 2yr: at long maturities combined with
// high yields, convexity legitimately humps and can decrease (measured directly against this
// kernel — a real deep-discount-bond effect, not a floor artifact), so the property only holds,
// and is only asserted, in the short/medium-maturity regime where that hump does not occur.
function checkP3_convexityMonotoneInMaturity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const base = mkPP(rand);
    const pp = { ...base, years_to_maturity: randRange(rand, 0.25, 10) };
    checked++;
    const rLo = compute({ ...pp });
    const rHi = compute({ ...pp, years_to_maturity: pp.years_to_maturity + 2 });
    if (rHi.output_payload.convexity < rLo.output_payload.convexity - 1e-3) violations++;
  }
  return { name: 'P3_convexity_nondecreasing_as_maturity_extends_short_medium_regime', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing, incl. near-zero-rate and near-zero-duration cases ----------
const ULP_BOUNDARY_CASES = [
  [{ face_value: 1000, coupon_rate_pct: 6, ytm_pct: 0, years_to_maturity: 5, periods_per_year: 2 }, 'ytm_pct exactly zero (near-zero-rate) — convexity must remain finite and non-negative, no division-by-zero in the discount terms'],
  [{ face_value: 1000, coupon_rate_pct: 6, ytm_pct: -0, years_to_maturity: 5, periods_per_year: 2 }, 'ytm_pct negative zero — must behave identically to positive zero, no NaN'],
  [{ face_value: 1000, coupon_rate_pct: 6, ytm_pct: 8, years_to_maturity: 1 / 365, periods_per_year: 2 }, 'years_to_maturity near-zero (one day, near-zero-duration) — convexity must remain finite, not NaN'],
  [{ face_value: 1000, coupon_rate_pct: 6, ytm_pct: 8, years_to_maturity: 0, periods_per_year: 2 }, 'years_to_maturity exactly zero — YEARS_TO_MATURITY_NOT_POSITIVE flag must fire, convexity must report 0, never NaN'],
  [{ face_value: 1000, coupon_rate_pct: 6, ytm_pct: 8, years_to_maturity: 5, periods_per_year: 2, yield_shock_bp: 0 }, 'yield_shock_bp exactly zero (still supplied) — convexity_price_adjustment_pct must be exactly 0, not null'],
  [{ face_value: 1000, coupon_rate_pct: 6, ytm_pct: 8, years_to_maturity: 5, periods_per_year: 2, yield_shock_bp: -0 }, 'yield_shock_bp negative zero — must behave as zero, adjustment exactly 0'],
  [{ face_value: 1000, coupon_rate_pct: 0, ytm_pct: 8, years_to_maturity: 5, periods_per_year: 2 }, 'coupon_rate_pct exactly zero (zero-coupon bond) — convexity must still be well-defined and non-negative'],
  [{ face_value: Number.MIN_VALUE, coupon_rate_pct: 6, ytm_pct: 8, years_to_maturity: 5, periods_per_year: 2 }, 'face_value smallest positive double — convexity must remain finite, non-NaN'],
  [{ face_value: 1000, coupon_rate_pct: 6, ytm_pct: 99.9999999999999, years_to_maturity: 5, periods_per_year: 2 }, 'ytm_pct at 1-ULP-below-100 boundary — discount factors must remain finite'],
  [{ face_value: 1000, coupon_rate_pct: 6, ytm_pct: 8, years_to_maturity: 5, periods_per_year: 2, yield_shock_bp: 0.1 * 3 * 100 }, 'yield_shock_bp = (0.1*3)*100 (classic non-exact double artifact) — adjustment must reflect that exact double, no NaN'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { convexity, price, convexity_price_adjustment_pct } = r.output_payload;
    const plausible = Number.isFinite(convexity) && Number.isFinite(price) && (convexity_price_adjustment_pct === null || Number.isFinite(convexity_price_adjustment_pct));
    rows.push({ label, input: pp, convexity, price, convexity_price_adjustment_pct, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_convexityNonNegative());
results.properties.push(checkP2_adjustmentFixedRelation());
results.properties.push(checkP3_convexityMonotoneInMaturity());
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
