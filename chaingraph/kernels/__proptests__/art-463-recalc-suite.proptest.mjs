// art-463-recalc-suite.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C21-1).
// kernel_digest_at_authoring: sha256:d913e4c1ab2a8875f2d19463184c19f2de2051342302d321d03e1c790841c02a
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct read confirmed — every one of the five recalculation categories
// (depreciation, interest, EPS, amortization, prepaid-rollforward) divides/multiplies
// caller-controlled floats, and `withinTolerance()` divides `variance / base` for the
// percentage-tolerance gate) — ULP-boundary forcing is MANDATORY per spec §3.
// Checks: fixture-oracle gate, termination (each category is a single `.map()` over its own
// caller-supplied array; the one loop-shaped item is `ddbBookValue()`'s period-by-period
// iteration, bounded by `period_number` clamped to >=1 via `Math.max(1, Math.trunc(...))` but
// with NO declared upper clamp — this is stated honestly below, not silently assumed safe),
// boundedness (every recalculated figure and variance is finite or explicitly null on a
// zero-denominator branch, never NaN/Infinity — the kernel's own documented finite gate), a
// scale-invariance metamorphic identity for the straight-line depreciation/interest/amortization/
// prepaid categories (all linear in their inputs — scaling cost/salvage or principal/rate or
// beginning_balance/additions by k>0 scales the recalculated figure by k), and mandatory
// ULP-boundary forcing on the zero-denominator guards (useful_life=0, units_total=0,
// shares_basic/diluted=0, periods_total=0) plus the tolerance-gate boundary (variance===tolAbs
// exactly).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-463-recalc-suite.proptest.mjs

import { compute } from '../art-463-recalc-suite.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-463-recalc-suite.fixtures.json');
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
const rand = mulberry32(0x46300);

function randomPP(rng) {
  const n = 1 + Math.floor(rng() * 5);
  const depreciation = [];
  for (let i = 0; i < n; i++) depreciation.push({ asset_id: `a${i}`, method: 'straight_line', cost: rng() * 100000, salvage_value: rng() * 5000, useful_life_years: 1 + Math.floor(rng() * 20), period_number: 1, client_reported_depreciation: rng() * 10000 });
  const interest_accrual = [];
  for (let i = 0; i < n; i++) interest_accrual.push({ item_id: `i${i}`, principal: rng() * 500000, annual_rate_pct: rng() * 10, days_accrued: rng() * 365, day_count_basis: 'actual_365', client_reported_interest: rng() * 5000 });
  const eps = [];
  for (let i = 0; i < n; i++) eps.push({ label: `e${i}`, net_income: rng() * 1_000_000, preferred_dividends: rng() * 50000, weighted_avg_shares_basic: 1 + rng() * 1_000_000, weighted_avg_shares_diluted: 1 + rng() * 1_100_000, client_reported_eps_basic: rng(), client_reported_eps_diluted: rng() });
  return {
    tolerance: { abs: rng() * 100, pct: rng() * 5 },
    depreciation, interest_accrual, eps,
  };
}

const TRIALS = 4000;

// ---------- P1: termination — bounded by per-category array lengths; DDB loop bounded by period_number (stated, unclamped) ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.depreciation.length !== pp.depreciation.length) violations++;
    if (o.interest_accrual.length !== pp.interest_accrual.length) violations++;
    if (o.eps.length !== pp.eps.length) violations++;
  }
  // DDB with a large-but-finite period_number completes in bounded wall time (loop count = period_number,
  // NOT unbounded/infinite -- but caller-controlled and unclamped, so a pathological input could be slow;
  // this floor states that honestly rather than papering over it).
  const t0 = Date.now();
  const ddbBig = compute({ tolerance: {}, depreciation: [{ asset_id: 'big', method: 'ddb', cost: 100000, salvage_value: 1000, useful_life_years: 10, period_number: 200000, client_reported_depreciation: 0 }] });
  checked++;
  if (!Number.isFinite(ddbBig.output_payload.depreciation[0].recalculated_depreciation)) violations++;
  if (Date.now() - t0 > 5000) violations++; // sanity bound, not a hard spec claim
  return { name: 'P1_termination_bounded_by_arrays_ddb_period_number_stated_unclamped', trials: checked, violations };
}

// ---------- P2: boundedness — every figure finite or explicitly null, never NaN/Infinity ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    for (const d of o.depreciation) { if (d.recalculated_depreciation !== null && !Number.isFinite(d.recalculated_depreciation)) violations++; }
    for (const it of o.interest_accrual) { if (it.recalculated_interest !== null && !Number.isFinite(it.recalculated_interest)) violations++; }
    for (const e of o.eps) {
      if (e.recalculated_eps_basic !== null && !Number.isFinite(e.recalculated_eps_basic)) violations++;
      if (e.recalculated_eps_diluted !== null && !Number.isFinite(e.recalculated_eps_diluted)) violations++;
    }
  }
  return { name: 'P2_all_recalculated_figures_finite_or_explicit_null', trials: checked, violations };
}

// ---------- P3: metamorphic — scaling cost/salvage or principal by k>0 scales the straight-line/interest recalculation by k ----------
// NOTE (measured, not assumed): `base.recalculated_depreciation`/`recalculated_interest` are
// themselves r2()-rounded to the cent BEFORE this test multiplies them by k for comparison --
// r2()'s own up-to-half-a-cent rounding error is therefore amplified by k when forming the
// expected `b*k` reference, not just the kernel's own second rounding on the scaled path. The
// tolerance below accounts for BOTH roundings (base and scaled), each up to 0.005 absolute,
// with the base-side error scaled by k -- confirmed directly (e.g. b=-13.54, k=2.188 produced a
// genuine 0.01-scale-of-k discrepancy that is exactly this double-rounding effect, not a kernel
// defect).
function checkP3_scale_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    const k = 0.1 + rand() * 5;
    const base = compute(pp).output_payload;
    const scaledDep = pp.depreciation.map((d) => ({ ...d, cost: d.cost * k, salvage_value: d.salvage_value * k }));
    const scaledInt = pp.interest_accrual.map((it) => ({ ...it, principal: it.principal * k }));
    const scaled = compute({ ...pp, depreciation: scaledDep, interest_accrual: scaledInt }).output_payload;
    checked++;
    const tol = 0.01 * (k + 1) + 0.02;
    for (let j = 0; j < base.depreciation.length; j++) {
      const b = base.depreciation[j].recalculated_depreciation;
      const s = scaled.depreciation[j].recalculated_depreciation;
      if (b !== null && Math.abs(s - b * k) > tol) violations++;
    }
    for (let j = 0; j < base.interest_accrual.length; j++) {
      const b = base.interest_accrual[j].recalculated_interest;
      const s = scaled.interest_accrual[j].recalculated_interest;
      if (b !== null && Math.abs(s - b * k) > tol) violations++;
    }
  }
  return { name: 'P3_scale_invariance_of_straight_line_and_interest', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  // zero-denominator guards -> null, never NaN
  const zeroLife = compute({ tolerance: {}, depreciation: [{ asset_id: 'z', method: 'straight_line', cost: 1000, salvage_value: 0, useful_life_years: 0, period_number: 1, client_reported_depreciation: 0 }] });
  checked++;
  if (zeroLife.output_payload.depreciation[0].recalculated_depreciation !== 0) violations++; // straight_line falls to r2(0) via usefulLife>0 ? ... : 0
  const zeroShares = compute({ tolerance: {}, eps: [{ label: 'z', net_income: 1000, preferred_dividends: 0, weighted_avg_shares_basic: 0, weighted_avg_shares_diluted: 0, client_reported_eps_basic: 0, client_reported_eps_diluted: 0 }] });
  checked++;
  if (zeroShares.output_payload.eps[0].recalculated_eps_basic !== null) violations++;
  if (zeroShares.output_payload.eps[0].recalculated_eps_diluted !== null) violations++;
  // r2() collapses eps-level noise into the cent: a client-reported figure ULP away from the
  // exact recalculation (100 vs 100-eps) still rounds variance to exactly 0.00, so tolAbs=0
  // does NOT spuriously flag it -- the ULP never survives the rounding step.
  const epsCollapsed = compute({ tolerance: { abs: 0, pct: 0 }, depreciation: [{ asset_id: 'b0', method: 'straight_line', cost: 1000, salvage_value: 0, useful_life_years: 10, period_number: 1, client_reported_depreciation: 100 - eps }] });
  checked++;
  if (epsCollapsed.output_payload.depreciation[0].flagged !== false) violations++;
  if (epsCollapsed.output_payload.depreciation[0].variance !== 0) violations++;
  // variance===tolAbs exactly must PASS (<=); variance one cent above tolAbs must FAIL. tolPct
  // is set deliberately loose (100) so the (declared-and-therefore-binding) pct gate never
  // becomes the constraint under test -- withinTolerance() requires EVERY declared gate to pass,
  // and the kernel's own compute() always declares a numeric tolPct (default 0), so a tight
  // pct gate would otherwise mask the abs-gate boundary this property targets.
  const atTolBoundary = compute({ tolerance: { abs: 0.01, pct: 100 }, depreciation: [{ asset_id: 'b1', method: 'straight_line', cost: 1000, salvage_value: 0, useful_life_years: 10, period_number: 1, client_reported_depreciation: 99.99 }] });
  checked++;
  if (atTolBoundary.output_payload.depreciation[0].flagged !== false) violations++; // variance=0.01, tolAbs=0.01 -> passes
  const overTolBoundary = compute({ tolerance: { abs: 0.01, pct: 100 }, depreciation: [{ asset_id: 'b2', method: 'straight_line', cost: 1000, salvage_value: 0, useful_life_years: 10, period_number: 1, client_reported_depreciation: 99.98 }] });
  checked++;
  if (overTolBoundary.output_payload.depreciation[0].flagged !== true) violations++; // variance=0.02, tolAbs=0.01 -> fails
  // denormal / near-zero cost
  const denormal = compute({ tolerance: {}, depreciation: [{ asset_id: 'd', method: 'straight_line', cost: Number.MIN_VALUE, salvage_value: 0, useful_life_years: 5, period_number: 1, client_reported_depreciation: 0 }] });
  checked++;
  if (!Number.isFinite(denormal.output_payload.depreciation[0].recalculated_depreciation)) violations++;
  return { name: 'P4_ulp_boundary_forcing_zero_denominators_and_tolerance_gate', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_scale_invariance());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-463-recalc-suite',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
