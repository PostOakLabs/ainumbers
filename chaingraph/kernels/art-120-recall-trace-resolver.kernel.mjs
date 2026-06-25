import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-120-recall-trace-resolver';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'resolve_recall_trace',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

export function compute(pp) {
  const { contaminated_tlc, direction = 'both', edges = [] } = pp; // edges: [{from_tlc, to_tlc, from_gln, to_gln, date}]
  const sources = [], recipients = [];
  edges.forEach(e => {
    if ((direction === 'back' || direction === 'both') && e.to_tlc === contaminated_tlc)
      sources.push({ tlc: e.from_tlc, gln: e.from_gln, date: e.date });
    if ((direction === 'forward' || direction === 'both') && e.from_tlc === contaminated_tlc)
      recipients.push({ tlc: e.to_tlc, gln: e.to_gln, date: e.date });
  });
  const traced = sources.length + recipients.length;
  const compliance_flags = { RECALL_TRACE_RESOLVED: true };
  if (traced === 0) compliance_flags.NO_LINKED_NODES_FOUND = true;
  return { output_payload: { contaminated_tlc, sources, recipients, traced_count: traced }, compliance_flags };
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
