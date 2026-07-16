import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-329-tvm-bond-duration';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_bond_duration',
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

// Builds the standard bullet-bond cash flow schedule: periods_per_year * years_to_maturity coupon
// payments of (face * coupon_rate_pct/100 / periods_per_year), face returned with the final coupon.
// day_count_convention is accepted and echoed for receipt transparency; this v1 assumes an even
// period schedule (no odd first coupon / stub period support — declared limitation).
export function buildSchedule(face, couponRatePct, yearsToMaturity, periodsPerYear) {
  const n = Math.max(1, Math.round(yearsToMaturity * periodsPerYear));
  const couponPerPeriod = face * (couponRatePct / 100) / periodsPerYear;
  const cashFlows = [];
  for (let t = 1; t <= n; t++) {
    const amount = t === n ? couponPerPeriod + face : couponPerPeriod;
    cashFlows.push({ t, amount });
  }
  return cashFlows;
}

// Prices the schedule and returns { price, macaulay_years, modified_years } given a periodic yield.
export function priceAndDuration(cashFlows, periodicYield, periodsPerYear) {
  let price = 0, weightedT = 0;
  for (const { t, amount } of cashFlows) {
    const disc = myPow(1 + periodicYield, -t);
    const pv = amount * disc;
    price += pv;
    weightedT += t * pv;
  }
  const macaulayPeriods = price !== 0 ? weightedT / price : 0;
  const macaulayYears = macaulayPeriods / periodsPerYear;
  const modifiedYears = macaulayYears / (1 + periodicYield);
  return { price, macaulayYears, modifiedYears };
}

export function compute(pp) {
  pp = pp || {};
  const face = safeNum(pp.face_value, 1000);
  const couponRatePct = safeNum(pp.coupon_rate_pct, 0);
  const ytmPct = safeNum(pp.ytm_pct, 0);
  const yearsToMaturity = Math.max(0, safeNum(pp.years_to_maturity, 0));
  const periodsPerYear = Math.max(1, Math.round(safeNum(pp.periods_per_year, 2)));
  const dayCountConvention = pp.day_count_convention || '30/360';

  const compliance_flags = [];
  if (yearsToMaturity <= 0) compliance_flags.push('YEARS_TO_MATURITY_NOT_POSITIVE');

  const cashFlows = yearsToMaturity > 0 ? buildSchedule(face, couponRatePct, yearsToMaturity, periodsPerYear) : [];
  const periodicYield = ytmPct / 100 / periodsPerYear;
  const { price, macaulayYears, modifiedYears } = cashFlows.length
    ? priceAndDuration(cashFlows, periodicYield, periodsPerYear)
    : { price: 0, macaulayYears: 0, modifiedYears: 0 };

  if (price <= 0 && cashFlows.length) compliance_flags.push('NON_POSITIVE_PRICE');

  const output_payload = {
    price: r2(price),
    macaulay_duration_years: r6(macaulayYears),
    modified_duration_years: r6(modifiedYears),
    face_value: r2(face),
    coupon_rate_pct: couponRatePct,
    ytm_pct: ytmPct,
    years_to_maturity: yearsToMaturity,
    periods_per_year: periodsPerYear,
    num_periods: cashFlows.length,
    day_count_convention: dayCountConvention,
    regulatory_basis: 'Standard bullet-bond Macaulay and modified duration, textbook definition (Fabozzi, Bond Markets)',
    note: 'Even-period bullet-bond schedule only (no odd first coupon / stub-period support, declared limitation). Macaulay duration = weighted-average time to cash flows (in years) using PV weights at the periodic yield; modified duration = Macaulay / (1 + periodic yield). day_count_convention is echoed for receipt transparency but the schedule itself assumes even periods.',
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
