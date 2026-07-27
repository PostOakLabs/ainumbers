/**
 * art-491-ro-remediation-closure.kernel.mjs
 * Assurance Waves program (FATCA-RO-BUILD-SPEC.md §1, FATC-K-1) — FATCA/CRS Responsible
 * Officer remediation-closure tracker ahead of the annual certification.
 *
 * Ingests the returned notification set for a certification period (ICMM-style error
 * notifications, CRS status messages -- each a caller-declared notification_id + a
 * caller-declared, published notification_code, per FATCA-RO-BUILD-SPEC.md F3: codes/schemas
 * are pinned policy input, never kernel source) plus the firm's own remediation records
 * (which corrected/resubmitted message closes which notification), and computes:
 *   - per-notification open / closed / overdue status plus a resubmission_linkage naming
 *     which corrected DocRefId closes which notification.
 *   - closure_coverage_pct across the whole notification set.
 *   - a certification-period readiness verdict against the declared cut-off date.
 *
 * DECISION-TREE ATTESTATION SLOT PATTERN REUSED FROM art-428-cyber-incident-clock.kernel.mjs
 * (do not re-derive clock math -- see that kernel's header): each notification gets a stable
 * determination object with the same §22.11 three-way item_state vocabulary (`done` /
 * `pending_human` / `not_applicable`) and an OPTIONAL `exception` object
 * (`exception_class`/`exception_detail`/`item_state`) describing an overdue remediation, ready
 * to route to a human queue. Unlike art-428 (three independent per-obligation hour-clocks from
 * one determination timestamp), this kernel evaluates an array of notifications against ONE
 * declared certification-period cut-off date -- there is no new clock-arithmetic to invent, only
 * the attestation-slot shape, reused as-is.
 *
 * HA (Human Accountability, not yet landed) forward-compatibility: no mutable approval-record
 * reference is embedded inside output_payload; each determination carries a stable
 * notification_id ready to be cited by a later, separately-signed approval record (identical
 * rationale to art-428's ha_note).
 *
 * ⛔ PII: this kernel accepts only notification/remediation identifiers and dates -- no taxpayer
 * data of any kind. Demo fixture ships SYNTHETIC data only (CONTRACT §1.3).
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute() (all timestamps are
 * caller-declared policy_parameters).
 *
 * Spec: FATCA-RO-BUILD-SPEC.md §0 + §1 (FATC-K-1, art-491).
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-491-ro-remediation-closure';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'track_fatca_crs_ro_remediation_closure', mandate_type: 'attestation_mandate', gpu: false };

function parseIsoOrNull(s) {
  if (s == null || s === '') return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}
function isoOrNull(ms) { return ms == null ? null : new Date(ms).toISOString(); }
function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }

function buildDetermination({ notification_id, notification_code, doc_ref_id, closedMs, resubmitted_doc_ref_id, overdue }) {
  const item_state = closedMs != null ? 'done' : 'pending_human';
  const closure_status = closedMs != null ? 'closed' : (overdue ? 'overdue' : 'open');
  let exception = null;
  if (closedMs == null && overdue) {
    exception = {
      exception_class: 'business',
      exception_detail: {
        type: 'business',
        code: 'REMEDIATION_OVERDUE',
        message: `${notification_id}: no remediation recorded and the certification-period cut-off has passed.`,
      },
      item_state: 'pending_human',
    };
  }
  return {
    notification_id,
    notification_code: notification_code || null,
    doc_ref_id: doc_ref_id || null,
    closure_status,
    item_state,
    closed_at: isoOrNull(closedMs),
    resubmission_linkage: closedMs != null ? { resubmitted_doc_ref_id: resubmitted_doc_ref_id || null, resubmitted_at: isoOrNull(closedMs) } : null,
    exception,
    ha_note: 'Not yet an approval record. A human reviewer/approver MAY later create a separate, signed approval record over this artifact\'s execution_hash + this notification_id; this kernel does not fabricate or reserve a mutable slot for that record inside its own hashed output.',
  };
}

export function compute(pp) {
  pp = pp || {};
  const certification_period = typeof pp.certification_period === 'string' ? pp.certification_period : '';
  const cutoffMs = parseIsoOrNull(pp.cutoff_at);
  const evalMs = parseIsoOrNull(pp.evaluated_at);
  const notifications = Array.isArray(pp.notifications) ? pp.notifications : [];
  const remediation_records = Array.isArray(pp.remediation_records) ? pp.remediation_records : [];

  const pastCutoff = cutoffMs != null && evalMs != null && evalMs > cutoffMs;

  const determinations = notifications.map((n) => {
    n = n || {};
    const notification_id = isNonEmptyString(n.notification_id) ? n.notification_id : '';
    const matches = remediation_records
      .filter((r) => r && r.notification_id === notification_id && parseIsoOrNull(r.resubmitted_at) != null)
      .map((r) => ({ ms: parseIsoOrNull(r.resubmitted_at), doc_ref_id: r.resubmitted_doc_ref_id }))
      .sort((a, b) => a.ms - b.ms);
    const earliest = matches.length > 0 ? matches[0] : null;
    return buildDetermination({
      notification_id,
      notification_code: n.notification_code,
      doc_ref_id: n.doc_ref_id,
      closedMs: earliest ? earliest.ms : null,
      resubmitted_doc_ref_id: earliest ? earliest.doc_ref_id : null,
      overdue: pastCutoff,
    });
  });

  const total = determinations.length;
  const closed_count = determinations.filter((d) => d.closure_status === 'closed').length;
  const overdue_count = determinations.filter((d) => d.closure_status === 'overdue').length;
  const open_count = determinations.filter((d) => d.closure_status === 'open').length;
  const closure_coverage_pct = total > 0 ? Math.round((closed_count / total) * 10000) / 100 : null;
  const readiness_verdict = total === 0 ? 'NO_OPEN_NOTIFICATIONS' : (overdue_count === 0 ? 'READY' : 'NOT_READY');

  const compliance_flags = [];
  compliance_flags.push(`FATCA_CRS_RO_READINESS_${readiness_verdict}`);
  if (overdue_count > 0) compliance_flags.push('FATCA_CRS_RO_OVERDUE_NOTIFICATIONS_PRESENT');
  if (cutoffMs == null) compliance_flags.push('FATCA_CRS_RO_CUTOFF_MISSING_OR_UNPARSEABLE');

  const output_payload = {
    certification_period: String(certification_period || ''),
    cutoff_at: isoOrNull(cutoffMs),
    evaluated_at: isoOrNull(evalMs),
    notification_count: total,
    determinations,
    closed_count,
    open_count,
    overdue_count,
    closure_coverage_pct,
    readiness_verdict,
    note: 'Deterministic FATCA/CRS remediation-closure tracker over a caller-declared notification set + remediation records, evaluated against one declared certification-period cut-off date. Reuses the art-428-cyber-incident-clock decision-tree attestation-slot pattern (item_state/exception vocabulary); no notification-clock arithmetic is invented here. This tool tracks closure and computes a readiness verdict only; it does not itself submit, transmit, or file anything, and it is not legal or tax advice.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null, execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
