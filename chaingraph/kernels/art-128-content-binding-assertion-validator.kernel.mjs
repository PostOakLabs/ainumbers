import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-128-content-binding-assertion-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'validate_content_binding_assertion',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

export async function compute(pp) {
  const { binding_type, asset_bytes_hash, claimed_hard_binding_hash, soft_binding_identifier_present } = pp;
  const VALID_TYPES = ['hard', 'soft', 'both'];
  const type_valid = VALID_TYPES.includes(binding_type);
  const has_hard = binding_type === 'hard' || binding_type === 'both';
  const has_soft = binding_type === 'soft' || binding_type === 'both';
  const hard_hashes_well_formed =
    typeof asset_bytes_hash === 'string' && /^sha256:[0-9a-f]{64}$/.test(asset_bytes_hash) &&
    typeof claimed_hard_binding_hash === 'string' && /^sha256:[0-9a-f]{64}$/.test(claimed_hard_binding_hash);
  const hard_binding_matches = has_hard && hard_hashes_well_formed && asset_bytes_hash === claimed_hard_binding_hash;
  const soft_binding_present = has_soft && soft_binding_identifier_present === true;
  // Only a matching hard binding is tamper-evident; soft binding survives re-encode but is not tamper-evident.
  const tamper_evident = hard_binding_matches;
  const verdict = tamper_evident ? 'TAMPER_EVIDENT' : (soft_binding_present ? 'SOFT_BINDING_ONLY' : 'UNBOUND');
  const compliance_flags = { CONTENT_BINDING_ASSESSED: true };
  compliance_flags[tamper_evident ? 'HARD_BINDING_VERIFIED' : 'HARD_BINDING_UNVERIFIED'] = true;
  if (!type_valid) compliance_flags.UNRECOGNIZED_BINDING_TYPE = true;
  if (has_hard && hard_hashes_well_formed && !hard_binding_matches) compliance_flags.ASSET_HASH_MISMATCH = true;
  return {
    output_payload: {
      binding_type: binding_type ?? null,
      hard_binding_matches,
      tamper_evident,
      soft_binding_present,
      verdict,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = await compute(pp);
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
