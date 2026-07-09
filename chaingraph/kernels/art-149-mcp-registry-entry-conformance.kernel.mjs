import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-149-mcp-registry-entry-conformance';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_mcp_registry_entry',
  mandate_type: 'compliance_mandate', gpu: false,
};

// MCP Registry server.json schema: $schema, reverse-DNS name, semver version,
// at least one of packages/remotes, and _meta well-formedness. Terminal stage.
export function compute(pp) {
  const { entry = {} } = pp;
  const schema_ok = typeof entry.$schema === 'string' && entry.$schema.length > 0;
  const name_ok = typeof entry.name === 'string' && /^[a-z0-9.-]+\/[a-z0-9._-]+$/i.test(entry.name);
  const version_ok = typeof entry.version === 'string' && /^\d+\.\d+\.\d+/.test(entry.version);
  const has_packages = Array.isArray(entry.packages) && entry.packages.length > 0;
  const has_remotes  = Array.isArray(entry.remotes) && entry.remotes.length > 0;
  const has_endpoint = has_packages || has_remotes;
  const entry_valid = schema_ok && name_ok && version_ok && has_endpoint;
  const missing = [];
  if (!schema_ok) missing.push('$schema');
  if (!name_ok) missing.push('NAME_REVERSE_DNS');
  if (!version_ok) missing.push('SEMVER_VERSION');
  if (!has_endpoint) missing.push('PACKAGES_OR_REMOTES');
  const compliance_flags = [];
  compliance_flags.push('MCP_REGISTRY_ENTRY_ASSESSED');
  compliance_flags.push(entry_valid ? 'MCP_REGISTRY_ENTRY_VALID' : 'MCP_REGISTRY_ENTRY_INVALID');
  return { output_payload: { entry_valid, schema_ok, name_ok, version_ok, has_packages, has_remotes, missing }, compliance_flags };
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
