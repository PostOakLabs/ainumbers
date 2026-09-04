import { executionHash } from './_hash.mjs';

// art-673-lending-recall-prioritizer.kernel.mjs
//
// RECALL-PRIORITIZER-BUILD-1 (RECALL-PRIORITIZER-BUILD-SPEC.md) -- deterministic ranking
// arithmetic over caller-declared synthetic recall queues. A PRIORITIZER over declared
// inputs, never a consumer of live data: there is no securities-lending tape, no borrow
// list, no cutoff feed, no register, no network, and no clock inside compute(). The
// caller declares the as_of date and the recall list (id, due date, quantity); this
// kernel only ranks and flags.
//
// RANKING RULE (declared, never chosen by this kernel):
//   queue = recalls sorted by due date ascending, then declared quantity ascending,
//   then declared id ascending (deterministic total order; no stable-sort dependence).
// URGENCY RULE (declared): a recall is urgent when its due date is 0 or 1 day after
//   as_of (due-within-one-day). Past-due (before as_of) and further-out recalls are
//   ranked but never flagged urgent.
// TRACE: one clause per urgent recall, in queue order, then the ranking statement.
//   Parity example: "R-A due 2026-09-04 is 1 day from as_of -> urgent; rank by due
//   date then qty".
//
// DATE ARITHMETIC: dates are strict YYYY-MM-DD calendar dates parsed and differenced
// with the civil-days algorithm (pure integer arithmetic -- no Date object anywhere,
// deterministic in the QuickJS-ng guest; the runtime clock is never read: as_of is an
// input, never "today").
//
// NEVER GUESS, NEVER DEFAULT. An absent or invalid as_of, recall list, id, due date,
// or quantity resolves to the fail-closed payload -- queue/urgent null, each offending
// input named in domain_errors and in the trace -- never a silently repaired queue and
// never a silently defaulted parameter.
//
// SCOPE FENCE. This kernel computes ranking arithmetic of declared inputs under named
// rules. It does NOT check live securities-lending tapes, borrow lists, recall cutoff
// feeds, or regulators' registers, and it is NOT an instruction to recall, return, or
// borrow any security: what to do about a recall is a judgement that belongs to the
// caller alone. The not_proven discipline applies.
//
// Output payload shape: exactly { queue, urgent, trace, overall } on success (the
// canonical pinned shape; extra keys would move the execution_hash), and the same four
// keys (queue/urgent nulled, overall "INPUT_REFUSED") plus a domain_errors[] array on
// the fail-closed path (the flag-mirror member: a caveat carrier, truthy exactly when
// inputs were refused).
//
// Zero network, zero randomness, zero wall-clock reads inside compute(). Runs unmodified
// in the QuickJS-ng guest (no TextEncoder/atob/btoa/URL/Date anywhere in this file).
//
// Spec: RECALL-PRIORITIZER-BUILD-SPEC.md (worked example + opposite-verdict vectors).

const TOOL_ID = 'art-673-lending-recall-prioritizer';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'compute_lending_recall_prioritizer',
  mandate_type: 'compliance_control',
  gpu: false,
};

const MAX_RECALLS = 512;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Human phrasing per domain error code -- composes the fail-closed trace.
const ERROR_PHRASES = {
  INVALID_AS_OF: 'as_of must be a valid calendar date in YYYY-MM-DD form',
  INVALID_RECALLS: 'recalls must be a non-empty array of declared recalls, at most 512 entries',
  INVALID_RECALL_ID: 'each recall needs a non-empty string id',
  INVALID_RECALL_DUE: 'each recall due must be a valid calendar date in YYYY-MM-DD form',
  INVALID_RECALL_QTY: 'each recall qty must be a positive whole number of units',
};

function isFiniteNumber(v) { return typeof v === 'number' && Number.isFinite(v); }

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

/** Days since 1970-01-01 for a proleptic-Gregorian civil date (Hinnant days_from_civil). */
function daysFromCivil(y, m, d) {
  const y2 = m <= 2 ? y - 1 : y;
  const era = Math.floor(y2 / 400);
  const yoe = y2 - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function dayNumber(s) {
  const p = parseDate(s);
  return p === null ? null : daysFromCivil(p.y, p.m, p.d);
}

export function compute(pp) {
  pp = pp || {};
  const errors = []; // { code, detail }

  const asOfRaw = typeof pp.as_of === 'string' ? pp.as_of.trim() : null;
  const asOfDays = asOfRaw === null ? null : dayNumber(asOfRaw);
  if (asOfDays === null) errors.push({ code: 'INVALID_AS_OF' });

  const recalls = pp.recalls;
  const shapeOk = Array.isArray(recalls) && recalls.length > 0 && recalls.length <= MAX_RECALLS;
  if (!shapeOk) {
    errors.push({ code: 'INVALID_RECALLS' });
  } else {
    for (let i = 0; i < recalls.length; i++) {
      const r = recalls[i] || {};
      if (typeof r.id !== 'string' || r.id.trim() === '') {
        errors.push({ code: 'INVALID_RECALL_ID', detail: `recalls[${i}].id` });
      }
      if (dayNumber(typeof r.due === 'string' ? r.due.trim() : null) === null) {
        errors.push({ code: 'INVALID_RECALL_DUE', detail: `recalls[${i}].due` });
      }
      if (!(isFiniteNumber(r.qty) && Number.isSafeInteger(r.qty) && r.qty > 0)) {
        errors.push({ code: 'INVALID_RECALL_QTY', detail: `recalls[${i}].qty` });
      }
    }
  }

  if (errors.length > 0) {
    const reasons = errors.map((e) => (e.detail ? `${e.detail}: ${ERROR_PHRASES[e.code]}` : ERROR_PHRASES[e.code])).join('; ');
    return {
      output_payload: {
        queue: null,
        urgent: null,
        trace: `fail-closed: ${reasons}; no queue ranked or urgency flagged -- correct the named inputs and resubmit. Prioritizer over caller-declared synthetic inputs only: not live recall data, not an instruction to recall or return any security.`,
        overall: 'INPUT_REFUSED',
        domain_errors: errors.map((e) => e.code),
      },
      compliance_flags: ['DOMAIN_ERROR', ...errors.map((e) => `RECALLPRI_${e.code}`)],
    };
  }

  // Rank: due date ascending, then declared quantity ascending, then id ascending.
  const ranked = recalls
    .map((r, i) => ({ id: r.id, due: r.due, qty: r.qty, order: i, days: dayNumber(r.due.trim()) }))
    .sort((a, b) => (a.days - b.days) || (a.qty - b.qty) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) || (a.order - b.order));

  const queue = ranked.map((r) => r.id);
  const urgent = ranked.filter((r) => r.days - asOfDays >= 0 && r.days - asOfDays <= 1).map((r) => r.id);

  const clauses = ranked
    .filter((r) => r.days - asOfDays >= 0 && r.days - asOfDays <= 1)
    .map((r) => `${r.id} due ${r.due} is ${r.days - asOfDays} day${r.days - asOfDays === 1 ? '' : 's'} from as_of -> urgent`);
  const trace = clauses.length > 0
    ? `${clauses.join('; ')}; rank by due date then qty`
    : 'rank by due date then qty; none due within 1 day of as_of';

  const output_payload = {
    queue,
    urgent,
    trace,
    overall: 'QUEUE_RANKED',
  };

  const compliance_flags = [];
  if (urgent.length > 0) compliance_flags.push('RECALLS_URGENT'); // flag-mirror: mirrors output_payload.urgent

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
