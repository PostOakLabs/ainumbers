import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-619-ccd2-aprc-annex3-recompute';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'recompute_ccd2_aprc_annex3',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Directive (EU) 2023/2225 (CCD2), Article 30 + Annex III Part I.
//
// Annex III's basic equation, Part I:
//     sum_{k=1}^{m}  C_k (1+X)^(-t_k)  =  sum_{l=1}^{m'} D_l (1+X)^(-s_l)
// where X is the APRC, C_k/t_k are drawdown amount/interval (years, fraction
// of a year), D_l/s_l are repayment-or-charge amount/interval. Unlike Reg Z
// Appendix J (art-215), which prices the fractional part of a unit-period at
// SIMPLE interest and compounds only the integer part, Annex III's own text
// states t_k and s_l directly "in years and fractions of a year" and raises
// (1+X) to that real-valued power without any integer/fraction split — a
// genuine fractional exponentiation, deliberately reused here rather than
// art-215's squaring trick, because art-215's trick encodes a Reg Z-specific
// rule Annex III does not state. Math.pow is used for exactly this exponent;
// no other transcendental appears in this kernel.

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }

// Round half up at 1 decimal place, per Annex III Part I remark (d): "the
// result... shall be expressed with an accuracy of at least one decimal
// place. If the figure at the following decimal place is greater than or
// equal to 5, the figure at that particular decimal place shall be increased
// by one." A floor, not a target precision (CCD2-APRC-BUILD-SPEC.md §2) —
// this kernel reports at exactly one decimal place, satisfying the floor.
function roundHalfUp1dp(v) {
  if (!Number.isFinite(v)) return v;
  const sign = v < 0 ? -1 : 1;
  const scaled = Math.abs(v) * 10;
  return sign * Math.floor(scaled + 0.5 + 1e-9) / 10;
}

// Normalise one flow to {amount, t} where t = full_periods + fraction, both
// expressed in years per Annex III Part I. Accepts either the explicit
// {full_periods, fraction} form (reused from art-215's flow shape) or a
// bare {amount, t_years} form.
function normFlow(x) {
  const amount = safeNum(x && x.amount, 0);
  let t;
  if (x && x.t_years !== undefined && x.t_years !== null) {
    t = safeNum(x.t_years, 0);
  } else {
    const full = Math.max(0, safeNum(x && x.full_periods, 0));
    let frac = safeNum(x && x.fraction, 0);
    if (!(frac >= 0)) frac = 0;
    t = full + frac;
  }
  if (!(t >= 0)) t = 0;
  return { amount, t };
}

// Present value of one flow at annual rate X, per Annex III's own
// (1+X)^(-t) term — real-valued t, real-valued exponent.
function pvFlow(flow, X) {
  const base = 1 + X;
  if (!(base > 0)) return NaN;
  const den = Math.pow(base, flow.t);
  if (!Number.isFinite(den) || den === 0) return NaN;
  return flow.amount / den;
}

function pvSum(flows, X) {
  let s = 0;
  for (const f of flows) s += pvFlow(f, X);
  return s;
}

// G(X) = PV(repayments) - PV(drawdowns). Annex III's rate is the root of G.
function residual(drawdowns, repayments, X) {
  return pvSum(repayments, X) - pvSum(drawdowns, X);
}

// Bracketed bisection on Annex III's Part I equation.
//
// A rate is reported ONLY when a sign-change bracket [lo, hi] with
// G(lo) >= 0 >= G(hi) was actually established and then narrowed. If no such
// bracket exists, the solver reports non-convergence and returns no rate —
// it never echoes a caller-supplied guess and never reports a rate it did
// not bracket. Same discipline as art-215's POST-5 / the F-2 regression this
// row's own floor must include (CCD2-APRC-BUILD-SPEC.md §2).
const BISECT_STEPS = 200;
const X_TOL = 1e-9;   // bracket width on X itself (a fraction, not a %) —
                       // 1e-9 is ~1e5 tighter than the 1dp% (0.001 fraction)
                       // rounding step, so the tolerance cannot itself move
                       // the rounded output.
const HI_CAP = 100;    // X ceiling for the bracket search (10 000% APRC)

const NO_RATE = { X: 0, iterations: 0, converged: false, bracketed: false, residual_at_stop: null };

function solveAPRC(drawdowns, repayments) {
  // Non-degeneracy: without a repayment carried at a positive time the
  // equation has no rate dependence and no unique root.
  let rateDependent = false;
  for (const r of repayments) {
    if (r.amount !== 0 && r.t > 0) { rateDependent = true; break; }
  }
  if (!rateDependent) return NO_RATE;

  const g0 = residual(drawdowns, repayments, 0);
  if (!Number.isFinite(g0)) return NO_RATE;
  // A non-negative total charge is required for a non-negative root, same
  // precondition art-215's PRE-8 states for its own equation shape.
  if (g0 < 0) return NO_RATE;

  let lo = 0, hi = 1e-9, found = false;
  if (g0 === 0) { found = true; hi = 0; }
  while (!found && hi <= HI_CAP) {
    const ghi = residual(drawdowns, repayments, hi);
    if (!Number.isFinite(ghi)) break;
    if (ghi <= 0) { found = true; break; }
    lo = hi;
    hi *= 2;
  }
  if (!found) return { X: 0, iterations: 0, converged: false, bracketed: false, residual_at_stop: null };

  let iters = 0;
  let lastMid = (lo + hi) / 2;
  while (iters < BISECT_STEPS && (hi - lo) > X_TOL) {
    const mid = lo + (hi - lo) / 2;
    if (mid <= lo || mid >= hi) break; // float resolution exhausted
    const gm = residual(drawdowns, repayments, mid);
    if (!Number.isFinite(gm)) break;
    lastMid = mid;
    if (gm >= 0) lo = mid; else hi = mid;
    iters++;
  }
  const converged = (hi - lo) <= X_TOL;
  if (!converged) {
    return { X: 0, iterations: iters, converged: false, bracketed: true, residual_at_stop: residual(drawdowns, repayments, lastMid) };
  }
  const X = lo + (hi - lo) / 2;
  return {
    X,
    iterations: iters,
    converged: true,
    bracketed: true,
    residual_at_stop: residual(drawdowns, repayments, X),
  };
}

export function compute(pp) {
  pp = pp || {};

  const rawDrawdowns = Array.isArray(pp.drawdowns) ? pp.drawdowns : [];
  const rawRepayments = Array.isArray(pp.repayments) ? pp.repayments : [];

  const drawdowns = rawDrawdowns.map(normFlow);
  const repayments = rawRepayments.map(normFlow);

  const drawdown_total = drawdowns.reduce((s, d) => s + d.amount, 0);
  const repayment_total = repayments.reduce((s, r) => s + r.amount, 0);

  const { X, iterations, converged, bracketed, residual_at_stop } = solveAPRC(drawdowns, repayments);

  const compliance_flags = [];
  if (!converged) compliance_flags.push('APRC_DID_NOT_CONVERGE');
  if (!bracketed) compliance_flags.push('APRC_NOT_BRACKETED');
  if (bracketed && converged && X <= 0) compliance_flags.push('APRC_NON_POSITIVE');

  const aprc_pct = bracketed && converged ? roundHalfUp1dp(X * 100) : null;

  const output_payload = {
    aprc_pct,
    converged,
    bracketed,
    iterations_used: iterations,
    residual_at_convergence: bracketed && converged ? residual_at_stop : null,
    num_drawdowns: drawdowns.length,
    num_repayments: repayments.length,
    drawdown_total,
    repayment_total,
    total_charge: repayment_total - drawdown_total,
    regulatory_basis: 'Directive (EU) 2023/2225 (CCD2), Article 30 + Annex III Part I (basic equation).',
    note: 'APRC solved by bracketed bisection on Annex III Part I\'s basic equation, real-valued t_k/s_l per the Directive\'s own text (no integer/fraction split). Rounded per Annex III Part I remark (d): at least one decimal place, half-up on the next digit. A rate is reported only when a sign-change bracket was established and narrowed to tolerance; otherwise aprc_pct is null and APRC_NOT_BRACKETED or APRC_DID_NOT_CONVERGE is raised. Verify-only recompute: does not determine CCD2 applicability, does not submit anything to a regulator, and does not assert compliance.',
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
