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

async function sha256Hex(str) {
  const bytes = new TextEncoder().encode(String(str));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const FORMATS = ['csv', 'json', 'markdown_table'];

export async function compute(pp) {
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

  const [input_sha256, output_sha256] = await Promise.all([
    sha256Hex(data), sha256Hex(converted),
  ]);

  const compliance_flags = { TABULAR_CONVERSION_PERFORMED: !error };
  if (error) compliance_flags.CONVERSION_ERROR = true;
  if (warnings.length > 0) compliance_flags.WARNINGS_PRESENT = true;

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
  const { output_payload, compliance_flags } = await compute(pp);
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
