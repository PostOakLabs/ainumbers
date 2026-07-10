import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-157-emir-lifecycle-event-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_emir_lifecycle_event',
  mandate_type: 'compliance_mandate', gpu: false,
};

export function compute(pp) {
  const { action_type, prior_state } = pp; // prior_state: 'none' | 'open' | 'terminated'
  // Legal action vs prior reported state for this UTI.
  const LEGAL = {
    'none':       ['New', 'Position'],
    'open':       ['Modify', 'Correct', 'Valuation', 'Terminate', 'Error'],
    'terminated': ['Revive', 'Correct', 'Error'],
  };
  const allowed = LEGAL[prior_state] || [];
  const action_legal = allowed.includes(action_type);

  const compliance_flags = [];
  compliance_flags.push('EMIR_LIFECYCLE_ASSESSED');
  compliance_flags.push(action_legal ? 'EMIR_LIFECYCLE_VALID' : 'EMIR_LIFECYCLE_INVALID');
  if (!action_legal && action_type === 'New' && prior_state === 'open') compliance_flags.push('DUPLICATE_NEW_ON_OPEN_UTI');
  if (!action_legal && (action_type === 'Modify' || action_type === 'Correct') && prior_state === 'none') compliance_flags.push('MODIFY_WITHOUT_PRIOR');

  return {
    output_payload: {
      action_legal,
      action_type: action_type ?? null,
      prior_state: prior_state ?? null,
      allowed,
    },
    compliance_flags,
  };
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
