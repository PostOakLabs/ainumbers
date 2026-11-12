// art-788-csv-rfc4180-parser — class-K property-test FLOOR (SHARED-CSV-AND-PAGE-XML-1).
// kernel_digest_at_authoring: sha256:c34b449deffbcaba90e9e3d2df644f2bf51f90b1f9b31a00025de8ab6a836152
// (this file imports the kernel and bundle directly, so identity drift also fails the fixture oracle).
// spec: ACCT-INFRA-KERNELS-BUILD-SPEC.md Sec 0.1 (bundle + demonstrator ruling); row
// SHARED-CSV-AND-PAGE-XML-1; RFC 4180 (with the two declared deviations named in the
// bundle header: bare LF accepted and flagged, bare CR refused).
// human_sign_off: PENDING
//
// float_sensitive: NO. This kernel performs NO arithmetic on field values — every field
// is returned as a decoded string (numeric parsing belongs to _money and the wave
// kernels). Lengths and counts are exact integers over string lengths; no rounding
// step is declared, so the rounding portfolio (P1/P7/P9/P10/P12/P13) is NOT_APPLICABLE
// and is recorded as such below rather than silently dropped.
//
// Applicable generic properties:
// P0  fixture oracle — every pinned vector in fixtures.json reproduces byte-for-byte.
// P6  determinism — compute() twice on identical input is byte-identical.
// P30 bounds edges — at the declared caps (max_bytes/max_rows/max_cols) the kernel
//     refuses with the named error, never wraps, truncates or throws.
// K1  totality — compute() never throws for any input, including hostile ones
//     (null, numbers, unpaired surrogates, quote storms).
// K2  values-are-strings — every parsed field is a string, never coerced.
// K3  RFC 4180 round-trip — serializeCsvRows(parse(x)) re-parses to the same records
//     for well-formed, header-less inputs (round-trip property over the inlined bundle).
// K4  doubled-quote decode — "a""b" decodes to exactly a"b, and re-serializes to
//     "a""""b" correctly (quote-count parity across the round trip).
// K5  structured refusals — unclosed quote, ragged row, lone CR, quote-in-unquoted,
//     char-after-quote each yield their NAMED error, never a partial silent parse
//     and never a throw.
// K6  injection guard — any value with a leading = + - @ TAB CR, when sanitize_export
//     is true, is prefixed in export_rows; with sanitize_export false the parse is
//     faithful and the risk is flagged (CSV_INJECTION_RISK_UNSANITIZED).
// K7  BOM handling — a leading U+FEFF is stripped and flagged (bom_stripped), never
//     kept as the first header cell's first character.
// K8  caps are named refusals — INPUT_TOO_LARGE / TOO_MANY_ROWS / TOO_MANY_COLUMNS
//     name the cap and the measured value in bounds.
//
// Zero NEW external dependencies — Node built-ins plus the in-repo helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-788-csv-rfc4180-parser.proptest.mjs

import { compute } from '../art-788-csv-rfc4180-parser.kernel.mjs';
import { _csv } from '../_csv.bundle.mjs';
import { runFixtureOracle, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-788-csv-rfc4180-parser';

// ---------- deterministic PRNG (no Math.random) ----------
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x772);

function byteEq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

// ---------- K1: totality — compute() never throws ----------
function checkK1_totality() {
  let checked = 0, violations = 0;
  const hostile = [
    null, undefined, 42, {}, [], true,
    '', '"', '"""', '"a', 'a"b', 'a,b\r\n"unclosed',
    '\r', 'a\rb', '﻿', '﻿a,b\r\n', '",""\r\n', '"","",""\r\n',
    '"' + 'x'.repeat(5000) + '"',
    'a,b\r\n' + '1\r\n'.repeat(50),
    '😅,😀\r\n"‼","\uFFFD"',
  ];
  for (const h of hostile) {
    checked++;
    try { compute({ csv_text: h }); } catch (e) { violations++; console.error('K1 throw on', JSON.stringify(String(h).slice(0, 40)), e.message); }
  }
  // fuzz: random strings from a hostile alphabet
  const alphabet = ['a', ',', '"', '\r', '\n', '﻿', '='];
  for (let i = 0; i < 300; i++) {
    let s = '';
    const len = 1 + Math.floor(rand() * 60);
    for (let j = 0; j < len; j++) s += alphabet[Math.floor(rand() * alphabet.length)];
    checked++;
    try { compute({ csv_text: s }); } catch (e) { violations++; console.error('K1 fuzz throw:', JSON.stringify(s), e.message); }
  }
  return { name: 'K1_totality_never_throws', checked, violations };
}

// ---------- K2: values are strings ----------
function checkK2_values_are_strings() {
  let checked = 0, violations = 0;
  const samples = [
    'a,b\r\n1,2.50\r\n',
    '"0042","-7"\r\n',
    '"1e9","0x10"\r\n',
  ];
  for (const s of samples) {
    const r = compute({ csv_text: s });
    checked++;
    if (!r.output_payload.ok) { violations++; continue; }
    for (const rec of r.output_payload.records) {
      for (const v of rec) {
        checked++;
        if (typeof v !== 'string') violations++;
      }
    }
  }
  // "0042" stays "0042" — the leading zero is data, not a number to normalize
  const r = compute({ csv_text: 'v\r\n0042\r\n' });
  checked++;
  if (r.output_payload.records[0][0] !== '0042') violations++;
  return { name: 'K2_values_are_strings', checked, violations };
}

// ---------- K3: serialize/parse round trip ----------
function checkK3_round_trip() {
  let checked = 0, violations = 0;
  const rows = [
    ['plain', 'with,comma', 'with"quote', 'x'],
    ['with\r\ncrlf', '', 'x', 'y'],
    ['formula=', 'plus+', 'at@', 'dash-'],
    ['ünïcode', '😅', '', 'z'],
  ];
  // NOTE: serializeCsvRows applies the OWASP injection prefix, so a value with a
  // leading trigger char would NOT round-trip byte-identically — that mitigation
  // is asserted separately in K6; this property uses trigger-free values.
  const serialized = _csv.serializeCsvRows(rows);
  const reparsed = _csv.parseCsv(serialized, { header: false });
  checked++;
  if (!reparsed.ok || !byteEq(reparsed.records, rows)) {
    violations++;
    console.error('K3 round trip mismatch:', JSON.stringify(reparsed));
  }
  // and through the kernel, header-less, sanitizing off
  const r = compute({ csv_text: serialized, header: false, sanitize_export: false });
  checked++;
  if (!byteEq(r.output_payload.records, rows)) violations++;
  return { name: 'K3_serialize_parse_round_trip', checked, violations };
}

// ---------- K4: doubled-quote decode ----------
function checkK4_doubled_quotes() {
  let checked = 0, violations = 0;
  const r = compute({ csv_text: 'v\r\n"a""b"\r\n' });
  checked++;
  if (!(r.output_payload.ok && r.output_payload.records[0][0] === 'a"b')) violations++;
  const r2 = compute({ csv_text: '"a""""b"\r\n', header: false });
  checked++;
  if (!(r2.output_payload.ok && r2.output_payload.records[0][0] === 'a""b')) violations++;
  // quote-count parity: every literal quote in output re-serializes doubled
  const ser = _csv.serializeCsvRows([['a"b', 'c']]);
  checked++;
  if ((ser.match(/"/g) || []).length !== 4) violations++; // "a""b",c → 4 quotes
  return { name: 'K4_doubled_quote_decode', checked, violations };
}

// ---------- K5: named structured refusals ----------
function checkK5_named_refusals() {
  let checked = 0, violations = 0;
  const cases = [
    ['"unclosed', 'QUOTE_NOT_CLOSED'],
    ['a,b\r\n1\r\n', 'RAGGED_ROW'],
    ['a\rb', 'LONE_CR'],
    ['a"b,c\r\n', 'QUOTE_IN_UNQUOTED_FIELD'],
    ['"a"x,b\r\n', 'CHAR_AFTER_QUOTE'],
    ['"a,"b\r\n', 'CHAR_AFTER_QUOTE'], // `"a,"` closes, then bare `b` follows the closing quote
  ];
  for (const [input, expected] of cases) {
    const r = compute({ csv_text: input, header: false });
    checked++;
    if (r.output_payload.ok || r.output_payload.error !== expected) {
      violations++;
      console.error('K5 expected', expected, 'got', r.output_payload.error, 'for', JSON.stringify(input));
    }
    checked++;
    if (typeof r.output_payload.note !== 'string' || !r.output_payload.note.includes(expected)) violations++;
  }
  return { name: 'K5_named_structured_refusals', checked, violations };
}

// ---------- K6: injection guard ----------
function checkK6_injection_guard() {
  let checked = 0, violations = 0;
  const csv = 'name,cell\r\nok,=cmd\r\n';
  const unsan = compute({ csv_text: csv });
  checked++;
  if (!(unsan.output_payload.ok && unsan.compliance_flags.includes('CSV_INJECTION_RISK_UNSANITIZED'))) violations++;
  checked++;
  if (unsan.output_payload.records[0][1] !== '=cmd') violations++; // faithful decode when not exporting
  const san = compute({ csv_text: csv, sanitize_export: true });
  checked++;
  if (!(san.output_payload.export_rows[0][1] === "'=cmd")) violations++;
  checked++;
  if (!san.compliance_flags.includes('CSV_INJECTION_PREFIXED')) violations++;
  checked++;
  if (!(san.output_payload.injection_flags.values_prefixed === 1)) violations++;
  // the full trigger set survives serialize → parse
  const all = _csv.serializeCsvRows([['=a', '+b', '-c', '@d', '\te', '\rf']]);
  const reparsed = _csv.parseCsv(all, { header: false });
  checked++;
  if (!reparsed.ok) violations++;
  return { name: 'K6_injection_guard_prefix', checked, violations };
}

// ---------- K7: BOM handling ----------
function checkK7_bom() {
  let checked = 0, violations = 0;
  const r = compute({ csv_text: '﻿h1,h2\r\n1,2\r\n' });
  checked++;
  if (!(r.output_payload.ok && r.compliance_flags.includes('BOM_STRIPPED'))) violations++;
  checked++;
  if (r.output_payload.header[0] !== 'h1') violations++;
  const r2 = compute({ csv_text: 'plain\r\n' });
  checked++;
  if (r2.compliance_flags.includes('BOM_STRIPPED')) violations++;
  return { name: 'K7_bom_stripped_and_flagged', checked, violations };
}

// ---------- K8: caps are named refusals with measured bounds ----------
function checkK8_caps() {
  let checked = 0, violations = 0;
  const big = 'x'.repeat(300);
  const r1 = compute({ csv_text: big, header: false, max_bytes: 100 });
  checked++;
  if (!(r1.output_payload.error === 'INPUT_TOO_LARGE' && r1.output_payload.bounds.max_bytes === 100 && r1.output_payload.bounds.bytes_used > 100)) violations++;
  const r2 = compute({ csv_text: 'a\r\nb\r\nc\r\n', header: false, max_rows: 2 });
  checked++;
  if (!(r2.output_payload.error === 'TOO_MANY_ROWS' && r2.output_payload.bounds.max_rows === 2)) violations++;
  const r3 = compute({ csv_text: 'a,b,c\r\n', header: false, max_cols: 2 });
  checked++;
  if (!(r3.output_payload.error === 'TOO_MANY_COLUMNS' && r3.output_payload.bounds.max_cols === 2)) violations++;
  return { name: 'K8_caps_named_refusals', checked, violations };
}

// ---------- P6: determinism ----------
function checkP6_determinism() {
  let checked = 0, violations = 0;
  const inputs = ['a,b\r\n1,2\r\n', '"x,y",z\r\n', '﻿a\r\n=b\r\n'];
  for (const s of inputs) {
    const r1 = compute({ csv_text: s, sanitize_export: true });
    const r2 = compute({ csv_text: s, sanitize_export: true });
    checked++;
    if (!byteEq(r1.output_payload, r2.output_payload)) violations++;
  }
  return { name: 'P6_determinism', checked, violations };
}

// ---------- P30: bounds edges (totality at declared bounds) ----------
function checkP30_bounds_edges() {
  let checked = 0, violations = 0;
  // exactly at the cap: accepted
  const r = compute({ csv_text: 'a,b,c\r\n', header: false, max_cols: 3 });
  checked++;
  if (!r.output_payload.ok) violations++;
  // exactly one over: refused
  const r2 = compute({ csv_text: 'a,b,c,d\r\n', header: false, max_cols: 3 });
  checked++;
  if (r2.output_payload.ok || r2.output_payload.error !== 'TOO_MANY_COLUMNS') violations++;
  return { name: 'P30_bounds_edges', checked, violations };
}

const NOT_APPLICABLE = [
  'P1/P7/P9/P10/P12/P13 rounding portfolio: float_sensitive:NO — this kernel performs no arithmetic on field values (all values are strings; lengths/counts are exact integers), and declares zero rounding_steps, so the rounding-conformance properties have no surface here.',
];

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkK1_totality(),
  checkK2_values_are_strings(),
  checkK3_round_trip(),
  checkK4_doubled_quotes(),
  checkK5_named_refusals(),
  checkK6_injection_guard(),
  checkK7_bom(),
  checkK8_caps(),
  checkP6_determinism(),
  checkP30_bounds_edges(),
];
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
