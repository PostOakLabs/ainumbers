import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-119-traceability-lot-code-linker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'link_traceability_lot_code',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

export function compute(pp) {
  const { events = [] } = pp; // ordered: [{cte, tlc, prev_tlc, location_gln, date}]
  const lineage = [];
  const breaks = [];
  events.forEach((e, i) => {
    const linked = i === 0 ? true : e.prev_tlc === events[i - 1].tlc;
    const is_transformation = e.cte === 'transformation';
    if (!linked && !is_transformation) breaks.push({ index: i, tlc: e.tlc, expected_prev: events[i-1]?.tlc, got: e.prev_tlc });
    lineage.push({ step: i, cte: e.cte, tlc: e.tlc, linked, new_lot_minted: is_transformation });
  });
  const compliance_flags = { TLC_LINEAGE_ASSESSED: true };
  compliance_flags[breaks.length === 0 ? 'TLC_LINEAGE_INTACT' : 'TLC_LINEAGE_BROKEN'] = true;
  return { output_payload: { lineage, breaks, depth: events.length }, compliance_flags };
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
