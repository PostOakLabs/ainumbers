import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-327-tvm-annuity';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_annuity',
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
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

// Ordinary/due annuity family. Excel semantics: pv + pmt*[(1-(1+r)^-n)/r]*(1+r*type) + fv*(1+r)^-n = 0
// where type = 0 (ordinary, end-of-period) or 1 (annuity-due, start-of-period).
function annuityFactor(rate, nper, type) {
  if (Math.abs(rate) < 1e-15) return nper; // limit as r->0: sum of 1's
  const growth = myPow(1 + rate, nper);
  const factor = (growth - 1) / rate / myPow(1 + rate, nper); // = (1-(1+r)^-n)/r
  return factor * (1 + rate * type);
}

export function compute(pp) {
  pp = pp || {};
  const rate = safeNum(pp.rate_pct, 0) / 100; // periodic rate
  const nper = safeNum(pp.nper, 0); // number of periods
  const type = pp.due === true ? 1 : 0; // 0 = ordinary (end), 1 = annuity-due (beginning)
  const solveFor = pp.solve_for === 'fv' || pp.solve_for === 'pmt' ? pp.solve_for : (pp.solve_for === 'pv' ? 'pv' : 'pv');

  const compliance_flags = [];
  if (nper <= 0) compliance_flags.push('NPER_NOT_POSITIVE');

  const annFactor = annuityFactor(rate, nper, type);
  const discPow = myPow(1 + rate, -nper);

  let pv = safeNum(pp.pv, 0);
  let fv = safeNum(pp.fv, 0);
  let pmt = safeNum(pp.pmt, 0);

  const growth = myPow(1 + rate, nper);

  if (solveFor === 'fv') {
    // fv = -(pv*(1+r)^n + pmt*FVfactor); FVfactor = ((1+r)^n - 1)/r * (1+r*type) = annFactor * growth
    fv = -(pv * growth + pmt * (annFactor * growth));
  } else if (solveFor === 'pmt') {
    // pmt = -(pv + fv*(1+r)^-n) / annFactor
    pmt = annFactor !== 0 ? -(pv + fv * discPow) / annFactor : 0;
    if (annFactor === 0) compliance_flags.push('ANNUITY_FACTOR_ZERO_CANNOT_SOLVE_PMT');
  } else {
    // solve pv: pv = -(fv*(1+r)^-n + pmt*annFactor)
    pv = -(fv * discPow + pmt * annFactor);
  }

  const output_payload = {
    solved_for: solveFor,
    pv: r2(pv),
    fv: r2(fv),
    pmt: r2(pmt),
    rate_pct: safeNum(pp.rate_pct, 0),
    nper,
    due: type === 1,
    annuity_factor: Number.isFinite(annFactor) ? Math.round(annFactor * 1e6) / 1e6 : 0,
    regulatory_basis: 'Standard time-value-of-money annuity identity (Excel PV/FV/PMT semantics), ordinary and annuity-due',
    note: 'One of pv/fv/pmt is solved from the other two plus rate_pct/nper via the closed-form annuity factor (1-(1+r)^-n)/r, adjusted by (1+r) when due=true (annuity-due, payments at period start). Deterministic pow via Taylor-series exp/ln, no engine transcendentals.',
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
