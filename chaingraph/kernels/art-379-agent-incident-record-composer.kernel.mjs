import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-379-agent-incident-record-composer';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'build_agent_incident_record',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Scope correction (AU-3 board row, Standing Order #22): the spec text says to
// reuse VERDICT-1's failure-receipt shape if landed. VERDICT-1 (a normative
// §VERDICT-1 IETF RATS EAR/AR4SI trustworthiness-vector addition) has NOT
// landed -- grep of SPEC.md confirms no §VERDICT-1 section exists; it is
// SPEC-TICK material batched for v0.8.8, not a shipped structure. This kernel
// therefore does NOT reference VERDICT-1. It reuses only what SHIPS today:
// the §22.9 signed-failure-receipt AR4SI tier vocabulary (affirming / warning
// / contraindicated) for incident severity_class, and the §22.8.3 escalation
// record's conditional-presence mandate_hash discipline. Cross-links to a
// §22.8.3 escalation record hash and/or a §22.9 failure receipt hash are
// carried as plain declared data -- this kernel checks their SHAPE
// (well-formed sha256 hex string) deterministically; it does not fetch or
// cryptographically verify the referenced artifact (out of band, same as
// §22.8.5 transport-agnostic escalation records).
//
// Evidence fence (spec copy guard): this is an EVIDENCE FORMAT for an
// incident the user DECLARES -- never an incident-detection system, never a
// determination of fault, never an insurance adjudication. Every output
// carries record_note making that explicit. Inputs are asserted by the
// caller, not independently verified.

const SEVERITY_CLASSES = new Set(['affirming', 'warning', 'contraindicated']);
const REMEDIATION_STATUSES = new Set(['open', 'in_progress', 'resolved']);
const EVIDENCE_TYPES = new Set(['otel_span', 'in_toto_link']);
const HASH_RE = /^(sha256:)?[0-9a-f]{16,}$/i;

function isHashShaped(v) {
  return typeof v === 'string' && HASH_RE.test(v);
}

export function compute(pp) {
  const identityIn = (pp && typeof pp.agent_identity === 'object' && pp.agent_identity) || {};
  const agent_id = typeof identityIn.agent_id === 'string' && identityIn.agent_id ? identityIn.agent_id : null;
  const agent_identity = {
    agent_id,
    agent_version: typeof identityIn.agent_version === 'string' ? identityIn.agent_version : null,
  };
  const agent_identity_missing = agent_id === null;

  const mandate_hash = pp && typeof pp.mandate_hash === 'string' ? pp.mandate_hash : null;

  const incidentIn = (pp && typeof pp.incident === 'object' && pp.incident) || {};
  const declaredSeverity = typeof incidentIn.severity_class === 'string' ? incidentIn.severity_class : null;
  const severity_coerced = !SEVERITY_CLASSES.has(declaredSeverity);
  const severity_class = severity_coerced ? 'warning' : declaredSeverity;
  const incident = {
    incident_id: typeof incidentIn.incident_id === 'string' ? incidentIn.incident_id : null,
    description: typeof incidentIn.description === 'string' ? incidentIn.description : null,
    severity_class,
    severity_coerced_from_forbidden_class: severity_coerced,
    detected_at: typeof incidentIn.detected_at === 'string' ? incidentIn.detected_at : null,
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
  const record_claim_strength = agent_identity_missing
    ? 'insufficient'
    : (evidence_count === 0 ? 'declared-only' : 'evidence-backed');

  const output_payload = {
    agent_identity, mandate_hash, incident, session_evidence, evidence_count,
    invalid_evidence_count, remediation, escalation_cross_link, cross_linked,
    record_claim_strength,
    record_note: 'This is an incident evidence record for an incident the caller declares; not an incident-detection system, not a determination of fault, and not an insurance adjudication.',
  };

  const compliance_flags = [
    'AU3_INCIDENT_RECORD_ASSEMBLED',
    agent_identity_missing ? 'AU3_AGENT_IDENTITY_MISSING' : null,
    severity_coerced ? 'AU3_SEVERITY_CLASS_COERCED' : null,
    remediation_status_coerced ? 'AU3_REMEDIATION_STATUS_COERCED' : null,
    invalid_evidence_count > 0 ? 'AU3_INVALID_EVIDENCE_DROPPED' : null,
    cross_linked ? 'AU3_ESCALATION_CROSS_LINK_PRESENT' : null,
    cross_link_malformed ? 'AU3_ESCALATION_CROSS_LINK_MALFORMED' : null,
    mandate_hash !== null ? 'AU3_MANDATE_BOUND' : null,
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
