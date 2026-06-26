import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-123-c2pa-manifest-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'validate_c2pa_manifest',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

// C2PA 2.x: a valid manifest carries a well-formed claim, >=1 hard-binding hash
// assertion (covers the asset bytes), and a referenced claim signature.
// Agent decodes the JUMBF/binary manifest (e.g. c2patool) and passes the JSON;
// this kernel validates the extracted structure deterministically. Zero network.
export async function compute(pp) {
  const { claim = {}, assertions = [], signature = {}, claim_generator } = pp;

  const labels = Array.isArray(assertions) ? assertions.map(a => a && a.label).filter(Boolean) : [];
  const has_hard_binding = labels.includes('c2pa.hash.data') || labels.includes('c2pa.hash.bmff');
  const has_actions = labels.some(l => l === 'c2pa.actions' || l === 'c2pa.actions.v2');
  const claim_well_formed =
    typeof claim_generator === 'string' && claim_generator.length > 0 &&
    typeof claim.format === 'string' && typeof claim.instanceID === 'string';
  const sig_ref_present = !!signature && (signature.present === true || typeof signature.alg === 'string');

  const missing_elements = [];
  if (!claim_well_formed) missing_elements.push('CLAIM_GENERATOR_FORMAT_OR_INSTANCEID');
  if (!has_hard_binding)  missing_elements.push('HARD_BINDING_HASH_ASSERTION');
  if (!sig_ref_present)   missing_elements.push('CLAIM_SIGNATURE_REFERENCE');

  const manifest_valid = missing_elements.length === 0;

  const compliance_flags = { C2PA_MANIFEST_ASSESSED: true };
  compliance_flags[manifest_valid ? 'C2PA_MANIFEST_VALID' : 'C2PA_MANIFEST_INVALID'] = true;
  if (!has_actions) compliance_flags.NO_ACTIONS_ASSERTION = true;

  const output_payload = {
    manifest_valid,
    has_hard_binding,
    has_actions,
    assertion_count: labels.length,
    missing_elements,
  };
  return { output_payload, compliance_flags };
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
