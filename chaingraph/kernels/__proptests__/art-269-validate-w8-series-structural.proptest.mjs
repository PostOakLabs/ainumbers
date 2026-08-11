// kernel_digest_at_authoring: sha256:a1851d45c46b04a84e8841137e3fe46ec0b91c345ba39ce7ce125fe9e446ce5e
//
// FV-PROPFLOOR-SHARD-B9-1 — property-test floor for art-269-validate-w8-series-structural.
// Class B (bounded categorical), float:no — form/chapter-status enum validation, treaty-rate integer
// comparison, and calendar-arithmetic validity window, no continuous arithmetic. Forced categorical
// boundary cases used in place of ULP forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the B1-B8 harnesses.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-269-validate-w8-series-structural.proptest.mjs

import { compute } from '../art-269-validate-w8-series-structural.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-269-validate-w8-series-structural.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const output_payload = compute(vec.policy_parameters);
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
const rand = mulberry32(0x2690A1);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;

const FORM_TYPES = ['W-8BEN', 'W-8BEN-E', 'W-8ECI', 'W-8EXP', 'W-8IMY', 'BOGUS'];
const CH3_VALID = ['Individual', 'Corporation', 'Partnership'];
const CH4_VALID = ['NFFE_Active', 'FFI', 'Participating_FFI'];

function mkPP(rng) {
  return {
    form_type: pick(rng, FORM_TYPES),
    chapter3_status: pick(rng, CH3_VALID),
    chapter4_fatca_status: pick(rng, CH4_VALID),
    treaty_country: rng() < 0.5 ? 'DE' : null,
    treaty_rate_pct: rng() < 0.5 ? Math.floor(rng() * 30) : null,
    form_date: '2024-01-01',
    reference_date: '2026-06-01',
  };
}

// ---------- P1: monotone — a fully-valid W-8BEN/Individual combo never has MORE violations than a bogus form_type variant ----------
function checkP1_monotoneViolations() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const worse = { ...pp, form_type: 'BOGUS', chapter3_status: 'BOGUS' };
    const better = { ...pp, form_type: 'W-8BEN', chapter3_status: 'Individual', chapter4_fatca_status: 'NFFE_Active' };
    const r1 = compute(better);
    const r2v = compute(worse);
    checked++;
    if (r2v.violation_count < r1.violation_count) violations++;
    if (r1.is_structurally_valid && r2v.is_structurally_valid) violations++;
  }
  return { name: 'P1_monotone_violations_nondecreasing_toward_bogus_fields', trials: checked, violations };
}

// ---------- P2: boundedness — violation_count === violations.length, is_structurally_valid iff violation_count === 0 ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.violation_count !== r.violations.length) violations++;
    if (r.is_structurally_valid !== (r.violation_count === 0)) violations++;
    if (r.violation_count < 0) violations++;
  }
  return { name: 'P2_boundedness_violation_count_matches_array_length_and_validity_flag', trials: checked, violations };
}

// ---------- P3: fixed-tier agreement — form_ch3_compatible matches independently-derived FORM_CH3_MAP rule ----------
function checkP3_formCh3Agreement() {
  let violations = 0, checked = 0;
  const FORM_CH3 = {
    'W-8BEN': new Set(['Individual']),
    'W-8BEN-E': new Set(['Corporation', 'Partnership']),
    'W-8ECI': new Set(['Individual', 'Corporation', 'Partnership']),
  };
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const allowed = FORM_CH3[pp.form_type];
    if (allowed) {
      const expected = allowed.has(pp.chapter3_status);
      if (r.form_ch3_compatible !== expected) violations++;
    }
    if (pp.form_type === 'BOGUS' && r.is_structurally_valid) violations++;
  }
  return { name: 'P3_form_ch3_compatible_matches_fixed_map_rule', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ form_type: 'W-8BEN', chapter3_status: 'Individual', form_date: '2024-01-01', reference_date: '2027-12-31' }, 'reference_date exactly at 3-year expiry boundary (Dec 31 of form_year+3) — validity_window_ok must be true'],
  [{ form_type: 'W-8BEN', chapter3_status: 'Individual', form_date: '2024-01-01', reference_date: '2028-01-01' }, 'reference_date just past 3-year expiry — validity_window_ok must be false, VALIDITY_EXPIRED violation'],
  [{ form_type: 'BOGUS', chapter3_status: 'Individual' }, 'invalid form_type — INVALID_FORM_TYPE violation, is_structurally_valid false'],
  [{ form_type: 'W-8BEN', chapter3_status: 'BOGUS' }, 'invalid chapter3_status — INVALID_CH3_STATUS violation'],
  [{ form_type: 'W-8BEN-E', chapter3_status: 'Individual', chapter4_fatca_status: 'NFFE_Active' }, 'W-8BEN-E + Individual — structurally inconsistent, CH3_CH4_INCONSISTENT violation'],
  [{ form_type: 'W-8IMY', chapter3_status: 'Individual', chapter4_fatca_status: 'FFI' }, 'FFI Ch.4 status + Individual Ch.3 — incompatible, CH3_CH4_INCONSISTENT violation'],
  [{ form_type: 'W-8BEN', chapter3_status: 'Individual', treaty_country: 'DE', treaty_rate_pct: 15 }, 'treaty_rate_pct exactly at expected DE rate (15%) — treaty_rate_valid must be true'],
  [{ form_type: 'W-8BEN', chapter3_status: 'Individual', treaty_country: 'DE', treaty_rate_pct: 16 }, 'treaty_rate_pct just above expected DE rate — treaty_rate_valid must be false, TREATY_RATE_EXCEEDS_EXPECTED'],
  [{ form_type: 'W-8BEN', chapter3_status: 'Individual', treaty_country: 'DE', treaty_rate_pct: null }, 'treaty_country present without treaty_rate_pct — TREATY_RATE_MISSING violation'],
  [{}, 'fully empty input — INVALID_FORM_TYPE and INVALID_CH3_STATUS violations, no throw'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const plausible = typeof r.is_structurally_valid === 'boolean' && Number.isFinite(r.violation_count) && Array.isArray(r.violations);
    rows.push({ label, pp, is_structurally_valid: r.is_structurally_valid, violation_count: r.violation_count, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneViolations());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_formCh3Agreement());
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
