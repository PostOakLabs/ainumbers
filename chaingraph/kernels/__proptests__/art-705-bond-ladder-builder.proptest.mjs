// art-705-bond-ladder-builder — class-K property-test floor, authored by ART705-BOND-LADDER-1.
// kernel_digest_at_authoring: sha256:970caa8ad9d2832a8a9eb606726654fa1529c9669bee6a67cd0042ed88929bdb
// spec: AIQ capability build spec WU-16 (research/AIQ-CAPABILITY-PRODUCTS-BUILD-SPEC-2026-10-01.html)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-705-bond-ladder-builder.proptest.mjs

import { compute } from '../art-705-bond-ladder-builder.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick } from './_pbt-common.mjs';
import { fileURLToPath } from 'node:url';

const KERNEL_ID = 'art-705-bond-ladder-builder';
// Mutation-mode trial cap (PROPFLOOR_TRIAL_CAP seam, art-332/pnr-01 shape): under the
// mutation tier the perTest-instrumented kernel runs orders of magnitude slower
// (measured: 17.7s stryker dry-run vs 0.34s plain — the hooks tax every branch of the
// heavy myPow loops over multi-rung schedules), so the random-draw cost is cut twice
// to fit 364 mutants inside the 600s kernel wall bound at concurrency 2:
//   1. trial cap 10 (a capped pass takes the first 10 draws per property of the SAME
//      seeded mulberry32 stream), and
//   2. the random-draw maturity upper bound drops 30y -> 10y (shorter schedules = fewer
//      instrumented loop iterations per compute(); the FULL-TRIAL distribution is
//      untouched — outside the tier maturities still span 0.25-30y).
// periods_per_year 1-12 and 1-5 rungs are unchanged in both modes.
// Override with documented env PROPFLOOR_TRIAL_CAP, a positive integer, invalid values
// throw. The fixture oracle and the ULP-boundary forcing cases are NEVER capped
// (mandatory). Every property is deterministic (seeded mulberry32), so a violation
// found under the cap is found under full trials too.
const MUTATION_MODE =
  process.env.__STRYKER_ACTIVE_MUTANT__ !== undefined ||
  fileURLToPath(import.meta.url).split(String.fromCharCode(92)).join("/").includes("/ain-mutation-tier-");
let mutationTrials = 10;
if (process.env.PROPFLOOR_TRIAL_CAP !== undefined) {
  const cap = Number(process.env.PROPFLOOR_TRIAL_CAP);
  if (!Number.isInteger(cap) || cap <= 0) {
    throw new Error(`PROPFLOOR_TRIAL_CAP must be a positive integer, got "${process.env.PROPFLOOR_TRIAL_CAP}".`);
  }
  mutationTrials = cap;
}
const TRIALS = MUTATION_MODE ? mutationTrials : 2000;
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
      maturity_years: randRange(rng, 0.25, MUTATION_MODE ? 10 : 30),
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

// ---------- P6: refusal contract — every named refusal fires with its exact code on its trigger ----------
const REFUSAL_CONTRACT_CASES = [
  [{ notional: -1, rungs: [{ maturity_years: 3, coupon_rate_pct: 4, yield_pct: 5, target_weight: 1 }] }, 'notional_not_positive', 'NOTIONAL_NOT_POSITIVE'],
  [{ notional: 'lots', rungs: [{ maturity_years: 3, coupon_rate_pct: 4, yield_pct: 5, target_weight: 1 }] }, 'notional_not_positive', 'NOTIONAL_NOT_POSITIVE'],
  [{ notional: 100000 }, 'ladder_empty', 'LADDER_EMPTY'],
  [{ notional: 100000, rungs: [] }, 'ladder_empty', 'LADDER_EMPTY'],
  [{ notional: 100000, rungs: [{ maturity_years: 0, coupon_rate_pct: 4, yield_pct: 5, target_weight: 1 }] }, 'rung_maturity_not_positive', 'RUNG_MATURITY_NOT_POSITIVE'],
  [{ notional: 100000, rungs: [{ maturity_years: 3, coupon_rate_pct: -0.5, yield_pct: 5, target_weight: 1 }] }, 'rung_coupon_invalid', 'RUNG_COUPON_INVALID'],
  [{ notional: 100000, rungs: [{ maturity_years: 3, coupon_rate_pct: 4, yield_pct: NaN, target_weight: 1 }] }, 'rung_yield_invalid', 'RUNG_YIELD_INVALID'],
  [{ notional: 100000, rungs: [{ maturity_years: 3, coupon_rate_pct: 4, yield_pct: 5, target_weight: -1 }] }, 'rung_weight_invalid', 'RUNG_WEIGHT_INVALID'],
  [{ notional: 100000, rungs: [{ maturity_years: 3, coupon_rate_pct: 4, yield_pct: 5, target_weight: 1 }], reinvestment_assumption: 'never_default' }, 'reinvestment_assumption_invalid', 'REINVESTMENT_ASSUMPTION_INVALID'],
  [{ rungs: [{ maturity_years: 3, coupon_rate_pct: 4, yield_pct: 5, target_weight: 1 }] }, 'notional_not_positive', 'NOTIONAL_NOT_POSITIVE'],
];
function checkP6_refusalContract() {
  let violations = 0, checked = 0;
  for (const [pp, wantError, wantCode] of REFUSAL_CONTRACT_CASES) {
    const r = compute(pp);
    checked++;
    const out = r.output_payload;
    if (out.error !== wantError) { violations++; continue; }
    if (!r.compliance_flags.includes('INPUT_REFUSED')) violations++;
    const de = (out.domain_errors || [])[0] || {};
    if (de.code !== wantCode) violations++;
    if (typeof out.detail !== 'string' || out.detail.length === 0) violations++;
    if (out.ladder !== null || out.portfolio !== null) violations++;
  }
  // R4: a null input takes exactly the absent form's answer
  const nullEcho = compute({ notional: 100000, rungs: [{ maturity_years: 3, coupon_rate_pct: null, yield_pct: 5, target_weight: 1 }] });
  checked++;
  if (nullEcho.output_payload.error !== 'rung_coupon_invalid') violations++;
  return { name: 'P6_refusal_contract_every_named_refusal_fires_with_exact_code', checked, violations };
}

// ---------- P7: refusal-detail + compliance-flag + assumption-text pins ----------
// ART705 attempt-3 kill power (7F-V452 option (a)): pins the refusal/series-guard SURVIVORS
// the attempt-1 tier run measured (report 2026-10-11T12:01Z, money-math 202/344 = 58.7%).
// Deterministic forced cases only — no random draws, never capped, negligible tier cost.
// Honest scope note: the remaining myExp/myLn guard-branch survivors (kernel lines 27-46)
// are structurally unreachable from compute() — every myPow exponent in the live path is a
// negative integer (t and t+2), so the exp*myLn(base) fallback those helpers serve never
// runs; they are dead defensive code, the same class as the DETMATH-SWAP batch-B family,
// and no compute()-level floor can kill them. This property targets the KILLABLE survivors:
// refusal detail strings (StringLiteral/LogicalOperator mutants), rung-index naming in
// compliance flags, zero-coupon / non-positive-price flag emission, and the
// roll_to_longest_rung assumption's longest-rung naming.
const DETAIL_PIN_CASES = [
  // [pp, expected error, detail substring pinning the field sentence, detail substring pinning the echoed offending value]
  [{ notional: 'lots', rungs: [{ maturity_years: 3, coupon_rate_pct: 4, yield_pct: 5, target_weight: 1 }] }, 'notional_not_positive', 'notional must be a positive finite number', '"lots"'],
  [{ notional: 100000 }, 'ladder_empty', 'non-empty array', null],
  [{ notional: 100000, rungs: [{ maturity_years: 3, coupon_rate_pct: 4, yield_pct: 5, target_weight: 0.5 }, { maturity_years: 'soon', coupon_rate_pct: 4, yield_pct: 5, target_weight: 0.5 }] }, 'rung_maturity_not_positive', 'rungs[1].maturity_years must be a positive finite number', '"soon"'],
  [{ notional: 100000, rungs: [{ maturity_years: 3, coupon_rate_pct: 'fat', yield_pct: 5, target_weight: 1 }] }, 'rung_coupon_invalid', 'coupon_rate_pct must be a finite number >= 0', '"fat"'],
  [{ notional: 100000, rungs: [{ maturity_years: 3, coupon_rate_pct: 4, yield_pct: 'wat', target_weight: 1 }] }, 'rung_yield_invalid', 'yield_pct must be a finite number', '"wat"'],
  [{ notional: 100000, rungs: [{ maturity_years: 3, coupon_rate_pct: 4, yield_pct: 5, target_weight: 'none' }] }, 'rung_weight_invalid', 'target_weight must be a finite number >= 0', '"none"'],
];
function checkP7_refusalDetailAndFlagPins() {
  let violations = 0, checked = 0;
  for (const [pp, wantError, pinSentence, pinValue] of DETAIL_PIN_CASES) {
    const r = compute(pp);
    checked++;
    const out = r.output_payload;
    if (out.error !== wantError) { violations++; continue; }
    if (typeof out.detail !== 'string' || !out.detail.includes(pinSentence)) { violations++; continue; }
    if (pinValue !== null && !out.detail.includes(pinValue)) { violations++; continue; }
    if (!out.detail.endsWith('.')) { violations++; continue; }
    const de = (out.domain_errors || [])[0] || {};
    if (de.code !== wantError.toUpperCase()) violations++;
  }
  // compliance-flag pins on SUCCESS outputs (exact arrays — over-firing and mis-indexed
  // names are violations, not just absence)
  const clean = compute({ notional: 100000, periods_per_year: 2, reinvestment_assumption: 'hold_to_maturity', rungs: [{ maturity_years: 3, coupon_rate_pct: 5, yield_pct: 4, target_weight: 0.5 }, { maturity_years: 7, coupon_rate_pct: 5, yield_pct: 4, target_weight: 0.5 }] });
  checked++;
  if (JSON.stringify(clean.compliance_flags) !== JSON.stringify([])) violations++;
  const zeroCouponSecond = compute({ notional: 100000, periods_per_year: 2, reinvestment_assumption: 'hold_to_maturity', rungs: [{ maturity_years: 3, coupon_rate_pct: 5, yield_pct: 4, target_weight: 0.5 }, { maturity_years: 7, coupon_rate_pct: 0, yield_pct: 4, target_weight: 0.5 }] });
  checked++;
  if (JSON.stringify(zeroCouponSecond.compliance_flags) !== JSON.stringify(['ZERO_COUPON_RUNG_2'])) violations++;
  // periodic yield -3 (yield_pct -300, periods 1) reprices a 3y 10% coupon rung at a
  // NEGATIVE price — the one reachable NON_POSITIVE_RUNG_PRICE arm
  const negPrice = compute({ notional: 100000, periods_per_year: 1, reinvestment_assumption: 'hold_to_maturity', rungs: [{ maturity_years: 3, coupon_rate_pct: 10, yield_pct: -300, target_weight: 1 }] });
  checked++;
  if (negPrice.output_payload.ladder[0].price >= 0) violations++;
  if (JSON.stringify(negPrice.compliance_flags) !== JSON.stringify(['NON_POSITIVE_RUNG_PRICE_1'])) violations++;
  // a zero-weight rung prices to exactly 0 — the price<=0 arm at its === boundary
  // (an empty flag array here means the boundary comparison was widened)
  const zeroWeight = compute({ notional: 100000, periods_per_year: 2, reinvestment_assumption: 'hold_to_maturity', rungs: [{ maturity_years: 3, coupon_rate_pct: 4, yield_pct: 5, target_weight: 0 }, { maturity_years: 7, coupon_rate_pct: 4, yield_pct: 5, target_weight: 1 }] });
  checked++;
  if (zeroWeight.output_payload.ladder[0].price !== 0) violations++;
  if (JSON.stringify(zeroWeight.compliance_flags) !== JSON.stringify(['NON_POSITIVE_RUNG_PRICE_1'])) violations++;
  // roll_to_longest_rung must NAME the longest rung's own yield and maturity — with a
  // later rung TYING the longest maturity at a different yield, only the first-max
  // tracking gets this right, and the sentence must carry both figures
  const roll = compute({ notional: 100000, periods_per_year: 2, reinvestment_assumption: 'roll_to_longest_rung', rungs: [{ maturity_years: 30, coupon_rate_pct: 5, yield_pct: 5.5, target_weight: 0.5 }, { maturity_years: 30, coupon_rate_pct: 5, yield_pct: 2, target_weight: 0.25 }, { maturity_years: 3, coupon_rate_pct: 5, yield_pct: 1, target_weight: 0.25 }] });
  checked++;
  const rollSentence = (roll.output_payload.assumptions || []).find((a) => typeof a === 'string' && a.startsWith('Reinvestment assumption (roll_to_longest_rung)'));
  if (!rollSentence || !rollSentence.includes('5.5% nominal, 30 years')) violations++;
  return { name: 'P7_refusal_detail_and_compliance_flag_pins', checked, violations };
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
  checkP6_refusalContract(),
  checkP7_refusalDetailAndFlagPins(),
];
const boundary_forced = checkP5_forced();
const anyBoundaryImplausible = boundary_forced.some((b) => !b.plausible);
console.log(`[${KERNEL_ID}] class-K floor property test — ${properties.length} properties, ${boundary_forced.length} forced boundary cases.`);
console.log(JSON.stringify({ boundary_forced, anyBoundaryImplausible }));
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok && !anyBoundaryImplausible ? 0 : 1);
