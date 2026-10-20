import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-772-csv-rfc4180-parser';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'parse_csv_table',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Demonstrator node for the shared _csv.bundle.mjs (SHARED-CSV-AND-PAGE-XML-1,
// per the ACCT-INFRA-KERNELS-BUILD-SPEC.md Sec 0.1 bundle + demonstrator ruling).
// Exercises the RFC 4180 parser end to end — quoted fields, embedded commas and
// CRLF inside quotes, doubled-quote decoding, BOM stripping, the declared
// byte/row/column caps and their structured refusals, the header map, and the
// per-column summary — giving the bundle an execution_hash surface, a fixture
// set, a PBT floor and a section 18 proof surface. The bundle is the reuse
// vehicle for every CSV-ingesting wave kernel; this node is not itself a wave
// deliverable.
//
// E2.PARSE DOCTRINE (same shape as node art-293's kernel comment): the CALLER
// supplies the CSV text as a plain string in policy_parameters; the zk guest
// has no DOMParser and no TextEncoder, and there is deliberately NO in-kernel
// XML/HTML tokenizer anywhere in this row. Any DOM-extracted value (an ISO
// 20022 field, a payment file cell) reaches this kernel already as text — see
// research/page-xml-extract-pattern.md for the documented page-layer extract
// pattern that feeds it.
//
// VALUES ARE STRINGS: every field is returned exactly as the bytes decode.
// No numeric coercion happens here — numeric parsing belongs to _money and
// the wave kernels.

/* ===== inlined _csv (RISC0 guest provides only _hash; bundle import is unavailable in-guest) ===== */
// _csv.bundle.mjs - RFC 4180 CSV parse + column summary bundle (SHARED-CSV-AND-PAGE-XML-1).
//
// PURPOSE: a reusable, zero-import, guest-safe pure-JS module implementing:
//   - an RFC 4180 parser: quoted fields, embedded commas, embedded CRLF inside
//     quotes, doubled quotes ("") decoding to one literal quote, records
//     separated by CRLF (a bare LF is accepted as a record terminator and
//     reported via the `bare_lf` flag; a CR NOT followed by LF is a structured
//     refusal, LONE_CR — RFC 4180 2.1/2.2 define the record break as CRLF and
//     a bare CR is never a field or record character).
//   - a header map: the first record becomes the column-name row; records are
//     addressable by name via recordsAsObjects().
//   - declared caps on input bytes (UTF-8, counted by a pure-JS byte-length
//     counter — the guest has no TextEncoder and GUEST-BUILTIN-GATE-1 forbids
//     it), record count and column count, each enforced BEFORE parsing with a
//     structured refusal (INPUT_TOO_LARGE / TOO_MANY_ROWS / TOO_MANY_COLUMNS),
//     never a silent truncation and never an unbounded loop.
//   - the estate's CSV-injection guard, inlined verbatim from
//     chaingraph/kernels/_csv_injection.mjs (its `sanitizeCsvField` /
//     `serializeCsvField` bodies are byte-identical to that file's), so any
//     value this module emits toward an export surface carries the OWASP
//     formula-prefix mitigation from the single existing SSOT rather than a
//     re-derived regex.
//
// VALUES ARE STRINGS. Every parsed field is returned exactly as the bytes
// decode — no numeric coercion of any kind (numeric parsing belongs to
// _money and the wave kernels; a parser that guesses types is a defect).
//
// NO ENGINE TRANSCENDENTALS, no Date, no regex with catastrophic backtracking
// (the parser is a single forward pass with one character of lookahead).
// Only string compare, charCodeAt and index arithmetic appear — all
// IEEE-754/V8/QuickJS/RV32IM-portable.
//
// COMPOSITION CONTRACT (ACCT-INFRA-KERNELS-BUILD-SPEC.md Sec 4): this bundle is
// inlined VERBATIM into consuming kernels between sentinel comments, never
// imported at runtime — the RISC0 guest provides only `_hash`. It carries no
// `meta`/`compute` export and is not itself an OCG node.
//
// GUEST-BUILTIN-GATE-1: no TextEncoder/atob/btoa/URL anywhere below.

const _csv = (function () {
'use strict';

// ===================== declared caps (SHARED-CSV-AND-PAGE-XML-1) ============
//
// Enforced before any parsing work, in this order: bytes, then rows, then
// columns. Each overage is a named structured refusal naming the cap and the
// measured value — never a silent clamp, never a throw.

const MAX_BYTES = 1000000;   // 1 MB of UTF-8 input
const MAX_ROWS = 10000;      // data records, header excluded
const MAX_COLS = 512;        // fields per record

// ===================== UTF-8 byte length (pure JS, no TextEncoder) ==========
//
// Counts the UTF-8 byte length of a string with the same surrogate semantics
// as the ART595-ART590-UTF8-FIX-1 encoder: unpaired surrogates encode as
// U+FFFD (3 bytes). This is a LENGTH counter only — it produces no bytes, so
// it is not a second encoder.

function utf8ByteLength(str) {
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        i++;            // surrogate pair: 4 bytes
        bytes += 4;
        continue;
      }
      code = 0xfffd;    // unpaired high surrogate: 3 bytes as U+FFFD
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      code = 0xfffd;    // lone low surrogate: 3 bytes as U+FFFD
    }
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code < 0x10000) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

// ===================== CSV-injection guard (inlined SSOT) ===================
//
// Byte-identical port of chaingraph/kernels/_csv_injection.mjs (WORKBOOK-1-
// BUILD-SPEC.md Sec WB-5, the estate's single CSV-injection SSOT, itself factored
// from chaingraph/workbook/workbook.mjs). OWASP CSV Injection cheat sheet: a
// field whose first character is one of = + - @ TAB CR is a formula trigger in
// Excel/Sheets/LibreOffice even when the field is quoted — quoting alone does
// NOT neutralize it. Mitigation is to prefix such a field with a literal
// single quote before quoting.

const CSV_INJECTION_RE = /^[=+\-@\t\r]/;

// True if `raw` (stringified) would be interpreted as a formula by a
// spreadsheet importer unless prefixed.
function isCsvInjectionRisk(raw) {
  const s = raw === null || raw === undefined ? '' : String(raw);
  return CSV_INJECTION_RE.test(s);
}

// Prefixes a dangerous leading character with `'` (OWASP mitigation). Safe
// fields pass through unchanged.
function sanitizeCsvField(raw) {
  let s = raw === null || raw === undefined ? '' : String(raw);
  if (CSV_INJECTION_RE.test(s)) s = `'${s}`;
  return s;
}

// Full RFC 4180 field serialization: sanitize, then quote if the field needs
// it (contains a quote/comma/CR/LF, or was sanitized).
function serializeCsvField(raw) {
  const wasRisk = isCsvInjectionRisk(raw);
  let s = sanitizeCsvField(raw);
  const mustQuote = wasRisk || /[",\r\n]/.test(s);
  if (mustQuote) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function serializeCsvRow(row) {
  return row.map(serializeCsvField).join(',');
}

function serializeCsvRows(rows) {
  return rows.map(serializeCsvRow).join('\r\n') + '\r\n';
}

// ===================== RFC 4180 parse (single forward pass) =================
//
// Grammar implemented (RFC 4180 Section 2, with the two declared deviations
// stated in the header: bare LF accepted and flagged; bare CR refused):
//   file      = [header CRLF] record *(CRLF record) [CRLF]
//   record    = field *(COMMA field)
//   field     = escaped / non-escaped
//   escaped   = DQUOTE *(TEXTDATA / COMMA / CR / LF / 2DQUOTE) DQUOTE
//
// A quote inside a non-escaped field is a refusal (QUOTE_IN_UNQUOTED_FIELD):
// RFC 4180 2.5-2.6 allow double-quotes ONLY inside an escaped field, and the
// common spreadsheet reading of `a"b` as literal `a"b` is a guess this parser
// declines to make. Nothing after a record's closing DQUOTE but a comma or a
// record break is refused for the same reason (CHAR_AFTER_QUOTE).

function parseCsv(text, opts) {
  const options = opts || {};
  const header = options.header !== false; // default: first record is the header
  const maxBytes = options.max_bytes == null ? MAX_BYTES : options.max_bytes;
  const maxRows = options.max_rows == null ? MAX_ROWS : options.max_rows;
  const maxCols = options.max_cols == null ? MAX_COLS : options.max_cols;

  if (typeof text !== 'string') {
    return { ok: false, error: 'NOT_A_STRING', records: [], header: null, flags: {}, bounds: boundsOf(maxBytes, maxRows, maxCols, 0, 0, 0) };
  }

  // BOM: a leading U+FEFF is stripped and REPORTED (flag bom_stripped), not
  // silently kept as the first header cell's first character — a kept BOM
  // poisons the first column name for every downstream header map.
  const flags = {};
  let body = text;
  if (body.length > 0 && body.charCodeAt(0) === 0xfeff) {
    body = body.slice(1);
    flags.bom_stripped = true;
  }

  const byteCount = utf8ByteLength(body);
  if (byteCount > maxBytes) {
    return { ok: false, error: 'INPUT_TOO_LARGE', records: [], header: null, flags, bounds: boundsOf(maxBytes, maxRows, maxCols, byteCount, 0, 0) };
  }

  // Empty input: zero records, not an error (an empty upload is a decision a
  // caller may legitimately need to hash), with an explicit empty flag.
  if (body.length === 0) {
    flags.empty_input = true;
    return { ok: true, error: null, records: [], header: null, flags, bounds: boundsOf(maxBytes, maxRows, maxCols, 0, 0, 0) };
  }

  const records = [];
  const fields = [];
  let field = '';
  let inQuotes = false;
  let fieldWasQuoted = false;
  let justClosedQuote = false; // last significant char of this field was a closing DQUOTE
  let rowHasContent = false;
  let i = 0;
  const n = body.length;

  while (i < n) {
    const c = body.charCodeAt(i);

    if (inQuotes) {
      if (c === 0x22) { // DQUOTE
        if (i + 1 < n && body.charCodeAt(i + 1) === 0x22) {
          field += '"'; // doubled quote decodes to one literal quote
          i += 2;
        } else {
          inQuotes = false; // closing quote; next char must be , CR LF or EOF
          justClosedQuote = true;
          i++;
        }
      } else {
        field += body[i]; // any other character, including CR and LF, is literal
        i++;
      }
      continue;
    }

    if (c === 0x22) { // opening quote — legal only at a field start
      if (field.length !== 0) {
        return refuse('QUOTE_IN_UNQUOTED_FIELD', records, header, flags, fieldWasQuoted, maxBytes, maxRows, maxCols, byteCount);
      }
      inQuotes = true;
      fieldWasQuoted = true;
      rowHasContent = true;
      justClosedQuote = false;
      i++;
      continue;
    }

    if (c === 0x2c) { // comma: end of field
      fields.push(field);
      field = '';
      fieldWasQuoted = false;
      justClosedQuote = false;
      rowHasContent = true;
      i++;
      continue;
    }

    if (c === 0x0d) { // CR
      if (i + 1 < n && body.charCodeAt(i + 1) === 0x0a) { // CRLF: end of record
        i += 2;
        const done = endRecord(records, fields, field, header, maxRows, maxCols);
        if (done.error) return refuse(done.error, records, header, flags, fieldWasQuoted, maxBytes, maxRows, maxCols, byteCount, done.detail);
        field = '';
        fieldWasQuoted = false;
        justClosedQuote = false;
        rowHasContent = false;
        continue;
      }
      return refuse('LONE_CR', records, header, flags, fieldWasQuoted, maxBytes, maxRows, maxCols, byteCount);
    }

    if (c === 0x0a) { // bare LF: accepted record terminator, flagged
      flags.bare_lf = true;
      i++;
      const done = endRecord(records, fields, field, header, maxRows, maxCols);
      if (done.error) return refuse(done.error, records, header, flags, fieldWasQuoted, maxBytes, maxRows, maxCols, byteCount, done.detail);
      field = '';
      fieldWasQuoted = false;
      justClosedQuote = false;
      rowHasContent = false;
      continue;
    }

    // A double-quote is not legal mid-field in an unquoted field (RFC 4180
    // Section 2.5-2.6), and neither is any character between a field's
    // closing DQUOTE and its field terminator ("a","b"x — CHAR_AFTER_QUOTE);
    // every other character is literal TEXTDATA.
    if (justClosedQuote) {
      return refuse('CHAR_AFTER_QUOTE', records, header, flags, fieldWasQuoted, maxBytes, maxRows, maxCols, byteCount);
    }
    field += body[i];
    rowHasContent = true;
    i++;
  }

  // End of input: flush the final field/record (a trailing CRLF already
  // flushed it; `rowHasContent`/length checks keep an empty trailing record
  // from being invented).
  if (inQuotes) {
    return refuse('QUOTE_NOT_CLOSED', records, header, flags, fieldWasQuoted, maxBytes, maxRows, maxCols, byteCount);
  }
  if (field.length !== 0 || fields.length !== 0 || rowHasContent) {
    const done = endRecord(records, fields, field, header, maxRows, maxCols);
    if (done.error) return refuse(done.error, records, header, flags, fieldWasQuoted, maxBytes, maxRows, maxCols, byteCount, done.detail);
  }

  // header map: split the first record off when requested.
  let headerRow = null;
  let dataRows = records;
  if (header && records.length > 0) {
    headerRow = records[0];
    dataRows = records.slice(1);
  }

  return {
    ok: true, error: null,
    header: headerRow,
    records: header ? dataRows : records,
    raw_record_count: records.length,
    flags,
    bounds: boundsOf(maxBytes, maxRows, maxCols, byteCount, dataRows.length, headerRow ? headerRow.length : (records[0] ? records[0].length : 0)),
  };
}

// Flush one completed record. Refuses ragged rows against the FIRST record's
// width (RFC 4180 2.2: each record "SHOULD contain the same number of
// fields"; this parser declares SHOULD as MUST and refuses, naming both
// counts) and enforces the row/column caps as named refusals.
function endRecord(records, fields, lastField, headerMode, maxRows, maxCols) {
  const record = fields.concat([lastField]);
  fields.length = 0; // consume the shared field buffer on EVERY path — a stale buffer would append prior records' fields to the next one
  // A record composed solely of one empty unquoted field is the empty-line
  // case only when nothing preceded it; RFC 4180 has no empty records, so a
  // truly empty line is skipped (and would already have been flushed by the
  // preceding record break).
  if (record.length === 1 && record[0] === '' ) {
    return { error: null };
  }
  if (records.length > 0 && record.length !== records[0].length) {
    return { error: 'RAGGED_ROW', detail: { row_index: records.length, expected: records[0].length, got: record.length } };
  }
  if (record.length > maxCols) {
    return { error: 'TOO_MANY_COLUMNS', detail: { row_index: records.length, max_cols: maxCols, got: record.length } };
  }
  if (records.length >= maxRows) {
    return { error: 'TOO_MANY_ROWS', detail: { max_rows: maxRows } };
  }
  records.push(record);
  return { error: null };
}

function refuse(error, records, header, flags, fieldWasQuoted, maxBytes, maxRows, maxCols, byteCount, detail) {
  const width = records.length > 0 ? records[0].length : (detail && detail.expected) || 0;
  return {
    ok: false, error, detail: detail || null,
    header: header && records.length > 0 ? records[0] : null,
    records: header ? records.slice(1) : records,
    flags, bounds: boundsOf(maxBytes, maxRows, maxCols, byteCount, records.length, width),
  };
}

function boundsOf(maxBytes, maxRows, maxCols, bytesUsed, rowsUsed, colsUsed) {
  return { max_bytes: maxBytes, max_rows: maxRows, max_cols: maxCols, bytes_used: bytesUsed, rows_used: rowsUsed, cols_used: colsUsed };
}

// ===================== header map + column summary ==========================

// Address records by column name: the header row's names map to field indexes.
// Duplicate column names are a structured refusal (DUPLICATE_COLUMN) — an
// ambiguous map is worse than no map. Returns {ok, objects, columns} or
// {ok:false, error, detail}.
function recordsAsObjects(parsed) {
  if (!parsed || !parsed.ok) return { ok: false, error: parsed ? parsed.error : 'NO_PARSE', objects: [], columns: [] };
  if (!Array.isArray(parsed.header)) return { ok: false, error: 'NO_HEADER', objects: [], columns: [] };
  const seen = Object.create(null);
  for (let i = 0; i < parsed.header.length; i++) {
    const name = parsed.header[i];
    if (Object.prototype.hasOwnProperty.call(seen, name)) {
      return { ok: false, error: 'DUPLICATE_COLUMN', detail: { column: name, first_index: seen[name], duplicate_index: i }, objects: [], columns: parsed.header };
    }
    seen[name] = i;
  }
  const objects = [];
  for (let r = 0; r < parsed.records.length; r++) {
    const rec = parsed.records[r];
    const obj = Object.create(null);
    for (let c = 0; c < parsed.header.length; c++) {
      obj[parsed.header[c]] = rec[c];
    }
    objects.push(obj);
  }
  return { ok: true, error: null, objects, columns: parsed.header };
}

// Per-column summary over the parsed data records: name, non_empty_count,
// empty_count, min_length, max_length, all_quoted is NOT tracked (quoting is
// a serialization detail, not data) — length stats are over the decoded
// string values. Deterministic, capped inputs only.
function columnSummary(parsed) {
  if (!parsed || !parsed.ok) return { ok: false, error: parsed ? parsed.error : 'NO_PARSE', columns: [] };
  const width = parsed.header ? parsed.header.length : (parsed.records.length > 0 ? parsed.records[0].length : 0);
  const cols = [];
  for (let c = 0; c < width; c++) {
    cols.push({
      index: c,
      name: parsed.header ? parsed.header[c] : null,
      non_empty_count: 0,
      empty_count: 0,
      min_length: -1,
      max_length: 0,
    });
  }
  for (let r = 0; r < parsed.records.length; r++) {
    const rec = parsed.records[r];
    for (let c = 0; c < cols.length; c++) {
      const v = rec[c];
      if (v === '') {
        cols[c].empty_count++;
      } else {
        cols[c].non_empty_count++;
        const len = v.length;
        if (cols[c].min_length === -1 || len < cols[c].min_length) cols[c].min_length = len;
        if (len > cols[c].max_length) cols[c].max_length = len;
      }
    }
  }
  for (let c = 0; c < cols.length; c++) {
    if (cols[c].min_length === -1) cols[c].min_length = 0; // column entirely empty
  }
  return { ok: true, error: null, columns: cols };
}

return Object.freeze({
  MAX_BYTES, MAX_ROWS, MAX_COLS, CSV_INJECTION_RE,
  utf8ByteLength,
  isCsvInjectionRisk, sanitizeCsvField, serializeCsvField, serializeCsvRow, serializeCsvRows,
  parseCsv, recordsAsObjects, columnSummary,
});
})();

// Export retained ONLY for this bundle's own PBT floor to import and exercise
// internals directly (chaingraph/kernels/__proptests__/art-772-*.proptest.mjs).
// Consuming kernels NEVER import this — they inline the IIFE above verbatim
// between sentinel comments and destructure the local `_csv` const, per the
// composition contract (ACCT-INFRA-KERNELS-BUILD-SPEC.md Sec 4.1 rule 1). This
// export line sits OUTSIDE the inlined region by construction, so the
// inlined copy in art-772's kernel.mjs stays byte-identical to everything
// above it, sentinel to sentinel.
/* ===== END inlined _csv ===== */

const {
  MAX_BYTES, MAX_ROWS, MAX_COLS,
  parseCsv, recordsAsObjects, columnSummary,
  isCsvInjectionRisk, sanitizeCsvField, serializeCsvRows,
} = _csv;

function safeBool(v, def) { return typeof v === 'boolean' ? v : def; }
function safeInt(v, def) { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : def; }

export function compute(pp) {
  pp = pp || {};
  const compliance_flags = [];

  const header = safeBool(pp.header, true);
  const summarize = safeBool(pp.summarize, true);
  // sanitize_export: run every value this node will echo toward an export
  // surface through the OWASP CSV-injection guard (the inlined
  // _csv_injection.mjs SSOT) — a leading = + - @ TAB CR gets the literal
  // apostrophe prefix, and the serialized export rows are fully RFC 4180
  // quoted. Values the caller never exports are NOT rewritten (flagged
  // instead) so the parse result stays a faithful decode.
  const sanitizeExport = safeBool(pp.sanitize_export, false);

  const caps = {
    max_bytes: safeInt(pp.max_bytes, MAX_BYTES),
    max_rows: safeInt(pp.max_rows, MAX_ROWS),
    max_cols: safeInt(pp.max_cols, MAX_COLS),
  };

  const parsed = parseCsv(pp.csv_text, {
    header,
    max_bytes: caps.max_bytes,
    max_rows: caps.max_rows,
    max_cols: caps.max_cols,
  });

  const bounds = {
    max_bytes: caps.max_bytes, max_rows: caps.max_rows, max_cols: caps.max_cols,
    bytes_used: parsed.bounds ? parsed.bounds.bytes_used : 0,
    rows_used: parsed.bounds ? parsed.bounds.rows_used : 0,
    cols_used: parsed.bounds ? parsed.bounds.cols_used : 0,
  };

  if (!parsed.ok) {
    compliance_flags.push(parsed.error);
    return {
      output_payload: {
        ok: false,
        error: parsed.error,
        detail: parsed.detail || null,
        header: parsed.header || null,
        records: parsed.records || [],
        column_summary: null,
        export_rows: null,
        serialized_rows: null,
        injection_flags: parsed.flags || {},
        bounds,
        note: 'Structured refusal: ' + parsed.error + ' — the input is refused whole, never partially parsed.',
      },
      compliance_flags,
    };
  }

  if (parsed.flags.bom_stripped) compliance_flags.push('BOM_STRIPPED');
  if (parsed.flags.bare_lf) compliance_flags.push('BARE_LF_TERMINATORS');
  if (parsed.flags.empty_input) compliance_flags.push('EMPTY_INPUT');

  let column_summary = null;
  if (summarize) {
    const sum = columnSummary(parsed);
    if (sum.ok) column_summary = sum.columns;
    else { compliance_flags.push(sum.error); column_summary = null; }
  }

  let export_rows = null;
  let serialized_rows = null;
  let unsanitized_risk_count = 0;
  if (sanitizeExport) {
    export_rows = parsed.records.map((rec) => rec.map((v) => {
      if (isCsvInjectionRisk(v)) unsanitized_risk_count++;
      return sanitizeCsvField(v);
    }));
    serialized_rows = serializeCsvRows(export_rows);
  }

  if (sanitizeExport && unsanitized_risk_count > 0) compliance_flags.push('CSV_INJECTION_PREFIXED');
  if (!sanitizeExport && parsed.records.some((rec) => rec.some((v) => isCsvInjectionRisk(v)))) {
    compliance_flags.push('CSV_INJECTION_RISK_UNSANITIZED');
  }

  return {
    output_payload: {
      ok: true,
      error: null,
      detail: null,
      header: parsed.header,
      records: parsed.records,
      column_summary,
      export_rows,
      serialized_rows,
      injection_flags: {
        sanitize_export: sanitizeExport,
        values_prefixed: sanitizeExport ? unsanitized_risk_count : 0,
      },
      bounds,
      note: 'RFC 4180 parse over the inlined _csv bundle: quoted fields, embedded CRLF, doubled quotes, BOM stripped and flagged, declared byte/row/column caps with structured refusals, header map, per-column summary. All values are strings; numeric parsing belongs to downstream money kernels. CSV-injection guard (OWASP formula-prefix rule) applied to export-echoed values when sanitize_export is true.',
    },
    compliance_flags,
  };
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
