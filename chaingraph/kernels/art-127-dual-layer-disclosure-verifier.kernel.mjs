import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-127-dual-layer-disclosure-verifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'verify_dual_layer_disclosure',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

export async function compute(pp) {
  const { c2pa_metadata_present, watermark_present, watermark_method } = pp;
  const WATERMARK_METHODS = ['synthid', 'digimarc', 'trustmark', 'c2pa.soft_binding', 'other'];
  const layers_present = [];
  if (c2pa_metadata_present === true) layers_present.push('c2pa_signed_metadata');
  if (watermark_present === true) layers_present.push('imperceptible_watermark');
  const method_recognized = typeof watermark_method === 'string' && WATERMARK_METHODS.includes(watermark_method);
  // EU Commission Code of Practice (Art. 50): multi-layer — BOTH layers required.
  const dual_layer_ok = c2pa_metadata_present === true && watermark_present === true;
  const missing_layer = dual_layer_ok ? null
    : (c2pa_metadata_present !== true ? 'c2pa_signed_metadata' : 'imperceptible_watermark');
  const compliance_flags = [];
  compliance_flags.push('DUAL_LAYER_DISCLOSURE_ASSESSED');
  compliance_flags.push(dual_layer_ok ? 'DUAL_LAYER_PRESENT' : 'DUAL_LAYER_INCOMPLETE');
  if (watermark_present === true && !method_recognized) compliance_flags.push('WATERMARK_METHOD_UNRECOGNIZED');
  return {
    output_payload: {
      dual_layer_ok,
      layers_present,
      missing_layer,
      watermark_method: watermark_method ?? null,
      method_recognized,
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
