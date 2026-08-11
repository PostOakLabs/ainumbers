// art-516-daily-reconciliation-attestation.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C26-1).
// kernel_digest_at_authoring: sha256:cd7f7a7436413bdff06e19d14156760a6a8401f9e48a936fa26a9e3b60b6a3d8
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// ⛔⛔ CORRECTION TO THE WU ROW'S TABLE (per FIX-2): the row lists this kernel as float:yes.
// Direct read of the full compute() body shows this is FIXED-POINT MONEY MATH -- the kernel's
// own docstring states verbatim "FIXED-POINT MONEY MATH (CONTRACT money convention, art-499
// pattern)... No floating-point arithmetic anywhere in compute(): sums, differences, and
// tolerance comparisons are integer operations." Every amount is coerced through toMinorUnits(),
// which requires Number.isSafeInteger and REJECTS (never silently accepts) a non-integer value.
// ageing_tolerance_days is Math.trunc()'d and age_days comes from isoDayDelta's whole-day
// Math.round() -- both integers. There is no floating-point threshold anywhere in this kernel.
// Corrected to float:no; floored with forced categorical boundary cases at the integer ageing
// tolerance and the absence-instrument prior_period_exceptions gate instead of an ULP claim,
// per spec §3's float:no fallback.
// Checks: fixture-oracle gate, termination (exceptions/matched/unmatched/partially_matched
// bounded by input array/object shapes), forced categorical boundary cases at the ageing
// tolerance (age_days === tolerance vs tolerance+1) and the absence-instrument rule for
// prior_period_exceptions (absent vs empty array), differential re-derivation of
// population_complete/count_break/value_break/aged_exceptions/attested, boundedness (aged and
// vanished counts bounded by their source arrays), and metamorphic invariance (moving a vanished
// exception to a documented resolution keeps vanished+documented count constant).
// Zero external dependencies -- pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-516-daily-reconciliation-attestation.proptest.mjs

import { compute } from '../art-516-daily-reconciliation-attestation.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-516-daily-reconciliation-attestation.fixtures.json');
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
const rand = mulberry32(0x516A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomBucket(rng) {
  return { record_count: Math.floor(rng() * 10), total_minor_units: Math.floor((rng() - 0.3) * 100000) };
}
function randomException(rng, i) {
  return {
    exception_id: `EXC-${i}`,
    reason_code: pick(rng, ['timing', 'duplicate', null]),
    opened_date: pick(rng, ['2026-07-01', '2026-07-20', '2026-08-01', null]),
    amount_minor_units: Math.floor((rng() - 0.3) * 5000),
  };
}
function randomPP(rng) {
  const n = Math.floor(rng() * 6);
  const priorMode = pick(rng, ['absent', 'empty', 'present']);
  const priorCount = priorMode === 'present' ? Math.floor(rng() * 4) : 0;
  return {
    reconciliation_date: '2026-08-10',
    as_of: '2026-08-10',
    currency: 'USD',
    ageing_tolerance_days: pick(rng, [0, 5, 10, 30]),
    declared_population: { record_count: Math.floor(rng() * 10), control_total_minor_units: Math.floor((rng() - 0.3) * 100000) },
    matched: randomBucket(rng), unmatched: randomBucket(rng), partially_matched: randomBucket(rng),
    exceptions: Array.from({ length: n }, (_, i) => randomException(rng, i)),
    prior_period_exceptions: priorMode === 'absent' ? undefined : Array.from({ length: priorCount }, (_, i) => ({ exception_id: `EXC-${i}`, reason_code: 'timing', opened_date: '2026-06-01' })),
    resolved_exceptions: [],
  };
}

const TRIALS = 4000;

// ---------- P1: termination -- reconciled_record_count = sum of the three bucket record_counts, exceptions bounded by input length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.reconciled_record_count !== output_payload.matched.record_count + output_payload.unmatched.record_count + output_payload.partially_matched.record_count) violations++;
    if (output_payload.exception_count !== pp.exceptions.length) violations++;
    if (output_payload.exceptions.length > pp.exceptions.length) violations++;
  }
  return { name: 'P1_termination_reconciled_count_and_exceptions_bounded', trials: checked, violations };
}

// ---------- P2: forced categorical boundary cases -- ageing tolerance boundary + absence-instrument ----------
function checkP2_boundary_categorical() {
  let violations = 0, checked = 0;
  const basePP = () => ({ reconciliation_date: '2026-08-10', as_of: '2026-08-10', currency: 'USD', declared_population: { record_count: 0, control_total_minor_units: 0 }, matched: { record_count: 0, total_minor_units: 0 }, unmatched: { record_count: 0, total_minor_units: 0 }, partially_matched: { record_count: 0, total_minor_units: 0 } });
  // age_days === tolerance -> NOT aged (strict >); tolerance-1 -> aged. 2026-08-10 minus
  // 2026-07-31 is exactly 10 whole days.
  {
    const pp = { ...basePP(), ageing_tolerance_days: 10, exceptions: [{ exception_id: 'E1', reason_code: 'timing', opened_date: '2026-07-31', amount_minor_units: 0 }] };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.exceptions[0].age_days !== 10) violations++;
    if (output_payload.exceptions[0].aged !== false) violations++; // exactly at tolerance -> not aged
  }
  {
    const pp = { ...basePP(), ageing_tolerance_days: 9, exceptions: [{ exception_id: 'E1', reason_code: 'timing', opened_date: '2026-07-31', amount_minor_units: 0 }] };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.exceptions[0].aged !== true) violations++; // one day over tolerance
  }
  // absence-instrument: prior_period_exceptions absent vs empty array
  {
    const pp = { ...basePP(), ageing_tolerance_days: 30, exceptions: [] };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.continuity_verifiable !== false) violations++;
  }
  {
    const pp = { ...basePP(), ageing_tolerance_days: 30, exceptions: [], prior_period_exceptions: [] };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.continuity_verifiable !== true) violations++;
    if (output_payload.vanished_exception_count !== 0) violations++;
  }
  return { name: 'P2_ageing_tolerance_and_absence_instrument_forced_categorical', trials: checked, violations };
}

// ---------- P3 (differential): population_complete / count_break / value_break / aged / attested re-derivation ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const recCount = output_payload.matched.record_count + output_payload.unmatched.record_count + output_payload.partially_matched.record_count;
    const recValue = output_payload.matched.total_minor_units + output_payload.unmatched.total_minor_units + output_payload.partially_matched.total_minor_units;
    const countBreak = recCount - output_payload.declared_record_count;
    const valueBreak = recValue - output_payload.declared_control_total_minor_units;
    if (output_payload.count_break !== countBreak) violations++;
    if (output_payload.value_break_minor_units !== valueBreak) violations++;
    if (output_payload.population_complete !== (countBreak === 0 && valueBreak === 0)) violations++;
    const expectAged = output_payload.exceptions.filter((e) => e.aged).length;
    if (output_payload.aged_exception_count !== expectAged) violations++;
    const expectAttested = output_payload.population_complete && expectAged === 0 && output_payload.vanished_exception_count === 0 && !output_payload.has_unexplained_difference;
    if (output_payload.attested !== expectAttested) violations++;
  }
  return { name: 'P3_population_and_attested_differential', trials: checked, violations };
}

// ---------- P4: boundedness ----------
function checkP4_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.aged_exception_count > output_payload.exception_count) violations++;
    if (output_payload.vanished_exception_count > output_payload.prior_period_exception_count) violations++;
    if (output_payload.documented_resolutions.length > output_payload.prior_period_exception_count) violations++;
  }
  return { name: 'P4_aged_and_vanished_bounded_by_source_arrays', trials: checked, violations };
}

// ---------- P5: metamorphic -- moving a vanished exception to a documented resolution keeps vanished+documented constant ----------
function checkP5_resolution_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = randomPP(rand);
    const r1 = compute(pp).output_payload;
    checked++;
    if (r1.vanished_exceptions.length > 0) {
      const target = r1.vanished_exceptions[0].exception_id;
      const pp2 = { ...pp, resolved_exceptions: [...(pp.resolved_exceptions || []), { exception_id: target, resolution_reason: 'closed-out' }] };
      const r2 = compute(pp2).output_payload;
      checked++;
      if (r2.vanished_exception_count !== r1.vanished_exception_count - 1) violations++;
      if (r2.documented_resolutions.length !== r1.documented_resolutions.length + 1) violations++;
    }
  }
  return { name: 'P5_resolution_moves_vanished_to_documented_metamorphic', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundary_categorical());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_boundedness());
results.properties.push(checkP5_resolution_metamorphic());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-516-daily-reconciliation-attestation',
  float_sensitive: false,
  float_sensitive_correction: 'WU row table said float:yes; direct source read shows the kernel is documented and implemented as fixed-point integer-only money math (art-499 pattern) with no floating-point arithmetic anywhere in compute() -- ageing_tolerance_days and age_days are both integers. Corrected to float:no; floored with forced categorical boundary cases instead of ULP-boundary forcing.',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
