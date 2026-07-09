import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-132-agent-key-rotation-auditor';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'audit_agent_key_rotation',
  mandate_type: 'compliance_mandate', gpu: false,
};

export async function compute(pp) {
  const { key_created_unix, now_unix, max_key_age_s = 7776000, next_key_present, algorithm } = pp; // 90d default
  const key_age_s = (typeof key_created_unix === 'number' && typeof now_unix === 'number') ? (now_unix - key_created_unix) : null;
  const rotation_due = key_age_s !== null && key_age_s >= max_key_age_s;
  const alg_ok = algorithm === 'ed25519';
  const rotation_posture = (!rotation_due && alg_ok) ? 'HEALTHY'
    : (rotation_due && next_key_present === true) ? 'ROTATION_STAGED' : 'ACTION_REQUIRED';
  const compliance_flags = [];
  compliance_flags.push('KEY_ROTATION_ASSESSED');
  compliance_flags.push('KEY_ROTATION_' + rotation_posture);
  if (!alg_ok) compliance_flags.push('ALGORITHM_NOT_ED25519');
  return { output_payload: { key_age_s, rotation_due, next_key_present: next_key_present === true, alg_ok, rotation_posture }, compliance_flags };
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
