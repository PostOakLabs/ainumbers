import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-151-agent-obo-mandate-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_agent_obo_mandate',
  mandate_type: 'compliance_mandate', gpu: false,
};

// On-behalf-of (OBO) mandate: subject, bounded scope, intent, and non-expired validity window.
// now_unix is caller-supplied (no clock reads). Aligns with AP2 mandate-chain pattern (art-01).
export function compute(pp) {
  const { mandate = {}, now_unix } = pp;
  const has_subject = typeof mandate.subject === 'string' && mandate.subject.length > 0;
  const has_intent  = typeof mandate.intent === 'string' && mandate.intent.length > 0;
  const scopes = Array.isArray(mandate.scope) ? mandate.scope : [];
  const has_scope = scopes.length > 0;
  const exp = Number(mandate.valid_until_unix);
  const not_expired = Number.isFinite(exp) && Number.isFinite(Number(now_unix)) ? Number(now_unix) <= exp : (mandate.valid_until_unix == null ? false : true);
  const verdict = (has_subject && has_intent && has_scope && not_expired) ? 'ACCEPT' : 'REFUSE';
  const gaps = [];
  if (!has_subject) gaps.push('SUBJECT');
  if (!has_intent) gaps.push('INTENT');
  if (!has_scope) gaps.push('SCOPE');
  if (!not_expired) gaps.push('EXPIRED_OR_NO_VALIDITY');
  const compliance_flags = [];
  compliance_flags.push('AGENT_OBO_MANDATE_ASSESSED');
  compliance_flags.push(verdict === 'ACCEPT' ? 'OBO_MANDATE_VALID' : 'OBO_MANDATE_REFUSED');
  return { output_payload: { verdict, has_subject, has_intent, has_scope, not_expired, gaps }, compliance_flags };
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
