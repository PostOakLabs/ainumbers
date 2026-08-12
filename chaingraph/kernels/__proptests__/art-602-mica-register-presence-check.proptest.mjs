// art-602-mica-register-presence-check.proptest.mjs — FV property-test FLOOR (FVFLOOR-BACKFILL-0811-1).
// kernel_digest_at_authoring: sha256:7457760d26cd21fb26da3a02695102c4a9345d971ef5eb464a38361db636d3c8
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md section 3, class C -- RFC-4180-shaped CSV
// parsing + integer civil-calendar date arithmetic, unbounded input in principle but hard-capped by
// the kernel's own MAX_EXTRACT_CHARS/MAX_ROWS/MAX_CELLS_PER_ROW refusal). NOT a proof, NOT Dafny.
// float_sensitive: NO -- no division, no fractional comparison; date validation is pure integer
// civil-calendar arithmetic (Howard Hinnant's days-from-civil algorithm), and the digest is SHA-256.
//
// Checks: fixture-oracle gate (P0), totality/never-throws over hostile inputs (P1), a differential
// re-derivation of the inlined SHA-256 against Node's WebCrypto (P2, same differential shape as
// art-599's floor), a bounded enumeration over the civil-calendar round-trip's date-validity boundary
// (P3, A-class-shaped: every day 28/29/30/31 across every month, including the Feb-29 leap-year edge)
// since isValidIsoDay() is exactly the kind of small enumerable domain the floor spec calls out, a
// termination/bound property proving the MAX_ROWS/MAX_EXTRACT_CHARS refusal actually fires rather
// than parsing without limit (P4, the class-C boundedness requirement), a metamorphic determinism +
// tamper-changes-digest property (P5), and forced categorical boundary cases (P6: quoted CSV fields
// containing the delimiter, match_column resolution by name vs index, the tristate match_found
// null/true/false distinction).

import { compute } from '../art-602-mica-register-presence-check.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

// ---------- P0: fixture oracle ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-602-mica-register-presence-check.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    const a = JSON.stringify(output_payload);
    const b = JSON.stringify(vec.output_payload);
    if (a !== b) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
  }
  results.fixture_oracle = { total: fixtures.vectors.length, failures };
  return failures.length === 0;
}

// ---------- P1: totality ----------
function checkP1_totality() {
  let violations = 0, checked = 0;
  const hostileInputs = [
    null, undefined, {}, [], 'a string', 42, true,
    { register_extract: 123 }, { register_type: 'bogus' }, { retrieval_date: '2026-02-30' },
    { retrieval_date: 'not-a-date' }, { entity_identifier: null },
    { register_extract: 'a,b\n1,2', match_column: 'nonexistent-header' },
    { register_extract: '"unterminated quote', delimiter: ',' },
    { register_extract: 'x'.repeat(300000) },
  ];
  for (const pp of hostileInputs) {
    checked++;
    let out;
    try { out = compute(pp); } catch (e) { violations++; continue; }
    const o = out.output_payload;
    if (typeof o.snapshot !== 'object' || o.snapshot === null) violations++;
    if (typeof o.search !== 'object' || o.search === null) violations++;
    if (!Array.isArray(o.rationale)) violations++;
    if (!Array.isArray(o.not_proven) || o.not_proven.length === 0) violations++;
    if (!Array.isArray(out.compliance_flags)) violations++;
  }
  return { name: 'P1_totality_never_throws_well_formed_shape', trials: checked, violations };
}

// ---------- P2: differential — inlined SHA-256 vs Node WebCrypto ----------
async function checkP2_differential_sha256() {
  let violations = 0, checked = 0;
  const samples = ['', 'a', 'lei,name\n123,Example Corp\n', 'x'.repeat(500), 'héllo 中文 🌍'];
  for (const text of samples) {
    checked++;
    const { output_payload: o } = compute({ register_extract: text, register_type: 'white_paper', entity_identifier: 'X', retrieval_date: '2026-01-01' });
    if (text.length === 0) {
      if (o.register_snapshot_digest !== null) violations++;
      continue;
    }
    const expected = 'sha256:' + Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))).map((b) => b.toString(16).padStart(2, '0')).join('');
    if (o.register_snapshot_digest !== expected) violations++;
  }
  return { name: 'P2_differential_inlined_sha256_vs_node_webcrypto', trials: checked, violations };
}

// ---------- P3: A-class-shaped bounded enumeration — every calendar day across every month 1..12,
// years spanning a leap and non-leap year, confirming isValidIsoDay's round-trip rejects exactly the
// calendar-invalid combinations (Feb 30, Apr 31, etc.) and accepts exactly the valid ones ----------
function checkP3_enumeration_calendar_boundary() {
  let violations = 0, checked = 0;
  const daysInMonthGregorian = (y, m) => {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  };
  for (const year of [2024, 2026]) { // 2024 leap, 2026 non-leap
    for (let month = 1; month <= 12; month++) {
      for (let day = 1; day <= 31; day++) {
        checked++;
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const expectedValid = day <= daysInMonthGregorian(year, month);
        const { output_payload: o } = compute({ retrieval_date: iso, register_type: 'casp', entity_identifier: 'X', register_extract: 'a\n1' });
        const actualValid = o.retrieval_date === iso; // retrieval_date is echoed only when valid, else null
        if (actualValid !== expectedValid) violations++;
      }
    }
  }
  return { name: 'P3_enumeration_calendar_day_validity_boundary_leap_and_nonleap', trials: checked, violations };
}

// ---------- P4: bounded-input refusal actually fires (class-C boundedness) ----------
function checkP4_bounded_input_refusal() {
  let violations = 0, checked = 0;
  // over MAX_ROWS (5000) -> row cap exceeded, refused not parsed-in-part
  { checked++;
    const rows = Array.from({ length: 5001 }, (_, i) => `row${i},val${i}`).join('\n');
    const { output_payload: o } = compute({ register_extract: rows, register_type: 'white_paper', entity_identifier: 'X', retrieval_date: '2026-01-01' });
    if (o.snapshot.row_cap_exceeded !== true) violations++;
    if (o.match_found !== null) violations++; }
  // over MAX_EXTRACT_CHARS (262144) -> refused, digest still computed over the refused bytes
  { checked++;
    const big = 'x'.repeat(262145);
    const { output_payload: o } = compute({ register_extract: big, register_type: 'white_paper', entity_identifier: 'X', retrieval_date: '2026-01-01' });
    if (o.snapshot.extract_too_large !== true) violations++;
    if (o.register_snapshot_digest === null) violations++; // digest pins what was rejected
    if (o.match_found !== null) violations++; }
  // AT the boundary (exactly MAX_ROWS) -> must NOT be refused
  { checked++;
    const rows = Array.from({ length: 5000 }, (_, i) => `row${i},val${i}`).join('\n');
    const { output_payload: o } = compute({ register_extract: rows, register_type: 'white_paper', entity_identifier: 'X', retrieval_date: '2026-01-01', header_row: false });
    if (o.snapshot.row_cap_exceeded !== false) violations++; }
  return { name: 'P4_bounded_input_refusal_fires_at_and_over_the_declared_caps', trials: checked, violations };
}

// ---------- P5: metamorphic — determinism, and tampering the extract changes the digest ----------
function checkP5_metamorphic() {
  let violations = 0, checked = 0;
  function mulberry32(seed) { return function () { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const rand = mulberry32(0x6021EA1);
  for (let i = 0; i < 40; i++) {
    checked++;
    const extract = `lei,name\n${1000 + i},Entity${i}\n`;
    const pp = { register_extract: extract, register_type: 'casp', entity_identifier: String(1000 + i), retrieval_date: '2026-01-01' };
    const a = compute(pp).output_payload;
    const b = compute(pp).output_payload;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
    if (a.match_found !== true) violations++;

    const tampered = compute({ ...pp, register_extract: extract + 'extra,row\n' }).output_payload;
    if (tampered.register_snapshot_digest === a.register_snapshot_digest) violations++;
  }
  return { name: 'P5_metamorphic_determinism_and_tamper_changes_digest', trials: checked, violations };
}

// ---------- P6: forced categorical boundary cases ----------
function checkP6_forced_categorical() {
  let violations = 0, checked = 0;
  // quoted CSV field containing the delimiter -> parsed as one cell, not split
  { checked++;
    const extract = 'lei,name\n123,"Example, Corp"\n';
    const { output_payload: o } = compute({ register_extract: extract, register_type: 'white_paper', entity_identifier: 'Example, Corp', retrieval_date: '2026-01-01' });
    if (o.match_found !== true) violations++; }
  // match_column resolved by header name
  { checked++;
    const extract = 'lei,name\n123,Widget Co\n';
    const { output_payload: o } = compute({ register_extract: extract, register_type: 'white_paper', entity_identifier: '123', retrieval_date: '2026-01-01', match_column: 'lei' });
    if (o.match_found !== true) violations++;
    if (o.search.match_column_resolved !== 'header "lei" at index 0') violations++; }
  // match_column that doesn't resolve -> search never runs, match_found stays null (tristate)
  { checked++;
    const extract = 'lei,name\n123,Widget Co\n';
    const { output_payload: o } = compute({ register_extract: extract, register_type: 'white_paper', entity_identifier: '123', retrieval_date: '2026-01-01', match_column: 'no-such-column' });
    if (o.match_found !== null) violations++;
    if (o.search.searched !== false) violations++; }
  // no entity_identifier at all -> match_found null, never false
  { checked++;
    const extract = 'lei,name\n123,Widget Co\n';
    const { output_payload: o } = compute({ register_extract: extract, register_type: 'white_paper', retrieval_date: '2026-01-01' });
    if (o.match_found !== null) violations++; }
  // no match in a valid search -> false, not null
  { checked++;
    const extract = 'lei,name\n123,Widget Co\n';
    const { output_payload: o } = compute({ register_extract: extract, register_type: 'white_paper', entity_identifier: 'NOPE', retrieval_date: '2026-01-01' });
    if (o.match_found !== false) violations++; }
  return { name: 'P6_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_totality());
results.properties.push(await checkP2_differential_sha256());
results.properties.push(checkP3_enumeration_calendar_boundary());
results.properties.push(checkP4_bounded_input_refusal());
results.properties.push(checkP5_metamorphic());
results.properties.push(checkP6_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-602-mica-register-presence-check',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
