import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-134-agent-directory-publish-readiness';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'assess_agent_directory_publish_readiness',
  mandate_type: 'compliance_mandate', gpu: false,
};

export async function compute(pp) {
  const { well_known_path_ok, jwks_reachable, card_complete, rotation_posture_ok, alg_ed25519 } = pp;
  const checks = { well_known_path_ok, jwks_reachable, card_complete, rotation_posture_ok, alg_ed25519 };
  const gaps = Object.entries(checks).filter(([, v]) => v !== true).map(([k]) => k);
  const ready = gaps.length === 0;
  const compliance_flags = { DIRECTORY_PUBLISH_READINESS_ASSESSED: true };
  compliance_flags[ready ? 'DIRECTORY_PUBLISH_READY' : 'DIRECTORY_PUBLISH_NOT_READY'] = true;
  return { output_payload: { ready, gaps }, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = await compute(pp);
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
