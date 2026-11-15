import { executionHash } from './_hash.mjs';

// art-847-cashleg-window-exposure -- unsettled-principal exposure when a token leg settles
// around the clock but the cash leg only moves while a payment rail is open.
//
// The node answers one question: given the instant a token leg settles and a caller-declared
// rail calendar (or a list of UTC open windows), how long is the principal unsettled on the
// cash side, and what does that cost at a stated funding rate? Every rail fact (hours, UTC
// offsets, holidays) is an input; the kernel hardcodes no calendar and reads no clock.
//
// DETERMINISM: compute() is a pure function of pp. It uses integer seconds, BigInt for the
// principal-seconds product and the carry rounding, and Date.UTC only as a pure calendar
// conversion. No Date.now(), no Math.random(), no network, no filesystem.

const TOOL_ID = 'art-847-cashleg-window-exposure';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'cashleg_window_exposure',
  mandate_type: 'compliance_control', gpu: false,
};

const DAY = 86400;
const YEAR_SECONDS = 31536000; // ACT/365, stated on the output
export const DEFAULT_HORIZON_DAYS = 14;
export const MAX_HORIZON_DAYS = 60;
export const MAX_WINDOWS = 500;
export const MAX_HOLIDAYS = 400;
export const MAX_RATE_BP = 100000;
const CASH_INSTRUMENTS = ['fiat_bank_money', 'stablecoin', 'deposit_token', 'future_instrument'];

// ── hashability walk (D6) ────────────────────────────────────────────────────────
// Mirrors the classes _hash.mjs refuses before canonicalizing: a non-finite number or an
// integer outside the 2^53 safe range, nesting past MAX_DEPTH, more values than
// MAX_ELEMENTS. Reports { reason, detail } with path and kind only, never the value.
const HASH_MAX_DEPTH = 512;        // _hash.mjs MAX_DEPTH
const HASH_MAX_ELEMENTS = 1000000; // _hash.mjs MAX_ELEMENTS
const PP_MAX_DEPTH = HASH_MAX_DEPTH - 8;
const PP_MAX_ELEMENTS = 199000;

function findHashRefusal(v, path, depth, budget) {
  if (depth > budget.maxDepth) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_deep' };
  if (++budget.n > budget.maxElements) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_many_values' };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': non_finite' };
    if (Number.isInteger(v) && !Number.isSafeInteger(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': unsafe_integer' };
    return null;
  }
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
    return null;
  }
  return null;
}

function isPlainObject(v) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

// ── strict date and time parsing ─────────────────────────────────────────────────
function daysInMonth(y, m) {
  if (m === 2) return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
  return (m === 4 || m === 6 || m === 9 || m === 11) ? 30 : 31;
}

// "YYYY-MM-DD" with a calendar check; returns a day number (days since 1970-01-01) or null.
function parseDate(s) {
  if (typeof s !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m === null) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (y < 1970 || y > 2999 || mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
  return Date.UTC(y, mo - 1, d) / 86400000;
}

// "YYYY-MM-DDTHH:MM:SSZ" (UTC only, no offsets, no fractions); returns epoch seconds or null.
function parseInstant(s) {
  if (typeof s !== 'string') return null;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/.exec(s);
  if (m === null) return null;
  const dn = parseDate(m[1]);
  const hh = Number(m[2]), mi = Number(m[3]), ss = Number(m[4]);
  if (dn === null || hh > 23 || mi > 59 || ss > 59) return null;
  return dn * DAY + hh * 3600 + mi * 60 + ss;
}

// "HH:MM" (00:00 to 23:59); returns seconds into the day or null.
function parseClock(s) {
  if (typeof s !== 'string') return null;
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (m === null) return null;
  const hh = Number(m[1]), mi = Number(m[2]);
  if (hh > 23 || mi > 59) return null;
  return hh * 3600 + mi * 60;
}

function isoOf(sec) {
  return new Date(sec * 1000).toISOString().slice(0, 19) + 'Z';
}

function weekdayOfDay(dn) { return (dn + 4) % 7; } // 0 = Sunday ... 6 = Saturday

// Does [a, b) contain any Saturday or Sunday instant (UTC)?
function crossesWeekend(a, b) {
  if (b <= a) return false;
  for (let dn = Math.floor(a / DAY); dn * DAY < b; dn++) {
    const wd = weekdayOfDay(dn);
    if (wd === 0 || wd === 6) return true;
  }
  return false;
}

const hasOwn = (o, k) => Object.hasOwn(o, k);

// ── input validation: name the violated rule, never coerce ───────────────────────
function refuse(errors, code, detail) { errors.push(code + ': ' + detail); }

function validateCalendar(cal, errors) {
  if (!isPlainObject(cal)) { refuse(errors, 'REFUSED_CALENDAR_INVALID', 'rail_calendar must be an object'); return null; }
  const out = { before: errors.length };
  for (const k of ['rail_id', 'calendar_version', 'source_pin']) {
    if (!hasOwn(cal, k) || typeof cal[k] !== 'string' || cal[k].length < 1 || cal[k].length > 200) {
      refuse(errors, 'REFUSED_CALENDAR_INVALID', k + ' must be a non-empty string up to 200 characters');
    }
  }
  const covFrom = hasOwn(cal, 'covers_from') ? parseDate(cal.covers_from) : null;
  const covTo = hasOwn(cal, 'covers_to') ? parseDate(cal.covers_to) : null;
  if (covFrom === null || covTo === null || covFrom > covTo) {
    refuse(errors, 'REFUSED_CALENDAR_INVALID', 'covers_from and covers_to must be valid YYYY-MM-DD dates with covers_from <= covers_to');
  }
  // window rules
  const rules = [];
  if (!hasOwn(cal, 'window_rules') || !Array.isArray(cal.window_rules) || cal.window_rules.length < 1 || cal.window_rules.length > 50) {
    refuse(errors, 'REFUSED_CALENDAR_INVALID', 'window_rules must be an array of 1 to 50 rules');
  } else {
    for (let i = 0; i < cal.window_rules.length; i++) {
      const r = cal.window_rules[i];
      let ok = isPlainObject(r);
      let wds = [], open = null, close = null;
      if (ok) {
        wds = r.weekdays;
        ok = Array.isArray(wds) && wds.length >= 1 && wds.length <= 7
          && wds.every((w) => typeof w === 'number' && Number.isSafeInteger(w) && w >= 0 && w <= 6)
          && new Set(wds).size === wds.length
          && (r.open_day_offset === -1 || r.open_day_offset === 0)
          && (r.close_day_offset === 0 || r.close_day_offset === 1);
        open = parseClock(r.open_local);
        close = parseClock(r.close_local);
        if (open === null || close === null) ok = false;
        if (ok) {
          const o = r.open_day_offset * DAY + open, c = r.close_day_offset * DAY + close;
          if (c <= o) ok = false;
        }
      }
      if (!ok) refuse(errors, 'REFUSED_CALENDAR_INVALID', 'window_rules[' + i + '] must carry weekdays (distinct integers 0 to 6), open_day_offset -1 or 0, close_day_offset 0 or 1, HH:MM open_local and close_local, and close strictly after open');
      else rules.push({ wds, openOff: r.open_day_offset * DAY + open, closeOff: r.close_day_offset * DAY + close });
    }
  }
  // UTC offset segments (declared by date, so the DST transition is the caller's statement)
  const segs = [];
  if (!hasOwn(cal, 'utc_offset_segments') || !Array.isArray(cal.utc_offset_segments) || cal.utc_offset_segments.length < 1 || cal.utc_offset_segments.length > 100) {
    refuse(errors, 'REFUSED_CALENDAR_INVALID', 'utc_offset_segments must be an array of 1 to 100 segments');
  } else {
    for (let i = 0; i < cal.utc_offset_segments.length; i++) {
      const s = cal.utc_offset_segments[i];
      const f = isPlainObject(s) ? parseDate(s.from_date) : null;
      const t = isPlainObject(s) ? parseDate(s.to_date) : null;
      const okOff = isPlainObject(s) && typeof s.offset_minutes === 'number' && Number.isSafeInteger(s.offset_minutes) && s.offset_minutes >= -720 && s.offset_minutes <= 840;
      if (f === null || t === null || f > t || !okOff) {
        refuse(errors, 'REFUSED_CALENDAR_INVALID', 'utc_offset_segments[' + i + '] must carry valid from_date <= to_date and an integer offset_minutes from -720 to 840');
      } else segs.push({ f, t, off: s.offset_minutes * 60 });
    }
    segs.sort((a, b) => a.f - b.f);
    for (let i = 1; i < segs.length; i++) {
      if (segs[i].f <= segs[i - 1].t) { refuse(errors, 'REFUSED_CALENDAR_INVALID', 'utc_offset_segments overlap'); break; }
    }
  }
  // holidays (dates on which the rail has no business day)
  const hol = new Set();
  if (!hasOwn(cal, 'holidays') || !Array.isArray(cal.holidays) || cal.holidays.length > MAX_HOLIDAYS) {
    refuse(errors, 'REFUSED_CALENDAR_INVALID', 'holidays must be an array of at most ' + MAX_HOLIDAYS + ' YYYY-MM-DD dates (empty is allowed)');
  } else {
    for (let i = 0; i < cal.holidays.length; i++) {
      const d = parseDate(cal.holidays[i]);
      if (d === null) { refuse(errors, 'REFUSED_CALENDAR_INVALID', 'holidays[' + i + '] is not a valid YYYY-MM-DD date'); break; }
      hol.add(d);
    }
  }
  if (errors.length > out.before) return null;
  return { rules, segs, hol, covFrom, covTo, rail_id: cal.rail_id, calendar_version: cal.calendar_version, source_pin: cal.source_pin };
}

function validate(pp) {
  const errors = [];

  const tokenT = hasOwn(pp, 'token_leg_time') ? parseInstant(pp.token_leg_time) : null;
  if (tokenT === null) refuse(errors, 'REFUSED_INPUT_TIME', 'token_leg_time must be a strict UTC instant YYYY-MM-DDTHH:MM:SSZ with a valid calendar date');
  const asOf = hasOwn(pp, 'as_of') ? parseInstant(pp.as_of) : null;
  if (asOf === null) refuse(errors, 'REFUSED_INPUT_TIME', 'as_of must be a strict UTC instant YYYY-MM-DDTHH:MM:SSZ with a valid calendar date');

  if (!hasOwn(pp, 'principal_minor_units') || typeof pp.principal_minor_units !== 'string' || !/^[1-9][0-9]{0,17}$/.test(pp.principal_minor_units)) {
    refuse(errors, 'REFUSED_INPUT_PRINCIPAL', 'principal_minor_units must be a positive integer string of at most 18 digits (a JSON number or a float is never accepted)');
  }

  let rate = null;
  if (hasOwn(pp, 'funding_rate_bp')) {
    const v = pp.funding_rate_bp;
    if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0 || v > MAX_RATE_BP) {
      refuse(errors, 'REFUSED_INPUT_RATE', 'funding_rate_bp must be an integer from 0 to ' + MAX_RATE_BP + ' basis points when present (a float or null is never accepted)');
    } else rate = v;
  }

  let horizon = DEFAULT_HORIZON_DAYS;
  if (hasOwn(pp, 'horizon_days')) {
    const v = pp.horizon_days;
    if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 1 || v > MAX_HORIZON_DAYS) {
      refuse(errors, 'REFUSED_INPUT_HORIZON', 'horizon_days must be an integer from 1 to ' + MAX_HORIZON_DAYS + ' when present');
    } else horizon = v;
  }

  let instrument = null;
  if (hasOwn(pp, 'cash_instrument')) {
    if (typeof pp.cash_instrument !== 'string' || !CASH_INSTRUMENTS.includes(pp.cash_instrument)) {
      refuse(errors, 'REFUSED_INPUT_ENUM', 'cash_instrument must be exactly one of ' + CASH_INSTRUMENTS.join(', ') + ' when present');
    } else instrument = pp.cash_instrument;
  }

  const hasWin = hasOwn(pp, 'cash_leg_open_windows');
  const hasCal = hasOwn(pp, 'rail_calendar');
  let windows = null, cal = null;
  if (!hasWin && !hasCal) {
    refuse(errors, 'REFUSED_CALENDAR_MISSING', 'declare exactly one of cash_leg_open_windows or rail_calendar; the node carries no default rail calendar');
  } else if (hasWin && hasCal) {
    refuse(errors, 'REFUSED_CALENDAR_AMBIGUOUS', 'declare cash_leg_open_windows or rail_calendar, not both');
  } else if (hasWin) {
    const w = pp.cash_leg_open_windows;
    if (!Array.isArray(w) || w.length < 1 || w.length > MAX_WINDOWS) {
      refuse(errors, 'REFUSED_CALENDAR_INVALID', 'cash_leg_open_windows must be an array of 1 to ' + MAX_WINDOWS + ' windows');
    } else {
      windows = [];
      for (let i = 0; i < w.length; i++) {
        const o = isPlainObject(w[i]) ? parseInstant(w[i].open_utc) : null;
        const c = isPlainObject(w[i]) ? parseInstant(w[i].close_utc) : null;
        if (o === null || c === null || c <= o) { refuse(errors, 'REFUSED_CALENDAR_INVALID', 'cash_leg_open_windows[' + i + '] needs strict UTC open_utc < close_utc'); windows = null; break; }
        windows.push({ open: o, close: c });
      }
    }
  } else {
    cal = validateCalendar(pp.rail_calendar, errors);
  }
  return { errors, tokenT, asOf, rate, horizon, instrument, windows, cal };
}

// Windows implied by a rail calendar for business days D from lo to hi (day numbers).
// A holiday D has no window. The offset used for an endpoint is the segment containing that
// endpoint's local date; a local date outside every segment refuses.
function calendarWindows(cal, lo, hi, errors) {
  const out = [];
  const offsetFor = (dn) => {
    for (let i = 0; i < cal.segs.length; i++) if (dn >= cal.segs[i].f && dn <= cal.segs[i].t) return cal.segs[i].off;
    return null;
  };
  for (let d = lo; d <= hi; d++) {
    if (cal.hol.has(d)) continue;
    const wd = weekdayOfDay(d);
    for (let i = 0; i < cal.rules.length; i++) {
      const r = cal.rules[i];
      if (!r.wds.includes(wd)) continue;
      const openLocal = d * DAY + r.openOff, closeLocal = d * DAY + r.closeOff;
      const oo = offsetFor(Math.floor(openLocal / DAY)), co = offsetFor(Math.floor(closeLocal / DAY));
      if (oo === null || co === null) {
        refuse(errors, 'REFUSED_CALENDAR_OFFSET_UNDECLARED', 'no utc_offset_segments entry covers a window endpoint near ' + isoOf(openLocal).slice(0, 10));
        return null;
      }
      out.push({ open: openLocal - oo, close: closeLocal - co });
    }
  }
  return out;
}

function emptyPayload() {
  return {
    valid_input: false, domain_errors: [], refusal_code: null,
    verdict: null, exposure_seconds: null, exposure_principal_seconds: null,
    next_cash_window_open: null, next_cash_window_close: null,
    carry_cost_minor_units: null, carry_rounding: 'half-even', day_count: 'ACT/365',
    crosses_weekend: null, rail_id: null, calendar_version: null, source_pin: null,
    cash_instrument: null, token_leg_time: null, as_of: null, principal_minor_units: null,
    funding_rate_bp: null, horizon_days: null, warnings: [],
  };
}

function refusedResult(errors) {
  const output_payload = emptyPayload();
  output_payload.domain_errors = errors;
  output_payload.refusal_code = errors[0].split(':')[0];
  const compliance_flags = [];
  if (errors.length > 0) compliance_flags.push('INPUT_REFUSED');
  output_payload.warnings = compliance_flags.slice();
  return { output_payload, compliance_flags };
}

/**
 * Round-half-even of num / den for BigInt num >= 0, den > 0.
 * @param {bigint} num
 * @param {bigint} den
 * @returns {bigint}
 */
function divHalfEven(num, den) {
  const q = num / den, r = num % den, twice = r * 2n;
  if (twice > den) return q + 1n;
  if (twice < den) return q;
  return q % 2n === 0n ? q : q + 1n;
}

export function compute(pp) {
  if (!isPlainObject(pp)) return refusedResult(['REFUSED_INPUT_WRONG_TYPE: policy_parameters must be an object']);
  const unhashable = findHashRefusal(pp, 'pp', 1, { maxDepth: PP_MAX_DEPTH, maxElements: PP_MAX_ELEMENTS, n: 0 });
  if (unhashable !== null) return refusedResult([unhashable.reason + ': ' + unhashable.detail]);

  const v = validate(pp);
  if (v.errors.length > 0) return refusedResult(v.errors);

  const errors = [];
  const t = v.tokenT;
  const horizonEnd = t + v.horizon * DAY;
  let windows;
  if (v.windows !== null) {
    windows = v.windows;
  } else {
    const lo = Math.floor(t / DAY) - 2, hi = Math.floor(horizonEnd / DAY) + 2;
    // the declared coverage must reach both the token day and the end of the horizon
    if (Math.floor(t / DAY) < v.cal.covFrom || Math.floor(horizonEnd / DAY) > v.cal.covTo) {
      return refusedResult(['REFUSED_CALENDAR_NOT_COVERED: the calendar covers ' + isoOf(v.cal.covFrom * DAY).slice(0, 10) + ' to ' + isoOf(v.cal.covTo * DAY).slice(0, 10) + ', which does not reach the token leg day plus the horizon']);
    }
    windows = calendarWindows(v.cal, lo, hi, errors);
    if (windows === null) return refusedResult(errors);
  }
  windows = windows.slice().sort((a, b) => a.open - b.open || a.close - b.close);

  const compliance_flags = [];
  let verdict = 'NO_WINDOW_IN_HORIZON';
  let nextOpen = null, nextClose = null;
  for (let i = 0; i < windows.length; i++) {
    const w = windows[i];
    if (w.open <= t && t < w.close) { verdict = 'ATOMIC_POSSIBLE'; nextOpen = t; nextClose = w.close; break; }
    if (w.open > t && w.open <= horizonEnd) { verdict = 'WINDOWED'; nextOpen = w.open; nextClose = w.close; break; }
    if (w.open > horizonEnd) break;
  }

  const principal = BigInt(pp.principal_minor_units);
  const exposure = nextOpen === null ? null : nextOpen - t;
  const weekend = nextOpen === null ? null : crossesWeekend(t, nextOpen);
  let principalSeconds = null, carry = null;
  if (exposure !== null) {
    principalSeconds = (principal * BigInt(exposure)).toString();
    if (v.rate !== null) carry = divHalfEven(principal * BigInt(exposure) * BigInt(v.rate), BigInt(10000 * YEAR_SECONDS)).toString();
  }

  if (verdict === 'WINDOWED') compliance_flags.push('CASH_LEG_LAGS_TOKEN_LEG');
  if (weekend === true) compliance_flags.push('EXPOSURE_CROSSES_WEEKEND');
  if (verdict === 'NO_WINDOW_IN_HORIZON') compliance_flags.push('NO_CASH_WINDOW_IN_HORIZON');
  if (t > v.asOf) compliance_flags.push('TOKEN_LEG_AFTER_AS_OF');
  const warnings = compliance_flags.slice();

  const output_payload = {
    valid_input: true, domain_errors: [], refusal_code: null,
    verdict, exposure_seconds: exposure, exposure_principal_seconds: principalSeconds,
    next_cash_window_open: nextOpen === null ? null : isoOf(nextOpen),
    next_cash_window_close: nextClose === null ? null : isoOf(nextClose),
    carry_cost_minor_units: carry, carry_rounding: 'half-even', day_count: 'ACT/365',
    crosses_weekend: weekend,
    rail_id: v.cal === null ? null : v.cal.rail_id,
    calendar_version: v.cal === null ? null : v.cal.calendar_version,
    source_pin: v.cal === null ? null : v.cal.source_pin,
    cash_instrument: v.instrument,
    token_leg_time: pp.token_leg_time, as_of: pp.as_of,
    principal_minor_units: pp.principal_minor_units,
    funding_rate_bp: v.rate, horizon_days: v.horizon, warnings,
  };
  return { output_payload, compliance_flags };
}

// `now` is passed in, never read from a clock. buildArtifact never throws: an unhashable
// preimage gets execution_hash null and a hash_refusal beside it (D6).
export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const unhashable = findHashRefusal({ policy_parameters: pp, output_payload }, 'pp', 1, { maxDepth: HASH_MAX_DEPTH, maxElements: HASH_MAX_ELEMENTS, n: 0 });
  const artifact = {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now,
    execution_hash: unhashable === null ? await executionHash(pp, output_payload) : null,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
  if (unhashable !== null) artifact.hash_refusal = { reason: unhashable.reason, detail: unhashable.detail };
  return artifact;
}
