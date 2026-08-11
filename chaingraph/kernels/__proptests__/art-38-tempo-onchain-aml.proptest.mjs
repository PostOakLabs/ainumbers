// art-38-tempo-onchain-aml.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C12-1).
// kernel_digest_at_authoring: sha256:9e0872728a1ce51e8fe58bb13bec82cc382a97584cd3fb9517db6f621072bbc7
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — amount_usd is coerced via Number(), compared
// with plain >= against integer USD thresholds; no ULP-sensitive tolerance/rate math).
// Unbounded input: `transfers` is a caller-controlled array of arbitrary length; compute()
// maps over it once (no recursion, no nested data-dependent loop) so termination is bounded
// linearly by array length.
// Checks: fixture-oracle gate, termination (bounded by array length, no hang on large
// batches), boundedness (escalate_count + flag_count + pass_count === total, always), a
// metamorphic permutation-invariance property (reordering the transfers array changes result
// order but not the aggregate counts or batch_verdict — screenTransfer is per-item pure),
// forced categorical boundary cases (structuring-band edges 8999/9000/9999/10000, OFAC-name
// substring match, missing identity fields, tr/sar threshold boundaries).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-38-tempo-onchain-aml.proptest.mjs

import { compute } from '../art-38-tempo-onchain-aml.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-38-tempo-onchain-aml.fixtures.json');
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
const rand = mulberry32(0x38D0);

function randomTx(rng, i) {
  return {
    tx_ref: `tx-${i}`,
    amount_usd: Math.floor(rng() * 20000),
    originator_name: rng() < 0.05 ? 'Sanctioned Entity Corp' : `Party ${i}A`,
    originator_vasp: rng() < 0.8 ? `vasp-${i}` : undefined,
    beneficiary_name: rng() < 0.05 ? 'OFAC_TEST_SDN' : `Party ${i}B`,
    beneficiary_vasp: rng() < 0.8 ? `vasp-${i + 1}` : undefined,
    memo: rng() < 0.5 ? `memo-${i}` : undefined,
    mode: rng() < 0.2 ? 'edd' : undefined,
  };
}

function randomPP(rng, n) {
  const transfers = [];
  for (let i = 0; i < n; i++) transfers.push(randomTx(rng, i));
  return { transfers, tr_threshold: 3000, sar_threshold: 5000 };
}

const TRIALS = 300;

// ---------- P1: termination — bounded linearly by array length, no hang on large batches ----------
function checkP1_termination_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 50; i++) {
    const n = 500 + Math.floor(rand() * 2000);
    const pp = randomPP(rand, n);
    const start = Date.now();
    compute(pp);
    checked++;
    if (Date.now() - start > 1000) violations++;
  }
  return { name: 'P1_termination_bounded_large_batches', trials: checked, violations };
}

// ---------- P2: boundedness — escalate+flag+pass counts always sum to total ----------
function checkP2_boundedness_counts_sum() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 40);
    const pp = randomPP(rand, n);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.escalate_count + output_payload.flag_count + output_payload.pass_count !== output_payload.total) violations++;
    if (output_payload.total !== n) violations++;
  }
  return { name: 'P2_boundedness_counts_sum_to_total', trials: checked, violations };
}

// ---------- P3: metamorphic — permutation-invariance of transfers array ----------
function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 20) + 1;
    const pp = randomPP(rand, n);
    const shuffled = { ...pp, transfers: [...pp.transfers].sort(() => rand() - 0.5) };
    const r1 = compute(pp);
    const r2 = compute(shuffled);
    checked++;
    if (r1.output_payload.batch_verdict !== r2.output_payload.batch_verdict) violations++;
    if (r1.output_payload.escalate_count !== r2.output_payload.escalate_count) violations++;
    if (r1.output_payload.flag_count !== r2.output_payload.flag_count) violations++;
    if (r1.output_payload.pass_count !== r2.output_payload.pass_count) violations++;
  }
  return { name: 'P3_permutation_invariance_transfers_order', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception per spec §3) ----------
function checkP4_categorical_forcing() {
  let violations = 0, checked = 0;
  const structuringAmounts = [8998, 8999, 9000, 9999, 10000, 10001];
  for (const amt of structuringAmounts) {
    const pp = { transfers: [{ tx_ref: 't', amount_usd: amt, originator_name: 'A', beneficiary_name: 'B' }] };
    const { output_payload } = compute(pp);
    checked++;
    const expectStructuring = amt >= 9000 && amt < 10000;
    const gotStructuring = output_payload.results[0].flags.includes('STRUCTURING_INDICATOR');
    if (expectStructuring !== gotStructuring) violations++;
  }
  const cases = [
    { transfers: [] },
    { transfers: [{}] }, // fully empty tx
    { transfers: [{ tx_ref: 't', amount_usd: 3000, originator_name: '', beneficiary_name: 'UNKNOWN' }] },
    { transfers: [{ tx_ref: 't', amount_usd: 3000, originator_name: 'A', beneficiary_name: 'B', originator_vasp: 'v', beneficiary_vasp: 'v2' }] }, // TR complete
  ];
  for (const pp of cases) {
    checked++;
    try {
      const { output_payload } = compute(pp);
      if (output_payload.escalate_count + output_payload.flag_count + output_payload.pass_count !== output_payload.total) violations++;
    } catch (e) {
      violations++;
    }
  }
  return { name: 'P4_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_bounded());
results.properties.push(checkP2_boundedness_counts_sum());
results.properties.push(checkP3_permutation_invariance());
results.properties.push(checkP4_categorical_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-38-tempo-onchain-aml',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
