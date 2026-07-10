import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-277-agreement-acceptance-binder';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'bind_agreement_acceptance',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Records a party's acceptance of a SPECIFIC assembled agreement artifact — a
// specific template, at a specific vendored body hash, filled with a specific
// variable map (referenced by its execution_hash, never re-embedded here).
// The optional §16 eddsa-jcs-2022 Proof Binding on the emitted §4 artifact is
// what makes this a countersignable "I accepted THESE exact terms" receipt
// (§8.5 #3) — this kernel only assembles the deterministic acceptance record;
// signing happens through the shipped export/proof-binding machinery, not here.
// Not legal advice. Records a stated acceptance, not legal effect or identity.

const VALID_ROLES = ['party_a', 'party_b'];
const HEX64 = /^[0-9a-f]{64}$/;

function _str(v) { return typeof v === 'string' ? v : ''; }

export function compute(pp) {
  pp = pp || {};
  const checks = [];

  const referenced_execution_hash = _str(pp.referenced_execution_hash).trim().toLowerCase();
  const template_id = _str(pp.template_id).trim();
  const body_sha256 = _str(pp.body_sha256).trim().toLowerCase();
  const accepting_party_role = _str(pp.accepting_party_role).trim();
  const acceptance_statement = _str(pp.acceptance_statement).trim() || 'I accept the referenced agreement at the exact template, body hash, and variable map identified below.';
  const previous_proof_hash = _str(pp.previous_proof_hash).trim().toLowerCase();

  const hashValid = HEX64.test(referenced_execution_hash);
  checks.push({ check: 'referenced_execution_hash_valid', pass: hashValid,
    detail: hashValid ? 'ok' : 'referenced_execution_hash must be a 64-char lowercase hex SHA-256' });

  const bodyHashValid = HEX64.test(body_sha256);
  checks.push({ check: 'body_sha256_valid', pass: bodyHashValid,
    detail: bodyHashValid ? 'ok' : 'body_sha256 must be a 64-char lowercase hex SHA-256' });

  const templateIdPresent = template_id.length > 0;
  checks.push({ check: 'template_id_present', pass: templateIdPresent,
    detail: templateIdPresent ? template_id : 'template_id is required' });

  const roleValid = VALID_ROLES.includes(accepting_party_role);
  checks.push({ check: 'accepting_party_role_valid', pass: roleValid,
    detail: roleValid ? accepting_party_role : 'accepting_party_role must be one of: ' + VALID_ROLES.join(', ') });

  const prevProofOk = previous_proof_hash === '' || HEX64.test(previous_proof_hash);
  checks.push({ check: 'previous_proof_hash_valid_if_present', pass: prevProofOk,
    detail: prevProofOk ? 'ok' : 'previous_proof_hash, if provided, must be a 64-char lowercase hex SHA-256' });

  const allValid = checks.every(c => c.pass);

  const output_payload = {
    accepted_template_id: allValid ? template_id : null,
    accepted_body_sha256: allValid ? body_sha256 : null,
    referenced_execution_hash: allValid ? referenced_execution_hash : null,
    accepting_party_role: allValid ? accepting_party_role : null,
    previous_proof_hash: allValid && previous_proof_hash ? previous_proof_hash : null,
    acceptance_statement: allValid ? acceptance_statement : null,
    checks,
    zero_pii_notice: 'This receipt carries no party identity, only the accepting role and the referenced artifact hashes. Real signer identity stays off-platform.',
    disclaimer: 'Not legal advice. Records a stated acceptance of a specific referenced artifact; it does not itself establish legal effect, identity, or enforceability. An OPTIONAL §16 eddsa-jcs-2022 signature on this artifact turns it into a countersignable receipt.',
  };

  const compliance_flags = ['AGREEMENT_ACCEPTANCE_BOUND', 'ZERO_PII', 'NOT_LEGAL_ADVICE'];
  if (!allValid) compliance_flags.push('ACCEPTANCE_INPUTS_INVALID');
  if (previous_proof_hash) compliance_flags.push('PROOF_CHAIN_REFERENCED');

  return { output_payload, compliance_flags };
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
