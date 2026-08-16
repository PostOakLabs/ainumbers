import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-626-deterministic-amortization-schedule';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_deterministic_amortization_schedule',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Demonstrator node for the shared _amort.bundle.mjs (ACCT-INFRA-KERNELS-BUILD-SPEC.md
// Sec 0.1/Sec 1). Exercises all seven day-count conventions, the bracketed-bisection
// rate solve, the effective-interest schedule, the final-period plug and mid-stream
// remeasurement segmentation end to end, giving the bundle an execution_hash surface,
// a fixture set and a PBT floor. The bundle is the reuse vehicle for waves 6 (ASC 842 /
// IFRS 16), 7 (ASC 606) and 10 (CECL) — this node is not itself a wave deliverable.
//
// RATE-SOLVE SCOPE, STATED HONESTLY: solve_rate is supported only for convention
// UNIT_PERIOD. The bracketed-bisection solver (bundle solveRate()) treats each
// payment as landing at an ORDINAL integer period (1, 2, 3, ...), which is exactly
// what UNIT_PERIOD's period_fraction=1-per-whole-period already assumes. A calendar
// convention's period_fraction is a real-valued fraction of a year that need not
// align with ordinal integer periods (a 30/360 month is not exactly 1/12 of every
// year), so solving a rate against calendar-convention cash flows via the same
// ordinal-period PV formula would silently mismatch the schedule it is later fed
// into. Rather than build a second, day-count-aware PV formula (which the build
// spec's "no engine transcendentals" bound and its own explicit "reuse the art-215
// discipline" instruction do not ask for), this node declares the scope narrowly:
// calendar conventions always take a caller-supplied annual_rate.

/* ===== inlined _amort (RISC0 guest provides only _hash; bundle import is unavailable in-guest) ===== */
const _amort = (function () {
'use strict';

// ===================== date arithmetic (pure integer y/m/d, no Date object,
// no timezone ambiguity — every convention below is defined purely in terms
// of calendar year/month/day integers per ISDA 2006 Definitions Sec 4.16) ====

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
// ACT_ACT_ISDA. Math.floor is IEEE-754 exact and bit-portable.
function toJDN(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

function actualDays(d1, d2) {
  return toJDN(d2.y, d2.m, d2.d) - toJDN(d1.y, d1.m, d1.d);
}

// ===================== day-count conventions (build spec Sec 1.1) ==========
//
// Clause snapshot: research/clause-snapshots/isda-2006-definitions-section-4.16.txt
// (six calendar conventions, subsections (b),(d),(e),(f),(g),(h) of Sec 4.16).
// research/clause-snapshots/reg-z-appendix-j-b6-b7.txt (UNIT_PERIOD stub
// pricing precedent, 12 CFR 1026 Appendix J (b)(6), reused by art-215).

const CONVENTIONS = Object.freeze([
  'UNIT_PERIOD', '30_360_US', '30E_360', '30E_360_ISDA',
  'ACT_360', 'ACT_365F', 'ACT_ACT_ISDA',
]);

// ISDA Sec 4.16(f) "30/360"/"Bond Basis": D1 capped at 30 when 31; D2 capped
// at 30 when 31 AND D1 > 29 (the US end-of-month coupling between D1 and D2).
function dcf30_360_US(d1, d2) {
  let D1 = d1.d, D2 = d2.d;
  if (D1 === 31) D1 = 30;
  if (D2 === 31 && D1 > 29) D2 = 30;
  return (360 * (d2.y - d1.y) + 30 * (d2.m - d1.m) + (D2 - D1)) / 360;
}

// ISDA Sec 4.16(g) "30E/360"/"Eurobond Basis": D1 and D2 each capped at 30
// unconditionally when 31 — no cross-coupling between D1 and D2.
function dcf30E_360(d1, d2) {
  const D1 = d1.d === 31 ? 30 : d1.d;
  const D2 = d2.d === 31 ? 30 : d2.d;
  return (360 * (d2.y - d1.y) + 30 * (d2.m - d1.m) + (D2 - D1)) / 360;
}

// ISDA Sec 4.16(h) "30E/360 (ISDA)": D1 capped at 30 when it is the last day
// of February OR would be 31. D2 capped at 30 when it is the last day of
// February AND NOT the Termination Date, OR would be 31.
function dcf30E_360_ISDA(d1, d2, opts) {
  const D1 = (isLastDayOfFeb(d1) || d1.d === 31) ? 30 : d1.d;
  const d2IsFebEnd = isLastDayOfFeb(d2) && !(opts && opts.isTerminationDate);
  const D2 = (d2IsFebEnd || d2.d === 31) ? 30 : d2.d;
  return (360 * (d2.y - d1.y) + 30 * (d2.m - d1.m) + (D2 - D1)) / 360;
}

// ISDA Sec 4.16(e) "Actual/360".
function dcfACT_360(d1, d2) { return actualDays(d1, d2) / 360; }

// ISDA Sec 4.16(d) "Actual/365 (Fixed)".
function dcfACT_365F(d1, d2) { return actualDays(d1, d2) / 365; }

// ISDA Sec 4.16(b) "Actual/Actual (ISDA)": split the period at every calendar
// year boundary; each whole or partial calendar-year chunk is divided by 366
// if that calendar year is a leap year, else 365; the chunks are summed. A
// calendar year cannot be partially leap (leap-ness is a whole-year property),
// so per-year chunking is exactly the clause's own "sum of leap-year portion
// /366 + non-leap portion /365" rule, not an approximation of it.
function dcfACT_ACT_ISDA(d1, d2) {
  if (d1.y === d2.y) {
    const denom = isLeapYear(d1.y) ? 366 : 365;
    return actualDays(d1, d2) / denom;
  }
  let frac = actualDays(d1, { y: d1.y + 1, m: 1, d: 1 }) / (isLeapYear(d1.y) ? 366 : 365);
  for (let y = d1.y + 1; y < d2.y; y++) {
    frac += 1; // a full calendar year's actual days over its own leap/non-leap denominator is exactly 1
  }
  frac += actualDays({ y: d2.y, m: 1, d: 1 }, d2) / (isLeapYear(d2.y) ? 366 : 365);
  return frac;
}

// UNIT_PERIOD (build spec Sec 1.1): NOT a calendar day count. A whole unit
// period's fraction is exactly 1; a stub period's fraction is the DECLARED
// stub_fraction the caller supplies (never derived from dates) — the same
// "fraction of a unit-period, priced by multiplying, never re-derived from a
// calendar" shape as 12 CFR 1026 Appendix J (b)(6), reused here as precedent
// for treating the stub as a declared input rather than a computed calendar
// quantity.
function dcfUNIT_PERIOD(unitFraction) {
  const f = unitFraction == null ? 1 : unitFraction;
  if (!(f > 0 && f <= 1)) return null; // an out-of-range stub fraction is a caller error, not silently clamped
  return f;
}

function dayCountFraction(convention, d1, d2, opts) {
  switch (convention) {
    case '30_360_US': return dcf30_360_US(d1, d2);
    case '30E_360': return dcf30E_360(d1, d2);
    case '30E_360_ISDA': return dcf30E_360_ISDA(d1, d2, opts);
    case 'ACT_360': return dcfACT_360(d1, d2);
    case 'ACT_365F': return dcfACT_365F(d1, d2);
    case 'ACT_ACT_ISDA': return dcfACT_ACT_ISDA(d1, d2);
    case 'UNIT_PERIOD': return dcfUNIT_PERIOD(opts && opts.unitFraction);
    default: return null;
  }
}

// ===================== rounding (declared modes only, no Math.pow) =========

// Exact powers of ten up to 1e12 — safe-integer doubles, zero float error,
// used instead of Math.pow(10, n) so no transcendental-routed call appears
// anywhere in the rounding path (SPEC.md §18.5).
const POW10 = [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12];

function roundAt(v, precision, mode) {
  if (!Number.isFinite(v)) return v;
  const p = precision >= 0 && precision < POW10.length ? precision : 0;
  const scale = POW10[p];
  const scaled = v * scale;
  let r;
  switch (mode) {
    case 'half_up': {
      const sign = scaled < 0 ? -1 : 1;
      r = sign * Math.floor(Math.abs(scaled) + 0.5);
      break;
    }
    case 'floor': r = Math.floor(scaled); break;
    case 'ceiling': r = Math.ceil(scaled); break;
    case 'truncate': r = scaled < 0 ? Math.ceil(scaled) : Math.floor(scaled); break;
    default: r = scaled;
  }
  return r / scale;
}

// ===================== bracketed-bisection rate solve (build spec Sec 1.2) =
//
// DISCIPLINE REUSED FROM art-215 (bytes NOT transliterated — this module is
// convention-agnostic where art-215 is Reg-Z-specific, generalized per the
// build spec's own instruction): bracketed bisection only (no Newton/secant/
// fixed-point — not bracket-guaranteed, input-dependent divergence); a
// CONSTANT iteration bound (200, matching art-215's BISECT_STEPS) plus a
// width target, never a `while (!converged)` loop; a sign-change bracket
// MUST be established before any rate is reported, else `rate: null` plus a
// named error code and explicit `converged`/`bracketed` booleans.

const BISECT_STEPS = 200;
const RATE_WIDTH_TARGET = 1e-9; // periodic-rate bracket width
const HI_CAP = 100; // periodic-rate ceiling for the bracket search

// base^n for integer n >= 0, by exponentiation by squaring (art-215's own
// powInt, reused verbatim as a technique — this is the ONE exponentiation
// this module performs, and it is always integer-exponent, IEEE-portable).
function powInt(base, n) {
  if (!Number.isFinite(base) || !Number.isFinite(n)) return 0;
  let e = Math.round(n);
  if (e < 0) e = 0;
  let r = 1, b = base;
  while (e > 0) {
    if (e % 2 === 1) r *= b;
    b *= b;
    e = Math.floor(e / 2);
  }
  return r;
}

// Present value of one flow {amount, full, frac} at periodic rate i: the
// integer-period portion compounds ((1+i)^full via powInt), the fractional
// stub is priced at SIMPLE interest (1 + frac*i) — the same shape as
// art-215's pvFlow, generalized away from its Reg-Z-only naming.
function pvFlow(flow, i) {
  const den = (1 + flow.frac * i) * powInt(1 + i, flow.full);
  if (!Number.isFinite(den) || den === 0) return NaN;
  return flow.amount / den;
}

function pvSum(flows, i) {
  let s = 0;
  for (const f of flows) s += pvFlow(f, i);
  return s;
}

function residual(advances, payments, i) {
  return pvSum(payments, i) - pvSum(advances, i);
}

const NO_RATE = { rate: null, converged: false, bracketed: false, iterations: 0, error: 'RATE_NOT_BRACKETED' };

function solveRate(advances, payments) {
  let rateDependent = false;
  for (const p of payments) {
    if (p.amount !== 0 && (p.full > 0 || p.frac > 0)) { rateDependent = true; break; }
  }
  if (!rateDependent) return NO_RATE;

  const g0 = residual(advances, payments, 0);
  if (!Number.isFinite(g0)) return NO_RATE;
  if (g0 < 0) return NO_RATE; // a non-negative implied charge is required for a non-negative root

  let lo = 0, hi = 1e-9, found = false;
  if (g0 === 0) { found = true; hi = 0; }
  while (!found && hi <= HI_CAP) {
    const ghi = residual(advances, payments, hi);
    if (!Number.isFinite(ghi)) break;
    if (ghi <= 0) { found = true; break; }
    lo = hi;
    hi *= 2;
  }
  if (!found) return NO_RATE;

  let iters = 0;
  while (iters < BISECT_STEPS && (hi - lo) > RATE_WIDTH_TARGET) {
    const mid = lo + (hi - lo) / 2;
    if (mid <= lo || mid >= hi) break; // float resolution exhausted
    const gm = residual(advances, payments, mid);
    if (!Number.isFinite(gm)) break;
    if (gm >= 0) lo = mid; else hi = mid;
    iters++;
  }
  const converged = (hi - lo) <= RATE_WIDTH_TARGET;
  if (!converged) {
    return { rate: null, converged: false, bracketed: true, iterations: iters, error: 'RATE_DID_NOT_CONVERGE' };
  }
  const i = lo + (hi - lo) / 2;
  return { rate: i, converged: true, bracketed: true, iterations: iters, error: null };
}

// ===================== effective-interest schedule (build spec Sec 1.2) ====
//
// Per period, in order (each one an independently-divergent rounding_steps
// entry per build spec Sec 1.4):
//   1. period_fraction   — the day-count fraction of a year for this period
//                          (or the declared unit fraction for UNIT_PERIOD).
//   2. periodic_rate     — annual_rate * period_fraction (the "annual rate
//                          into a per-period rate" derivation).
//   3. interest          — opening_balance * periodic_rate.
//   4. principal_component — payment - interest.
//   5. closing_balance   — opening_balance - principal_component.
//
// `periods` is an array of period descriptors:
//   calendar conventions: { start: "YYYY-MM-DD", end: "YYYY-MM-DD", payment, is_termination? }
//   UNIT_PERIOD:          { unit_fraction?: number in (0,1], payment, is_termination? }
//
// Bounds (build spec Sec 1.5): MAX_PERIODS = 600, enforced by the caller
// before invoking schedule() — this function itself is a pure per-period
// loop with no unbounded recursion or dynamic loop target.

const MAX_PERIODS = 600;
const MAX_SEGMENTS = 8;

function schedule(params) {
  const {
    principal, annual_rate, convention, periods,
    day_count_precision = 10, rate_precision = 10, money_precision = 2,
    periods_per_year = 12,
  } = params;

  if (!CONVENTIONS.includes(convention)) return { error: 'UNKNOWN_CONVENTION' };
  if (!Array.isArray(periods) || periods.length === 0) return { error: 'NO_PERIODS' };
  if (periods.length > MAX_PERIODS) return { error: 'MAX_PERIODS_EXCEEDED' };

  const rows = [];
  let opening = principal;

  for (let idx = 0; idx < periods.length; idx++) {
    const p = periods[idx];
    let period_fraction;
    if (convention === 'UNIT_PERIOD') {
      period_fraction = dcfUNIT_PERIOD(p.unit_fraction);
    } else {
      const d1 = parseISODate(p.start);
      const d2 = parseISODate(p.end);
      if (!d1 || !d2) return { error: 'INVALID_DATE' };
      period_fraction = dayCountFraction(convention, d1, d2, { isTerminationDate: !!p.is_termination });
    }
    if (period_fraction === null || !Number.isFinite(period_fraction)) return { error: 'INVALID_PERIOD_FRACTION', period_index: idx };
    period_fraction = roundAt(period_fraction, day_count_precision, 'half_up');

    // UNIT_PERIOD's period_fraction is a fraction of ONE unit period (1 for a
    // whole period), not of a year, so its periodic rate must be derived via
    // periods_per_year; every calendar convention's period_fraction is
    // already a fraction of a year and needs no further division.
    const periodic_rate = convention === 'UNIT_PERIOD'
      ? roundAt((annual_rate / periods_per_year) * period_fraction, rate_precision, 'half_up')
      : roundAt(annual_rate * period_fraction, rate_precision, 'half_up');
    const interest = roundAt(opening * periodic_rate, money_precision, 'half_up');
    const payment = Number(p.payment) || 0;
    const principal_component = roundAt(payment - interest, money_precision, 'half_up');
    const closing_balance = roundAt(opening - principal_component, money_precision, 'half_up');

    rows.push({
      index: idx, opening_balance: opening, period_fraction, periodic_rate,
      interest, payment, principal_component, closing_balance,
    });
    opening = closing_balance;
  }
  return { rows, error: null };
}

// Final-period plug (build spec Sec 1.4, mandatory whenever the schedule is
// intended to amortize to zero): rounding residue accumulated across N
// periods is absorbed in the LAST period's principal_component so the
// closing balance is exactly zero. A residue exceeding `maxPlug` is an error
// output, never a silent adjustment.
function applyFinalPlug(rows, maxPlug, moneyPrecision) {
  if (!Array.isArray(rows) || rows.length === 0) return { rows, plug: 0, plug_applied: false, plug_error: false };
  const last = rows[rows.length - 1];
  const residue = last.closing_balance;
  if (residue === 0) return { rows, plug: 0, plug_applied: false, plug_error: false };
  if (Math.abs(residue) > maxPlug) return { rows, plug: residue, plug_applied: false, plug_error: true };
  const pluggedLast = {
    ...last,
    principal_component: roundAt(last.principal_component + residue, moneyPrecision, 'half_up'),
    closing_balance: 0,
  };
  const newRows = rows.slice(0, -1).concat([pluggedLast]);
  return { rows: newRows, plug: residue, plug_applied: true, plug_error: false };
}

// ===================== mid-stream remeasurement (build spec Sec 1.3) =======
//
// SEGMENTATION, not mutation: the new segment's opening balance is the prior
// segment's closing balance at the remeasurement point, byte-identical at
// declared precision, never "within tolerance." The prior segment is
// returned unmodified alongside the new one — never overwritten.

function remeasure(priorRows, remeasurementIndex, revisedParams) {
  if (!Array.isArray(priorRows) || priorRows.length === 0) return { error: 'NO_PRIOR_SCHEDULE' };
  if (!(remeasurementIndex >= 0 && remeasurementIndex < priorRows.length)) return { error: 'REMEASUREMENT_INDEX_OUT_OF_RANGE' };

  const openingBalance = priorRows[remeasurementIndex].closing_balance;
  const result = schedule({ ...revisedParams, principal: openingBalance });
  if (result.error) return result;

  const continuity_invariant = result.rows.length > 0 && result.rows[0].opening_balance === openingBalance;
  return {
    prior_segment: priorRows,
    new_segment: result.rows,
    opening_balance: openingBalance,
    continuity_invariant,
    error: null,
  };
}

return Object.freeze({
  CONVENTIONS, MAX_PERIODS, MAX_SEGMENTS, BISECT_STEPS,
  parseISODate, isLeapYear, actualDays, dayCountFraction,
  roundAt, powInt, solveRate, schedule, applyFinalPlug, remeasure,
});
})();
/* ===== END inlined _amort ===== */

const {
  CONVENTIONS, MAX_PERIODS, MAX_SEGMENTS,
  schedule: amortSchedule, applyFinalPlug, remeasure: amortRemeasure, solveRate,
} = _amort;

const DAY_COUNT_PRECISION = 10;
const RATE_PRECISION = 10;
const MONEY_PRECISION = 2;
const DEFAULT_MAX_PLUG = 1; // one currency unit, declared

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }

// The six declared rounding_steps entries (build spec Sec 1.4): five per-period
// arithmetic steps plus the mandatory sixth final-period plug. `oracle` is
// "declared — clause silent" for every step because none of the day-count
// clauses (ISDA Sec 4.16, Reg Z Appendix J (b)(6)) prescribes an intermediate
// rounding mode for a schedule built on top of them — the day-count clauses
// define the FRACTION, never the schedule's own money rounding.
function roundingSteps() {
  return [
    { step: 'period_fraction (day-count fraction, or declared UNIT_PERIOD fraction)', mode: 'half_up', precision: DAY_COUNT_PRECISION, oracle: 'declared — clause silent' },
    { step: 'periodic_rate = annual_rate * period_fraction (calendar) or (annual_rate/periods_per_year) * period_fraction (UNIT_PERIOD)', mode: 'half_up', precision: RATE_PRECISION, oracle: 'declared — clause silent' },
    { step: 'interest = opening_balance * periodic_rate', mode: 'half_up', precision: MONEY_PRECISION, oracle: 'declared — clause silent' },
    { step: 'principal_component = payment - interest', mode: 'half_up', precision: MONEY_PRECISION, oracle: 'declared — clause silent' },
    { step: 'closing_balance = opening_balance - principal_component', mode: 'half_up', precision: MONEY_PRECISION, oracle: 'declared — clause silent' },
    { step: 'final-period plug: residual closing_balance absorbed into the last principal_component so the schedule amortizes to exactly zero', mode: 'half_up', precision: MONEY_PRECISION, oracle: 'declared — clause silent' },
  ];
}

function buildOrdinalFlows(principal, periods) {
  const advances = [{ amount: principal, full: 0, frac: 0 }];
  const payments = periods.map((p, idx) => ({ amount: safeNum(p.payment, 0), full: idx + 1, frac: 0 }));
  return { advances, payments };
}

export function compute(pp) {
  pp = pp || {};
  const compliance_flags = [];

  const convention = CONVENTIONS.includes(pp.convention) ? pp.convention : null;
  if (!convention) {
    return {
      output_payload: {
        convention: pp.convention ?? null, schedule: null, rate_solve: null,
        final_plug: null, remeasurement: null, rounding_steps: roundingSteps(),
        bounds: { max_periods: MAX_PERIODS, max_segments: MAX_SEGMENTS, periods_used: 0, segments_used: 0 },
        day_count_source: null,
        note: 'convention must be one of the seven closed day-count modes (build spec Sec 1.1).',
      },
      compliance_flags: ['UNKNOWN_CONVENTION'],
    };
  }

  const periods = Array.isArray(pp.periods) ? pp.periods : [];
  const periods_per_year = Math.max(1, safeNum(pp.periods_per_year, 12));
  const principal = safeNum(pp.principal, 0);
  const max_plug = safeNum(pp.max_plug, DEFAULT_MAX_PLUG);

  if (periods.length > MAX_PERIODS) {
    compliance_flags.push('MAX_PERIODS_EXCEEDED');
    return {
      output_payload: {
        convention, schedule: null, rate_solve: null, final_plug: null, remeasurement: null,
        rounding_steps: roundingSteps(),
        bounds: { max_periods: MAX_PERIODS, max_segments: MAX_SEGMENTS, periods_used: periods.length, segments_used: 0 },
        day_count_source: convention === 'UNIT_PERIOD'
          ? '12 CFR 1026 Appendix J (b)(6) — declared unit-period stub fraction, precedent only'
          : 'ISDA 2006 Definitions Section 4.16',
        note: `periods.length (${periods.length}) exceeds MAX_PERIODS (${MAX_PERIODS}); no schedule computed.`,
      },
      compliance_flags,
    };
  }

  // Rate solve (scoped to UNIT_PERIOD only — see the file-header note).
  let rate_solve = null;
  let annual_rate = safeNum(pp.annual_rate, NaN);
  if (pp.solve_rate === true) {
    if (convention !== 'UNIT_PERIOD') {
      compliance_flags.push('RATE_SOLVE_SCOPED_TO_UNIT_PERIOD');
      rate_solve = { solved: false, periodic_rate: null, annual_rate_equivalent: null, converged: false, bracketed: false, iterations: 0, error: 'RATE_SOLVE_SCOPED_TO_UNIT_PERIOD' };
      annual_rate = NaN;
    } else {
      const { advances, payments } = buildOrdinalFlows(principal, periods);
      const solved = solveRate(advances, payments);
      rate_solve = {
        solved: solved.converged && solved.bracketed,
        periodic_rate: solved.rate,
        annual_rate_equivalent: solved.rate === null ? null : solved.rate * periods_per_year,
        converged: solved.converged, bracketed: solved.bracketed,
        iterations: solved.iterations, error: solved.error,
      };
      if (!solved.bracketed) compliance_flags.push('RATE_NOT_BRACKETED');
      else if (!solved.converged) compliance_flags.push('RATE_DID_NOT_CONVERGE');
      annual_rate = rate_solve.annual_rate_equivalent === null ? NaN : rate_solve.annual_rate_equivalent;
    }
  }

  if (!Number.isFinite(annual_rate)) {
    return {
      output_payload: {
        convention, schedule: null, rate_solve, final_plug: null, remeasurement: null,
        rounding_steps: roundingSteps(),
        bounds: { max_periods: MAX_PERIODS, max_segments: MAX_SEGMENTS, periods_used: periods.length, segments_used: 0 },
        day_count_source: convention === 'UNIT_PERIOD'
          ? '12 CFR 1026 Appendix J (b)(6) — declared unit-period stub fraction, precedent only'
          : 'ISDA 2006 Definitions Section 4.16',
        note: 'No usable annual_rate: either annual_rate was not supplied, or solve_rate was requested but did not bracket/converge.',
      },
      compliance_flags: compliance_flags.length ? compliance_flags : ['RATE_NOT_BRACKETED'],
    };
  }

  const primary = amortSchedule({
    principal, annual_rate, convention, periods, periods_per_year,
    day_count_precision: DAY_COUNT_PRECISION, rate_precision: RATE_PRECISION, money_precision: MONEY_PRECISION,
  });
  if (primary.error) {
    compliance_flags.push(primary.error);
    return {
      output_payload: {
        convention, schedule: null, rate_solve, final_plug: null, remeasurement: null,
        rounding_steps: roundingSteps(),
        bounds: { max_periods: MAX_PERIODS, max_segments: MAX_SEGMENTS, periods_used: periods.length, segments_used: 0 },
        day_count_source: convention === 'UNIT_PERIOD'
          ? '12 CFR 1026 Appendix J (b)(6) — declared unit-period stub fraction, precedent only'
          : 'ISDA 2006 Definitions Section 4.16',
        note: `schedule() reported ${primary.error}.`,
      },
      compliance_flags,
    };
  }

  const doPlug = pp.apply_final_plug !== false;
  const primaryPlugged = doPlug ? applyFinalPlug(primary.rows, max_plug, MONEY_PRECISION) : { rows: primary.rows, plug: 0, plug_applied: false, plug_error: false };
  if (primaryPlugged.plug_error) compliance_flags.push('FINAL_PLUG_EXCEEDS_BOUND');

  // Mid-stream remeasurement (segmentation, build spec Sec 1.3) — optional.
  let remeasurement = null;
  let segments_used = 1;
  if (pp.remeasurement && Number.isInteger(pp.remeasurement.at_period_index)) {
    const rm = pp.remeasurement;
    const revisedConvention = CONVENTIONS.includes(rm.convention) ? rm.convention : convention;
    const revisedPeriods = Array.isArray(rm.periods) ? rm.periods : [];
    const rmResult = amortRemeasure(primaryPlugged.rows, rm.at_period_index, {
      annual_rate: safeNum(rm.annual_rate, annual_rate),
      convention: revisedConvention,
      periods: revisedPeriods,
      periods_per_year: safeNum(rm.periods_per_year, periods_per_year),
      day_count_precision: DAY_COUNT_PRECISION, rate_precision: RATE_PRECISION, money_precision: MONEY_PRECISION,
    });
    if (rmResult.error) {
      compliance_flags.push(rmResult.error);
    } else {
      segments_used = 2;
      const newPlugged = doPlug ? applyFinalPlug(rmResult.new_segment, max_plug, MONEY_PRECISION) : { rows: rmResult.new_segment, plug: 0, plug_applied: false, plug_error: false };
      if (newPlugged.plug_error) compliance_flags.push('FINAL_PLUG_EXCEEDS_BOUND');
      if (!rmResult.continuity_invariant) compliance_flags.push('CONTINUITY_INVARIANT_FAILED');
      remeasurement = {
        opening_balance: rmResult.opening_balance,
        continuity_invariant: rmResult.continuity_invariant,
        new_segment: newPlugged.rows,
        final_plug: { applied: newPlugged.plug_applied, amount: newPlugged.plug, max_plug, error: newPlugged.plug_error },
      };
    }
  }
  if (segments_used > MAX_SEGMENTS) compliance_flags.push('MAX_SEGMENTS_EXCEEDED');

  const output_payload = {
    convention,
    periods_per_year,
    schedule: primaryPlugged.rows,
    rate_solve,
    final_plug: { applied: primaryPlugged.plug_applied, amount: primaryPlugged.plug, max_plug, error: primaryPlugged.plug_error },
    remeasurement,
    rounding_steps: roundingSteps(),
    bounds: { max_periods: MAX_PERIODS, max_segments: MAX_SEGMENTS, periods_used: periods.length, segments_used },
    day_count_source: convention === 'UNIT_PERIOD'
      ? '12 CFR 1026 Appendix J (b)(6) — declared unit-period stub fraction, precedent only, not a Reg Z APR claim'
      : 'ISDA 2006 Definitions Section 4.16',
    note: 'Deterministic amortization schedule via the effective-interest method: period_fraction from a declared day-count convention (UNIT_PERIOD, or one of six ISDA 2006 Definitions Sec 4.16 calendar conventions), periodic_rate derived from annual_rate, interest/principal/closing per period, and a mandatory final-period plug when the schedule amortizes to zero. Remeasurement is schedule SEGMENTATION, never mutation: a new segment always opens at the prior segment\'s exact closing balance. Bracketed-bisection rate solve is scoped to UNIT_PERIOD only. Demonstrator for the shared _amort.bundle.mjs kernel (ACCT-AMORT-K-1); not itself a wave-specific ASC 842 / ASC 606 / CECL tool.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
