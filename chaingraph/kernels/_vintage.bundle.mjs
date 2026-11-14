// _vintage.bundle.mjs - shared as-of reader for dated facts (VINTAGE-ASOF-1).
//
// PURPOSE: a NEW node that depends on a number which expires (a wage base, a
// contribution limit, a threshold) reads that number by AS-OF DATE and puts the
// vintage it used into its output_payload, so a receipt states which year's
// value it computed with. A verifier can then compare the stated vintage to a
// dated table instead of guessing.
//
// WHAT IT IS: a pure function over DATA the caller supplies. The entries are
// vintage records of the shape
//   { fact, vintage, value, effective_from, effective_to | null, corrects? }
// (extra keys are ignored). The caller passes the entries through
// policy_parameters, so they are inside the execution_hash preimage and the
// receipt stays reproducible. The as-of date is an INPUT too.
//
// WHAT IT IS NOT: it reads no clock, no file, no network, and it carries no
// table of its own. It does not decide which as-of date a node should use, and
// it does not fetch a new year's value. Existing nodes do not import it, so no
// existing kernel digest moves.
//
// SELECTION RULE: an entry applies to a date when
//   effective_from <= asOf  and  (effective_to is null  or  asOf <= effective_to)
// (both bounds inclusive). An entry named by another matching entry's
// `corrects` (same fact, matching vintage id) is dropped, so a correction wins
// over the value it corrects. If exactly one entry remains it is returned.
// Zero or several is a structured refusal, never a silent default.
//
// NO Date OBJECT, NO Date.parse: dates are checked as YYYY-MM-DD triples and
// compared as strings, which orders correctly for four-digit years.
// GUEST-BUILTIN-GATE-1: no TextEncoder/atob/btoa/URL anywhere below.
//
// COMPOSITION CONTRACT: consuming kernels inline the IIFE below verbatim
// between sentinel comments and destructure the local `_vintage` const; the
// RISC0 guest provides only `_hash`, so this is never imported at runtime. The
// export line at the bottom sits outside the inlined region.

const _vintage = (function () {
'use strict';

const REFUSAL = Object.freeze({
  BAD_DATE: 'REFUSED_BAD_DATE',
  BAD_FACT: 'REFUSED_BAD_FACT',
  BAD_ENTRIES: 'REFUSED_BAD_ENTRIES',
  UNKNOWN_FACT: 'REFUSED_UNKNOWN_FACT',
  NO_VINTAGE: 'REFUSED_NO_VINTAGE_FOR_DATE',
  AMBIGUOUS: 'REFUSED_AMBIGUOUS_VINTAGE',
});

function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0); }

// True only for a real calendar date written YYYY-MM-DD.
function isIsoDate(s) {
  if (typeof s !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return false;
  const dim = [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
  return d <= dim;
}

function refuse(code, detail) { return { status: code, detail }; }

function entryWellFormed(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return false;
  if (typeof e.fact !== 'string' || e.fact === '') return false;
  if (typeof e.vintage !== 'string' || e.vintage === '') return false;
  if (!Object.prototype.hasOwnProperty.call(e, 'value') || e.value === undefined) return false;
  if (!isIsoDate(e.effective_from)) return false;
  if (e.effective_to !== null && !isIsoDate(e.effective_to)) return false;
  if (e.effective_to !== null && e.effective_to < e.effective_from) return false;
  return true;
}

// resolve(entries, fact, asOf) -> { status: 'OK', fact, vintage, value,
//   effective_from, effective_to } | { status: <REFUSAL code>, detail }
function resolve(entries, fact, asOf) {
  if (!Array.isArray(entries) || !entries.every(entryWellFormed)) {
    return refuse(REFUSAL.BAD_ENTRIES, 'entries must be an array of well-formed vintage records');
  }
  if (typeof fact !== 'string' || fact === '') return refuse(REFUSAL.BAD_FACT, 'fact must be a non-empty string');
  if (!isIsoDate(asOf)) return refuse(REFUSAL.BAD_DATE, 'asOf must be a real YYYY-MM-DD date');

  const ofFact = entries.filter((e) => e.fact === fact);
  if (ofFact.length === 0) return refuse(REFUSAL.UNKNOWN_FACT, fact);

  const matching = ofFact.filter((e) =>
    e.effective_from <= asOf && (e.effective_to === null || asOf <= e.effective_to));
  const corrected = new Set(matching
    .filter((e) => typeof e.corrects === 'string')
    .map((e) => e.corrects));
  // A correcting entry carries `corrects`; the original it names (same vintage
  // id, no `corrects`) is dropped.
  const final = matching.filter((e) => typeof e.corrects === 'string' || !corrected.has(e.vintage));

  if (final.length === 0) return refuse(REFUSAL.NO_VINTAGE, fact + ' @ ' + asOf);
  if (final.length > 1) return refuse(REFUSAL.AMBIGUOUS, fact + ' @ ' + asOf);
  const w = final[0];
  return {
    status: 'OK',
    fact: w.fact,
    vintage: w.vintage,
    value: w.value,
    effective_from: w.effective_from,
    effective_to: w.effective_to,
  };
}

// stamp(resolved, asOf) -> the object a node puts in output_payload (under a key
// such as `vintage_used`). Stable key set, so the receipt states exactly which
// vintage fed the number. A refusal stamps as a refusal, never as a vintage.
function stamp(resolved, asOf) {
  if (!resolved || resolved.status !== 'OK') {
    return { fact: null, vintage: null, as_of: asOf, status: resolved ? resolved.status : REFUSAL.BAD_ENTRIES };
  }
  return {
    fact: resolved.fact,
    vintage: resolved.vintage,
    as_of: asOf,
    effective_from: resolved.effective_from,
    effective_to: resolved.effective_to,
    status: 'OK',
  };
}

return Object.freeze({ REFUSAL, isIsoDate, resolve, stamp });
})();

// Export retained ONLY for this bundle's own selftest. Consuming kernels
// inline the IIFE above and never import this file.
export { _vintage };
