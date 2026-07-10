import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-116-product-lineage-builder';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'build_product_lineage',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

export function compute(pp) {
  const { product_id, stages = [] } = pp; // [{stage, supplier_hash, certification, dataVersion, carbon_value}]
  const lineage = [];
  let total_carbon = 0;
  let broken = false;
  stages.forEach((s, i) => {
    const anchored = typeof s.supplier_hash === 'string' && s.supplier_hash.startsWith('sha256:');
    if (!anchored) broken = true;
    total_carbon += Number(s.carbon_value) || 0;
    lineage.push({ depth: i, stage: s.stage, anchored, certification: s.certification ?? null, dataVersion: s.dataVersion ?? null });
  });
  // round deterministically to avoid float drift in the hash preimage
  total_carbon = Math.round(total_carbon * 1e6) / 1e6;
  const compliance_flags = [];
  compliance_flags.push('PRODUCT_LINEAGE_BUILT');
  compliance_flags.push(broken ? 'LINEAGE_UNANCHORED_STAGE' : 'LINEAGE_FULLY_ANCHORED');
  return { output_payload: { product_id: product_id ?? null, lineage, total_carbon, depth: stages.length }, compliance_flags };
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
