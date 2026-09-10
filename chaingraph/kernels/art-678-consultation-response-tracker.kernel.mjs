import { executionHash } from './_hash.mjs';

// art-678-consultation-response-tracker (CONSULT-TRACKER-BUILD-1, CONSULT-TRACKER-BUILD-SPEC.md)
//
// Open/closed roll-up over a caller-declared set of regulatory consultations, each with a
// declared close date and a declared responded flag; the as_of date is a declared input too.
// This kernel computes only the arithmetic of those declarations: how many consultations are
// still open as of the declared date, how many closed without a response, the ids of those
// missed closes, the whole-day count to the next unresponded close, and an overall verdict
// (ATTENTION_REQUIRED / ON_TRACK / ALL_RESPONDED). It exists because T122-style trackers carry
// no consultation/comment-period coverage; it links nothing and checks nothing live.
//
// DECLARED-DATE DISCIPLINE (deadline-wall lesson, spec constraint): every date here is a
// caller-declared input. There is NO runtime clock anywhere in compute(): as_of is an input,
// never now(). A consultation whose closes date equals as_of is still open (it closes on the
// as-of date, it has not closed before it).
//
// VERDICT RULES (the only judgements this kernel makes, both mechanical):
//   - ATTENTION_REQUIRED iff at least one declared consultation closed before as_of with
//     responded=false (a missed close).
//   - otherwise ON_TRACK iff at least one declared consultation is still open and unresponded
//     (there is a future close to make).
//   - otherwise ALL_RESPONDED (every declared consultation is responded or responded-and-open).
//
// ROUNDING CONVENTION (declared, per spec): any fractional quantity would be rounded half-up
// to 2 decimal places by roundHalfUp(x, 2); day deltas between declared calendar dates are
// exact whole-day integers (civil-days algorithm, no Date object, no timezone), so the
// convention is declared and applied but never changes a value here.
//
// NEVER GUESS, NEVER DEFAULT. An absent or malformed as_of, consultation list, id, closes
// date, or responded flag resolves to the fail-closed payload -- every summary field nulled,
// each offending input named in domain_errors -- never a silently repaired roll-up.
//
// SCOPE FENCE: arithmetic over caller-declared synthetic declarations only. It does NOT read
// any register, portal, feed, or calendar; "responded" is the caller's declaration, never an
// observation this kernel made; an ON_TRACK verdict is not a promise that any deadline will
// be met. The T122 calendar link named by the spec lives on the tool page, not in this kernel.
//
// Zero network, zero randomness, zero wall-clock reads inside compute(). No
// TextEncoder/atob/btoa/URL/Date anywhere in this file (QuickJS-ng guest safe).

const TOOL_ID = 'art-678-consultation-response-tracker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_consultation_response_tracker',
  mandate_type: 'analytics_mandate', gpu: false,
};

const MAX_CONSULTATIONS = 512;

const ERROR_PHRASES = {
  INVALID_AS_OF: 'as_of must be a declared calendar date in YYYY-MM-DD form',
  INVALID_CONSULTATIONS: 'consultations must be a non-empty array of consultation objects, at most 512 entries',
  INVALID_ID: 'each consultation.id must be a non-empty string and consultation ids must be unique',
  INVALID_CLOSES: 'each consultation.closes must be a declared calendar date in YYYY-MM-DD form',
  INVALID_RESPONDED: 'each consultation.responded must be a boolean',
};

/** Half-up rounding to dp decimal places, sign-symmetric, deterministic. 10^dp by repeated
 *  multiplication — never Math.pow (a banned non-deterministic-guest transcendental). */
function roundHalfUp(x, dp) {
  let m = 1;
  for (let i = 0; i < dp; i++) m *= 10;
  const scaled = x * m;
  const r = scaled < 0 ? -Math.floor(-scaled + 0.5) : Math.floor(scaled + 0.5);
  return r / m;
}

/** Strict YYYY-MM-DD calendar date check: shape, month 1-12, day within the month (leap-aware). */
function isCalendarDate(s) {
  if (typeof s !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= dim;
}

/** Whole-day count from the 1970-01-01 epoch for a validated YYYY-MM-DD string (Hinnant
 *  days-from-civil date arithmetic). Pure integer arithmetic: no Date object, no timezone,
 *  no wall clock. */
function daysFromCivil(s) {
  const y = Number(s.slice(0, 4));
  const mo = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  const yy = mo <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (mo + (mo > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function compute(pp) {
  pp = pp || {};
  const domain_errors = [];

  const asOf = pp.as_of;
  if (!isCalendarDate(asOf)) domain_errors.push('INVALID_AS_OF');

  const consultations = pp.consultations;
  const shapeOk = Array.isArray(consultations) && consultations.length > 0 && consultations.length <= MAX_CONSULTATIONS;
  if (!shapeOk) {
    domain_errors.push('INVALID_CONSULTATIONS');
  } else {
    const seen = new Set();
    for (let i = 0; i < consultations.length; i++) {
      const c = consultations[i] || {};
      if (typeof c.id !== 'string' || c.id.length === 0 || seen.has(c.id)) { domain_errors.push('INVALID_ID'); break; }
      seen.add(c.id);
      if (!isCalendarDate(c.closes)) { domain_errors.push('INVALID_CLOSES'); break; }
      if (typeof c.responded !== 'boolean') { domain_errors.push('INVALID_RESPONDED'); break; }
    }
  }

  const compliance_flags = [];

  if (domain_errors.length > 0) {
    compliance_flags.push('DOMAIN_ERROR');
    for (const code of domain_errors) compliance_flags.push(`CONSTRK_${code}`);
    const reasons = domain_errors.map((c) => ERROR_PHRASES[c]).join('; ');
    return {
      output_payload: {
        open: null,
        closed_unresponded: null,
        missed: [],
        days_to_next_close: null,
        overall: null,
        trace: `fail-closed: ${reasons}; no consultation roll-up computed -- correct the named inputs and resubmit. Arithmetic of caller-declared consultation declarations only: no register, portal, feed, or calendar is read, and as_of is your declared date, never a clock.`,
        domain_errors,
      },
      compliance_flags,
    };
  }

  const asOfDays = daysFromCivil(asOf);
  let open = 0;
  let closedUnresponded = 0;
  const missed = [];
  let nextDays = null;
  let nextDate = null;
  for (const c of consultations) {
    const diff = daysFromCivil(c.closes) - asOfDays;
    if (diff >= 0) {
      open += 1;
      if (!c.responded && (nextDays === null || diff < nextDays)) {
        nextDays = diff;
        nextDate = c.closes;
      }
    } else if (!c.responded) {
      closedUnresponded += 1;
      missed.push(c.id);
    }
  }
  const daysToNextClose = nextDays === null ? null : roundHalfUp(nextDays, 2);

  let overall;
  if (missed.length > 0) overall = 'ATTENTION_REQUIRED';
  else if (nextDays !== null) overall = 'ON_TRACK';
  else overall = 'ALL_RESPONDED';

  const parts = [];
  for (let i = 0; i < missed.length; i++) {
    const c = consultations.find((x) => x.id === missed[i]);
    parts.push(`${missed[i]} closed ${c.closes} before as_of with no response`);
  }
  if (nextDays !== null) {
    parts.push(`next close ${nextDate} is ${String(daysToNextClose)} days out`);
  } else if (missed.length > 0) {
    parts.push(`no unresponded open consultation remains as of ${asOf}`);
  } else {
    parts.unshift(`all ${consultations.length} declared consultations responded as of ${asOf}`);
  }

  const output_payload = {
    open,
    closed_unresponded: closedUnresponded,
    missed,
    days_to_next_close: daysToNextClose,
    trace: parts.join('; '),
    overall,
  };

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
