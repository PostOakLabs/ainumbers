import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-105-mica-token-service-scoper';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'scope_mica_token_and_service',
  mandate_type: 'agent_guardrail_mandate',
  gpu: false,
};

export function compute(pp) {
  const { inputs = {} } = pp;
  const {
    token_type = 'other',
    activity = 'service',
  } = inputs;

  const is_art_emt = token_type === 'art' || token_type === 'emt';
  const delegated_to_existing = is_art_emt && activity === 'issuance';

  let classification;
  let route_target;
  let rationale;

  if (is_art_emt && activity === 'issuance') {
    classification = 'ART/EMT Issuer Route';
    route_target = 'existing-stablecoin-chains';
    rationale =
      'ART/EMT issuance is governed by Title III (EMT) and Title IV (ART) of MiCA. Authorisation requirements, reserve obligations, and whitepaper rules differ from the CASP service track. Delegate to existing stablecoin reserve and reserve-stress chains.';
  } else if (is_art_emt && activity === 'service') {
    classification = 'ART/EMT Token + CASP Service';
    route_target = 'wave20-mica-chains';
    rationale =
      'Providing crypto-asset services over ART/EMT tokens falls under Title V CASP licensing. The token issuer authorisation and CASP service authorisation are separate tracks under MiCA. Wave 20 chains apply for CASP service assessment.';
  } else if (is_art_emt && activity === 'both') {
    classification = 'ART/EMT Dual Route';
    route_target = 'both';
    rationale =
      'Dual-track: ART/EMT issuance requires Title III/IV authorisation; CASP services over those tokens require Title V CASP authorisation. Both tracks apply concurrently.';
  } else if ((token_type === 'other' || token_type === 'utility') && activity === 'issuance') {
    classification = 'Other/Utility Token Issuance';
    route_target = 'national-rules-check';
    rationale =
      'Other crypto-assets and utility tokens not qualifying as EMT or ART fall under Title II of MiCA. Some exemptions apply (e.g. utility tokens, small offers). National competent authority rules may also apply. Check NCA guidance before proceeding.';
  } else if ((token_type === 'other' || token_type === 'utility') && activity === 'service') {
    classification = 'CASP Service Route';
    route_target = 'wave20-mica-chains';
    rationale =
      'Providing crypto-asset services over other/utility tokens falls under Title V CASP licensing. Wave 20 chains cover CASP authorisation, transitional periods, MAR surveillance, and travel rule compliance.';
  } else {
    // other/utility + both (or fallback)
    classification = 'CASP Dual Route';
    route_target = 'wave20-mica-chains';
    rationale =
      'Other/utility token issuance (Title II) combined with CASP services (Title V) — both tracks apply. Wave 20 chains cover the CASP service dimension; verify Title II exemption eligibility separately.';
  }

  const compliance_flags = [];
  if (delegated_to_existing) {
    compliance_flags.push('ART_EMT_ROUTE_EXISTING');
  } else {
    compliance_flags.push('CASP_SERVICE_ROUTE_WAVE20');
  }

  const output_payload = {
    classification,
    route_target,
    delegated_to_existing,
    existing_chains_delegated: delegated_to_existing
      ? [
          'stablecoin-reserve-stress',
          'mica-reserve-stress',
          'classify_digital_asset_regulatory',
        ]
      : [],
    wave20_chains_applicable: !delegated_to_existing
      ? [
          'mica-casp-authorization',
          'mica-transitional',
          'mica-whitepaper',
          'mica-mar-surveillance',
          'mica-travel-rule',
        ]
      : [],
    rationale,
    mica_note:
      'MiCA Reg. (EU) 2023/1114: Title III = EMT issuers, Title IV = ART issuers, Title V = CASP service providers. Different licensing tracks.',
    reference_version: '2026-06',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(
  pp,
  { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}
) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    compute_mode: 'server',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    audit_signature: {
      payloadType: 'application/vnd.openchain.graph+json;version=0.4',
      payload: '',
      signatures: [],
    },
  };
}
