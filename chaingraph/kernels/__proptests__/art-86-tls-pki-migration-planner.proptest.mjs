// kernel_digest_at_authoring: sha256:e85d6bf7a77f232f5abd1634ba2c1b56fdf0bb46db01403dc6bf55e317bfe718
//
// FV-PROPFLOOR-SHARD-B17-1 — property-test floor for art-86-tls-pki-migration-planner.
// Class B (bounded-numeric/categorical), FLOAT:NO per the WU row — all arithmetic is integer
// (fixed byte-size constants, integer week counts by threshold tier) except a single fixed
// display multiplier (2.1) that only appears verbatim in a note string, never computed on. The
// fmtEnUS() number formatter is a deterministic pure-integer-path replica of toLocaleString.
// Forced CATEGORICAL boundary cases used in place of ULP forcing (migration_strategy enum,
// leaf_population/root_cas/intermediate_count tier thresholds). Zero external dependencies
// (mulberry32 PRNG + explicit boundary arrays), same shape as the B1/B12 harness. This file is
// READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-86-tls-pki-migration-planner.proptest.mjs

import { compute } from '../art-86-tls-pki-migration-planner.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-86-tls-pki-migration-planner.fixtures.json');
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
const rand = mulberry32(0x86B3D5);
const TRIALS = 8000;
const STRATEGIES = ['hybrid', 'replace', 'composite'];
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function mkPP(rng) {
  return {
    pki: {
      root_cas: 1 + Math.floor(rng() * 5),
      intermediate_count: Math.floor(rng() * 10),
      leaf_population: Math.floor(rng() * 200000),
      tls_versions: rng() < 0.3 ? ['tls12'] : [],
    },
    migration_strategy: pick(rng, STRATEGIES),
    interop_constraints: rng() < 0.3 ? ['size_limited'] : [],
  };
}

// ---------- P1: estimated_total_weeks is exactly the sum of the three phase efforts -----------------
function checkP1_totalWeeksExactSum() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { migration_plan, estimated_total_weeks } = r.output_payload;
    const sum = migration_plan.reduce((a, p) => a + p.effort_weeks, 0);
    if (sum !== estimated_total_weeks) violations++;
  }
  return { name: 'P1_estimated_total_weeks_exact_sum_of_phase_efforts', trials: checked, violations };
}

// ---------- P2: phase effort tiers match the fixed thresholds exactly (root_cas<=2, intcnt<=5, leaf tiers) --
function checkP2_phaseTiersMatchFixedThresholds() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { root_cas, intermediate_count, leaf_population } = pp.pki;
    const [p1, p2, p3] = r.output_payload.migration_plan;
    const expected1 = root_cas <= 2 ? 6 : 12;
    const expected2 = intermediate_count <= 5 ? 8 : 16;
    const expected3 = leaf_population > 100000 ? 26 : leaf_population > 10000 ? 16 : leaf_population > 1000 ? 10 : 6;
    if (p1.effort_weeks !== expected1) violations++;
    if (p2.effort_weeks !== expected2) violations++;
    if (p3.effort_weeks !== expected3) violations++;
  }
  return { name: 'P2_phase_effort_tiers_match_fixed_thresholds', trials: checked, violations };
}

// ---------- P3: payload_impact_bytes is exactly determined by the strategy enum, fixed constants -----
function checkP3_payloadImpactExactByStrategy() {
  let violations = 0, checked = 0;
  const ML_DSA_65 = 3309, RSA2048 = 256;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected =
      pp.migration_strategy === 'hybrid' ? ML_DSA_65 + RSA2048 :
      pp.migration_strategy === 'replace' ? ML_DSA_65 :
      Math.round(ML_DSA_65 * 1.15);
    if (r.output_payload.payload_impact_bytes !== expected) violations++;
  }
  return { name: 'P3_payload_impact_bytes_exact_by_strategy_enum', trials: checked, violations };
}

// ---------- P4 (mandatory, float:no exception): forced categorical boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{}, 'policy_parameters entirely empty — must use all documented defaults (root_cas=1, intermediate=2, leaf=1000, hybrid strategy)'],
  [{ pki: { root_cas: 2, intermediate_count: 5, leaf_population: 1000 } }, 'root_cas exactly 2 and intermediate_count exactly 5 (both AT the <=2/<=5 lower-tier boundary) — must use the cheaper 6/8-week tiers'],
  [{ pki: { root_cas: 3, intermediate_count: 6, leaf_population: 1000 } }, 'root_cas exactly 3 and intermediate_count exactly 6 (one past each boundary) — must use the more expensive 12/16-week tiers'],
  [{ pki: { root_cas: 1, intermediate_count: 1, leaf_population: 1000 } }, 'leaf_population exactly 1000 (boundary, uses strict >) — must use the 1000-and-under 6-week tier, not the 10-week tier'],
  [{ pki: { root_cas: 1, intermediate_count: 1, leaf_population: 1001 } }, 'leaf_population exactly 1001 (one past the 1000 boundary) — must use the 10-week tier'],
  [{ pki: { root_cas: 1, intermediate_count: 1, leaf_population: 100000 } }, 'leaf_population exactly 100000 (upper boundary, uses strict >) — must use the 16-week tier, not the 26-week tier'],
  [{ pki: { root_cas: 1, intermediate_count: 1, leaf_population: 0 } }, 'leaf_population exactly zero — fmtEnUS must render "0" cleanly, phase3 uses the cheapest 6-week tier'],
  [{ migration_strategy: 'unrecognized-strategy' }, 'migration_strategy set to an unrecognized string — falls into the else/composite branch, payload_impact_bytes must be the Math.round(3309*1.15) composite value, no hybrid-only interop_risks entry'],
  [{ pki: { root_cas: 1, intermediate_count: 1, leaf_population: 1000, tls_versions: ['1.2'] } }, 'tls_versions containing the alternate "1.2" literal (not "tls12") — must still set LEGACY_TLS_PRESENT compliance flag via the explicit tls_versions.includes("1.2") check'],
  [{ pki: { root_cas: 1, intermediate_count: 1, leaf_population: 50001 } }, 'leaf_population exactly one past the 50000 LARGE_LEAF_POPULATION compliance-flag boundary — must set the flag'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { estimated_total_weeks, payload_impact_bytes, migration_plan } = r.output_payload;
    const plausible = Number.isInteger(estimated_total_weeks) && estimated_total_weeks > 0
      && Number.isInteger(payload_impact_bytes) && payload_impact_bytes > 0
      && migration_plan.length === 3;
    rows.push({ label, input: pp, estimated_total_weeks, payload_impact_bytes, compliance_flags: r.compliance_flags, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_totalWeeksExactSum());
results.properties.push(checkP2_phaseTiersMatchFixedThresholds());
results.properties.push(checkP3_payloadImpactExactByStrategy());
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
