import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-117-product-authenticity-verifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'verify_product_authenticity',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

export function compute(pp) {
  const { product_id, claimed_root_hash, presented_lineage_hashes = [], ownership_transfers = [] } = pp;
  const root_ok = typeof claimed_root_hash === 'string' && claimed_root_hash.startsWith('sha256:');
  const chains_to_root = root_ok && presented_lineage_hashes.length > 0 && presented_lineage_hashes[0] === claimed_root_hash;
  // ownership continuity: each transfer's from == prior transfer's to
  let ownership_continuous = true;
  for (let i = 1; i < ownership_transfers.length; i++) {
    if (ownership_transfers[i].from !== ownership_transfers[i - 1].to) { ownership_continuous = false; break; }
  }
  const authentic = chains_to_root && ownership_continuous;
  const compliance_flags = { AUTHENTICITY_ASSESSED: true };
  compliance_flags[authentic ? 'PRODUCT_AUTHENTIC' : 'PRODUCT_AUTHENTICITY_FAILED'] = true;
  if (!ownership_continuous) compliance_flags.OWNERSHIP_CHAIN_BROKEN = true;
  return { output_payload: { product_id: product_id ?? null, authentic, chains_to_root, ownership_continuous }, compliance_flags };
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
