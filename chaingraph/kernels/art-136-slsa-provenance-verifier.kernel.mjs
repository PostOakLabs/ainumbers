import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-136-slsa-provenance-verifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'verify_slsa_provenance',
  mandate_type: 'compliance_mandate', gpu: false,
};

// SLSA v1 in-toto Statement: _type, predicateType, subject[].digest.sha256, builder.id.
// Deterministic JSON-only; DSSE envelope signature verification is out of scope (no WebCrypto).
export function compute(pp) {
  const { statement = {}, artifact_digest_sha256, claimed_build_level } = pp;
  const type_ok = typeof statement._type === 'string' && statement._type.includes('in-toto.io/Statement');
  const pred_ok = typeof statement.predicateType === 'string' && statement.predicateType.includes('slsa.dev/provenance');
  const subjects = Array.isArray(statement.subject) ? statement.subject : [];
  const subject_digest_match = subjects.some(s => s && s.digest && s.digest.sha256 === artifact_digest_sha256);
  const builder_id = statement.predicate && statement.predicate.runDetails && statement.predicate.runDetails.builder
    ? statement.predicate.runDetails.builder.id : (statement.predicate && statement.predicate.builder ? statement.predicate.builder.id : undefined);
  const builder_id_present = typeof builder_id === 'string' && builder_id.length > 0;
  const lvl = Number(claimed_build_level);
  const slsa_build_level = (Number.isInteger(lvl) && lvl >= 0 && lvl <= 3) ? lvl : null;
  const provenance_valid = type_ok && pred_ok && subject_digest_match && builder_id_present;
  const compliance_flags = { SLSA_PROVENANCE_ASSESSED: true };
  compliance_flags[provenance_valid ? 'SLSA_PROVENANCE_VALID' : 'SLSA_PROVENANCE_INVALID'] = true;
  if (!subject_digest_match) compliance_flags.SUBJECT_DIGEST_MISMATCH = true;
  return { output_payload: { provenance_valid, type_ok, pred_ok, subject_digest_match, builder_id_present, slsa_build_level }, compliance_flags };
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
