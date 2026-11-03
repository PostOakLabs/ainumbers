import { executionHash } from './_hash.mjs';

const TOOL_ID = '732-borrower-escrow-auditor';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'audit_borrower_escrow_stmt',
  mandate_type: 'consumer_finance', gpu: false,
};

// Borrower escrow statement audit -- recompute a servicer's escrow accounting
// statement from BORROWER-SUPPLIED VALUES ONLY and flag discrepancies.
//
// METHOD (aggregate escrow accounting, per the aggregate analysis arithmetic the
// node metadata's regulatory_basis cites -- re-implemented locally, no kernel
// imports):
//   1. Recompute the monthly trial running balance from the stated opening
//      balance, the stated monthly escrow deposits, and the stated monthly
//      disbursements (method steps A-B).
//   2. Compare the servicer's STATED end-of-month balances against the
//      recomputed balances, one statement line at a time; any line whose stated
//      balance disagrees beyond a 0.01 rounding tolerance is flagged as a
//      discrepancy with a per-line reason.
//   3. Cushion check (method step C / cushion cap): the servicer's stated
//      cushion must be no greater than one-sixth of the estimated total annual
//      disbursements. A larger stated cushion is flagged.
//   4. Classify the recomputed account (balanced / shortage / surplus /
//      deficiency) against the target low point (stated cushion, or the
//      one-sixth cap when none is supplied), and emit the remedy thresholds
//      the metadata's remedy basis cites: the $50 mandatory-refund floor for a
//      surplus, and, for a shortage, the set of courses the rule
//      PERMITS (every course is a "may"; the kernel never emits a required
//      spread). The shortage threshold base is the borrower's monthly escrow
//      account payment: pp.monthly_escrow_payment when supplied, else the mean
//      of pp.monthly_payments, else unavailable (then only the courses
//      permitted on both sides of the threshold are emitted).
//   5. Emit evidence fields (stable scalars, no free-text PII carriers)
//      suitable for anchored-receipt shaping downstream.
//
// VALUES-ONLY REFUSALS (closed, each with a reachable path + fixture):
//   - Any string value in a declared field is refused: a value-only statement
//     carries numbers; a string where a number belongs is identifier-like or
//     free text by construction (names, account numbers, servicer references)
//     and is never echoed. The declared fields are checked before any numeric
//     coercion.
//   - More than 12 monthly periods is refused: the kernel is bounded to one
//     computation year.
//   - A surplus at or above the refund floor whose currency status the caller
//     did not supply is held for manual review: the refund obligation is
//     conditioned on the borrower being current, a fact the statement values
//     alone cannot establish.
//
// Domain exclusions (declared, not computed): no tax-sale scenarios, no
// escrowed-MSA states, values only -- see the node shard description.
//
// Pure ECMA-262 arithmetic only -- no Math.pow, no Date.now/new Date(), no
// Math.random. All dollar figures rounded to 2 decimal places (r2). Non-finite
// or absent numeric inputs default to 0, never NaN/Infinity.

const CUSHION_FRACTION_MAX = 1 / 6; // cushion cap: 1/6 of estimated total annual disbursements
const SURPLUS_REFUND_THRESHOLD = 50; // mandatory-refund floor for a disclosed surplus
const SHORTAGE_SPREAD_MIN_MONTHS = 12; // minimum period if the servicer elects equal monthly repayment
const SHORTAGE_COURSES = ['do_nothing', 'repay_within_30_days', 'repay_equal_monthly_12_plus_months'];
const MAX_PERIODS = 12; // bounded: one computation year
const LINE_TOLERANCE = 0.01; // statement-line rounding tolerance

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

function normalizeMonths(arr, max) {
  const out = [];
  if (Array.isArray(arr)) {
    for (let i = 0; i < Math.min(arr.length, max); i++) out.push(safeNum(arr[i], 0));
  }
  return out;
}

// Values-only guard: locate the first string member of a declared values
// array. A string where a number belongs is identifier-like by construction.
function firstStringIndex(arr) {
  for (let i = 0; i < arr.length; i++) {
    if (typeof arr[i] === 'string') return i;
  }
  return -1;
}

export function compute(pp) {
  pp = pp || {};

  const compliance_flags = [];

  // -- Refusal 1: a string value in a declared field (checked before coercion).
  const rawPay = Array.isArray(pp.monthly_payments) ? pp.monthly_payments : [];
  const rawDis = Array.isArray(pp.disbursements) ? pp.disbursements : [];
  const rawBal = Array.isArray(pp.stated_balances) ? pp.stated_balances : [];
  let refusedField = null;
  if (typeof pp.starting_balance === 'string') refusedField = 'starting_balance';
  else if (typeof pp.stated_cushion === 'string') refusedField = 'stated_cushion';
  else {
    const payHit = firstStringIndex(rawPay);
    const disHit = firstStringIndex(rawDis);
    const balHit = firstStringIndex(rawBal);
    if (payHit !== -1) refusedField = 'monthly_payments[' + payHit + ']';
    else if (disHit !== -1) refusedField = 'disbursements[' + disHit + ']';
    else if (balHit !== -1) refusedField = 'stated_balances[' + balHit + ']';
  }
  if (refusedField !== null) {
    compliance_flags.push('IDENTIFIER_LIKE_FIELD_REFUSED');
    return {
      output_payload: {
        verdict: 'refused',
        refused_because: 'identifier_or_free_text_value_in_declared_field',
        refused_field: refusedField,
        periods_analyzed: 0,
        discrepancies: { count: 0, lines: [] },
        evidence: { record_type: 'escrow_statement_audit', tool_id: TOOL_ID, tool_version: TOOL_VERSION, refused: true },
        manual_review_required: true,
      },
      compliance_flags,
    };
  }

  // -- Refusal 2: more than the bounded 12 monthly periods.
  const payLen = rawPay.length;
  const disLen = rawDis.length;
  const balLen = rawBal.length;
  const maxLen = Math.max(payLen, disLen, balLen);
  if (maxLen > MAX_PERIODS) {
    compliance_flags.push('PERIODS_EXCEED_BOUNDED_12_REFUSED');
    return {
      output_payload: {
        verdict: 'refused',
        refused_because: 'periods_exceed_bounded_12',
        periods_supplied: maxLen,
        max_periods: MAX_PERIODS,
        discrepancies: { count: 0, lines: [] },
        evidence: { record_type: 'escrow_statement_audit', tool_id: TOOL_ID, tool_version: TOOL_VERSION, refused: true },
        manual_review_required: true,
      },
      compliance_flags,
    };
  }

  const startingBalance = safeNum(pp.starting_balance, 0);
  const monthlyPayments = normalizeMonths(pp.monthly_payments, MAX_PERIODS);
  const disbursements = normalizeMonths(pp.disbursements, MAX_PERIODS);
  const statedBalances = normalizeMonths(pp.stated_balances, MAX_PERIODS);
  const hasStatedCushion = Number.isFinite(Number(pp.stated_cushion)) && pp.stated_cushion !== null && pp.stated_cushion !== '';
  const statedCushion = hasStatedCushion ? safeNum(pp.stated_cushion, 0) : null;
  const borrowerCurrent = typeof pp.borrower_current === 'boolean' ? pp.borrower_current : null;

  const periods = maxLen;

  // -- 1. Recomputed trial running balance (month 0 = opening, months 1..periods).
  const recomputedBalances = [r2(startingBalance)];
  for (let m = 1; m <= periods; m++) {
    const payment = m <= monthlyPayments.length ? monthlyPayments[m - 1] : 0;
    const disb = m <= disbursements.length ? disbursements[m - 1] : 0;
    recomputedBalances.push(r2(recomputedBalances[m - 1] + payment - disb));
  }

  // -- 2. Per-line discrepancy flags.
  const discrepancyLines = [];
  for (let m = 1; m <= periods; m++) {
    const stated = m <= statedBalances.length ? statedBalances[m - 1] : null;
    if (stated === null) continue;
    const recomputed = recomputedBalances[m];
    const variance = r2(stated - recomputed);
    if (Math.abs(variance) > LINE_TOLERANCE) {
      discrepancyLines.push({
        month: m,
        stated_balance: stated,
        recomputed_balance: recomputed,
        variance,
        reason: 'stated_end_of_month_balance_disagrees_with_recomputed_trial_running_balance',
      });
    }
  }
  if (discrepancyLines.length > 0) compliance_flags.push('STATEMENT_LINE_DISCREPANCY');

  // -- 3. Cushion cap check.
  const totalAnnualDisbursements = r2(disbursements.reduce((a, b) => a + b, 0));
  const cushionCap = r2(CUSHION_FRACTION_MAX * totalAnnualDisbursements);
  let cushionWithinCap = null;
  if (hasStatedCushion) {
    cushionWithinCap = statedCushion <= cushionCap + 1e-9;
    if (!cushionWithinCap) compliance_flags.push('CUSHION_ABOVE_STATUTORY_CAP');
  }

  // -- 4. Classification against the target low point.
  const targetLowPoint = hasStatedCushion
    ? r2(Math.min(statedCushion, cushionCap))
    : cushionCap;
  let lowPoint = periods >= 1 ? recomputedBalances[1] : r2(startingBalance);
  let lowPointMonth = 1;
  for (let m = 2; m <= periods; m++) {
    if (recomputedBalances[m] < lowPoint) { lowPoint = recomputedBalances[m]; lowPointMonth = m; }
  }
  lowPoint = r2(lowPoint);

  const isDeficiency = periods >= 1 && lowPoint < -1e-9;
  const spreadVsTarget = r2(lowPoint - targetLowPoint);
  const isShortage = !isDeficiency && periods >= 1 && spreadVsTarget < -1e-9;
  const isSurplus = !isDeficiency && !isShortage && periods >= 1 && spreadVsTarget > 1e-9;
  const isBalanced = !isDeficiency && !isShortage && !isSurplus;

  let shortageAmount = 0, surplusAmount = 0;
  let surplusRefundRequired = false;
  let surplusRefundUnverified = false;
  let shortagePermittedCourses = [];
  let shortageAtOrAboveOneMonth = null;
  let servicerCoursePermitted = null;

  // Threshold base: the borrower's monthly escrow account payment (not
  // total annual disbursements / 12). Supplied value wins; else the mean of
  // the supplied monthly payments; else unavailable.
  const suppliedMonthly = Number(pp.monthly_escrow_payment);
  let shortageThresholdBase = 0, shortageThresholdBaseSource = 'unavailable';
  if (pp.monthly_escrow_payment !== null && pp.monthly_escrow_payment !== '' && typeof pp.monthly_escrow_payment !== 'boolean' && Number.isFinite(suppliedMonthly) && suppliedMonthly > 0) {
    shortageThresholdBase = r2(suppliedMonthly);
    shortageThresholdBaseSource = 'monthly_escrow_payment';
  } else if (monthlyPayments.length > 0) {
    const mean = r2(monthlyPayments.reduce((a, b) => a + b, 0) / monthlyPayments.length);
    if (mean > 0) { shortageThresholdBase = mean; shortageThresholdBaseSource = 'mean_of_monthly_payments'; }
  }

  if (isDeficiency) {
    shortageAmount = r2(-lowPoint);
    compliance_flags.push('ESCROW_DEFICIENCY');
  } else if (isShortage) {
    shortageAmount = r2(-spreadVsTarget);
    compliance_flags.push('ESCROW_SHORTAGE');
    compliance_flags.push('ESCROW_SHORTAGE_COURSES_PERMITTED');
    if (shortageThresholdBaseSource === 'unavailable') {
      // Threshold unknown: emit only the courses permitted on both sides.
      shortagePermittedCourses = ['do_nothing', 'repay_equal_monthly_12_plus_months'];
      compliance_flags.push('ESCROW_SHORTAGE_THRESHOLD_BASE_UNAVAILABLE');
    } else if (shortageAmount >= shortageThresholdBase - 1e-9) {
      shortageAtOrAboveOneMonth = true;
      shortagePermittedCourses = ['do_nothing', 'repay_equal_monthly_12_plus_months'];
      compliance_flags.push('ESCROW_SHORTAGE_AT_OR_ABOVE_ONE_MONTH_PAYMENT');
    } else {
      shortageAtOrAboveOneMonth = false;
      shortagePermittedCourses = SHORTAGE_COURSES.slice();
      compliance_flags.push('ESCROW_SHORTAGE_BELOW_ONE_MONTH_PAYMENT');
    }
    if (typeof pp.servicer_chosen_course === 'string' && SHORTAGE_COURSES.indexOf(pp.servicer_chosen_course) !== -1) {
      servicerCoursePermitted = shortagePermittedCourses.indexOf(pp.servicer_chosen_course) !== -1;
      if (!servicerCoursePermitted) compliance_flags.push('SERVICER_SHORTAGE_COURSE_NOT_PERMITTED');
    }
  } else if (isSurplus) {
    surplusAmount = r2(spreadVsTarget);
    compliance_flags.push('ESCROW_SURPLUS');
    if (surplusAmount >= SURPLUS_REFUND_THRESHOLD - 1e-9) {
      if (borrowerCurrent === null) {
        // Refusal 3: the refund obligation is conditioned on currency, which the
        // statement values alone cannot establish -- hold for manual review.
        surplusRefundUnverified = true;
        compliance_flags.push('SURPLUS_REFUND_CURRENCY_UNVERIFIED');
      } else {
        surplusRefundRequired = borrowerCurrent;
        compliance_flags.push(borrowerCurrent ? 'ESCROW_SURPLUS_REFUND_REQUIRED' : 'ESCROW_SURPLUS_BORROWER_NOT_CURRENT');
      }
    } else {
      compliance_flags.push('ESCROW_SURPLUS_BELOW_REFUND_THRESHOLD');
    }
  } else {
    compliance_flags.push('ESCROW_AUDIT_BALANCED');
  }

  // -- 5. Evidence fields for anchored-receipt shaping.
  const evidence = {
    record_type: 'escrow_statement_audit',
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    method: 'aggregate_escrow_accounting_values_only',
    periods_analyzed: periods,
    line_items_recomputed: periods,
    discrepancy_count: discrepancyLines.length,
    account_status: isDeficiency ? 'deficiency' : isShortage ? 'shortage' : isSurplus ? 'surplus' : 'balanced',
    cushion_checked: hasStatedCushion,
    cushion_within_cap: cushionWithinCap,
    computed_from: 'borrower_supplied_values_only',
    pii_carried: false,
    total_annual_disbursements: totalAnnualDisbursements,
    recomputed_low_point: lowPoint,
    refusal_free: compliance_flags.every((f) => f.indexOf('REFUSED') === -1 && f.indexOf('UNVERIFIED') === -1),
  };

  const manualReviewRequired = discrepancyLines.length > 0 || surplusRefundUnverified;

  const output_payload = {
    verdict: isDeficiency || isShortage || isSurplus || isBalanced ? 'completed' : 'refused',
    periods_analyzed: periods,
    starting_balance: r2(startingBalance),
    recomputed_balances: recomputedBalances,
    recomputed_low_point: lowPoint,
    low_point_month: lowPointMonth,
    target_low_point: targetLowPoint,
    total_annual_disbursements: totalAnnualDisbursements,
    cushion_cap_amount: cushionCap,
    stated_cushion: hasStatedCushion ? r2(statedCushion) : null,
    cushion_within_cap: cushionWithinCap,
    account_status: evidence.account_status,
    shortage_amount: shortageAmount,
    surplus_amount: surplusAmount,
    shortage_threshold_base: shortageThresholdBase,
    shortage_threshold_base_source: shortageThresholdBaseSource,
    shortage_at_or_above_one_month_payment: shortageAtOrAboveOneMonth,
    shortage_permitted_courses: shortagePermittedCourses,
    servicer_course_permitted: servicerCoursePermitted,
    surplus_refund_required: surplusRefundRequired,
    surplus_refund_unverified: surplusRefundUnverified,
    shortage_repay_min_months_if_elected: SHORTAGE_SPREAD_MIN_MONTHS,
    discrepancies: { count: discrepancyLines.length, lines: discrepancyLines },
    evidence,
    manual_review_required: manualReviewRequired,
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
