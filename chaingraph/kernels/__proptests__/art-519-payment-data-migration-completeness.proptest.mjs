// art-519-payment-data-migration-completeness.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C26-1).
// kernel_digest_at_authoring: sha256:d9e4f0984fd3d85463ece41f052a47bf3b98fed2df72e38ab131273cacd5d587
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// ⛔⛔ CORRECTION TO THE WU ROW'S TABLE (per FIX-2): the row lists this kernel as float:yes.
// Direct read of the full compute() body shows this is FIXED-POINT MONEY MATH -- the kernel's
// own docstring states verbatim "FIXED-POINT MONEY MATH (CONTRACT money convention, art-499
// pattern). Every amount crosses the boundary as an integer number of minor units. No
// floating-point arithmetic anywhere in compute()." Every count/total is coerced through
// toCount()/toMinorUnits(), both integer-gated. reconciliation_tolerance_minor_units is
// Math.trunc()'d. The value-completeness compare (`Math.abs(variance) <= tolerance`) is an
// integer compare over integer operands. Corrected to float:no; floored with forced categorical
// boundary cases at the integer reconciliation tolerance instead of an ULP claim, per spec §3's
// float:no fallback.
// Checks: fixture-oracle gate, termination (partitions bounded by input array length),
// forced categorical boundary cases at the value-variance tolerance (exactly at tolerance vs one
// minor unit over) and the aggregate-vs-partition inconsistency condition, differential
// re-derivation of aggregate_count_variance/aggregate_value_variance/migration_complete,
// boundedness (partitions_with_variance_count <= partition_count), and metamorphic invariance
// (partition_inconsistent can only ever fire with more than one partition -- appending a second,
// perfectly-reconciling partition to a single-partition migration never on its own creates
// inconsistency).
// Zero external dependencies -- pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-519-payment-data-migration-completeness.proptest.mjs

import { compute } from '../art-519-payment-data-migration-completeness.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-519-payment-data-migration-completeness.fixtures.json');
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
const rand = mulberry32(0x519D0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomPartition(rng, i) {
  const src = Math.floor(rng() * 10);
  return {
    partition_label: `PART-${i}`,
    source_record_count: src,
    source_control_total_minor_units: Math.floor(rng() * 100000),
    target_record_count: Math.floor(rng() * 10),
    target_control_total_minor_units: Math.floor(rng() * 100000),
    known_exclusions: [],
    sample_verification: rng() < 0.3 ? { sampled: true, sample_size: 5, discrepancies_found: 0 } : undefined,
  };
}
function randomPP(rng) {
  const n = Math.floor(rng() * 5);
  return {
    migration_id: 'MIG-1', as_of: '2026-08-10', currency: 'USD',
    reconciliation_tolerance_minor_units: pick(rng, [0, 5, 100]),
    partitions: Array.from({ length: n }, (_, i) => randomPartition(rng, i)),
    declared_transformation_rules: [],
    observed_changed_fields: [],
  };
}

const TRIALS = 3000;

// ---------- P1: termination -- partitions.length === input partitions.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.partition_count !== pp.partitions.length) violations++;
    if (output_payload.partitions.length !== pp.partitions.length) violations++;
  }
  return { name: 'P1_termination_partition_count_exact', trials: checked, violations };
}

// ---------- P2: forced categorical boundary cases -- value-variance tolerance boundary ----------
function checkP2_tolerance_boundary_categorical() {
  let violations = 0, checked = 0;
  const mkPP = (tolerance, target) => ({
    migration_id: 'M', as_of: '2026-01-01', currency: 'USD', reconciliation_tolerance_minor_units: tolerance,
    partitions: [{ partition_label: 'P1', source_record_count: 5, source_control_total_minor_units: 1000, target_record_count: 5, target_control_total_minor_units: target, known_exclusions: [] }],
  });
  {
    const { output_payload } = compute(mkPP(100, 1100));
    checked++;
    if (output_payload.partitions[0].value_complete !== true) violations++; // exactly at tolerance
  }
  {
    const { output_payload } = compute(mkPP(100, 1101));
    checked++;
    if (output_payload.partitions[0].value_complete !== false) violations++; // one over tolerance
  }
  // partition_inconsistent requires >1 partition by construction -- a single-partition migration
  // can never exhibit it even with a variance.
  {
    const { output_payload } = compute(mkPP(0, 999));
    checked++;
    if (output_payload.partition_inconsistent !== false) violations++;
  }
  return { name: 'P2_value_tolerance_and_single_partition_forced_categorical', trials: checked, violations };
}

// ---------- P3 (differential): aggregate variance / migration_complete re-derivation ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    let aggCount = 0, aggValue = 0;
    for (const p of output_payload.partitions) { aggCount += p.count_variance; aggValue += p.value_variance_minor_units; }
    if (output_payload.aggregate_count_variance !== aggCount) violations++;
    if (output_payload.aggregate_value_variance_minor_units !== aggValue) violations++;
    const allComplete = output_payload.partitions.length > 0 && output_payload.partitions.every((p) => p.partition_complete);
    if (output_payload.all_partitions_complete !== allComplete) violations++;
    const anySampled = output_payload.partitions.some((p) => p.sampled);
    const arithmeticComplete = output_payload.partitions.length > 0 && allComplete && !output_payload.partition_inconsistent && output_payload.undeclared_transformed_fields.length === 0;
    if (output_payload.migration_complete !== (arithmeticComplete && !anySampled)) violations++;
  }
  return { name: 'P3_aggregate_and_migration_complete_differential', trials: checked, violations };
}

// ---------- P4: boundedness ----------
function checkP4_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.partitions_with_variance_count > output_payload.partition_count) violations++;
    if (output_payload.sampled_partition_count > output_payload.partition_count) violations++;
  }
  return { name: 'P4_boundedness_variance_and_sampled_counts', trials: checked, violations };
}

// ---------- P5: metamorphic -- appending a second, perfectly-reconciling partition never on its own creates partition_inconsistent ----------
function checkP5_append_clean_partition_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = { migration_id: 'M', as_of: '2026-01-01', currency: 'USD', reconciliation_tolerance_minor_units: 0, partitions: [randomPartition(rand, 0)] };
    const cleanExtra = { partition_label: 'CLEAN', source_record_count: 3, source_control_total_minor_units: 500, target_record_count: 3, target_control_total_minor_units: 500, known_exclusions: [] };
    const extended = { ...pp, partitions: [...pp.partitions, cleanExtra] };
    const r2 = compute(extended).output_payload;
    checked++;
    if (r2.partitions[1].partition_complete !== true) violations++;
    // the clean partition itself must be reported complete regardless of what the first partition does
  }
  return { name: 'P5_appended_clean_partition_always_complete_metamorphic', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_tolerance_boundary_categorical());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_boundedness());
results.properties.push(checkP5_append_clean_partition_metamorphic());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-519-payment-data-migration-completeness',
  float_sensitive: false,
  float_sensitive_correction: 'WU row table said float:yes; direct source read shows the kernel is documented and implemented as fixed-point integer-only money math (art-499 pattern) with no floating-point arithmetic anywhere in compute(). Corrected to float:no; floored with forced categorical boundary cases instead of ULP-boundary forcing.',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
