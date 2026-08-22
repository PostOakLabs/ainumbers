import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-231-compute-mla-mapr';
const TOOL_VERSION = '2.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_mla_mapr',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Military Annual Percentage Rate for CLOSED-END consumer credit, solved by the
// actuarial method. Citations for every rule below live in node metadata
// (description, regulatory_basis, cited_clause_digest) and in the reported
// output strings, never in this source.
//
// WHAT THIS KERNEL DOES, in behaviour terms:
//   1. Sorts each caller-declared charge into "collected at consummation"
//      (money the borrower never receives, so it reduces the amount financed)
//      or "carried by the payment schedule" (already priced by the payments, so
//      deducting it as well would count it twice).
//   2. Builds a cash-flow schedule from a single advance plus either one
//      balloon payment or a level payment series.
//   3. Brackets and bisects the periodic rate that equates the present value of
//      the payments to the amount financed, then annualises by MULTIPLYING that
//      periodic rate by the number of unit-periods in a year.
//
// The rate is reported ONLY when a sign-change bracket was established and then
// narrowed to the width target. Where no such bracket exists the payload
// carries null and says so; it never echoes an input back as if it were a
// solved rate.
//
// Pure ECMA-262 arithmetic: no Math.pow, no Math.log, no Math.exp, no Date, no
// randomness, no host globals. Every exponent is an integer raised by squaring,
// because a fraction of a unit-period is priced at simple interest and only
// whole unit-periods compound.

// --- declared constants ------------------------------------------------------
// Neither is a caller policy parameter; a caller cannot move either one.

const MAPR_CAP_PCT = 36;

// House heuristic, declared as such: no authority states a 30 percent warning
// line. It is reported as a named threshold so a reader can see it is ours.
const APPROACHING_CAP_PCT = 30;

// Declared structural limit, not a rule of law. The present-value sum walks one
// term per scheduled payment, so without a stated ceiling the work inside
// compute() would be bounded by a caller-supplied number rather than by a
// constant. 600 payments covers 50 years monthly or 11 years weekly, and a
// schedule longer than that returns no rate and says why, rather than being
// silently truncated to a number that would misprice the loan.
const MAX_PAYMENT_COUNT = 600;

// --- numeric helpers ---------------------------------------------------------

// Number() runs the argument's own coercion path, which throws outright for an
// object with a null prototype or with valueOf and toString removed. A kernel
// that throws on a malformed input is not total, so coercion is limited to the
// primitive types that can carry a number; everything else takes the default.
function safeNum(v, def) {
  const t = typeof v;
  if (t !== 'number' && t !== 'string' && t !== 'boolean') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function nonNeg(v) { return Math.max(0, safeNum(v, 0)); }

// base^n for integer n >= 0, by exponentiation by squaring.
function powInt(base, n) {
  if (!Number.isFinite(base) || !Number.isFinite(n)) return 0;
  let e = Math.round(n);
  if (e < 0) e = 0;
  let r = 1, b = base;
  while (e > 0) {
    if (e % 2 === 1) r *= b;
    b *= b;
    e = Math.floor(e / 2);
  }
  return r;
}

// Half-up to `dp` decimals, sign-symmetric. Math.round alone rounds half toward
// +Infinity, which is not half-up for a negative magnitude, so the sign is
// split out and reapplied.
function roundHalfUp(v, dp) {
  if (!Number.isFinite(v)) return 0;
  const f = powInt(10, dp);
  const s = v < 0 ? -1 : 1;
  const r = s * Math.round(Math.abs(v) * f) / f;
  // Scaling by 10^dp can overflow to Infinity for a magnitude near the top of
  // the double range. Any such magnitude is already past 2^52 and holds no
  // fractional part, so returning it unchanged is both finite and exact.
  return Number.isFinite(r) ? r : v;
}

function r2(v) { return roundHalfUp(v, 2); }
function r6(v) { return roundHalfUp(v, 6); }

// --- cash-flow model ---------------------------------------------------------
//
// A flow is an amount placed at `full` whole unit-periods plus `frac` of a
// unit-period. The fraction is priced at simple interest and only the whole
// count compounds, so the discount denominator is (1 + frac*i) * (1+i)^full and
// no base is ever raised to a fractional power.

function pvFlow(flow, i) {
  const den = (1 + flow.frac * i) * powInt(1 + i, flow.full);
  if (!Number.isFinite(den) || den === 0) return NaN;
  return flow.amount / den;
}

function pvPayments(payments, i) {
  let s = 0;
  for (const p of payments) s += pvFlow(p, i);
  return s;
}

// G(i) = PV(payments) - amount financed. The actuarial rate is the root of G.
function residual(amountFinanced, payments, i) {
  return pvPayments(payments, i) - amountFinanced;
}

// --- solver ------------------------------------------------------------------

const BISECT_STEPS = 300;
// Counted bound on the bracket-growth loop. Doubling from 1e-9 reaches the HI_CAP
// ceiling in about 37 steps, so this bound is never the binding constraint on a real
// schedule; it is here so the loop terminates on a COUNT rather than only on the
// growth step behaving, which keeps the work per call bounded by a constant no matter
// what the arithmetic does.
const BRACKET_STEPS = 128;
// Bracket width expressed in ANNUAL percentage points, converted to periodic
// inside the solver. The tightest disclosure tolerance this figure answers to
// is an eighth of one percentage point; 1e-6 points is five orders finer, so
// the reported number is limited by the declared 2-decimal rounding and not by
// the solver.
const RATE_WIDTH_TARGET_PP = 1e-6;
const HI_CAP = 100;

const NO_RATE = { periodic_rate: 0, rate_pct: 0, iterations: 0, converged: false, bracketed: false };

function solveActuarialRate(amountFinanced, payments, unitPeriodsPerYear) {
  const w = unitPeriodsPerYear;
  if (!(w > 0)) return NO_RATE;
  if (!(amountFinanced > 0)) return NO_RATE;
  const widthTarget = RATE_WIDTH_TARGET_PP / (w * 100);

  // Without a non-zero payment carried at a positive time the equation has no
  // rate dependence and therefore no unique root.
  let rateDependent = false;
  for (const p of payments) {
    if (p.amount !== 0 && (p.full > 0 || p.frac > 0)) { rateDependent = true; break; }
  }
  if (!rateDependent) return NO_RATE;

  const g0 = residual(amountFinanced, payments, 0);
  if (!Number.isFinite(g0)) return NO_RATE;
  // Where the payments do not repay the amount financed the root is negative,
  // outside the domain this kernel reports on.
  if (g0 < 0) return NO_RATE;

  let lo = 0, hi = 1e-9, found = false;
  if (g0 === 0) { found = true; hi = 0; }
  for (let g = 0; g < BRACKET_STEPS && !found && hi <= HI_CAP; g++) {
    const ghi = residual(amountFinanced, payments, hi);
    if (!Number.isFinite(ghi)) break;
    if (ghi <= 0) { found = true; break; }
    lo = hi;
    hi *= 2;
  }
  if (!found) return NO_RATE;

  let iters = 0;
  while (iters < BISECT_STEPS && (hi - lo) > widthTarget) {
    const mid = lo + (hi - lo) / 2;
    if (mid <= lo || mid >= hi) break; // float resolution exhausted
    const gm = residual(amountFinanced, payments, mid);
    if (!Number.isFinite(gm)) break;
    if (gm >= 0) lo = mid; else hi = mid;
    iters++;
  }

  const converged = (hi - lo) <= widthTarget;
  if (!converged) {
    // Bracketed but not narrowed. Reporting the midpoint of a wide bracket as
    // if it had converged is exactly the failure this branch refuses.
    return { periodic_rate: 0, rate_pct: 0, iterations: iters, converged: false, bracketed: true };
  }
  const i = lo + (hi - lo) / 2;
  // Annualise by MULTIPLYING the unit-period rate by the unit-periods in a
  // year. Never by compounding the periodic rate.
  return { periodic_rate: r6(i), rate_pct: i * w * 100, iterations: iters, converged: true, bracketed: true };
}

// --- charge classification ---------------------------------------------------
//
// `treatment` says what the arithmetic does with the amount, which is a separate
// question from whether the rule includes it. A finance charge is included, but
// it is already expressed by the payment stream, so re-deducting it would price
// it twice.

const CIT_I = '32 CFR 232.4(c)(1)(i)';
const CIT_II = '32 CFR 232.4(c)(1)(ii)';
const CIT_IIIA = '32 CFR 232.4(c)(1)(iii)(A)';
const CIT_IIIB = '32 CFR 232.4(c)(1)(iii)(B)';
const CIT_IIIC = '32 CFR 232.4(c)(1)(iii)(C)';
const CIT_D1 = '32 CFR 232.4(d)(1)';

function chargeRow(field, amount, included, treatment, citation) {
  return { field, amount: r2(amount), included, treatment, citation };
}

export function compute(pp) {
  pp = pp || {};

  // --- scope discriminator --------------------------------------------------
  // This node computes the closed-end path only. An open-end plan, including
  // any credit card account, is priced on a billing-cycle balance by a
  // different clause and a different method, and is refused here rather than
  // answered with a closed-end number.
  const credit_class_raw = typeof pp.credit_class === 'string' ? pp.credit_class : '';
  const legacy_card_flag = pp.is_credit_card === true;
  const declared_out_of_scope = (credit_class_raw !== '' && credit_class_raw !== 'closed_end') || legacy_card_flag;
  const credit_class = credit_class_raw !== ''
    ? credit_class_raw
    : (legacy_card_flag ? 'open_end_credit_card' : 'closed_end');

  // --- amounts --------------------------------------------------------------
  const amount_advanced = nonNeg(pp.loan_amount);
  const finance_charge_total = nonNeg(pp.finance_charge_total);
  const credit_insurance_premium_total = nonNeg(pp.credit_insurance_premium_total);
  const debt_cancellation_fee_total = nonNeg(pp.debt_cancellation_fee_total);
  const debt_suspension_fee_total = nonNeg(pp.debt_suspension_fee_total);
  const ancillary_product_fee_total = nonNeg(pp.ancillary_product_fee_total);
  const application_fee = nonNeg(pp.application_fee);
  const participation_fee_annual = nonNeg(pp.participation_fee_annual);
  const bona_fide_fee_claimed_total = nonNeg(pp.bona_fide_fee_claimed_total);

  // --- the application-fee carve-out: three conjunctive predicates ----------
  // An application fee is includable by default. It drops out only when the
  // creditor is a Federal credit union or an insured depository institution,
  // AND the loan is a short-term small amount loan, AND the fee is charged not
  // more than once in any rolling 12-month period. All three, or the fee stays.
  const creditor_is_fcu_or_idi = pp.creditor_is_fcu_or_idi === true;
  const is_short_term_small_amount_loan = pp.is_short_term_small_amount_loan === true;
  const application_fee_once_in_rolling_12_months = pp.application_fee_once_in_rolling_12_months === true;
  const application_fee_carve_out_applied =
    creditor_is_fcu_or_idi && is_short_term_small_amount_loan && application_fee_once_in_rolling_12_months;

  // --- the bona fide fee exclusion is unavailable on this path --------------
  // That exclusion reaches a credit card account under an open-end plan only.
  // On closed-end credit there is no such exclusion, so a caller-declared bona
  // fide amount is recorded, INCLUDED anyway, and the reason is flagged.
  const bona_fide_exclusion_available = false;
  const bona_fide_fee_claimed_but_included = bona_fide_fee_claimed_total > 0;

  const charge_breakdown = [
    chargeRow('credit_insurance_premium_total', credit_insurance_premium_total, true, 'collected_at_consummation', CIT_I),
    chargeRow('debt_cancellation_fee_total', debt_cancellation_fee_total, true, 'collected_at_consummation', CIT_I),
    chargeRow('debt_suspension_fee_total', debt_suspension_fee_total, true, 'collected_at_consummation', CIT_I),
    chargeRow('ancillary_product_fee_total', ancillary_product_fee_total, true, 'collected_at_consummation', CIT_II),
    chargeRow('finance_charge_total', finance_charge_total, true, 'carried_by_payment_schedule', CIT_IIIA),
    chargeRow(
      'application_fee', application_fee, !application_fee_carve_out_applied,
      application_fee_carve_out_applied ? 'excluded_carve_out' : 'collected_at_consummation', CIT_IIIB,
    ),
    chargeRow('participation_fee_annual', participation_fee_annual, true, 'collected_at_consummation', CIT_IIIC),
    chargeRow('bona_fide_fee_claimed_total', bona_fide_fee_claimed_total, true, 'collected_at_consummation', CIT_D1),
  ];

  let prepaid_includable_charges = 0;
  for (const c of charge_breakdown) {
    if (c.included && c.treatment === 'collected_at_consummation') prepaid_includable_charges += c.amount;
  }
  prepaid_includable_charges = r2(prepaid_includable_charges);
  const total_includable_charges = r2(prepaid_includable_charges + finance_charge_total);
  const total_excluded_charges = r2(application_fee_carve_out_applied ? application_fee : 0);

  // A charge collected at consummation is money the borrower never receives, so
  // it reduces the amount financed rather than adding to the payments. That is
  // what makes this figure an annual percentage rate over the wider charge set
  // and not a separate formula.
  const charges_exceed_advance = prepaid_includable_charges > amount_advanced;
  const amount_financed_mapr = r2(amount_advanced - prepaid_includable_charges);

  // --- schedule -------------------------------------------------------------
  const term_days = Math.max(0, Math.round(safeNum(pp.term_days, 0)));
  const requested_structure = typeof pp.payment_structure === 'string' ? pp.payment_structure : '';
  const raw_payment_count = Math.max(0, Math.round(safeNum(pp.payment_count, 0)));
  const payment_structure = (requested_structure === 'single_payment' || requested_structure === 'installment')
    ? requested_structure
    : (raw_payment_count >= 2 ? 'installment' : 'single_payment');

  const explicit_payment_amount = nonNeg(pp.payment_amount);

  let payment_count = 1;
  let unit_periods_per_year = 0;
  let payment_amount = 0;
  const payments = [];

  if (payment_structure === 'single_payment') {
    // The unit-period is the term itself, capped at one year.
    payment_count = 1;
    payment_amount = explicit_payment_amount > 0
      ? explicit_payment_amount
      : r2(amount_advanced + finance_charge_total);
    if (term_days > 0) {
      if (term_days < 365) {
        // Sub-year term: one unit-period in the term, and the unit-periods per
        // year are 365 divided by the days in the term. One rule serves both
        // the whole-month and the odd-days case, because where the term happens
        // to be a whole number of months the text permits this form too.
        unit_periods_per_year = 365 / term_days;
        payments.push({ amount: payment_amount, full: 1, frac: 0 });
      } else {
        // One year or longer: the unit-period is capped at a year, so the
        // payment sits at a whole number of years plus a remaining-days
        // fraction of a year.
        unit_periods_per_year = 1;
        const full = Math.floor(term_days / 365);
        const frac = (term_days - full * 365) / 365;
        payments.push({ amount: payment_amount, full, frac });
      }
    }
  } else {
    payment_count = Math.max(1, raw_payment_count);
    unit_periods_per_year = Math.max(1, safeNum(pp.payments_per_year, 12));
    const scheduled_total = amount_advanced + finance_charge_total;
    payment_amount = explicit_payment_amount > 0
      ? explicit_payment_amount
      : scheduled_total / payment_count;
    if (payment_count <= MAX_PAYMENT_COUNT) {
      for (let k = 1; k <= payment_count; k++) payments.push({ amount: payment_amount, full: k, frac: 0 });
    }
  }

  const payment_count_exceeds_limit = payment_structure === 'installment' && payment_count > MAX_PAYMENT_COUNT;

  const payment_total = r2(payment_amount * payment_count);
  const finance_charge_in_schedule = r2(payment_total - amount_advanced);

  const solved = (declared_out_of_scope || charges_exceed_advance)
    ? NO_RATE
    : solveActuarialRate(amount_financed_mapr, payments, unit_periods_per_year);

  const reportable = solved.bracketed && solved.converged && !declared_out_of_scope;
  // The cap test runs on the reported 2-decimal figure so the published number
  // and the verdict can never disagree. The limit forbids a rate GREATER than
  // 36 percent, so exactly 36.00 sits at the limit and does not breach it.
  const mapr_pct = reportable ? r2(solved.rate_pct) : null;
  const exceeds_cap = mapr_pct === null ? null : mapr_pct > MAPR_CAP_PCT;
  const approaching_cap = mapr_pct === null
    ? null
    : (mapr_pct > APPROACHING_CAP_PCT && mapr_pct <= MAPR_CAP_PCT);

  const compliance_flags = [];
  if (declared_out_of_scope) compliance_flags.push('MLA_MAPR_OPEN_END_OUT_OF_SCOPE');
  if (payment_count_exceeds_limit) compliance_flags.push('MLA_MAPR_PAYMENT_COUNT_EXCEEDS_LIMIT');
  if (charges_exceed_advance) compliance_flags.push('MLA_MAPR_CHARGES_EXCEED_ADVANCE');
  if (!declared_out_of_scope && !solved.bracketed) compliance_flags.push('MLA_MAPR_NOT_BRACKETED');
  if (!declared_out_of_scope && solved.bracketed && !solved.converged) compliance_flags.push('MLA_MAPR_DID_NOT_CONVERGE');
  if (mapr_pct === null) compliance_flags.push('MLA_MAPR_NOT_DETERMINED');
  if (exceeds_cap === true) compliance_flags.push('MLA_MAPR_EXCEEDS_36PCT_CAP');
  if (approaching_cap === true) compliance_flags.push('MLA_MAPR_APPROACHING_CAP');
  if (application_fee_carve_out_applied) compliance_flags.push('MLA_APPLICATION_FEE_CARVE_OUT_APPLIED');
  if (bona_fide_fee_claimed_but_included) compliance_flags.push('MLA_BONA_FIDE_EXCLUSION_UNAVAILABLE_CLOSED_END');

  const output_payload = {
    mapr_pct,
    mapr_cap_pct: MAPR_CAP_PCT,
    exceeds_cap,
    mapr_determined: mapr_pct !== null,
    credit_class,
    in_scope: !declared_out_of_scope,
    payment_structure,
    payment_count,
    payment_amount: r2(payment_amount),
    payment_total,
    unit_periods_per_year: r6(unit_periods_per_year),
    term_days,
    amount_advanced: r2(amount_advanced),
    amount_financed_mapr,
    prepaid_includable_charges,
    finance_charge_in_schedule,
    total_includable_charges,
    total_excluded_charges,
    charge_breakdown,
    application_fee_carve_out_applied,
    application_fee_carve_out_predicates: {
      creditor_is_fcu_or_idi,
      is_short_term_small_amount_loan,
      application_fee_once_in_rolling_12_months,
    },
    bona_fide_fee_claimed_total: r2(bona_fide_fee_claimed_total),
    bona_fide_exclusion_available,
    periodic_rate: reportable ? solved.periodic_rate : null,
    iterations: solved.iterations,
    bracketed: solved.bracketed,
    converged: solved.converged,
    max_payment_count: MAX_PAYMENT_COUNT,
    payment_count_exceeds_limit,
    approaching_cap_threshold_pct: APPROACHING_CAP_PCT,
    approaching_cap_threshold_basis: 'House heuristic, declared. No authority states a 30 percent warning line; it is named here so a reader can see it is ours and not the regulation.',
    regulatory_basis: '10 USC 987(b) and 32 CFR 232.4(b) set the 36 percent MAPR limit. 32 CFR 232.4(c)(1) sets the charge set. 32 CFR 232.4(c)(2)(i) directs that a closed-end MAPR is calculated by Regulation Z rules for the annual percentage rate over that charge set, which are 12 CFR 1026.22(a)(1) and Appendix J to 12 CFR part 1026. DoD MLA rule 80 FR 43560 (22 Jul 2015): effective 1 Oct 2015, compliance required 3 Oct 2016, and 3 Oct 2017 for credit card accounts.',
    method_basis: 'Appendix J to 12 CFR part 1026: (a)(2) actuarial recurrence on the unpaid balance; (b)(1) annualise by multiplying the unit-period rate by the unit-periods in a year; (b)(4)(ii) the unit-period of a single advance, single payment transaction is its term, capped at one year; (b)(5)(ii) a monthly unit-period has 12 unit-periods per year; (b)(5)(vi) and (b)(5)(vii) a sub-year single advance, single payment term has one unit-period and 365 divided by the days in the term unit-periods per year; (b)(5)(v)(B) a remaining interval that is not a whole number of months is the remaining days divided by 365; (b)(6) a fraction of a unit-period is priced at simple interest, so only whole unit-periods compound and no base is raised to a fractional power. Accuracy target: the one eighth of one percentage point tolerance in 12 CFR 1026.22(a)(2).',
    scope_note: 'CLOSED-END consumer credit only. Open-end credit, including every credit card account, is OUT OF SCOPE: 32 CFR 232.4(c)(2)(ii)(A) prices it on the balance for a billing cycle under 12 CFR 1026.14(c) and (d), and 32 CFR 232.4(c)(2)(ii)(B) governs a billing cycle with no balance. Neither is computed here, and a call declaring an open-end class or a credit card account returns no rate rather than a closed-end number. The bona fide fee exclusion in 32 CFR 232.4(d)(1) reaches a credit card account under an open-end plan only, so it is unavailable on this path and a caller-declared bona fide amount is included anyway. Charges are modelled as collected at consummation and deducted from the amount financed, except a finance charge, which is carried by the payment schedule; a structure in which an includable charge is instead financed into the payments is out of scope. A schedule of more than 600 payments is also out of scope and returns no rate: that ceiling is a declared structural limit of this node, not a rule of law, and it exists so the work done inside compute() is bounded by a constant rather than by a caller-supplied payment count.',
    table_version: 'MLA-DOD-32CFR232-2015-10-01',
    table_source: '10 USC 987(b); 32 CFR 232.4(b) limit; 32 CFR 232.4(c)(1)(i) to (iii) charge set; 32 CFR 232.4(c)(1)(iii)(B) Federal credit union and insured depository institution application-fee carve-out; 32 CFR 232.4(c)(2)(i) closed-end computation method; 32 CFR 232.4(d)(1) and (d)(2) bona fide fee exclusion and its ineligible items; 12 CFR 1026.22(a) and Appendix J to 12 CFR part 1026 (eCFR versioner, retrieved 2026-08-14); worked examples 80 FR 43583 and 80 FR 43603 n.347 (retrieved 2026-08-22), republished at CFPB Supervision and Examination Manual, MLA (Sept 2016), pp. MLA 9 to 10.',
    pii_note: 'All inputs are processed locally in your browser. No data is transmitted.',
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
