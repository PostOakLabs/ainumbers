import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-418-idv-verification-failure-incident-composer';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'build_idv_verification_incident_record',
  mandate_type: 'compliance_mandate', gpu: false,
};

// IDV-SESSION-BUILD-SPEC.md IS-2: composes a verification-failure / fraud-attempt incident
// record from an IDV/KYC session for fraud teams, regulators, and insurers. Reuses the AU-3
// (art-379 build_agent_incident_record) incident vocabulary/shape per the spec's explicit
// reuse instruction -- one incident vocabulary, not two: the §22.9 signed-failure-receipt
// AR4SI tier vocabulary (affirming / warning / contraindicated) for severity_class, the same
// session_evidence digest shape (otel_span / in_toto_link), the same remediation status
// vocabulary (open / in_progress / resolved), and the same escalation_cross_link shape
// (hash SHAPE checked, never fetched or cryptographically verified).
//
// Evidence fence (copy everywhere): this attests the incident RECORD as declared by the
// caller from an IDV/KYC session -- never a fraud-detection system, never a determination
// of fault, never a regulatory or insurance adjudication. Every output carries record_note
// making that explicit. session_receipt is a cross-link (hash SHAPE only) to the art-359
// build_idv_session_receipt artifact, not a re-verification of it.

const FAILURE_TYPES = new Set(['injection_detected', 'liveness_failed', 'document_mismatch', 'device_anomaly', 'other']);
const SEVERITY_CLASSES = new Set(['affirming', 'warning', 'contraindicated']);
const REMEDIATION_STATUSES = new Set(['open', 'in_progress', 'resolved']);
const EVIDENCE_TYPES = new Set(['otel_span', 'in_toto_link']);
const HASH_RE = /^(sha256:)?[0-9a-f]{16,}$/i;

function isHashShaped(v) {
  return typeof v === 'string' && HASH_RE.test(v);
}

export function compute(pp) {
  const receiptIn = (pp && typeof pp.session_receipt === 'object' && pp.session_receipt) || {};
  const session_id = typeof receiptIn.session_id === 'string' && receiptIn.session_id ? receiptIn.session_id : null;
  const verifier_id = typeof receiptIn.verifier_id === 'string' ? receiptIn.verifier_id : null;
  const receipt_hash_raw = typeof receiptIn.receipt_hash === 'string' ? receiptIn.receipt_hash : null;
  const receipt_hash_well_formed = receipt_hash_raw !== null && isHashShaped(receipt_hash_raw);
  const session_receipt = {
    session_id, verifier_id,
    receipt_hash: receipt_hash_raw,
    receipt_hash_well_formed,
  };
  const session_receipt_missing = session_id === null || receipt_hash_raw === null;

  const failureIn = (pp && typeof pp.failure_classification === 'object' && pp.failure_classification) || {};
  const declaredType = typeof failureIn.failure_type === 'string' ? failureIn.failure_type : null;
  const failure_type_coerced = !FAILURE_TYPES.has(declaredType);
  const failure_type = failure_type_coerced ? 'other' : declaredType;
  const declaredSeverity = typeof failureIn.severity_class === 'string' ? failureIn.severity_class : null;
  const severity_coerced = !SEVERITY_CLASSES.has(declaredSeverity);
  const severity_class = severity_coerced ? 'warning' : declaredSeverity;
  const failure_classification = {
    incident_id: typeof failureIn.incident_id === 'string' ? failureIn.incident_id : null,
    failure_type,
    failure_type_coerced_from_unknown_type: failure_type_coerced,
    description: typeof failureIn.description === 'string' ? failureIn.description : null,
    severity_class,
    severity_coerced_from_forbidden_class: severity_coerced,
    detected_at: typeof failureIn.detected_at === 'string' ? failureIn.detected_at : null,
  };

  const evidenceIn = Array.isArray(pp && pp.session_evidence) ? pp.session_evidence : [];
  const session_evidence = [];
  let invalid_evidence_count = 0;
  for (const e of evidenceIn) {
    const evidence_type = e && typeof e.evidence_type === 'string' ? e.evidence_type : null;
    const digest = e && typeof e.digest === 'string' ? e.digest : null;
    if (evidence_type && EVIDENCE_TYPES.has(evidence_type) && digest) {
      session_evidence.push({ evidence_type, digest });
    } else {
      invalid_evidence_count += 1;
    }
  }

  const remediationIn = (pp && typeof pp.remediation === 'object' && pp.remediation) || {};
  const declaredStatus = typeof remediationIn.status === 'string' ? remediationIn.status : null;
  const remediation_status_coerced = !REMEDIATION_STATUSES.has(declaredStatus);
  const remediation = {
    status: remediation_status_coerced ? 'open' : declaredStatus,
    status_coerced_from_forbidden_class: remediation_status_coerced,
    notes: typeof remediationIn.notes === 'string' ? remediationIn.notes : null,
  };

  const crossLinkIn = (pp && typeof pp.escalation_cross_link === 'object' && pp.escalation_cross_link) || {};
  const escalation_record_hash_raw = typeof crossLinkIn.escalation_record_hash === 'string' ? crossLinkIn.escalation_record_hash : null;
  const failure_receipt_hash_raw = typeof crossLinkIn.failure_receipt_hash === 'string' ? crossLinkIn.failure_receipt_hash : null;
  const escalation_record_hash_well_formed = escalation_record_hash_raw !== null && isHashShaped(escalation_record_hash_raw);
  const failure_receipt_hash_well_formed = failure_receipt_hash_raw !== null && isHashShaped(failure_receipt_hash_raw);
  const escalation_cross_link = {
    escalation_record_hash: escalation_record_hash_raw,
    escalation_record_hash_well_formed,
    failure_receipt_hash: failure_receipt_hash_raw,
    failure_receipt_hash_well_formed,
  };
  const cross_linked = escalation_record_hash_raw !== null || failure_receipt_hash_raw !== null;
  const cross_link_malformed = (escalation_record_hash_raw !== null && !escalation_record_hash_well_formed) ||
    (failure_receipt_hash_raw !== null && !failure_receipt_hash_well_formed);

  const evidence_count = session_evidence.length;
  const record_claim_strength = session_receipt_missing
    ? 'insufficient'
    : (evidence_count === 0 ? 'declared-only' : 'evidence-backed');

  const output_payload = {
    session_receipt, failure_classification, session_evidence, evidence_count,
    invalid_evidence_count, remediation, escalation_cross_link, cross_linked,
    record_claim_strength,
    record_note: 'This is a verification-failure incident evidence record for an IDV/KYC session incident the caller declares; not a fraud-detection system, not a determination of fault, and not a regulatory or insurance adjudication.',
  };

  const compliance_flags = [
    'IS2_INCIDENT_RECORD_ASSEMBLED',
    session_receipt_missing ? 'IS2_SESSION_RECEIPT_LINK_MISSING' : null,
    (receipt_hash_raw !== null && !receipt_hash_well_formed) ? 'IS2_SESSION_RECEIPT_HASH_MALFORMED' : null,
    failure_type_coerced ? 'IS2_FAILURE_TYPE_COERCED' : null,
    severity_coerced ? 'IS2_SEVERITY_CLASS_COERCED' : null,
    remediation_status_coerced ? 'IS2_REMEDIATION_STATUS_COERCED' : null,
    invalid_evidence_count > 0 ? 'IS2_INVALID_EVIDENCE_DROPPED' : null,
    cross_linked ? 'IS2_ESCALATION_CROSS_LINK_PRESENT' : null,
    cross_link_malformed ? 'IS2_ESCALATION_CROSS_LINK_MALFORMED' : null,
  ].filter(Boolean);

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.4/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
