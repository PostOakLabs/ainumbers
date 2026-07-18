import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-362-compute-raroc-loan-price';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_raroc_loan_price',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Risk-Adjusted Return on Capital (RAROC) loan pricing, per Basel II BCBS 128 (2006) /
// Basel III BCBS 189 (2010) simplified public approximation of the IRB economic-capital
// formula (asset correlation via the standard BCBS supervisory function, maturity
// adjustment, Vasicek single-factor model at 99.9% confidence). SA approach uses a
// risk-weight bucket table x 8%. Break-even spread is solved by a bounded bisection-style
// search against the hurdle rate. This is a simplified public approximation, NOT a
// substitute for an internally approved IRB model.
//
// Ported from the shipped tools/437-raroc-loan-pricing.html calcRAROC() -- byte-parity is
// the fixture gate. Pure ECMA-262 arithmetic only -- no Date.now/new Date(), no
// Math.random. Dollar figures are in $M and rounded to 2 decimals (r2) only at declared
// output boundaries.

const CAPITAL_APPROACHES = ['airb', 'firb', 'sa'];

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

function normCDF(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function normInv(p) {
  if (p <= 0) return -8;
  if (p >= 1) return 8;
  const c = [2.50662823884, -18.61500062529, 41.39119773534, -25.44106049637];
  const d = [-8.47351093090, 23.08336743743, -21.06224101826, 3.13082909833];
  const e = [0.3374754822726147, 0.9761690190917186, 0.1607979714918209, 0.0276438810333863, 0.0038405729373609, 0.0003951896511349, 0.0000321767881768, 0.0000002888167364, 0.0000003960315187];
  const y = p - 0.5;
  let x, r;
  if (Math.abs(y) < 0.42) {
    r = y * y;
    x = y * (((c[3] * r + c[2]) * r + c[1]) * r + c[0]) / ((((d[3] * r + d[2]) * r + d[1]) * r + d[0]) * r + 1);
  } else {
    r = p < 0.5 ? p : 1 - p;
    r = Math.log(-Math.log(r));
    x = e[0] + r * (e[1] + r * (e[2] + r * (e[3] + r * (e[4] + r * (e[5] + r * (e[6] + r * (e[7] + r * e[8])))))));
    if (y < 0) x = -x;
  }
  return x;
}

function calcRaroc(p) {
  const pdD = p.pd_pct / 100, lgdD = p.lgd_pct / 100;
  const drawn = p.ead_musd * (p.utilization_pct / 100);
  const undrawn = p.ead_musd * (1 - p.utilization_pct / 100);
  const marginD = p.margin_bps / 10000;
  const arrFeeAmt = (p.arrangement_fee_bps / 10000) * p.ead_musd / Math.max(p.tenor_years, 0.25);
  const commitFeeAmt = (p.commitment_fee_bps / 10000) * undrawn;
  const revenue = drawn * (marginD + p.benchmark_rate_pct / 100) + arrFeeAmt + commitFeeAmt;
  const expectedLoss = pdD * lgdD * drawn;
  const fundingCost = drawn * (p.cost_of_funds_pct / 100);
  const opCostM = p.operating_cost_kusd / 1000;
  const netBeforeTax = revenue - expectedLoss - fundingCost - opCostM;
  const netAfterTax = netBeforeTax * (1 - p.tax_rate_pct / 100);

  let ecap;
  if (p.capital_approach === 'sa') {
    const rw = pdD < 0.0007 ? 0.2 : pdD < 0.002 ? 0.5 : pdD < 0.005 ? 0.75 : pdD < 0.02 ? 1.0 : 1.5;
    ecap = drawn * rw * (0.08 + p.capital_buffer_bps / 10000);
  } else {
    const e50 = Math.exp(-50);
    const ePD = Math.exp(-50 * pdD);
    const rho = 0.12 * (1 - ePD) / (1 - e50) + 0.24 * (1 - (1 - ePD) / (1 - e50));
    const bSq = Math.pow(0.11852 - 0.05478 * Math.log(Math.max(pdD, 0.0001)), 2);
    const matAdj = (1 + (Math.max(p.tenor_years, 1) - 2.5) * bSq) / (1 - 1.5 * bSq);
    const normPD = normInv(Math.max(pdD, 0.0001));
    const norm999 = 3.0902;
    const K = lgdD * (normCDF((normPD + Math.sqrt(rho) * norm999) / Math.sqrt(1 - rho)) - pdD) * matAdj;
    ecap = drawn * Math.max(K + p.capital_buffer_bps / 10000, 0);
  }

  const raroc = ecap > 0 ? netAfterTax / ecap * 100 : netAfterTax > 0 ? 999 : 0;

  let beMarg = p.margin_bps;
  for (let i = 0; i < 500; i++) {
    const mD = beMarg / 10000;
    const rev2 = drawn * (mD + p.benchmark_rate_pct / 100) + arrFeeAmt + commitFeeAmt;
    const ni2 = (rev2 - expectedLoss - fundingCost - opCostM) * (1 - p.tax_rate_pct / 100);
    const rr = ecap > 0 ? ni2 / ecap * 100 : 0;
    if (Math.abs(rr - p.hurdle_rate_pct) < 0.01) break;
    beMarg += (rr > p.hurdle_rate_pct) ? -0.2 : 0.2;
    if (beMarg < 0) beMarg = 0;
    if (beMarg > 5000) beMarg = 5000;
  }

  return { revenue, expectedLoss, fundingCost, opCostM, netBeforeTax, netAfterTax, ecap, raroc, beMarg, drawn, undrawn };
}

export function compute(pp) {
  pp = pp || {};

  const p = {
    ead_musd: Math.max(0, safeNum(pp.ead_musd, 50)),
    tenor_years: Math.max(0.25, safeNum(pp.tenor_years, 5)),
    margin_bps: safeNum(pp.margin_bps, 250),
    benchmark_rate_pct: safeNum(pp.benchmark_rate_pct, 5.25),
    arrangement_fee_bps: Math.max(0, safeNum(pp.arrangement_fee_bps, 50)),
    commitment_fee_bps: Math.max(0, safeNum(pp.commitment_fee_bps, 30)),
    utilization_pct: Math.min(100, Math.max(0, safeNum(pp.utilization_pct, 85))),
    pd_pct: Math.max(0.0001, safeNum(pp.pd_pct, 0.18)),
    lgd_pct: Math.min(100, Math.max(0, safeNum(pp.lgd_pct, 40))),
    capital_approach: CAPITAL_APPROACHES.includes(pp.capital_approach) ? pp.capital_approach : 'airb',
    capital_buffer_bps: Math.max(0, safeNum(pp.capital_buffer_bps, 300)),
    hurdle_rate_pct: safeNum(pp.hurdle_rate_pct, 12),
    cost_of_funds_pct: safeNum(pp.cost_of_funds_pct, 4.80),
    operating_cost_kusd: Math.max(0, safeNum(pp.operating_cost_kusd, 100)),
    tax_rate_pct: Math.min(100, Math.max(0, safeNum(pp.tax_rate_pct, 25))),
  };

  const r = calcRaroc(p);
  const compliance_flags = ['SIMPLIFIED_IRB_APPROXIMATION_NOT_INTERNAL_MODEL'];
  const isValueCreating = r.raroc >= p.hurdle_rate_pct;
  if (isValueCreating) compliance_flags.push('RAROC_ABOVE_HURDLE');
  else compliance_flags.push('RAROC_BELOW_HURDLE_REVIEW_PRICING');

  const output_payload = {
    raroc_pct: r2(Math.min(r.raroc, 999)),
    value_creating: isValueCreating,
    hurdle_rate_pct: p.hurdle_rate_pct,
    value_spread_pct: r2(Math.min(r.raroc, 999) - p.hurdle_rate_pct),
    gross_revenue_musd: r2(r.revenue),
    expected_loss_musd: r2(r.expectedLoss),
    funding_cost_musd: r2(r.fundingCost),
    operating_cost_musd: r2(r.opCostM),
    net_income_before_tax_musd: r2(r.netBeforeTax),
    net_income_after_tax_musd: r2(r.netAfterTax),
    economic_capital_musd: r2(r.ecap),
    break_even_spread_bps: r2(r.beMarg),
    break_even_gap_bps: r2(r.beMarg - p.margin_bps),
    drawn_musd: r2(r.drawn),
    undrawn_musd: r2(r.undrawn),
    capital_approach: p.capital_approach,
    regulatory_basis: 'Basel II BCBS 128 (2006); Basel III BCBS 189 (2010). Simplified public approximation of the IRB economic-capital formula; not a substitute for an internally approved IRB model.',
    note: 'RAROC = Net Income after Tax / Economic Capital. AIRB/FIRB economic capital uses the Basel single-factor Vasicek model at 99.9% confidence; SA approach uses a risk-weight bucket table.',
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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
