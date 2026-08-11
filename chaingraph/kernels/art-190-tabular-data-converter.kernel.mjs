import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-190-tabular-data-converter';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'convert_tabular_data',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Deterministic tabular conversion across CSV, JSON (array-of-objects), and GFM
// pipe tables. RFC 4180 CSV parsing (quoted fields, embedded delimiters/newlines,
// escaped quotes). JSON key order = header order. Numbers stay strings unless
// coerce_types is set, and then only strings matching a strict finite-decimal
// regex are coerced (NaN/Infinity can never be produced). Ragged rows, duplicate
// headers, and coercions are surfaced in warnings[], never silently dropped.
// Zero network, zero PII.

// --- RFC 4180 CSV parse: string -> string[][] --------------------------------
function parseCsv(text, delimiter) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  const src = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } // escaped quote
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); field = ''; rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  // flush trailing field/row (unless the input ended on a newline with no partial row)
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

// CSV field serialization (RFC 4180): quote when field holds delimiter, quote,
// or newline; escape embedded quotes by doubling.
function csvField(v, delimiter) {
  const s = String(v ?? '');
  if (s.includes(delimiter) || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// Strict finite decimal: optional sign, digits, optional fraction, optional exp.
const DECIMAL_RE = /^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/;
function coerce(v) {
  const s = String(v).trim();
  if (DECIMAL_RE.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }
  return v;
}

function mdCell(v) {
  return String(v ?? '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function dedupeHeaders(header, warnings) {
  const seen = Object.create(null);
  return header.map((h, idx) => {
    const name = h === '' ? `column_${idx + 1}` : h;
    if (seen[name]) {
      warnings.push(`duplicate header "${name}" renamed to "${name}_${seen[name] + 1}"`);
      seen[name]++;
      return `${name}_${seen[name]}`;
    }
    seen[name] = 1;
    return name;
  });
}

// Normalize any supported source into { columns[], rows[] } where rows are objects.
function toTable(data, sourceFormat, opts, warnings) {
  const hasHeader = opts.has_header !== false;
  const delimiter = opts.delimiter || ',';

  if (sourceFormat === 'json') {
    let parsed;
    try { parsed = JSON.parse(String(data || '[]')); }
    catch (e) { throw new Error('JSON parse error: ' + e.message); }
    if (!Array.isArray(parsed)) throw new Error('JSON input must be an array of objects.');
    const columns = [];
    for (const obj of parsed) {
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        for (const k of Object.keys(obj)) if (!columns.includes(k)) columns.push(k);
      }
    }
    const rows = parsed.map((obj) => {
      const r = {};
      for (const c of columns) r[c] = (obj && typeof obj === 'object' && c in obj) ? obj[c] : '';
      return r;
    });
    return { columns, rows };
  }

  // CSV or markdown_table both reduce to a grid of string cells.
  let grid;
  if (sourceFormat === 'markdown_table') {
    const lines = String(data).replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim() !== '');
    const split = (r) => r.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
    grid = lines
      .filter((l) => !/^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/.test(l))
      .map(split);
  } else { // csv
    grid = parseCsv(data, delimiter).filter((r) => !(r.length === 1 && r[0] === ''));
  }

  if (grid.length === 0) return { columns: [], rows: [] };

  let header, bodyStart;
  if (hasHeader) { header = grid[0]; bodyStart = 1; }
  else { header = grid[0].map((_, idx) => `column_${idx + 1}`); bodyStart = 0; }
  const columns = dedupeHeaders(header, warnings);

  const rows = [];
  for (let r = bodyStart; r < grid.length; r++) {
    const cells = grid[r];
    if (cells.length !== columns.length) {
      warnings.push(`row ${r + 1} has ${cells.length} field(s), expected ${columns.length} (ragged row padded/truncated to header width)`);
    }
    const obj = {};
    columns.forEach((c, ci) => { obj[c] = cells[ci] ?? ''; });
    rows.push(obj);
  }
  return { columns, rows };
}

function fromTable(table, targetFormat, opts, warnings) {
  const delimiter = opts.delimiter || ',';
  const coerceTypes = opts.coerce_types === true;
  const { columns, rows } = table;

  const cellVal = (v) => {
    if (coerceTypes && typeof v === 'string') {
      const c = coerce(v);
      if (typeof c === 'number') warnings.push(`coerced "${v}" to number ${c}`);
      return c;
    }
    return v;
  };

  if (targetFormat === 'json') {
    const arr = rows.map((row) => {
      const o = {};
      for (const c of columns) o[c] = cellVal(row[c]);
      return o;
    });
    return JSON.stringify(arr, null, 2);
  }

  if (targetFormat === 'markdown_table') {
    const head = '| ' + columns.map(mdCell).join(' | ') + ' |';
    const sep = '| ' + columns.map(() => '---').join(' | ') + ' |';
    const body = rows.map((row) =>
      '| ' + columns.map((c) => mdCell(cellVal(row[c]))).join(' | ') + ' |').join('\n');
    return [head, sep, body].filter((s) => s !== '').join('\n');
  }

  // csv
  const head = columns.map((c) => csvField(c, delimiter)).join(delimiter);
  const body = rows.map((row) =>
    columns.map((c) => csvField(cellVal(row[c]), delimiter)).join(delimiter)).join('\n');
  return [head, body].filter((s) => s !== '').join('\n');
}

// Synchronous, WebCrypto-free SHA-256 (ASYNC-VACUOUS-REMEDIATE-1).
// Transcribed from the proven art-476 block. compute() MUST be synchronous: the zkVM
// guest and the host verifier both call compute(pp) directly, and an async compute
// returns a Promise that canonicalizes to {} -- a groth16 seal over an empty journal.
// The digest VALUES are unchanged from the WebCrypto path, so fixtures, golden hashes
// and execution_hash all stay identical; the self-check below pins that byte-for-byte.

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
  const rotr = (x, n2) => (x >>> n2) | (x << (32 - n2));
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

function _toHex(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

// STOP conditions. Both MUST pass or this kernel throws and emits no digest.
// KNOWN_VECTOR_ASCII pins the SHA-256 core. KNOWN_VECTOR_UTF8 pins _utf8Bytes against
// the host TextEncoder byte-for-byte: the fixtures are pure ASCII and cannot catch a
// multi-byte divergence, so a non-ASCII vector is pinned explicitly. It covers 2-byte
// (e-acute), 3-byte (euro, CJK) and 4-byte surrogate-pair (emoji) encodings.
const KNOWN_VECTOR_ASCII = 'hello world';
const KNOWN_VECTOR_ASCII_SHA = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';
const KNOWN_VECTOR_UTF8 = 'é€中🌍';
const KNOWN_VECTOR_UTF8_BYTES = 'c3a9e282ace4b8adf09f8c8d';
const KNOWN_VECTOR_UTF8_SHA = 'a0ce5afdae3fe5735aafeb2e6e0fc183133f3c47776e74fc85aedcc0cf7f1b6a';
(function _shaSelfCheck() {
  const a = _toHex(_sha256(_utf8Bytes(KNOWN_VECTOR_ASCII)));
  if (a !== KNOWN_VECTOR_ASCII_SHA) {
    throw new Error('SHA-256 self-check FAILED: got ' + a + ' expected ' + KNOWN_VECTOR_ASCII_SHA);
  }
  const encoded = _toHex(_utf8Bytes(KNOWN_VECTOR_UTF8));
  if (encoded !== KNOWN_VECTOR_UTF8_BYTES) {
    throw new Error('UTF-8 encoder self-check FAILED: got ' + encoded + ' expected ' + KNOWN_VECTOR_UTF8_BYTES);
  }
  const u = _toHex(_sha256(_utf8Bytes(KNOWN_VECTOR_UTF8)));
  if (u !== KNOWN_VECTOR_UTF8_SHA) {
    throw new Error('non-ASCII digest self-check FAILED: got ' + u + ' expected ' + KNOWN_VECTOR_UTF8_SHA);
  }
})();

function sha256Hex(text) {
  return _toHex(_sha256(_utf8Bytes(text)));
}

const FORMATS = ['csv', 'json', 'markdown_table'];

export function compute(pp) {
  const data = typeof pp?.data === 'string' ? pp.data : '';
  const source_format = FORMATS.includes(pp?.source_format) ? pp.source_format : 'csv';
  const target_format = FORMATS.includes(pp?.target_format) ? pp.target_format : 'json';
  const options = (pp && typeof pp.options === 'object' && pp.options) ? pp.options : {};
  const opts = {
    delimiter: (options.delimiter === ';' || options.delimiter === '\t') ? options.delimiter : ',',
    has_header: options.has_header !== false,
    coerce_types: options.coerce_types === true,
  };

  const warnings = [];
  let converted = '', columns = [], row_count = 0, error = null;
  try {
    const table = toTable(data, source_format, opts, warnings);
    columns = table.columns;
    row_count = table.rows.length;
    converted = fromTable(table, target_format, opts, warnings);
  } catch (e) {
    error = String(e.message || e);
  }

  const [input_sha256, output_sha256] = [
    sha256Hex(data), sha256Hex(converted),
  ];

  const compliance_flags = [];
  if (!error) compliance_flags.push('TABULAR_CONVERSION_PERFORMED');
  if (error) compliance_flags.push('CONVERSION_ERROR');
  if (warnings.length > 0) compliance_flags.push('WARNINGS_PRESENT');

  return {
    output_payload: {
      converted,
      source_format, target_format,
      row_count,
      column_count: columns.length,
      columns,
      warnings,
      error,
      input_sha256, output_sha256,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
