import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-122-timestamp-attestation-verifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'verify_timestamp_attestation',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

export function compute(pp) {
  const { document_hash, presented_anchor, presented_timestamp, expected_algorithm = 'sha256' } = pp;
  const hash_match = typeof document_hash === 'string' && presented_anchor &&
                     presented_anchor.document_hash === document_hash;
  const ts_consistent = !!presented_timestamp && presented_anchor &&
                        presented_anchor.timestamp_claim &&
                        presented_anchor.timestamp_claim.timestamp === presented_timestamp;
  const algo_match = presented_anchor && presented_anchor.timestamp_claim &&
                     presented_anchor.timestamp_claim.algorithm === expected_algorithm;
  const verified = !!(hash_match && ts_consistent && algo_match);
  const compliance_flags = [];
  compliance_flags.push('TIMESTAMP_ATTESTATION_ASSESSED');
  compliance_flags.push(verified ? 'TIMESTAMP_VERIFIED' : 'TIMESTAMP_VERIFICATION_FAILED');
  return { output_payload: { verified, hash_match: !!hash_match, ts_consistent: !!ts_consistent, algo_match: !!algo_match }, compliance_flags };
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
