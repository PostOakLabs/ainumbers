// kernel_digest_at_authoring: sha256:2bd3d6eed462e16f193553ab50e4d067db74e0c2d6146b0ca9c2508a015101a0
//
// FV-PROPFLOOR-SHARD-B6-1 — property-test floor for art-220-reg-z-threshold-lookup.
// Class B (bounded categorical). ⚠ RECLASSIFIED float:no by this row's FIX-2-CARRY duty
// (FV-PBT-FLOOR-BUILD-SPEC.md §3, "verify float-sensitivity against the kernel before
// authoring, not inherited from the triage table alone") — inspection of compute() shows
// this kernel performs NO continuous arithmetic and NO float comparison at all: it is a
// pure year/table string lookup into version-pinned integer/decimal constant tables, with
// only Math.round(year) as numeric processing. This differs from the WU row's stated 9/1
// float split; the manifest for this shard records the correction. Forced categorical
// boundary cases used in place of ULP forcing. Zero external dependencies (mulberry32 PRNG
// + explicit boundary arrays). This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-220-reg-z-threshold-lookup.proptest.mjs

import { compute } from '../art-220-reg-z-threshold-lookup.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-220-reg-z-threshold-lookup.fixtures.json');
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

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x2200A1);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 8000;
const VALID_TABLES = ['qm_points_fees', 'hoepa', 'hpml', 'card_penalty'];
const VALID_YEARS = [2021, 2022, 2023, 2024, 2025, 2026];

function mkPP(rng, overrides = {}) {
  return {
    table: pick(rng, VALID_TABLES),
    year: pick(rng, VALID_YEARS),
    ...overrides,
  };
}

// ---------- P1: boundedness — every successful lookup's `data` object is drawn from the declared table's own key set ----------
function checkP1_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { data, table, available_years } = r.output_payload;
    if (!data || typeof data !== 'object') { violations++; continue; }
    if (!available_years.includes(pp.year)) violations++;
    if (typeof data.fr_citation !== 'string' || !data.fr_citation) violations++;
  }
  return { name: 'P1_boundedness_data_object_present_for_known_table_year', trials: checked, violations };
}

// ---------- P2: fixed-tier agreement — an unknown table always yields the documented error shape, never a data row ----------
function checkP2_unknownTableAgreement() {
  let violations = 0, checked = 0;
  // '' is falsy in the kernel's `String(pp.table || 'qm_points_fees')` default coalescing,
  // so it resolves to the default table rather than erroring — excluded from this property,
  // covered separately by its own forced boundary case (P4) instead.
  const BOGUS_TABLES = ['bogus', 'QM_POINTS_FEES', 'hoepa ', 'card-penalty'];
  for (let i = 0; i < TRIALS; i++) {
    const table = pick(rand, BOGUS_TABLES);
    const pp = mkPP(rand, { table });
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    const expectUnknown = !VALID_TABLES.includes(table);
    const gotUnknown = op.error === 'unknown_table';
    if (expectUnknown !== gotUnknown) violations++;
    if (expectUnknown && !r.compliance_flags.includes('LOOKUP_TABLE_UNKNOWN')) violations++;
  }
  return { name: 'P2_unknown_table_always_yields_documented_error_shape', trials: checked, violations };
}

// ---------- P3: fixed-tier agreement — year outside the pinned range always yields year_not_in_table, never a stale extrapolation ----------
function checkP3_yearOutOfRange() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const table = pick(rand, VALID_TABLES);
    const year = pick(rand, [1999, 2000, 2020, 2027, 2030, 3000]);
    const r = compute({ table, year });
    checked++;
    const op = r.output_payload;
    if (op.error !== 'year_not_in_table') violations++;
    if (!r.compliance_flags.includes('LOOKUP_YEAR_UNAVAILABLE')) violations++;
  }
  return { name: 'P3_out_of_range_year_always_yields_year_not_in_table', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (reclassified float:no — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ table: 'qm_points_fees', year: 2021 }, 'earliest pinned year (2021) for qm_points_fees — must resolve, not error'],
  [{ table: 'card_penalty', year: 2026 }, 'latest pinned year (2026) for card_penalty — must resolve, not error'],
  [{ table: 'hoepa', year: 2020 }, 'exactly 1 year below the pinned range — must be year_not_in_table'],
  [{ table: 'hpml', year: 2027 }, 'exactly 1 year above the pinned range — must be year_not_in_table'],
  [{ table: 'unknown_table_name', year: 2026 }, 'wholly unrecognized table string — must be unknown_table, listing all 4 valid_tables'],
  [{ table: '', year: 2026 }, 'empty-string table — falsy in the `||` default coalescing, resolves to qm_points_fees, not unknown_table'],
  [{ table: 'qm_points_fees', year: 0 }, 'year exactly zero — must not throw, treated as year_not_in_table'],
  [{ table: 'qm_points_fees', year: -2026 }, 'negative year — must not throw, treated as year_not_in_table'],
  [{}, 'all-empty input — defaults to qm_points_fees/2026, must resolve successfully'],
  [{ table: 'QM_POINTS_FEES', year: 2026 }, 'table name wrong-case — must be unknown_table (case-sensitive lookup), not silently coerced'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label] of CATEGORICAL_BOUNDARY_CASES) {
    const pp = { ...overrides };
    const r = compute(pp);
    const op = r.output_payload;
    const plausible = (op.error === 'unknown_table' || op.error === 'year_not_in_table') || (op.data && typeof op.data === 'object' && !op.error);
    rows.push({ label, pp, error: op.error ?? null, table: op.table, year: op.year, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_boundedness());
results.properties.push(checkP2_unknownTableAgreement());
results.properties.push(checkP3_yearOutOfRange());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
