import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-215-reg-z-appendix-j-apr';
const TOOL_VERSION = '1.1.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_reg_z_appendix_j_apr',
  mandate_type: 'compliance_mandate', gpu: false,
};

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

// Build a standard regular payment stream from the shorthand inputs.
// Payment k falls at k FULL unit-periods plus the odd-days fraction.
function buildStandardSchedule(pp) {
  const loan_amount = safeNum(pp.loan_amount, 0);
  const payment_amount = safeNum(pp.payment_amount, 0);
  const num_payments = Math.max(1, Math.round(safeNum(pp.num_payments, 1)));
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
  return { advances, payments, periods_per_year };
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

export function compute(pp) {
  pp = pp || {};

  // Accept either explicit schedule (advances[]/payments[]) or shorthand.
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

  const advance_total = advances.reduce((s, a) => s + a.amount, 0);
  const payment_total = payments.reduce((s, p) => s + p.amount, 0);
  const num_payments = payments.length;

  const { periodic_rate, apr, iterations, converged, bracketed } = solveAPR(
    advances, payments, periods_per_year
  );

  const compliance_flags = [];
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
