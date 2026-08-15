// art-633-asc280-reportable-segment-tester — class-B PROPERTY-TEST harness (DISE-SEG-K-1).
// kernel_digest_at_authoring: sha256:8bc3555025ec420d732bd26d7adfaba1d27866b97c2eb0420f0bb273852128cf
// spec: research/DISE-SEG-K-1.spec.md
// human_sign_off: PENDING
//
// FORMALVERIF-BUILD-SPEC.md §6.B shape: the inputs are unbounded real currency amounts, so
// enumeration is impossible in principle and the node is property-tested over stated ranges.
//
// float_sensitive: yes. This node is a boundary classifier whose verdict flips at an exact
// ratio, and the profit-or-loss test takes absolute values and a maximum across two subtotals,
// so IEEE-754 boundaries are forced explicitly (PB4/PB5) rather than sampled and hoped for.
//
// oracle: "declared -- clause silent". ASC 280-10-50-12 and 280-10-50-14, and their source text
// at FAS 131 paragraphs 18 and 20, specify NO rounding, precision or tolerance. The properties
// below therefore test conformance to the kernel's OWN declared mode (unrounded cross-multiplied
// compare, display rounding applied strictly afterwards) and never assert that this mode is
// abstractly more correct than another.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-633-asc280-reportable-segment-tester.proptest.mjs

import { compute } from '../art-633-asc280-reportable-segment-tester.kernel.mjs';
import { runFixtureOracle, findShapeViolations, summarize, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = 'art-633-asc280-reportable-segment-tester';
const NA = 'not_assessable';

function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

// A complete, well-formed policy_parameters object. Individual properties override only the
// fields they are exercising, so nothing else drifts underneath them.
function basePP(over = {}) {
  return {
    segment_revenue_external: 50,
    segment_revenue_intersegment: 0,
    combined_revenue_all_reported_segments: 1000,
    segment_profit_or_loss: 10,
    combined_profit_of_profitable_segments: 200,
    combined_loss_of_loss_segments: -50,
    segment_assets: 100,
    combined_assets_all_segments: 5000,
    reportable_external_revenue: 750,
    total_consolidated_revenue: 1000,
    aggregation_similar_products_services: true,
    aggregation_similar_production_processes: true,
    aggregation_similar_customer_type: true,
    aggregation_similar_distribution_methods: true,
    aggregation_similar_regulatory_environment: true,
    reportable_segment_count: 4,
    ...over,
  };
}

function testOf(payload, id) { return payload.tests.find((t) => t.test === id); }

// The three tests, each with the pp field that drives its numerator and the field(s) that drive
// its denominator. Used by the monotonicity properties so all three are covered identically
// rather than one being spot-checked and the others assumed.
const TEST_AXES = [
  { id: 'revenue', numKey: 'segment_revenue_external', denKey: 'combined_revenue_all_reported_segments' },
  { id: 'profit_or_loss', numKey: 'segment_profit_or_loss', denKey: 'combined_profit_of_profitable_segments' },
  { id: 'assets', numKey: 'segment_assets', denKey: 'combined_assets_all_segments' },
];

// PB1: MONOTONE IN EACH NUMERATOR — with the denominator fixed, raising a test's numerator never
// turns a met threshold into an unmet one. Checked independently on all three tests.
function checkPB1_monotoneInNumerator() {
  const rng = mulberry32(633001);
  let checked = 0, violations = 0;
  for (const axis of TEST_AXES) {
    for (let i = 0; i < 800; i++) {
      const den = randRange(rng, 1, 1e6);
      const numLo = randRange(rng, 0, den);
      const numHi = numLo + randRange(rng, 0, den);
      // profit_or_loss shares one denominator across two pp fields; pin the loss side to zero so
      // the declared denominator is unambiguous for this axis.
      const fixed = { [axis.denKey]: den, combined_loss_of_loss_segments: 0, segment_revenue_intersegment: 0 };
      const lo = compute(basePP({ ...fixed, [axis.numKey]: numLo }));
      const hi = compute(basePP({ ...fixed, [axis.numKey]: numHi }));
      checked++;
      const a = testOf(lo.output_payload, axis.id).threshold_met;
      const b = testOf(hi.output_payload, axis.id).threshold_met;
      if (a === true && b !== true) violations++;
    }
  }
  return { name: 'PB1_monotone_in_each_numerator', checked, violations };
}

// PB2: MONOTONE (DECREASING) IN EACH DENOMINATOR — with the numerator fixed, raising a
// denominator never turns an unmet threshold into a met one.
function checkPB2_monotoneInDenominator() {
  const rng = mulberry32(633002);
  let checked = 0, violations = 0;
  for (const axis of TEST_AXES) {
    for (let i = 0; i < 800; i++) {
      const num = randRange(rng, 1, 1e5);
      const denLo = randRange(rng, 1, 1e6);
      const denHi = denLo + randRange(rng, 0, 1e6);
      const fixed = { [axis.numKey]: num, combined_loss_of_loss_segments: 0, segment_revenue_intersegment: 0 };
      const lo = compute(basePP({ ...fixed, [axis.denKey]: denLo }));
      const hi = compute(basePP({ ...fixed, [axis.denKey]: denHi }));
      checked++;
      const a = testOf(lo.output_payload, axis.id).threshold_met;
      const b = testOf(hi.output_payload, axis.id).threshold_met;
      if (a === false && b === true) violations++;
    }
  }
  return { name: 'PB2_monotone_decreasing_in_each_denominator', checked, violations };
}

// PB3: ABSOLUTE-VALUE STEP NEVER INVERTS SIGN BEFORE COMPARE — 280-10-50-12(b) takes the
// ABSOLUTE amount of the segment's profit or loss, so a loss of -X and a profit of +X must
// classify identically against identical totals, the reported ratio is never negative, and the
// denominator side chosen depends only on the two combined subtotals, never on the candidate's
// own sign.
function checkPB3_absoluteValueSymmetry() {
  const rng = mulberry32(633003);
  let checked = 0, violations = 0;
  for (let i = 0; i < 1500; i++) {
    const mag = randRange(rng, 0, 1e5);
    const profitSide = randRange(rng, 0, 1e5);
    const lossSide = -randRange(rng, 0, 1e5);
    const fixed = {
      combined_profit_of_profitable_segments: profitSide,
      combined_loss_of_loss_segments: lossSide,
    };
    const pos = compute(basePP({ ...fixed, segment_profit_or_loss: mag }));
    const neg = compute(basePP({ ...fixed, segment_profit_or_loss: -mag }));
    checked++;
    const p = testOf(pos.output_payload, 'profit_or_loss');
    const n = testOf(neg.output_payload, 'profit_or_loss');
    if (p.threshold_met !== n.threshold_met) violations++;
    if (p.ratio !== n.ratio) violations++;
    if (p.denominator_side_used !== n.denominator_side_used) violations++;
    if (p.ratio !== null && p.ratio < 0) violations++;
    if (p.numerator < 0 || n.numerator < 0) violations++;
    // The signed value is still reported faithfully, so the absolute-value step is a comparison
    // step and not a loss of information.
    if (n.segment_profit_or_loss_signed !== -mag) violations++;
    // Denominator is the GREATER absolute side, never the two netted.
    const wantDen = Math.max(Math.abs(profitSide), Math.abs(lossSide));
    if (p.denominator !== wantDen) violations++;
  }
  return { name: 'PB3_absolute_value_never_inverts_sign_before_compare', checked, violations };
}

// PB4: BOUNDARY FORCING AT EXACTLY 10.000 PERCENT — the threshold is inclusive, so an exact
// boundary MEETS it. Includes the float trap the cross-multiplication exists for: 0.3/3 is
// exactly one tenth, but evaluating it as a division and comparing to 0.10 yields false.
function checkPB4_tenPercentBoundary() {
  let checked = 0, violations = 0;
  // Exact boundaries: numerator is exactly den/10, chosen so both are exactly representable.
  const exact = [[100, 1000], [1, 10], [50, 500], [0.5, 5], [12.5, 125], [1e6, 1e7], [0.3, 3]];
  for (const [num, den] of exact) {
    for (const axis of TEST_AXES) {
      const pp = basePP({
        [axis.numKey]: num, [axis.denKey]: den,
        combined_loss_of_loss_segments: 0, segment_revenue_intersegment: 0,
      });
      checked++;
      if (testOf(compute(pp).output_payload, axis.id).threshold_met !== true) violations++;
    }
  }
  // The specific trap: a division-based implementation reports 0.3/3 as below 10 percent.
  checked++;
  if (!((0.3 / 3) < 0.10)) violations++;           // the trap is real in this engine
  checked++;
  if (!((0.3 * 10) >= 3)) violations++;            // cross multiplication clears it
  checked++;
  if (testOf(compute(basePP({
    segment_revenue_external: 0.3, segment_revenue_intersegment: 0,
    combined_revenue_all_reported_segments: 3,
  })).output_payload, 'revenue').threshold_met !== true) violations++;
  // Strictly below the boundary must NOT meet it.
  const below = [[99.999999, 1000], [0.9999999, 10], [9, 1000]];
  for (const [num, den] of below) {
    for (const axis of TEST_AXES) {
      const pp = basePP({
        [axis.numKey]: num, [axis.denKey]: den,
        combined_loss_of_loss_segments: 0, segment_revenue_intersegment: 0,
      });
      checked++;
      if (testOf(compute(pp).output_payload, axis.id).threshold_met !== false) violations++;
    }
  }
  return { name: 'PB4_boundary_forcing_exactly_10_pct_inclusive', checked, violations };
}

// PB5: BOUNDARY FORCING AT EXACTLY 75.000 PERCENT — 280-10-50-14's stop condition is "at least
// 75 percent", so exactly 75 percent is SATISFIED and additional_segments_required is false.
function checkPB5_seventyFivePercentBoundary() {
  let checked = 0, violations = 0;
  const exact = [[750, 1000], [3, 4], [0.75, 1], [7.5, 10], [75, 100], [3e6, 4e6]];
  for (const [num, den] of exact) {
    const r = compute(basePP({ reportable_external_revenue: num, total_consolidated_revenue: den }));
    checked++;
    if (r.output_payload.coverage_75_pct.coverage_satisfied !== true) violations++;
    if (r.output_payload.coverage_75_pct.additional_segments_required !== false) violations++;
    if (r.compliance_flags.includes('COVERAGE_BELOW_75_PCT_ADDITIONAL_SEGMENTS_REQUIRED')) violations++;
  }
  const below = [[749.999999, 1000], [74.9999999, 100], [0.7499999, 1]];
  for (const [num, den] of below) {
    const r = compute(basePP({ reportable_external_revenue: num, total_consolidated_revenue: den }));
    checked++;
    if (r.output_payload.coverage_75_pct.coverage_satisfied !== false) violations++;
    if (r.output_payload.coverage_75_pct.additional_segments_required !== true) violations++;
    if (!r.compliance_flags.includes('COVERAGE_BELOW_75_PCT_ADDITIONAL_SEGMENTS_REQUIRED')) violations++;
  }
  return { name: 'PB5_boundary_forcing_exactly_75_pct_inclusive', checked, violations };
}

// PB6: ZERO AND NON-POSITIVE DENOMINATOR GUARD — every degenerate denominator reports
// not_assessable rather than false, emits no ratio, and never divides. Explicitly includes the
// both-sides-zero profit-or-loss case, which has no 50-12(b) denominator at all.
function checkPB6_zeroDenominatorGuard() {
  let checked = 0, violations = 0;
  // Revenue and assets have a single signed denominator, so zero AND negative are both degenerate.
  // The profit-or-loss test is deliberately NOT in this loop for the negative cases: 280-10-50-12(b)
  // takes each side "in absolute amount", so a negative value on either side still yields a positive
  // denominator. That is the clause's own reading, not a leniency, and is asserted separately below.
  const singleDenAxes = TEST_AXES.filter((a) => a.id !== 'profit_or_loss');
  const degenerate = [0, -0, -1, -1e6];
  for (const d of degenerate) {
    for (const axis of singleDenAxes) {
      const t = testOf(compute(basePP({ [axis.denKey]: d })).output_payload, axis.id);
      checked++;
      if (t.threshold_met !== NA) violations++;
      if (t.ratio !== null) violations++;
      if (t.ratio_pct !== null) violations++;
      if (typeof t.note !== 'string' || t.note.length === 0) violations++;
    }
  }
  // Profit or loss: only BOTH sides zero is degenerate. A negative value on either side is taken in
  // absolute amount and yields a live, positive denominator.
  for (const d of [0, -0]) {
    const t = testOf(compute(basePP({
      combined_profit_of_profitable_segments: d, combined_loss_of_loss_segments: 0,
    })).output_payload, 'profit_or_loss');
    checked++;
    if (t.threshold_met !== NA) violations++;
    if (t.ratio !== null) violations++;
  }
  for (const d of [-1, -1e6]) {
    const t = testOf(compute(basePP({
      combined_profit_of_profitable_segments: d, combined_loss_of_loss_segments: 0,
      segment_profit_or_loss: 0,
    })).output_payload, 'profit_or_loss');
    checked++;
    if (t.threshold_met === NA) violations++;        // a negative side is NOT degenerate
    if (t.denominator !== Math.abs(d)) violations++; // it is taken in absolute amount
  }
  // Both profit-or-loss sides zero: no denominator exists on either side.
  const both = compute(basePP({
    combined_profit_of_profitable_segments: 0, combined_loss_of_loss_segments: 0,
    segment_profit_or_loss: 999999,
  }));
  const t = testOf(both.output_payload, 'profit_or_loss');
  checked++;
  if (t.threshold_met !== NA) violations++;
  if (t.denominator_side_used !== null) violations++;
  if (!both.compliance_flags.includes('QUANTITATIVE_TEST_NOT_ASSESSABLE')) violations++;
  // Coverage denominator degenerate.
  for (const d of [0, -0, -100]) {
    const r = compute(basePP({ total_consolidated_revenue: d }));
    checked++;
    if (r.output_payload.coverage_75_pct.coverage_satisfied !== NA) violations++;
    if (r.output_payload.coverage_75_pct.additional_segments_required !== NA) violations++;
    if (r.output_payload.coverage_75_pct.coverage_ratio !== null) violations++;
    if (!r.compliance_flags.includes('COVERAGE_NOT_ASSESSABLE')) violations++;
    // A degenerate coverage denominator must NOT be reported as "below 75 percent".
    if (r.compliance_flags.includes('COVERAGE_BELOW_75_PCT_ADDITIONAL_SEGMENTS_REQUIRED')) violations++;
  }
  return { name: 'PB6_zero_and_nonpositive_denominator_guard', checked, violations };
}

// PB7: DISJUNCTION CORRECTNESS — 280-10-50-12 is met if ANY one test is met. A not_assessable
// test never counts as a pass and never blocks another test from carrying the verdict.
function checkPB7_disjunction() {
  const rng = mulberry32(633007);
  let checked = 0, violations = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = basePP({
      segment_revenue_external: randRange(rng, 0, 300),
      segment_revenue_intersegment: randRange(rng, 0, 100),
      combined_revenue_all_reported_segments: rng() < 0.15 ? 0 : randRange(rng, 1, 2000),
      segment_profit_or_loss: randRange(rng, -500, 500),
      combined_profit_of_profitable_segments: rng() < 0.15 ? 0 : randRange(rng, 0, 1000),
      combined_loss_of_loss_segments: rng() < 0.15 ? 0 : -randRange(rng, 0, 1000),
      segment_assets: randRange(rng, 0, 2000),
      combined_assets_all_segments: rng() < 0.15 ? 0 : randRange(rng, 1, 10000),
    });
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    const met = output_payload.tests.filter((t) => t.threshold_met === true).map((t) => t.test);
    const na = output_payload.tests.filter((t) => t.threshold_met === NA).map((t) => t.test);
    if (output_payload.is_reportable_by_quantitative_threshold !== (met.length > 0)) violations++;
    if (JSON.stringify(output_payload.tests_met) !== JSON.stringify(met)) violations++;
    if (JSON.stringify(output_payload.tests_not_assessable) !== JSON.stringify(na)) violations++;
    // not_assessable is never counted as a pass
    if (met.some((m) => na.includes(m))) violations++;
    const flagged = compliance_flags.includes('SEGMENT_REPORTABLE_BY_QUANTITATIVE_THRESHOLD');
    if (flagged !== (met.length > 0)) violations++;
    if ((na.length > 0) !== compliance_flags.includes('QUANTITATIVE_TEST_NOT_ASSESSABLE')) violations++;
  }
  return { name: 'PB7_disjunction_any_one_test_not_assessable_never_passes', checked, violations };
}

// PB8: AGGREGATION CRITERIA ARE ECHOED, NEVER COMPUTED — exhaustive over {true,false,null}^5
// (243 combinations, a genuinely bounded sub-domain inside an otherwise unbounded input space).
// management_judgment_required is true exactly when at least one criterion is unanswered, and a
// null is never read as false.
function checkPB8_aggregationEchoedExhaustive() {
  const keys = [
    'aggregation_similar_products_services',
    'aggregation_similar_production_processes',
    'aggregation_similar_customer_type',
    'aggregation_similar_distribution_methods',
    'aggregation_similar_regulatory_environment',
  ];
  const domain = [true, false, null];
  let checked = 0, violations = 0;
  for (let i = 0; i < 243; i++) {
    const combo = {};
    let n = i;
    for (const k of keys) { combo[k] = domain[n % 3]; n = Math.floor(n / 3); }
    const { output_payload } = compute(basePP(combo));
    checked++;
    for (const k of keys) {
      if (output_payload.aggregation_criteria[k] !== combo[k]) violations++;
    }
    const nulls = keys.filter((k) => combo[k] === null).length;
    const trues = keys.filter((k) => combo[k] === true).length;
    const answered = keys.length - nulls;
    if (output_payload.management_judgment_required !== (nulls > 0)) violations++;
    if (output_payload.unanswered_aggregation_criteria.length !== nulls) violations++;
    if (output_payload.aggregation_criteria_answered_count !== answered) violations++;
    if (output_payload.aggregation_criteria_met_count !== trues) violations++;
    if (output_payload.majority_of_criteria_met !== (trues * 2 > keys.length)) violations++;
  }
  return { name: 'PB8_aggregation_criteria_echoed_exhaustive_243', checked, violations };
}

// PB9: DETERMINISM — recomputing the same policy_parameters yields a byte-identical payload.
function checkPB9_determinism() {
  const rng = mulberry32(633009);
  let checked = 0, violations = 0;
  for (let i = 0; i < 500; i++) {
    const pp = basePP({
      segment_revenue_external: randRange(rng, -1e4, 1e6),
      segment_profit_or_loss: randRange(rng, -1e6, 1e6),
      combined_profit_of_profitable_segments: randRange(rng, 0, 1e6),
      combined_loss_of_loss_segments: -randRange(rng, 0, 1e6),
      segment_assets: randRange(rng, 0, 1e6),
      combined_assets_all_segments: randRange(rng, 1, 1e7),
      reportable_external_revenue: randRange(rng, 0, 1e6),
      total_consolidated_revenue: randRange(rng, 1, 1e6),
    });
    checked++;
    if (JSON.stringify(compute(pp)) !== JSON.stringify(compute(pp))) violations++;
  }
  return { name: 'PB9_determinism_on_recompute', checked, violations };
}

// PB10: OUTPUT SHAPE — no NaN, undefined or non-finite anywhere, across negative, zero, extreme
// and non-numeric inputs. Non-numeric and missing fields must coerce to a declared default
// rather than propagating NaN into a verdict.
function checkPB10_outputShape() {
  const rng = mulberry32(633010);
  let checked = 0, violations = 0;
  for (let i = 0; i < 1500; i++) {
    const wild = () => {
      const r = rng();
      if (r < 0.05) return 0;
      if (r < 0.10) return -0;
      if (r < 0.15) return Number.MIN_VALUE;
      if (r < 0.20) return Number.MAX_SAFE_INTEGER;
      if (r < 0.25) return -randRange(rng, 0, 1e9);
      return randRange(rng, -1e6, 1e9);
    };
    const pp = basePP({
      segment_revenue_external: wild(), segment_revenue_intersegment: wild(),
      combined_revenue_all_reported_segments: wild(),
      segment_profit_or_loss: wild(),
      combined_profit_of_profitable_segments: wild(), combined_loss_of_loss_segments: wild(),
      segment_assets: wild(), combined_assets_all_segments: wild(),
      reportable_external_revenue: wild(), total_consolidated_revenue: wild(),
      reportable_segment_count: rng() < 0.2 ? null : Math.floor(randRange(rng, 0, 40)),
    });
    checked++;
    const r = compute(pp);
    if (findShapeViolations(r.output_payload).length) violations++;
  }
  // Hostile / absent inputs: nothing may reach a verdict as NaN.
  const hostile = [
    {}, null, undefined,
    basePP({ segment_revenue_external: 'not-a-number', combined_revenue_all_reported_segments: NaN }),
    basePP({ combined_assets_all_segments: Infinity, segment_assets: -Infinity }),
    basePP({ segment_profit_or_loss: undefined, combined_profit_of_profitable_segments: null }),
    basePP({ reportable_segment_count: 'twelve' }),
  ];
  for (const pp of hostile) {
    checked++;
    let r;
    try { r = compute(pp); } catch { violations++; continue; }
    if (findShapeViolations(r.output_payload).length) violations++;
    for (const t of r.output_payload.tests) {
      if (!(t.threshold_met === true || t.threshold_met === false || t.threshold_met === NA)) violations++;
    }
  }
  return { name: 'PB10_output_shape_no_nan_undefined_hostile_inputs', checked, violations };
}

// ---------- run ----------
const oracle = runFixtureOracle(KERNEL_ID, compute);
const properties = [
  checkPB1_monotoneInNumerator(),
  checkPB2_monotoneInDenominator(),
  checkPB3_absoluteValueSymmetry(),
  checkPB4_tenPercentBoundary(),
  checkPB5_seventyFivePercentBoundary(),
  checkPB6_zeroDenominatorGuard(),
  checkPB7_disjunction(),
  checkPB8_aggregationEchoedExhaustive(),
  checkPB9_determinism(),
  checkPB10_outputShape(),
];
console.log(`[${KERNEL_ID}] class-B property test (ASC 280-10-50-12 / 50-14 threshold classifier, oracle: declared -- clause silent)`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
