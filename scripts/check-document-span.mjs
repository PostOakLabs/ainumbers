#!/usr/bin/env node
// check-document-span.mjs - reference checker for the ocg-document-span@1 sidecar profile
// (TIEOUT-SPAN-SCHEMA-1; SPEC.md section 23 sidecar route: the section 23 type list stays closed at
// four, so a document-span record ships as a standalone sidecar, never inside the envelope).
//
// The profile binds ONE input value to one location inside one document: a span record names the
// document by sha256, names the location by an RFC 4180 cell locator or an RFC 6901 pointer, and
// carries the extracted string verbatim. The claim it supports is exactly "this value is bound to
// this document at this location" and nothing more: no origin, no issuer, no accuracy claim.
//
// The four verification steps:
//   1. sha256 of the document bytes equals proof.document.sha256          (structural)
//   2. the named extractor's locator resolves; a row_key guard resolves   (structural)
//   3. the extracted string equals proof.lexical byte for byte            (verifiable)
//   4. the canonical digest of the normalized lexical equals the canonical
//      digest of the value at `pointer` in policy_parameters (SPEC.md
//      section 23 binding rule, sha256 over the section 4 cgCanon/JCS
//      encoding)                                                          (verifiable)
//
// Fail-closed from birth: `verified` only when all four steps ran and passed; `external` only when
// no document was supplied AND the record is complete and well formed; every other case is a
// structural failure with a reason code, reported in the SPEC.md section 23.2 shape
// { pointer, type, structural, verifiable } plus reason_code/detail.
//
// Refusal-first normalization: grouping separators, currency symbols, parentheses, exponents and
// non-calendar dates are refused, never guessed. The normalization list is closed at four:
// string-exact, decimal-plain, integer-plain, date-iso.
//
// Non-negotiable rules:
//   - a row_key value appearing in more than one record of its column is refused as ambiguous;
//   - every record lookup is own-key (Object.hasOwn guard or a Map): a header or key column named
//     "constructor" or "__proto__" is an ordinary column name;
//   - extractor.kernel_digest must resolve in the site's published kernel digest list (the tracked
//     registry/kernel/ directory); an unknown digest is `failed`;
//   - private-input pointers (SPEC.md section 25): v1 refuses the combination of a lexical value with
//     a policy pointer that resolves to a section 25 commitment;
//   - CSV extraction uses the shared _csv bundle only (one parser; it is imported read-only here and
//     never edited).
//
// Zero network. Node builtins only. The pure entry point never throws on junk input: it returns a
// report. Files are read only by the CLI wrapper and the digest-list read below.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { jcsStringify } from '../chaingraph/kernels/_hash.mjs';
import { _csv } from '../chaingraph/kernels/_csv.bundle.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PROFILE_ID = 'ocg-document-span@1';
export const RECORD_TYPE = 'document-span';
// The site's published kernel digest list, a tracked derived directory: one <hex>.json per digest.
const DEFAULT_DIGEST_DIR = resolve(HERE, '..', 'registry', 'kernel');

// ---- own-key helpers (the constructor/__proto__ rule) ----------------------

function ownGet(obj, key) {
  if (obj === null || typeof obj !== 'object') return undefined;
  return Object.hasOwn(obj, key) ? obj[key] : undefined;
}

// ---- RFC 6901 ---------------------------------------------------------------

// Decodes one reference token: ~1 -> '/', ~0 -> '~'. Returns null on an ill-formed
// escape (a '~' followed by anything but 0 or 1): the pointer is refused, never guessed.
function decodeToken(raw) {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '~') {
      const next = raw[i + 1];
      if (next === '0') { out += '~'; i++; continue; }
      if (next === '1') { out += '/'; i++; continue; }
      return null;
    }
    out += c;
  }
  return out;
}

// Walks an RFC 6901 pointer into `doc`. Returns {ok:true, value} or {ok:false, reason}.
// Array indices are accepted as numeric member names; every step is an own-key read.
export function resolveJsonPointer(pointer, doc) {
  if (typeof pointer !== 'string') return { ok: false, reason: 'POINTER_NOT_A_STRING' };
  if (pointer === '') return { ok: true, value: doc };
  if (!pointer.startsWith('/')) return { ok: false, reason: 'POINTER_ILL_FORMED' };
  let cur = doc;
  const raws = pointer.split('/').slice(1);
  for (const raw of raws) {
    const token = decodeToken(raw);
    if (token === null) return { ok: false, reason: 'POINTER_ILL_FORMED' };
    if (cur === null || typeof cur !== 'object') return { ok: false, reason: 'POINTER_MISS' };
    if (Array.isArray(cur)) {
      const idx = /^[0-9]+$/.test(token) ? Number(token) : -1;
      if (!Number.isInteger(idx) || idx < 0 || idx >= cur.length) return { ok: false, reason: 'POINTER_MISS' };
      cur = cur[idx];
      continue;
    }
    if (!Object.hasOwn(cur, token)) return { ok: false, reason: 'POINTER_MISS' };
    cur = ownGet(cur, token);
  }
  return { ok: true, value: cur };
}

// ---- normalization (refusal first) ------------------------------------------

const DECIMAL_RE = /^[+-]?[0-9]+(\.[0-9]+)?$/;
const INTEGER_RE = /^[+-]?[0-9]+$/;
const DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const COMMITMENT_RE = /^sha256:[0-9a-f]{64}$/;

function daysInMonth(year, month) {
  if (month === 1 || month === 3 || month === 5 || month === 7 || month === 8 || month === 10 || month === 12) return 31;
  if (month === 4 || month === 6 || month === 9 || month === 11) return 30;
  // February, with the mod-4 / mod-100 / mod-400 leap rule in plain arithmetic.
  if (year % 4 !== 0) return 28;
  if (year % 100 !== 0) return 29;
  if (year % 400 !== 0) return 28;
  return 29;
}

// Applies one of the four declared rules to `lexical`. Returns {ok:true, value} (the VALUE the
// canonical digest binds) or {ok:false, code}. Anything outside the declared grammar is refused,
// never guessed: no grouping separators, no currency symbols, no parentheses, no exponents, and a
// date is only a real calendar day.
export function normalize(lexical, rule) {
  if (rule === 'string-exact') return { ok: true, value: lexical };
  if (rule === 'decimal-plain') {
    if (!DECIMAL_RE.test(lexical)) return { ok: false, code: 'REFUSED_DECIMAL_GRAMMAR' };
    const value = Number(lexical);
    if (!Number.isFinite(value)) return { ok: false, code: 'REFUSED_DECIMAL_NOT_FINITE' };
    return { ok: true, value };
  }
  if (rule === 'integer-plain') {
    if (!INTEGER_RE.test(lexical)) return { ok: false, code: 'REFUSED_INTEGER_GRAMMAR' };
    const value = Number(lexical);
    if (!Number.isSafeInteger(value)) return { ok: false, code: 'REFUSED_INTEGER_NOT_SAFE' };
    return { ok: true, value };
  }
  if (rule === 'date-iso') {
    if (!DATE_RE.test(lexical)) return { ok: false, code: 'REFUSED_DATE_FORMAT' };
    const year = Number(lexical.slice(0, 4));
    const month = Number(lexical.slice(5, 7));
    const day = Number(lexical.slice(8, 10));
    if (month < 1 || month > 12) return { ok: false, code: 'REFUSED_DATE_NOT_CALENDAR' };
    if (day < 1 || day > daysInMonth(year, month)) return { ok: false, code: 'REFUSED_DATE_NOT_CALENDAR' };
    return { ok: true, value: lexical };
  }
  return { ok: false, code: 'REFUSED_NORMALIZATION_OFF_LIST' };
}

function canonicalDigest(value) {
  return 'sha256:' + createHash('sha256').update(jcsStringify(value), 'utf8').digest('hex');
}

// ---- record shape (mirrors chaingraph/standard/ocg-document-span-v1.schema.json) ----

const MEDIA_TYPES = new Set(['text/csv', 'application/json']);
const NORMALIZATIONS = new Set(['string-exact', 'decimal-plain', 'integer-plain', 'date-iso']);
const HEX64_RE = /^[0-9a-f]{64}$/;
const KERNEL_DIGEST_RE = /^sha256:[0-9a-f]{64}$/;
const TOOL_ID_RE = /^art-[0-9]+-[a-z0-9-]+$/;
const POINTER_RE = /^(\/([^/~]|~[01])*)*$/;
const SOURCE_REF_RE = /^[^/\\]+$/;

function isPlainInteger(v) {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

// Hand-coded structural validation, own-key everywhere. Returns {ok:true} or
// {ok:false, reason_code, detail}. Mirrors the schema keyword-for-keyword so a
// record the schema rejects is a record this refuses.
export function checkRecordShape(record) {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    return { ok: false, reason_code: 'RECORD_SHAPE_NOT_AN_OBJECT', detail: {} };
  }
  if (ownGet(record, 'type') !== RECORD_TYPE) {
    return { ok: false, reason_code: 'RECORD_SHAPE_TYPE', detail: { path: 'type' } };
  }
  const pointer = ownGet(record, 'pointer');
  if (typeof pointer !== 'string' || !POINTER_RE.test(pointer)) {
    return { ok: false, reason_code: 'RECORD_SHAPE_POINTER', detail: { path: 'pointer' } };
  }
  const sourceRef = ownGet(record, 'source_ref');
  if (typeof sourceRef !== 'string' || !SOURCE_REF_RE.test(sourceRef)) {
    return { ok: false, reason_code: 'RECORD_SHAPE_SOURCE_REF', detail: { path: 'source_ref' } };
  }
  const proof = ownGet(record, 'proof');
  if (proof === null || typeof proof !== 'object' || Array.isArray(proof)) {
    return { ok: false, reason_code: 'RECORD_SHAPE_PROOF', detail: { path: 'proof' } };
  }
  if (ownGet(proof, 'profile') !== PROFILE_ID) {
    return { ok: false, reason_code: 'RECORD_SHAPE_PROFILE', detail: { path: 'proof.profile' } };
  }
  const document = ownGet(proof, 'document');
  if (document === null || typeof document !== 'object' || Array.isArray(document)) {
    return { ok: false, reason_code: 'RECORD_SHAPE_DOCUMENT', detail: { path: 'proof.document' } };
  }
  if (typeof ownGet(document, 'sha256') !== 'string' || !HEX64_RE.test(ownGet(document, 'sha256'))) {
    return { ok: false, reason_code: 'RECORD_SHAPE_DOCUMENT_DIGEST', detail: { path: 'proof.document.sha256' } };
  }
  if (!MEDIA_TYPES.has(ownGet(document, 'media_type'))) {
    return { ok: false, reason_code: 'RECORD_SHAPE_MEDIA_TYPE', detail: { path: 'proof.document.media_type' } };
  }
  if (!isPlainInteger(ownGet(document, 'bytes')) || ownGet(document, 'bytes') < 1) {
    return { ok: false, reason_code: 'RECORD_SHAPE_DOCUMENT_BYTES', detail: { path: 'proof.document.bytes' } };
  }
  const locator = ownGet(proof, 'locator');
  if (locator === null || typeof locator !== 'object' || Array.isArray(locator)) {
    return { ok: false, reason_code: 'RECORD_SHAPE_LOCATOR', detail: { path: 'proof.locator' } };
  }
  const scheme = ownGet(locator, 'scheme');
  if (scheme === 'csv-rfc4180-cell') {
    if (!isPlainInteger(ownGet(locator, 'record'))) {
      return { ok: false, reason_code: 'RECORD_SHAPE_LOCATOR_RECORD', detail: { path: 'proof.locator.record' } };
    }
    if (!isPlainInteger(ownGet(locator, 'column'))) {
      return { ok: false, reason_code: 'RECORD_SHAPE_LOCATOR_COLUMN', detail: { path: 'proof.locator.column' } };
    }
    const header = ownGet(locator, 'header');
    if (typeof header !== 'string' || header.length < 1) {
      return { ok: false, reason_code: 'RECORD_SHAPE_LOCATOR_HEADER', detail: { path: 'proof.locator.header' } };
    }
    const rowKey = ownGet(locator, 'row_key');
    if (rowKey !== undefined && rowKey !== null) {
      if (typeof rowKey !== 'object' || Array.isArray(rowKey)) {
        return { ok: false, reason_code: 'RECORD_SHAPE_ROW_KEY', detail: { path: 'proof.locator.row_key' } };
      }
      const rkColumn = ownGet(rowKey, 'column');
      if (typeof rkColumn !== 'string' || rkColumn.length < 1) {
        return { ok: false, reason_code: 'RECORD_SHAPE_ROW_KEY_COLUMN', detail: { path: 'proof.locator.row_key.column' } };
      }
      if (typeof ownGet(rowKey, 'value') !== 'string') {
        return { ok: false, reason_code: 'RECORD_SHAPE_ROW_KEY_VALUE', detail: { path: 'proof.locator.row_key.value' } };
      }
    }
  } else if (scheme === 'json-pointer') {
    const sub = ownGet(locator, 'pointer');
    if (typeof sub !== 'string' || !POINTER_RE.test(sub)) {
      return { ok: false, reason_code: 'RECORD_SHAPE_LOCATOR_POINTER', detail: { path: 'proof.locator.pointer' } };
    }
  } else {
    return { ok: false, reason_code: 'RECORD_SHAPE_LOCATOR_SCHEME', detail: { path: 'proof.locator.scheme' } };
  }
  const extractor = ownGet(proof, 'extractor');
  if (extractor === null || typeof extractor !== 'object' || Array.isArray(extractor)) {
    return { ok: false, reason_code: 'RECORD_SHAPE_EXTRACTOR', detail: { path: 'proof.extractor' } };
  }
  const toolId = ownGet(extractor, 'tool_id');
  if (typeof toolId !== 'string' || !TOOL_ID_RE.test(toolId)) {
    return { ok: false, reason_code: 'RECORD_SHAPE_EXTRACTOR_TOOL_ID', detail: { path: 'proof.extractor.tool_id' } };
  }
  const kernelDigest = ownGet(extractor, 'kernel_digest');
  if (typeof kernelDigest !== 'string' || !KERNEL_DIGEST_RE.test(kernelDigest)) {
    return { ok: false, reason_code: 'RECORD_SHAPE_EXTRACTOR_DIGEST', detail: { path: 'proof.extractor.kernel_digest' } };
  }
  if (typeof ownGet(proof, 'lexical') !== 'string') {
    return { ok: false, reason_code: 'RECORD_SHAPE_LEXICAL', detail: { path: 'proof.lexical' } };
  }
  if (!NORMALIZATIONS.has(ownGet(proof, 'normalization'))) {
    return { ok: false, reason_code: 'RECORD_SHAPE_NORMALIZATION', detail: { path: 'proof.normalization' } };
  }
  return { ok: true };
}

// ---- the published digest list ----------------------------------------------

// Reads the tracked registry/kernel/ directory once per call. Returns a Set of
// lower-case hex digests, or null when the directory is unreadable (the caller
// reports UNAVAILABLE rather than guessing).
export function loadPublishedDigestHexes(digestDir) {
  const dir = digestDir || DEFAULT_DIGEST_DIR;
  if (!existsSync(dir)) return null;
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return null;
  }
  const hexes = new Set();
  for (const name of names) {
    if (name.endsWith('.json')) hexes.add(name.slice(0, -'.json'.length));
  }
  return hexes;
}

// ---- the report ---------------------------------------------------------------

function report(record, structural, verifiable, reasonCode, detail) {
  const proof = record && typeof record === 'object' && !Array.isArray(record) ? ownGet(record, 'proof') : undefined;
  return {
    pointer: record && typeof record === 'object' && !Array.isArray(record) ? ownGet(record, 'pointer') ?? null : null,
    type: record && typeof record === 'object' && !Array.isArray(record) ? ownGet(record, 'type') ?? null : null,
    profile: proof && typeof proof === 'object' && !Array.isArray(proof) ? ownGet(proof, 'profile') ?? null : null,
    structural,
    verifiable,
    reason_code: reasonCode,
    detail: detail || {},
  };
}

// The one entry point. Pure: same record + same inputs + same tracked tree state give the same
// report; it never throws on junk input and never writes anything.
//
// opts:
//   documentText      string | null | undefined  (absent/undefined = no document was supplied)
//   policyParameters  object | null | undefined
//   digestHexes       Set<string> | null         (published kernel digests; default: read from the
//                                                 tracked registry/kernel/ directory)
//   digestDir         string | null              (override the tracked directory location)
export function verifyDocumentSpan(record, opts) {
  const options = opts || {};
  const shape = checkRecordShape(record);
  // SPAN-EXTERNAL-MARKER (the selftest mutates this exact line to prove the suite catches an
  // `external` verdict on an incomplete record).
  if (!shape.ok) return report(record, 'fail', 'failed', shape.reason_code, shape.detail);

  const proof = ownGet(record, 'proof');
  const document = ownGet(proof, 'document');
  const locator = ownGet(proof, 'locator');
  const extractor = ownGet(proof, 'extractor');
  const lexical = ownGet(proof, 'lexical');
  const normalization = ownGet(proof, 'normalization');

  // Step 4 needs the policy side. Resolve the pointer FIRST (structural per SPEC.md section 23.2).
  const policy = Object.hasOwn(options, 'policyParameters') ? options.policyParameters : undefined;
  let policyValue;
  let policyPresent = false;
  if (policy !== undefined && policy !== null) {
    const resolved = resolveJsonPointer(ownGet(record, 'pointer'), policy);
    if (!resolved.ok) {
      return report(record, 'fail', 'failed', 'POINTER_NOT_IN_POLICY', { pointer_reason: resolved.reason });
    }
    // Private-input pointers (SPEC.md section 25): the value at the pointer is a commitment, and
    // this v1 profile refuses the combination with a plaintext lexical (build spec section 8).
    if (typeof resolved.value === 'string' && COMMITMENT_RE.test(resolved.value)) {
      return report(record, 'fail', 'failed', 'PRIVATE_INPUT_COMMITMENT_REFUSED', {});
    }
    policyValue = resolved.value;
    policyPresent = true;
  }

  // No document supplied: `external` only when the record is complete and well formed (it is, the
  // shape passed) and nothing refuted. When policy_parameters are present, step 4 still runs from
  // the lexical alone and its failure is honest.
  const hasDocument = typeof options.documentText === 'string';
  if (!hasDocument) {
    if (policyPresent) {
      const norm = normalize(lexical, normalization);
      if (!norm.ok) return report(record, 'fail', 'failed', norm.code, {});
      if (canonicalDigest(norm.value) !== canonicalDigest(policyValue)) {
        return report(record, 'pass', 'failed', 'STEP4_DIGEST_MISMATCH', { from: 'lexical-only' });
      }
    }
    return report(record, 'pass', 'external', policyPresent ? 'SELF_CONSISTENT_WITH_POLICY' : 'SELF_CONSISTENT_NO_POLICY', {});
  }

  // Step 1: the document digest binds. sha256 over the supplied text's UTF-8 bytes; the declared
  // byte count must agree with the same counter.
  const digestHex = createHash('sha256').update(options.documentText, 'utf8').digest('hex');
  if (digestHex !== ownGet(document, 'sha256')) {
    return report(record, 'fail', 'failed', 'DOCUMENT_DIGEST_MISMATCH', {});
  }
  const byteLength = _csv.utf8ByteLength(options.documentText);
  if (byteLength !== ownGet(document, 'bytes')) {
    return report(record, 'fail', 'failed', 'DOCUMENT_BYTES_MISMATCH', { declared: ownGet(document, 'bytes'), measured: byteLength });
  }

  // Step 2: extraction with the named locator. One parser for CSV (the shared bundle), an RFC 6901
  // walk for JSON. Both refuse rather than guess.
  let extracted;
  if (ownGet(document, 'media_type') === 'text/csv') {
    const parsed = _csv.parseCsv(options.documentText);
    if (!parsed.ok) {
      return report(record, 'fail', 'failed', 'CSV_PARSE_REFUSED', { error: parsed.error, detail: parsed.detail ?? null });
    }
    const header = parsed.header;
    if (!Array.isArray(header) || header.length === 0) {
      return report(record, 'fail', 'failed', 'CSV_NO_HEADER', {});
    }
    // Duplicate header names are a refusal: an ambiguous column map is worse than no map.
    const seen = new Map();
    for (let i = 0; i < header.length; i++) {
      const name = header[i];
      if (typeof name !== 'string') return report(record, 'fail', 'failed', 'CSV_HEADER_NOT_A_STRING', { index: i });
      if (seen.has(name)) return report(record, 'fail', 'failed', 'DUPLICATE_HEADER', { column: name, first_index: seen.get(name), duplicate_index: i });
      seen.set(name, i);
    }
    if (locator.scheme !== 'csv-rfc4180-cell') {
      return report(record, 'fail', 'failed', 'LOCATOR_SCHEME_MEDIA_TYPE_MISMATCH', {});
    }
    const recordIndex = locator.record;
    const columnIndex = locator.column;
    if (recordIndex >= parsed.records.length || columnIndex >= header.length) {
      return report(record, 'fail', 'failed', 'CELL_OUT_OF_RANGE', {
        record: recordIndex, column: columnIndex,
        records: parsed.records.length, columns: header.length,
      });
    }
    // Header-name agreement: the record names the header it was authored against; a disagreeing
    // name is a refusal, never a silent re-map.
    if (header[columnIndex] !== locator.header) {
      return report(record, 'fail', 'failed', 'HEADER_NAME_MISMATCH', { declared: locator.header, actual: header[columnIndex] });
    }
    const rowKey = locator.row_key;
    if (rowKey !== undefined && rowKey !== null) {
      const keyIndex = seen.get(rowKey.column);
      if (keyIndex === undefined) {
        return report(record, 'fail', 'failed', 'ROW_KEY_COLUMN_NOT_IN_HEADER', { column: rowKey.column });
      }
      // Count the keyed value's occurrences over the WHOLE column (own-key Map reads). More than
      // one is a refusal: a reordered file with a repeated key must fail loudly, not resolve to the
      // first match. SPAN-UNIQUENESS-GUARD below is the selftest's red-control mutation point.
      let rowKeyOccurrences = 0;
      for (let r = 0; r < parsed.records.length; r++) {
        const cell = parsed.records[r][keyIndex];
        if (cell === rowKey.value) rowKeyOccurrences++;
      }
      // SPAN-UNIQUENESS-GUARD (the selftest mutates the comparison above to prove this rule is
      // load-bearing: with the guard disarmed the repeated-key fixture must stop refusing).
      if (rowKeyOccurrences > 1) {
        return report(record, 'fail', 'failed', 'ROW_KEY_AMBIGUOUS', { column: rowKey.column, value: rowKey.value, occurrences: rowKeyOccurrences });
      }
      if (rowKeyOccurrences === 0) {
        return report(record, 'fail', 'failed', 'ROW_KEY_NOT_FOUND', { column: rowKey.column, value: rowKey.value });
      }
      const keyedRecord = parsed.records[recordIndex];
      if (keyedRecord[keyIndex] !== rowKey.value) {
        return report(record, 'fail', 'failed', 'ROW_KEY_VALUE_MISMATCH', { record: recordIndex, column: rowKey.column });
      }
    }
    extracted = parsed.records[recordIndex][columnIndex];
  } else {
    // application/json
    let doc;
    try {
      doc = JSON.parse(options.documentText);
    } catch (e) {
      return report(record, 'fail', 'failed', 'JSON_PARSE_REFUSED', { error: String(e && e.message ? e.message : e) });
    }
    if (locator.scheme !== 'json-pointer') {
      return report(record, 'fail', 'failed', 'LOCATOR_SCHEME_MEDIA_TYPE_MISMATCH', {});
    }
    const resolved = resolveJsonPointer(locator.pointer, doc);
    if (!resolved.ok) {
      return report(record, 'fail', 'failed', 'POINTER_MISS', { pointer_reason: resolved.reason });
    }
    if (typeof resolved.value !== 'string') {
      return report(record, 'fail', 'failed', 'POINTER_TARGET_NOT_STRING', { js_type: resolved.value === null ? 'null' : typeof resolved.value });
    }
    extracted = resolved.value;
  }

  // The extractor digest must be on the site's published digest list; an unknown digest is failed.
  const digestHexes = Object.hasOwn(options, 'digestHexes') ? options.digestHexes : loadPublishedDigestHexes(options.digestDir);
  if (digestHexes === null) {
    return report(record, 'fail', 'failed', 'DIGEST_LIST_UNAVAILABLE', {});
  }
  if (!digestHexes.has(ownGet(extractor, 'kernel_digest').slice('sha256:'.length))) {
    return report(record, 'fail', 'failed', 'EXTRACTOR_DIGEST_UNKNOWN', { digest: ownGet(extractor, 'kernel_digest') });
  }

  // Step 3: byte-for-byte equality with the recorded lexical.
  if (extracted !== lexical) {
    return report(record, 'pass', 'failed', 'LEXICAL_MISMATCH', { extracted, recorded: lexical });
  }

  // Step 4: the declared normalization, then the section 23 canonical-digest binding. Without
  // policy_parameters the binding is uncheckable and the honest verdict is `external`.
  if (!policyPresent) {
    const norm = normalize(lexical, normalization);
    if (!norm.ok) return report(record, 'fail', 'failed', norm.code, {});
    return report(record, 'pass', 'external', 'SELF_CONSISTENT_NO_POLICY', {});
  }
  const norm = normalize(lexical, normalization);
  if (!norm.ok) return report(record, 'fail', 'failed', norm.code, {});
  if (canonicalDigest(norm.value) !== canonicalDigest(policyValue)) {
    return report(record, 'pass', 'failed', 'STEP4_DIGEST_MISMATCH', { from: 'document' });
  }
  return report(record, 'pass', 'verified', 'ALL_FOUR_STEPS_PASSED', {});
}

// ---- CLI -----------------------------------------------------------------------
//   node scripts/check-document-span.mjs --record <record.json> [--document <file>]
//       [--policy <policy_parameters.json>] [--digest-dir <dir>]
// Prints the report JSON and exits 0 when structural is pass and verifiable is verified or
// external; exits 1 on any failed/refused verdict; exits 2 on usage or IO errors.

function readJsonFile(path, label) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (e) {
    console.error(`check-document-span: cannot read ${label} file: ${String(e && e.message ? e.message : e)}`);
    process.exit(2);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error(`check-document-span: ${label} file is not valid JSON: ${String(e && e.message ? e.message : e)}`);
    process.exit(2);
  }
}

function cli() {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const recordPath = getArg('--record');
  if (!recordPath) {
    console.error('usage: node scripts/check-document-span.mjs --record <record.json> [--document <file>] [--policy <policy.json>] [--digest-dir <dir>]');
    process.exit(2);
  }
  const record = readJsonFile(recordPath, 'record');
  const documentPath = getArg('--document');
  let documentText;
  if (documentPath !== undefined) {
    try {
      documentText = readFileSync(documentPath, 'utf8');
    } catch (e) {
      console.error(`check-document-span: cannot read --document file: ${String(e && e.message ? e.message : e)}`);
      process.exit(2);
    }
  }
  const policyPath = getArg('--policy');
  let policyParameters;
  if (policyPath !== undefined) {
    const parsed = readJsonFile(policyPath, 'policy');
    // Accept either the bare policy_parameters object or an artifact wrapper that carries it.
    policyParameters = parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) && Object.hasOwn(parsed, 'policy_parameters')
      ? parsed.policy_parameters
      : parsed;
  }
  const digestDir = getArg('--digest-dir');
  const result = verifyDocumentSpan(record, {
    documentText,
    policyParameters,
    ...(digestDir !== undefined ? { digestDir } : {}),
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.structural === 'pass' && (result.verifiable === 'verified' || result.verifiable === 'external') ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  cli();
}
