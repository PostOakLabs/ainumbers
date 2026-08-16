import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-633-asc280-reportable-segment-tester';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'test_asc280_reportable_segment',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ASC 280-10-50-12 (quantitative thresholds) and 280-10-50-14 (75 percent coverage),
// with 280-10-50-11 aggregation criteria echoed back as management judgments.
//
// SOURCE OF THE RULE, and why it is not the obvious one (research/DISE-SEG-K-1.spec.md
// section 1.3):  ASU 2023-07 (Segment Reporting, Topic 280, November 2023) is this
// pack's Update, and it does NOT amend the paragraphs tested here. Its own amendment
// instruction lists 280-10-50-17, 50-20 through 50-22, 50-24, 50-28 through 50-30 and
// 50-32 through 50-36, plus added 50-26A through 50-26C and 50-28A through 50-28C, all
// linked to transition paragraph 280-10-65-1. Paragraphs 50-11 through 50-14 are absent
// from that list, and the Update's own summary states it does not change how an entity
// identifies operating segments, aggregates them, or applies the quantitative thresholds.
// The source text for 50-11/50-12/50-13/50-14 is FASB Statement No. 131 paragraphs
// 17/18/19/20, carried into the Codification. Both documents were retrieved from
// storage.fasb.org on 2026-08-15 and their digests are pinned in the spec file.
//
// THE THREE 10 PERCENT TESTS DO NOT SHARE A DENOMINATOR (50-12 / FAS 131 para 18):
//   (a) revenue:  segment revenue INCLUDING intersegment, over combined revenue,
//                 internal and external, of all REPORTED operating segments.
//   (b) profit or loss:  ABSOLUTE amount of segment profit or loss, over THE GREATER,
//                 IN ABSOLUTE AMOUNT, of (1) combined reported profit of all operating
//                 segments that did NOT report a loss and (2) combined reported loss of
//                 all operating segments that DID report a loss. This is a maximum of
//                 two absolute subtotals, NOT a netted combined total -- netting gives a
//                 smaller denominator and over-flags segments.
//   (c) assets:  segment assets over combined assets of ALL operating segments.
// A segment is reportable if it meets ANY one of the three (a disjunction).
//
// 75 PERCENT COVERAGE (50-14 / FAS 131 para 20): if total EXTERNAL revenue reported by
// reportable segments is LESS THAN 75 percent of total consolidated revenue, more
// segments are added until AT LEAST 75 percent is covered. Exactly 75.000 percent is
// satisfied. The numerator is external revenue only -- intersegment revenue counts in
// test (a) but never toward coverage, which is why the two are separate inputs.
//
// ROUNDING: the retrieved clause specifies NONE. Comparisons are made by exact cross
// multiplication on unrounded inputs, never by rounding a percentage and comparing it,
// so a value exactly on the boundary is not pushed under by the binary representation of
// 0.10 or 0.75. Reported percentages are rounded for display only, strictly afterwards,
// and never feed a decision. oracle: "declared -- clause silent".
//
// Verify-only: classifies ONE caller-declared candidate segment against caller-declared
// totals. It does not identify operating segments, does not aggregate them, does not
// decide the chief-operating-decision-maker question, and never asserts that an entity's
// segment note is compliant.

const NOT_ASSESSABLE = 'not_assessable';

// Display precision only (6 decimal places). Applied strictly AFTER every comparison; never an
// input to one. The scale is a literal rather than an exponentiation call: the exponent is a
// compile-time constant, so the call bought nothing, and leaving it out keeps this kernel
// genuinely free of transcendentals. That matters twice over -- the determinism lint bans
// unallowlisted transcendentals, and GPU-CYCLE-PREFLIGHT-1's static pre-screen treats them as a
// SLOW indicator, so a decorative call would have misrepresented this kernel's proving cost.
const REPORT_SCALE = 1000000;

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }

function toBoolOrNull(v) {
  if (v === true) return true;
  if (v === false) return false;
  return null;
}

// Round to 6 decimal places, half away from zero. Display only.
function roundReport(v) {
  if (!Number.isFinite(v)) return null;
  const scaled = v * REPORT_SCALE;
  if (!Number.isFinite(scaled)) return null;
  const sign = scaled < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(scaled))) / REPORT_SCALE;
}

// Threshold compare by EXACT CROSS MULTIPLICATION against a rational threshold p/q.
// ratio = num/den >= p/q  <=>  num*q >= den*p   (valid because den > 0 is checked first).
// 10 percent is 1/10 and 75 percent is 3/4, so q and p are small exact integers and an
// exact-boundary input compares as MEETING the threshold. Computing num/den, rounding,
// and comparing to 0.10 or 0.75 would not be reliable at the boundary.
function meetsThreshold(num, den, p, q) {
  const left = num * q;
  const right = den * p;
  // Currency magnitudes never reach the overflow boundary in practice, but if either side of the
  // cross product does overflow to a non-finite value the comparison is no longer meaningful, so
  // fall back to the ordinary ratio comparison rather than returning a confidently wrong verdict.
  if (!Number.isFinite(left) || !Number.isFinite(right)) return (num / den) >= (p / q);
  return left >= right;
}

// One 10 percent test. Returns a fully-formed result object; never divides by a
// non-positive denominator, and never reports "below threshold" when the denominator
// does not exist (DISE-SEG-T-3's locked not_assessable position, reused).
function runTest(id, numerator, denominator, denominatorBasis) {
  const num = safeNum(numerator, 0);
  const den = safeNum(denominator, 0);
  if (!(den > 0)) {
    return {
      test: id,
      numerator: num,
      denominator: den,
      ratio: null,
      ratio_pct: null,
      threshold_met: NOT_ASSESSABLE,
      denominator_basis: denominatorBasis,
      note: 'Denominator is zero or non-positive, so no ratio exists. Reported as not_assessable rather than as failing the threshold -- a segment cannot be shown to be below a threshold that does not exist.',
    };
  }
  // A denominator small enough relative to the numerator makes the ratio itself overflow to a
  // non-finite value. The VERDICT is still exact in that case because cross multiplication does
  // not overflow there, so the threshold decision is kept and only the reported ratio is withheld.
  // Emitting Infinity into the payload would be the dishonest option.
  const ratio = num / den;
  const ratioFinite = Number.isFinite(ratio);
  return {
    test: id,
    numerator: num,
    denominator: den,
    ratio: ratioFinite ? ratio : null,
    ratio_pct: ratioFinite ? roundReport(ratio * 100) : null,
    threshold_met: meetsThreshold(num, den, 1, 10),
    denominator_basis: denominatorBasis,
    note: ratioFinite ? null : 'The denominator is too small relative to the numerator for the ratio to be representable as a finite number, so no ratio is reported. The threshold verdict itself is unaffected and exact: it is decided by cross multiplication, which does not overflow at these magnitudes.',
  };
}

const AGGREGATION_KEYS = [
  ['aggregation_similar_products_services', 'nature of the products and services (280-10-50-11(a))'],
  ['aggregation_similar_production_processes', 'nature of the production processes (280-10-50-11(b))'],
  ['aggregation_similar_customer_type', 'type or class of customer (280-10-50-11(c))'],
  ['aggregation_similar_distribution_methods', 'methods used to distribute products or provide services (280-10-50-11(d))'],
  ['aggregation_similar_regulatory_environment', 'nature of the regulatory environment, if applicable (280-10-50-11(e))'],
];

export function compute(pp) {
  pp = pp || {};

  // ---- ASC 280-10-50-12(a): revenue test -------------------------------------------
  // Numerator counts BOTH external customer revenue AND intersegment sales/transfers.
  const revExternal = safeNum(pp.segment_revenue_external, 0);
  const revIntersegment = safeNum(pp.segment_revenue_intersegment, 0);
  const segmentRevenue = revExternal + revIntersegment;
  const revenueTest = runTest(
    'revenue',
    segmentRevenue,
    pp.combined_revenue_all_reported_segments,
    'Combined revenue, internal and external, of all reported operating segments (280-10-50-12(a)).',
  );

  // ---- ASC 280-10-50-12(b): profit or loss test ------------------------------------
  // Numerator is the ABSOLUTE amount of the segment's signed profit or loss, so a loss
  // of -X and a profit of +X classify identically. Denominator is the GREATER, IN
  // ABSOLUTE AMOUNT, of the profitable side and the loss side -- a maximum of two
  // absolute subtotals, never the two netted against each other.
  const segmentPL = safeNum(pp.segment_profit_or_loss, 0);
  const combinedProfit = safeNum(pp.combined_profit_of_profitable_segments, 0);
  const combinedLoss = safeNum(pp.combined_loss_of_loss_segments, 0);
  const absProfitSide = Math.abs(combinedProfit);
  const absLossSide = Math.abs(combinedLoss);
  const plDenominator = Math.max(absProfitSide, absLossSide);
  const profitLossTest = runTest(
    'profit_or_loss',
    Math.abs(segmentPL),
    plDenominator,
    'The greater, in absolute amount, of the combined reported profit of all operating segments that did not report a loss and the combined reported loss of all operating segments that did report a loss (280-10-50-12(b)).',
  );
  profitLossTest.segment_profit_or_loss_signed = segmentPL;
  profitLossTest.abs_profit_side = absProfitSide;
  profitLossTest.abs_loss_side = absLossSide;
  profitLossTest.denominator_side_used =
    plDenominator === 0 ? null : (absProfitSide >= absLossSide ? 'profit_side' : 'loss_side');

  // ---- ASC 280-10-50-12(c): assets test --------------------------------------------
  const assetsTest = runTest(
    'assets',
    pp.segment_assets,
    pp.combined_assets_all_segments,
    'Combined assets of all operating segments (280-10-50-12(c)).',
  );

  const tests = [revenueTest, profitLossTest, assetsTest];

  // Disjunction: reportable if ANY test is met. A not_assessable test never counts as a
  // pass and never blocks another test from passing.
  const testsMet = tests.filter((t) => t.threshold_met === true).map((t) => t.test);
  const testsNotAssessable = tests.filter((t) => t.threshold_met === NOT_ASSESSABLE).map((t) => t.test);
  const isReportable = testsMet.length > 0;

  // ---- ASC 280-10-50-14: 75 percent coverage ---------------------------------------
  // External revenue only. Trigger is coverage < 75 percent; the satisfied state, and
  // the stop condition for adding segments, is coverage >= 75 percent.
  const reportableExternal = safeNum(pp.reportable_external_revenue, 0);
  const consolidatedRevenue = safeNum(pp.total_consolidated_revenue, 0);
  let coverage;
  if (!(consolidatedRevenue > 0)) {
    coverage = {
      reportable_external_revenue: reportableExternal,
      total_consolidated_revenue: consolidatedRevenue,
      coverage_ratio: null,
      coverage_pct: null,
      coverage_satisfied: NOT_ASSESSABLE,
      additional_segments_required: NOT_ASSESSABLE,
      note: 'Total consolidated revenue is zero or non-positive, so no coverage ratio exists. Reported as not_assessable rather than as failing the 75 percent test.',
    };
  } else {
    const ratio = reportableExternal / consolidatedRevenue;
    const ratioFinite = Number.isFinite(ratio);
    const satisfied = meetsThreshold(reportableExternal, consolidatedRevenue, 3, 4);
    coverage = {
      reportable_external_revenue: reportableExternal,
      total_consolidated_revenue: consolidatedRevenue,
      coverage_ratio: ratioFinite ? ratio : null,
      coverage_pct: ratioFinite ? roundReport(ratio * 100) : null,
      coverage_satisfied: satisfied,
      additional_segments_required: !satisfied,
      note: ratioFinite ? null : 'Total consolidated revenue is too small relative to the reportable external revenue for the coverage ratio to be representable as a finite number, so no ratio is reported. The coverage verdict itself is unaffected and exact, being decided by cross multiplication.',
    };
  }

  // ---- ASC 280-10-50-11: aggregation criteria, echoed only --------------------------
  // Never computed, never inferred, never guessed. Null means unanswered, which is not
  // the same as false.
  const aggregation_criteria = {};
  const unanswered = [];
  let metCount = 0;
  let answeredCount = 0;
  for (const [key, label] of AGGREGATION_KEYS) {
    const v = toBoolOrNull(pp[key]);
    aggregation_criteria[key] = v;
    if (v === null) unanswered.push(label);
    else {
      answeredCount++;
      if (v === true) metCount++;
    }
  }
  const managementJudgmentRequired = unanswered.length > 0;

  // ---- FAS 131 para 24 practical-limit advisory ------------------------------------
  const rawCount = pp.reportable_segment_count;
  const segCount = (rawCount === undefined || rawCount === null) ? null : safeNum(rawCount, null);
  const practicalLimitAdvisory = segCount !== null && segCount > 10;

  const compliance_flags = [];
  if (isReportable) compliance_flags.push('SEGMENT_REPORTABLE_BY_QUANTITATIVE_THRESHOLD');
  if (testsNotAssessable.length) compliance_flags.push('QUANTITATIVE_TEST_NOT_ASSESSABLE');
  if (coverage.coverage_satisfied === false) compliance_flags.push('COVERAGE_BELOW_75_PCT_ADDITIONAL_SEGMENTS_REQUIRED');
  if (coverage.coverage_satisfied === NOT_ASSESSABLE) compliance_flags.push('COVERAGE_NOT_ASSESSABLE');
  if (managementJudgmentRequired) compliance_flags.push('AGGREGATION_MANAGEMENT_JUDGMENT_REQUIRED');
  if (practicalLimitAdvisory) compliance_flags.push('PRACTICAL_LIMIT_CONSIDERATION_ADVISORY');

  const output_payload = {
    is_reportable_by_quantitative_threshold: isReportable,
    tests_met: testsMet,
    tests_not_assessable: testsNotAssessable,
    tests,
    coverage_75_pct: coverage,
    aggregation_criteria,
    unanswered_aggregation_criteria: unanswered,
    management_judgment_required: managementJudgmentRequired,
    aggregation_criteria_answered_count: answeredCount,
    aggregation_criteria_met_count: metCount,
    majority_of_criteria_met: metCount * 2 > AGGREGATION_KEYS.length,
    reportable_segment_count: segCount,
    practical_limit_consideration_advised: practicalLimitAdvisory,
    threshold_pct: 10,
    coverage_threshold_pct: 75,
    comparison_basis: 'inclusive: 10 percent or more meets the threshold, and at least 75 percent satisfies coverage. Compared by exact cross multiplication on unrounded inputs; reported percentages are rounded to 6 decimal places for display only, strictly after every comparison.',
    rounding_steps: 'none before comparison. Display rounding to 6 decimal places is applied only to reported percentages and never feeds a decision.',
    oracle: 'declared -- clause silent',
    regulatory_basis: 'ASC 280-10-50-12 (quantitative thresholds), 280-10-50-14 (75 percent coverage) and 280-10-50-11 (aggregation criteria), source text FASB Statement No. 131 paragraphs 18, 20 and 17. ASU 2023-07 (November 2023) does not amend these paragraphs: its amendment instruction covers 280-10-50-17, 50-20 through 50-22, 50-24, 50-28 through 50-30 and 50-32 through 50-36, plus added 50-26A through 50-26C and 50-28A through 50-28C, linked to transition paragraph 280-10-65-1.',
    note: 'Verify-only classifier for ONE caller-declared candidate segment against caller-declared totals. It does not identify operating segments, does not aggregate them, does not decide the chief-operating-decision-maker question, and does not assert that an entity segment note is compliant. The three 10 percent tests each carry their own denominator and are reported separately; the profit-or-loss denominator is the greater in absolute amount of the profitable side and the loss side, never the two netted together. Aggregation criteria are echoed back exactly as supplied and are never computed by this node; an unanswered criterion raises management_judgment_required rather than being read as false. A zero or non-positive denominator reports not_assessable, never a failing threshold. Authoritative form of these rules is the FASB Codification, which was not directly reachable at build time; the basis chain is stated in research/DISE-SEG-K-1.spec.md.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
