import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-326-tvm-xirr';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_xirr',
  mandate_type: 'analytics_mandate', gpu: false,
};

function myExp(x) {
  if (!Number.isFinite(x)) return 0;
  let sum = 1, term = 1;
  for (let n = 1; n <= 80; n++) {
    term *= x / n;
    sum += term;
    if (Math.abs(term) < 1e-17 * Math.abs(sum)) break;
  }
  return sum;
}
function myLn(x) {
  if (x <= 0 || !Number.isFinite(x)) return -1e300;
  const y = (x - 1) / (x + 1);
  let sum = 0, ypow = y, y2 = y * y;
  for (let k = 0; k < 100; k++) {
    sum += ypow / (2 * k + 1);
    ypow *= y2;
    if (Math.abs(ypow) < 1e-17) break;
  }
  return 2 * sum;
}
function myPow(base, exp) {
  if (!Number.isFinite(base) || !Number.isFinite(exp)) return 0;
  if (exp === 0) return 1;
  if (base === 1) return 1;
  const iExp = Math.round(exp);
  if (Math.abs(exp - iExp) < 1e-12) {
    const n = Math.abs(iExp);
    let r = 1;
    for (let i = 0; i < n; i++) r *= base;
    return iExp < 0 ? 1 / r : r;
  }
  return myExp(exp * myLn(base));
}

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r6(v) { return Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : 0; }

// Fliegel-Van Flandern Julian Day Number — pure integer arithmetic, no Date object.
function toJDN(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}
function parseDate(s) {
  const parts = String(s).split('-');
  return { y: Number(parts[0]), m: Number(parts[1]), d: Number(parts[2]) };
}
function daysBetween(d1s, d2s) {
  const d1 = parseDate(d1s), d2 = parseDate(d2s);
  return toJDN(d2.y, d2.m, d2.d) - toJDN(d1.y, d1.m, d1.d);
}

// XIRR NPV: Excel semantics — day-count is ALWAYS actual/365, first flow's date is the anchor (t=0).
function npvAt(flows, anchorDate, r) {
  let npv = 0;
  for (const f of flows) {
    const t = daysBetween(anchorDate, f.date) / 365;
    npv += f.amount * myPow(1 + r, -t);
  }
  return npv;
}

function bisectXIRR(flows, anchorDate, lo, hi, tolerance, maxIterations) {
  let fLo = npvAt(flows, anchorDate, lo);
  let fHi = npvAt(flows, anchorDate, hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi)) return { rate: 0, iterations: 0, converged: false, bracket_valid: false };
  if ((fLo > 0 && fHi > 0) || (fLo < 0 && fHi < 0)) return { rate: 0, iterations: 0, converged: false, bracket_valid: false };
  let iter = 0, mid = lo;
  for (iter = 1; iter <= maxIterations; iter++) {
    mid = (lo + hi) / 2;
    const fMid = npvAt(flows, anchorDate, mid);
    if (!Number.isFinite(fMid)) return { rate: 0, iterations: iter, converged: false, bracket_valid: true };
    if (Math.abs(fMid) < tolerance || (hi - lo) / 2 < tolerance) {
      return { rate: mid, iterations: iter, converged: true, bracket_valid: true };
    }
    if ((fLo < 0 && fMid < 0) || (fLo > 0 && fMid > 0)) { lo = mid; fLo = fMid; } else { hi = mid; }
  }
  return { rate: mid, iterations: maxIterations, converged: false, bracket_valid: true };
}

export function compute(pp) {
  pp = pp || {};
  const cashFlows = Array.isArray(pp.cash_flows) ? pp.cash_flows : [];
  const flows = cashFlows.map((cf) => ({ amount: safeNum(cf && cf.amount, 0), date: cf && cf.date }));
  const validFlows = flows.filter((f) => typeof f.date === 'string' && f.date.length >= 8);
  const bracketLo = safeNum(pp.bracket_lo, -0.9999);
  const bracketHi = safeNum(pp.bracket_hi, 10);
  const tolerance = safeNum(pp.tolerance, 1e-9);
  const maxIterations = Math.max(1, Math.round(safeNum(pp.max_iterations, 200)));

  const compliance_flags = [];
  let result = { rate: 0, iterations: 0, converged: false, bracket_valid: false };
  let anchorDate = null;
  if (validFlows.length >= 2) {
    anchorDate = validFlows[0].date;
    result = bisectXIRR(validFlows, anchorDate, bracketLo, bracketHi, tolerance, maxIterations);
    if (!result.bracket_valid) compliance_flags.push('NO_SIGN_CHANGE_IN_BRACKET');
    if (!result.converged && result.bracket_valid) compliance_flags.push('XIRR_DID_NOT_CONVERGE');
  } else {
    compliance_flags.push('INSUFFICIENT_DATED_CASH_FLOWS');
  }
  if (validFlows.length !== flows.length) compliance_flags.push('SOME_CASH_FLOWS_MISSING_DATES_DROPPED');

  const output_payload = {
    xirr_pct: r6(result.rate * 100),
    num_cash_flows: validFlows.length,
    anchor_date: anchorDate,
    iterations: result.iterations,
    converged: result.converged,
    bracket_lo_pct: r6(bracketLo * 100),
    bracket_hi_pct: r6(bracketHi * 100),
    tolerance,
    method: 'bisection',
    day_count_convention: 'ACT/365',
    regulatory_basis: 'Excel XIRR semantics: actual/365 day-count, anchored to the first cash flow date, annualized rate solved from irregular-interval dated cash flows',
    note: 'XIRR solved by deterministic bisection over the declared [bracket_lo, bracket_hi] rate bracket. Day count is fixed at actual/365 per Excel/1004 semantics (not caller-configurable, matching the published XIRR definition exactly). Requires a sign change in NPV(bracket_lo)..NPV(bracket_hi) across the dated flows; widen the bracket if bracket_valid is false.',
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
