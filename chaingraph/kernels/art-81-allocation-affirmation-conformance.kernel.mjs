/**
 * art-81-allocation-affirmation-conformance.kernel.mjs
 * Wave 17 — Allocation/Affirmation Conformance Checker.
 * Checks allocation + confirmation/affirmation events against the
 * 23:00 CET trade-date rule and the machine-readable-format mandate.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Behaviour only; citations live in node metadata and in output_payload.reference.
 * EDUCATIONAL: outputs are decision-support drafts, not regulatory findings.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-81-allocation-affirmation-conformance';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'check_allocation_affirmation',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

const DEFAULT_CUTOFF_HHMM = '23:00'; // CET trade-date cutoff
const ALLOWED_EVENT_TYPES = ['allocation', 'confirmation', 'affirmation'];
const TS_RE     = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const CUTOFF_RE = /^(\d{2}):(\d{2})$/;

const HASH_MAX_DEPTH = 512;
const HASH_MAX_ELEMENTS = 1000000;

function findHashRefusal(v, path, depth, budget) {
  if (depth > budget.maxDepth) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_deep' };
  if (++budget.n > budget.maxElements) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_many_values' };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': non_finite' };
    if (Number.isInteger(v) && !Number.isSafeInteger(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': unsafe_integer' };
    return null;
  }
  if (typeof v === 'bigint') return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': bigint' };
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const r = findHashRefusal(v[i], path + '[' + i + ']', depth + 1, budget);
      if (r !== null) return r;
    }
    return null;
  }
  if (v !== null && typeof v === 'object') {
    const ks = Object.keys(v).sort();
    for (let i = 0; i < ks.length; i++) {
      const r = findHashRefusal(v[ks[i]], path + '.' + ks[i], depth + 1, budget);
      if (r !== null) return r;
    }
  }
  return null;
}

function daysInMonth(y, m) {
  if (m === 2) return ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 29 : 28;
  return (m === 4 || m === 6 || m === 9 || m === 11) ? 30 : 31;
}

function parseCutoff(v) {
  if (typeof v !== 'string') return null;
  const m = CUTOFF_RE.exec(v);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

function parseTimestamp(v) {
  if (typeof v !== 'string') return null;
  const m = TS_RE.exec(v);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const s = m[6] === undefined ? 0 : Number(m[6]);
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
  if (h > 23 || mi > 59 || s > 59) return null;
  return { date: v.slice(0, 10), mins: h * 60 + mi, sec: s, raw: v };
}

export function compute(pp) {
  // buildArtifact may be handed a non-object witness (D6 never-throw); treat it as
  // absent input rather than throwing on a property read.
  if (pp === null || typeof pp !== 'object') pp = {};
  // Both inputs are OPTIONAL, and two gates measure them with different regexes:
  // KERNEL-INPUT-USAGE-CHECK-1 counts a read only through a bare `pp.<key>` (its
  // destructure shape is line-scoped, so a multi-line destructure is invisible to it),
  // while gen-input-schemas.mjs marks a key `required` unless it is read at least once
  // through `pp?.<key>`. So each input is guarded on the bare read and consumed on the
  // optional-chained read — identical semantics (a destructuring default binds exactly
  // when the property is `undefined`), and each gate sees the shape it measures.
  const events = pp.events === undefined ? [] : pp?.events; // [{ event_type, timestamp_ct, trade_date, format, counterparty_type }]
  const cutoff_local = pp.cutoff_local === undefined ? DEFAULT_CUTOFF_HHMM : pp?.cutoff_local;

  const input_issues = [];
  const cutoffMins = parseCutoff(cutoff_local);
  if (cutoffMins === null) {
    input_issues.push({ index: -1, field: 'cutoff_local', reason: 'cutoff_local must be HH:MM between 00:00 and 23:59 with no suffix; value refused' });
  }

  const eventList = Array.isArray(events) ? events : [];
  if (events !== undefined && !Array.isArray(events)) {
    input_issues.push({ index: -1, field: 'events', reason: 'events must be an array; value refused' });
  }

  const events_flagged = [];
  let on_time = 0;
  let total = 0;
  let format_nonconformance_count = 0;

  if (cutoffMins !== null) {
    for (let i = 0; i < eventList.length; i++) {
      const rawEv = eventList[i];
      const ev = (rawEv !== null && typeof rawEv === 'object' && !Array.isArray(rawEv)) ? rawEv : {};

      const parsed = parseTimestamp(ev.timestamp_ct);
      if (parsed === null) {
        input_issues.push({ index: i, field: 'timestamp_ct', reason: 'timestamp_ct must be YYYY-MM-DDTHH:MM[:SS], a real calendar date and time 00:00:00-23:59:59, with no suffix or offset; value refused' });
        continue;
      }

      const rawType = ev.event_type;
      const type = typeof rawType === 'string' ? rawType.trim().toLowerCase() : null;
      if (type === null || !ALLOWED_EVENT_TYPES.includes(type)) {
        input_issues.push({ index: i, field: 'event_type', reason: 'event_type must be allocation, confirmation or affirmation; value refused' });
        continue;
      }

      total++;
      const sameDay = !ev.trade_date || parsed.date === ev.trade_date;
      const late = !sameDay || parsed.mins > cutoffMins || (parsed.mins === cutoffMins && parsed.sec > 0);
      const issues = [];

      if (late) {
        const reason = !sameDay
          ? `Event date (${parsed.date}) after trade date (${ev.trade_date})`
          : `Event time ${parsed.raw.slice(11)} CET exceeds ${cutoff_local} CET trade-date cutoff`;
        if (type === 'allocation') {
          issues.push({ rule: 'LATE_ALLOCATION', reason });
        } else {
          issues.push({ rule: 'LATE_CONFIRMATION', reason });
        }
      } else {
        on_time++;
      }

      if (ev.format !== 'machine-readable') {
        issues.push({ rule: 'MANUAL_FORMAT', reason: 'Non-machine-readable format. The machine-readable mandate requires machine-readable allocation/confirmation.' });
        format_nonconformance_count++;
      }

      if (issues.length > 0) {
        events_flagged.push({
          event_type:       type,
          timestamp_ct:     ev.timestamp_ct,
          trade_date:       ev.trade_date,
          format:           ev.format,
          counterparty_type: ev.counterparty_type,
          issues,
        });
      }
    }
  }

  const input_valid = input_issues.length === 0;
  const on_time_rate = total > 0 ? +(on_time / total * 100).toFixed(1) : 100;

  const compliance_flags = [];
  if (events_flagged.some(e => e.issues.some(i => i.rule === 'LATE_ALLOCATION')))   compliance_flags.push('LATE_ALLOCATION');
  if (events_flagged.some(e => e.issues.some(i => i.rule === 'LATE_CONFIRMATION'))) compliance_flags.push('LATE_CONFIRMATION');
  if (format_nonconformance_count > 0)                                               compliance_flags.push('MANUAL_FORMAT');
  if (!input_valid)                                                                  compliance_flags.push('INPUT_REFUSED');

  const output_payload = {
    on_time_rate,
    total_events:             total,
    on_time_events:           on_time,
    events_flagged,
    format_nonconformance_count,
    input_valid,
    input_issues,
    issues:                   input_issues,
    cutoff_applied:           cutoff_local,
    cutoff_timezone:          'CET (Central European Time)',
    reference: {
      rts:  'ESMA CSDR SDR RTS — Final Report 13 Oct 2025 (ESMA74-2119945926-3430)',
      rule: 'Same-day allocation/confirmation by 23:00 CET + machine-readable formats from December 2026',
      note: 'Verify current applicability date. "Dec 2026" refers to the ESMA RTS binding date — confirm final text.',
      statutory_basis: 'Commission Delegated Regulation (EU) 2026/1536 (OJ L, 14.10.2026), Art. 1(1)(a)(ii) machine-readable form, Art. 1(1)(b) replacing Art. 2(2) of Delegated Regulation (EU) 2018/1229 (by no later than 23:00 CET on the business day on which the transaction has taken place), and Art. 2 (applies from 7 December 2026)',
    },
    dual_date_note: 'Allocation/confirmation timing rules binding DEC 2026 · T+1 go-live 11 OCT 2027 — verify current (CSDR Refit/RTS still finalising)',
    note: 'DECISION-SUPPORT DRAFT — not a regulatory finding. Timestamps are compared in the timezone provided (assumed CET). Verify all event timestamps are in CET/CEST as applicable. Machine-readable format requirement: verify final format specification against ESMA RTS.',
    timezone_note: 'CET is read as declared by the caller; the kernel performs no time-zone conversion.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  // D6: walk the exact execution_hash preimage; mint a null hash plus a reason instead of
  // letting the shared canonicalizer throw on non-I-JSON or oversized input.
  const unhashable = findHashRefusal({ policy_parameters: pp, output_payload }, 'pp', 1, { maxDepth: HASH_MAX_DEPTH, maxElements: HASH_MAX_ELEMENTS, n: 0 });
  const artifact = {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    compute_mode:       'server',
    mandate_type:       meta.mandate_type,
    tool_id:            TOOL_ID,
    tool_version:       TOOL_VERSION,
    generated_at:       now ?? null,
    execution_hash:     unhashable === null ? await executionHash(pp, output_payload) : null,
    chain:              { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:  pp,
    output_payload,
    compliance_flags,
    audit_signature:    { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
  if (unhashable !== null) artifact.hash_refusal = { reason: unhashable.reason, detail: unhashable.detail };
  return artifact;
}
