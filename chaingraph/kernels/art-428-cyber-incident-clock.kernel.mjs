/**
 * art-428-cyber-incident-clock.kernel.mjs
 * Wave 70 (Banking OCG program, wave 1) — cyber-incident notification-deadline clock.
 *
 * Given one hash-anchored incident determination timestamp and entity-scope flags, computes
 * three parallel regulatory notification deadlines and shapes a per-obligation decision-tree
 * attestation slot:
 *   1. 36-hour interagency banking-regulator notification (12 CFR 53 (OCC) / 225 (FRB) /
 *      304 (FDIC) — the 2021 Interagency Computer-Security Incident Notification Rule).
 *      Calendar-hour arithmetic; the rule text carries no business-day exception.
 *   2. 4-business-day SEC Form 8-K Item 1.05 notification (17 CFR 249.308; "business day" per
 *      Exchange Act Rule 0-3(a) excludes Saturday, Sunday, and days the SEC is closed).
 *   3. 72-hour NYDFS 23 NYCRR 500.17(a) notification to the Superintendent.
 *
 * DELIBERATE SCOPE LIMIT (documented, not silently assumed): business-day arithmetic here is
 * WEEKENDS-ONLY. No US-federal or SEC-closure holiday calendar is consulted or hardcoded — no
 * such calendar utility exists elsewhere in this kernel tree to reuse (verified against the
 * kernels/ directory at build time), and inventing one is out of this WU's scope. A real SEC
 * closure day that is not a weekend will make this kernel's 8-K deadline one business day EARLY
 * relative to the true regulatory deadline (i.e. conservative, not permissive). This is stated
 * to the user in the tool UI and MUST be read alongside this note.
 *
 * "Rescission petition pending" (Apr 2026) is a POLICY-INPUT ANNOTATION ONLY: it does not
 * change the Item 1.05 math. Item 1.05's four-business-day clock keeps running under the rule
 * as currently in force regardless of a pending petition; the flag exists so callers can attach
 * that legal-status context to the artifact without the kernel silently assuming the rule is
 * suspended (it is not).
 *
 * HA (Human Accountability, BANK-SPEC-HA-1, not yet landed) forward-compatibility: this kernel
 * does NOT embed a mutable approval-record reference inside output_payload (an approval record
 * is a SEPARATE, later-signed artifact that cites this artifact's own execution_hash — embedding
 * a fill-in-later ref here would force a hash change when the approval arrives, defeating the
 * "approval about a sealed artifact" design in BANKING-OCG-BUILD-SPEC.md §1.2). Instead each
 * determination carries a stable `obligation_id`, and — per §22.11's existing, shipped, additive
 * exception vocabulary (`exception_class`, `exception_detail`, `item_state`) — an OPTIONAL
 * `exception` object describing an at-risk/missed deadline as a `business`-class exception ready
 * to route to a human queue. `item_state` follows §22.11's own three-way vocabulary exactly.
 *
 * Complementary to tools/incident-response-runbook-builder.html (this kernel starts the
 * notification clock once a determination is made; the runbook builder shapes the surrounding
 * incident-response process). See art-379 / art-418 for adjacent incident-record composers.
 *
 * Spec: BANKING-OCG-BUILD-SPEC.md §3.5.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-428-cyber-incident-clock';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'compute_cyber_incident_notification_clock', mandate_type: 'attestation_mandate', gpu: false };

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Deterministic, UTC-only day-of-week check (never local-timezone-dependent, so the guest,
// the browser tool, and the Worker agree byte-for-byte). 0 = Sunday, 6 = Saturday.
function isWeekendUtc(ms) {
  const dow = new Date(ms).getUTCDay();
  return dow === 0 || dow === 6;
}

// Adds `n` BUSINESS days (weekends-only exclusion, §-documented above) to a UTC timestamp,
// preserving time-of-day. Walks one calendar day at a time so the result is exact and
// auditable rather than a closed-form approximation.
function addBusinessDaysUtc(ms, n) {
  let t = ms;
  let added = 0;
  while (added < n) {
    t += DAY_MS;
    if (!isWeekendUtc(t)) added += 1;
  }
  return t;
}

function isoOrNull(ms) {
  return ms == null ? null : new Date(ms).toISOString();
}

function parseIsoOrNull(s) {
  if (s == null || s === '') return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

function isWellFormedHash(s) {
  return typeof s === 'string' && /^sha256:[0-9a-f]{64}$/.test(s);
}

// One obligation's full decision-tree attestation slot.
function buildDetermination({
  obligation_id, regulator, statute_citation, applicable,
  deadlineMs, completedAtMs, evaluatedAtMs, extraNote,
}) {
  const deadline_iso = applicable ? isoOrNull(deadlineMs) : null;
  const notification_completed_at = applicable ? isoOrNull(completedAtMs) : null;
  const completed_late = !!(applicable && completedAtMs != null && deadlineMs != null && completedAtMs > deadlineMs);

  let item_state = 'not_applicable';
  let exception = null;
  if (applicable) {
    if (completedAtMs != null) {
      item_state = 'done';
      if (completed_late) {
        exception = {
          exception_class: 'business',
          exception_detail: {
            type: 'business',
            code: 'NOTIFICATION_FILED_AFTER_DEADLINE',
            message: `${obligation_id}: notification recorded at ${isoOrNull(completedAtMs)}, after the ${isoOrNull(deadlineMs)} deadline.`,
          },
          item_state: 'done',
        };
      }
    } else {
      item_state = 'pending_human';
      if (evaluatedAtMs != null && deadlineMs != null && evaluatedAtMs > deadlineMs) {
        exception = {
          exception_class: 'business',
          exception_detail: {
            type: 'business',
            code: 'NOTIFICATION_DEADLINE_MISSED',
            message: `${obligation_id}: deadline ${isoOrNull(deadlineMs)} has passed as of ${isoOrNull(evaluatedAtMs)} with no recorded notification.`,
          },
          item_state: 'pending_human',
        };
      }
    }
  }

  return {
    obligation_id, regulator, statute_citation, applicable,
    deadline_iso, notification_completed_at, completed_late, item_state, exception,
    ha_note: 'Not yet an approval record. Once BANK-SPEC-HA-1 (SPEC.md Human Accountability section) lands, a human reviewer/approver MAY create a separate, signed §1 approval record over this artifact\'s execution_hash + this obligation_id; this kernel does not fabricate or reserve a mutable slot for that record inside its own hashed output.',
    ...(extraNote ? { note: extraNote } : {}),
  };
}

export function compute(pp) {
  const {
    incident_id = '',
    determination_at,
    determination_evidence_hash = null,
    is_bank_holding_company = false,
    is_national_bank = false,
    is_state_member_bank = false,
    sec_reporting_company = false,
    sec_rescission_petition_pending = false,
    nydfs_covered_entity = false,
    banking_notification_completed_at = null,
    sec_8k_filed_at = null,
    nydfs_notification_completed_at = null,
    evaluated_at = null,
  } = pp;

  const detMs = parseIsoOrNull(determination_at);
  const evalMs = parseIsoOrNull(evaluated_at);

  const banking_applicable = !!(is_bank_holding_company || is_national_bank || is_state_member_bank);
  const sec_applicable = !!sec_reporting_company;
  const nydfs_applicable = !!nydfs_covered_entity;

  const banking_deadline_ms = detMs != null && banking_applicable ? detMs + 36 * HOUR_MS : null;
  const sec_deadline_ms = detMs != null && sec_applicable ? addBusinessDaysUtc(detMs, 4) : null;
  const nydfs_deadline_ms = detMs != null && nydfs_applicable ? detMs + 72 * HOUR_MS : null;

  const determinations = [
    buildDetermination({
      obligation_id: 'banking_regulator_36hr',
      regulator: 'OCC (national banks) / FRB (bank holding companies, state member banks) / FDIC (insured state non-member banks): harmonized interagency rule',
      statute_citation: '12 CFR pt. 53 (OCC) / 12 CFR pt. 225 (FRB, Regulation Y) / 12 CFR pt. 304 (FDIC) — Interagency Computer-Security Incident Notification Requirements',
      applicable: banking_applicable,
      deadlineMs: banking_deadline_ms,
      completedAtMs: parseIsoOrNull(banking_notification_completed_at),
      evaluatedAtMs: evalMs,
      extraNote: 'Calendar-hour deadline (36 hours from determination); the rule carries no business-day exception.',
    }),
    buildDetermination({
      obligation_id: 'sec_8k_item_1_05',
      regulator: 'U.S. Securities and Exchange Commission',
      statute_citation: '17 CFR 249.308 (Form 8-K), Item 1.05 (Material Cybersecurity Incidents); "business day" per Exchange Act Rule 0-3(a)',
      applicable: sec_applicable,
      deadlineMs: sec_deadline_ms,
      completedAtMs: parseIsoOrNull(sec_8k_filed_at),
      evaluatedAtMs: evalMs,
      extraNote: sec_rescission_petition_pending
        ? 'A rescission petition against Item 1.05 was pending as of April 2026. That status does NOT suspend the four-business-day filing clock under the rule as currently in force; this note flags the legal-status context without altering the computed deadline.'
        : 'Four-business-day deadline; weekends-only business-day arithmetic (see kernel scope-limit note); no SEC-closure holiday calendar is consulted.',
    }),
    buildDetermination({
      obligation_id: 'nydfs_72hr_500',
      regulator: 'New York State Department of Financial Services',
      statute_citation: '23 NYCRR 500.17(a): Notice of Cybersecurity Incident',
      applicable: nydfs_applicable,
      deadlineMs: nydfs_deadline_ms,
      completedAtMs: parseIsoOrNull(nydfs_notification_completed_at),
      evaluatedAtMs: evalMs,
      extraNote: 'Calendar-hour deadline (72 hours from determination).',
    }),
  ];

  const compliance_flags = [];
  if (banking_applicable) compliance_flags.push('BANKING_36HR_NOTIFICATION_APPLICABLE');
  if (sec_applicable) compliance_flags.push('SEC_8K_ITEM_1_05_APPLICABLE');
  if (nydfs_applicable) compliance_flags.push('NYDFS_72HR_NOTIFICATION_APPLICABLE');
  if (sec_rescission_petition_pending) compliance_flags.push('SEC_ITEM_1_05_RESCISSION_PETITION_PENDING_APR2026');
  for (const d of determinations) {
    if (d.exception && d.exception.exception_detail.code === 'NOTIFICATION_DEADLINE_MISSED') compliance_flags.push(`${d.obligation_id.toUpperCase()}_DEADLINE_MISSED`);
    if (d.completed_late) compliance_flags.push(`${d.obligation_id.toUpperCase()}_FILED_LATE`);
  }
  if (detMs == null) compliance_flags.push('DETERMINATION_TIMESTAMP_MISSING_OR_UNPARSEABLE');

  const determination_evidence_hash_well_formed = determination_evidence_hash == null ? false : isWellFormedHash(determination_evidence_hash);

  const output_payload = {
    incident_id: String(incident_id || ''),
    determination_at: detMs != null ? new Date(detMs).toISOString() : null,
    determination_at_parsed: detMs != null,
    determination_evidence_hash: determination_evidence_hash || null,
    determination_evidence_hash_well_formed,
    evaluated_at: evalMs != null ? new Date(evalMs).toISOString() : null,
    determinations,
    note: 'Deterministic notification-deadline clock over a caller-declared incident determination timestamp. Business-day arithmetic (SEC 8-K leg) is weekends-only; no federal/SEC holiday calendar is applied (see kernel header). This tool computes deadlines and attestation slots; it does not itself transmit, file, or submit any regulatory notification, and it is not legal advice.',
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
