import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-147-mcp-server-identity-attestation-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_mcp_server_identity',
  mandate_type: 'compliance_mandate', gpu: false,
};

// New MCP spec server identity check: a conformant server publishes an identity document with a
// stable subject/issuer + serverInfo, at the well-known path, referencing an attestation. The
// caller supplies the decoded document + a signature-valid boolean (zero network — no fetch/verify).
export function compute(pp) {
  const { identity = {}, well_known_path, signature_valid } = pp;
  const WELL_KNOWN = '/.well-known/mcp-server-identity';
  const path_ok = well_known_path === WELL_KNOWN;
  const has_subject = typeof identity.subject === 'string' && identity.subject.length > 0;
  const has_issuer  = typeof identity.issuer === 'string' && identity.issuer.length > 0;
  const has_server_info = !!(identity.serverInfo && identity.serverInfo.name && identity.serverInfo.version);
  const attested = identity.attestation != null && signature_valid !== false;

  const missing = [];
  if (!path_ok) missing.push('WELL_KNOWN_PATH');
  if (!has_subject) missing.push('SUBJECT');
  if (!has_issuer) missing.push('ISSUER');
  if (!has_server_info) missing.push('SERVER_INFO');
  if (!attested) missing.push('ATTESTATION');
  const identity_valid = missing.length === 0;

  const compliance_flags = [];
  compliance_flags.push('MCP_SERVER_IDENTITY_ASSESSED');
  compliance_flags.push(identity_valid ? 'MCP_SERVER_IDENTITY_VALID' : 'MCP_SERVER_IDENTITY_INVALID');
  if (signature_valid === false) compliance_flags.push('IDENTITY_SIGNATURE_INVALID');

  return { output_payload: { identity_valid, has_subject, has_issuer, has_server_info, attested, missing }, compliance_flags };
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
