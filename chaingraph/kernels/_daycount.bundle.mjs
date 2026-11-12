// _daycount.bundle.mjs - shared day-count kernel (SHARED-DAYCOUNT-BUNDLE-1).
//
// PURPOSE: a reusable, zero-import, guest-safe pure-JS module implementing:
//   - the seven day-count conventions of the amortization bundle
//     (_amort.bundle.mjs, ACCT-AMORT-K-1 / ACCT-INFRA-KERNELS-BUILD-SPEC.md
//     Sec 1.1), extracted byte-compatibly: the same mode ids, the same
//     integer JDN date arithmetic and the same per-convention formulas, so
//     every float result this module's convenience wrapper produces is
//     bit-identical to the amortization bundle's.
//   - every year fraction returned as an exact INTEGER RATIONAL {num, den}
//     (both safe integers, gcd-reduced, den > 0), so a caller rounds ONCE
//     after multiplying, never twice (defect D17). A float helper
//     `fractionFloat` is a convenience wrapper only: num/den.
//   - two new modes under new ids, extending the closed seven-mode set the
//     way build spec Sec 1.1 requires (an eighth mode is a row, never an
//     ad-hoc edit):
//       ACT_ACT_ICMA - accrual over a declared period schedule at a declared
//         frequency (ICMA Rule 251 'accrued interest and day count' shape:
//         (days in scope / days in the coupon period) / frequency). The
//         schedule is caller data, never derived here.
//       BUS_252 - business days between two dates divided by 252, over a
//         caller-supplied holiday calendar (weekend days + holiday dates).
//   - business-day roll conventions per ISDA 2006 Definitions Sec 4.12:
//     following, modified following, preceding — over the same
//     caller-supplied calendar.
//   - structured refusals, never silent defaults (defect D3): an unknown
//     mode is REFUSED_UNKNOWN_CONVENTION, a malformed date
//     REFUSED_BAD_DATE, an inverted pair REFUSED_DATE_ORDER, ICMA without a
//     schedule REFUSED_SCHEDULE_REQUIRED, BUS_252 without a calendar
//     REFUSED_NO_CALENDAR, and a pair no schedule period contains
//     REFUSED_SCHEDULE_RANGE.
//
// NO Date OBJECT, NO Date.parse, NO ENGINE TRANSCENDENTALS (SPEC.md Sec
// 18.5): every date is an integer (y, m, d) triple resolved through the
// Fliegel & Van Flandern Julian Day Number formula (integer-only,
// Math.floor is IEEE-754-exact and bit-portable across V8 / QuickJS /
// RV32IM), and every rational is built from integer arithmetic and one gcd
// loop. Calendars and schedules are DATA supplied by the caller via
// policy_parameters (the _ruleversion single-writer ruling) — no calendar
// is baked into these bytes.
//
// COMPOSITION CONTRACT (ACCT-INFRA-KERNELS-BUILD-SPEC.md Sec 4): this
// bundle is inlined VERBATIM into consuming kernels between sentinel
// comments, never imported at runtime — the RISC0 guest provides only
// `_hash`. It carries no `meta`/`compute` export and is not itself an OCG
// node.
//
// GUEST-BUILTIN-GATE-1: no TextEncoder/atob/btoa/URL anywhere below.

const _daycount = (function () {
'use strict';

// ===================== date arithmetic (pure integer y/m/d, no Date object,
// no timezone ambiguity — every convention below is defined purely in terms
// of calendar year/month/day integers) =====================

function parseISODate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (!(mo >= 1 && mo <= 12)) return null;
  if (!(d >= 1 && d <= 31)) return null;
  return { y, m: mo, d };
}

function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function daysInMonth(y, m) {
  if (m === 2 && isLeapYear(y)) return 29;
  return DAYS_IN_MONTH[m - 1];
}

function isLastDayOfFeb(date) {
  return date.m === 2 && date.d === daysInMonth(date.y, 2);
}

// Julian Day Number, proleptic Gregorian calendar (Fliegel & Van Flandern),
// integer-only arithmetic — the actual-day-count basis for ACT_360/ACT_365F/
// ACT_ACT_ISDA/ACT_ACT_ICMA/BUS_252. Math.floor is IEEE-754 exact and
// bit-portable.
function toJDN(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

function actualDays(d1, d2) {
  return toJDN(d2.y, d2.m, d2.d) - toJDN(d1.y, d1.m, d1.d);
}

// ===================== rational helpers =====================
//
// Every year fraction leaves this module as an exact {num, den} pair of
// safe integers, den > 0, gcd-reduced, so a caller computes
// roundOnce(money * num / den) instead of compounding two roundings
// (defect D17). Integer magnitudes here are tiny: day counts stay far
// below 2^31 and all denominators are <= 252*2^7-scale products, so every
// intermediate is a safe integer by construction.

function gcd(a, b) {
  if (a < 0) a = -a;
  if (b < 0) b = -b;
  while (b !== 0) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

// gcd-reduced rational; num 0 normalizes to {num: 0, den: 1}.
function rational(num, den) {
  if (!(Number.isSafeInteger(num) && Number.isSafeInteger(den)) || den === 0) return null;
  if (den < 0) { num = -num; den = -den; }
  const g = gcd(num, den) || 1;
  return { num: num / g, den: den / g };
}

// Exact sum of rational parts (each {num, den}): common denominator =
// lcm of the parts' denominators, numerator the matching integer sum.
// Used by ACT_ACT_ISDA, whose clause definition is itself a SUM of
// per-calendar-year fractions (leap /366, non-leap /365).
function sumRationals(parts) {
  let den = 1;
  for (const p of parts) {
    den = (den / gcd(den, p.den)) * p.den;
  }
  let num = 0;
  for (const p of parts) {
    num += p.num * (den / p.den);
  }
  return rational(num, den);
}

// ===================== the seven extracted conventions (same mode ids,
// same formulas as _amort.bundle.mjs — see the ISDA 2006 Definitions
// Sec 4.16 clause snapshot recorded there) =====================

const CONVENTIONS = Object.freeze([
  'UNIT_PERIOD', '30_360_US', '30E_360', '30E_360_ISDA',
  'ACT_360', 'ACT_365F', 'ACT_ACT_ISDA',
  'ACT_ACT_ICMA', 'BUS_252',
]);

// ISDA Sec 4.16(f) "30/360"/"Bond Basis": D1 capped at 30 when 31; D2 capped
// at 30 when 31 AND D1 > 29 (the US end-of-month coupling between D1 and D2).
function frac30_360_US(d1, d2) {
  let D1 = d1.d, D2 = d2.d;
  if (D1 === 31) D1 = 30;
  if (D2 === 31 && D1 > 29) D2 = 30;
  return rational(360 * (d2.y - d1.y) + 30 * (d2.m - d1.m) + (D2 - D1), 360);
}

// ISDA Sec 4.16(g) "30E/360"/"Eurobond Basis": D1 and D2 each capped at 30
// unconditionally when 31 — no cross-coupling between D1 and D2.
function frac30E_360(d1, d2) {
  const D1 = d1.d === 31 ? 30 : d1.d;
  const D2 = d2.d === 31 ? 30 : d2.d;
  return rational(360 * (d2.y - d1.y) + 30 * (d2.m - d1.m) + (D2 - D1), 360);
}

// ISDA Sec 4.16(h) "30E/360 (ISDA)": D1 capped at 30 when it is the last day
// of February OR would be 31. D2 capped at 30 when it is the last day of
// February AND NOT the Termination Date, OR would be 31.
function frac30E_360_ISDA(d1, d2, opts) {
  const D1 = (isLastDayOfFeb(d1) || d1.d === 31) ? 30 : d1.d;
  const d2IsFebEnd = isLastDayOfFeb(d2) && !(opts && opts.isTerminationDate);
  const D2 = (d2IsFebEnd || d2.d === 31) ? 30 : d2.d;
  return rational(360 * (d2.y - d1.y) + 30 * (d2.m - d1.m) + (D2 - D1), 360);
}

// ISDA Sec 4.16(e) "Actual/360".
function fracACT_360(d1, d2) { return rational(actualDays(d1, d2), 360); }

// ISDA Sec 4.16(d) "Actual/365 (Fixed)".
function fracACT_365F(d1, d2) { return rational(actualDays(d1, d2), 365); }

// ISDA Sec 4.16(b) "Actual/Actual (ISDA)": split the period at every calendar
// year boundary; each whole or partial calendar-year chunk is divided by 366
// if that calendar year is a leap year, else 365; the chunks are summed. The
// sum is EXACT here: per-year parts are summed over the lcm of {365, 366}
// and reduced, never floated first.
function fracACT_ACT_ISDA(d1, d2) {
  if (d1.y === d2.y) {
    return rational(actualDays(d1, d2), isLeapYear(d1.y) ? 366 : 365);
  }
  const parts = [rational(actualDays(d1, { y: d1.y + 1, m: 1, d: 1 }), isLeapYear(d1.y) ? 366 : 365)];
  for (let y = d1.y + 1; y < d2.y; y++) {
    parts.push(rational(isLeapYear(y) ? 366 : 365, isLeapYear(y) ? 366 : 365)); // a full calendar year's actual days over its own leap/non-leap denominator is exactly 1
  }
  parts.push(rational(actualDays({ y: d2.y, m: 1, d: 1 }, d2), isLeapYear(d2.y) ? 366 : 365));
  return sumRationals(parts);
}

// UNIT_PERIOD (build spec Sec 1.1): NOT a calendar day count. A whole unit
// period's fraction is exactly 1; a stub period's fraction is the DECLARED
// stub_fraction the caller supplies (never derived from dates). The rational
// form reads the declared value at its declared 1e-9 half-up rounding scale
// (the same precision the amortization bundle declares for day counts), so
// no float is invented here.
function fracUNIT_PERIOD(unitFraction) {
  const f = unitFraction == null ? 1 : unitFraction;
  if (!(f > 0 && f <= 1)) return null; // an out-of-range stub fraction is a caller error, not silently clamped
  return rational(Math.round(f * 1e9), 1e9);
}

// ACT_ACT_ICMA (ICMA Rule 251 "accrued interest and day count" shape): the
// caller declares the coupon-period schedule (an ordered array of
// {start, end} ISO periods, each a REGULAR period) and the compounding
// frequency per year (1, 2, 4 or 12). The year fraction of d1..d2 is
// (actual days d1..d2) / (actual days in the containing period) / frequency
// — so a full regular period is exactly 1/frequency. The pair must lie
// within a single declared period; anything else is a structured refusal,
// never an extrapolation. The schedule is caller data (policy_parameters),
// never derived here.
const ICMA_FREQUENCIES = [1, 2, 4, 12];
const MAX_SCHEDULE_PERIODS = 1200;

function fracACT_ACT_ICMA(d1, d2, opts) {
  const schedule = opts && opts.schedule;
  if (!Array.isArray(schedule) || schedule.length === 0) return { refused: 'REFUSED_SCHEDULE_REQUIRED' };
  if (schedule.length > MAX_SCHEDULE_PERIODS) return { refused: 'REFUSED_SCHEDULE_TOO_LONG' };
  const f = opts.frequency == null ? 2 : opts.frequency;
  if (!ICMA_FREQUENCIES.includes(f)) return { refused: 'REFUSED_BAD_FREQUENCY' };
  for (let i = 0; i < schedule.length; i++) {
    const ps = parseISODate(schedule[i].start);
    const pe = parseISODate(schedule[i].end);
    if (!ps || !pe) return { refused: 'REFUSED_BAD_DATE' };
    if (actualDays(ps, pe) <= 0) return { refused: 'REFUSED_DATE_ORDER' };
    if (actualDays(ps, d1) >= 0 && actualDays(d2, pe) >= 0) {
      // days(d1..d2) <= days(period), so the multiplier is a safe integer
      return rational(actualDays(d1, d2), actualDays(ps, pe) * f);
    }
  }
  return { refused: 'REFUSED_SCHEDULE_RANGE' };
}

// ===================== business-day calendar + roll (ISDA 2006
// Definitions Sec 4.12) =====================
//
// A calendar is caller DATA: { weekend: [weekday numbers], holidays:
// ["YYYY-MM-DD", ...] } — weekday is the JDN-derived day of week with 0 =
// Sunday .. 6 = Saturday. No calendar is baked into these bytes (the
// _ruleversion single-writer ruling: data reaches the kernel as
// policy_parameters, hash-pinned by the caller).
//
// Bounds: a calendar declares at most 5000 holidays and a roll walks at
// most 400 extra days (a calendar that holidays 400 consecutive days is a
// data error, not a hang).

const MAX_HOLIDAYS = 5000;
const MAX_ROLL_STEPS = 400;

// Day of week from JDN, 0 = Sunday .. 6 = Saturday. Anchor: 2000-01-01 is
// JDN 2451545, a Saturday, and (2451545 + 1) % 7 === 6.
function weekdayFromJDN(jdn) {
  return (jdn + 1) % 7;
}

function isBusinessDay(date, calendar) {
  if (calendar && Array.isArray(calendar.weekend) && calendar.weekend.includes(weekdayFromJDN(toJDN(date.y, date.m, date.d)))) return false;
  if (calendar && Array.isArray(calendar.holidays) && calendar.holidays.includes(isoOf(date))) return false;
  return true;
}

function isoOf(date) {
  return (date.y < 10 ? '000' : date.y < 100 ? '00' : date.y < 1000 ? '0' : '') + date.y
    + '-' + (date.m < 10 ? '0' : '') + date.m + '-' + (date.d < 10 ? '0' : '') + date.d;
}

function normalizeCalendar(calendar) {
  if (!calendar || typeof calendar !== 'object') return { refused: 'REFUSED_NO_CALENDAR' };
  if (calendar.holidays != null && (!Array.isArray(calendar.holidays) || calendar.holidays.length > MAX_HOLIDAYS)) return { refused: 'REFUSED_NO_CALENDAR' };
  if (calendar.weekend != null && (!Array.isArray(calendar.weekend) || calendar.weekend.some((w) => !Number.isInteger(w) || w < 0 || w > 6))) return { refused: 'REFUSED_NO_CALENDAR' };
  return null;
}

// Business days strictly after d1 up to and including d2 (d1 excluded,
// d2 included — a one-day pair over a business day is 1, the accrual
// convention BUS/252 users price against). Both endpoints must be business
// days? No: endpoints are counted on their own merits; the walk is over
// the days in (d1, d2].
function businessDaysBetween(d1, d2, calendar) {
  let n = 0;
  let j = toJDN(d1.y, d1.m, d1.d);
  const end = toJDN(d2.y, d2.m, d2.d);
  if (end - j > 366000) return null; // > ~1000 years: out of declared domain, never a silent walk
  while (j < end) {
    j += 1;
    // JDN -> (y, m, d) by the inverse Fliegel & Van Flandern mapping,
    // integer-only.
    const a = j + 32044;
    const b = Math.floor((4 * a + 3) / 146097);
    const c = a - Math.floor((146097 * b) / 4);
    const dd = Math.floor((4 * c + 3) / 1461);
    const e = c - Math.floor((1461 * dd) / 4);
    const mm = Math.floor((5 * e + 2) / 153);
    const ymd = { y: 100 * b + dd - 4800 + Math.floor(mm / 10), m: mm + 3 - 12 * Math.floor(mm / 10), d: e - Math.floor((153 * mm + 2) / 5) + 1 };
    if (isBusinessDay(ymd, calendar)) n += 1;
  }
  return n;
}

// BUS_252: business days between the pair, over the caller's calendar,
// divided by the fixed 252 business-year denominator.
function fracBUS_252(d1, d2, opts) {
  const refused = normalizeCalendar(opts && opts.calendar);
  if (refused) return refused;
  const n = businessDaysBetween(d1, d2, opts.calendar);
  if (n === null) return { refused: 'REFUSED_DATE_OUT_OF_RANGE' };
  return rational(n, 252);
}

// Roll a single date per ISDA 2006 Definitions Sec 4.12:
//   following          - the next business day if the date is not one;
//   modified_following - following, but if that crosses into the next
//                        calendar month, the preceding business day instead;
//   preceding          - the previous business day if the date is not one.
// A date that is already a business day rolls to itself.
function roll(date, convention, calendar) {
  const refused = normalizeCalendar(calendar);
  if (refused) return refused;
  if (convention !== 'following' && convention !== 'modified_following' && convention !== 'preceding') {
    return { refused: 'REFUSED_UNKNOWN_ROLL' };
  }
  let d = { y: date.y, m: date.m, d: date.d };
  if (isBusinessDay(d, calendar)) return { y: d.y, m: d.m, d: d.d, rolled: false };
  const dir = convention === 'preceding' ? -1 : 1;
  let steps = 0;
  while (!isBusinessDay(d, calendar) && steps < MAX_ROLL_STEPS) {
    let j = toJDN(d.y, d.m, d.d) + dir;
    const a = j + 32044;
    const b = Math.floor((4 * a + 3) / 146097);
    const c = a - Math.floor((146097 * b) / 4);
    const dd = Math.floor((4 * c + 3) / 1461);
    const e = c - Math.floor((1461 * dd) / 4);
    const mm = Math.floor((5 * e + 2) / 153);
    d = { y: 100 * b + dd - 4800 + Math.floor(mm / 10), m: mm + 3 - 12 * Math.floor(mm / 10), d: e - Math.floor((153 * mm + 2) / 5) + 1 };
    steps += 1;
  }
  if (!isBusinessDay(d, calendar)) return { refused: 'REFUSED_ROLL_UNBOUNDED' };
  if (convention === 'modified_following' && d.m !== date.m) {
    d = { y: date.y, m: date.m, d: date.d };
    steps = 0;
    while (!isBusinessDay(d, calendar) && steps < MAX_ROLL_STEPS) {
      let j = toJDN(d.y, d.m, d.d) - 1;
      const a = j + 32044;
      const b = Math.floor((4 * a + 3) / 146097);
      const c = a - Math.floor((146097 * b) / 4);
      const dd = Math.floor((4 * c + 3) / 1461);
      const e = c - Math.floor((1461 * dd) / 4);
      const mm = Math.floor((5 * e + 2) / 153);
      d = { y: 100 * b + dd - 4800 + Math.floor(mm / 10), m: mm + 3 - 12 * Math.floor(mm / 10), d: e - Math.floor((153 * mm + 2) / 5) + 1 };
      steps += 1;
    }
    if (!isBusinessDay(d, calendar)) return { refused: 'REFUSED_ROLL_UNBOUNDED' };
  }
  return { y: d.y, m: d.m, d: d.d, rolled: true };
}

// ===================== the single public fraction entry point ==============
//
// fraction(mode, d1, d2, opts) -> {num, den} exact rational on success
// (den > 0, gcd-reduced), or {refused: '<NAMED_CODE>'} on a structured
// refusal. fractionFloat is the declared float convenience wrapper:
// exactly num/den, one division, nothing else.

function fraction(mode, d1s, d2s, opts) {
  if (!CONVENTIONS.includes(mode)) return { refused: 'REFUSED_UNKNOWN_CONVENTION' };
  const d1 = parseISODate(d1s);
  const d2 = parseISODate(d2s);
  if (!d1 || !d2 || !daysInMonth(d1.y, d1.m) || d1.d > daysInMonth(d1.y, d1.m) || d2.d > daysInMonth(d2.y, d2.m)) return { refused: 'REFUSED_BAD_DATE' };
  if (actualDays(d1, d2) < 0) return { refused: 'REFUSED_DATE_ORDER' };
  switch (mode) {
    case '30_360_US': return frac30_360_US(d1, d2);
    case '30E_360': return frac30E_360(d1, d2);
    case '30E_360_ISDA': return frac30E_360_ISDA(d1, d2, opts);
    case 'ACT_360': return fracACT_360(d1, d2);
    case 'ACT_365F': return fracACT_365F(d1, d2);
    case 'ACT_ACT_ISDA': return fracACT_ACT_ISDA(d1, d2);
    case 'ACT_ACT_ICMA': return fracACT_ACT_ICMA(d1, d2, opts);
    case 'BUS_252': return fracBUS_252(d1, d2, opts);
    case 'UNIT_PERIOD': {
      const r = fracUNIT_PERIOD(opts && opts.unitFraction);
      return r === null ? { refused: 'REFUSED_BAD_UNIT_FRACTION' } : r;
    }
    default: return { refused: 'REFUSED_UNKNOWN_CONVENTION' };
  }
}

function fractionFloat(mode, d1s, d2s, opts) {
  const r = fraction(mode, d1s, d2s, opts);
  if (!r || r.refused != null) return null;
  return r.num / r.den;
}

// ACT_ACT_ISDA's per-calendar-year parts, exposed for callers that want
// the clause's own summand shape (leap /366, non-leap /365) instead of the
// reduced single rational.
function fractionParts(mode, d1s, d2s) {
  if (mode !== 'ACT_ACT_ISDA') return { refused: 'REFUSED_UNKNOWN_CONVENTION' };
  const d1 = parseISODate(d1s);
  const d2 = parseISODate(d2s);
  if (!d1 || !d2 || d1.d > daysInMonth(d1.y, d1.m) || d2.d > daysInMonth(d2.y, d2.m)) return { refused: 'REFUSED_BAD_DATE' };
  if (actualDays(d1, d2) < 0) return { refused: 'REFUSED_DATE_ORDER' };
  if (d1.y === d2.y) return { parts: [{ num: actualDays(d1, d2), den: isLeapYear(d1.y) ? 366 : 365 }] };
  const parts = [{ num: actualDays(d1, { y: d1.y + 1, m: 1, d: 1 }), den: isLeapYear(d1.y) ? 366 : 365 }];
  for (let y = d1.y + 1; y < d2.y; y++) parts.push({ num: isLeapYear(y) ? 366 : 365, den: isLeapYear(y) ? 366 : 365 });
  parts.push({ num: actualDays({ y: d2.y, m: 1, d: 1 }, d2), den: isLeapYear(d2.y) ? 366 : 365 });
  return { parts };
}

return Object.freeze({
  CONVENTIONS, ICMA_FREQUENCIES,
  MAX_SCHEDULE_PERIODS, MAX_HOLIDAYS, MAX_ROLL_STEPS,
  parseISODate, isLeapYear, daysInMonth, toJDN, actualDays,
  gcd, rational, sumRationals,
  businessDaysBetween, isBusinessDay, weekdayFromJDN, roll,
  fraction, fractionFloat, fractionParts,
});
})();

// Export retained ONLY for this bundle's own PBT floor and the differential
// grid against _amort.bundle.mjs to import and exercise internals directly.
// Consuming kernels NEVER import this — they inline the IIFE above verbatim
// between sentinel comments and destructure the local `_daycount` const, per
// the composition contract (ACCT-INFRA-KERNELS-BUILD-SPEC.md Sec 4.1 rule 1).
// This export line sits OUTSIDE the inlined region by construction, so the
// inlined copy in art-772's kernel stays byte-identical to everything above
// it, sentinel to sentinel.
export { _daycount };
