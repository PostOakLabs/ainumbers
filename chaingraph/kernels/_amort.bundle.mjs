// _amort.bundle.mjs - deterministic amortization-schedule kernel (ACCT-AMORT-K-1).
//
// PURPOSE: a reusable, zero-import, guest-safe pure-JS module implementing:
//   - seven day-count conventions (ISDA 2006 Definitions Section 4.16, plus the
//     UNIT_PERIOD mode for lease/revenue schedules that discount over equal
//     periods rather than calendar day counts — see the clause snapshot for
//     the pinned source text of each formula).
//   - the effective-interest method: schedule(principal, periods, rate, convention)
//     producing, per period, opening_balance / period_fraction / periodic_rate /
//     interest / principal_component / closing_balance.
//   - a bracketed-bisection rate solver, reusing the DISCIPLINE of the existing
//     art-215 kernel (bracketed bisection only, a CONSTANT 200-step bound, a
//     required sign-change bracket before any rate is reported) generalized
//     from Reg Z Appendix J's specific PV formula to a general integer-periods
//     + fractional-stub compounding formula suitable for any of the seven
//     conventions here.
//   - mid-stream remeasurement as SEGMENTATION, never mutation: a new segment's
//     opening balance is the prior segment's closing balance at the
//     remeasurement point, byte-identical, never "within tolerance."
//
// NO ENGINE TRANSCENDENTALS (SPEC.md §18.5): every exponentiation in this
// module is an INTEGER exponent computed by repeated squaring (powInt below,
// same technique as art-215's own powInt), and every "round to N decimal
// places" step multiplies/divides by a literal power-of-ten from a
// precomputed table (POW10) rather than calling Math.pow. Only +, -, *, /,
// Math.floor, Math.ceil and Math.abs appear — all IEEE-754-bit-portable across
// V8 / QuickJS / RV32IM. If a future consumer needs continuous compounding,
// it inlines _detmath (RIDER-KERNEL) — never Math.pow/Math.exp/Math.log here.
//
// COMPOSITION CONTRACT (ACCT-INFRA-KERNELS-BUILD-SPEC.md §4): this bundle is
// inlined VERBATIM into consuming kernels between sentinel comments, never
// imported at runtime — the RISC0 guest provides only `_hash`. It carries no
// `meta`/`compute` export and is not itself an OCG node.
//
// GUEST-BUILTIN-GATE-1: no TextEncoder/atob/btoa/URL anywhere below.

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

// Export retained ONLY for this bundle's own PBT floor to import and exercise
// internals directly (chaingraph/kernels/__proptests__/art-626-*.proptest.mjs).
// Consuming kernels NEVER import this — they inline the IIFE above verbatim
// between sentinel comments and destructure the local `_amort` const, per the
// composition contract (ACCT-INFRA-KERNELS-BUILD-SPEC.md §4.1 rule 1). This
// export line sits OUTSIDE the inlined region by construction, so the
// inlined copy in art-626's kernel.mjs stays byte-identical to everything
// above it, sentinel to sentinel.
export { _amort };
