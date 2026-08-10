// art-104-tfr-travel-rule-batch-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C2-1).
// kernel_digest_at_authoring: sha256:5d9d7105b7d6a2e1265f3c02ee2c2b2bb573c7d0e5fc816dac04771392117b30
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (integer counts + Math.round percentage only, no continuous thresholds).
// Checks: fixture-oracle gate, termination (array-bounded), boundedness of batch_conformance_pct in
// [0,100], unhosted-DD-required differential re-derivation, and permutation-invariance of the transfer
// batch (including merkle_root, which the kernel itself sorts before hashing).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-104-tfr-travel-rule-batch-validator.proptest.mjs

import { compute } from '../art-104-tfr-travel-rule-batch-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-104-tfr-travel-rule-batch-validator.fixtures.json');
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
const rand = mulberry32(0xA04A2);
function randInt(rng, lo, hi) { return Math.floor(lo + rng() * (hi - lo + 1)); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function randomTransfer(rng, i) {
  const counterparty_type = pick(rng, ['casp', 'unhosted']);
  return {
    transfer_id: `T${i}`,
    originator_name: rng() < 0.8 ? 'Alice' : null,
    originator_account: rng() < 0.8 ? 'ACC1' : null,
    beneficiary_name: rng() < 0.8 ? 'Bob' : null,
    beneficiary_account: rng() < 0.8 ? 'ACC2' : null,
    counterparty_type,
    amount_eur: randInt(rng, 0, 5000),
  };
}

const TRIALS = 4000;

// ---------- P1: termination — batch_size === input length, always ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = randInt(rand, 0, 30);
    const transfer_batch = Array.from({ length: n }, (_, idx) => randomTransfer(rand, idx));
    const { output_payload } = compute({ inputs: { transfer_batch } });
    checked++;
    if (output_payload.batch_size !== n) violations++;
  }
  return { name: 'P1_termination_batch_size', trials: checked, violations };
}

// ---------- P2: boundedness — batch_conformance_pct in [0,100] ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = randInt(rand, 1, 20);
    const transfer_batch = Array.from({ length: n }, (_, idx) => randomTransfer(rand, idx));
    const { output_payload } = compute({ inputs: { transfer_batch } });
    checked++;
    if (output_payload.batch_conformance_pct < 0 || output_payload.batch_conformance_pct > 100) violations++;
    if (!Number.isInteger(output_payload.batch_conformance_pct)) violations++;
  }
  return { name: 'P2_boundedness_conformance_pct_0_100', trials: checked, violations };
}

// ---------- P3 (differential): unhosted_dd_required_count re-derived from batch ----------
function checkP3_dd_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = randInt(rand, 0, 20);
    const tfr_threshold = 1000;
    const transfer_batch = Array.from({ length: n }, (_, idx) => randomTransfer(rand, idx));
    const { output_payload, compliance_flags } = compute({ inputs: { transfer_batch, tfr_threshold } });
    checked++;
    const expected = transfer_batch.filter((t) => t.counterparty_type === 'unhosted' && t.amount_eur > tfr_threshold).length;
    if (output_payload.unhosted_dd_required_count !== expected) violations++;
    if (expected > 0 && !compliance_flags.includes('UNHOSTED_WALLET_DD')) violations++;
    if (expected === 0 && compliance_flags.includes('UNHOSTED_WALLET_DD')) violations++;
  }
  return { name: 'P3_unhosted_dd_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance (aggregate fields + merkle_root, which is pre-sorted) ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const n = randInt(rand, 2, 12);
    const transfer_batch = Array.from({ length: n }, (_, idx) => randomTransfer(rand, idx));
    const r1 = compute({ inputs: { transfer_batch } }).output_payload;
    const r2 = compute({ inputs: { transfer_batch: shuffle(rand, transfer_batch) } }).output_payload;
    checked++;
    if (r1.batch_size !== r2.batch_size) violations++;
    if (r1.batch_conformance_pct !== r2.batch_conformance_pct) violations++;
    if (r1.unhosted_dd_required_count !== r2.unhosted_dd_required_count) violations++;
    if (r1.merkle_root !== r2.merkle_root) violations++;
  }
  return { name: 'P4_permutation_invariance_batch', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_dd_differential());
results.properties.push(checkP4_permutation_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-104-tfr-travel-rule-batch-validator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
