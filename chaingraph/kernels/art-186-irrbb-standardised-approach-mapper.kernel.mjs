import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-186-irrbb-standardised-approach-mapper';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'map_irrbb_standardised_approach',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Maps non-maturing deposit (NMD) positions to the EBA standardised-approach
// behavioural caps (BCBS d368 para 87 / Annex 2): retail transactional core
// proportion capped 90% / average maturity capped 5y; retail non-transactional
// (savings) core capped 70% / maturity capped 4.5y; wholesale core capped 50% /
// maturity capped 4y. Flags behavioural-option add-ons (e.g. mortgage
// prepayment) requiring separate treatment. Root node of
// irrbb-measurement-and-disclosure chain. NaN-safe. Zero network, zero PII.
const CAPS = {
  retail_transactional:     { core_cap_pct: 90, maturity_cap_years: 5 },
  retail_non_transactional: { core_cap_pct: 70, maturity_cap_years: 4.5 },
  wholesale:                { core_cap_pct: 50, maturity_cap_years: 4 },
};

export function compute(pp) {
  const { positions = {} } = pp;
  const g = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;

  const deposit_category = Object.prototype.hasOwnProperty.call(CAPS, positions.deposit_category)
    ? positions.deposit_category : 'retail_transactional';
  const cap = CAPS[deposit_category];

  const core_deposit_pct_input = g(positions.core_deposit_pct);
  const core_capped = core_deposit_pct_input > cap.core_cap_pct;
  const core_deposit_pct_applied = core_capped ? cap.core_cap_pct : core_deposit_pct_input;

  const behavioural_mortgage_prepay_pct = g(positions.behavioural_mortgage_prepay_pct);
  const behavioural_option_addon_required = behavioural_mortgage_prepay_pct > 0;

  const compliance_flags = [];
  compliance_flags.push('IRRBB_STANDARDISED_MAPPED');
  if (core_capped) compliance_flags.push('IRRBB_NMD_CORE_CAPPED');
  if (behavioural_option_addon_required) compliance_flags.push('IRRBB_BEHAVIOURAL_ADDON_REQUIRED');

  return {
    output_payload: {
      deposit_category,
      core_deposit_pct_input,
      core_deposit_pct_applied,
      core_capped,
      maturity_cap_years: cap.maturity_cap_years,
      behavioural_mortgage_prepay_pct,
      behavioural_option_addon_required,
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
