import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-616-mla-mapr-actuarial-recompute';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'recompute_mla_mapr_actuarial',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Military Lending Act MAPR, recomputed by the Regulation Z actuarial method.
//
// 32 CFR 232.4(c)(2)(i) (eCFR versioner, retrieved 2026-08-14): "For closed-end
// credit, the MAPR shall be calculated following the rules for calculating and
// disclosing the 'Annual Percentage Rate (APR)' for credit transactions under
// Regulation Z based on the charges set forth in paragraph (c)(1) of this
// section."
//
// So a MAPR is an APR over a WIDER charge set, not a different formula. This
// kernel therefore does two separable things:
//   1. Classify each caller-declared charge against 232.4(c)(1) and (d), and
//      fold the includable prepaid ones into the amount advanced.
//   2. Solve the Regulation Z actuarial rate on the resulting cash flows.
//
// The actuarial rules used in step 2 come from Appendix J to Part 1026, read
// directly (same eCFR retrieval):
//   (a)(2)  the actuarial method accrues finance charge on the unpaid balance
//           each unit-period or fractional unit-period.
//   (b)(1)  "The annual percentage rate shall be the nominal annual percentage
//           rate determined by multiplying the unit-period rate by the number
//           of unit-periods in a year." So annualization is a MULTIPLY by w,
//           never a compounding of the periodic rate.
//   (b)(6)  "The percentage rate of finance charge for a fraction (less than 1)
//           of a unit-period shall be equal to such fraction multiplied by the
//           percentage rate of finance charge per unit-period." A fraction is
//           therefore priced at SIMPLE interest, (1 + f*i), and only the whole
//           count of unit-periods compounds, (1+i)^t. Nothing in this kernel
//           ever raises a base to a fractional power.
// (b)(7) through (b)(9) are published in the eCFR XML as GIF graphics with no
// machine-readable text, so the discounting form above is derived from the
// (a)(2)/(b)(1)/(b)(6) text just quoted rather than transcribed from an image.
// The accuracy target is reasoned from 12 CFR 1026.22(a)(2)-(a)(3), which
// tolerate 1/8 and 1/4 of one percentage point; this kernel targets a bracket
// five orders of magnitude tighter than the stricter of those.
//
// Pure ECMA-262 arithmetic: no Math.pow, no Math.log, no Date, no random, no
// host globals. Every exponent is an integer raised by squaring.

// --- Declared statutory constants -------------------------------------------
// These two numbers come from the cited clause itself. They are NOT caller
// policy parameters, and a caller cannot move them.

// 32 CFR 232.4(b): "A creditor may not impose an MAPR greater than 36 percent
// in connection with an extension of consumer credit that is closed-end credit
// or in any billing cycle for open-end credit."
const MAPR_CAP_PCT = 36;

// 32 CFR 232.4(c)(2)(ii)(B). Read in full, this $100 limit is an OPEN-END,
// no-balance-in-the-billing-cycle provision: where no MAPR can be computed for
// a billing cycle because there is no balance, a creditor may still impose a
// participation fee "so long as the participation fee does not exceed $100 per
// annum". It is not a general exclusion from a closed-end MAPR, and the same
// paragraph adds that even that limit "does not apply to a bona fide
// participation fee imposed in accordance with paragraph (d)". This kernel
// computes the CLOSED-END path, so it reports the number as a declared,
// cited constant and does NOT net it out of any charge. See SCOPE below.
const PARTICIPATION_FEE_OPEN_END_NO_BALANCE_LIMIT_USD = 100;

// --- 232.4(c)(1)/(d) charge classification table ----------------------------
// One row per charge type in the art-615 I/O contract. `treatment` says what
// this kernel's arithmetic does with the amount, which is a separate question
// from whether the clause includes it: the Regulation Z finance charge is
// included in the MAPR by (c)(1)(iii)(A), but it is ALREADY expressed by the
// payment stream the caller supplies, so re-deducting it would count it twice.
const CHARGE_TABLE = {
  credit_insurance_premium: {
    included: true, treatment: 'prepaid_deducted',
    citation: '32 CFR 232.4(c)(1)(i)',
    basis: 'Any credit insurance premium or fee is included in the MAPR, and 232.4(d)(2)(i) denies it the bona fide fee exclusion.',
  },
  single_premium_credit_insurance_charge: {
    included: true, treatment: 'prepaid_deducted',
    citation: '32 CFR 232.4(c)(1)(i)',
    basis: 'Any charge for single premium credit insurance is included, and 232.4(d)(2)(i) denies it the bona fide fee exclusion.',
  },
  debt_cancellation_fee: {
    included: true, treatment: 'prepaid_deducted',
    citation: '32 CFR 232.4(c)(1)(i)',
    basis: 'Any fee for a debt cancellation contract is included, and 232.4(d)(2)(i) denies it the bona fide fee exclusion.',
  },
  debt_suspension_fee: {
    included: true, treatment: 'prepaid_deducted',
    citation: '32 CFR 232.4(c)(1)(i)',
    basis: 'Any fee for a debt suspension agreement is included, and 232.4(d)(2)(i) denies it the bona fide fee exclusion.',
  },
  credit_related_ancillary_product_fee: {
    included: true, treatment: 'prepaid_deducted',
    citation: '32 CFR 232.4(c)(1)(ii)',
    basis: 'Any fee for a credit-related ancillary product sold in connection with the credit transaction is included, and 232.4(d)(2)(ii) denies it the bona fide fee exclusion.',
  },
  finance_charge: {
    included: true, treatment: 'already_in_payment_schedule',
    citation: '32 CFR 232.4(c)(1)(iii)(A)',
    basis: 'Finance charges associated with the consumer credit are included in the MAPR. A finance charge carried by the periodic payments is already priced by the payment schedule, so it is echoed here and not deducted a second time.',
  },
  application_fee: {
    included: true, treatment: 'prepaid_deducted',
    citation: '32 CFR 232.4(c)(1)(iii)(B)',
    basis: 'Any application fee charged to a covered borrower is included, other than an application fee charged by a Federal credit union or an insured depository institution when making a short-term, small amount loan and charged not more than once in any rolling 12-month period.',
  },
  participation_fee: {
    included: true, treatment: 'prepaid_deducted',
    citation: '32 CFR 232.4(c)(1)(iii)(C)',
    basis: 'Any fee imposed for participation in any plan or arrangement for consumer credit is included, subject to 232.4(c)(2)(ii)(B).',
  },
  other_credit_card_fee: {
    included: true, treatment: 'prepaid_deducted',
    citation: '32 CFR 232.4(c)(1)(iii) and (d)(1)',
    basis: 'A residual non-enumerated credit-card fee. On a credit card account under an open-end (not home-secured) plan, a bona fide fee other than a periodic rate is excluded by 232.4(d)(1); off such an account no exclusion is available.',
  },
};


// --- numeric helpers ---------------------------------------------------------

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }

// base^n for integer n >= 0, by exponentiation by squaring. Appendix J (b)(6)
// keeps every exponent in this kernel an integer, so no fractional power is
// ever needed and none is available here.
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

// Half-up to `dp` decimals, sign-symmetric. Declared rounding step RND-2.
// Math.round alone rounds half toward +Infinity, which is not half-up for a
// negative magnitude; the sign is split out so a negative rate rounds by the
// same rule as a positive one.
function roundHalfUp(v, dp) {
  if (!Number.isFinite(v)) return 0;
  const f = powInt(10, dp);
  const s = v < 0 ? -1 : 1;
  return s * Math.round(Math.abs(v) * f) / f;
}

// Internal intermediate precision for the periodic rate, declared step RND-3.
// The clause is silent on it; 6 decimals on a periodic rate is far finer than
// the 1026.22(a) percentage-point tolerances the annualized figure answers to.
function r6(v) { return Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : 0; }
function r2(v) { return roundHalfUp(v, 2); }

// --- cash-flow model ---------------------------------------------------------

// Normalise one flow to the Appendix J form: an amount, an integer count of
// FULL unit-periods, and a fraction of a unit-period in [0,1). Accepts either
// the explicit {full_periods, fraction} pair or a single
// {periods_from_consummation} value, split at the integer boundary.
function normFlow(x) {
  const amount = safeNum(x && x.amount, 0);
  let full, frac;
  if (x && x.full_periods !== undefined && x.full_periods !== null) {
    full = Math.max(0, Math.round(safeNum(x.full_periods, 0)));
    frac = safeNum(x.fraction, 0);
  } else {
    const t = Math.max(0, safeNum(x && x.periods_from_consummation, 0));
    full = Math.floor(t);
    frac = t - full;
  }
  if (!(frac >= 0)) frac = 0;
  if (frac >= 1) { full += Math.floor(frac); frac -= Math.floor(frac); }
  return { amount, full, frac };
}

// Present value of one flow at periodic rate i. Appendix J (b)(6) prices the
// fraction at simple interest and compounds only the whole unit-periods.
function pvFlow(flow, i) {
  const den = (1 + flow.frac * i) * powInt(1 + i, flow.full);
  if (!Number.isFinite(den) || den === 0) return NaN;
  return flow.amount / den;
}

function pvSum(flows, i) {
  let s = 0;
  for (const fl of flows) s += pvFlow(fl, i);
  return s;
}

// G(i) = PV(payments) - PV(advances). The actuarial rate is the root of G.
function residual(advances, payments, i) {
  return pvSum(payments, i) - pvSum(advances, i);
}

// Shorthand schedule: one advance at consummation, `num_payments` level
// payments, payment k falling at k full unit-periods plus the odd-days
// fraction f = odd_days / unit_period_days.
function buildStandardSchedule(pp) {
  const loan_amount = safeNum(pp.loan_amount, 0);
  const payment_amount = safeNum(pp.payment_amount, 0);
  const num_payments = Math.max(1, Math.round(safeNum(pp.num_payments, 1)));
  const periods_per_year = Math.max(1, safeNum(pp.periods_per_year, 12));
  const odd_days = Math.max(0, safeNum(pp.odd_days, 0));
  const unit_period_days = Math.max(1, safeNum(pp.unit_period_days, 30));
  let odd_frac = odd_days / unit_period_days;
  if (!(odd_frac >= 0)) odd_frac = 0;
  if (odd_frac >= 1) odd_frac = odd_frac - Math.floor(odd_frac);

  const advances = [{ amount: loan_amount, full_periods: 0, fraction: 0 }];
  const payments = [];
  for (let k = 1; k <= num_payments; k++) {
    payments.push({ amount: payment_amount, full_periods: k, fraction: odd_frac });
  }
  return { advances, payments, periods_per_year };
}

// --- solver ------------------------------------------------------------------
//
// Bracketed bisection on the actuarial equation. The rate is reported ONLY when
// a sign-change bracket [lo, hi] with G(lo) >= 0 >= G(hi) was actually
// established and then narrowed to the width target. Where no such bracket
// exists -- payments that cannot repay the advances, a schedule with no rate
// dependence, a non-finite residual -- the solver reports non-convergence and
// returns NO rate. It never echoes a caller-supplied guess, and it never
// returns a figure it did not bracket.

const BISECT_STEPS = 300;
// Bracket width expressed in ANNUAL percentage points, converted to periodic.
// 1026.22(a)(3) tolerates 1/4 of one percentage point on an irregular
// transaction and (a)(2) tolerates 1/8 of one on a regular one; 1e-6 pp is
// well inside both, so the reported figure is limited by the declared 2-decimal
// rounding rather than by the solver.
const RATE_WIDTH_TARGET_PP = 1e-6;
const HI_CAP = 100;

const NO_RATE = { periodic_rate: 0, rate_pct: 0, iterations: 0, converged: false, bracketed: false };

function solveActuarialRate(advances, payments, periods_per_year) {
  const w = Math.max(1, periods_per_year);
  const widthTarget = RATE_WIDTH_TARGET_PP / (w * 100);

  // Without a non-zero payment carried at a positive time the equation has no
  // rate dependence and no unique root.
  let rateDependent = false;
  for (const p of payments) {
    if (p.amount !== 0 && (p.full > 0 || p.frac > 0)) { rateDependent = true; break; }
  }
  if (!rateDependent) return NO_RATE;

  const g0 = residual(advances, payments, 0);
  if (!Number.isFinite(g0)) return NO_RATE;
  // A non-negative finance charge is required for a non-negative root. Where
  // the payments do not repay the advances the root is negative and outside the
  // domain this kernel reports on.
  if (g0 < 0) return NO_RATE;

  // Grow the upper end until the residual turns non-positive, which gives a
  // real sign change across [lo, hi].
  let lo = 0, hi = 1e-9, found = false;
  if (g0 === 0) { found = true; hi = 0; }
  while (!found && hi <= HI_CAP) {
    const ghi = residual(advances, payments, hi);
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
    const gm = residual(advances, payments, mid);
    if (!Number.isFinite(gm)) break;
    if (gm >= 0) lo = mid; else hi = mid;
    iters++;
  }
  const converged = (hi - lo) <= widthTarget;
  if (!converged) {
    // Bracketed but not narrowed to target. No rate is reported: reporting the
    // midpoint of a wide bracket as if it converged is exactly the failure this
    // branch exists to refuse.
    return { periodic_rate: 0, rate_pct: 0, iterations: iters, converged: false, bracketed: true };
  }
  const i = lo + (hi - lo) / 2;
  // Appendix J (b)(1): annualize by MULTIPLYING the unit-period rate by the
  // number of unit-periods in a year.
  return {
    periodic_rate: r6(i),
    rate_pct: i * w * 100,
    iterations: iters,
    converged: true,
    bracketed: true,
  };
}

// --- charge classification ---------------------------------------------------

function classifyCharge(raw) {
  const charge_type = String(raw && raw.charge_type != null ? raw.charge_type : '');
  const amount = safeNum(raw && raw.amount, 0);
  const is_credit_card_account = raw ? raw.is_credit_card_account === true : false;
  const short_term_exception_claimed = raw ? raw.short_term_exception_claimed === true : false;

  const row = CHARGE_TABLE[charge_type];
  if (!row) {
    return {
      charge_type: charge_type || null,
      amount,
      is_credit_card_account,
      short_term_exception_claimed,
      recognised: false,
      included_in_mapr: false,
      treatment: 'unrecognised_not_applied',
      citation: null,
      basis: 'Charge type is not one of the nine types this kernel classifies under 32 CFR 232.4(c)(1) and (d). It is echoed and excluded from the arithmetic rather than guessed at.',
      manual_review_required: true,
      manual_review_reason: 'Unrecognised charge_type. Classify it against 232.4(c)(1) and (d) before relying on this figure.',
    };
  }

  let included = row.included;
  let treatment = row.treatment;
  let manual_review_required = false;
  let manual_review_reason = null;

  if (charge_type === 'application_fee' && short_term_exception_claimed) {
    // 232.4(c)(1)(iii)(B)'s carve-out turns on facts this kernel does not hold:
    // whether the creditor is a Federal credit union or an insured depository
    // institution, whether the loan is short-term and small amount, and whether
    // the fee was charged more than once in a rolling 12-month period. The
    // charge stays included in the arithmetic and the unresolved test is named.
    manual_review_required = true;
    manual_review_reason = 'The 232.4(c)(1)(iii)(B) exception turns on creditor type (Federal credit union or insured depository institution), on the loan being short-term and small amount, and on the fee having been charged not more than once in a rolling 12-month period. Those facts are not inputs here, so the fee is included and the test is left open.';
  }

  if (charge_type === 'participation_fee' && is_credit_card_account) {
    // 232.4(d)(1) can exclude a participation fee on a credit card account, but
    // only if it is bona fide AND reasonable, and (d)(3) makes reasonableness a
    // comparison against fees charged by other creditors. (d)(3)(iv) states in
    // terms that a $400 participation fee may be reasonable, so no dollar
    // threshold resolves it either.
    manual_review_required = true;
    manual_review_reason = 'On a credit card account 232.4(d)(1) may exclude a bona fide participation fee, but 232.4(d)(3) makes reasonableness a comparison against fees charged by other creditors for a substantially similar product. That comparison is not an input here, so the fee is included and the test is left open.';
  }

  if (charge_type === 'other_credit_card_fee') {
    if (is_credit_card_account) {
      // 232.4(d)(1) excludes a bona fide non-periodic-rate fee on a credit card
      // account. (d)(2) does not reach this residual type, so the exclusion is
      // available, but (d)(3) reasonableness is again a facts test.
      included = false;
      treatment = 'excluded_bona_fide_credit_card_fee';
      manual_review_required = true;
      manual_review_reason = 'Excluded under 232.4(d)(1) as a bona fide fee other than a periodic rate on a credit card account. 232.4(d)(3) requires the fee to be reasonable against fees charged by other creditors, and 232.4(d)(4)(ii) pulls every such fee back into the MAPR if any non-bona-fide fee is also imposed. Neither test is an input here.';
    }
  }

  return {
    charge_type,
    amount,
    is_credit_card_account,
    short_term_exception_claimed,
    recognised: true,
    included_in_mapr: included,
    treatment,
    citation: row.citation,
    basis: row.basis,
    manual_review_required,
    manual_review_reason,
  };
}

// --- entry point -------------------------------------------------------------

export function compute(pp) {
  pp = pp || {};

  let rawAdvances, rawPayments, periods_per_year;
  if (Array.isArray(pp.advances) && Array.isArray(pp.payments)) {
    rawAdvances = pp.advances;
    rawPayments = pp.payments;
    periods_per_year = Math.max(1, safeNum(pp.periods_per_year, 12));
  } else {
    ({ advances: rawAdvances, payments: rawPayments, periods_per_year } = buildStandardSchedule(pp));
  }

  const advances = rawAdvances.map(normFlow);
  const payments = rawPayments.map(normFlow);

  const rawCharges = Array.isArray(pp.mla_charges) ? pp.mla_charges : [];
  const charge_breakdown = rawCharges.map(classifyCharge);

  let prepaid_included_total = 0;
  let finance_charge_in_schedule_total = 0;
  let manual_review_required = false;
  for (const c of charge_breakdown) {
    if (c.manual_review_required) manual_review_required = true;
    if (!c.included_in_mapr) continue;
    if (c.treatment === 'prepaid_deducted') prepaid_included_total += c.amount;
    else if (c.treatment === 'already_in_payment_schedule') finance_charge_in_schedule_total += c.amount;
  }
  prepaid_included_total = roundHalfUp(prepaid_included_total, 2);
  finance_charge_in_schedule_total = roundHalfUp(finance_charge_in_schedule_total, 2);

  const advance_total = advances.reduce((s, a) => s + a.amount, 0);
  const payment_total = payments.reduce((s, p) => s + p.amount, 0);

  // An includable prepaid charge is money the borrower never receives, so it
  // reduces the amount advanced rather than adding to the payments. This is
  // what makes an MAPR an APR "based on the charges set forth in paragraph
  // (c)(1)" and not a separate formula. The deduction is applied to the
  // earliest advance, which is where a charge collected at consummation sits.
  const charges_exceed_advance = prepaid_included_total > advance_total;
  const mapr_advances = advances.map((a, idx) => (
    idx === 0 ? { amount: a.amount - prepaid_included_total, full: a.full, frac: a.frac } : a
  ));
  const amount_financed_mapr = roundHalfUp(advance_total - prepaid_included_total, 2);

  const solved = charges_exceed_advance
    ? NO_RATE
    : solveActuarialRate(mapr_advances, payments, periods_per_year);

  const reportable = solved.bracketed && solved.converged;
  const mapr_pct = reportable ? r2(solved.rate_pct) : null;
  // The cap comparison is made on the reported 2-decimal figure so that the
  // published number and the verdict cannot disagree. 232.4(b) forbids an MAPR
  // "greater than 36 percent", so exactly 36.00 is at the cap and not over it.
  const exceeds_cap = mapr_pct === null ? null : mapr_pct > MAPR_CAP_PCT;

  const compliance_flags = [];
  if (charges_exceed_advance) compliance_flags.push('MAPR_CHARGES_EXCEED_ADVANCE');
  if (!solved.bracketed) compliance_flags.push('MAPR_NOT_BRACKETED');
  if (!solved.converged) compliance_flags.push('MAPR_DID_NOT_CONVERGE');
  if (exceeds_cap === true) compliance_flags.push('MAPR_EXCEEDS_36_PCT_CAP');
  if (manual_review_required) compliance_flags.push('MAPR_MANUAL_REVIEW_REQUIRED');

  const output_payload = {
    mapr_pct,
    mapr_cap_pct: MAPR_CAP_PCT,
    exceeds_cap,
    periodic_rate: reportable ? solved.periodic_rate : null,
    periods_per_year,
    num_advances: advances.length,
    num_payments: payments.length,
    advance_total: roundHalfUp(advance_total, 2),
    payment_total: roundHalfUp(payment_total, 2),
    amount_financed_mapr,
    prepaid_included_total,
    finance_charge_in_schedule_total,
    charge_breakdown,
    manual_review_required,
    participation_fee_open_end_no_balance_limit_usd: PARTICIPATION_FEE_OPEN_END_NO_BALANCE_LIMIT_USD,
    iterations: solved.iterations,
    converged: solved.converged,
    bracketed: solved.bracketed,
    regulatory_basis: '32 CFR 232.4(b) MAPR cap and 232.4(c)(1) charge set, computed by the Regulation Z actuarial method that 232.4(c)(2)(i) cross-references (Appendix J to 12 CFR part 1026).',
    note: 'Closed-end MAPR recomputed by the Regulation Z actuarial method. Includable prepaid charges under 232.4(c)(1) reduce the amount advanced; a finance charge already carried by the payment schedule is echoed and not deducted twice. A rate is reported only when a sign-change bracket was established and narrowed, otherwise mapr_pct is null and MAPR_NOT_BRACKETED or MAPR_DID_NOT_CONVERGE is raised. The $100 participation-fee figure is the 232.4(c)(2)(ii)(B) open-end no-balance limit, reported as a cited constant and not netted out of this closed-end calculation. Whether a fee is bona fide and reasonable under 232.4(d)(3), and whether the 232.4(c)(1)(iii)(B) application-fee exception applies, both turn on facts this node does not hold and are surfaced as manual review rather than decided.',
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

