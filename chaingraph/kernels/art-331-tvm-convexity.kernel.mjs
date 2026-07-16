import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-331-tvm-convexity';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_convexity',
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

// Standard closed-form bond convexity: C_periods = sum(CF_t * t*(t+1) / (1+y)^(t+2)) / Price,
// annualized by dividing by periods_per_year^2 (Fabozzi, Bond Markets, Ch.4).
function priceAndConvexity(cashFlows, periodicYield, periodsPerYear) {
  let price = 0, secondMoment = 0;
  for (const { t, amount } of cashFlows) {
    const disc = myPow(1 + periodicYield, -t);
    price += amount * disc;
    secondMoment += amount * t * (t + 1) * myPow(1 + periodicYield, -(t + 2));
  }
  const convexityPeriods = price !== 0 ? secondMoment / price : 0;
  const convexityAnnual = convexityPeriods / (periodsPerYear * periodsPerYear);
  return { price, convexityAnnual };
}

export function compute(pp) {
  pp = pp || {};
  const face = safeNum(pp.face_value, 1000);
  const couponRatePct = safeNum(pp.coupon_rate_pct, 0);
  const ytmPct = safeNum(pp.ytm_pct, 0);
  const yearsToMaturity = Math.max(0, safeNum(pp.years_to_maturity, 0));
  const periodsPerYear = Math.max(1, Math.round(safeNum(pp.periods_per_year, 2)));

  const compliance_flags = [];
  if (yearsToMaturity <= 0) compliance_flags.push('YEARS_TO_MATURITY_NOT_POSITIVE');

  const cashFlows = yearsToMaturity > 0 ? buildSchedule(face, couponRatePct, yearsToMaturity, periodsPerYear) : [];
  const periodicYield = ytmPct / 100 / periodsPerYear;
  const { price, convexityAnnual } = cashFlows.length
    ? priceAndConvexity(cashFlows, periodicYield, periodsPerYear)
    : { price: 0, convexityAnnual: 0 };

  if (price <= 0 && cashFlows.length) compliance_flags.push('NON_POSITIVE_PRICE');

  // Convexity-adjusted price change estimate for a given yield shock (informational): dP/P ~=
  // -ModDur*dy + 0.5*Convexity*dy^2. Only reported when a yield_shock_bp input is supplied.
  let convexityAdjustmentPct = null;
  if (pp.yield_shock_bp !== undefined) {
    const dy = safeNum(pp.yield_shock_bp, 0) / 10000;
    convexityAdjustmentPct = r6(0.5 * convexityAnnual * dy * dy * 100);
  }

  const output_payload = {
    convexity: r6(convexityAnnual),
    price: r2(price),
    face_value: r2(face),
    coupon_rate_pct: couponRatePct,
    ytm_pct: ytmPct,
    years_to_maturity: yearsToMaturity,
    periods_per_year: periodsPerYear,
    num_periods: cashFlows.length,
    convexity_price_adjustment_pct: convexityAdjustmentPct,
    regulatory_basis: 'Standard closed-form bond convexity, textbook definition (Fabozzi, Bond Markets Ch.4)',
    note: 'Convexity = sum(CF_t * t*(t+1) / (1+y)^(t+2)) / Price, annualized by dividing by periods_per_year^2. Same even-period bullet-bond schedule as compute_bond_duration/compute_dv01 (no odd first coupon / stub support, declared limitation). convexity_price_adjustment_pct only populates when yield_shock_bp is supplied (0.5 * convexity * dy^2 second-order term).',
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
