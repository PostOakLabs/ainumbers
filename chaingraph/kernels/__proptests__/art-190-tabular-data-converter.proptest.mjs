// art-190-tabular-data-converter.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C5-1).
// kernel_digest_at_authoring: sha256:ebda2b1d4bde79561f6c8555da36e765a44fa6a0b32cf475c953c59d3f38bb67
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (WU row classification confirmed by direct read — `coerce()` only converts a
// strictly-matching decimal string to a Number for pass-through output; there is no comparison,
// threshold, or arithmetic performed on the resulting float anywhere in the kernel).
// Checks: fixture-oracle gate, termination (CSV-parse loop bounded by input.length, row-processing
// loop bounded by grid.length), boundedness (row_count/column_count are non-negative integers),
// a CSV -> JSON -> CSV round-trip metamorphic identity (data survives a full conversion cycle
// unchanged, given no header collisions and no coercion), and forced categorical boundary cases for
// empty input, ragged rows, and duplicate headers.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
// NOTE: compute() is async (uses crypto.subtle for digests) — every call site here awaits it.
//
// Run: node chaingraph/kernels/__proptests__/art-190-tabular-data-converter.proptest.mjs

import { compute } from '../art-190-tabular-data-converter.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

async function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-190-tabular-data-converter.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = await compute(vec.policy_parameters);
    const a = JSON.stringify(output_payload);
    const b = JSON.stringify(vec.output_payload);
    if (a !== b) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
  }
  results.fixture_oracle = { total: fixtures.vectors.length, failures };
  return failures.length === 0;
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x190A0);

const WORDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo'];
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomCsv(rng, nCols, nRows) {
  const headers = Array.from({ length: nCols }, (_, i) => 'col_' + i);
  const rows = [];
  for (let r = 0; r < nRows; r++) {
    rows.push(headers.map(() => pick(rng, WORDS) + rng().toString().slice(2, 5)));
  }
  const lines = [headers.join(','), ...rows.map((r) => r.join(','))];
  return { csv: lines.join('\n'), headers, rows };
}

const TRIALS = 2000;

// ---------- P1: termination — row_count/column_count bounded, non-negative integers ----------
async function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const nCols = 1 + Math.floor(rand() * 4);
    const nRows = Math.floor(rand() * 10);
    const { csv } = randomCsv(rand, nCols, nRows);
    const { output_payload } = await compute({ data: csv, source_format: 'csv', target_format: 'json' });
    checked++;
    if (!Number.isInteger(output_payload.row_count) || output_payload.row_count < 0) violations++;
    if (!Number.isInteger(output_payload.column_count) || output_payload.column_count < 0) violations++;
    if (output_payload.row_count !== nRows) violations++;
    if (output_payload.column_count !== nCols) violations++;
  }
  return { name: 'P1_termination_and_boundedness', trials: checked, violations };
}

// ---------- P2 (metamorphic): CSV -> JSON -> CSV round-trip preserves data (no coercion, no dup headers) ----------
// nRows >= 1 is required: JSON's array-of-objects representation carries no column-header record
// independent of a row, so a zero-row table's column names are legitimately NOT recoverable after a
// CSV->JSON->CSV round trip (JSON output is `[]`) -- this is a real, documented representation
// limit, not a round-trip bug, and is exercised explicitly as a forced boundary case in P4 below
// instead of being asserted as a round-trip invariant here.
async function checkP2_roundtrip() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const nCols = 1 + Math.floor(rand() * 4);
    const nRows = 1 + Math.floor(rand() * 8);
    const { csv } = randomCsv(rand, nCols, nRows);
    const toJson = await compute({ data: csv, source_format: 'csv', target_format: 'json' });
    const backToCsv = await compute({ data: toJson.output_payload.converted, source_format: 'json', target_format: 'csv' });
    checked++;
    if (backToCsv.output_payload.error) violations++;
    // Compare normalized data (line-ending independent).
    if (backToCsv.output_payload.converted.trim() !== csv.trim()) violations++;
  }
  return { name: 'P2_metamorphic_csv_json_csv_roundtrip', trials: checked, violations };
}

// ---------- P3 (differential): warnings present iff ragged rows or duplicate headers exist ----------
async function checkP3_warnings_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const nCols = 2 + Math.floor(rand() * 3);
    const nRows = 1 + Math.floor(rand() * 5);
    const { headers, rows } = randomCsv(rand, nCols, nRows);
    // Randomly truncate one row to force raggedness.
    const raggedIdx = rand() < 0.5 ? Math.floor(rand() * rows.length) : -1;
    const bodyLines = rows.map((r, idx) => (idx === raggedIdx ? r.slice(0, -1) : r).join(','));
    const csv = [headers.join(','), ...bodyLines].join('\n');
    const { output_payload } = await compute({ data: csv, source_format: 'csv', target_format: 'json' });
    checked++;
    const hasRagged = raggedIdx >= 0;
    if (hasRagged && output_payload.warnings.length === 0) violations++;
    if (!hasRagged && output_payload.warnings.length > 0) violations++;
  }
  return { name: 'P3_ragged_row_warnings_differential', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases ----------
async function checkP4_forced() {
  const cases = [
    { label: 'empty CSV input -> zero rows, zero columns', pp: { data: '', source_format: 'csv', target_format: 'json' } },
    { label: 'header-only CSV (no body rows) -> zero rows, columns from header', pp: { data: 'a,b,c', source_format: 'csv', target_format: 'json' } },
    { label: 'duplicate header names -> renamed with suffix, warning emitted', pp: { data: 'a,a,b\n1,2,3', source_format: 'csv', target_format: 'json' } },
    { label: 'invalid JSON source -> error surfaced, not thrown', pp: { data: 'not json', source_format: 'json', target_format: 'csv' } },
    { label: 'header-only CSV round-tripped through JSON loses column names (documented representation limit, not a bug)', pp: { data: 'col_0', source_format: 'csv', target_format: 'json' } },
  ];
  const rows = [];
  for (const c of cases) {
    const { output_payload } = await compute(c.pp);
    rows.push({ label: c.label, row_count: output_payload.row_count, column_count: output_payload.column_count, warnings: output_payload.warnings, error: output_payload.error, converted: output_payload.converted });
  }
  return rows;
}

// ---------- run ----------
const oracleOk = await runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(await checkP1_termination());
results.properties.push(await checkP2_roundtrip());
results.properties.push(await checkP3_warnings_differential());
results.boundary_forced = await checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const emptyInputZero = results.boundary_forced[0].row_count === 0 && results.boundary_forced[0].column_count === 0;
const headerOnlyZeroRows = results.boundary_forced[1].row_count === 0 && results.boundary_forced[1].column_count === 3;
const dupHeaderWarned = results.boundary_forced[2].warnings.length > 0;
const invalidJsonError = results.boundary_forced[3].error !== null;
const headerOnlyRepresentationLimit = results.boundary_forced[4].converted === '[]';
const anyBoundaryMismatch = !(emptyInputZero && headerOnlyZeroRows && dupHeaderWarned && invalidJsonError && headerOnlyRepresentationLimit);

console.log(JSON.stringify({
  tool_id: 'art-190-tabular-data-converter',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);
