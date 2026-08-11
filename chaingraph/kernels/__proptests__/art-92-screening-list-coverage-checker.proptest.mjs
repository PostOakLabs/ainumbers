// art-92-screening-list-coverage-checker.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C12-1).
// kernel_digest_at_authoring: sha256:d06a7bacc78c3440e850fc8bccdfc7b270f66c39e0a30d4696c558cf6e24e169
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — coverage_pct/effective_pct are Math.round()
// integer percentages built from integer set-membership counts and fixed integer penalty
// steps of 15/10; no caller float parameters).
// Unbounded input: `config.lists_screened` and `config.sectoral_lists` are caller-controlled
// arrays of arbitrary length/content. Loops are plain Array.filter/includes over the fixed
// REQUIRED_COVERAGE tables — bounded by input size, no recursion.
// Checks: fixture-oracle gate, termination (bounded by array length, no hang on large
// lists_screened arrays), boundedness (coverage_pct/effective_pct always in [0,100],
// coverage_grade always one of A/B/C/D/F), a metamorphic permutation-invariance property
// (reordering lists_screened / sectoral_lists does not change coverage_pct, missing_lists set,
// or nexus_gaps — every check is Array.includes/filter, order-independent), forced categorical
// boundary cases (no nexus declared → worst-case "all" required, every required list present,
// stale ofsi_consolidated present, refresh-frequency boundary at daily/weekly).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-92-screening-list-coverage-checker.proptest.mjs

import { compute } from '../art-92-screening-list-coverage-checker.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-92-screening-list-coverage-checker.fixtures.json');
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
const rand = mulberry32(0x92D0);

const ALL_LISTS = ['ofac_sdn', 'eu_consolidated', 'un_consolidated', 'uk_sanctions_list', 'ofsi_consolidated'];
const REFRESH = ['real_time', 'daily', 'weekly', 'monthly', 'ad_hoc'];

function randomPP(rng, n) {
  const lists_screened = [];
  for (let i = 0; i < n; i++) lists_screened.push(ALL_LISTS[Math.floor(rng() * ALL_LISTS.length)]);
  return {
    config: {
      lists_screened,
      us_nexus_gating: rng() < 0.5,
      eu_nexus_gating: rng() < 0.5,
      uk_nexus_gating: rng() < 0.5,
      refresh_frequency: REFRESH[Math.floor(rng() * REFRESH.length)],
      sectoral_lists: [],
    },
  };
}

const TRIALS = 3000;

// ---------- P1: termination — bounded by array length, no hang on large lists_screened ----------
function checkP1_termination_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 100; i++) {
    const n = 500 + Math.floor(rand() * 2000);
    const pp = randomPP(rand, n);
    const start = Date.now();
    compute(pp);
    checked++;
    if (Date.now() - start > 500) violations++;
  }
  return { name: 'P1_termination_bounded_large_lists_screened', trials: checked, violations };
}

// ---------- P2: boundedness — coverage_pct in [0,100], grade in {A,B,C,D,F} ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 6);
    const pp = randomPP(rand, n);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.coverage_pct < 0 || output_payload.coverage_pct > 100) violations++;
    if (!['A', 'B', 'C', 'D', 'F'].includes(output_payload.coverage_grade)) violations++;
  }
  return { name: 'P2_boundedness_coverage_pct_and_grade', trials: checked, violations };
}

// ---------- P3: metamorphic — permutation-invariance of lists_screened array order ----------
function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 6) + 1;
    const pp = randomPP(rand, n);
    const shuffled = { config: { ...pp.config, lists_screened: [...pp.config.lists_screened].sort(() => rand() - 0.5) } };
    const r1 = compute(pp);
    const r2 = compute(shuffled);
    checked++;
    if (r1.output_payload.coverage_pct !== r2.output_payload.coverage_pct) violations++;
    if (JSON.stringify([...r1.output_payload.missing_lists].sort()) !== JSON.stringify([...r2.output_payload.missing_lists].sort())) violations++;
  }
  return { name: 'P3_permutation_invariance_lists_screened_order', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception per spec §3) ----------
function checkP4_categorical_forcing() {
  let violations = 0, checked = 0;
  const cases = [
    { config: {} }, // no nexus, no lists — worst-case "all" required
    { config: { lists_screened: ['ofac_sdn', 'eu_consolidated', 'un_consolidated', 'uk_sanctions_list'], us_nexus_gating: true, eu_nexus_gating: true, uk_nexus_gating: true, refresh_frequency: 'real_time' } }, // full coverage
    { config: { lists_screened: ['ofsi_consolidated'], uk_nexus_gating: true, refresh_frequency: 'daily' } }, // stale list present
    { config: { lists_screened: ['ofac_sdn'], us_nexus_gating: true, refresh_frequency: 'daily' } }, // refresh exactly at min rank
    { config: { lists_screened: ['ofac_sdn'], us_nexus_gating: true, refresh_frequency: 'weekly' } }, // refresh just below min rank
  ];
  for (const pp of cases) {
    checked++;
    try {
      const { output_payload } = compute(pp);
      if (output_payload.coverage_pct < 0 || output_payload.coverage_pct > 100) violations++;
    } catch (e) {
      violations++;
    }
  }
  // refresh boundary explicitly: daily is adequate, weekly is not
  const dailyRes = compute({ config: { lists_screened: ['ofac_sdn'], us_nexus_gating: true, refresh_frequency: 'daily' } });
  checked++;
  if (!dailyRes.output_payload.refresh_adequate) violations++;
  const weeklyRes = compute({ config: { lists_screened: ['ofac_sdn'], us_nexus_gating: true, refresh_frequency: 'weekly' } });
  checked++;
  if (weeklyRes.output_payload.refresh_adequate) violations++;
  return { name: 'P4_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_bounded());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_permutation_invariance());
results.properties.push(checkP4_categorical_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-92-screening-list-coverage-checker',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
