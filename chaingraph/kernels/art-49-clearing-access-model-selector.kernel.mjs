/**
 * art-49-clearing-access-model-selector.kernel.mjs
 * Wave 11 — FICC access-model selector & economics.
 * Scores Direct vs Sponsored (done-with) vs Sponsored/Agent (done-away) across
 * cost, execution-access, margin/netting efficiency, and ops simplicity.
 * Educational CFO model — not clearing advice. Pure kernel.
 * Spec: WORKFLOW-CANDIDATES-WAVE11 §2.2.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-49-clearing-access-model-selector';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'model_clearing_access_economics', mandate_type: 'treasury_mandate', gpu: false };

const MODELS = ['direct', 'sponsored_done_with', 'sponsored_done_away', 'agent_done_away'];
// Per-model assumptions (documented, adjustable). Fees in bps of cleared volume.
const PARAMS = {
  direct:              { fee_bps: 0.10, im_mult: 1.00, capital_mult: 0.10, ops_fixed: 2_000_000, exec: 1.00, net: 0.00, seg: 'na' },
  sponsored_done_with: { fee_bps: 0.30, im_mult: 1.00, capital_mult: 0.10, ops_fixed: 150_000,   exec: 0.40, net: 0.00, seg: 'segregated' },
  sponsored_done_away: { fee_bps: 0.28, im_mult: 0.85, capital_mult: 0.10, ops_fixed: 250_000,   exec: 0.90, net: 0.15, seg: 'segregated' },
  agent_done_away:     { fee_bps: 0.25, im_mult: 0.80, capital_mult: 0.10, ops_fixed: 400_000,   exec: 0.95, net: 0.20, seg: 'either' },
};
const IM_RATE = 0.010;          // FICC VaR-margin proxy: ~1% of outstanding (educational)
const W = { cost: 0.40, exec: 0.25, margin: 0.25, ops: 0.10 };

export function compute(pp) {
  const {
    firm_type = 'hedge-fund',
    cash_notional_annual = 0,
    repo_notional_daily = 0,
    current_access = 'none',
    num_executing_dealers = 1,
    want_execution_flexibility = true,
    capital_constrained = false,
    margin_segregation_pref = 'no-pref',
    im_funding_rate = 0.05,
    capital_charge_rate = 0.005,
  } = pp;

  const feeBase = (Number(cash_notional_annual) || 0) + (Number(repo_notional_daily) || 0) * 250;
  const imNotional = (Number(repo_notional_daily) || 0) + (Number(cash_notional_annual) || 0) / 250;
  const dealers = Math.max(1, Number(num_executing_dealers) || 1);
  const dealerNet = Math.min(0.30, dealers * 0.05); // cross-dealer netting uplift, capped 30%

  const eligibility_gates = [];
  const directEligible = (firm_type === 'bank-dealer' || firm_type === 'nonbank-dealer') && feeBase > 50e9;
  if (!directEligible) eligibility_gates.push('DIRECT_MEMBERSHIP_INELIGIBLE');

  const annual_cost_by_model = {}, im_estimate_by_model = {}, model_scores = {};
  for (const mdl of MODELS) {
    const p = PARAMS[mdl];
    const netting = p.net + (mdl.includes('done_away') ? dealerNet : 0); // done-away gets cross-dealer netting
    const im = imNotional * IM_RATE * p.im_mult * (1 - netting);
    const fees = feeBase * (p.fee_bps / 10000);
    const imFunding = im * (Number(im_funding_rate) || 0.05);
    const capital = capital_constrained ? feeBase * (Number(capital_charge_rate) || 0.005) * p.capital_mult : 0;
    const total = fees + imFunding + capital + p.ops_fixed;
    annual_cost_by_model[mdl] = Math.round(total);
    im_estimate_by_model[mdl] = Math.round(im);
    model_scores[mdl] = { _cost: total, _exec: p.exec, _margin: 1 - p.im_mult * (1 - netting), _ops: p.ops_fixed };
  }

  // Normalize to 0–100 sub-scores and blend.
  const costs = MODELS.map((m) => model_scores[m]._cost);
  const minC = Math.min(...costs), maxC = Math.max(...costs);
  const opsv = MODELS.map((m) => model_scores[m]._ops);
  const minO = Math.min(...opsv), maxO = Math.max(...opsv);
  const norm = (v, lo, hi, invert) => { if (hi === lo) return 100; const t = (v - lo) / (hi - lo); return Math.round((invert ? 1 - t : t) * 100); };

  let best = null, bestScore = -1;
  for (const mdl of MODELS) {
    const s = model_scores[mdl];
    const execAdj = s._exec * (want_execution_flexibility ? 1 : 0.7) * (dealers >= 3 ? 1 : 0.85);
    const blended =
      W.cost * norm(s._cost, minC, maxC, true) +
      W.exec * Math.round(execAdj * 100) +
      W.margin * Math.round(s._margin / 0.30 * 100) + // margin efficiency relative to max ~30%
      W.ops * norm(s._ops, minO, maxO, true);
    model_scores[mdl] = { blended: +blended.toFixed(1), cost_score: norm(s._cost, minC, maxC, true), exec_score: Math.round(execAdj * 100), eligible: mdl === 'direct' ? directEligible : true };
    if (model_scores[mdl].eligible && blended > bestScore) { bestScore = blended; best = mdl; }
  }

  const segregation_recommendation = firm_type === 'mmf' ? 'segregated'
    : (margin_segregation_pref !== 'no-pref' ? margin_segregation_pref : (best === 'agent_done_away' ? 'non-segregated (net CCP margining)' : 'segregated'));

  const compliance_flags = [];
  if (!directEligible) compliance_flags.push('DIRECT_MEMBERSHIP_INELIGIBLE');
  if (best && best.includes('done_away')) compliance_flags.push('DONE_AWAY_RECOMMENDED');
  if (firm_type === 'mmf') compliance_flags.push('SEGREGATED_MARGIN_REQUIRED_2A7');

  const cfo_memo = `Recommended access model: ${best}. ` +
    `Est. annual cost $${(annual_cost_by_model[best] / 1e6).toFixed(2)}M (vs Direct $${(annual_cost_by_model.direct / 1e6).toFixed(2)}M). ` +
    `Done-away netting uplift from ${dealers} dealer(s): ${(dealerNet * 100).toFixed(0)}%. ` +
    `Segregation: ${segregation_recommendation}. Educational estimate; confirm with the CCP and sponsor.`;

  const output_payload = {
    recommended_model: best,
    model_scores,
    annual_cost_by_model,
    im_estimate_by_model,
    execution_access_score: Math.round(PARAMS[best].exec * 100),
    netting_efficiency_pct: +((PARAMS[best].net + (best.includes('done_away') ? dealerNet : 0)) * 100).toFixed(1),
    segregation_recommendation,
    eligibility_gates,
    cfo_memo,
    note: 'Educational access-model economics for the SEC US Treasury clearing mandate. Assumptions documented in-kernel; not clearing advice.',
  };
  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null, execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
