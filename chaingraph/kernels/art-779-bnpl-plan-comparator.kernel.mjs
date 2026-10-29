import { executionHash } from './_hash.mjs';
// BNPL plan comparator (BNPL-COMPARATOR-NODE-1). The APR maths is NOT
// authored here: every APR this node emits is computed by the estate's
// Reg Z Appendix J solver, art-215 (compute_reg_z_appendix_j_apr), copied
// verbatim between the ART-215-SOLVER-INLINE sentinels below and called
// from there. This kernel builds BNPL payment streams (instalments,
// cadence, fees), hands them to that solver, and formats the side-by-side
// comparison. A row hard-STOP forbids an APR method diverging from art-215:
// the verbatim inline plus the proptest's live-module parity check make
// divergence a test failure, never a silent drift.
// -------------------------------------------------------------------------
// ART-215-SOLVER-INLINE:START (verbatim)
// The APR maths below is the art-215 kernel (compute_reg_z_appendix_j_apr,
// the estate's Reg Z Appendix J actuarial solver) copied VERBATIM from
// chaingraph/kernels/art-215-reg-z-appendix-j-apr.kernel.mjs between these
// sentinels, per the composition rule the shared-math bundles follow: shared
// maths is inlined between sentinel comments, never imported at runtime,
// because the guest VM resolves only _hash). art-215 is NOT edited and
// remains the authority: the art-779 proptest (P3) imports the live art-215
// module and asserts byte-equality of every APR against this inline copy,
// so divergence is a test failure, not a silent drift. Only two mechanical
// edits were made to the copied text: `export function compute(pp)` drops
// the export keyword and is renamed computeRegZApr.
// Pure ECMA-262 math — no Math.pow, no Math.log*, no Date/random.
//
// Appendix J (b)(7) defines the time of a flow as an INTEGER count of full
// unit-periods (q, t) plus a FRACTION of a unit-period (e, f). (b)(6) then
// prices that fraction at simple interest: the rate for a fraction of a
// unit-period "shall be equal to such fraction multiplied by the percentage
// rate of finance charge per unit-period". So the (b)(8) denominator is
//     (1 + f*i) * (1+i)^t
// with a SIMPLE-interest factor on the fraction and a COMPOUND factor only on
// the integer part. Consequently no fractional exponentiation appears anywhere
// in this kernel: every exponent is an integer, raised by squaring. That is
// deliberate — compounding across the fractional part overstates the APR.

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

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r6(v) { return Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : 0; }
function r4(v) { return Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : 0; }

// Normalise one flow to Appendix J (b)(7) form: an amount, an integer count of
// FULL unit-periods, and a fraction in [0,1). Accepts either the explicit
// {full_periods, fraction} form or the legacy {periods_from_consummation}
// form, which is split at the integer boundary per (b)(7)/(b)(8).
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

// Present value of one flow at periodic rate i, per the (b)(8) denominator.
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

// G(i) = PV(payments) - PV(advances). The Appendix J rate is the root of G.
function residual(advances, payments, i) {
  return pvSum(payments, i) - pvSum(advances, i);
}

// Caller-supplied schedule length is clamped: the builder below allocates one
// flow object per payment, so an unclamped caller-controlled count is a
// hang/exhaustion lever. 12,000 periods is 1000 years of monthly payments --
// generous against any plausible real schedule. When the clamp binds,
// compute() raises NUM_PAYMENTS_CAPPED so truncation is never silent.
const NUM_PAYMENTS_CAP = 12000;

// Build a standard regular payment stream from the shorthand inputs.
// Payment k falls at k FULL unit-periods plus the odd-days fraction.
function buildStandardSchedule(pp) {
  const loan_amount = safeNum(pp.loan_amount, 0);
  const payment_amount = safeNum(pp.payment_amount, 0);
  const requested_payments = Math.round(safeNum(pp.num_payments, 1));
  const num_payments = Math.min(NUM_PAYMENTS_CAP, Math.max(1, requested_payments));
  const num_payments_capped = requested_payments > NUM_PAYMENTS_CAP;
  const periods_per_year = Math.max(1, safeNum(pp.periods_per_year, 12));
  const odd_days = Math.max(0, safeNum(pp.odd_days, 0));
  const unit_period_days = Math.max(1, safeNum(pp.unit_period_days, 30));
  let odd_frac = odd_days / unit_period_days; // f in Appendix J (b)(7)
  if (!(odd_frac >= 0)) odd_frac = 0;
  if (odd_frac >= 1) odd_frac = odd_frac - Math.floor(odd_frac);

  const advances = [{ amount: loan_amount, full_periods: 0, fraction: 0 }];
  const payments = [];
  for (let k = 1; k <= num_payments; k++) {
    payments.push({ amount: payment_amount, full_periods: k, fraction: odd_frac });
  }
  return { advances, payments, periods_per_year, num_payments_capped };
}

// Bracketed bisection on the Appendix J general equation.
//
// The rate is reported ONLY when a sign-change bracket [lo, hi] with
// G(lo) >= 0 >= G(hi) was actually established and then narrowed. If no such
// bracket exists — payments that cannot repay the advances, a degenerate
// schedule with no rate dependence, a non-finite residual — the solver reports
// non-convergence and returns NO rate. It never echoes the caller's guess and
// never reports a rate it did not bracket.
const BISECT_STEPS = 200;
const APR_WIDTH_TARGET_PP = 1e-6;  // bracket width in APR percentage points
const HI_CAP = 100;                // periodic rate ceiling for the bracket search

const NO_RATE = { periodic_rate: 0, apr: 0, iterations: 0, converged: false, bracketed: false };

function solveAPR(advances, payments, periods_per_year) {
  const ppy = Math.max(1, periods_per_year);
  const widthTarget = APR_WIDTH_TARGET_PP / (ppy * 100);

  // PRE-7 non-degeneracy: without a payment carried at a positive time the
  // equation has no rate dependence and no unique root.
  let rateDependent = false;
  for (const p of payments) {
    if (p.amount !== 0 && (p.full > 0 || p.frac > 0)) { rateDependent = true; break; }
  }
  if (!rateDependent) return NO_RATE;

  const g0 = residual(advances, payments, 0);
  if (!Number.isFinite(g0)) return NO_RATE;
  // PRE-8: a non-negative finance charge is required for a non-negative root.
  if (g0 < 0) return NO_RATE;

  // Grow the upper end until the residual turns non-positive, giving a real
  // sign-change bracket [lo, hi] with G(lo) >= 0 >= G(hi).
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
  // The bracket is preserved by construction; the root lies in [lo, hi].
  const converged = (hi - lo) <= widthTarget;
  if (!converged) {
    return { periodic_rate: 0, apr: 0, iterations: iters, converged: false, bracketed: true };
  }
  const i = lo + (hi - lo) / 2;
  return {
    periodic_rate: r6(i),
    apr: r4(i * ppy * 100),
    iterations: iters,
    converged: true,
    bracketed: true,
  };
}

function computeRegZApr(pp) {
  pp = pp || {};

  // Accept either explicit schedule (advances[]/payments[]) or shorthand.
  let rawAdvances, rawPayments, periods_per_year, num_payments_capped = false;
  if (Array.isArray(pp.advances) && Array.isArray(pp.payments)) {
    rawAdvances = pp.advances;
    rawPayments = pp.payments;
    periods_per_year = Math.max(1, safeNum(pp.periods_per_year, 12));
  } else {
    ({ advances: rawAdvances, payments: rawPayments, periods_per_year, num_payments_capped } = buildStandardSchedule(pp));
  }

  const advances = rawAdvances.map(normFlow);
  const payments = rawPayments.map(normFlow);

  const advance_total = advances.reduce((s, a) => s + a.amount, 0);
  const payment_total = payments.reduce((s, p) => s + p.amount, 0);
  const num_payments = payments.length;

  const { periodic_rate, apr, iterations, converged, bracketed } = solveAPR(
    advances, payments, periods_per_year
  );

  const compliance_flags = [];
  if (num_payments_capped) compliance_flags.push('NUM_PAYMENTS_CAPPED');
  if (!converged) compliance_flags.push('APR_DID_NOT_CONVERGE');
  if (!bracketed) compliance_flags.push('APR_NOT_BRACKETED');
  if (bracketed && converged && apr <= 0) compliance_flags.push('APR_NON_POSITIVE');
  if (apr > 40) compliance_flags.push('APR_EXCEEDS_40_PCT_VERIFY');

  const output_payload = {
    apr_pct: bracketed && converged ? apr : null,
    periodic_rate: bracketed && converged ? periodic_rate : null,
    periods_per_year,
    num_payments,
    advance_total: r4(advance_total),
    payment_total: r4(payment_total),
    finance_charge: r4(payment_total - advance_total),
    iterations,
    converged,
    bracketed,
    regulatory_basis: 'Reg Z Appendix J, 12 CFR 1026 Appendix J (general actuarial equation)',
    note: 'APR solved by bracketed bisection on the Appendix J (b)(8) general equation. The odd-days fraction is priced at simple interest, (1 + f*i), per (b)(6); only the integer count of full unit-periods is compounded. A rate is reported only when a sign-change bracket was established; otherwise apr_pct is null and APR_NOT_BRACKETED or APR_DID_NOT_CONVERGE is raised. Input APOR separately for QM spread test.',
  };

  return { output_payload, compliance_flags };
}
// ART-215-SOLVER-INLINE:END


const TOOL_ID = 'art-779-bnpl-plan-comparator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compare_bnpl_plans',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ---------------------------------------------------------------------------
// Cadence table. Appendix J prices flows in UNIT PERIODS; the cadence maps to
// unit-periods per year for art-215's periods_per_year input (APR = periodic
// rate x unit-periods per year, the single-unit-period actuarial method).
export const CADENCES = {
  weekly:   { periods_per_year: 52 },
  biweekly: { periods_per_year: 26 },
  monthly:  { periods_per_year: 12 },
};

// ---------------------------------------------------------------------------
// Provider presets. Every preset is a LABELLED EXAMPLE quoted from a dated
// primary-text snapshot (row BNPL-TERMS-PRIMARY-TEXT-1); none is an offer, and
// every parameter a preset fills carries the clause that states it. A preset
// with no provider-published dollar example fills only the plan SHAPE and is
// applied to the caller's principal; a preset with a labelled example carries
// the provider's own amounts. Terms vary by provider, merchant and credit
// decision; the qualifier quotes are the providers' own.
export const SNAPSHOTS = {
  paypal:   { id: 'bnpl-paypal-2026-10',   path: 'research/clause-snapshots/bnpl-paypal-2026-10/SNAPSHOT.md',   fetched: '2026-10-28' },
  klarna:   { id: 'bnpl-klarna-2026-10',   path: 'research/clause-snapshots/bnpl-klarna-2026-10/SNAPSHOT.md',   fetched: '2026-10-28' },
  afterpay: { id: 'bnpl-afterpay-2026-10', path: 'research/clause-snapshots/bnpl-afterpay-2026-10/SNAPSHOT.md', fetched: '2026-10-28' },
  affirm:   { id: 'bnpl-affirm-2026-10',   path: 'research/clause-snapshots/bnpl-affirm-2026-10/SNAPSHOT.md',   fetched: '2026-10-28' },
};

function cite(provider, clause_id, quote) {
  const s = SNAPSHOTS[provider];
  return { snapshot: s.id, snapshot_path: s.path, fetched: s.fetched, clause: clause_id, quote };
}

export const PRESETS = {
  paypal_pay_in_4: {
    provider: 'paypal', display: 'PayPal Pay in 4 (plan shape, biweekly)',
    kind: 'shape', // no provider-published dollar example on the fetched page
    params: { num_instalments: 4, cadence: 'biweekly', stated_apr_pct: 0, upfront_fee: 0, per_instalment_fee: 0, first_instalment_at_purchase: true },
    clauses: [
      cite('paypal', 'P1', 'Split your purchase into 4 interest-free, bi-weekly payments.'),
      cite('paypal', 'P1', 'First payment due at time of purchase. Three interest-free payments after.'),
      cite('paypal', 'P1', 'Pay in 4 is always interest-free, with no late fees or sign-up fees.'),
      cite('paypal', 'P1', 'Purchases from $10 to $2,000'),
    ],
    lender_note: cite('paypal', 'P1', 'The lender for Pay in 4 is PayPal, Inc. (NMLS# 910457).'),
    late_fee_note: cite('paypal', 'P1', 'Pay in 4 is always interest-free, with no late fees or sign-up fees.'),
    qualifiers: [cite('paypal', 'P1', 'Offer availability depends on the merchant and also may not be available for certain recurring, subscription services.')],
  },
  klarna_pay_in_4: {
    provider: 'klarna', display: 'Klarna Pay in 4 (plan shape, biweekly)',
    kind: 'shape',
    params: { num_instalments: 4, cadence: 'biweekly', stated_apr_pct: 0, upfront_fee: 0, per_instalment_fee: 0, first_instalment_at_purchase: true },
    clauses: [
      cite('klarna', 'K1', 'Pay in 4 allows you to split your purchase into 4 interest-free payments, paid every 2 weeks.'),
      cite('klarna', 'K1', 'The remaining three payments will be automatically charged every 2 weeks afterwards, with no interest or fees when you pay on time.'),
      cite('klarna', 'K1', 'No fees will be charged when you pay on time.'),
    ],
    late_fee_note: cite('klarna', 'K1', 'along with a late fee of up to $7.00.'),
    qualifiers: [cite('klarna', 'K1', 'The aggregate sum of your late fees will never exceed 25% of your order value at the time of purchase.')],
  },
  klarna_service_fee_example: {
    provider: 'klarna', display: 'Klarna apply-in-advance Pay in 4, labelled example (service fee)',
    kind: 'labelled_example', labelled_principal: 248,
    params: {
      num_instalments: 4, cadence: 'biweekly', stated_apr_pct: 35.68,
      upfront_fee: 4.99, per_instalment_fee: 0, first_instalment_at_purchase: true,
      instalments: [62, 62, 62, 62], // $62 down + three biweekly $62 (K2)
    },
    clauses: [
      cite('klarna', 'K2', 'Apply in advance for Pay in 4, issued by WebBank, with a service fee between $1.29\u2013$5.99.'),
      cite('klarna', 'K2', 'a $248 purchase with a $62 down payment and $4.99 service fee results in a 35.68% APR'),
      cite('klarna', 'K2', 'followed by three more biweekly payments of $62 (total repayment: $252.99).'),
    ],
    lender_note: cite('klarna', 'K2', 'Apply in advance for Pay in 4, issued by WebBank'),
    late_fee_note: cite('klarna', 'K1', 'along with a late fee of up to $7.00.'),
    qualifiers: [cite('klarna', 'K2', 'Subject to credit approval; minimum 25% down payment required.')],
  },
  afterpay_pay_in_4: {
    provider: 'afterpay', display: 'Afterpay Pay in 4 (plan shape, biweekly)',
    kind: 'shape',
    params: { num_instalments: 4, cadence: 'biweekly', stated_apr_pct: 0, upfront_fee: 0, per_instalment_fee: 0, first_instalment_at_purchase: true },
    clauses: [
      cite('afterpay', 'A1', 'Pay in 4 interest-free installments generally over six weeks at Afterpay brands.'),
      cite('afterpay', 'A1', 'Make the first payment upfront and the rest over time.'),
      cite('afterpay', 'A2', 'THERE ARE NO FINANCE CHARGES AND NO INTEREST PAYMENTS ASSOCIATED WITH THIS AGREEMENT.'),
    ],
    late_fee_note: cite('afterpay', 'A2', 'the Late Fee indicated in the Payment Schedule (if any) will be imposed, up to a maximum of $8.00'),
    qualifiers: [cite('afterpay', 'A1', 'Payment amounts shown are estimates and depend on eligibility and exclude taxes and shipping charges, which are added at checkout.')],
  },
  afterpay_finance_fee_example: {
    provider: 'afterpay', display: 'Afterpay finance-fee loan, labelled example',
    kind: 'labelled_example', labelled_principal: 110,
    params: {
      num_instalments: 4, cadence: 'biweekly', stated_apr_pct: 36,
      upfront_fee: 0, per_instalment_fee: 0, first_instalment_at_purchase: true,
      instalments: [27.5, 28.26, 28.26, 28.26], // $27.50 down, then 3 x $28.26; the finance fee is embedded (A1)
    },
    clauses: [
      cite('afterpay', 'A1', 'At a loan amount of $110 you could pay a down payment of $27.50'),
      cite('afterpay', 'A1', 'followed by 3 generally biweekly payments of $28.26 at a 36% APR.'),
      cite('afterpay', 'A1', 'if your loan has a finance fee, your annual percentage rate could be 36%'),
    ],
    lender_note: cite('afterpay', 'A1', 'Loans with a finance fee are underwritten and issued by First Electronic Bank.'),
    late_fee_note: cite('afterpay', 'A2', 'the Late Fee indicated in the Payment Schedule (if any) will be imposed, up to a maximum of $8.00'),
    qualifiers: [cite('afterpay', 'A1', 'Payment amounts shown are estimates and depend on eligibility and exclude taxes and shipping charges, which are added at checkout.')],
  },
  affirm_pay_in_4_example: {
    provider: 'affirm', display: 'Affirm Pay in 4, labelled example ($400)',
    kind: 'labelled_example', labelled_principal: 400,
    params: {
      num_instalments: 4, cadence: 'biweekly', stated_apr_pct: 0,
      upfront_fee: 0, per_instalment_fee: 0, first_instalment_at_purchase: true,
      instalments: [100, 100, 100, 100],
    },
    clauses: [
      cite('affirm', 'F1', 'Affirm Pay in 4 payment option is 0% APR.'),
      cite('affirm', 'F1', 'followed by 12 monthly payments of $28.88 at 15% APR or 4 interest-free payments of $100 every 2 weeks.'),
    ],
    late_fee_note: cite('affirm', 'F1', 'No fees. Ever.'),
    qualifiers: [cite('affirm', 'F1', 'Options depend on your purchase amount, may vary by merchant, and may not be available in all states.')],
  },
  affirm_monthly_example: {
    provider: 'affirm', display: 'Affirm monthly, labelled example ($400, 15% APR)',
    kind: 'labelled_example', labelled_principal: 400,
    params: {
      num_instalments: 12, cadence: 'monthly', stated_apr_pct: 15,
      upfront_fee: 0, per_instalment_fee: 0, first_instalment_at_purchase: false,
      down_payment: 80, instalment_amount: 28.88, // $80 down at purchase + 12 x $28.88 monthly (F1)
    },
    clauses: [
      cite('affirm', 'F1', 'For example, at a purchase price of $400 you could pay a down payment of $80'),
      cite('affirm', 'F1', 'followed by 12 monthly payments of $28.88 at 15% APR or 4 interest-free payments of $100 every 2 weeks.'),
      cite('affirm', 'F1', 'Your rate will be 0\u201336% APR based on credit, and is subject to an eligibility check.'),
    ],
    lender_note: cite('affirm', 'F2', 'Loans through Affirm are made by Cross River Bank, Member FDIC; Celtic Bank; Lead Bank, Member FDIC; or Affirm Loan Services, LLC.'),
    late_fee_note: cite('affirm', 'F1', 'No fees. Ever.'),
    qualifiers: [cite('affirm', 'F1', 'Options depend on your purchase amount, may vary by merchant, and may not be available in all states.')],
  },
};

// ---------------------------------------------------------------------------
// Domain caps (caller-controlled values are clamped or refused, never looped).
const PRINCIPAL_MAX = 1000000;   // USD 1,000,000
const INSTALMENTS_MIN = 1, INSTALMENTS_MAX = 156; // three years of weekly payments
const PLANS_MIN = 1, PLANS_MAX = 8;
const APR_PCT_MIN = 0, APR_PCT_MAX = 100;
const FEE_MAX = 100000;
const AMOUNT_MAX = 1000000;

function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }
function cents(v) { return Math.round(num(v) * 100); }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

function refused(domain_error, flags, detail) {
  return {
    output_payload: {
      input_echo: null, refused: true, domain_error,
      note: detail,
      apr_method: 'Reg Z Appendix J actuarial via art-215 compute_reg_z_appendix_j_apr (delegated, never reimplemented)',
    },
    compliance_flags: flags,
  };
}

const F = (name) => `ART779_${name}`;

// ---------------------------------------------------------------------------
// Resolve one plan entry into explicit schedule parameters.
function resolvePlan(plan, principal, idx) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    return { err: 'REFUSED_MALFORMED_PLAN', flags: [F('INPUT_REFUSED')], detail: `plans[${idx}] is not an object` };
  }
  const isPreset = plan.preset !== undefined && plan.preset !== null;
  const explicitKeys = ['num_instalments', 'cadence', 'stated_apr_pct', 'apr_pct', 'upfront_fee', 'per_instalment_fee', 'instalment_amount', 'instalments', 'down_payment', 'first_instalment_at_purchase'];
  const hasExplicit = explicitKeys.some((k) => plan[k] !== undefined && plan[k] !== null);
  if (isPreset && hasExplicit) {
    return { err: 'REFUSED_PRESET_AND_EXPLICIT', flags: [F('INPUT_REFUSED')], detail: `plans[${idx}] carries both preset and explicit plan fields; choose one` };
  }
  if (!isPreset && !hasExplicit) {
    return { err: 'REFUSED_EMPTY_PLAN', flags: [F('INPUT_REFUSED')], detail: `plans[${idx}] carries neither preset nor explicit plan fields` };
  }

  let p, preset = null;
  if (isPreset) {
    if (typeof plan.preset !== 'string' || !PRESETS[plan.preset]) {
      return { err: 'REFUSED_UNKNOWN_PRESET', flags: [F('INPUT_REFUSED')], detail: `plans[${idx}].preset ${JSON.stringify(plan.preset)} matches no snapshot-backed preset` };
    }
    preset = PRESETS[plan.preset];
    p = { ...preset.params };
  } else {
    p = {
      num_instalments: plan.num_instalments,
      cadence: plan.cadence,
      stated_apr_pct: plan.apr_pct !== undefined && plan.apr_pct !== null ? plan.apr_pct : plan.stated_apr_pct,
      upfront_fee: plan.upfront_fee ?? 0,
      per_instalment_fee: plan.per_instalment_fee ?? 0,
      instalments: plan.instalments,
      instalment_amount: plan.instalment_amount,
      down_payment: plan.down_payment ?? 0,
      first_instalment_at_purchase: plan.first_instalment_at_purchase === true,
    };
  }

  const n = Math.round(num(p.num_instalments) ?? NaN);
  if (!(n >= INSTALMENTS_MIN && n <= INSTALMENTS_MAX)) {
    return { err: 'REFUSED_INVALID_NUM_INSTALMENTS', flags: [F('INPUT_REFUSED')], detail: `plans[${idx}].num_instalments must be an integer ${INSTALMENTS_MIN} to ${INSTALMENTS_MAX}` };
  }
  if (typeof p.cadence !== 'string' || !CADENCES[p.cadence]) {
    return { err: 'REFUSED_UNKNOWN_CADENCE', flags: [F('INPUT_REFUSED')], detail: `plans[${idx}].cadence must be one of weekly, biweekly, monthly` };
  }
  const aprIn = num(p.stated_apr_pct) ?? 0;
  if (!(aprIn >= APR_PCT_MIN && aprIn <= APR_PCT_MAX)) {
    return { err: 'REFUSED_INVALID_APR', flags: [F('INPUT_REFUSED')], detail: `plans[${idx}] stated APR must be ${APR_PCT_MIN} to ${APR_PCT_MAX} percent` };
  }
  const upfrontFee = num(p.upfront_fee) ?? 0;
  const perInstFee = num(p.per_instalment_fee) ?? 0;
  const down = num(p.down_payment) ?? 0;
  if (!(upfrontFee >= 0 && upfrontFee <= FEE_MAX) || !(perInstFee >= 0 && perInstFee <= FEE_MAX) || !(down >= 0 && down <= AMOUNT_MAX)) {
    return { err: 'REFUSED_INVALID_FEE', flags: [F('INPUT_REFUSED')], detail: `plans[${idx}] fees and down payment must be numbers between 0 and their caps` };
  }

  // Instalment amounts (base principal components, fees added separately).
  let baseInstalments = null;
  if (Array.isArray(p.instalments)) {
    const arrOk = p.instalments.length === n && p.instalments.every((x) => { const v = num(x); return v !== null && v > 0 && v <= AMOUNT_MAX; });
    if (!arrOk) {
      return { err: 'REFUSED_INVALID_INSTALMENTS', flags: [F('INPUT_REFUSED')], detail: `plans[${idx}].instalments must be ${n} positive amounts` };
    }
    baseInstalments = p.instalments.map((x) => r2(num(x)));
  } else if (p.instalment_amount !== undefined && p.instalment_amount !== null) {
    const v = num(p.instalment_amount);
    if (v === null || !(v > 0 && v <= AMOUNT_MAX)) {
      return { err: 'REFUSED_INVALID_INSTALMENT_AMOUNT', flags: [F('INPUT_REFUSED')], detail: `plans[${idx}].instalment_amount must be a positive number` };
    }
    baseInstalments = Array(n).fill(r2(v));
  } else if (aprIn > 0) {
    // Interest-bearing custom plan with no quoted instalment: the comparator
    // prices the stream AS QUOTED; it never originates an amortizing schedule.
    return { err: 'REFUSED_INSTALMENT_AMOUNT_REQUIRED', flags: [F('INPUT_REFUSED')], detail: `plans[${idx}] carries a positive stated APR but no instalment_amount; enter the quoted instalment, this node compares quoted plans and does not originate one` };
  } else {
    // Interest-free plan: split the principal equally, last absorbs remainder.
    const pc = Math.round(principal * 100);
    const base = Math.floor(pc / n);
    baseInstalments = [];
    for (let k = 0; k < n - 1; k++) baseInstalments.push(base / 100);
    baseInstalments.push((pc - base * (n - 1)) / 100);
  }

  const label = typeof plan.label === 'string' && plan.label.trim()
    ? plan.label.trim().slice(0, 80)
    : (preset ? preset.display : `${n} ${p.cadence} instalments`);

  return {
    ok: true, label, n, cadence: p.cadence, statedApr: r2(aprIn),
    upfrontFee: r2(upfrontFee), perInstFee: r2(perInstFee), down: r2(down),
    firstAtPurchase: p.first_instalment_at_purchase === true,
    baseInstalments, presetId: isPreset ? plan.preset : null, preset,
  };
}

// ---------------------------------------------------------------------------
export function compute(pp) {
  pp = pp || {};

  const principal = num(pp.principal);
  if (principal === null || !(principal > 0 && principal <= PRINCIPAL_MAX)) {
    return refused('REFUSED_INVALID_PRINCIPAL', [F('INPUT_REFUSED')], `principal must be a number above 0 and at most ${PRINCIPAL_MAX}`);
  }
  if (pp.currency !== undefined && pp.currency !== null && pp.currency !== 'USD') {
    return refused('REFUSED_INVALID_CURRENCY', [F('INPUT_REFUSED')], 'only USD plans are supported; the snapshots are US consumer terms');
  }
  if (!Array.isArray(pp.plans) || pp.plans.length < PLANS_MIN) {
    return refused('REFUSED_NO_PLANS', [F('INPUT_REFUSED')], `plans must be an array of ${PLANS_MIN} to ${PLANS_MAX} plan objects`);
  }
  if (pp.plans.length > PLANS_MAX) {
    return refused('REFUSED_TOO_MANY_PLANS', [F('INPUT_REFUSED')], `at most ${PLANS_MAX} plans per comparison`);
  }

  const resolved = [];
  for (let i = 0; i < pp.plans.length; i++) {
    const r = resolvePlan(pp.plans[i], principal, i);
    if (r.err) return refused(r.err, r.flags, r.detail);
    resolved.push(r);
  }

  const results = [];
  const compliance_flags = [];
  for (let i = 0; i < resolved.length; i++) {
    const pl = resolved[i];
    const ppy = CADENCES[pl.cadence].periods_per_year;

    // Payment events: {due_periods, amount}. Period 0 is at purchase.
    const events = [];
    if (pl.down > 0) events.push({ due_periods: 0, amount: pl.down, kind: 'down_payment' });
    for (let k = 0; k < pl.n; k++) {
      const due = pl.firstAtPurchase ? k : k + 1;
      events.push({ due_periods: due, amount: r2(pl.baseInstalments[k] + pl.perInstFee), kind: 'instalment', no: k + 1 });
    }
    if (pl.upfrontFee > 0) events.push({ due_periods: 0, amount: pl.upfrontFee, kind: 'upfront_fee' });
    events.sort((a, b) => a.due_periods - b.due_periods || (a.no || 0) - (b.no || 0));

    // Delegate the APR to art-215, unchanged. Amounts are passed as CENT
    // INTEGERS (the same schedule scaled x100): integer cents sum exactly in
    // IEEE-754, so a zero-finance-charge stream presents g0 == 0 exactly and
    // never trips art-215's PRE-8 on a 1e-14 float artifact. Appendix J rates
    // are scale-invariant, so the reported APR is identical.
    const advances = [{ amount: cents(principal), full_periods: 0, fraction: 0 }];
    const payments = events.map((e) => ({ amount: cents(e.amount), full_periods: e.due_periods, fraction: 0 }));
    const apr = computeRegZApr({ advances, payments, periods_per_year: ppy });
    const aprOut = apr.output_payload;

    const totalOfPaymentsCents = events.reduce((s, e) => s + cents(e.amount), 0);
    const totalOfPayments = totalOfPaymentsCents / 100;
    const totalFees = r2(pl.upfrontFee + pl.perInstFee * pl.n);
    const financeCharge = (totalOfPaymentsCents - cents(principal)) / 100;

    const flags = [];
    for (const fl of (apr.compliance_flags || [])) flags.push(`ART215_${fl}`);
    if (financeCharge < 0) flags.push('TOTAL_PAYMENTS_BELOW_PRINCIPAL_VERIFY');
    if (pl.statedApr > 0 && aprOut.converged && aprOut.bracketed && Math.abs(aprOut.apr_pct - pl.statedApr) > 1) {
      flags.push('STATED_APR_DIFFERS_FROM_REG_Z_COMPUTATION');
    }

    results.push({
      plan_index: i,
      label: pl.label,
      num_instalments: pl.n,
      cadence: pl.cadence,
      periods_per_year: ppy,
      first_instalment_at_purchase: pl.firstAtPurchase,
      schedule: events.map((e) => ({
        kind: e.kind, instalment_no: e.no ?? null,
        due_periods_from_purchase: e.due_periods, amount: e.amount,
      })),
      total_of_payments: totalOfPayments,
      fee_component_total: totalFees,
      finance_charge: financeCharge,
      stated_apr_pct: pl.statedApr,
      reg_z_apr: {
        apr_pct: aprOut.bracketed && aprOut.converged ? aprOut.apr_pct : null,
        periodic_rate: aprOut.bracketed && aprOut.converged ? aprOut.periodic_rate : null,
        converged: aprOut.converged, bracketed: aprOut.bracketed, iterations: aprOut.iterations,
      },
      preset: pl.preset ? {
        id: pl.presetId, provider: pl.preset.provider, display: pl.preset.display,
        kind: pl.preset.kind,
        labelled_example_principal: pl.preset.kind === 'labelled_example' ? pl.preset.labelled_principal : null,
        clauses: pl.preset.clauses, lender_note: pl.preset.lender_note ?? null,
        late_fee_note: pl.preset.late_fee_note ?? null, qualifiers: pl.preset.qualifiers,
        example_status: 'labelled example from the provider\'s published US consumer page, not an offer',
      } : null,
      flags,
    });
    compliance_flags.push(...flags);
  }

  // Side-by-side: rank by total of payments, exact to the cent.
  const order = results.map((r) => ({ i: r.plan_index, t: Math.round(r.total_of_payments * 100) }))
    .sort((a, b) => a.t - b.t || a.i - b.i);
  const lowest = order.filter((o) => o.t === order[0].t).map((o) => o.i);
  for (const r of results) if (lowest.includes(r.plan_index)) r.flags.push('LOWEST_TOTAL_OF_PAYMENTS');

  const output_payload = {
    input_echo: { principal: r2(principal), currency: 'USD', plans: pp.plans },
    refused: false,
    comparison: {
      ranked_by_total_of_payments: order.map((o) => o.i),
      lowest_total_of_payments_plans: lowest,
    },
    plans: results,
    apr_method: 'Every APR is computed by art-215 compute_reg_z_appendix_j_apr (Reg Z Appendix J general actuarial equation, bracketed bisection), imported and delegated to, never reimplemented.',
    terms_note: 'Presets are labelled examples from dated provider snapshots, never an offer. Terms vary by provider, merchant and credit decision; provider quotes carry their own qualifiers.',
    late_fee_note: 'Late fees are contingent on missed payments and are not part of any schedule here; preset entries cite each provider\'s stated late-fee clause as information only.',
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
