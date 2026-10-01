/**
 * art-467-dora-incident-classifier.kernel.mjs
 * DORA-CLOCK-REPAIR-1 (REVERSED D split, ruling 2026-10-01) — DORA major-incident
 * REPORTING-CLOCK kernel: the 2025/301 report-stage deadline schedule, computed
 * deterministically from caller-declared stage timestamps.
 *
 * AUTHORITY (correct roles, per the DORA-AUTHORITY-PIN-1 crosswalk and the pinned
 * clause-snapshot registry entries):
 *   - Commission Delegated Regulation (EU) 2025/301 Art. 5 supplies the time limits:
 *       · initial report: as early as possible within 4 hours of major classification
 *         AND no later than 24 hours after awareness — the EARLIER of the two limbs binds;
 *       · intermediate report: within 72 hours of SUBMISSION of the initial notification
 *         (never from the initial deadline), even if unchanged, plus an updated
 *         intermediate without undue delay and when regular activity resumes;
 *       · final report: no later than one month after submission of the intermediate
 *         report or the latest updated intermediate report (whichever is later);
 *       · weekend/bank-holiday extension to noon next working day, NOT available for
 *         initial/intermediate reports by credit institutions, CCPs, trading-venue
 *         operators or NIS2 essential/important entities, nor by any entity an NCA has
 *         notified; final reports keep the extension; an NCA may withdraw it from other
 *         entities after notice.
 *   - Commission Delegated Regulation (EU) 2025/301 Arts. 1-4 supply per-stage report
 *     content; Commission Implementing Regulation (EU) 2025/302 Art. 7 supplies TPP
 *     aggregated reporting and Annex I the template field list (this kernel does not
 *     draft the forms; see tool 303 for the Annex I draft surface).
 *   - Calendar-month arithmetic follows Regulation (EEC, Euratom) No 1182/71 Art. 2:
 *     a one-month period expires on the corresponding date in the target month, with an
 *     end-of-month clamp when the target month is shorter (documented, deterministic,
 *     UTC, no Intl/locale dependency).
 *   - DORA (EU) 2022/2554 Arts. 19-20 carry the reporting obligations the deadlines
 *     serve; Joint ESAs report JC 2026 16 (2026-06-03) paras 3(i)-(iii) corroborate the
 *     clocks in the ESAs' own words.
 *
 * REVERSED D SPLIT (this kernel's role): art-467 is the UPSTREAM clock producer of
 * dora-escalation-demo. It does NOT classify: classification lives in
 * art-09-dora-incident-classifier.kernel.mjs, which CONSUMES this kernel's clock result
 * through the declared edge (art-467 declares `feeds` -> art-09; art-09 declares
 * `consumes` <- art-467). This kernel stays usable standalone: every input is
 * caller-declared, and it never reads a wall clock (zero Date.now(), zero randomness,
 * zero network). Due-ness states are computed against the caller-declared `logical_date`,
 * never against "now".
 *
 * States: overall `schedule_state` = evaluable | not_evaluable | malformed (the shared
 * degraded vocabulary of DORA-CLOCK-REPAIR-1 step 2; `major`/`not_major` live on the
 * classifier). Per stage: not_yet_due | due | overdue | not_evaluable |
 * no_final_report_yet. Empty or contradictory timestamps yield `not_evaluable` — never a
 * fabricated deadline. Every deadline carries the origin timestamp it was computed from
 * and a stable reason code.
 *
 * `bank_holiday_calendar_ref` is a DECLARED calendar id (never inferred from the entity
 * class or locale). The holiday dates themselves are caller-declared via
 * `bank_holiday_dates[]` (YYYY-MM-DD, observed under that calendar); the kernel ships no
 * holiday table of its own. Weekends (Saturday/Sunday UTC) are applied unconditionally.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: DORA-CLOCK-REPAIR-1 (board row) · SPEC.md §17/§18 kernel identity + proof.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-467-dora-incident-classifier';
const TOOL_VERSION = '2.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'classify_dora_ict_incident_and_clock_deadlines', mandate_type: 'attestation_mandate', gpu: false };

const HOUR_MS = 3600 * 1000;
// Stable, caller-visible constants (cited roles — never re-derived in prose strings).
const TABLE_VERSION = 'DORA-2025-301-ART5-STAGE-CLOCKS-2026-10';
const TABLE_SOURCE = 'Commission Delegated Regulation (EU) 2025/301 Art. 5 (initial 4h-from-classification AND 24h-from-awareness, whichever earlier; intermediate 72h from submission of the initial; final 1 month from the intermediate or the latest updated intermediate; weekend/bank-holiday extension to noon next working day with the initial/intermediate entity-class and NCA-notification exceptions; final keeps it) + Arts. 1-4 (per-stage content); Commission Implementing Regulation (EU) 2025/302 Art. 7 (TPP aggregated reporting) and Annex I (template fields); month arithmetic per Regulation (EEC, Euratom) No 1182/71 Art. 2; DORA (EU) 2022/2554 Arts. 19-20; corroborated by Joint ESAs report JC 2026 16 (2026-06-03) paras 3(i)-(iii).';


// ISO-8601 datetime with a MANDATORY explicit offset (Z or +/-hh:mm(/hhmm)).
const ISO_OFFSET_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})$/;
// Calendar-date form accepted only inside bank_holiday_dates[].
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Deterministic UTC parse of a caller-declared timestamp. Returns ms since epoch, or
// null when absent/empty; a present-but-invalid value (not an explicit-offset ISO-8601
// datetime, or unparseable) records the field name in `out` and returns null. Never
// reads a wall clock.
function parseDeclared(s, key, out) {
  if (s == null || s === '') return null;
  if (typeof s !== 'string' || !ISO_OFFSET_RE.test(s)) { out.push(key); return null; }
  const t = Date.parse(s);
  if (!Number.isFinite(t)) { out.push(key); return null; }
  return t;
}
function isoOrNull(ms) { return ms == null ? null : new Date(ms).toISOString(); }
function isoDateUtc(ms) { return new Date(ms).toISOString().slice(0, 10); }
function utcDayOfWeek(ms) { return new Date(ms).getUTCDay(); } // 0=Sun .. 6=Sat

// Adds one CALENDAR month (UTC) with an end-of-month clamp (Jan 31 + 1 month -> Feb 28/29),
// per Regulation (EEC, Euratom) No 1182/71 (month-expiry rule). Deterministic, no Intl/locale dependency.
function addCalendarMonthUtc(ms) {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const targetMonthLastDay = new Date(Date.UTC(y, m + 2, 0)).getUTCDate();
  const clampedDay = Math.min(day, targetMonthLastDay);
  return Date.UTC(y, m + 1, clampedDay, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds());
}

// Reporting time-limits (the pinned time-limits regulation): a deadline falling on a Saturday, a Sunday or a declared bank-holiday
// date moves to 12:00 (noon) UTC on the next working day. Final reports keep the
// extension; initial/intermediate lose it per entity class / NCA notice (decided by the
// caller of this helper).
function rollToNoonNextWorkingDay(ms, holidaySet) {
  const d = new Date(ms);
  let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 12, 0, 0, 0);
  let guard = 0;
  while (guard < 60) {
    const dow = utcDayOfWeek(t);
    if (dow !== 0 && dow !== 6 && !holidaySet.has(isoDateUtc(t))) return t;
    t += 24 * HOUR_MS;
    guard++;
  }
  return t; // unreachable in practice (60-day guard keeps compute() total)
}

function extensionDecision(stageName, entityClass, extensionWithdrawn, holidayCount) {
  // The extension is NOT available for initial/intermediate reports by
  // credit institutions, CCPs, trading-venue operators or NIS2 essential/important
  // entities, nor by any entity an NCA has notified (`nca_notified`).
  const extensionDeniedClass = entityClass === 'credit_institution' || entityClass === 'ccp'
    || entityClass === 'trading_venue' || entityClass === 'nis2_essential_important'
    || entityClass === 'nca_notified';
  // Returns { allowed, reason } for whether the weekend/bank-holiday extension MAY apply to this stage.
  if (stageName === 'final_report') {
    return { allowed: true, reason: 'EXTENSION_KEEP_FINAL_REPORT' }; // final reports keep it
  }
  if (extensionWithdrawn === true) {
    return { allowed: false, reason: 'EXTENSION_DENIED_NCA_WITHDRAWN' }; // NCA withdrew it after notice
  }
  if (extensionDeniedClass) {
    return { allowed: false, reason: 'EXTENSION_DENIED_ENTITY_CLASS' };
  }
  return { allowed: true, reason: holidayCount > 0 ? 'EXTENSION_ALLOWED_WEEKEND_BANK_HOLIDAY' : 'EXTENSION_ALLOWED_WEEKEND' };
}

// Per-stage state against the caller-declared logical_date (never a wall clock).
function stageState(deadlineMs, logicalMs) {
  if (deadlineMs == null) return null;
  if (logicalMs == null) return 'not_evaluable'; // due-ness unknowable without a declared as-of
  if (logicalMs < deadlineMs) return 'not_yet_due';
  if (logicalMs === deadlineMs) return 'due';
  return 'overdue';
}

export function compute(pp) {
  pp = pp || {};
  const entityClass = typeof pp.entity_class === 'string' ? pp.entity_class : '';
  const malformed = [];
  const logicalMs = parseDeclared(pp.logical_date, 'logical_date', malformed);
  const awarenessMs = parseDeclared(pp.awareness_at, 'awareness_at', malformed);
  const classMs = parseDeclared(pp.classification_at, 'classification_at', malformed);
  const initialSubMs = parseDeclared(pp.initial_submitted_at, 'initial_submitted_at', malformed);
  const intermediateSubMs = parseDeclared(pp.intermediate_submitted_at, 'intermediate_submitted_at', malformed);
  const latestUpdateMs = parseDeclared(pp.latest_intermediate_update_at, 'latest_intermediate_update_at', malformed);
  const extensionWithdrawn = pp.extension_withdrawn_by_nca === true;
  const tppAggregated = pp.tpp_aggregated_submission === true;
  const calendarRef = typeof pp.bank_holiday_calendar_ref === 'string' && pp.bank_holiday_calendar_ref !== '' ? pp.bank_holiday_calendar_ref : null;

  // Declared holiday dates for the declared calendar — never inferred, never shipped.
  const holidaySet = new Set();
  if (Array.isArray(pp.bank_holiday_dates)) {
    for (const d of pp.bank_holiday_dates) {
      if (typeof d === 'string' && ISO_DATE_RE.test(d)) holidaySet.add(d);
      else malformed.push('bank_holiday_dates');
    }
  }

  const compliance_flags = [];
  const anyMalformed = malformed.length > 0;

  // --- overall schedule state (the shared degraded vocabulary; never a silent default) ---
  const entityClassKnown = entityClass === 'credit_institution' || entityClass === 'ccp'
    || entityClass === 'trading_venue' || entityClass === 'nis2_essential_important'
    || entityClass === 'nca_notified' || entityClass === 'other';
  let schedule_state;
  if (anyMalformed) schedule_state = 'malformed';
  else if (awarenessMs == null || classMs == null || entityClass === '' || !entityClassKnown) schedule_state = 'not_evaluable';
  else schedule_state = 'evaluable';

  if (schedule_state === 'evaluable') compliance_flags.push('DORA_CLOCK_SCHEDULE_EVALUABLE');
  else if (schedule_state === 'not_evaluable') compliance_flags.push('DORA_CLOCK_SCHEDULE_NOT_EVALUABLE');
  else compliance_flags.push('DORA_CLOCK_SCHEDULE_MALFORMED');
  if (entityClass !== '' && !entityClassKnown) compliance_flags.push('DORA_ENTITY_CLASS_UNKNOWN');
  if (extensionWithdrawn) compliance_flags.push('DORA_EXTENSION_WITHDRAWN_BY_NCA');
  if (tppAggregated) compliance_flags.push('DORA_TPP_AGGREGATED_SUBMISSION');

  const reporting_clock = {
    entity_class: entityClass,
    classification_at: isoOrNull(classMs),
    awareness_at: isoOrNull(awarenessMs),
    logical_date: isoOrNull(logicalMs),
    bank_holiday_calendar_ref: calendarRef,
    stages: {
      initial_notification: null,
      intermediate_report: null,
      final_report: null,
    },
  };

  // Contradictory stage order (each present pair must be non-decreasing): awareness <=
  // classification <= initial submission <= intermediate submission <= latest update.
  const orderPairs = [
    ['awareness_at', 'classification_at', awarenessMs, classMs],
    ['classification_at', 'initial_submitted_at', classMs, initialSubMs],
    ['initial_submitted_at', 'intermediate_submitted_at', initialSubMs, intermediateSubMs],
    ['intermediate_submitted_at', 'latest_intermediate_update_at', intermediateSubMs, latestUpdateMs],
  ];
  const contradictions = [];
  for (const [a, b, av, bv] of orderPairs) {
    if (typeof av === 'number' && typeof bv === 'number' && bv < av) contradictions.push(`${b}_before_${a}`);
  }
  if (contradictions.length) compliance_flags.push('DORA_TIMESTAMP_ORDER_CONTRADICTION');

  const ev = (schedule_state === 'evaluable');

  // ---- Stage 1: initial notification — min(classification + 4h, awareness + 24h) ----
  if (ev && !contradictions.length) {
    const limbClass = classMs + 4 * HOUR_MS;
    const limbAware = awarenessMs + 24 * HOUR_MS;
    let initialMs;
    let reasonCode;
    if (limbClass < limbAware) { initialMs = limbClass; reasonCode = 'INITIAL_DEADLINE_CLASSIFICATION_4H'; }
    else if (limbAware < limbClass) { initialMs = limbAware; reasonCode = 'INITIAL_DEADLINE_AWARENESS_24H'; }
    else { initialMs = limbClass; reasonCode = 'INITIAL_DEADLINE_LIMBS_EQUAL'; }
    const ext = extensionDecision('initial_notification', entityClass, extensionWithdrawn, holidaySet.size);
    let finalInitialMs = initialMs;
    let extension = { applied: false, original_deadline: null, basis: '2025/301 Art. 5 extension to noon next working day' };
    const isNonWorking = utcDayOfWeek(initialMs) === 0 || utcDayOfWeek(initialMs) === 6 || holidaySet.has(isoDateUtc(initialMs));
    if (isNonWorking) {
      if (ext.allowed) {
        finalInitialMs = rollToNoonNextWorkingDay(initialMs, holidaySet);
        extension = { applied: true, original_deadline: isoOrNull(initialMs), basis: '2025/301 Art. 5 extension to noon next working day' };
        compliance_flags.push('DORA_EXTENSION_APPLIED_INITIAL');
      } else {
        compliance_flags.push('DORA_EXTENSION_DENIED_INITIAL');
      }
    } else {
      compliance_flags.push('DORA_EXTENSION_NOT_NEEDED_INITIAL');
    }
    reporting_clock.stages.initial_notification = {
      deadline: isoOrNull(finalInitialMs),
      state: stageState(finalInitialMs, logicalMs),
      reason_code: reasonCode,
      computed_from: reasonCode === 'INITIAL_DEADLINE_AWARENESS_24H' ? isoOrNull(awarenessMs) : isoOrNull(classMs),
      origin_rule: reasonCode === 'INITIAL_DEADLINE_AWARENESS_24H' ? 'awareness_at + 24h' : 'classification_at + 4h',
      extension_rule: ext.reason,
      extension,
    };
  } else {
    reporting_clock.stages.initial_notification = {
      deadline: null,
      state: 'not_evaluable',
      reason_code: anyMalformed ? 'TIMESTAMP_UNPARSEABLE_OR_NO_OFFSET'
        : contradictions.length ? 'TIMESTAMP_ORDER_CONTRADICTION' : 'STAGE_TIMESTAMP_MISSING',
      computed_from: null,
      origin_rule: 'min(classification_at + 4h, awareness_at + 24h)',
      extension_rule: null,
      extension: { applied: false, original_deadline: null, basis: '2025/301 Art. 5 extension to noon next working day' },
    };
  }

  // ---- Stage 2: intermediate report — initial SUBMISSION + 72h (never from the deadline) ----
  if (ev) {
    if (typeof initialSubMs === 'number' && !contradictions.length) {
      const interMs = initialSubMs + 72 * HOUR_MS;
      const ext = extensionDecision('intermediate_report', entityClass, extensionWithdrawn, holidaySet.size);
      let finalInterMs = interMs;
      let extension = { applied: false, original_deadline: null, basis: '2025/301 Art. 5 extension to noon next working day' };
      const isNonWorking = utcDayOfWeek(interMs) === 0 || utcDayOfWeek(interMs) === 6 || holidaySet.has(isoDateUtc(interMs));
      if (isNonWorking) {
        if (ext.allowed) {
          finalInterMs = rollToNoonNextWorkingDay(interMs, holidaySet);
          extension = { applied: true, original_deadline: isoOrNull(interMs), basis: '2025/301 Art. 5 extension to noon next working day' };
          compliance_flags.push('DORA_EXTENSION_APPLIED_INTERMEDIATE');
        } else {
          compliance_flags.push('DORA_EXTENSION_DENIED_INTERMEDIATE');
        }
      } else {
        compliance_flags.push('DORA_EXTENSION_NOT_NEEDED_INTERMEDIATE');
      }
      reporting_clock.stages.intermediate_report = {
        deadline: isoOrNull(finalInterMs),
        state: stageState(finalInterMs, logicalMs),
        reason_code: 'INTERMEDIATE_FROM_INITIAL_SUBMISSION_72H',
        computed_from: isoOrNull(initialSubMs),
        origin_rule: 'initial_submitted_at + 72h',
        extension_rule: ext.reason,
        extension,
      };
    } else {
      reporting_clock.stages.intermediate_report = {
        deadline: null,
        state: 'not_evaluable',
        reason_code: contradictions.length ? 'TIMESTAMP_ORDER_CONTRADICTION' : 'INTERMEDIATE_INITIAL_NOT_SUBMITTED',
        computed_from: null,
        origin_rule: 'initial_submitted_at + 72h',
        extension_rule: null,
        extension: { applied: false, original_deadline: null, basis: '2025/301 Art. 5 extension to noon next working day' },
      };
    }
  } else {
    reporting_clock.stages.intermediate_report = {
      deadline: null,
      state: 'not_evaluable',
      reason_code: anyMalformed ? 'TIMESTAMP_UNPARSEABLE_OR_NO_OFFSET' : 'STAGE_TIMESTAMP_MISSING',
      computed_from: null,
      origin_rule: 'initial_submitted_at + 72h',
      extension_rule: null,
      extension: { applied: false, original_deadline: null, basis: '2025/301 Art. 5 extension to noon next working day' },
    };
  }

  // ---- Stage 3: final report — max(intermediate submission, latest update) + 1 month ----
  if (ev) {
    if (typeof intermediateSubMs !== 'number') {
      reporting_clock.stages.final_report = {
        deadline: null,
        state: 'no_final_report_yet',
        reason_code: 'FINAL_NO_INTERMEDIATE_SUBMITTED',
        computed_from: null,
        origin_rule: 'max(intermediate_submitted_at, latest_intermediate_update_at) + 1 calendar month (Regulation (EEC, Euratom) No 1182/71 Art. 2, end-of-month clamp)',
        extension_rule: 'EXTENSION_KEEP_FINAL_REPORT',
        extension: { applied: false, original_deadline: null, basis: '2025/301 Art. 5 extension to noon next working day' },
      };
    } else {
      let baseMs = intermediateSubMs;
      let reasonCode = 'FINAL_FROM_INTERMEDIATE_SUBMISSION_1M';
      if (typeof latestUpdateMs === 'number' && latestUpdateMs > baseMs) {
        baseMs = latestUpdateMs;
        reasonCode = 'FINAL_FROM_LATEST_UPDATE_1M';
      }
      const finalMs = addCalendarMonthUtc(baseMs);
      const ext = extensionDecision('final_report', entityClass, extensionWithdrawn, holidaySet.size);
      let finalDeadlineMs = finalMs;
      let extension = { applied: false, original_deadline: null, basis: '2025/301 Art. 5 extension to noon next working day' };
      const isNonWorking = utcDayOfWeek(finalMs) === 0 || utcDayOfWeek(finalMs) === 6 || holidaySet.has(isoDateUtc(finalMs));
      if (isNonWorking && ext.allowed) {
        finalDeadlineMs = rollToNoonNextWorkingDay(finalMs, holidaySet);
        extension = { applied: true, original_deadline: isoOrNull(finalMs), basis: '2025/301 Art. 5 extension to noon next working day' };
        compliance_flags.push('DORA_EXTENSION_APPLIED_FINAL');
      } else if (isNonWorking) {
        compliance_flags.push('DORA_EXTENSION_DENIED_FINAL');
      } else {
        compliance_flags.push('DORA_EXTENSION_NOT_NEEDED_FINAL');
      }
      reporting_clock.stages.final_report = {
        deadline: isoOrNull(finalDeadlineMs),
        state: stageState(finalDeadlineMs, logicalMs),
        reason_code: reasonCode,
        computed_from: isoOrNull(baseMs),
        origin_rule: 'max(intermediate_submitted_at, latest_intermediate_update_at) + 1 calendar month (Regulation (EEC, Euratom) No 1182/71 Art. 2, end-of-month clamp)',
        extension_rule: ext.reason,
        extension,
      };
    }
  } else {
    reporting_clock.stages.final_report = {
      deadline: null,
      state: anyMalformed ? 'not_evaluable' : 'no_final_report_yet',
      reason_code: anyMalformed ? 'TIMESTAMP_UNPARSEABLE_OR_NO_OFFSET' : 'FINAL_NO_INTERMEDIATE_SUBMITTED',
      computed_from: null,
      origin_rule: 'max(intermediate_submitted_at, latest_intermediate_update_at) + 1 calendar month (Regulation (EEC, Euratom) No 1182/71 Art. 2, end-of-month clamp)',
      extension_rule: 'EXTENSION_KEEP_FINAL_REPORT',
      extension: { applied: false, original_deadline: null, basis: '2025/301 Art. 5 extension to noon next working day' },
    };
  }

  const output_payload = {
    schedule_state,
    entity_class: entityClass,
    reporting_clock,
    tpp_aggregated_submission: tppAggregated,
    reporting_path_note: tppAggregated
      ? 'TPP aggregated submission declared (2025/302 Art. 7): the reporting path runs through the third-party provider aggregated channel; the Art. 5 clocks themselves are unchanged.'
      : 'Direct reporting path; the Art. 5 clocks apply per stage as emitted.',
    table_version: TABLE_VERSION,
    table_source: TABLE_SOURCE,
    note: 'DORA 2025/301 Art. 5 stage-clock schedule over caller-declared timestamps. Classification is NOT performed here: under the REVERSED D split, art-09-dora-incident-classifier classifies per 2024/1772 Art. 8(1) and CONSUMES this clock result (art-467 declares feeds -> art-09). All timestamps are caller-declared with explicit offsets; due-ness states are computed against the declared logical_date, never a wall clock. This kernel computes deadlines only; it does not itself transmit, file, or submit any regulatory notification, and it is not legal advice.',
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
