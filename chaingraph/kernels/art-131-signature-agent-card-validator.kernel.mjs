import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-131-signature-agent-card-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_signature_agent_card',
  mandate_type: 'compliance_mandate', gpu: false,
};

export async function compute(pp) {
  const { card = {}, directory_keyids = [] } = pp;
  const REQUIRED = ['name', 'operator', 'expected_request_rate', 'keys'];
  const missing_fields = REQUIRED.filter(f => card[f] === undefined || card[f] === null || card[f] === '');
  const card_keyids = Array.isArray(card.keys) ? card.keys.map(k => k && k.kid).filter(Boolean) : [];
  const keys_consistent = card_keyids.length > 0 && card_keyids.every(kid => directory_keyids.includes(kid));
  const card_valid = missing_fields.length === 0 && keys_consistent;
  const compliance_flags = { SIGNATURE_AGENT_CARD_ASSESSED: true };
  compliance_flags[card_valid ? 'AGENT_CARD_VALID' : 'AGENT_CARD_INVALID'] = true;
  if (!keys_consistent) compliance_flags.CARD_KEYS_NOT_IN_DIRECTORY = true;
  return { output_payload: { card_valid, missing_fields, keys_consistent, card_key_count: card_keyids.length }, compliance_flags };
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
