// _input.mjs -- shared typed input readers for OpenChainGraph kernels, plus an I-JSON
// refusal for compute() entry. KERNEL-INPUT-HELPER-1.
//
// PURPOSE: most audited kernel defects are input-validation classes: unsafe integers accepted
// and then buildArtifact throws; a present null or wrong type read as absent; numeric strings
// and booleans coerced; impossible calendar dates accepted; plain-object lookups and
// accumulators hit by prototype names; free text under unknown keys. Each reader here returns
// either { ok: true, value } or { ok: false, code, detail } and NEVER coerces. A kernel turns a
// refusal into its stated refusal output; it never substitutes a default.
//
// PRESENCE: absent means `=== undefined` (see isAbsent). A present null or wrong type is a
// refusal, not "missing". A reader handed undefined refuses with REFUSED_INPUT_MISSING; a
// caller with an optional field tests isAbsent(v) first.
//
// EXPORTS: readSafeInt, readFiniteNumber, readEnum, readCalendarDate, readString, ownKey,
// makeAccumulator, refuseIJson, isAbsent, REFUSAL.
//
// COMPOSITION CONTRACT: a kernel that runs in the RISC0 guest cannot import this module (the
// guest resolves only ./_hash.mjs). Consumers paste the body of this file VERBATIM between the
// sentinel comment
//   /* ===== inlined _input (RISC0 guest provides only _hash; bundle import is unavailable in-guest) ===== */
// and a destructure of what they need, exactly as the _detmath and _sha256 bundles do.
// scripts/check-inline-ssot-sync.mjs (manifest pair "input") keeps every pasted copy
// byte-identical to this file up to the ES export tail. NEVER import this module at runtime
// from a kernel. This file is `_`-prefixed and exports NO `meta`/`compute`.
//
// Zero-import, zero-network, zero-dependency. Pure JS only. No BigInt, no Date parsing.

const _input = (function () {
'use strict';

const REFUSAL = Object.freeze({
  MISSING: 'REFUSED_INPUT_MISSING',
  NULL: 'REFUSED_INPUT_NULL',
  WRONG_TYPE: 'REFUSED_INPUT_WRONG_TYPE',
  NOT_SAFE_INTEGER: 'REFUSED_INPUT_NOT_SAFE_INTEGER',
  NOT_FINITE: 'REFUSED_INPUT_NOT_FINITE',
  UNSAFE_MAGNITUDE: 'REFUSED_INPUT_UNSAFE_MAGNITUDE',
  OUT_OF_RANGE: 'REFUSED_INPUT_OUT_OF_RANGE',
  NOT_IN_ENUM: 'REFUSED_INPUT_NOT_IN_ENUM',
  BAD_DATE: 'REFUSED_INPUT_BAD_DATE',
  STRING_TOO_LONG: 'REFUSED_INPUT_STRING_TOO_LONG',
  IJSON_UNSAFE_INTEGER: 'REFUSED_IJSON_UNSAFE_INTEGER',
  IJSON_NON_FINITE: 'REFUSED_IJSON_NON_FINITE',
  IJSON_UNSUPPORTED_TYPE: 'REFUSED_IJSON_UNSUPPORTED_TYPE',
  IJSON_CYCLE: 'REFUSED_IJSON_CYCLE',
  IJSON_TOO_DEEP: 'REFUSED_IJSON_TOO_DEEP',
});

const IJSON_MAX_DEPTH = 512;

function ok(value) { return { ok: true, value }; }
function refuse(code, detail) { return { ok: false, code, detail: detail === undefined ? '' : String(detail) }; }

// Shared presence gate: undefined and null never reach a typed check as a value.
function gate(v) {
  if (v === undefined) return refuse(REFUSAL.MISSING, 'value is absent');
  if (v === null) return refuse(REFUSAL.NULL, 'value is null');
  return null;
}

function isAbsent(v) { return v === undefined; }

function boundsRefusal(n, opts) {
  if (opts && opts.min !== undefined && n < opts.min) return refuse(REFUSAL.OUT_OF_RANGE, 'below minimum ' + opts.min);
  if (opts && opts.max !== undefined && n > opts.max) return refuse(REFUSAL.OUT_OF_RANGE, 'above maximum ' + opts.max);
  return null;
}

function readSafeInt(v, opts) {
  const g = gate(v); if (g) return g;
  if (typeof v !== 'number') return refuse(REFUSAL.WRONG_TYPE, 'expected a number, got ' + typeof v);
  if (!Number.isFinite(v)) return refuse(REFUSAL.NOT_FINITE, 'not a finite number');
  if (!Number.isSafeInteger(v)) return refuse(REFUSAL.NOT_SAFE_INTEGER, 'not a safe integer');
  const b = boundsRefusal(v, opts); if (b) return b;
  return ok(v);
}

function readFiniteNumber(v, opts) {
  const g = gate(v); if (g) return g;
  if (typeof v !== 'number') return refuse(REFUSAL.WRONG_TYPE, 'expected a number, got ' + typeof v);
  if (!Number.isFinite(v)) return refuse(REFUSAL.NOT_FINITE, 'not a finite number');
  // An integer-valued number beyond 2^53 would make buildArtifact throw, so compute refuses it.
  if (Number.isInteger(v) && !Number.isSafeInteger(v)) return refuse(REFUSAL.UNSAFE_MAGNITUDE, 'integer magnitude beyond 2^53');
  const b = boundsRefusal(v, opts); if (b) return b;
  return ok(v);
}

// Exact membership on the raw string: no trim, no case-fold, no default.
function readEnum(v, allowed) {
  const g = gate(v); if (g) return g;
  if (typeof v !== 'string') return refuse(REFUSAL.WRONG_TYPE, 'expected a string, got ' + typeof v);
  if (!Array.isArray(allowed) || allowed.indexOf(v) === -1) return refuse(REFUSAL.NOT_IN_ENUM, 'not an allowed value');
  return ok(v);
}

function daysInMonth(y, m) {
  if (m === 2) return (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28;
  return (m === 4 || m === 6 || m === 9 || m === 11) ? 30 : 31;
}

// Strict YYYY-MM-DD plus the days-in-month and leap rule. 2026-02-31 refuses.
function readCalendarDate(v) {
  const g = gate(v); if (g) return g;
  if (typeof v !== 'string') return refuse(REFUSAL.WRONG_TYPE, 'expected a string, got ' + typeof v);
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(v);
  if (!m) return refuse(REFUSAL.BAD_DATE, 'not YYYY-MM-DD');
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (y < 1 || mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return refuse(REFUSAL.BAD_DATE, 'not a calendar date');
  return ok(v);
}

function readString(v, opts) {
  const g = gate(v); if (g) return g;
  if (typeof v !== 'string') return refuse(REFUSAL.WRONG_TYPE, 'expected a string, got ' + typeof v);
  if (opts && opts.maxLen !== undefined && v.length > opts.maxLen) return refuse(REFUSAL.STRING_TOO_LONG, 'longer than ' + opts.maxLen);
  return ok(v);
}

// Own-property lookup only: a prototype name returns undefined, never an inherited value.
function ownKey(obj, k) {
  if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function')) return undefined;
  return Object.prototype.hasOwnProperty.call(obj, k) ? obj[k] : undefined;
}

// Map-backed accumulator: caller-chosen keys such as __proto__, constructor and toString are
// ordinary keys. entries() preserves first-seen order.
function makeAccumulator() {
  const m = new Map();
  return {
    add(k, n) { m.set(k, (m.has(k) ? m.get(k) : 0) + n); },
    set(k, v) { m.set(k, v); },
    get(k) { return m.has(k) ? m.get(k) : undefined; },
    has(k) { return m.has(k); },
    size() { return m.size; },
    entries() { return Array.from(m.entries()); },
  };
}

// Refuse any input buildArtifact() (via _hash.mjs assertIJson / jcsStringify) would throw on or
// canonicalize unstably. Returns null when clean, else { ok:false, code, detail, path }.
function refuseIJson(value) {
  const stack = [];
  function walk(v, depth, path) {
    if (depth > IJSON_MAX_DEPTH) return { ok: false, code: REFUSAL.IJSON_TOO_DEEP, detail: 'nesting beyond ' + IJSON_MAX_DEPTH, path };
    const t = typeof v;
    if (v === null || t === 'string' || t === 'boolean') return null;
    if (t === 'number') {
      if (!Number.isFinite(v)) return { ok: false, code: REFUSAL.IJSON_NON_FINITE, detail: 'non-finite number', path };
      if (Number.isInteger(v) && !Number.isSafeInteger(v)) return { ok: false, code: REFUSAL.IJSON_UNSAFE_INTEGER, detail: 'integer beyond 2^53', path };
      return null;
    }
    if (t !== 'object') return { ok: false, code: REFUSAL.IJSON_UNSUPPORTED_TYPE, detail: t, path };
    if (stack.indexOf(v) !== -1) return { ok: false, code: REFUSAL.IJSON_CYCLE, detail: 'cyclic reference', path };
    stack.push(v);
    let r = null;
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length && !r; i++) r = walk(v[i], depth + 1, path + '[' + i + ']');
    } else {
      const keys = Object.keys(v);
      for (let i = 0; i < keys.length && !r; i++) r = walk(v[keys[i]], depth + 1, path + '.' + keys[i]);
    }
    stack.pop();
    return r;
  }
  return walk(value, 1, '$');
}

return {
  REFUSAL, isAbsent, readSafeInt, readFiniteNumber, readEnum, readCalendarDate, readString,
  ownKey, makeAccumulator, refuseIJson,
};
})();

export const REFUSAL = _input.REFUSAL;
export const isAbsent = _input.isAbsent;
export const readSafeInt = _input.readSafeInt;
export const readFiniteNumber = _input.readFiniteNumber;
export const readEnum = _input.readEnum;
export const readCalendarDate = _input.readCalendarDate;
export const readString = _input.readString;
export const ownKey = _input.ownKey;
export const makeAccumulator = _input.makeAccumulator;
export const refuseIJson = _input.refuseIJson;
export default _input;
