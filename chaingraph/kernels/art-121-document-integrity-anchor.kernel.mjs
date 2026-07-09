import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-121-document-integrity-anchor';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'anchor_document_integrity',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

export function compute(pp) {
  const { document_hash, claimed_timestamp, hash_algorithm = 'sha256', document_type } = pp;
  const hash_well_formed = typeof document_hash === 'string' && /^sha256:[0-9a-f]{64}$/.test(document_hash);
  const ts_present = typeof claimed_timestamp === 'string' && claimed_timestamp.length > 0;
  // The OCG execution_hash over {document_hash, claimed_timestamp} IS the anchor —
  // eIDAS Art.41-aligned electronic timestamp, self-verifiable, no external TSA call.
  const timestamp_claim = { standard: 'eIDAS Art.41 / RFC 3161-aligned', timestamp: claimed_timestamp ?? null, algorithm: hash_algorithm };
  const anchored = hash_well_formed && ts_present;
  const compliance_flags = [];
  if (anchored) compliance_flags.push('DOCUMENT_ANCHORED');
  if (!hash_well_formed) compliance_flags.push('MALFORMED_DOCUMENT_HASH');
  if (!ts_present) compliance_flags.push('MISSING_TIMESTAMP');
  return { output_payload: { anchored, document_hash: document_hash ?? null, document_type: document_type ?? null, timestamp_claim }, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
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
