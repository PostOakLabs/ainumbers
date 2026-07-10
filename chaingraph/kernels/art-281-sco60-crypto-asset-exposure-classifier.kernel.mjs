import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-281-sco60-crypto-asset-exposure-classifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'classify_sco60_exposure',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Basel Committee SCO60 "Prudential treatment of cryptoasset exposures" (BCBS d545,
// Dec 2022 standard; national implementation timelines vary, some jurisdictions still
// consulting as of 2026 -- never assert a jurisdiction has adopted it). Classifies a
// crypto-asset position into Group 1a (tokenized traditional asset meeting
// classification conditions), Group 1b (asset-referenced token / stablecoin meeting
// conditions), Group 2a (Group 2 exposure with an effective, recognised hedge), or
// Group 2b (unhedged Group 2, conservative treatment). Applies the infrastructure-risk
// capital add-on to Group 1 exposures and checks the Group 2 exposure limit (net
// short + long Group 2 exposure must not exceed 1% of Tier 1 capital -- breach requires
// the WHOLE Group 2 book to receive Group 2b treatment, per SCO60.14). Pure table
// lookup + arithmetic, NaN-safe. Zero network, zero PII.
const BASE_RW_PCT = { '1a': 100, '1b': 100, '2a': 100, '2b': 1250 };
const GROUP2_LIMIT_PCT_OF_TIER1 = 1; // SCO60.14 -- 1% of Tier 1 capital
const MAX_INFRA_ADDON_MULTIPLIER = 2.5; // conservative local cap on the infra-risk addon

export function compute(pp) {
  const { position = {} } = pp;
  const g = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
  const b = (v) => v === true;

  const classification = ['tokenized_traditional', 'stablecoin_arte', 'unbacked_crypto', 'hedged_position']
    .includes(position.classification) ? position.classification : 'unbacked_crypto';
  const meets_group1_conditions = b(position.meets_group1_conditions);
  const hedge_effective = b(position.hedge_effective);

  let group;
  if (classification === 'tokenized_traditional' && meets_group1_conditions) group = '1a';
  else if (classification === 'stablecoin_arte' && meets_group1_conditions) group = '1b';
  else if (classification === 'hedged_position' && hedge_effective) group = '2a';
  else group = '2b';

  const infra_addon_pct_input = g(position.infrastructure_risk_addon_pct);
  const is_group1 = group === '1a' || group === '1b';
  const infra_addon_pct_applied = is_group1
    ? Math.min(infra_addon_pct_input, (MAX_INFRA_ADDON_MULTIPLIER - 1) * 100)
    : 0;
  const infra_addon_capped = is_group1 && infra_addon_pct_input > infra_addon_pct_applied;

  const base_risk_weight_pct = BASE_RW_PCT[group];
  const risk_weight_applied_pct = base_risk_weight_pct * (1 + infra_addon_pct_applied / 100);

  const group2_exposure_amount = g(position.group2_exposure_amount);
  const bank_tier1_capital = g(position.bank_tier1_capital);
  const group2_exposure_pct_tier1 = bank_tier1_capital > 0
    ? (group2_exposure_amount / bank_tier1_capital) * 100
    : 0;
  const group2_limit_breached = group2_exposure_pct_tier1 > GROUP2_LIMIT_PCT_OF_TIER1;

  const gaps = [];
  if (group2_limit_breached) gaps.push('GROUP2_EXPOSURE_LIMIT_BREACHED');
  if (infra_addon_capped) gaps.push('INFRA_ADDON_CAPPED_AT_LOCAL_MAX');
  const pillar3_precheck_pass = !group2_limit_breached;

  const compliance_flags = ['SCO60_GROUP_CLASSIFIED'];
  if (group === '2b') compliance_flags.push('SCO60_CONSERVATIVE_TREATMENT');
  if (group2_limit_breached) compliance_flags.push('SCO60_GROUP2_LIMIT_BREACHED');
  if (!pillar3_precheck_pass) compliance_flags.push('DIS55_PRECHECK_FAIL');

  return {
    output_payload: {
      classification,
      group,
      base_risk_weight_pct,
      infra_addon_pct_input,
      infra_addon_pct_applied,
      infra_addon_capped,
      risk_weight_applied_pct,
      group2_exposure_pct_tier1,
      group2_limit_breached,
      pillar3_precheck_pass,
      gaps,
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
