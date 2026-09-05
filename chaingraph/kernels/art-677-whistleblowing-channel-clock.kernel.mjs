import { executionHash } from './_hash.mjs';

// art-677-whistleblowing-channel-clock.kernel.mjs
//
// WHISTLEBLOW-CLOCK-BUILD-1 (WHISTLEBLOW-CLOCK-BUILD-SPEC.md) -- pure calendar-clock
// arithmetic for a whistleblowing channel over caller-declared synthetic dates. A CLOCK
// CHECKER over declared inputs, never a case manager: there is no report register, no
// case feed, no investigation state, no network, and no clock inside compute(). The
// caller declares the report receipt date, the acknowledgement date, and the follow-up
// basis in days; this kernel only differences and adds.
//
// DECLARED RULES (named -- never chosen by this kernel; the pinned primary-text
//   snapshot lives in the node shard metadata and the workspace research snapshot,
//   not here): 
//   ACK RULE: the acknowledgement window is 7 calendar days from report receipt
//     (ACK_WINDOW_DAYS, declared and cited in the node metadata; snapshot listed
//     there). ack_within_7 is true
//     when ack_days <= 7. An ack dated before the report is refused fail-closed.
//   FOLLOW-UP RULE: follow-up due = receipt + followup_basis_days civil days; the
//     spec fixes the declared basis at 90 days, the declared three-month ceiling
//     rendered as caller-declared whole days (the caller owns the
//     day-count convention; this kernel adds exactly the declared number of civil
//     days and never legalises the result).
//   TRACE: exactly "<ack_sent> minus <report_received> = <ack_days> days <= 7;
//     follow-up = receipt + <basis>d" on the compliant path; the same clauses with
//     "> 7" on the breached path.
//
// DATE ARITHMETIC: dates are strict YYYY-MM-DD civil calendar dates parsed and
// differenced with pure integer arithmetic (Hinnant days_from_civil / civil_from_days
// -- no Date object anywhere, deterministic in the QuickJS-ng guest; the runtime
// clock is never read: every date is an input, never "today").
//
// ROUNDING: all quantities are whole civil days; no fractional day can arise, so no
// rounding mode applies. followup_basis_days must be a whole number of days -- a
// fractional basis is refused, never rounded (2dp half-up is declared here for the
// audit record: the rounding rule is "none"; integers only).
//
// NEVER GUESS, NEVER DEFAULT. An absent or invalid receipt date, ack date, or basis
// resolves to the fail-closed payload -- days/due null, each offending input named in
// domain_errors and in the trace -- never a silently repaired date and never a
// silently defaulted window or basis.
//
// SCOPE FENCE. This kernel computes deadline arithmetic of declared inputs under the
// named rules. It does NOT operate a whistleblowing channel, does NOT assess any
// report, does NOT track retaliation or case state, and does NOT deliver legal advice:
// what to do about a late acknowledgement is a judgement that belongs to the caller
// alone. The not_proven discipline applies. The dated AI Act scope-extension note
// (applicable 2026-08-02) is an informational note on the tool page and in the node
// metadata, not a behavioural rule of this kernel.
//
// Output payload shape: exactly { ack_days, ack_within_7, followup_due, trace,
// overall } on success (the canonical pinned shape; extra keys would move the
// execution_hash), and the same five keys (numbers/dates nulled, overall
// "INPUT_REFUSED") plus a domain_errors[] array on the fail-closed path.
//
// Zero network, zero randomness, zero wall-clock reads inside compute(). Runs
// unmodified in the QuickJS-ng guest (no TextEncoder/atob/btoa/URL/Date anywhere).
//
// Spec: WHISTLEBLOW-CLOCK-BUILD-SPEC.md (worked example + opposite-verdict vector).

const TOOL_ID = 'art-677-whistleblowing-channel-clock';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'compute_whistleblowing_channel_clock',
  mandate_type: 'compliance_control',
  gpu: false,
};

const ACK_WINDOW_DAYS = 7; // declared acknowledgement window, cited in the node metadata.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Human phrasing per domain error code -- composes the fail-closed trace.
const ERROR_PHRASES = {
  INVALID_REPORT_RECEIVED: 'report_received must be a valid calendar date in YYYY-MM-DD form',
  INVALID_ACK_SENT: 'ack_sent must be a valid calendar date in YYYY-MM-DD form',
  INVALID_BASIS: 'followup_basis_days must be a positive whole number of days',
  ACK_BEFORE_REPORT: 'ack_sent must not precede report_received',
};

/** Strict YYYY-MM-DD parse + calendar validity (leap-year correct). Returns null when invalid. */
function parseDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return null;
  const y = +s.slice(0, 4);
  const m = +s.slice(5, 7);
  const d = +s.slice(8, 10);
  if (m < 1 || m > 12 || d < 1) return null;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  if (d > dim) return null;
  return { y, m, d };
}

/** Day number on the 1970-01-01 epoch for a proleptic-Gregorian civil date (Hinnant days_from_civil). */
function daysFromCivil(y, m, d) {
  const y2 = m <= 2 ? y - 1 : y;
  const era = Math.floor(y2 / 400);
  const yoe = y2 - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Inverse of daysFromCivil (Hinnant civil_from_days): epoch day number -> YYYY-MM-DD. */
function civilFromDays(z) {
  z += 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const yAdj = m <= 2 ? y + 1 : y;
  return `${String(yAdj).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function dayNumber(s) {
  const p = parseDate(s);
  return p === null ? null : daysFromCivil(p.y, p.m, p.d);
}

export function compute(pp) {
  pp = pp || {};
  const errors = /** @type {{code: string, detail?: string}[]} */ ([]); // { code, detail }

  const receiptRaw = typeof pp.report_received === 'string' ? pp.report_received.trim() : null;
  const receiptDays = receiptRaw === null ? null : dayNumber(receiptRaw);
  if (receiptDays === null) errors.push({ code: 'INVALID_REPORT_RECEIVED' });

  const ackRaw = typeof pp.ack_sent === 'string' ? pp.ack_sent.trim() : null;
  const ackDaysNum = ackRaw === null ? null : dayNumber(ackRaw);
  if (ackDaysNum === null) errors.push({ code: 'INVALID_ACK_SENT' });

  const basis = pp.followup_basis_days;
  const basisOk = typeof basis === 'number' && Number.isFinite(basis) && Number.isSafeInteger(basis) && basis > 0;
  if (!basisOk) errors.push({ code: 'INVALID_BASIS' });

  if (receiptDays !== null && ackDaysNum !== null && ackDaysNum < receiptDays) {
    errors.push({ code: 'ACK_BEFORE_REPORT' });
  }

  if (errors.length > 0) {
    const reasons = errors.map((e) => (e.detail ? `${e.detail}: ${ERROR_PHRASES[e.code]}` : ERROR_PHRASES[e.code])).join('; ');
    return {
      output_payload: {
        ack_days: null,
        ack_within_7: null,
        followup_due: null,
        trace: `fail-closed: ${reasons}; no deadline checked or due date computed -- correct the named inputs and resubmit. Clock checker over caller-declared synthetic dates only: not a case register, not an investigation, not legal advice.`,
        overall: 'INPUT_REFUSED',
        domain_errors: errors.map((e) => e.code),
      },
      compliance_flags: ['DOMAIN_ERROR', ...errors.map((e) => `WBCLK_${e.code}`)],
    };
  }

  const ack_days = ackDaysNum - receiptDays;
  const ack_within_7 = ack_days <= ACK_WINDOW_DAYS;
  const followup_due = civilFromDays(receiptDays + basis);

  const trace = `${ackRaw} minus ${receiptRaw} = ${ack_days} days ${ack_within_7 ? '<=' : '>'} 7; follow-up = receipt + ${basis}d`;

  const output_payload = {
    ack_days,
    ack_within_7,
    followup_due,
    trace,
    overall: ack_within_7 ? 'CLOCKS_COMPLIANT' : 'ACK_WINDOW_BREACHED',
  };

  const compliance_flags = [];
  if (!ack_within_7) compliance_flags.push('ACK_LATE'); // flag-mirror: mirrors output_payload.ack_within_7 === false

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
