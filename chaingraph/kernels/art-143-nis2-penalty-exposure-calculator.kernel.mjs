import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-143-nis2-penalty-exposure-calculator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'calculate_nis2_penalty_exposure',
  mandate_type: 'compliance_mandate', gpu: false,
};

// NIS2 Art. 34: essential → €10M / 2% global turnover; important → €7M / 1.4%.
const MITIGATION_REDUCTION_PER_FACTOR = 0.10;
const MITIGATION_FLOOR = 0.30;

export function compute(pp) {
  const {
    entity_classification = '',
    global_annual_turnover_eur = 0,
    infringement_types = [],
    mitigating_factors = [],
  } = pp;

  const turnover = Number(global_annual_turnover_eur);
  const safe_turnover = (Number.isFinite(turnover) && turnover >= 0) ? turnover : 0;
  const is_essential = entity_classification === 'essential';
  const is_important = entity_classification === 'important';

  const infringement_breakdown = [];
  let max_penalty_eur = 0;

  const types = Array.isArray(infringement_types) ? infringement_types : [];
  types.forEach(type => {
    const fixed_max = is_essential ? 10_000_000 : is_important ? 7_000_000 : 0;
    const pct = is_essential ? 0.02 : is_important ? 0.014 : 0;
    const pct_based = (Number.isFinite(safe_turnover * pct)) ? safe_turnover * pct : 0;
    const penalty = Math.max(fixed_max, pct_based);
    infringement_breakdown.push({ type, fixed_max_eur: fixed_max, pct_based_eur: Math.round(pct_based), penalty_eur: Math.round(penalty) });
    if (penalty > max_penalty_eur) max_penalty_eur = penalty;
  });

  const factor_count = Array.isArray(mitigating_factors) ? mitigating_factors.length : 0;
  const reduction = Math.min(factor_count * MITIGATION_REDUCTION_PER_FACTOR, 1 - MITIGATION_FLOOR);
  const mitigated_estimate_eur = Math.round(max_penalty_eur * (1 - reduction));
  const turnover_pct_exposure = (safe_turnover > 0 && Number.isFinite(max_penalty_eur / safe_turnover))
    ? Math.round((max_penalty_eur / safe_turnover) * 10000) / 100
    : 0;

  const compliance_flags = [];
  compliance_flags.push('NIS2_PENALTY_ASSESSED');
  if (max_penalty_eur > 5_000_000) compliance_flags.push('NIS2_HIGH_PENALTY_EXPOSURE');
  if (types.length === 0) compliance_flags.push('NIS2_NO_INFRINGEMENT_DECLARED');

  return {
    output_payload: {
      max_penalty_eur: Math.round(max_penalty_eur),
      mitigated_estimate_eur,
      turnover_pct_exposure,
      infringement_breakdown,
      entity_classification,
      mitigating_factors_applied: factor_count,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
