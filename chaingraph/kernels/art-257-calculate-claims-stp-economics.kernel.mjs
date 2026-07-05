import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-257-calculate-claims-stp-economics';
const TOOL_VERSION = '1.0.0';

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mandate_type: 'analytics_mandate', gpu: false };

// Insurance claims Straight-Through Processing (STP) economics model.
// Computes ROI, NPV, payback period, and per-claim cost reduction for
// insurer STP automation programs. ZERO PII: aggregate portfolio metrics only.

const TABLE_VERSION = 'CLAIMS-STP-ECONOMICS-V1.0-2025';
const TABLE_SOURCE  = 'McKinsey Insurance 2024 (claims automation ROI benchmarks); Accenture Claims Transformation 2025; Majesco Claims Technology Survey 2024; NAIC Claims Process Innovation Working Group 2023.';

export function compute(params) {
  const p = params || {};

  // Volume inputs
  const annual_claims_volume    = _finite(p.annual_claims_volume, 0);      // total claims/year
  const current_stp_rate_pct    = _finite(p.current_stp_rate_pct, 0);      // current auto-closed %
  const target_stp_rate_pct     = _finite(p.target_stp_rate_pct, 0);       // target auto-closed %

  // Cost inputs
  const manual_handling_cost    = _finite(p.manual_handling_cost, 0);       // $ per manually handled claim
  const automated_handling_cost = _finite(p.automated_handling_cost, 0);    // $ per STP claim
  const implementation_cost     = _finite(p.implementation_cost, 0);        // total one-time investment $
  const annual_license_cost     = _finite(p.annual_license_cost, 0);        // recurring platform cost $/yr

  // Quality/leakage
  const leakage_rate_manual_pct   = _finite(p.leakage_rate_manual_pct, 0);  // % leakage on manual
  const leakage_rate_stp_pct      = _finite(p.leakage_rate_stp_pct, 0);     // % leakage on STP
  const average_claim_payment     = _finite(p.average_claim_payment, 0);    // avg payment per claim

  // Discount rate for NPV
  const discount_rate_pct   = _finite(p.discount_rate_pct, 10);             // default 10%
  const projection_years    = Math.min(Math.max(1, Math.round(_finite(p.projection_years, 5))), 20);

  // Clamp rates
  const cur_stp  = Math.max(0, Math.min(100, current_stp_rate_pct));
  const tgt_stp  = Math.max(0, Math.min(100, target_stp_rate_pct));

  // Current state
  const current_stp_claims    = _round0(annual_claims_volume * cur_stp / 100);
  const current_manual_claims = _round0(annual_claims_volume - current_stp_claims);
  const current_annual_cost   = _round2(current_stp_claims * automated_handling_cost +
                                        current_manual_claims * manual_handling_cost +
                                        annual_license_cost);

  // Target state
  const target_stp_claims     = _round0(annual_claims_volume * tgt_stp / 100);
  const target_manual_claims  = _round0(annual_claims_volume - target_stp_claims);
  const target_annual_cost    = _round2(target_stp_claims * automated_handling_cost +
                                        target_manual_claims * manual_handling_cost +
                                        annual_license_cost);

  // Annual savings from handling cost reduction
  const annual_handling_savings = _round2(current_annual_cost - target_annual_cost);

  // Leakage delta (incremental claims paid due to automation errors vs manual review)
  // Leakage $ = leakage_rate% * avg_payment * volume_at_each_mode
  const incremental_stp_claims    = target_stp_claims - current_stp_claims;
  const incremental_manual_claims = current_manual_claims - target_manual_claims;
  const leakage_increase  = average_claim_payment > 0
    ? _round2(incremental_stp_claims    * average_claim_payment * leakage_rate_stp_pct    / 100)
    : 0;
  const leakage_reduction = average_claim_payment > 0
    ? _round2(incremental_manual_claims * average_claim_payment * leakage_rate_manual_pct / 100)
    : 0;
  const net_leakage_impact = _round2(leakage_reduction - leakage_increase); // positive = savings

  // Net annual benefit
  const net_annual_benefit = _round2(annual_handling_savings + net_leakage_impact);

  // Simple payback period (years)
  const payback_years = net_annual_benefit > 0
    ? _round2(implementation_cost / net_annual_benefit)
    : null;

  // NPV over projection_years
  const r = discount_rate_pct / 100;
  let npv = -implementation_cost;
  const annual_cashflows = [];
  for (let yr = 1; yr <= projection_years; yr++) {
    const cf = _round2(net_annual_benefit);
    const discounted = _round2(cf / Math.pow(1 + r, yr));
    npv += discounted;
    annual_cashflows.push({ year: yr, cashflow: cf, discounted_cashflow: discounted });
  }
  npv = _round2(npv);

  // IRR (Newton-Raphson, bounded)
  let irr_pct = null;
  if (implementation_cost > 0 && net_annual_benefit > 0) {
    irr_pct = _solveIRR(implementation_cost, net_annual_benefit, projection_years);
  }

  // Per-claim metrics
  const current_avg_cost_per_claim = annual_claims_volume > 0
    ? _round2(current_annual_cost / annual_claims_volume) : 0;
  const target_avg_cost_per_claim  = annual_claims_volume > 0
    ? _round2(target_annual_cost  / annual_claims_volume) : 0;
  const cost_reduction_per_claim   = _round2(current_avg_cost_per_claim - target_avg_cost_per_claim);
  const cost_reduction_pct         = current_avg_cost_per_claim > 0
    ? _round2(cost_reduction_per_claim / current_avg_cost_per_claim * 100) : 0;

  const stp_rate_improvement_ppt = _round2(tgt_stp - cur_stp);

  return {
    npv,
    irr_pct,
    payback_years,
    net_annual_benefit,
    annual_handling_savings,
    net_leakage_impact,
    leakage_increase,
    leakage_reduction,
    current_annual_cost,
    target_annual_cost,
    cost_reduction_per_claim,
    cost_reduction_pct,
    current_avg_cost_per_claim,
    target_avg_cost_per_claim,
    stp_rate_improvement_ppt,
    current_stp_claims,
    target_stp_claims,
    current_manual_claims,
    target_manual_claims,
    projection_years,
    discount_rate_pct,
    annual_cashflows,
    table_version:   TABLE_VERSION,
    table_source:    TABLE_SOURCE,
    regulatory_basis:'NAIC Claims Process Innovation Working Group (2023); IAIS ComFrame (proportionality in claims governance). STP automation economics benchmarks per McKinsey Insurance 2024 and Majesco Claims Technology Survey 2024.',
    pii_note:        'ZERO PII: aggregate portfolio metrics and cost inputs only. No claimant, policyholder, or claim-event personal data enters this kernel.',
    not_legal_advice:'Not legal, actuarial, or investment advice. STP investment decisions require enterprise business case review and actuarial sign-off on leakage assumptions.',
  };
}

function _solveIRR(cost, annualBenefit, years) {
  // Annuity IRR: find r such that annualBenefit * (1 - (1+r)^-years) / r = cost
  let lo = -0.99, hi = 100, mid = 0.1;
  for (let i = 0; i < 60; i++) {
    mid = (lo + hi) / 2;
    const r = mid;
    const pv = r === 0 ? annualBenefit * years : annualBenefit * (1 - Math.pow(1 + r, -years)) / r;
    if (pv > cost) lo = mid; else hi = mid;
    if (hi - lo < 1e-8) break;
  }
  return Math.round(mid * 10000) / 100; // as %
}

function _finite(v, def) {
  const n = Number(v);
  return (isFinite(n) && !isNaN(n)) ? n : def;
}

function _round0(v) { return Math.round(v); }
function _round2(v) { return Math.round(v * 100) / 100; }

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const output_payload = compute(pp);
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
    compliance_flags: [],
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
