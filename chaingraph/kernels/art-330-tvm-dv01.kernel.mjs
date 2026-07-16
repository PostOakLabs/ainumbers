import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-330-tvm-dv01';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_dv01',
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
function r6(v) { return Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : 0; }

function buildSchedule(face, couponRatePct, yearsToMaturity, periodsPerYear) {
  const n = Math.max(1, Math.round(yearsToMaturity * periodsPerYear));
  const couponPerPeriod = face * (couponRatePct / 100) / periodsPerYear;
  const cashFlows = [];
  for (let t = 1; t <= n; t++) {
    const amount = t === n ? couponPerPeriod + face : couponPerPeriod;
    cashFlows.push({ t, amount });
  }
  return cashFlows;
}
function priceAt(cashFlows, periodicYield) {
  let price = 0;
  for (const { t, amount } of cashFlows) price += amount * myPow(1 + periodicYield, -t);
  return price;
}

// DV01 (price value of a basis point) via central-difference full reprice at y±1bp — a genuine
// re-price, not the analytic modified-duration approximation, so it stays accurate for large
// coupons/short maturities where the linear approximation drifts.
export function compute(pp) {
  pp = pp || {};
  const face = safeNum(pp.face_value, 1000);
  const couponRatePct = safeNum(pp.coupon_rate_pct, 0);
  const ytmPct = safeNum(pp.ytm_pct, 0);
  const yearsToMaturity = Math.max(0, safeNum(pp.years_to_maturity, 0));
  const periodsPerYear = Math.max(1, Math.round(safeNum(pp.periods_per_year, 2)));
  const bpSize = safeNum(pp.basis_points, 1); // number of basis points to shock (default 1 = classic DV01)

  const compliance_flags = [];
  if (yearsToMaturity <= 0) compliance_flags.push('YEARS_TO_MATURITY_NOT_POSITIVE');

  const cashFlows = yearsToMaturity > 0 ? buildSchedule(face, couponRatePct, yearsToMaturity, periodsPerYear) : [];
  const basePeriodicYield = ytmPct / 100 / periodsPerYear;
  const shockPeriodicYield = (bpSize / 10000) / periodsPerYear; // bpSize bp (1bp = 0.0001 decimal) expressed as a periodic-yield delta

  let priceBase = 0, priceUp = 0, priceDown = 0;
  if (cashFlows.length) {
    priceBase = priceAt(cashFlows, basePeriodicYield);
    priceUp = priceAt(cashFlows, basePeriodicYield + shockPeriodicYield);
    priceDown = priceAt(cashFlows, basePeriodicYield - shockPeriodicYield);
  }
  const dv01 = (priceDown - priceUp) / 2;

  if (priceBase <= 0 && cashFlows.length) compliance_flags.push('NON_POSITIVE_PRICE');

  const output_payload = {
    dv01: r6(dv01),
    price: r2(priceBase),
    price_up_shock: r2(priceUp),
    price_down_shock: r2(priceDown),
    shock_size_bp: bpSize,
    face_value: r2(face),
    coupon_rate_pct: couponRatePct,
    ytm_pct: ytmPct,
    years_to_maturity: yearsToMaturity,
    periods_per_year: periodsPerYear,
    method: 'central_difference_full_reprice',
    regulatory_basis: 'DV01 / price value of a basis point (PVBP), standard fixed-income risk measure (Fabozzi, Bond Markets)',
    note: 'DV01 computed by full central-difference reprice at yield +/- shock_size_bp basis points (default 1bp), not the linear modified-duration approximation, so it stays accurate for large coupons or short maturities. Same even-period bullet-bond schedule as compute_bond_duration (no odd first coupon / stub support, declared limitation).',
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
