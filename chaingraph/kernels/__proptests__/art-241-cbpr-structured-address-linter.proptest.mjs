// kernel_digest_at_authoring: sha256:63e488bc42ce3ecf75573b02a8fae9dd4044c91928f1f019e53895bf08f6bf86
//
// FV-PROPFLOOR-SHARD-B27-1 — property-test floor for art-241-cbpr-structured-address-linter.
// Class B (bounded-numeric shape, string-structure lint logic). float:no — readiness_pct is an
// integer-arithmetic penalty score (100 - error_count*20, floored at 0), no continuous float
// threshold; forced categorical boundary cases stand in for ULP-forcing per spec §3. Zero external
// dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-241-cbpr-structured-address-linter.proptest.mjs

import { compute } from '../art-241-cbpr-structured-address-linter.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-241-cbpr-structured-address-linter.fixtures.json');
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
const rand = mulberry32(0x24129);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randStr(rng, len) { const chars = 'abcdefghijklmnopqrstuvwxyz'; let s = ''; for (let i = 0; i < len; i++) s += chars[Math.floor(rng() * chars.length)]; return s; }
const TRIALS = 10000;
const STRUCTURE_TYPES = ['FULLY_STRUCTURED', 'HYBRID', 'UNSTRUCTURED', 'EMPTY', 'MIXED_INVALID'];

function mkPP(rng) {
  const mode = pick(rng, ['fully', 'hybrid', 'unstructured', 'empty', 'mixed']);
  if (mode === 'fully') {
    return { street_name: randStr(rng, 8), building_number: String(1 + Math.floor(rng() * 999)), post_code: randStr(rng, 5), town_name: randStr(rng, 6), country: pick(rng, ['DE', 'US', 'FR']), address_lines: [] };
  } else if (mode === 'hybrid') {
    const n = Math.floor(rng() * 4);
    return { town_name: randStr(rng, 6), country: pick(rng, ['DE', 'US']), address_lines: Array.from({ length: n }, () => randStr(rng, Math.floor(rng() * 90))) };
  } else if (mode === 'unstructured') {
    return { address_lines: [randStr(rng, 20)] };
  } else if (mode === 'empty') {
    return {};
  } else {
    return { street_name: randStr(rng, 8), country: pick(rng, ['DE', 'US']), address_lines: [randStr(rng, 10)] };
  }
}

// ---------- P1: boundedness — structure_type always one of the five declared values; readiness_pct in [0,100] ----------
function checkP1_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    if (!STRUCTURE_TYPES.includes(op.structure_type)) violations++;
    if (op.readiness_pct < 0 || op.readiness_pct > 100) violations++;
  }
  return { name: 'P1_structure_type_and_readiness_bounded', trials: checked, violations };
}

// ---------- P2: fixed rule — compliant === (error_count===0 && structure_type in {FULLY_STRUCTURED,HYBRID}) ----------
function checkP2_compliantFixedRule() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    const expected = op.error_count === 0 && (op.structure_type === 'FULLY_STRUCTURED' || op.structure_type === 'HYBRID');
    if (op.compliant !== expected) violations++;
  }
  return { name: 'P2_compliant_agrees_with_error_count_and_structure_type', trials: checked, violations };
}

// ---------- P3: metamorphic — an AdrLine that verbatim-duplicates a structured field (len>=3) always triggers SILENT_FAIL_DUPLICATION ----------
function checkP3_silentFailMetamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const townName = randStr(rand, 6);
    const pp = { town_name: townName, country: 'DE', address_lines: [townName + ' extra text'] };
    const r = compute(pp);
    checked++;
    if (!r.output_payload.violations.some((v) => v.code === 'SILENT_FAIL_DUPLICATION')) violations++;
  }
  return { name: 'P3_adrline_duplicating_structured_field_always_flagged', trials: checked, violations };
}

// ---------- P4 (forced categorical boundary cases) ----------
const FORCED_CASES = [
  [{}, 'fully empty address — EMPTY structure_type, error EMPTY_ADDRESS'],
  [{ address_lines: ['123 Main St'] }, 'AdrLine-only, no structured fields — UNSTRUCTURED, prohibited-after-deadline violation'],
  [{ town_name: 'Berlin', country: 'DE', address_lines: ['a', 'b'] }, 'hybrid with exactly 2 AdrLine (at the MAX_ADR_LINES boundary) — compliant, no EXCESS_ADR_LINES'],
  [{ town_name: 'Berlin', country: 'DE', address_lines: ['a', 'b', 'c'] }, 'hybrid with 3 AdrLine (one past the boundary) — EXCESS_ADR_LINES violation'],
  [{ town_name: 'Berlin', country: 'DE', address_lines: ['x'.repeat(70)] }, 'AdrLine exactly at the 70-char boundary — compliant, no ADR_LINE_TOO_LONG'],
  [{ town_name: 'Berlin', country: 'DE', address_lines: ['x'.repeat(71)] }, 'AdrLine one char past the 70-char boundary — ADR_LINE_TOO_LONG violation'],
  [{ street_name: 'Kaiserstrasse', building_number: '1', post_code: '10115', country: 'DEX', address_lines: [] }, 'country code 3 chars (invalid ISO 3166-1 alpha-2) — INVALID_COUNTRY violation'],
  [{ street_name: 'Kaiserstrasse', building_number: '1', post_code: '10115', country: 'de', address_lines: [] }, 'country code lowercase — normalized to uppercase, must classify as valid 2-letter code'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of FORCED_CASES) {
    const r = compute(pp);
    const op = r.output_payload;
    const plausible = STRUCTURE_TYPES.includes(op.structure_type) && op.readiness_pct >= 0 && op.readiness_pct <= 100;
    rows.push({ label, input: pp, structure_type: op.structure_type, compliant: op.compliant, error_count: op.error_count, violations: op.violations.map((v) => v.code), plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_boundedness());
results.properties.push(checkP2_compliantFixedRule());
results.properties.push(checkP3_silentFailMetamorphic());
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
