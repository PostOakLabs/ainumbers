import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-152-mcp-task-lifecycle-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_mcp_task_lifecycle',
  mandate_type: 'compliance_mandate', gpu: false,
};

// New MCP spec long-running task state machine: working → input_required → completed|failed|cancelled.
// Validates each ordered transition is legal. Terminal stage.
export function compute(pp) {
  const { transitions = [] } = pp;
  const LEGAL = {
    'working': ['working', 'input_required', 'completed', 'failed', 'cancelled'],
    'input_required': ['working', 'cancelled', 'failed'],
    'completed': [], 'failed': [], 'cancelled': [],
  };
  const seq = Array.isArray(transitions) ? transitions : [];
  const illegal = [];
  seq.forEach((t, i) => {
    const allowed = LEGAL[t && t.from];
    if (!allowed || !allowed.includes(t && t.to)) illegal.push({ index: i, from: t && t.from, to: t && t.to });
  });
  const lifecycle_valid = seq.length > 0 && illegal.length === 0;
  const compliance_flags = [];
  compliance_flags.push('MCP_TASK_LIFECYCLE_ASSESSED');
  compliance_flags.push(lifecycle_valid ? 'TASK_LIFECYCLE_VALID' : 'TASK_LIFECYCLE_INVALID');
  return { output_payload: { lifecycle_valid, transition_count: seq.length, illegal_transitions: illegal }, compliance_flags };
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
