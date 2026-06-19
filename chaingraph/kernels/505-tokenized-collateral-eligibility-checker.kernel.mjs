import { executionHash } from './_hash.mjs';

const TOOL_ID = '505-tokenized-collateral-eligibility-checker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'check_tokenized_collateral_eligibility',
  mandate_type: 'collateral_mandate',
  gpu: false,
};

export function compute(pp) {
  const {
    asset_type,
    notional,
    transfer_restrictions = {},
    custody_linkage,
  } = pp;

  const { lock_up, min_denomination, transfer_agent_approval } = transfer_restrictions;
  const hasRestrictions = !!(lock_up || min_denomination || transfer_agent_approval);

  // MMF hard branch — check FIRST
  if (asset_type === 'mmf_fund_share') {
    const haircut_adj = hasRestrictions ? 5 : 0;
    const final_haircut = haircut_adj;
    const adjusted_value = +(notional * (1 - final_haircut / 100)).toFixed(2);

    const compliance_flags = {
      COLLATERAL_ELIGIBILITY_ASSESSED: true,
      DTC_ELIGIBLE: false,
      FED_ELIGIBLE_VERIFY: false,
      NOT_ELIGIBLE: false,
      HQLA_LEVEL_1: false,
      HQLA_LEVEL_2A: false,
      HQLA_LEVEL_2B: false,
      NON_HQLA: true,
      MMF_HQLA_EXCLUDED: true,
      TRANSFER_RESTRICTION_PRESENT: hasRestrictions,
      BCBS_SCO60_GROUP1A_NOTE: false,
      CUSTODY_LINKAGE_VERIFIED: !!custody_linkage,
    };

    const output_payload = { dtc_status: 'INELIGIBLE_DTC', hqla_tier: 'NON_HQLA', base_haircut: null, haircut_adj, final_haircut, adjusted_value };
    return { output_payload, compliance_flags };
  }

  // DTC eligibility
  let dtc_status;
  if (['ust','canton_dtc','dtc_custodied'].includes(asset_type)) {
    dtc_status = 'DTC_ELIGIBLE';
  } else if (['gilt','eu_sovereign','agency_mbs'].includes(asset_type)) {
    dtc_status = 'FED_ELIGIBLE_VERIFY';
  } else if (['tokenized_deposit','stablecoin'].includes(asset_type)) {
    dtc_status = 'INELIGIBLE_DTC';
  } else {
    dtc_status = 'DTC_ELIGIBLE';
  }

  // HQLA tiers + base haircuts
  let hqla_tier, base_haircut;
  if (['ust','gilt','eu_sovereign'].includes(asset_type)) {
    hqla_tier = 'HQLA_LEVEL_1';
    base_haircut = 0;
  } else if (asset_type === 'agency_mbs') {
    hqla_tier = 'HQLA_LEVEL_2A';
    base_haircut = 15;
  } else if (['ig_corp_bond','equity'].includes(asset_type)) {
    hqla_tier = 'HQLA_LEVEL_2B';
    base_haircut = 50;
  } else {
    hqla_tier = 'NON_HQLA';
    base_haircut = null;
  }

  const haircut_adj = hasRestrictions ? 5 : 0;
  const final_haircut = base_haircut !== null
    ? Math.min(base_haircut + haircut_adj, 100)
    : haircut_adj;
  const adjusted_value = +(notional * (1 - final_haircut / 100)).toFixed(2);

  const compliance_flags = {
    COLLATERAL_ELIGIBILITY_ASSESSED: true,
    DTC_ELIGIBLE: dtc_status === 'DTC_ELIGIBLE',
    FED_ELIGIBLE_VERIFY: dtc_status === 'FED_ELIGIBLE_VERIFY',
    NOT_ELIGIBLE: dtc_status === 'INELIGIBLE_DTC',
    HQLA_LEVEL_1: hqla_tier === 'HQLA_LEVEL_1',
    HQLA_LEVEL_2A: hqla_tier === 'HQLA_LEVEL_2A',
    HQLA_LEVEL_2B: hqla_tier === 'HQLA_LEVEL_2B',
    NON_HQLA: hqla_tier === 'NON_HQLA',
    MMF_HQLA_EXCLUDED: asset_type === 'mmf_fund_share',
    TRANSFER_RESTRICTION_PRESENT: hasRestrictions,
    BCBS_SCO60_GROUP1A_NOTE: hqla_tier === 'HQLA_LEVEL_1',
    CUSTODY_LINKAGE_VERIFIED: !!custody_linkage,
  };

  const output_payload = { dtc_status, hqla_tier, base_haircut, haircut_adj, final_haircut, adjusted_value };
  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    ap2_version: '1.0.0',
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
