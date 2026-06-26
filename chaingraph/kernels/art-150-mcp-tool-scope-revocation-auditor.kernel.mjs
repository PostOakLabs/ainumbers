import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-150-mcp-tool-scope-revocation-auditor';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'audit_mcp_tool_scope_revocation',
  mandate_type: 'compliance_mandate', gpu: false,
};

// New MCP spec scoped + revocable tool access: each grant carries an explicit scope array,
// a revocation endpoint is configured, and token rotation posture is healthy.
export function compute(pp) {
  const { tool_grants = [], revocation_endpoint, token_created_unix, now_unix, max_token_age_s = 3600, next_token_present } = pp;
  const grants = Array.isArray(tool_grants) ? tool_grants : [];
  const ungated = grants.filter(g => !(g && Array.isArray(g.scopes) && g.scopes.length > 0)).map((g, i) => g && g.tool || ('#' + i));
  const revocable = typeof revocation_endpoint === 'string' && /^https?:\/\//.test(revocation_endpoint);
  const age = (Number.isFinite(Number(token_created_unix)) && Number.isFinite(Number(now_unix)))
    ? Number(now_unix) - Number(token_created_unix) : null;
  const rotation_due = age !== null && age > max_token_age_s;
  const rotation_ok = !rotation_due || next_token_present === true;
  const scopes_ok = grants.length > 0 && ungated.length === 0;
  const audit_pass = scopes_ok && revocable && rotation_ok;
  const compliance_flags = { MCP_SCOPE_REVOCATION_ASSESSED: true };
  compliance_flags[audit_pass ? 'SCOPE_REVOCATION_HEALTHY' : 'SCOPE_REVOCATION_GAPS'] = true;
  if (!revocable) compliance_flags.NO_REVOCATION_ENDPOINT = true;
  if (rotation_due && next_token_present !== true) compliance_flags.TOKEN_ROTATION_OVERDUE = true;
  return { output_payload: { audit_pass, scopes_ok, revocable, rotation_ok, ungated_tools: ungated, token_age_s: age }, compliance_flags };
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
