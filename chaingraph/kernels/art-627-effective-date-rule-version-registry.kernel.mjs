// art-627 — Effective-Date / Rule-Version Registry: pure resolution kernel.
// ACCT-RULEREG-K-1, anchored on ACCT-INFRA-KERNELS-BUILD-SPEC.md Sec.0.1 (bundle + demonstrator
// structure), Sec.2 (full kernel spec), Sec.4 (composition contract), Sec.5 (row-level
// requirements) + RIDER-KERNEL.md (STANDING ORDER #6) + STANDING-ORDERS.md #34/#35 +
// SPEC.md Sec.17/Sec.18/Sec.18.5.
//
// Job (build spec Sec.2): map (fiscal_year_end, filer_status, standard_id) onto the binding
// annual/interim dates, the early-adoption flag, first_binding_period_end, transition_method and
// the time-versioned parameter_set of a published accounting standard.
//
// THE REGISTRY IS DATA, DELIVERED IN policy_parameters — NEVER BAKED INTO THESE BYTES
// (build spec Sec.2.3). This kernel embeds NO rule content of its own: no effective date, no
// threshold, no standard. Every call supplies its own {query, registry_slice}. That ruling is
// load-bearing and its alternative is a named trap: an embedded table would move kernel_digest on
// every rule update, stale the receipt, and drop this node into STANDING ORDER #36 territory —
// fix-and-re-prove in the same row, or do not touch the kernel — for a pure data change. Because
// the slice arrives in policy_parameters, execution_hash binds the rule vintage through the
// existing canonical preimage, and adding a rule entry never moves kernel_digest.
//
// The demonstrator standards this row exercises (FASB ASU 2023-07 Segment Reporting and ASU
// 2023-09 Income Taxes) live ONLY in this kernel's fixtures, in the disjoint entry files under
// chaingraph/kernels/data/rule-registry/, and in the pinned clause snapshots at workspace-root
// research/clause-snapshots/ — never hardcoded here.
//
// IN-GUEST DIGEST ASSERTION, BOUNDED (build spec Sec.2.3): the kernel recomputes
// sha256(canon(registry_slice)) and fails closed against the declared registry_digest. In-guest
// hashing is a named static SLOW-suspect marker in GPU-CYCLE-PREFLIGHT-SPEC.md, and the resolution
// is to BOUND the hashed object rather than drop the check: the kernel hashes only the SLICE it
// consumes, max_slice_entries = 32, declared and enforced. The full-table -> slice binding is a
// HOST-side gate (scripts/gen-rule-registry.mjs --check), deliberately outside the guest.
//
// float_sensitive: NO. Date and enum arithmetic only — integer arithmetic over parsed ISO
// components, never `new Date()`, never a locale, never a timezone, and no transcendental anywhere
// (SPEC.md Sec.18.5). A parameter_set value that a downstream consumer treats as a float is THAT
// consumer's declaration: this kernel transports the value verbatim and must not round it.
//
// Pure: no DOM, no window, no network, no host crypto in compute() (GUEST-BUILTIN-GATE-1,
// RIDER-KERNEL.md) — the inlined _ruleversion bundle below carries the validated pure-JS UTF-8
// encoder and SHA-256 already proven guest-safe in art-199/200/206/210/280/584/620.

import { executionHash } from './_hash.mjs';

/* ===== inlined _ruleversion (RISC0 guest provides only _hash; bundle import is unavailable in-guest) ===== */
// _ruleversion.bundle.mjs — effective-date / rule-version registry resolver, shared kernel infra.
// ACCT-RULEREG-K-1, anchored on ACCT-INFRA-KERNELS-BUILD-SPEC.md Sec.2 (full kernel spec) +
// Sec.4 (composition contract) + RIDER-KERNEL.md (STANDING ORDER #6).
//
// PURPOSE: one audited resolver that maps (fiscal_year_end, filer_status, standard_id) onto the
// binding dates and time-versioned rule parameters of a published accounting standard. The
// registry is inert DATA delivered via policy_parameters (build spec Sec.2.3) -- this module is
// the ONLY code that walks it, and NO rule content is baked into these bytes. That ruling is
// load-bearing: an embedded table would move kernel_digest on every data update, stale the
// receipt, and drop the node into STANDING ORDER #36 territory for what is a pure data change.
//
// GUEST SAFETY (GUEST-BUILTIN-GATE-1, RIDER-KERNEL.md): the RISC0 guest has no TextEncoder, no
// atob/btoa, no URL, no crypto.subtle, and Date is not relied on for any arithmetic here. This
// module hand-rolls the validated pure-JS UTF-8 encoder and SHA-256 already proven guest-safe in
// art-199/200/206/210/280/584/620 and reused verbatim by _dtree.bundle.mjs, so the in-guest
// registry_digest assertion never touches a guest-absent builtin. All date arithmetic is integer
// arithmetic over parsed ISO components -- never `new Date()`, never a locale, never a timezone
// (SPEC.md Sec.18.5: no engine-libm divergence surface anywhere in compute()).
//
// BOUNDED BY CONSTRUCTION (build spec Sec.2.3): the kernel hashes only the SLICE it consumes,
// never a full table. MAX_SLICE_ENTRIES = 32, declared and enforced. The full-table -> slice
// binding is a HOST-side gate (scripts/gen-rule-registry.mjs --check), deliberately outside the
// guest, because in-guest hashing is a named static SLOW-suspect marker in
// GPU-CYCLE-PREFLIGHT-SPEC.md and the resolution is to BOUND the hashed object, not drop the check.
//
// COMPOSITION CONTRACT (build spec Sec.4.1): consumers paste this file VERBATIM between sentinel
// comments in their own .kernel.mjs and destructure what they need. NEVER `import` this module at
// runtime -- the RISC0 guest provides only `_hash`, so a bundle import is unavailable in-guest.
// This file is `_`-prefixed and exports NO `meta`/`compute` -- it must not be discovered as a node
// by check-kernel-exports.mjs / check-kernel-coverage.mjs.
//
// Zero-import, zero-network, zero-dependency. Pure JS only.

const _ruleversion = (function () {
'use strict';

// ── the closed filer-status enum (build spec Sec.2.1) ────────────────────────────────────────────
// Closed by construction: a query naming anything outside this set is REFUSED, never coerced and
// never silently treated as "some other filer". Nothing here is inferred from an entry file.
const FILER_STATUSES = [
  'large_accelerated',
  'accelerated',
  'non_accelerated',
  'smaller_reporting',
  'emerging_growth',
  'private',
  'non_public_business_entity',
];

// ── bounds (build spec Sec.2.3), declared and enforced, over-limit is a NAMED refusal ────────────
const MAX_SLICE_ENTRIES = 32;
const MAX_PARAMETERS_PER_ENTRY = 64;
const MAX_YEAR_SEARCH_SPAN = 200; // bounded first-binding-period search, both directions

// ── guest-safe UTF-8 byte encoder (no TextEncoder) ───────────────────────────────────────────────
function _utf8Bytes(str) {
  const s = String(str);
  const out = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff) {
      const hi = c, lo = s.charCodeAt(++i);
      const cp = 0x10000 + ((hi - 0xd800) << 10) + (lo - 0xdc00);
      out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return new Uint8Array(out);
}

// ── guest-safe pure-JS SHA-256 (no crypto.subtle) — same construction as art-620 / _dtree ───────
function _sha256(bytes) {
  const K = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ]);
  const msgLen = bytes.length;
  const paddedLen = Math.ceil((msgLen + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[msgLen] = 0x80;
  const bitLen = msgLen * 8;
  for (let i = 0; i < 8; i++) padded[paddedLen - 8 + i] = Number((BigInt(bitLen) >> BigInt(56 - i * 8)) & 0xffn);
  let [h0,h1,h2,h3,h4,h5,h6,h7] = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let cs = 0; cs < paddedLen; cs += 64) {
    const W = new Uint32Array(64);
    for (let i = 0; i < 16; i++) { const j = cs + i * 4; W[i] = (padded[j] << 24) | (padded[j+1] << 16) | (padded[j+2] << 8) | padded[j+3]; }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i-15], 7) ^ rotr(W[i-15], 18) ^ (W[i-15] >>> 3);
      const s1 = rotr(W[i-2], 17) ^ rotr(W[i-2], 19) ^ (W[i-2] >>> 10);
      W[i] = (W[i-16] + s0 + W[i-7] + s1) >>> 0;
    }
    let [a,b,c,d,e,f,g,h] = [h0,h1,h2,h3,h4,h5,h6,h7];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25), ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22), maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }
  const r = new Uint8Array(32);
  [h0,h1,h2,h3,h4,h5,h6,h7].forEach(function (v, i) { const j = i * 4; r[j] = v >>> 24; r[j+1] = (v >>> 16) & 0xff; r[j+2] = (v >>> 8) & 0xff; r[j+3] = v & 0xff; });
  return r;
}

// ── safe stringification for DIAGNOSTIC MESSAGES ONLY ───────────────────────────────────────────
// A hostile caller can hand us a null-prototype object, or one whose valueOf/toString throws. Plain
// String(v) then throws "Cannot convert object to primitive value" and takes the whole refusal path
// down with it -- a refusal that crashes is not a refusal. Every interpolation of an UNVALIDATED
// caller value goes through this. It is never used to build a digest preimage or an output value.
function _safeStr(v) {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  const t = typeof v;
  if (t === 'string') return v;
  if (t === 'number' || t === 'boolean' || t === 'bigint') return String(v);
  if (t === 'symbol') return 'Symbol(...)';
  if (t === 'function') return 'function';
  try {
    const s = JSON.stringify(v);
    if (typeof s === 'string') return s.length > 200 ? s.slice(0, 200) + '...' : s;
  } catch (e) { /* cyclic or a throwing toJSON -- fall through */ }
  return Array.isArray(v) ? '[array]' : '[object]';
}

function _sha256Hex(str) {
  return Array.from(_sha256(_utf8Bytes(str))).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── canonicalizer: recursive key sort, matches _hash.mjs's cgCanon (RFC 8785 / JCS shape) ───────
// Duplicated here (not imported) because a bundle inlined into a guest-executed compute() must
// never import _hash.mjs, whose executionHash() depends on crypto.subtle/TextEncoder.
function _rvCanon(v) {
  if (Array.isArray(v)) return v.map(_rvCanon);
  if (v && typeof v === 'object') {
    const out = {};
    Object.keys(v).sort().forEach(function (k) { out[k] = _rvCanon(v[k]); });
    return out;
  }
  return v;
}

// ── ISO date handling: pure integer arithmetic, no Date, no timezone, no locale ─────────────────
// A calendar date is {y, m, d}. ISO-8601 extended `YYYY-MM-DD` strings sort lexicographically in
// the same order they sort chronologically, so comparison is plain string comparison -- but only
// after parseISODate() has proven the string is a real, in-range, zero-padded calendar date.
const ISO_DATE_RE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;

function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
}

function daysInMonth(y, m) {
  if (m === 2) return isLeapYear(y) ? 29 : 28;
  if (m === 4 || m === 6 || m === 9 || m === 11) return 30;
  return 31;
}

/** Returns {y, m, d} or null. Rejects 2023-02-30, 2023-13-01, unpadded forms, and non-strings. */
function parseISODate(s) {
  if (typeof s !== 'string') return null;
  const match = ISO_DATE_RE.exec(s);
  if (!match) return null;
  const y = Number(match[1]), m = Number(match[2]), d = Number(match[3]);
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

function formatISODate(parts) {
  const mm = parts.m < 10 ? '0' + parts.m : String(parts.m);
  const dd = parts.d < 10 ? '0' + parts.d : String(parts.d);
  return String(parts.y).padStart(4, '0') + '-' + mm + '-' + dd;
}

/** Add whole years, clamping Feb 29 to Feb 28 in a non-leap target year. Declared, not incidental. */
function addYears(parts, n) {
  const y = parts.y + n;
  const d = Math.min(parts.d, daysInMonth(y, parts.m));
  return { y, m: parts.m, d };
}

/** Add whole days by walking the civil calendar. Bounded: only ever called with |n| <= 1 here. */
function addDays(parts, n) {
  let { y, m, d } = parts;
  let remaining = n;
  while (remaining > 0) {
    d++;
    if (d > daysInMonth(y, m)) { d = 1; m++; if (m > 12) { m = 1; y++; } }
    remaining--;
  }
  while (remaining < 0) {
    d--;
    if (d < 1) { m--; if (m < 1) { m = 12; y--; } d = daysInMonth(y, m); }
    remaining++;
  }
  return { y, m, d };
}

/** cmp over two validated ISO date strings: -1 | 0 | 1. */
function cmpISO(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// ── registry_slice digest: sha256(canon(slice minus registry_digest)) ────────────────────────────
function computeSliceDigest(slice) {
  const stripped = Object.assign({}, slice);
  delete stripped.registry_digest;
  return _sha256Hex(JSON.stringify(_rvCanon(stripped)));
}

/** Per-entry digest, so a caller can bind one resolved entry without re-hashing the slice. */
function computeEntryDigest(entry) {
  return _sha256Hex(JSON.stringify(_rvCanon(entry)));
}

// ── a parameter version is ALWAYS (value, effective_from, effective_to, source, source_digest) ───
// A bare number is refused by construction (build spec Sec.2.1). effective_to may be null, meaning
// "open-ended", which is the ONLY permitted absence.
function _validParameterVersion(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return 'not an object';
  if (!Object.prototype.hasOwnProperty.call(p, 'value')) return 'missing `value`';
  if (parseISODate(p.effective_from) === null) return 'effective_from is not a valid ISO date';
  if (p.effective_to !== null && parseISODate(p.effective_to) === null) return 'effective_to is neither null nor a valid ISO date';
  if (p.effective_to !== null && cmpISO(p.effective_from, p.effective_to) >= 0) return 'effective_from is not strictly before effective_to';
  if (typeof p.source !== 'string' || p.source.length === 0) return 'missing non-empty `source`';
  if (typeof p.source_digest !== 'string' || p.source_digest.length === 0) return 'missing non-empty `source_digest`';
  return null;
}

function _validCitation(c) {
  return !!c && typeof c === 'object' && !Array.isArray(c) &&
    typeof c.clause === 'string' && c.clause.length > 0 &&
    typeof c.source === 'string' && c.source.length > 0 &&
    typeof c.source_digest === 'string' && c.source_digest.length > 0 &&
    typeof c.snapshot_location === 'string' && c.snapshot_location.length > 0;
}

// ── structural validation of the slice, ALL AT LOAD, before any resolution ──────────────────────
// Includes the NON-OVERLAP assertion, which is the property that makes the table trustworthy:
// no two versions of the same parameter within an entry may have overlapping [from, to) windows.
// It is ASSERTED here, never assumed (build spec Sec.2.4).
function validateSlice(slice) {
  if (!slice || typeof slice !== 'object' || Array.isArray(slice)) {
    return { ok: false, error_code: 'SLICE_MISSING', message: 'policy_parameters.registry_slice is missing or not an object' };
  }
  const entries = slice.entries;
  if (!Array.isArray(entries)) {
    return { ok: false, error_code: 'SLICE_MISSING_ENTRIES', message: 'registry_slice.entries is missing or not an array' };
  }
  if (entries.length === 0) {
    return { ok: false, error_code: 'SLICE_MISSING_ENTRIES', message: 'registry_slice.entries is empty' };
  }
  if (entries.length > MAX_SLICE_ENTRIES) {
    return {
      ok: false, error_code: 'SLICE_MAX_ENTRIES_EXCEEDED',
      message: `registry_slice carries ${entries.length} entries, exceeds max_slice_entries=${MAX_SLICE_ENTRIES} (build spec Sec.2.3 bound, declared and enforced)`,
    };
  }

  const seenKeys = {};
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e || typeof e !== 'object' || Array.isArray(e)) {
      return { ok: false, error_code: 'SLICE_INVALID_ENTRY', message: `entries[${i}] is not an object` };
    }
    if (typeof e.standard_id !== 'string' || e.standard_id.length === 0) {
      return { ok: false, error_code: 'SLICE_INVALID_ENTRY', message: `entries[${i}] missing a non-empty string standard_id` };
    }
    if (!_validCitation(e.citation)) {
      return {
        ok: false, error_code: 'SLICE_UNCITED_ENTRY',
        message: `entries[${i}] ("${e.standard_id}") carries no valid citation {clause, source, source_digest, snapshot_location} — an entry with no digest is REJECTED, never warned about (build spec Sec.2.2)`,
      };
    }
    if (!Array.isArray(e.applies_to_filer_statuses) || e.applies_to_filer_statuses.length === 0) {
      return { ok: false, error_code: 'SLICE_INVALID_ENTRY', message: `entries[${i}] ("${e.standard_id}") missing a non-empty applies_to_filer_statuses array` };
    }
    for (const fs of e.applies_to_filer_statuses) {
      if (FILER_STATUSES.indexOf(fs) === -1) {
        return { ok: false, error_code: 'SLICE_INVALID_FILER_STATUS', message: `entries[${i}] ("${e.standard_id}") declares filer_status "${_safeStr(fs)}", which is not in the closed enum` };
      }
      const key = e.standard_id + '|' + fs;
      if (Object.prototype.hasOwnProperty.call(seenKeys, key)) {
        return {
          ok: false, error_code: 'SLICE_DUPLICATE_ENTRY_KEY',
          message: `(standard_id="${e.standard_id}", filer_status="${fs}") is covered by entries[${seenKeys[key]}] and entries[${i}] — a triple must resolve to EXACTLY ONE entry (build spec Sec.2.4 total resolution)`,
        };
      }
      seenKeys[key] = i;
    }
    if (parseISODate(e.effective_for_annual_periods_beginning) === null) {
      return { ok: false, error_code: 'SLICE_INVALID_ENTRY', message: `entries[${i}] ("${e.standard_id}") effective_for_annual_periods_beginning is not a valid ISO date` };
    }
    if (e.effective_for_interim_periods_beginning !== null && parseISODate(e.effective_for_interim_periods_beginning) === null) {
      return { ok: false, error_code: 'SLICE_INVALID_ENTRY', message: `entries[${i}] ("${e.standard_id}") effective_for_interim_periods_beginning is neither null nor a valid ISO date` };
    }
    if (typeof e.early_adoption_permitted !== 'boolean') {
      return { ok: false, error_code: 'SLICE_INVALID_ENTRY', message: `entries[${i}] ("${e.standard_id}") early_adoption_permitted must be a boolean` };
    }
    if (typeof e.transition_method !== 'string' || e.transition_method.length === 0) {
      return { ok: false, error_code: 'SLICE_INVALID_ENTRY', message: `entries[${i}] ("${e.standard_id}") missing a non-empty transition_method` };
    }

    const ps = e.parameter_set;
    if (!ps || typeof ps !== 'object' || Array.isArray(ps)) {
      return { ok: false, error_code: 'SLICE_INVALID_ENTRY', message: `entries[${i}] ("${e.standard_id}") parameter_set must be an object mapping parameter name to a version array` };
    }
    const paramNames = Object.keys(ps);
    if (paramNames.length > MAX_PARAMETERS_PER_ENTRY) {
      return { ok: false, error_code: 'SLICE_MAX_PARAMETERS_EXCEEDED', message: `entries[${i}] ("${e.standard_id}") declares ${paramNames.length} parameters, exceeds max_parameters_per_entry=${MAX_PARAMETERS_PER_ENTRY}` };
    }
    for (const name of paramNames) {
      const versions = ps[name];
      if (!Array.isArray(versions) || versions.length === 0) {
        return { ok: false, error_code: 'SLICE_INVALID_PARAMETER', message: `entries[${i}] ("${e.standard_id}") parameter "${name}" is not a non-empty array of versions — a parameter is ALWAYS (value, effective_from, effective_to, source, source_digest), never a bare number` };
      }
      for (let vi = 0; vi < versions.length; vi++) {
        const why = _validParameterVersion(versions[vi]);
        if (why !== null) {
          return { ok: false, error_code: 'SLICE_INVALID_PARAMETER', message: `entries[${i}] ("${e.standard_id}") parameter "${name}" version[${vi}]: ${why}` };
        }
      }
      // NON-OVERLAP over half-open [effective_from, effective_to) windows. O(n^2) over a bound of
      // MAX_PARAMETERS_PER_ENTRY versions -- small, fixed, and never taken from policy_parameters
      // as a loop count in the GPU-CYCLE-PREFLIGHT-SPEC sense.
      for (let a = 0; a < versions.length; a++) {
        for (let b = a + 1; b < versions.length; b++) {
          const A = versions[a], B = versions[b];
          const aEnd = A.effective_to === null ? '9999-12-31' : A.effective_to;
          const bEnd = B.effective_to === null ? '9999-12-31' : B.effective_to;
          const overlaps = cmpISO(A.effective_from, bEnd) < 0 && cmpISO(B.effective_from, aEnd) < 0;
          if (overlaps) {
            return {
              ok: false, error_code: 'SLICE_PARAMETER_WINDOWS_OVERLAP',
              message: `entries[${i}] ("${e.standard_id}") parameter "${name}": versions[${a}] [${A.effective_from}, ${A.effective_to === null ? 'open' : A.effective_to}) overlaps versions[${b}] [${B.effective_from}, ${B.effective_to === null ? 'open' : B.effective_to}) — non-overlap is ASSERTED, never assumed (build spec Sec.2.4)`,
            };
          }
        }
      }
    }
  }
  return { ok: true, entry_count: entries.length };
}

// ── query validation: the closed enum and a real calendar date, or a NAMED refusal ──────────────
function validateQuery(query) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    return { ok: false, error_code: 'QUERY_MISSING', message: 'policy_parameters.query is missing or not an object' };
  }
  if (parseISODate(query.fiscal_year_end) === null) {
    return {
      ok: false, error_code: 'QUERY_INVALID_FISCAL_YEAR_END',
      message: `query.fiscal_year_end "${_safeStr(query.fiscal_year_end)}" is not a valid ISO calendar date — it is a DATE, never a month/day pair, because 52/53-week filers' year-ends move`,
    };
  }
  if (FILER_STATUSES.indexOf(query.filer_status) === -1) {
    return {
      ok: false, error_code: 'QUERY_INVALID_FILER_STATUS',
      message: `query.filer_status "${_safeStr(query.filer_status)}" is not in the closed enum {${FILER_STATUSES.join(', ')}}`,
    };
  }
  if (typeof query.standard_id !== 'string' || query.standard_id.length === 0) {
    return { ok: false, error_code: 'QUERY_MISSING_STANDARD_ID', message: 'query.standard_id is missing or not a non-empty string' };
  }
  if (query.fiscal_year_begin !== undefined && query.fiscal_year_begin !== null && parseISODate(query.fiscal_year_begin) === null) {
    return { ok: false, error_code: 'QUERY_INVALID_FISCAL_YEAR_BEGIN', message: `query.fiscal_year_begin "${_safeStr(query.fiscal_year_begin)}" is neither absent nor a valid ISO calendar date` };
  }
  if (query.fiscal_year_begin && cmpISO(query.fiscal_year_begin, query.fiscal_year_end) >= 0) {
    return { ok: false, error_code: 'QUERY_INVALID_FISCAL_YEAR_BEGIN', message: 'query.fiscal_year_begin must be strictly before query.fiscal_year_end' };
  }
  return { ok: true };
}

/**
 * The fiscal year that ENDS on fiscal_year_end began roughly a year earlier, but for a 52/53-week
 * filer that start is NOT derivable from the year-end alone. This function therefore either uses a
 * caller-supplied fiscal_year_begin (basis "declared") or infers one as
 * (fiscal_year_end minus one year, plus one day) and DECLARES the inference in the output
 * (basis "inferred_prior_year_plus_one_day"). It never presents an inference as a fact.
 */
function deriveFiscalYearBegin(query) {
  if (query.fiscal_year_begin) {
    return { fiscal_year_begin: query.fiscal_year_begin, basis: 'declared' };
  }
  const end = parseISODate(query.fiscal_year_end);
  const begin = addDays(addYears(end, -1), 1);
  return { fiscal_year_begin: formatISODate(begin), basis: 'inferred_prior_year_plus_one_day' };
}

/**
 * first_binding_period_end: the year-end of the EARLIEST annual period, anchored on the queried
 * period's own month/day, whose beginning falls on or after the entry's annual effective date.
 * Bounded search over +/- MAX_YEAR_SEARCH_SPAN whole years; returns null (with a named reason) if
 * no such period exists inside the bound rather than looping or guessing.
 */
function firstBindingPeriodEnd(queryEnd, queryBegin, annualEffective) {
  const endParts = parseISODate(queryEnd);
  const beginParts = parseISODate(queryBegin);
  let found = null;
  for (let k = -MAX_YEAR_SEARCH_SPAN; k <= MAX_YEAR_SEARCH_SPAN; k++) {
    const b = formatISODate(addYears(beginParts, k));
    if (cmpISO(b, annualEffective) >= 0) {
      found = formatISODate(addYears(endParts, k));
      break;
    }
  }
  return found;
}

/**
 * Resolve a parameter_set as of a measurement date, using half-open [effective_from, effective_to)
 * windows. Non-overlap has already been asserted at load, so at most one version can match; the
 * loop still records every match so an unexpected second one becomes a visible defect rather than
 * a silent first-wins.
 *
 * The measurement date is the fiscal year's BEGINNING, not its end. That is deliberate and it is
 * the semantics the source text actually uses: an ASU effective "for fiscal years beginning after
 * December 15, 2024" keys on the period's beginning, so measuring at the year-end would report a
 * calendar-2024 filer as already inside the 2024-12-16 window a full year early.
 */
function resolveParameterSet(parameterSet, asOf) {
  const resolved = {};
  const names = Object.keys(parameterSet).sort();
  for (const name of names) {
    const versions = parameterSet[name];
    const matches = [];
    for (let i = 0; i < versions.length; i++) {
      const v = versions[i];
      const startsOk = cmpISO(asOf, v.effective_from) >= 0;
      const endsOk = v.effective_to === null || cmpISO(asOf, v.effective_to) < 0;
      if (startsOk && endsOk) matches.push(v);
    }
    if (matches.length === 1) {
      const v = matches[0];
      resolved[name] = {
        value: v.value,
        effective_from: v.effective_from,
        effective_to: v.effective_to,
        source: v.source,
        source_digest: v.source_digest,
        status: 'IN_FORCE',
      };
    } else if (matches.length === 0) {
      resolved[name] = {
        value: null, effective_from: null, effective_to: null, source: null, source_digest: null,
        status: 'NO_VERSION_IN_FORCE',
      };
    } else {
      resolved[name] = {
        value: null, effective_from: null, effective_to: null, source: null, source_digest: null,
        status: 'AMBIGUOUS_MULTIPLE_VERSIONS_IN_FORCE',
      };
    }
  }
  return resolved;
}

function _nullResult(extra) {
  return Object.assign({
    resolution_status: null,
    error_code: null,
    message: null,
    standard_id: null,
    filer_status: null,
    fiscal_year_end: null,
    fiscal_year_begin: null,
    fiscal_year_begin_basis: null,
    effective_for_annual_periods_beginning: null,
    effective_for_interim_periods_beginning: null,
    early_adoption_permitted: null,
    binding_for_queried_annual_period: null,
    binding_for_queried_interim_periods: null,
    first_binding_period_end: null,
    transition_method: null,
    parameter_set: null,
    parameter_set_as_of: null,
    entry_digest: null,
    citation: null,
    registry_digest_recomputed: null,
    resolution_path: [],
  }, extra || {});
}

/**
 * Full run: validate query -> validate slice -> recompute registry_digest and FAIL CLOSED against
 * the declared one -> resolve. Every path returns the same field set, so a caller never sees a
 * silent `undefined` (build spec Sec.2.4, total resolution).
 */
function resolve(pp) {
  pp = pp || {};
  const query = pp.query;
  const slice = pp.registry_slice;
  const path = [];

  const q = validateQuery(query);
  if (!q.ok) return _nullResult({ error_code: q.error_code, message: q.message, resolution_path: path });
  path.push('query_validated');

  const s = validateSlice(slice);
  if (!s.ok) {
    return _nullResult({
      error_code: s.error_code, message: s.message, resolution_path: path,
      standard_id: query.standard_id, filer_status: query.filer_status, fiscal_year_end: query.fiscal_year_end,
    });
  }
  path.push('slice_validated:' + s.entry_count + '_entries');

  // In-guest digest assertion over the SLICE ONLY (build spec Sec.2.3). Fails closed: a declared
  // digest that is absent or does not match the recomputed one refuses resolution outright, and
  // the recomputed value is never taken from the slice's own claim about itself (SO #34).
  const recomputed = computeSliceDigest(slice);
  const declared = typeof slice.registry_digest === 'string' ? slice.registry_digest.toLowerCase() : null;
  if (declared === null || declared !== recomputed.toLowerCase()) {
    return _nullResult({
      error_code: 'SLICE_DIGEST_MISMATCH',
      message: `declared registry_digest "${_safeStr(slice.registry_digest)}" does not match the digest "${recomputed}" recomputed over the slice's own bytes`,
      registry_digest_recomputed: recomputed,
      resolution_path: path,
      standard_id: query.standard_id, filer_status: query.filer_status, fiscal_year_end: query.fiscal_year_end,
    });
  }
  path.push('slice_digest_verified');

  const entries = slice.entries;
  let match = null;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.standard_id !== query.standard_id) continue;
    if (e.applies_to_filer_statuses.indexOf(query.filer_status) === -1) continue;
    match = e;
    break;
  }

  const fyb = deriveFiscalYearBegin(query);

  if (match === null) {
    // Explicit, named non-resolution. NOT an error, NOT undefined: the declared domain is total.
    path.push('no_entry_for_triple');
    return _nullResult({
      resolution_status: 'NO_BINDING_ENTRY',
      message: `no entry in this registry_slice covers (standard_id="${query.standard_id}", filer_status="${query.filer_status}") — this is an explicit NO_BINDING_ENTRY, never a silent undefined`,
      standard_id: query.standard_id,
      filer_status: query.filer_status,
      fiscal_year_end: query.fiscal_year_end,
      fiscal_year_begin: fyb.fiscal_year_begin,
      fiscal_year_begin_basis: fyb.basis,
      registry_digest_recomputed: recomputed,
      resolution_path: path,
    });
  }
  path.push('entry_matched:' + match.standard_id + ':' + query.filer_status);

  const annualEff = match.effective_for_annual_periods_beginning;
  const interimEff = match.effective_for_interim_periods_beginning;
  const bindingAnnual = cmpISO(fyb.fiscal_year_begin, annualEff) >= 0;
  const bindingInterim = interimEff === null ? false : cmpISO(fyb.fiscal_year_begin, interimEff) >= 0;
  path.push('annual_binding_compared:' + fyb.fiscal_year_begin + (bindingAnnual ? '>=' : '<') + annualEff);
  path.push('interim_binding_compared:' + (interimEff === null ? 'no_interim_effective_date' : fyb.fiscal_year_begin + (bindingInterim ? '>=' : '<') + interimEff));

  const firstBinding = firstBindingPeriodEnd(query.fiscal_year_end, fyb.fiscal_year_begin, annualEff);
  path.push('first_binding_period_end:' + (firstBinding === null ? 'outside_search_span' : firstBinding));

  const parameters = resolveParameterSet(match.parameter_set, fyb.fiscal_year_begin);
  path.push('parameter_set_resolved_as_of:' + fyb.fiscal_year_begin);

  return {
    resolution_status: 'RESOLVED',
    error_code: null,
    message: null,
    standard_id: match.standard_id,
    filer_status: query.filer_status,
    fiscal_year_end: query.fiscal_year_end,
    fiscal_year_begin: fyb.fiscal_year_begin,
    fiscal_year_begin_basis: fyb.basis,
    effective_for_annual_periods_beginning: annualEff,
    effective_for_interim_periods_beginning: interimEff,
    early_adoption_permitted: match.early_adoption_permitted,
    binding_for_queried_annual_period: bindingAnnual,
    binding_for_queried_interim_periods: bindingInterim,
    first_binding_period_end: firstBinding,
    transition_method: match.transition_method,
    parameter_set: parameters,
    parameter_set_as_of: fyb.fiscal_year_begin,
    entry_digest: computeEntryDigest(match),
    citation: match.citation,
    registry_digest_recomputed: recomputed,
    resolution_path: path,
  };
}

return {
  FILER_STATUSES, MAX_SLICE_ENTRIES, MAX_PARAMETERS_PER_ENTRY, MAX_YEAR_SEARCH_SPAN,
  parseISODate, formatISODate, addYears, addDays, cmpISO, isLeapYear, daysInMonth,
  computeSliceDigest, computeEntryDigest,
  validateSlice, validateQuery, deriveFiscalYearBegin, firstBindingPeriodEnd, resolveParameterSet,
  resolve,
};
})();
/* ===== END inlined _ruleversion ===== */

const { resolve: resolveRuleVersion, validateSlice, FILER_STATUSES, MAX_SLICE_ENTRIES, MAX_PARAMETERS_PER_ENTRY } = _ruleversion;

const TOOL_ID = 'art-627-effective-date-rule-version-registry';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'resolve_rule_version',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

const SCOPE_NOTE =
  'This kernel is a generic effective-date and rule-version resolver. It carries no effective ' +
  'date, threshold, or standard of its own -- every call must supply its own {query, ' +
  'registry_slice} in policy_parameters. Every date, parameter value, citation and digest ' +
  'reported below comes entirely from the caller-supplied slice, never from anything hardcoded ' +
  'in this kernel. A resolved parameter value is transported verbatim and is never rounded: a ' +
  'value a downstream consumer treats as a float is that consumer declaration, not this one.';

/**
 * compute(pp) — resolve one (fiscal_year_end, filer_status, standard_id) triple against a
 * caller-supplied, hash-pinned registry slice.
 *
 * Total by construction (build spec Sec.2.4): every triple in the declared domain resolves to
 * exactly one entry (resolution_status "RESOLVED") or to an explicit "NO_BINDING_ENTRY" — never a
 * silent undefined. A malformed slice or query is refused with a NAMED error_code instead.
 *
 * The declared registry_digest is never trusted as an oracle for itself: it is recomputed from the
 * slice's own bytes and compared fail-closed (STANDING-ORDERS.md #34).
 *
 * pp: {
 *   query?: { fiscal_year_end: ISO date, filer_status: closed enum, standard_id: string,
 *             fiscal_year_begin?: ISO date },
 *   registry_slice?: { registry_digest, entries: [ ... ] },
 * }
 */
export function compute(pp) {
  pp = pp || {};
  const result = resolveRuleVersion(pp);

  const compliance_flags = {
    RULEREG_REGISTRY_IS_DATA_NOT_CODE: true,
    RULEREG_FILER_STATUS_ENUM_CLOSED: true,
    RULEREG_SLICE_BOUND_DECLARED_AND_ENFORCED: true,
  };
  if (result.registry_digest_recomputed !== null && result.error_code !== 'SLICE_DIGEST_MISMATCH') {
    compliance_flags.RULEREG_SLICE_DIGEST_VERIFIED = true;
    // Reachable only past validateSlice(), whose non-overlap assertion is a hard refusal.
    compliance_flags.RULEREG_PARAMETER_WINDOWS_NON_OVERLAPPING = true;
  }
  if (result.error_code === null) {
    if (result.resolution_status === 'RESOLVED') compliance_flags.RULEREG_RESOLVED = true;
    if (result.resolution_status === 'NO_BINDING_ENTRY') compliance_flags.RULEREG_NO_BINDING_ENTRY = true;
  } else {
    compliance_flags.RULEREG_REJECTED = true;
    if (result.error_code === 'SLICE_DIGEST_MISMATCH') compliance_flags.RULEREG_DIGEST_MISMATCH_REJECTED = true;
    if (result.error_code === 'SLICE_UNCITED_ENTRY') compliance_flags.RULEREG_UNCITED_ENTRY_REJECTED = true;
    if (result.error_code === 'SLICE_PARAMETER_WINDOWS_OVERLAP') compliance_flags.RULEREG_OVERLAP_REJECTED = true;
    if (result.error_code === 'SLICE_MAX_ENTRIES_EXCEEDED') compliance_flags.RULEREG_SLICE_BOUND_REJECTED = true;
    if (result.error_code === 'QUERY_INVALID_FILER_STATUS') compliance_flags.RULEREG_CLOSED_ENUM_REJECTED = true;
  }

  const output_payload = {
    resolution_status: result.resolution_status,
    error_code: result.error_code,
    message: result.message,
    standard_id: result.standard_id,
    filer_status: result.filer_status,
    fiscal_year_end: result.fiscal_year_end,
    fiscal_year_begin: result.fiscal_year_begin,
    fiscal_year_begin_basis: result.fiscal_year_begin_basis,
    effective_for_annual_periods_beginning: result.effective_for_annual_periods_beginning,
    effective_for_interim_periods_beginning: result.effective_for_interim_periods_beginning,
    early_adoption_permitted: result.early_adoption_permitted,
    binding_for_queried_annual_period: result.binding_for_queried_annual_period,
    binding_for_queried_interim_periods: result.binding_for_queried_interim_periods,
    first_binding_period_end: result.first_binding_period_end,
    transition_method: result.transition_method,
    parameter_set: result.parameter_set,
    parameter_set_as_of: result.parameter_set_as_of,
    entry_digest: result.entry_digest,
    citation: result.citation,
    registry_digest_recomputed: result.registry_digest_recomputed,
    resolution_path: result.resolution_path,
    bounds: { max_slice_entries: MAX_SLICE_ENTRIES, max_parameters_per_entry: MAX_PARAMETERS_PER_ENTRY },
    closed_filer_status_enum: FILER_STATUSES,
    float_sensitive: false,
    scope_note: SCOPE_NOTE,
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.4/context.jsonld',
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
