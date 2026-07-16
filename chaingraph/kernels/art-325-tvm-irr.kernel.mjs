import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-325-tvm-irr';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_irr',
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
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

// NPV at periodic rate r for equal-period cash flows indexed 0..n-1 (period 0 = time of first flow).
function npvAt(amounts, r) {
  let npv = 0;
  for (let t = 0; t < amounts.length; t++) npv += amounts[t] * myPow(1 + r, -t);
  return npv;
}

// Deterministic bisection root-find over declared bracket [lo, hi] with declared tolerance/iteration
// cap — no Newton float drift (per house discipline: root-finders must be bisection, not derivative-based).
function bisectIRR(amounts, lo, hi, tolerance, maxIterations) {
  let fLo = npvAt(amounts, lo);
  let fHi = npvAt(amounts, hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi)) {
    return { irr: 0, iterations: 0, converged: false, bracket_valid: false };
  }
  if ((fLo > 0 && fHi > 0) || (fLo < 0 && fHi < 0)) {
    return { irr: 0, iterations: 0, converged: false, bracket_valid: false };
  }
  let iter = 0, mid = lo;
  for (iter = 1; iter <= maxIterations; iter++) {
    mid = (lo + hi) / 2;
    const fMid = npvAt(amounts, mid);
    if (!Number.isFinite(fMid)) return { irr: 0, iterations: iter, converged: false, bracket_valid: true };
    if (Math.abs(fMid) < tolerance || (hi - lo) / 2 < tolerance) {
      return { irr: mid, iterations: iter, converged: true, bracket_valid: true };
    }
    if ((fLo < 0 && fMid < 0) || (fLo > 0 && fMid > 0)) { lo = mid; fLo = fMid; } else { hi = mid; }
  }
  return { irr: mid, iterations: maxIterations, converged: false, bracket_valid: true };
}

export function compute(pp) {
  pp = pp || {};
  const cashFlows = Array.isArray(pp.cash_flows) ? pp.cash_flows : [];
  const amounts = cashFlows.map((cf) => safeNum(cf && cf.amount, 0));
  const bracketLo = safeNum(pp.bracket_lo, -0.9999);
  const bracketHi = safeNum(pp.bracket_hi, 10);
  const tolerance = safeNum(pp.tolerance, 1e-9);
  const maxIterations = Math.max(1, Math.round(safeNum(pp.max_iterations, 200)));

  const compliance_flags = [];
  let result = { irr: 0, iterations: 0, converged: false, bracket_valid: false };
  if (amounts.length >= 2) {
    result = bisectIRR(amounts, bracketLo, bracketHi, tolerance, maxIterations);
    if (!result.bracket_valid) compliance_flags.push('NO_SIGN_CHANGE_IN_BRACKET');
    if (!result.converged && result.bracket_valid) compliance_flags.push('IRR_DID_NOT_CONVERGE');
  } else {
    compliance_flags.push('INSUFFICIENT_CASH_FLOWS');
  }

  const output_payload = {
    irr_pct: r6(result.irr * 100),
    num_cash_flows: amounts.length,
    iterations: result.iterations,
    converged: result.converged,
    bracket_lo_pct: r6(bracketLo * 100),
    bracket_hi_pct: r6(bracketHi * 100),
    tolerance,
    method: 'bisection',
    regulatory_basis: 'Standard internal rate of return, textbook definition (root of NPV as a function of the discount rate)',
    note: 'IRR solved by deterministic bisection over the declared [bracket_lo, bracket_hi] rate bracket with declared tolerance and iteration cap — never Newton/derivative-based, so no float-drift nondeterminism. Requires a sign change in NPV(bracket_lo)..NPV(bracket_hi); widen the bracket if bracket_valid is false. Equal-period cash flows only (index 0..n-1); for irregular dated flows use XIRR.',
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
