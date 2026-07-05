import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-255-compute-lcm-rate-derivation';
const TOOL_VERSION = '1.0.0';

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mandate_type: 'analytics_mandate', gpu: false };

// Loss Cost Multiplier (LCM) decomposition and rate derivation.
// PROPRIETARY-DATA NOTICE: This kernel performs LCM DECOMPOSITION MATH ONLY
// on user-supplied loss costs. It NEVER embeds, references, or redistributes
// ISO/Verisk loss cost rate pages, advisory loss costs, or any proprietary
// rate-bureau filing. Users must supply their own approved loss costs.
// LCM formula: rate = loss_cost * LCM; LCM = 1 / (1 - LAE_pct - fixed_exp_pct - variable_exp_pct - profit_pct)
// ZERO PII: no policyholder data; only aggregate rate components.

const TABLE_VERSION = 'LCM-DECOMPOSITION-MATH-V1.0-2025';
const TABLE_SOURCE  = 'Actuarial Standard of Practice No. 25 (Premium Calculations); Willis Towers Watson Rate Adequacy methodology; user-supplied loss costs only — no ISO/Verisk advisory rates embedded.';

export function compute(params) {
  const p = params || {};

  // User-supplied loss cost -- MUST come from user's own rate filing or actuarial study
  const pure_loss_cost    = _finite(p.pure_loss_cost, 0);       // per unit of exposure

  // LCM components (all as decimal fractions, e.g. 0.12 = 12%)
  const lae_pct           = _finite(p.lae_pct, 0);             // Loss Adjustment Expense
  const fixed_expense_pct = _finite(p.fixed_expense_pct, 0);   // Fixed expenses (commission, overhead)
  const variable_exp_pct  = _finite(p.variable_exp_pct, 0);    // Variable expenses
  const profit_pct        = _finite(p.profit_pct, 0);          // Target profit/contingency

  // Optional credibility-weighted blending of user's own loss costs
  const complement_loss_cost = _finite(p.complement_loss_cost, pure_loss_cost);  // complement of credibility
  const credibility_z        = _finite(p.credibility_z, 1);   // Z in [0,1]; 1 = 100% own data

  const z_clamped = Math.max(0, Math.min(1, credibility_z));
  const credibility_weighted_loss_cost =
    _round4(z_clamped * pure_loss_cost + (1 - z_clamped) * complement_loss_cost);

  // LCM denominator: 1 - sum of all non-loss loadings
  const total_loading = lae_pct + fixed_expense_pct + variable_exp_pct + profit_pct;
  const lcm_denominator = 1 - total_loading;

  // Guard: denominator <= 0 is unworkable (would produce negative or infinite rate)
  const denominator_valid = lcm_denominator > 0;
  const lcm = denominator_valid ? _round4(1 / lcm_denominator) : null;

  // Rate derivation
  const indicated_rate        = lcm !== null ? _round4(credibility_weighted_loss_cost * lcm) : null;
  const pure_loss_cost_loaded = lcm !== null ? _round4(pure_loss_cost * lcm) : null;

  // Off-balance analysis: if current_rate provided, compute % change
  const current_rate   = _finite(p.current_rate, null);
  let rate_change_pct  = null;
  let rate_change_direction = null;
  if (current_rate !== null && current_rate > 0 && indicated_rate !== null) {
    rate_change_pct       = _round4((indicated_rate / current_rate - 1) * 100);
    rate_change_direction = rate_change_pct > 0 ? 'INCREASE' : rate_change_pct < 0 ? 'DECREASE' : 'FLAT';
  }

  // Component breakdown
  const loss_ratio_implied  = lcm !== null ? _round4(pure_loss_cost_loaded / (pure_loss_cost_loaded + lae_pct * pure_loss_cost_loaded / (1 - total_loading))) : null;
  const lae_dollar_load     = indicated_rate !== null ? _round4(indicated_rate * lae_pct / (1 / lcm)) : null;

  const issues = [];
  if (pure_loss_cost <= 0) issues.push('pure_loss_cost must be > 0; supply your actuarially-derived or approved loss cost');
  if (!denominator_valid)  issues.push(`LCM denominator = ${_round4(lcm_denominator)} <= 0; loading components exceed 100% — rate calculation impossible`);
  if (total_loading >= 1)  issues.push(`Total loading = ${_round4(total_loading * 100)}% >= 100% — LCM undefined`);
  if (lae_pct < 0 || fixed_expense_pct < 0 || variable_exp_pct < 0 || profit_pct < 0)
    issues.push('All percentage components must be >= 0');
  if (credibility_z < 0 || credibility_z > 1)
    issues.push('credibility_z must be between 0 and 1 inclusive');

  return {
    indicated_rate,
    lcm,
    lcm_denominator: _round4(lcm_denominator),
    denominator_valid,
    credibility_weighted_loss_cost,
    pure_loss_cost,
    complement_loss_cost,
    credibility_z: z_clamped,
    total_loading: _round4(total_loading),
    lae_pct,
    fixed_expense_pct,
    variable_exp_pct,
    profit_pct,
    pure_loss_cost_loaded,
    current_rate,
    rate_change_pct,
    rate_change_direction,
    issues,
    table_version:  TABLE_VERSION,
    table_source:   TABLE_SOURCE,
    proprietary_data_notice: 'USER-SUPPLIED LOSS COSTS ONLY. This kernel performs LCM decomposition arithmetic exclusively. It does not embed, store, or redistribute ISO/Verisk advisory loss costs or any proprietary rate-bureau filing. Ensure your pure_loss_cost input is approved and non-proprietary.',
    regulatory_basis:'ASOP 25 (Premium Calculations); state rate filing regulations (SERFF). LCM formula: rate = loss_cost × LCM; LCM = 1 / (1 - LAE% - fixed_exp% - variable_exp% - profit%). Rate adequacy review required by qualified actuary.',
    pii_note:        'ZERO PII: aggregate rate components only. No policyholder, premium, or personal data enters this kernel.',
    not_legal_advice:'Not legal or actuarial advice. Rate filings require certification by a qualified actuary and approval by the applicable state insurance department.',
  };
}

function _finite(v, def) {
  const n = Number(v);
  return (isFinite(n) && !isNaN(n)) ? n : def;
}

function _round4(v) { return Math.round(v * 10000) / 10000; }

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
