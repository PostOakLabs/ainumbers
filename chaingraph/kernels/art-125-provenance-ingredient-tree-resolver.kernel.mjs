import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-125-provenance-ingredient-tree-resolver';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'resolve_provenance_ingredient_tree',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

export async function compute(pp) {
  const { active_manifest_hash, ingredients = [] } = pp;
  // ingredients: [{ label:'c2pa.ingredient', hashed_uri, nested_manifest_hash, relationship, redacted }]
  const edges = [];
  const broken_edges = [];
  ingredients.forEach((ing, i) => {
    const has_binding = typeof ing.hashed_uri === 'string' && ing.hashed_uri.length > 0;
    const has_nested = typeof ing.nested_manifest_hash === 'string' && ing.nested_manifest_hash.startsWith('sha256:');
    const redacted = ing.redacted === true;
    // a non-redacted parentOf ingredient must carry both a hashed_uri binding and a nested manifest hash
    const resolved = redacted ? true : (has_binding && has_nested);
    if (!resolved) {
      broken_edges.push({
        index: i,
        hashed_uri: ing.hashed_uri ?? null,
        reason: !has_binding ? 'NO_HASHED_URI' : 'NO_NESTED_MANIFEST_HASH',
      });
    }
    edges.push({ index: i, relationship: ing.relationship ?? 'parentOf', resolved, redacted });
  });
  const root_ok = typeof active_manifest_hash === 'string' && active_manifest_hash.startsWith('sha256:');
  const tree_intact = root_ok && broken_edges.length === 0;
  const compliance_flags = [];
  compliance_flags.push('PROVENANCE_TREE_ASSESSED');
  compliance_flags.push(tree_intact ? 'PROVENANCE_TREE_INTACT' : 'PROVENANCE_TREE_BROKEN');
  if (!root_ok) compliance_flags.push('MALFORMED_ACTIVE_MANIFEST_HASH');
  return {
    output_payload: {
      tree_intact,
      depth: ingredients.length,
      edges,
      broken_edges,
      root_ok,
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
