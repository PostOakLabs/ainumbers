// art-95-circumvention-diligence-assessor.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C12-1).
// kernel_digest_at_authoring: sha256:75587c9e280c8c0b45a80f7846a3c176999cf769b7f62fd36dc96e732b79a75b
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — dd_score/dd_pct are integer weight sums and
// Math.round() integer percentages from a fixed DD_WEIGHTS table; no caller float parameters).
// Unbounded input: `transaction.dd_evidence` is a caller-controlled array of arbitrary length
// and arbitrary string content. The scoring loop is Object.entries(DD_WEIGHTS) (fixed 6
// entries) each doing an Array.some over dd_evidence — bounded by evidence-array length times
// the fixed weight-table size, no recursion.
// Checks: fixture-oracle gate, termination (bounded, no hang on large dd_evidence arrays),
// boundedness (dd_score_pct always in [0,100] since DD_WEIGHTS.some()-based scoring cannot
// exceed MAX_DD_SCORE), a metamorphic idempotence property (duplicating an already-matched
// evidence item does not change dd_score_pct — Array.some is a boolean gate, not a counter,
// so extra duplicate evidence cannot double-count), a metamorphic permutation-invariance
// property (reordering dd_evidence does not change the score), forced categorical boundary
// cases (goods_category boundary for is_controlled_goods, dd_pct exactly at the 75% safe-
// harbour threshold, clause present/absent x DD adequate/inadequate liability-allocation
// matrix).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-95-circumvention-diligence-assessor.proptest.mjs

import { compute } from '../art-95-circumvention-diligence-assessor.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-95-circumvention-diligence-assessor.fixtures.json');
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
const rand = mulberry32(0x95D0);

const EVIDENCE_KEYS = ['kyc_counterparty', 'beneficial_owner_check', 'end_use_certificate', 'diversion_check', 'no_russia_clause', 'transaction_monitoring'];
const GOODS = ['dual_use', 'firearms', 'general_merchandise', 'consumer_goods', 'military_goods'];

function randomPP(rng, evCount) {
  const dd_evidence = [];
  for (let i = 0; i < evCount; i++) dd_evidence.push(EVIDENCE_KEYS[Math.floor(rng() * EVIDENCE_KEYS.length)]);
  return {
    transaction: {
      goods_category: GOODS[Math.floor(rng() * GOODS.length)],
      counterparty_jurisdiction: rng() < 0.3 ? 'ae' : 'us',
      no_russia_clause: rng() < 0.5 ? 'present' : 'absent',
      dd_evidence,
    },
  };
}

const TRIALS = 2000;

// ---------- P1: termination — bounded, no hang on large dd_evidence arrays ----------
function checkP1_termination_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 100; i++) {
    const pp = randomPP(rand, 500 + Math.floor(rand() * 2000));
    const start = Date.now();
    compute(pp);
    checked++;
    if (Date.now() - start > 500) violations++;
  }
  return { name: 'P1_termination_bounded_large_dd_evidence', trials: checked, violations };
}

// ---------- P2: boundedness — dd_score_pct always in [0,100] ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand, Math.floor(rand() * 10));
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.dd_score_pct < 0 || output_payload.dd_score_pct > 100) violations++;
    if (!['A', 'B', 'C', 'D', 'F'].includes(output_payload.diligence_grade)) violations++;
  }
  return { name: 'P2_boundedness_dd_score_pct', trials: checked, violations };
}

// ---------- P3: metamorphic — idempotence (duplicate evidence doesn't change score) + permutation invariance ----------
function checkP3_idempotence_and_permutation() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 500; i++) {
    const pp = randomPP(rand, Math.floor(rand() * 5) + 1);
    const r1 = compute(pp);
    // duplicate every evidence item
    const ppDup = { transaction: { ...pp.transaction, dd_evidence: [...pp.transaction.dd_evidence, ...pp.transaction.dd_evidence] } };
    const r2 = compute(ppDup);
    checked++;
    if (r1.output_payload.dd_score_pct !== r2.output_payload.dd_score_pct) violations++;
    // permutation invariance
    const ppShuffled = { transaction: { ...pp.transaction, dd_evidence: [...pp.transaction.dd_evidence].sort(() => rand() - 0.5) } };
    const r3 = compute(ppShuffled);
    checked++;
    if (r1.output_payload.dd_score_pct !== r3.output_payload.dd_score_pct) violations++;
  }
  return { name: 'P3_metamorphic_idempotence_and_permutation_invariance', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception per spec §3) ----------
function checkP4_categorical_forcing() {
  let violations = 0, checked = 0;
  // full DD evidence + clause present => liability_shifted_to_buyer (dd_pct = 100 >= 75 threshold)
  const fullDD = { transaction: { goods_category: 'dual_use', no_russia_clause: 'present', dd_evidence: EVIDENCE_KEYS } };
  const r1 = compute(fullDD);
  checked++;
  if (r1.output_payload.liability_allocation !== 'liability_shifted_to_buyer') violations++;
  if (r1.output_payload.dd_score_pct !== 100) violations++;
  // clause present, no DD evidence at all => partial_seller_liability (dd_pct < 75)
  const noDD = { transaction: { goods_category: 'dual_use', no_russia_clause: 'present', dd_evidence: [] } };
  const r2 = compute(noDD);
  checked++;
  if (r2.output_payload.liability_allocation !== 'partial_seller_liability') violations++;
  // no clause, no DD => seller_liable
  const r3 = compute({ transaction: { goods_category: 'dual_use', no_russia_clause: 'absent', dd_evidence: [] } });
  checked++;
  if (r3.output_payload.liability_allocation !== 'seller_liable') violations++;
  // non-controlled goods => not_applicable regardless of clause/DD
  const r4 = compute({ transaction: { goods_category: 'general_merchandise', no_russia_clause: 'absent', dd_evidence: [] } });
  checked++;
  if (r4.output_payload.liability_allocation !== 'not_applicable') violations++;
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
results.properties.push(checkP3_idempotence_and_permutation());
results.properties.push(checkP4_categorical_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-95-circumvention-diligence-assessor',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
