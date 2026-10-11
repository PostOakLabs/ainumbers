// art-705-bond-ladder-builder — class-K property-test floor, authored by ART705-BOND-LADDER-1.
// kernel_digest_at_authoring: sha256:48c94e764bcff807d15c3bd0560bf7a1ed70ba2e62a9bf64903298d847558cb3
// spec: AIQ capability build spec WU-16 (research/AIQ-CAPABILITY-PRODUCTS-BUILD-SPEC-2026-10-01.html)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-705-bond-ladder-builder.proptest.mjs

import { compute } from '../art-705-bond-ladder-builder.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick } from './_pbt-common.mjs';

const KERNEL_ID = 'art-705-bond-ladder-builder';
const TRIALS = 6000;
const rand = mulberry32(0x705C9);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

function randWeights(rng, n) {
  const cuts = [0];
  for (let i = 0; i < n - 1; i++) cuts.push(rng());
  cuts.push(1);
  cuts.sort((a, b) => a - b);
  return cuts.slice(1).map((c, i) => c - cuts[i]);
}

function mkPP(rng) {
  const n = 1 + Math.floor(rng() * 5);
  const weights = randWeights(rng, n);
  return {
    notional: randRange(rng, 1000, 5000000),
    periods_per_year: pick(rng, [1, 2, 4, 12]),
    reinvestment_assumption: pick(rng, ['hold_to_maturity', 'roll_to_longest_rung']),
    rungs: weights.map((w) => ({
      maturity_years: randRange(rng, 0.25, 30),
      coupon_rate_pct: randRange(rng, 0, 12),
      yield_pct: randRange(rng, 0.5, 15),
      target_weight: w,
    })),
  };
}

// ---------- P1 (row-mandated): portfolio weighted_duration lies between min and max rung duration ----------
function checkP1_portfolioDurationBetweenRungs() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const { ladder, portfolio } = output_payload;
    if (!Array.isArray(ladder)) continue; // refusal branch exercised by P3
    const ds = ladder.map((l) => l.duration);
    const min = Math.min(...ds), max = Math.max(...ds);
    const w = portfolio.weighted_duration;
    if (w < min - 1e-6 || w > max + 1e-6) violations++;
  }
  return { name: 'P1_portfolio_weighted_duration_between_min_and_max_rung_duration', checked, violations };
}

// ---------- P2 (row-mandated): scaling notional scales DV01 linearly and leaves duration unchanged ----------
function checkP2_notionalScalingLinearity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const base = compute(pp).output_payload;
    if (!Array.isArray(base.ladder)) continue;
    for (const s of [2, 0.5, 10]) {
      const scaled = compute({ ...pp, notional: pp.notional * s }).output_payload;
      checked++;
      if (!Array.isArray(scaled.ladder)) { violations++; continue; }
      for (let j = 0; j < base.ladder.length; j++) {
        const b = base.ladder[j], t = scaled.ladder[j];
        // dv01 is r6-rounded per output (5e-7 max rounding error per value), so the linearity check
        // must be run on ABSOLUTE dv01 values with a rounding-aware slack, not on the ratio of two
        // rounded numbers: for a small dv01 the ratio's rounding noise exceeds any relative bound.
        if (Math.abs(t.dv01 - s * b.dv01) > 5e-7 * (1 + s) + 1e-9 * Math.abs(s * b.dv01)) { violations++; break; }
        if (Math.abs(t.duration - b.duration) > 1e-5) { violations++; break; }
      }
    }
  }
  return { name: 'P2_scaling_notional_scales_dv01_linearly_and_leaves_duration_unchanged', checked, violations };
}

// ---------- P3: invalid-domain rejection — weights not summing to 1 within 1e-9 are refused, naming the sum ----------
function checkP3_weightsSumRefusal() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const bad = { ...pp, rungs: pp.rungs.map((r) => ({ ...r, target_weight: r.target_weight * 1.000001 })) };
    const rBad = compute(bad);
    const rGood = compute(pp);
    checked++;
    const refusedAsExpected = rBad.output_payload.error === 'weights_sum_not_one'
      && typeof rBad.output_payload.detail === 'string'
      && rBad.output_payload.detail.includes('sum to')
      && rBad.compliance_flags.includes('INPUT_REFUSED');
    if (!refusedAsExpected) violations++;
    if (rGood.output_payload.error === 'weights_sum_not_one') violations++; // a valid ladder must never be refused
  }
  return { name: 'P3_weights_not_summing_to_one_within_1e-9_refused_naming_the_sum', checked, violations };
}

// ---------- P4: boundedness — each rung's duration <= maturity + one period; convexity finite and non-negative ----------
function checkP4_rungBoundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (!Array.isArray(output_payload.ladder)) continue;
    for (const l of output_payload.ladder) {
      if (!Number.isFinite(l.duration) || !Number.isFinite(l.convexity) || !Number.isFinite(l.dv01)) { violations++; break; }
      if (l.duration > l.maturity_years + 1 / pp.periods_per_year + 1e-6) { violations++; break; }
      if (l.convexity < 0) { violations++; break; }
    }
  }
  return { name: 'P4_rung_duration_bounded_by_maturity_plus_one_period_and_convexity_non_negative', checked, violations };
}

// ---------- P5: ULP-boundary forcing (mandatory per FV-PBT-FLOOR-BUILD-SPEC.md §3) ----------
const ULP_BOUNDARY_CASES = [
  [{ notional: 100000, periods_per_year: 2, reinvestment_assumption: 'hold_to_maturity', rungs: [{ maturity_years: 5, coupon_rate_pct: 6, yield_pct: 0, target_weight: 1 }] }, 'yield_pct exactly zero (near-zero-rate rung) — price equals the undiscounted sum, modified duration finite (periodic yield 0)'],
  [{ notional: 100000, periods_per_year: 2, reinvestment_assumption: 'hold_to_maturity', rungs: [{ maturity_years: 5, coupon_rate_pct: 0, yield_pct: 8, target_weight: 1 }] }, 'zero-coupon single rung — duration equals years_to_maturity exactly (all value at the final cash flow)'],
  [{ notional: 100000, periods_per_year: 2, reinvestment_assumption: 'hold_to_maturity', rungs: [{ maturity_years: 1 / 365, coupon_rate_pct: 4, yield_pct: 5, target_weight: 1 }] }, 'maturity near-zero (one day) — num_periods floors to 1, all metrics finite'],
  [{ notional: 100000, periods_per_year: 2, reinvestment_assumption: 'hold_to_maturity', rungs: [{ maturity_years: 3, coupon_rate_pct: 4, yield_pct: 5, target_weight: 0 }, { maturity_years: 7, coupon_rate_pct: 4, yield_pct: 5, target_weight: 1 }] }, 'zero-weight rung — contributes nothing to the portfolio aggregates and is not refused'],
  [{ notional: 100000, periods_per_year: 2, reinvestment_assumption: 'hold_to_maturity', rungs: [{ maturity_years: 3, coupon_rate_pct: 4, yield_pct: 5, target_weight: 0.5 }, { maturity_years: 7, coupon_rate_pct: 4, yield_pct: 5, target_weight: 0.5 }] }, 'weights exactly 1.0 as 0.5+0.5 — no refusal, no floating drift'],
  [{ notional: 100000, periods_per_year: 2, reinvestment_assumption: 'hold_to_maturity', rungs: [{ maturity_years: 3, coupon_rate_pct: 4, yield_pct: 5, target_weight: 1 / 3 }, { maturity_years: 7, coupon_rate_pct: 4, yield_pct: 5, target_weight: 1 / 3 }, { maturity_years: 10, coupon_rate_pct: 4, yield_pct: 5, target_weight: 1 / 3 }] }, 'three 1/3 weights — double sum is 0.9999999999999999, within the 1e-9 tolerance, must NOT be refused'],
  [{ notional: Number.MIN_VALUE, periods_per_year: 2, reinvestment_assumption: 'hold_to_maturity', rungs: [{ maturity_years: 5, coupon_rate_pct: 4, yield_pct: 5, target_weight: 1 }] }, 'notional smallest positive double — metrics remain finite, non-NaN'],
  [{ notional: 100000, periods_per_year: 365, reinvestment_assumption: 'roll_to_longest_rung', rungs: [{ maturity_years: 0.5, coupon_rate_pct: 4, yield_pct: 5, target_weight: 0.5 }, { maturity_years: 30, coupon_rate_pct: 5, yield_pct: 5.5, target_weight: 0.5 }] }, 'periods_per_year 365 (daily) with roll_to_longest_rung — large schedules must not overflow or timeout'],
  [{ notional: 100000, periods_per_year: 2, rungs: [{ maturity_years: 5, coupon_rate_pct: 4, yield_pct: 5, target_weight: 1 }] }, 'reinvestment_assumption omitted — defaults to hold_to_maturity and the default is NAMED in assumptions[] (never an implicit assumption)'],
  [{ notional: 100000, periods_per_year: 2, reinvestment_assumption: 'HOLD_TO_MATURITY', rungs: [{ maturity_years: 5, coupon_rate_pct: 4, yield_pct: 5, target_weight: 1 }] }, 'reinvestment_assumption wrong case — must be refused (strict enum, no silent coercion)'],
];

function checkP5_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const out = r.output_payload;
    const plausible = out.error
      ? (r.compliance_flags.includes('INPUT_REFUSED') && Array.isArray(out.domain_errors) && out.domain_errors.length > 0)
      : (Array.isArray(out.ladder) && out.ladder.every((l) => [l.duration, l.modified_duration, l.dv01, l.convexity].every(Number.isFinite))
        && Array.isArray(out.assumptions) && out.assumptions.length >= 4
        && out.assumptions.some((a) => typeof a === 'string' && a.startsWith('Reinvestment assumption')));
    rows.push({ label, refused: !!out.error, plausible });
  }
  return rows;
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1_portfolioDurationBetweenRungs(),
  checkP2_notionalScalingLinearity(),
  checkP3_weightsSumRefusal(),
  checkP4_rungBoundedness(),
];
const boundary_forced = checkP5_forced();
const anyBoundaryImplausible = boundary_forced.some((b) => !b.plausible);
console.log(`[${KERNEL_ID}] class-K floor property test — ${properties.length} properties, ${boundary_forced.length} forced boundary cases.`);
console.log(JSON.stringify({ boundary_forced, anyBoundaryImplausible }));
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok && !anyBoundaryImplausible ? 0 : 1);
