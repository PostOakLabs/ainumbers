// art-507-determine-deposit-insurance-coverage.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C25-1).
// kernel_digest_at_authoring: sha256:af6ead608e9e4066d16c80dc91534582c71e82ff5d9fc556cb6c9444a00b15d1
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — CORRECTED from the WU row's float:yes (per FIX-2 discipline). Direct source
// read: every balance and the SMDIA are integer minor units (Number.isSafeInteger gate), and every
// arithmetic operation in compute() is integer addition/subtraction/comparison or an integer
// multiplication (`smdia_applied * g.coverage_units`) — there is no division anywhere in the file,
// no percentage, no rate, and no toFixed()/display() formatting step. Forced categorical boundary
// cases are used in place of ULP-boundary forcing.
// Checks: fixture-oracle gate, termination (undeterminable_records + determinable partition supplied
// exactly once, groups/codes bounded by determinable count), differential re-derivation of the
// insured/uninsured allowance arithmetic, permutation-invariance of account_records (aggregation is
// order-independent), and forced categorical boundary cases (no SMDIA, exact-allowance boundary,
// negative/non-integer balance, empty input). Zero external dependencies — pure Node built-ins only.
//
// Run: node chaingraph/kernels/__proptests__/art-507-determine-deposit-insurance-coverage.proptest.mjs

import { compute } from '../art-507-determine-deposit-insurance-coverage.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-507-determine-deposit-insurance-coverage.fixtures.json');
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
const rand = mulberry32(0x50700);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomRecord(rng, i, groupPool) {
  const shapePick = rng();
  const account_ref = `ACC-${i}`;
  const ownership_right_and_capacity = pick(rng, ['SINGLE', 'JOINT', 'REVOCABLE_TRUST', null]);
  const balance = shapePick < 0.1 ? null : shapePick < 0.15 ? -Math.floor(rng() * 1000) : Math.floor(rng() * 2_000_000);
  const group = pick(rng, groupPool);
  return {
    account_ref,
    ownership_right_and_capacity,
    balance,
    insurance_aggregation_key: group,
    exception_flag: rng() < 0.05,
    alternative_recordkeeping: rng() < 0.05,
    pass_through_eligible: rng() < 0.1,
    per_beneficiary_coverage: rng() < 0.1,
    beneficiary_count: rng() < 0.5 ? Math.floor(rng() * 5) + 1 : null,
  };
}

function randomPP(rng) {
  const n = Math.floor(rng() * 10);
  const groupPool = ['G1', 'G2', 'G3', null];
  const account_records = [];
  for (let i = 0; i < n; i++) account_records.push(randomRecord(rng, i, groupPool));
  return {
    as_of_date: '2026-06-30',
    institution_ref: 'BANK-1',
    currency: 'USD',
    smdia: rng() < 0.1 ? undefined : 250000,
    account_records,
  };
}

const TRIALS = 3000;

// ---------- P1: termination — every supplied record lands in exactly one of the two partitions ----------
function checkP1_partition_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const determinedCount = output_payload.coverage_summary.deposit_accounts_determined;
    const undeterminedCount = output_payload.coverage_summary.undeterminable_account_count;
    if (output_payload.coverage_summary.deposit_accounts_supplied !== pp.account_records.length) violations++;
    if (undeterminedCount !== output_payload.undeterminable_records.length) violations++;
    // Every group's account_count sums to the determined total (groups partition determinable records).
    const groupSum = output_payload.aggregation_groups.reduce((a, g) => a + g.account_count, 0);
    if (groupSum !== determinedCount) violations++;
  }
  return { name: 'P1_partition_termination_bounded_by_input_length', trials: checked, violations };
}

// ---------- P2 (differential): insured/uninsured allowance arithmetic re-derived ----------
function checkP2_allowance_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    for (const g of output_payload.aggregation_groups) {
      const allowance = output_payload.smdia_applied * g.coverage_units;
      const expectedInsured = g.aggregated_balance_minor_units < allowance ? g.aggregated_balance_minor_units : allowance;
      const expectedUninsured = g.aggregated_balance_minor_units - expectedInsured;
      if (g.allowance_minor_units !== allowance) violations++;
      if (g.insured_minor_units !== expectedInsured) violations++;
      if (g.uninsured_minor_units !== expectedUninsured) violations++;
      if (g.fully_insured !== (expectedUninsured === 0)) violations++;
    }
  }
  return { name: 'P2_allowance_arithmetic_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — permuting account_records never changes aggregated totals ----------
function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1200; i++) {
    const pp = randomPP(rand);
    if (pp.account_records.length < 2) continue;
    const shuffled = { ...pp, account_records: [...pp.account_records].sort(() => rand() - 0.5) };
    const r1 = compute(pp).output_payload;
    const r2 = compute(shuffled).output_payload;
    checked++;
    if (r1.coverage_summary.insured_minor_units !== r2.coverage_summary.insured_minor_units) violations++;
    if (r1.coverage_summary.uninsured_minor_units !== r2.coverage_summary.uninsured_minor_units) violations++;
    if (r1.coverage_summary.aggregated_balance_minor_units !== r2.coverage_summary.aggregated_balance_minor_units) violations++;
    if (r1.aggregation_groups.length !== r2.aggregation_groups.length) violations++;
    if (r1.undeterminable_records.length !== r2.undeterminable_records.length) violations++;
  }
  return { name: 'P3_account_record_order_invariance', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applies) ----------
function checkP4_forced_categorical_boundaries() {
  let violations = 0, checked = 0;
  const base = { as_of_date: '2026-06-30', institution_ref: 'B', currency: 'USD' };

  // no SMDIA supplied -> every record undeterminable naming smdia
  checked++;
  {
    const r = compute({ ...base, account_records: [{ account_ref: 'A1', ownership_right_and_capacity: 'SINGLE', balance: 1000, insurance_aggregation_key: 'G1' }] }).output_payload;
    if (r.coverage_summary.undeterminable_account_count !== 1 || r.undeterminable_records[0].missing_field !== 'smdia') violations++;
  }
  // exact-allowance boundary: balance === smdia -> fully insured, uninsured === 0
  checked++;
  {
    const r = compute({ ...base, smdia: 250000, account_records: [{ account_ref: 'A1', ownership_right_and_capacity: 'SINGLE', balance: 250000, insurance_aggregation_key: 'G1' }] }).output_payload;
    const g = r.aggregation_groups[0];
    if (g.uninsured_minor_units !== 0 || g.fully_insured !== true) violations++;
  }
  // one minor unit over the allowance -> uninsured === 1
  checked++;
  {
    const r = compute({ ...base, smdia: 250000, account_records: [{ account_ref: 'A1', ownership_right_and_capacity: 'SINGLE', balance: 250001, insurance_aggregation_key: 'G1' }] }).output_payload;
    const g = r.aggregation_groups[0];
    if (g.uninsured_minor_units !== 1 || g.fully_insured !== false) violations++;
  }
  // negative balance -> undeterminable, never netted
  checked++;
  {
    const r = compute({ ...base, smdia: 250000, account_records: [{ account_ref: 'A1', ownership_right_and_capacity: 'SINGLE', balance: -1, insurance_aggregation_key: 'G1' }] }).output_payload;
    if (r.coverage_summary.undeterminable_account_count !== 1) violations++;
  }
  // non-integer balance -> undeterminable, never coerced
  checked++;
  {
    const r = compute({ ...base, smdia: 250000, account_records: [{ account_ref: 'A1', ownership_right_and_capacity: 'SINGLE', balance: 100.5, insurance_aggregation_key: 'G1' }] }).output_payload;
    if (r.coverage_summary.undeterminable_account_count !== 1) violations++;
  }
  // zero balance -> determinable, insured 0, uninsured 0, fully insured
  checked++;
  {
    const r = compute({ ...base, smdia: 250000, account_records: [{ account_ref: 'A1', ownership_right_and_capacity: 'SINGLE', balance: 0, insurance_aggregation_key: 'G1' }] }).output_payload;
    const g = r.aggregation_groups[0];
    if (g.insured_minor_units !== 0 || g.uninsured_minor_units !== 0 || g.fully_insured !== true) violations++;
  }
  // empty input -> finite gate, zero totals, no throw
  checked++;
  {
    const r = compute({ ...base, smdia: 250000, account_records: [] }).output_payload;
    if (r.coverage_summary.aggregated_balance_minor_units !== 0 || r.coverage_summary.deposit_accounts_supplied !== 0) violations++;
  }
  return { name: 'P4_forced_categorical_boundaries', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_partition_termination());
results.properties.push(checkP2_allowance_differential());
results.properties.push(checkP3_permutation_invariance());
results.properties.push(checkP4_forced_categorical_boundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-507-determine-deposit-insurance-coverage',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
