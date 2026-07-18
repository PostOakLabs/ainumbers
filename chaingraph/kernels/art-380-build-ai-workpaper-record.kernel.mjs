import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-380-build-ai-workpaper-record';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'build_ai_workpaper_record',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Composes a documentation-element workpaper record from an EXISTING OCG
// receipt (referenced by tool identity + execution_hash + kernel digest,
// never re-embedding the receipt's own inputs/outputs) plus a reviewer
// sign-off statement and engagement metadata. Maps to the six elements firms
// must document under amended AU-C 500 / PCAOB guidance for AI/technology-
// assisted audit evidence: tool identity, inputs, outputs, limitations,
// sign-off, and (via chain) linkage to prior workpapers.
//
// This kernel produces an EVIDENCE FORMAT, not an audit opinion. It never
// claims PCAOB/AICPA endorsement or compliance sufficiency; the permitted
// framing is that the record is designed to satisfy documentation elements
// of the cited standard. Sign-off here is a DECLARED reviewer role and
// statement, not a cryptographic signature — an OPTIONAL section-16
// eddsa-jcs-2022 signature on the emitted artifact (same shipped export/
// proof-binding machinery used by art-277's acceptance receipt) is what
// turns a declared sign-off into a countersigned record; this kernel only
// assembles the deterministic record.

const HEX64 = /^[0-9a-f]{64}$/;
const SHA256_PREFIXED = /^sha256:[0-9a-f]{64}$/;
// SPEC.md §24.6 defines four classes: bit-exact, replayable, seeded-stochastic,
// estimated. 'deterministic' is pre-existing drift (never a §24.6 value) kept
// here because a shipped fixture already carries a receipt declaring it
// (ART371-CLASS-RELOCATE row: retiring it is a separate call, not this WU's).
const VALID_DETERMINISM_CLASSES = ['bit-exact', 'replayable', 'seeded-stochastic', 'estimated', 'deterministic'];

function _str(v) { return typeof v === 'string' ? v : ''; }

export function compute(pp) {
  pp = pp || {};
  const checks = [];

  const receipt_tool_id = _str(pp.receipt_tool_id).trim();
  const receipt_tool_version = _str(pp.receipt_tool_version).trim();
  const receipt_execution_hash = _str(pp.receipt_execution_hash).trim().toLowerCase();
  const receipt_kernel_digest = _str(pp.receipt_kernel_digest).trim().toLowerCase();
  const receipt_generated_at = _str(pp.receipt_generated_at).trim();
  const determinism_class = _str(pp.determinism_class).trim();
  const declared_conventions = _str(pp.declared_conventions).trim();
  const documentation_standard_ref = _str(pp.documentation_standard_ref).trim();
  const engagement_id = _str(pp.engagement_id).trim();
  const reporting_period = _str(pp.reporting_period).trim();
  const reviewer_role = _str(pp.reviewer_role).trim();
  const reviewer_statement = _str(pp.reviewer_statement).trim()
    || 'I have reviewed the referenced tool identity, execution hash, and declared limitations for this engagement.';
  const previous_workpaper_hash = _str(pp.previous_workpaper_hash).trim().toLowerCase();

  const toolIdPresent = receipt_tool_id.length > 0;
  checks.push({ check: 'receipt_tool_id_present', pass: toolIdPresent,
    detail: toolIdPresent ? receipt_tool_id : 'receipt_tool_id is required' });

  const toolVersionPresent = receipt_tool_version.length > 0;
  checks.push({ check: 'receipt_tool_version_present', pass: toolVersionPresent,
    detail: toolVersionPresent ? receipt_tool_version : 'receipt_tool_version is required' });

  const execHashValid = HEX64.test(receipt_execution_hash);
  checks.push({ check: 'receipt_execution_hash_valid', pass: execHashValid,
    detail: execHashValid ? 'ok' : 'receipt_execution_hash must be a 64-char lowercase hex SHA-256' });

  const kernelDigestValid = SHA256_PREFIXED.test(receipt_kernel_digest);
  checks.push({ check: 'receipt_kernel_digest_valid', pass: kernelDigestValid,
    detail: kernelDigestValid ? 'ok' : 'receipt_kernel_digest must be "sha256:" followed by 64-char lowercase hex' });

  const determinismValid = VALID_DETERMINISM_CLASSES.includes(determinism_class);
  checks.push({ check: 'determinism_class_valid', pass: determinismValid,
    detail: determinismValid ? determinism_class : 'determinism_class must be one of: ' + VALID_DETERMINISM_CLASSES.join(', ') });

  const conventionsPresent = declared_conventions.length > 0;
  checks.push({ check: 'declared_conventions_present', pass: conventionsPresent,
    detail: conventionsPresent ? declared_conventions : 'declared_conventions is required' });

  const standardRefPresent = documentation_standard_ref.length > 0;
  checks.push({ check: 'documentation_standard_ref_present', pass: standardRefPresent,
    detail: standardRefPresent ? documentation_standard_ref : 'documentation_standard_ref is required' });

  const engagementIdPresent = engagement_id.length > 0;
  checks.push({ check: 'engagement_id_present', pass: engagementIdPresent,
    detail: engagementIdPresent ? engagement_id : 'engagement_id is required' });

  const reviewerRolePresent = reviewer_role.length > 0;
  checks.push({ check: 'reviewer_role_present', pass: reviewerRolePresent,
    detail: reviewerRolePresent ? reviewer_role : 'reviewer_role is required' });

  const prevHashOk = previous_workpaper_hash === '' || HEX64.test(previous_workpaper_hash);
  checks.push({ check: 'previous_workpaper_hash_valid_if_present', pass: prevHashOk,
    detail: prevHashOk ? 'ok' : 'previous_workpaper_hash, if provided, must be a 64-char lowercase hex SHA-256' });

  const allValid = checks.every(c => c.pass);

  const output_payload = {
    tool_identity: allValid ? {
      tool_id: receipt_tool_id, tool_version: receipt_tool_version, kernel_digest: receipt_kernel_digest,
    } : null,
    evidence_binding: allValid ? {
      execution_hash: receipt_execution_hash, generated_at: receipt_generated_at || null,
    } : null,
    limitations: allValid ? {
      determinism_class, declared_conventions,
    } : null,
    sign_off: allValid ? { reviewer_role, reviewer_statement } : null,
    engagement: allValid ? { engagement_id, reporting_period: reporting_period || null } : null,
    documentation_standard_ref: allValid ? documentation_standard_ref : null,
    previous_workpaper_hash: allValid && previous_workpaper_hash ? previous_workpaper_hash : null,
    checks,
    zero_pii_notice: 'This record carries no client or personnel identity beyond a declared reviewer role and an engagement identifier the caller controls. Real reviewer identity stays off-platform.',
    disclaimer: 'This is an evidence format, not an audit opinion. It does not assert PCAOB or AICPA endorsement, or that the referenced engagement complies with any standard -- it is designed to satisfy the documentation elements (tool identity, inputs/outputs, limitations, sign-off) described in the cited standard reference. The declared reviewer sign-off becomes a countersigned record only once an OPTIONAL section-16 eddsa-jcs-2022 signature is applied to this emitted artifact.',
  };

  const compliance_flags = ['AI_WORKPAPER_RECORD_BOUND', 'ZERO_PII', 'NOT_AN_AUDIT_OPINION'];
  if (!allValid) compliance_flags.push('WORKPAPER_INPUTS_INVALID');
  if (previous_workpaper_hash) compliance_flags.push('WORKPAPER_CHAIN_REFERENCED');

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
