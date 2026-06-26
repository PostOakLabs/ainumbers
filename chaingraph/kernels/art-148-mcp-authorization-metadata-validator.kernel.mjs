import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-148-mcp-authorization-metadata-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_mcp_authorization_metadata',
  mandate_type: 'compliance_mandate', gpu: false,
};

// RFC 9728 OAuth 2.0 Protected Resource Metadata: resource URI, authorization_servers,
// scopes_supported, bearer_methods_supported must all be present and well-formed.
export function compute(pp) {
  const { metadata = {} } = pp;
  const BEARER = ['header', 'body', 'query'];
  const resource_ok = typeof metadata.resource === 'string' && /^https?:\/\//.test(metadata.resource);
  const auth_servers = Array.isArray(metadata.authorization_servers) ? metadata.authorization_servers : [];
  const scopes = Array.isArray(metadata.scopes_supported) ? metadata.scopes_supported : [];
  const bearer = Array.isArray(metadata.bearer_methods_supported) ? metadata.bearer_methods_supported : [];
  const bearer_ok = bearer.length === 0 || bearer.every(b => BEARER.includes(b));
  const metadata_valid = resource_ok && auth_servers.length > 0 && scopes.length > 0 && bearer_ok;
  const missing = [];
  if (!resource_ok) missing.push('RESOURCE');
  if (auth_servers.length === 0) missing.push('AUTHORIZATION_SERVERS');
  if (scopes.length === 0) missing.push('SCOPES_SUPPORTED');
  if (!bearer_ok) missing.push('BEARER_METHODS_UNRECOGNIZED');
  const compliance_flags = { MCP_AUTH_METADATA_ASSESSED: true };
  compliance_flags[metadata_valid ? 'RFC9728_METADATA_VALID' : 'RFC9728_METADATA_INVALID'] = true;
  return { output_payload: { metadata_valid, resource_ok, auth_server_count: auth_servers.length, scope_count: scopes.length, bearer_ok, missing }, compliance_flags };
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
