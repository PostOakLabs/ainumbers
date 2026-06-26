import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-130-signature-directory-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_signature_directory',
  mandate_type: 'compliance_mandate', gpu: false,
};

export async function compute(pp) {
  const { directory_jwks = {}, keyid, well_known_path } = pp;
  const keys = Array.isArray(directory_jwks.keys) ? directory_jwks.keys : [];
  const path_ok = well_known_path === '/.well-known/http-message-signatures-directory';
  const all_ed25519 = keys.length > 0 && keys.every(k => k && k.kty === 'OKP' && k.crv === 'Ed25519');
  const matched = keys.find(k => k && (k.kid === keyid));
  const key_found = !!matched;
  const directory_valid = path_ok && all_ed25519 && key_found;
  const compliance_flags = { SIGNATURE_DIRECTORY_ASSESSED: true };
  compliance_flags[directory_valid ? 'SIGNATURE_DIRECTORY_VALID' : 'SIGNATURE_DIRECTORY_INVALID'] = true;
  if (!path_ok) compliance_flags.WELL_KNOWN_PATH_INCORRECT = true;
  if (!key_found) compliance_flags.KEYID_NOT_IN_DIRECTORY = true;
  return { output_payload: { directory_valid, key_found, key_count: keys.length, algorithm_ok: all_ed25519, path_ok }, compliance_flags };
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
