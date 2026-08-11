// art-602 — MiCA Register Presence Check: pure decision kernel.
//
// SPEC-MICA-REGISTER-1-BUILD-SPEC.md §3 (as-of semantics), §4 (paste-in only),
// §5 (new node, not an edit). Answers exactly one question: WAS a named entity
// present in a register extract the reader captured on a date they supply?
//
// ⛔ THE VERDICT IS A DATED FACT ABOUT A SNAPSHOT, NEVER A STATUS DETERMINATION.
// The wording is fixed by §3 and is the only sentence this kernel emits:
//   "As of <retrieval_date>, entity <X> [was / was not] present in the
//    [white-paper / CASP] register snapshot with digest <register_snapshot_digest>."
// It never says "authorised", never says "is", never speaks about today, and
// never claims the register itself is current or complete. Absence from a
// snapshot is absence from THAT PASTED TEXT, nothing more — the reader may
// simply have pasted the wrong export, the wrong page of it, or an identifier
// spelled differently from the register's own spelling.
//
// DISTINCT FROM THREE SHIPPED SURFACES (state this on the page too):
//   art-512-check-mica-reserve-disclosure  checks a PUBLISHED RESERVE DISCLOSURE
//                                          against caller-declared Article 30/36/37/54
//                                          terms. A different document, a different
//                                          question. Its kernel is NOT edited here.
//   art-102-crypto-asset-whitepaper-linter structurally lints a white paper against
//                                          the ESMA MiCA taxonomy. It reads the white
//                                          paper, not the register of white papers.
//   tools/332-mica-casp-authorization-checker walks authorisation scoping. That tool
//                                          asks the status question this kernel
//                                          deliberately refuses to answer.
//
// HARD FENCE (receipt MUST record this, copy MUST lead with it): the register
// extract, the entity identifier, the register type and the retrieval date are
// every one of them CALLER INPUTS. This kernel performs NO lookup of any kind
// (zero-egress by contract), ships NO bundled copy of either ESMA register, and
// has NO clock — `retrieval_date` is supplied by the reader, never `Date.now()`,
// because a machine-read clock would date the RUN rather than the CAPTURE, and
// those are different facts. `register_snapshot_digest` pins the exact bytes the
// verdict was reached against, so a later register update makes an old receipt
// DATED, not wrong.
//
// WHY NO REGISTER SHIPS AND NO FETCH EXISTS: a bundled register export is a
// standing duty to chase ESMA's revisions, and it goes silently false the day it
// is not chased. A scheduled refresh would be the same duty wearing a cron. The
// reader pastes what they captured; the digest makes what they pasted auditable.
//
// REGIME CONTEXT, NAMED IN PROSE ONLY — no pinned citation object is emitted,
// because under the shared estate rule a regulatory citation is a §28 pinned
// object carrying a verified `in_force_from`, or there is none. Regulation (EU)
// 2023/1114 (MiCA) requires ESMA to maintain public registers; the two this node
// is shaped for are the register of crypto-asset white papers and the register of
// authorised crypto-asset service providers. Which register an extract came from
// is a CALLER INPUT (`register_type`) precisely because guessing it would put the
// wrong noun into a verdict sentence that a reader may quote.
//
// DETERMINISM: no `Date` object in any form, no clock, no locale-sensitive call,
// no host crypto. SHA-256 is the inlined pure-JS implementation already proven in
// art-199/200/206/210/280/286 (crypto.subtle is banned in the zkVM guest), called
// from a SYNCHRONOUS `compute()` — the art-476 lesson in board/RIDER-KERNEL.md.
// Inputs are bounded (art-201 lesson): oversized extracts are REFUSED with a named
// flag, never silently truncated, because a truncated extract would produce a
// digest over bytes the reader never saw.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-602-mica-register-presence-check';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'check_mica_register_presence',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

// ── bounded-input limits (exec-check-friendly, art-201 lesson) ──────────────
const MAX_EXTRACT_CHARS = 262144;  // 256 Ki characters of pasted extract
const MAX_ROWS = 5000;             // register exports are paged; a whole export is not the unit
const MAX_CELLS_PER_ROW = 128;

// ── Inlined pure-JS SHA-256 (no crypto.subtle, no TextEncoder) ─────────────
// Same implementation proven in art-199/200/206/210/280/286 crypto kernels.

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
  [h0,h1,h2,h3,h4,h5,h6,h7].forEach(function(v, i) { const j = i * 4; r[j] = v >>> 24; r[j+1] = (v >>> 16) & 0xff; r[j+2] = (v >>> 8) & 0xff; r[j+3] = v & 0xff; });
  return r;
}

function _sha256Hex(str) {
  return Array.from(_sha256(_utf8Bytes(str))).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── strict ISO date handling, INTEGER ARITHMETIC ONLY. The `Date` object does
//    not appear in this file in any form: no `Date.now()`, no `new Date()`, not
//    even `Date.UTC`. The round-trip below is what rejects 2026-02-30 without a
//    calendar table. The date is validated, echoed, and never compared against a
//    clock — there is no clock. ──────────────────────────────────────────────
function daysFromCivil(y, m, d) {
  const yy = y - (m <= 2 ? 1 : 0);
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function civilFromDays(z) {
  const zz = z + 719468;
  const era = Math.floor(zz / 146097);
  const doe = zz - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return { y: y + (m <= 2 ? 1 : 0), m, d };
}

function isValidIsoDay(s) {
  const mm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? '').trim());
  if (!mm) return false;
  const y = Number(mm[1]), mo = Number(mm[2]), d = Number(mm[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const back = civilFromDays(daysFromCivil(y, mo, d));
  return back.y === y && back.m === mo && back.d === d;
}

// ── register-type vocabulary. TWO values, no default, no inference. The verdict
//    sentence names the register in words, so an inferred value would put a noun
//    the reader never chose into a sentence they may quote. ──────────────────
const REGISTER_LABELS = {
  white_paper: 'white-paper',
  casp: 'CASP',
};

// ── RFC 4180-shaped row/field split. Quoted fields may contain the delimiter,
//    CR/LF, and doubled quotes. Row splitting is done by the same scanner that
//    splits fields, so a newline inside a quoted field does not fabricate a row.
//    Line endings are normalised for STRUCTURE only — the digest is always taken
//    over the extract exactly as pasted, never over a normalised copy. ───────
function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let rowStart = 0;
  const raw = [];
  const src = String(text);
  const delim = delimiter.charAt(0);

  const endField = () => { row.push(field); field = ''; };
  const endRow = (endIdx) => {
    endField();
    rows.push(row);
    raw.push(src.slice(rowStart, endIdx));
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === delim) { endField(); continue; }
    if (ch === '\n' || ch === '\r') {
      endRow(i);
      if (ch === '\r' && src[i + 1] === '\n') i++;
      rowStart = i + 1;
      continue;
    }
    field += ch;
  }
  if (field.length > 0 || row.length > 0 || rowStart < src.length) endRow(src.length);

  // Blank lines are dropped from the parsed set but their raw text is kept in
  // step with it, so a reported line number always points at the line the reader
  // can see in their own paste.
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i];
    const isBlank = cells.length === 1 && cells[0].trim() === '';
    if (isBlank) continue;
    out.push({ line_number: i + 1, cells, raw: raw[i] });
  }
  return out;
}

const NOT_PROVEN = [
  { item: 'Authorisation status', detail: 'Presence in a register extract is not authorisation, licensing, registration in good standing, or any other status. This kernel reports whether a line was found in pasted text on a stated date, and refuses to say anything about what is true today.' },
  { item: 'Snapshot completeness', detail: 'The extract is whatever the reader pasted. Absence of a match proves absence from THAT TEXT, never absence from the register: a partial page, a filtered export, or a different register would each produce the same "was not present" reading.' },
  { item: 'Snapshot authenticity', detail: 'Nothing here proves the pasted text came from ESMA, was unmodified in transit, or was captured on the date supplied. The digest pins the bytes that were checked; it does not attest their provenance.' },
  { item: 'Identifier correctness', detail: 'The entity identifier is compared as a literal string against the extract\'s own cells. A register spelling the identifier differently, a legal-name change, or a subsidiary listed under a different LEI all read as no match, and none of those is evidence about the entity.' },
  { item: 'Currency of the register', detail: 'The register itself may have been stale, mid-update, or corrected after capture. retrieval_date dates the CAPTURE, not the register, and this kernel has no clock with which to compare either against now.' },
];

/**
 * compute(pp) — pure MiCA register-presence check.
 * pp: {
 *   register_type: 'white_paper' | 'casp',
 *   entity_identifier: string,             // LEI or register ID, compared literally
 *   register_extract: string,              // the pasted CSV/extract, verbatim
 *   retrieval_date: string,                // ISO YYYY-MM-DD, CALLER-SUPPLIED
 *   register_source_ref?: string,          // free-text label of where it came from
 *   delimiter?: string,                    // default ','
 *   header_row?: boolean,                  // default true
 *   match_column?: string|number|null,     // header name or 0-based index; null = any cell
 *   case_sensitive?: boolean,              // default true
 * }
 */
export function compute(pp) {
  const params = (pp !== null && typeof pp === 'object') ? pp : {};

  const compliance_flags = [];
  const judgmentFields = [];

  // ── 1. THE SNAPSHOT AND ITS DIGEST ────────────────────────────────────
  const extractRaw = typeof params.register_extract === 'string' ? params.register_extract : '';
  const extractPresent = extractRaw.trim().length > 0;
  const extractTooLarge = extractRaw.length > MAX_EXTRACT_CHARS;

  // The digest is over the extract EXACTLY as pasted. It is computed even when
  // the extract is refused for size, so the receipt still pins what was rejected.
  const register_snapshot_digest = extractPresent ? `sha256:${_sha256Hex(extractRaw)}` : null;

  if (!extractPresent) {
    compliance_flags.push('MICA_REGISTER_EXTRACT_EMPTY');
    judgmentFields.push({
      field: 'register_extract',
      reason: 'No register extract was pasted, so there is nothing to search and no snapshot to digest. This kernel ships no copy of either ESMA register and performs no lookup, so an absent extract is an absent input, never an empty result.',
      supplied: null,
    });
  }
  if (extractTooLarge) {
    compliance_flags.push('MICA_REGISTER_EXTRACT_TOO_LARGE');
    judgmentFields.push({
      field: 'register_extract',
      reason: `The extract is ${extractRaw.length} characters, above the ${MAX_EXTRACT_CHARS}-character bound. It is refused rather than truncated: a truncated extract would carry a digest over bytes the reader never saw, and a "was not present" reading over a silently shortened text is worse than no reading.`,
      supplied: `${extractRaw.length} characters`,
    });
  }

  // ── 2. THE THREE OTHER CALLER FACTS ───────────────────────────────────
  const registerTypeRaw = params.register_type === undefined || params.register_type === null ? '' : String(params.register_type);
  const registerType = Object.prototype.hasOwnProperty.call(REGISTER_LABELS, registerTypeRaw) ? registerTypeRaw : null;
  if (registerType === null) {
    judgmentFields.push({
      field: 'register_type',
      reason: 'register_type must be declared as "white_paper" (register of crypto-asset white papers) or "casp" (register of authorised crypto-asset service providers). It carries no default: the verdict sentence names the register in words, and inferring which register an extract came from would put a noun the reader never chose into a sentence they may quote.',
      supplied: params.register_type ?? null,
    });
  }
  const registerLabel = registerType === null ? null : REGISTER_LABELS[registerType];

  const identifierRaw = params.entity_identifier === undefined || params.entity_identifier === null ? '' : String(params.entity_identifier);
  const identifier = identifierRaw.trim();
  if (identifier === '') {
    judgmentFields.push({
      field: 'entity_identifier',
      reason: 'No entity identifier was supplied, so there is nothing to look for. The identifier is compared as a literal string against the extract\'s own cells; this kernel resolves no names and holds no directory.',
      supplied: params.entity_identifier ?? null,
    });
  }

  const retrievalDateRaw = params.retrieval_date === undefined || params.retrieval_date === null ? '' : String(params.retrieval_date).trim();
  const retrievalDateValid = isValidIsoDay(retrievalDateRaw);
  if (!retrievalDateValid) {
    judgmentFields.push({
      field: 'retrieval_date',
      reason: 'retrieval_date must be supplied as an ISO calendar date (YYYY-MM-DD). It is the date the READER captured the extract and it is never read from a clock: a machine clock would date the run rather than the capture, and the verdict is a statement about the capture.',
      supplied: params.retrieval_date ?? null,
    });
  }
  const retrieval_date = retrievalDateValid ? retrievalDateRaw : null;

  // ── 3. SEARCH SETTINGS (all caller-visible, all echoed) ────────────────
  const delimiterRaw = typeof params.delimiter === 'string' && params.delimiter.length > 0 ? params.delimiter.charAt(0) : ',';
  const headerRow = params.header_row === undefined || params.header_row === null ? true : params.header_row === true;
  const caseSensitive = params.case_sensitive === undefined || params.case_sensitive === null ? true : params.case_sensitive === true;
  const matchColumnRaw = params.match_column === undefined || params.match_column === null || params.match_column === '' ? null : params.match_column;

  // ── 4. PARSE AND SEARCH ───────────────────────────────────────────────
  const searchable = extractPresent && !extractTooLarge;
  let parsedRows = searchable ? parseDelimited(extractRaw, delimiterRaw) : [];

  let rowCapExceeded = false;
  if (parsedRows.length > MAX_ROWS) {
    rowCapExceeded = true;
    parsedRows = [];
    compliance_flags.push('MICA_REGISTER_ROW_CAP_EXCEEDED');
    judgmentFields.push({
      field: 'register_extract',
      reason: `The extract parses to more than ${MAX_ROWS} rows. It is refused rather than searched in part, for the same reason an oversized extract is refused: a partial search reported as a full one is a false negative wearing a verdict.`,
      supplied: `more than ${MAX_ROWS} rows`,
    });
  }

  const headerCells = headerRow && parsedRows.length > 0 ? parsedRows[0].cells.map((c) => c.trim()) : [];
  const dataRows = headerRow ? parsedRows.slice(1) : parsedRows;

  // Resolve match_column against the header (by name) or by 0-based index. An
  // unresolvable column is raised, never quietly widened back to "any cell":
  // widening would turn a targeted search the reader asked for into a looser one
  // whose result they would read as the targeted one.
  let matchColumnIndex = null;
  let matchColumnResolved = null;
  if (matchColumnRaw !== null) {
    if (typeof matchColumnRaw === 'number' && Number.isInteger(matchColumnRaw) && matchColumnRaw >= 0) {
      matchColumnIndex = matchColumnRaw;
      matchColumnResolved = `index ${matchColumnRaw}`;
    } else {
      const wanted = String(matchColumnRaw).trim();
      const idx = headerCells.indexOf(wanted);
      if (idx >= 0) {
        matchColumnIndex = idx;
        matchColumnResolved = `header "${wanted}" at index ${idx}`;
      } else if (searchable && !rowCapExceeded) {
        judgmentFields.push({
          field: 'match_column',
          reason: `match_column "${wanted}" does not appear in the parsed header row, so the targeted search the caller asked for cannot be run. It is not widened back to an any-cell search: that would answer a different question than the one asked.`,
          supplied: matchColumnRaw,
        });
      }
    }
  }
  const columnUnresolved = matchColumnRaw !== null && matchColumnIndex === null;

  const needle = caseSensitive ? identifier : identifier.toLowerCase();
  const cellMatches = (cell) => {
    const v = String(cell ?? '').trim();
    return (caseSensitive ? v : v.toLowerCase()) === needle;
  };

  const canSearch = searchable && !rowCapExceeded && identifier !== '' && !columnUnresolved;

  const matched_rows = [];
  if (canSearch) {
    for (const r of dataRows) {
      if (r.cells.length > MAX_CELLS_PER_ROW) continue;
      const hit = matchColumnIndex === null
        ? r.cells.some(cellMatches)
        : cellMatches(r.cells[matchColumnIndex]);
      if (hit) {
        matched_rows.push({
          line_number: r.line_number,
          matched_row: r.raw,
          cells: r.cells,
          matched_column_index: matchColumnIndex === null
            ? r.cells.findIndex(cellMatches)
            : matchColumnIndex,
        });
      }
    }
  }

  // match_found is a TRISTATE. null means the search did not run — it is never
  // collapsed to false, because "we could not look" and "we looked and it was
  // absent" are different facts and only one of them belongs in a verdict.
  const match_found = canSearch ? matched_rows.length > 0 : null;
  const matched_row = matched_rows.length > 0 ? matched_rows[0].matched_row : null;

  if (match_found === true) compliance_flags.push('MICA_REGISTER_MATCH_FOUND');
  else if (match_found === false) compliance_flags.push('MICA_REGISTER_NO_MATCH');
  if (matched_rows.length > 1) compliance_flags.push('MICA_REGISTER_MULTIPLE_MATCHES');

  // ── 5. THE VERDICT SENTENCE — §3, fixed wording, no other form emitted ──
  const verdictSayable = match_found !== null && retrieval_date !== null && registerLabel !== null && register_snapshot_digest !== null;
  const verdict = verdictSayable
    ? `As of ${retrieval_date}, entity ${identifier} ${match_found ? 'was' : 'was not'} present in the ${registerLabel} register snapshot with digest ${register_snapshot_digest}.`
    : null;
  const verdict_unavailable_reason = verdictSayable
    ? null
    : 'The verdict sentence is withheld because at least one of its four terms is missing: the retrieval date, the register type, the snapshot digest, or a search that actually ran. A sentence assembled from absent terms would read as a finding.';

  if (judgmentFields.length > 0) compliance_flags.push('ESCALATION_RAISED');
  compliance_flags.push('MICA_REGISTER_PRESENCE_CHECKED');

  const judgment_required = judgmentFields.length === 0 ? null : {
    fields: judgmentFields,
    reason: 'One or more inputs the verdict depends on were absent or unusable, so the corresponding step was not performed. An absent input is reported as unresolved, never defaulted into a reading.',
  };

  const rationale = [];
  rationale.push(extractPresent
    ? `The pasted extract is ${extractRaw.length} characters and is pinned by digest ${register_snapshot_digest}; every statement below is against those exact bytes.`
    : 'No extract was pasted, so nothing was searched and no snapshot was pinned.');
  rationale.push(rowCapExceeded
    ? `The extract parses to more than ${MAX_ROWS} rows and was refused rather than searched in part.`
    : (searchable
        ? `The extract parses to ${parsedRows.length} non-blank line${parsedRows.length === 1 ? '' : 's'}${headerRow ? ', the first read as a header row' : ', with no header row declared'}, giving ${dataRows.length} data row${dataRows.length === 1 ? '' : 's'} to search.`
        : 'The extract was not searched.'));
  rationale.push(matchColumnRaw === null
    ? 'Every cell of every data row was compared, because no match_column was declared.'
    : (columnUnresolved
        ? 'The declared match_column could not be resolved against the header, so no targeted search was run and none was substituted.'
        : `Only the column resolved as ${matchColumnResolved} was compared, because that is the column the caller declared.`));
  rationale.push(match_found === null
    ? 'No presence reading was reached, so match_found is null rather than false: not looking and looking-and-not-finding are different facts.'
    : (match_found
        ? (matched_rows.length === 1
            ? `One line matched the identifier ${identifier}, at line ${matched_rows[0].line_number} of the paste, and is echoed verbatim.`
            : `${matched_rows.length} lines matched the identifier ${identifier}; all are echoed verbatim with their line numbers, and the first is reported as matched_row.`)
        : `No line in the searched rows carried the identifier ${identifier} as a cell value, compared ${caseSensitive ? 'case-sensitively' : 'case-insensitively'} after trimming.`));
  rationale.push('Presence here is a dated fact about a pasted snapshot. It is not authorisation, not a current status, not a statement that the register is complete or current, and not legal advice.');

  const output_payload = {
    register_type: registerType,
    register_label: registerLabel,
    entity_identifier: identifier === '' ? null : identifier,
    retrieval_date,
    register_source_ref: params.register_source_ref === undefined ? null : params.register_source_ref,
    register_snapshot_digest,
    snapshot: {
      extract_length_chars: extractRaw.length,
      extract_present: extractPresent,
      extract_too_large: extractTooLarge,
      max_extract_chars: MAX_EXTRACT_CHARS,
      parsed_line_count: parsedRows.length,
      data_row_count: dataRows.length,
      header_row_declared: headerRow,
      header_cells: headerCells,
      row_cap_exceeded: rowCapExceeded,
      max_rows: MAX_ROWS,
    },
    search: {
      delimiter: delimiterRaw,
      case_sensitive: caseSensitive,
      match_column_declared: matchColumnRaw,
      match_column_resolved: matchColumnResolved,
      match_column_unresolved: columnUnresolved,
      searched: canSearch,
    },
    match_found,
    matched_row,
    matched_rows,
    match_count: matched_rows.length,
    verdict,
    verdict_unavailable_reason,
    judgment_required,
    rationale,
    not_proven: NOT_PROVEN,
    fence: 'The register extract, the entity identifier, the register type and the retrieval date are every one of them a caller input. This kernel performs no lookup of any kind (zero-egress by contract), ships no copy of either ESMA register, and has no clock: retrieval_date is the date the reader captured the extract, never a machine clock read. register_snapshot_digest pins the exact pasted bytes the verdict was reached against, so a later register update makes an old receipt dated rather than wrong. Presence in a snapshot is never authorisation and never a statement about today.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type:       meta.mandate_type,
    tool_id:             TOOL_ID,
    tool_version:        TOOL_VERSION,
    generated_at:        now ?? null,
    execution_hash:      hash,
    chain:               { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:   pp,
    output_payload,
    compliance_flags,
    compute_mode:        'server',
    audit_signature:     { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
