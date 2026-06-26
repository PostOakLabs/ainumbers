import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-155-emir-upi-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_emir_upi',
  mandate_type: 'compliance_mandate', gpu: false,
};

export function compute(pp) {
  const { upi, asset_class, instrument_type } = pp;
  const ASSET = ['IR', 'CR', 'EQ', 'CO', 'FX'];
  const format_ok = typeof upi === 'string' && /^[A-Z0-9]{12}$/i.test(upi); // ISO 4914 ANNA DSB
  const asset_ok = ASSET.includes(asset_class);
  const classification_consistent = asset_ok && typeof instrument_type === 'string' && instrument_type.length > 0;
  const upi_valid = format_ok && classification_consistent;

  const compliance_flags = { EMIR_UPI_ASSESSED: true };
  compliance_flags[upi_valid ? 'EMIR_UPI_VALID' : 'EMIR_UPI_INVALID'] = true;
  if (!format_ok) compliance_flags.UPI_MALFORMED = true;
  if (!classification_consistent) compliance_flags.UPI_CLASSIFICATION_MISMATCH = true;

  return {
    output_payload: {
      upi_valid,
      format_ok,
      asset_ok,
      classification_consistent,
      asset_class: asset_class ?? null,
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
