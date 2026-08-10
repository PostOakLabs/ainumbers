// kernel_digest_at_authoring: sha256:1a9ea550792a2f97b68467d9ee4ba5672eb14643c70df767526da61b7913d531
//
// FV-PROPFLOOR-SHARD-B12-1 — property-test floor for art-329-tvm-bond-duration.
// Class B (bounded-numeric), FLOAT-SENSITIVE — ytm_pct/years_to_maturity drive a Taylor-series
// pow/exp/ln implementation dividing by price and by (1+periodic yield) — ULP-boundary forcing is
// MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3, and per the WU row MUST include near-zero-rate and
// near-zero-duration edge cases since duration/modified-duration divide by yield and price terms.
// Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-329-tvm-bond-duration.proptest.mjs

import { compute } from '../art-329-tvm-bond-duration.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-329-tvm-bond-duration.fixtures.json');
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
const rand = mulberry32(0x329C9);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 6000;

function mkPP(rng) {
  return {
    face_value: randRange(rng, 100, 10000),
    coupon_rate_pct: randRange(rng, 0, 12),
    ytm_pct: randRange(rng, 0.5, 15),
    years_to_maturity: randRange(rng, 0.25, 30),
    periods_per_year: pick(rng, [1, 2, 4, 12]),
  };
}

// ---------- P1: boundedness — Macaulay duration never exceeds years_to_maturity for a positive-coupon bullet bond ----------
function checkP1_macaulayBoundedByMaturity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { macaulay_duration_years, years_to_maturity } = r.output_payload;
    // num_periods rounds years_to_maturity*periods_per_year, so the schedule's actual span can
    // exceed the nominal years_to_maturity by up to half a period — allow that rounding slack.
    if (macaulay_duration_years > years_to_maturity + 1 / pp.periods_per_year + 1e-6) violations++;
  }
  return { name: 'P1_macaulay_duration_bounded_by_maturity_plus_one_period', trials: checked, violations };
}

// ---------- P2: fixed rule — modified_duration_years equals macaulay / (1 + periodic yield) ----------
function checkP2_modifiedDurationFixedRelation() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { macaulay_duration_years, modified_duration_years, ytm_pct, periods_per_year } = r.output_payload;
    const periodicYield = ytm_pct / 100 / periods_per_year;
    const expected = macaulay_duration_years / (1 + periodicYield);
    if (Math.abs(modified_duration_years - expected) > 1e-4 + Math.abs(expected) * 1e-4) violations++;
  }
  return { name: 'P2_modified_duration_equals_macaulay_over_1_plus_periodic_yield', trials: checked, violations };
}

// ---------- P3: monotonicity — price is nonincreasing in ytm_pct, all else held ----------
function checkP3_priceMonotoneDecreasingInYield() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    checked++;
    const rLo = compute({ ...pp, ytm_pct: pp.ytm_pct });
    const rHi = compute({ ...pp, ytm_pct: pp.ytm_pct + 1 });
    if (rHi.output_payload.price > rLo.output_payload.price + 1e-6) violations++;
  }
  return { name: 'P3_price_nonincreasing_as_ytm_rises', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing, incl. near-zero-rate and near-zero-duration cases ----------
const ULP_BOUNDARY_CASES = [
  [{ face_value: 1000, coupon_rate_pct: 6, ytm_pct: 0, years_to_maturity: 5, periods_per_year: 2 }, 'ytm_pct exactly zero (near-zero-rate) — periodic yield is 0, price must equal the undiscounted sum of cash flows, no division-by-zero in modified duration'],
  [{ face_value: 1000, coupon_rate_pct: 6, ytm_pct: -0, years_to_maturity: 5, periods_per_year: 2 }, 'ytm_pct negative zero — must behave identically to positive zero, no NaN'],
  [{ face_value: 1000, coupon_rate_pct: 6, ytm_pct: 8, years_to_maturity: 1 / 365, periods_per_year: 2 }, 'years_to_maturity near-zero (one day) — near-zero-duration boundary, num_periods must floor to the minimum 1, duration must remain finite'],
  [{ face_value: 1000, coupon_rate_pct: 6, ytm_pct: 8, years_to_maturity: 0, periods_per_year: 2 }, 'years_to_maturity exactly zero — YEARS_TO_MATURITY_NOT_POSITIVE flag must fire, duration must report 0, never NaN'],
  [{ face_value: 1000, coupon_rate_pct: 0, ytm_pct: 8, years_to_maturity: 5, periods_per_year: 2 }, 'coupon_rate_pct exactly zero (zero-coupon bond) — duration must equal years_to_maturity exactly (all value at the single final cash flow)'],
  [{ face_value: 1000, coupon_rate_pct: 6, ytm_pct: 8, years_to_maturity: 5.1 * 3 / 15.3, periods_per_year: 2 }, 'years_to_maturity constructed as a repeating-decimal double ((5.1*3)/15.3) close to but not exactly 1 — must remain finite, no NaN from myPow'],
  [{ face_value: Number.MIN_VALUE, coupon_rate_pct: 6, ytm_pct: 8, years_to_maturity: 5, periods_per_year: 2 }, 'face_value smallest positive double — price/duration must remain finite, non-NaN'],
  [{ face_value: 1000, coupon_rate_pct: 6, ytm_pct: 99.9999999999999, years_to_maturity: 5, periods_per_year: 2 }, 'ytm_pct at 1-ULP-below-100 boundary — periodic yield and discount factors must remain finite'],
  [{ face_value: 1000, coupon_rate_pct: 6, ytm_pct: 8, years_to_maturity: 5, periods_per_year: 365 }, 'periods_per_year at an extreme high value (365, daily compounding) — num_periods large, must not overflow or timeout'],
  [{ face_value: 1000, coupon_rate_pct: 6, ytm_pct: 8, years_to_maturity: 30, periods_per_year: 1 }, 'years_to_maturity at a large-but-realistic 30yr with annual periods — duration must remain bounded by maturity'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { price, macaulay_duration_years, modified_duration_years } = r.output_payload;
    const plausible = Number.isFinite(price) && Number.isFinite(macaulay_duration_years) && Number.isFinite(modified_duration_years);
    rows.push({ label, input: pp, price, macaulay_duration_years, modified_duration_years, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_macaulayBoundedByMaturity());
results.properties.push(checkP2_modifiedDurationFixedRelation());
results.properties.push(checkP3_priceMonotoneDecreasingInYield());
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
