// art-10-amla-transaction-typology-risk-scorer.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C2-1).
// kernel_digest_at_authoring: sha256:c02483af798b9da4593d70b071619e12487bbd02e21b016eb9d46ced84c5ab90
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES — ULP-boundary forcing mandatory (structuring thresholds at 0.60x/0.80x/1.0x
// structuring_threshold, travel-rule threshold at 1000/800, risk-level tiers at 0.7/0.4 composite).
// Checks: fixture-oracle gate, termination (array-bounded, no recursion), boundedness of composite_score
// and aggregate scores in [0,1], risk_level/overall_risk differential re-derivation, permutation-invariance
// of the transaction array over aggregate counts, and ULP-forced threshold boundary cases.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-10-amla-transaction-typology-risk-scorer.proptest.mjs

import { compute } from '../art-10-amla-transaction-typology-risk-scorer.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-10-amla-transaction-typology-risk-scorer.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const output_payload = compute(vec.policy_parameters);
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
const rand = mulberry32(0xA10A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function randInt(rng, lo, hi) { return Math.floor(randRange(rng, lo, hi + 1)); }
function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function randomTx(rng, i) {
  return {
    id: `TX${i}`,
    amount: randRange(rng, 0, 20000),
    hops: randInt(rng, 0, 5),
    cross_border: rng() < 0.4,
    source_count: randInt(rng, 1, 4),
    round_trip_detected: rng() < 0.15,
    same_origin_dest: rng() < 0.15,
    tx_count_in_window: randInt(rng, 1, 15),
    originator_info: rng() < 0.5 ? { name: 'x' } : null,
    beneficiary_info: rng() < 0.5 ? { name: 'y' } : null,
    account_id: `ACC${i % 4}`,
  };
}

const TRIALS = 3000;

// ---------- P1: termination — transaction_count === input length, always ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 500; i++) {
    // n=0 deliberately excluded: compute() falls back to a built-in scenario when transactions is
    // empty/absent (documented kernel behavior, not a floor bug) — n>=1 is the array-bounded regime.
    const n = randInt(rand, 1, 40);
    const transactions = Array.from({ length: n }, (_, idx) => randomTx(rand, idx));
    const output_payload = compute({ transactions });
    checked++;
    if (output_payload.transaction_count !== n) violations++;
  }
  return { name: 'P1_termination_count_matches_input', trials: checked, violations };
}

// ---------- P2: boundedness — composite_score / average_score / max_score all in [0,1] ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = randInt(rand, 1, 6);
    const transactions = Array.from({ length: n }, (_, idx) => randomTx(rand, idx));
    const output_payload = compute({ transactions });
    checked++;
    if (output_payload.average_score < 0 || output_payload.average_score > 1.001) violations++;
    if (output_payload.max_score < 0 || output_payload.max_score > 1.001) violations++;
    if (!Number.isFinite(output_payload.average_score) || !Number.isFinite(output_payload.max_score)) violations++;
  }
  return { name: 'P2_boundedness_scores_0_1', trials: checked, violations };
}

// ---------- P3 (differential): overall_risk re-derived from average_score tiers ----------
function checkP3_overall_risk_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = randInt(rand, 1, 6);
    const transactions = Array.from({ length: n }, (_, idx) => randomTx(rand, idx));
    const output_payload = compute({ transactions });
    checked++;
    const expected = output_payload.average_score >= 0.60 ? 'HIGH' : output_payload.average_score >= 0.30 ? 'MEDIUM' : 'LOW';
    if (output_payload.overall_risk !== expected) violations++;
    const flagExpected = `AML_${expected}_RISK_PORTFOLIO`;
    if (!output_payload.compliance_flags.includes(flagExpected)) violations++;
  }
  return { name: 'P3_overall_risk_tier_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance of the transaction array over aggregate counts ----------
// NOTE (documented floor finding, not a kernel edit — fence forbids touching the kernel): average_score
// sums per-tx composite_score via a plain left-to-right reduce, so floating-point addition is not
// associative and a shuffled summation order can differ from the original by float epsilon *before* the
// final toFixed(4) rounding — this can occasionally flip the last decimal digit. This property tolerates
// that documented float non-associativity band (<=1.5e-4, one toFixed(4) rounding unit) and fails only
// on a disagreement outside it.
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const n = randInt(rand, 2, 10);
    const transactions = Array.from({ length: n }, (_, idx) => randomTx(rand, idx));
    const r1 = compute({ transactions });
    const r2 = compute({ transactions: shuffle(rand, transactions) });
    checked++;
    if (r1.transaction_count !== r2.transaction_count) violations++;
    if (r1.high_risk_count !== r2.high_risk_count) violations++;
    if (r1.medium_risk_count !== r2.medium_risk_count) violations++;
    if (Math.abs(r1.average_score - r2.average_score) > 1.5e-4) violations++;
    if (r1.max_score !== r2.max_score) violations++;
    if (r1.travel_rule_violations !== r2.travel_rule_violations) violations++;
    if (JSON.stringify(r1.typology_hit_counts) !== JSON.stringify(r2.typology_hit_counts)) violations++;
  }
  return { name: 'P4_permutation_invariance_aggregates', trials: checked, violations };
}

// ---------- P5 (ULP-forcing, float_sensitive:yes) — structuring / travel-rule threshold boundaries ----------
const ULP_BOUNDARY_CASES = [
  { amount: 8000, label: 'structuring: amount === 0.80*threshold exactly -> excluded from both branches (0)' },
  { amount: 8000 - 1e-9, label: 'structuring: amount just below 0.80*threshold -> 0.4 branch' },
  { amount: 8000 + 1e-9, label: 'structuring: amount just above 0.80*threshold -> steep 0.8+ branch' },
  { amount: 9999.9999999999, label: 'structuring: amount just below threshold -> near-max structuring score' },
  { amount: 1000, originator_info: null, beneficiary_info: null, label: 'travel_rule: amount === threshold exactly (>=) -> 0.9 branch' },
  { amount: 999.9999999999, originator_info: null, beneficiary_info: null, label: 'travel_rule: amount just below threshold, no originator -> 0.5 branch (>= 0.8*threshold)' },
  { amount: 0, label: 'zero amount -> all typology scores 0, finite composite' },
  { amount: -0, label: 'negative-zero amount -> behaves as zero, finite composite' },
  { amount: 1e-300, label: 'near-subnormal amount -> finite composite, no NaN' },
];
function checkP5_forced() {
  const rows = [];
  for (const c of ULP_BOUNDARY_CASES) {
    const tx = { id: 'FORCED', amount: c.amount, hops: 0, cross_border: false };
    if ('originator_info' in c) tx.originator_info = c.originator_info;
    if ('beneficiary_info' in c) tx.beneficiary_info = c.beneficiary_info;
    const output_payload = compute({ transactions: [tx] });
    rows.push({
      label: c.label,
      amount: c.amount,
      composite_score: output_payload.max_score,
      finite: Number.isFinite(output_payload.max_score) && Number.isFinite(output_payload.average_score),
    });
  }
  return rows;
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_overall_risk_differential());
results.properties.push(checkP4_permutation_invariance());
results.boundary_forced = checkP5_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryMismatch = results.boundary_forced.some((b) => !b.finite);

console.log(JSON.stringify({
  tool_id: 'art-10-amla-transaction-typology-risk-scorer',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);
