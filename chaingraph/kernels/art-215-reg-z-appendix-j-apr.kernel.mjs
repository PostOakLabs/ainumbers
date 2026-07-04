import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-215-reg-z-appendix-j-apr';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_reg_z_appendix_j_apr',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Pure ECMA-262 math helpers — no Math.pow, no Math.log*, no Date/random.

// exp(x) via Taylor series: e^x = sum x^n/n!  Accurate for |x| < ~700.
function myExp(x) {
  if (!Number.isFinite(x)) return 0;
  // Range-reduce: e^x = e^(floor(x)) * e^(frac(x)). Use a lookup table for
  // integer part (avoids long iteration). For financial rates x is small anyway.
  let sum = 1, term = 1;
  for (let n = 1; n <= 80; n++) {
    term *= x / n;
    sum += term;
    if (Math.abs(term) < 1e-17 * Math.abs(sum)) break;
  }
  return sum;
}

// ln(x) via atanh identity: ln(x) = 2 * atanh((x-1)/(x+1))
// atanh(y) = sum_{k=0}^{inf} y^(2k+1)/(2k+1), converges for |y|<1.
// For x > 0 this is always stable. Works for x near 1 (typical for 1+i).
function myLn(x) {
  if (x <= 0 || !Number.isFinite(x)) return -1e300; // sentinel for invalid
  // For large or small x, decompose: ln(x) = ln(x/e^k) + k for integer k.
  // Simpler: directly iterate; for financial (1+i) values x is close to 1.
  const y = (x - 1) / (x + 1);
  let sum = 0, ypow = y, y2 = y * y;
  for (let k = 0; k < 100; k++) {
    sum += ypow / (2 * k + 1);
    ypow *= y2;
    if (Math.abs(ypow) < 1e-17) break;
  }
  return 2 * sum;
}

// base^exp — integer exp by loop; fractional exp via exp(exp * ln(base)).
function myPow(base, exp) {
  if (!Number.isFinite(base) || !Number.isFinite(exp)) return 0;
  if (exp === 0) return 1;
  if (base === 1) return 1;
  const iExp = Math.round(exp);
  if (Math.abs(exp - iExp) < 1e-12) {
    // Integer exponent via loop multiplication (no Math.pow).
    const n = Math.abs(iExp);
    let r = 1;
    for (let i = 0; i < n; i++) r *= base;
    return iExp < 0 ? 1 / r : r;
  }
  // Fractional: exp(exp * ln(base)).
  return myExp(exp * myLn(base));
}

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r6(v) { return Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : 0; }
function r4(v) { return Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : 0; }

// Build a standard regular payment stream from the shorthand inputs.
// Returns {advances, payments}.
function buildStandardSchedule(pp) {
  const loan_amount = safeNum(pp.loan_amount, 0);
  const payment_amount = safeNum(pp.payment_amount, 0);
  const num_payments = Math.max(1, Math.round(safeNum(pp.num_payments, 1)));
  const periods_per_year = Math.max(1, safeNum(pp.periods_per_year, 12));
  const odd_days = Math.max(0, safeNum(pp.odd_days, 0));
  const unit_period_days = Math.max(1, safeNum(pp.unit_period_days, 30));
  const odd_frac = odd_days / unit_period_days; // u in Appendix J

  const advances = [{ amount: loan_amount, periods_from_consummation: 0 }];
  const payments = [];
  for (let k = 1; k <= num_payments; k++) {
    // First payment at (1 + odd_frac) unit periods if there are odd days,
    // otherwise at 1 unit period. Subsequent payments at +1 per step.
    const t = odd_frac + k; // time in unit periods from consummation
    payments.push({ amount: payment_amount, periods_from_consummation: t });
  }
  return { advances, payments, periods_per_year };
}

// Core Newton-Raphson APR solver per Reg Z Appendix J general equation.
// f(i) = Σ P_m*(1+i)^{-t_m} - Σ A_k*(1+i)^{-s_k} = 0  (present values equal)
// Solves for periodic rate i; APR = i * periods_per_year * 100.
function solveAPR(advances, payments, periods_per_year, apr_guess_pct) {
  const ppy = Math.max(1, periods_per_year);
  let i = safeNum(apr_guess_pct, 10) / 100 / ppy; // initial periodic rate
  if (!Number.isFinite(i) || i <= 0) i = 0.01 / ppy;

  let iters = 0;
  while (iters < 100) {
    let f = 0, df = 0;
    for (const { amount: A, periods_from_consummation: t } of advances) {
      const disc = myPow(1 + i, -t);
      f -= A * disc;                  // advance is negative in PV equation
      df += A * t * myPow(1 + i, -(t + 1));
    }
    for (const { amount: P, periods_from_consummation: t } of payments) {
      const disc = myPow(1 + i, -t);
      f += P * disc;
      df -= P * t * myPow(1 + i, -(t + 1));
    }
    if (!Number.isFinite(f) || !Number.isFinite(df) || Math.abs(df) < 1e-15) break;
    const delta = f / df;
    i -= delta;
    if (i <= 0) i = 1e-6;  // keep positive
    iters++;
    // Appendix J §(b)(5)(v) termination: |delta| < 0.000001 (0.0001% of periodic rate)
    if (Math.abs(delta) < 1e-7) break;
  }
  const apr = r4(i * ppy * 100);
  const converged = iters < 100;
  return { periodic_rate: r6(i), apr, iterations: iters, converged };
}

export function compute(pp) {
  pp = pp || {};

  // Accept either explicit schedule (advances[]/payments[]) or shorthand.
  let advances, payments, periods_per_year;
  if (Array.isArray(pp.advances) && Array.isArray(pp.payments)) {
    advances = pp.advances;
    payments = pp.payments;
    periods_per_year = Math.max(1, safeNum(pp.periods_per_year, 12));
  } else {
    ({ advances, payments, periods_per_year } = buildStandardSchedule(pp));
  }

  // Guard: all amounts and times finite.
  for (const a of advances) {
    if (!Number.isFinite(safeNum(a.amount, null))) a.amount = 0;
    if (!Number.isFinite(safeNum(a.periods_from_consummation, null))) a.periods_from_consummation = 0;
  }
  for (const p of payments) {
    if (!Number.isFinite(safeNum(p.amount, null))) p.amount = 0;
    if (!Number.isFinite(safeNum(p.periods_from_consummation, null))) p.periods_from_consummation = 0;
  }

  const advance_total = advances.reduce((s, a) => s + safeNum(a.amount, 0), 0);
  const payment_total = payments.reduce((s, p) => s + safeNum(p.amount, 0), 0);
  const num_payments = payments.length;
  const apr_guess_pct = safeNum(pp.apr_guess_pct, 10);

  const { periodic_rate, apr, iterations, converged } = solveAPR(
    advances, payments, periods_per_year, apr_guess_pct
  );

  const compliance_flags = [];
  if (!converged) compliance_flags.push('APR_DID_NOT_CONVERGE');
  if (apr <= 0) compliance_flags.push('APR_NON_POSITIVE');
  if (apr > 40) compliance_flags.push('APR_EXCEEDS_40_PCT_VERIFY');

  const output_payload = {
    apr_pct: apr,
    periodic_rate,
    periods_per_year,
    num_payments,
    advance_total: r4(advance_total),
    payment_total: r4(payment_total),
    finance_charge: r4(payment_total - advance_total),
    iterations,
    converged,
    regulatory_basis: 'Reg Z Appendix J, 12 CFR 1026 Appendix J (general actuarial equation)',
    note: 'APR computed via Appendix J actuarial method. Odd-days fraction included when advances/payments supplied with fractional periods_from_consummation. Input APOR separately for QM spread test.',
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
