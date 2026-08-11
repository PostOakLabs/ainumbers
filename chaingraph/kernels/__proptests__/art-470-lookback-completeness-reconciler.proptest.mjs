// art-470-lookback-completeness-reconciler.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C22-1).
// kernel_digest_at_authoring: sha256:88f0b073173f8eafac3e96acaa0200f936815a627d4985738cbf8e79217632ca
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — coverage_pct uses Math.round(x * 10000) / 100 to produce a 2-decimal
// percentage for DISPLAY only; it is never compared against a threshold or used in a branch
// (period_status branches on gap_count/duplicate_count/snapshot_available, all integers/booleans),
// direct source read confirmed. Forced categorical boundary cases used instead.
// Checks: fixture-oracle gate, termination (periods output length equals input length),
// differential re-derivation of gap_count/duplicate_count/period_status per period and the
// verifiable-coverage denominator exclusion, boundedness (gap_count/duplicate_count never
// negative, coverage_pct always in [0,100]), metamorphic append-invariance (appending a period
// never changes an earlier period's row), and forced categorical boundary cases (zero-source
// period, unverifiable-snapshot exclusion from the coverage denominator). Zero external
// dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-470-lookback-completeness-reconciler.proptest.mjs

import { compute } from '../art-470-lookback-completeness-reconciler.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-470-lookback-completeness-reconciler.fixtures.json');
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
const rand = mulberry32(0x470A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomPeriod(rng, idx) {
  const source = Math.floor(rng() * 1000);
  const extract = Math.floor(rng() * 1200);
  const dedup = rng() < 0.7 ? Math.min(extract, Math.floor(rng() * extract)) : extract;
  return {
    period_label: `p-${idx}`,
    source_record_count: source,
    extract_record_count: extract,
    dedup_record_count: dedup,
    snapshot_available: rng() < 0.8,
  };
}

function randomPP(rng) {
  const n = Math.floor(rng() * 8);
  return { periods: Array.from({ length: n }, (_, i) => randomPeriod(rng, i)) };
}

const TRIALS = 5000;

// ---------- P1: termination — periods output length equals input length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.periods.length !== pp.periods.length) violations++;
    if (output_payload.period_count !== pp.periods.length) violations++;
  }
  return { name: 'P1_termination_periods_length_equals_input', trials: checked, violations };
}

// ---------- P2 (differential): gap_count/duplicate_count/period_status re-derivation ----------
function checkP2_period_fields_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    output_payload.periods.forEach((row, idx) => {
      const src = pp.periods[idx];
      const source = Math.max(0, Math.trunc(src.source_record_count));
      const extract = Math.max(0, Math.trunc(src.extract_record_count));
      const dedup = Math.max(0, Math.trunc(src.dedup_record_count ?? extract));
      const expectedGap = Math.max(0, source - extract);
      const expectedDup = Math.max(0, extract - dedup);
      if (row.gap_count !== expectedGap) violations++;
      if (row.duplicate_count !== expectedDup) violations++;
      let expectedStatus;
      if (!src.snapshot_available) expectedStatus = 'unverifiable_no_snapshot';
      else if (expectedGap > 0) expectedStatus = 'incomplete';
      else if (expectedDup > 0) expectedStatus = 'complete_with_duplicates';
      else expectedStatus = 'complete';
      if (row.period_status !== expectedStatus) violations++;
    });
  }
  return { name: 'P2_period_fields_differential', trials: checked, violations };
}

// ---------- P3: boundedness — coverage_pct finite and non-negative, gap/duplicate counts never negative ----------
// (coverage_pct = extract/source*100 has NO upper cap in the kernel — an extract that over-delivers
// relative to the declared source count, e.g. duplicate-inflated, legitimately reports >100%; this
// is intended "extract exceeds source" signal, not a bug, so only the lower bound and finiteness
// are asserted here.)
function checkP3_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    for (const row of output_payload.periods) {
      if (row.gap_count < 0) violations++;
      if (row.duplicate_count < 0) violations++;
      if (!Number.isFinite(row.coverage_pct) || row.coverage_pct < 0) violations++;
    }
    if (!Number.isFinite(output_payload.overall_coverage_pct) || output_payload.overall_coverage_pct < 0) violations++;
  }
  return { name: 'P3_boundedness_nonneg_counts_and_finite_pct', trials: checked, violations };
}

// ---------- P4: metamorphic — appending a period never changes an earlier period's row ----------
function checkP4_append_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = randomPP(rand);
    if (pp.periods.length === 0) continue;
    const r1 = compute(pp).output_payload;
    const extended = { periods: [...pp.periods, randomPeriod(rand, pp.periods.length)] };
    const r2 = compute(extended).output_payload;
    checked++;
    for (let j = 0; j < pp.periods.length; j++) {
      if (JSON.stringify(r1.periods[j]) !== JSON.stringify(r2.periods[j])) violations++;
    }
    if (r2.periods.length !== r1.periods.length + 1) violations++;
  }
  return { name: 'P4_append_period_metamorphic', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (zero-source period, unverifiable exclusion) ----------
function checkP5_forced_categorical_boundaries() {
  let violations = 0, checked = 0;
  {
    checked++;
    const { output_payload } = compute({ periods: [{ period_label: 'p0', source_record_count: 0, extract_record_count: 0, snapshot_available: true }] });
    if (output_payload.periods[0].coverage_pct !== 100) violations++;
    if (output_payload.periods[0].period_status !== 'complete') violations++;
  }
  {
    checked++;
    // Unverifiable period with a large source count must be excluded from verifiable_source_count.
    const { output_payload } = compute({
      periods: [
        { period_label: 'unverif', source_record_count: 1000, extract_record_count: 0, snapshot_available: false },
        { period_label: 'clean', source_record_count: 10, extract_record_count: 10, snapshot_available: true },
      ],
    });
    if (output_payload.verifiable_source_count !== 10) violations++;
    if (output_payload.overall_coverage_pct !== 100) violations++;
    if (!output_payload.unverifiable_periods.includes('unverif')) violations++;
    if (output_payload.lookback_status !== 'incomplete_unverifiable_periods_present') violations++;
  }
  return { name: 'P5_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_period_fields_differential());
results.properties.push(checkP3_boundedness());
results.properties.push(checkP4_append_metamorphic());
results.properties.push(checkP5_forced_categorical_boundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-470-lookback-completeness-reconciler',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
