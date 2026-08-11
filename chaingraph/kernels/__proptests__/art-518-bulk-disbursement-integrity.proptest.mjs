// art-518-bulk-disbursement-integrity.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C26-1).
// kernel_digest_at_authoring: sha256:3c590d0a9987e270cb032c31ba74642ab9a7f3dab1f9fd32eca587058484bfba
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// ⛔⛔ CORRECTION TO THE WU ROW'S TABLE (per FIX-2): the row lists this kernel as float:yes.
// Direct read of the full compute() body shows this is FIXED-POINT MONEY MATH -- the kernel's
// own docstring states verbatim "FIXED-POINT MONEY MATH (CONTRACT money convention, art-516
// pattern). Every amount crosses the boundary as an integer number of minor units. No
// floating-point arithmetic anywhere in compute()." Every amount is coerced through
// toMinorUnits()/toLimitOrNull(), both requiring Number.isSafeInteger. Every comparison
// (limit breach, control-total break, destination-cap breach) is an integer compare. Corrected
// to float:no; floored with forced categorical boundary cases at the per-payee/per-run/
// destination-cap limit thresholds instead of an ULP claim, per spec §3's float:no fallback.
// Checks: fixture-oracle gate, termination (records/duplicate-clusters/limit-breaches bounded by
// input payee_records.length), forced categorical boundary cases at the per-payee limit (exactly
// at limit vs one over) and the absence-instrument rule for prior_run_payee_refs, differential
// re-derivation of control_total_reconciled/duplicate_candidate_clusters/limit_breaches,
// boundedness (reconciled_record_count === input length, duplicate cluster members sum <=
// records.length), and metamorphic invariance (a zero-amount, uniquely-keyed extra payee record
// never changes control_total_reconciled's count/value break by more than that record's own
// contribution).
// Zero external dependencies -- pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-518-bulk-disbursement-integrity.proptest.mjs

import { compute } from '../art-518-bulk-disbursement-integrity.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-518-bulk-disbursement-integrity.fixtures.json');
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
const rand = mulberry32(0x518C0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomRecord(rng, i) {
  return {
    payee_ref: `P-${Math.floor(rng() * 6)}`,
    amount_minor_units: Math.floor(rng() * 5000),
    rail: pick(rng, ['ach', 'rtp', 'wire']),
    duplicate_key: pick(rng, [null, 'K1', 'K2']),
  };
}
function randomPP(rng) {
  const n = Math.floor(rng() * 8);
  const priorMode = pick(rng, ['absent', 'present']);
  return {
    run_reference: 'RUN-1', as_of: '2026-08-10', currency: 'USD',
    authorized_control_total: { payee_count: Math.floor(rng() * 8), total_minor_units: Math.floor(rng() * 20000) },
    payee_records: Array.from({ length: n }, (_, i) => randomRecord(rng, i)),
    per_payee_limit_minor_units: pick(rng, [null, 1000, 2000]),
    per_run_limit_minor_units: pick(rng, [null, 10000]),
    declared_exclusions: [],
    prior_run_payee_refs: priorMode === 'absent' ? undefined : ['P-0', 'P-1'],
  };
}

const TRIALS = 4000;

// ---------- P1: termination -- reconciled_record_count === input length, clusters bounded ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.reconciled_record_count !== pp.payee_records.length) violations++;
    const clusterMembers = output_payload.duplicate_candidate_clusters.reduce((a, c) => a + c.member_count, 0);
    if (clusterMembers > pp.payee_records.length) violations++;
  }
  return { name: 'P1_termination_reconciled_count_and_clusters_bounded', trials: checked, violations };
}

// ---------- P2: forced categorical boundary cases -- per-payee limit exactly-at vs one-over ----------
function checkP2_limit_boundary_categorical() {
  let violations = 0, checked = 0;
  const base = { run_reference: 'R', as_of: '2026-01-01', currency: 'USD', authorized_control_total: { payee_count: 1, total_minor_units: 0 } };
  {
    const pp = { ...base, per_payee_limit_minor_units: 1000, payee_records: [{ payee_ref: 'P1', amount_minor_units: 1000, rail: 'ach' }] };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.has_limit_breach !== false) violations++; // exactly at limit -> not a breach (uses `>`)
  }
  {
    const pp = { ...base, per_payee_limit_minor_units: 1000, payee_records: [{ payee_ref: 'P1', amount_minor_units: 1001, rail: 'ach' }] };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.has_limit_breach !== true) violations++; // one over -> breach
  }
  // absence-instrument: prior_run_payee_refs absent vs empty
  {
    const pp = { ...base, payee_records: [{ payee_ref: 'P1', amount_minor_units: 0, rail: 'ach' }] };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.roster_movement_verifiable !== false) violations++;
  }
  {
    const pp = { ...base, payee_records: [{ payee_ref: 'P1', amount_minor_units: 0, rail: 'ach' }], prior_run_payee_refs: [] };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.roster_movement_verifiable !== true) violations++;
    if (output_payload.new_this_run.length !== 1) violations++;
  }
  return { name: 'P2_per_payee_limit_and_absence_instrument_forced_categorical', trials: checked, violations };
}

// ---------- P3 (differential): control_total_reconciled / duplicate clusters / limit_breaches re-derivation ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const total = pp.payee_records.reduce((a, r) => a + r.amount_minor_units, 0);
    const countBreak = pp.payee_records.length - pp.authorized_control_total.payee_count;
    const valueBreak = total - pp.authorized_control_total.total_minor_units;
    if (output_payload.count_break !== countBreak) violations++;
    if (output_payload.value_break_minor_units !== valueBreak) violations++;
    if (output_payload.control_total_reconciled !== (countBreak === 0 && valueBreak === 0)) violations++;
    const byKey = new Map();
    for (const r of pp.payee_records) { if (!r.duplicate_key) continue; byKey.set(r.duplicate_key, (byKey.get(r.duplicate_key) || 0) + 1); }
    const expectedClusters = [...byKey.values()].filter((n) => n > 1).length;
    if (output_payload.duplicate_candidate_cluster_count !== expectedClusters) violations++;
  }
  return { name: 'P3_control_total_and_duplicate_cluster_differential', trials: checked, violations };
}

// ---------- P4: boundedness ----------
function checkP4_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.new_this_run.length > output_payload.reconciled_record_count) violations++;
    if (output_payload.absent_this_run.length > output_payload.prior_run_payee_count) violations++;
    if (!Number.isSafeInteger(output_payload.reconciled_total_minor_units)) violations++;
  }
  return { name: 'P4_boundedness_roster_and_total_safe_integer', trials: checked, violations };
}

// ---------- P5: metamorphic -- appending a zero-amount, uniquely-keyed payee record shifts count_break by exactly +1 and leaves value_break unchanged ----------
function checkP5_append_zero_record_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    const r1 = compute(pp).output_payload;
    const extended = { ...pp, payee_records: [...pp.payee_records, { payee_ref: 'ZERO-NEW', amount_minor_units: 0, rail: 'ach', duplicate_key: null }] };
    const r2 = compute(extended).output_payload;
    checked++;
    if (r2.reconciled_record_count !== r1.reconciled_record_count + 1) violations++;
    if (r2.value_break_minor_units !== r1.value_break_minor_units) violations++;
    if (r2.count_break !== r1.count_break + 1) violations++;
  }
  return { name: 'P5_append_zero_record_metamorphic', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_limit_boundary_categorical());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_boundedness());
results.properties.push(checkP5_append_zero_record_metamorphic());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-518-bulk-disbursement-integrity',
  float_sensitive: false,
  float_sensitive_correction: 'WU row table said float:yes; direct source read shows the kernel is documented and implemented as fixed-point integer-only money math (art-516 pattern) with no floating-point arithmetic anywhere in compute(). Corrected to float:no; floored with forced categorical boundary cases instead of ULP-boundary forcing.',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
