// art-216-trid-tolerance-cure.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C7-1).
// kernel_digest_at_authoring: sha256:9be448c7f2f02ca2d2b223550734fe431b0dacf6d93db36ccae0cb6963e83cb3
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES — decimal money comparisons against fixed tolerances (0.005 rounding
// slack, the 10% cumulative bucket threshold).
// Checks: fixture-oracle gate, termination (bounded by fees.length), boundedness (cure_amount
// and ten_pct_excess never negative), an independent differential re-derivation of cure_amount
// from the raw fee list, permutation-invariance of the aggregate outputs under fee reordering,
// ULP-boundary forcing at the zero-tolerance $0.005 slack and the 10% threshold edge, and that
// the 10% verdict follows the bucket AGGREGATES rather than the sum of positive per-fee
// increases (P6, the ART216-AGGREGATE-TOLERANCE-1 regression).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-216-trid-tolerance-cure.proptest.mjs

import { compute } from '../art-216-trid-tolerance-cure.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-216-trid-tolerance-cure.fixtures.json');
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
const rand = mulberry32(0x216A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const BUCKETS = ['zero_tolerance', 'ten_pct_cumulative', 'no_tolerance_limit'];

function r2(v) { return Math.round(v * 100) / 100; }

function randomFees(rng, n) {
  const fees = [];
  for (let i = 0; i < n; i++) {
    const le = r2(rng() * 5000);
    const cd = r2(le + (rng() - 0.3) * 1000);
    fees.push({
      name: `fee_${i}`,
      bucket: pick(rng, BUCKETS),
      le_amount: le,
      cd_amount: Math.max(0, cd),
      changed_circumstance: rng() < 0.1,
    });
  }
  return fees;
}

// Independent reference re-derivation of cure_amount, built from the raw fee list. The 10%
// bucket leg is AGGREGATE-TO-AGGREGATE (§1026.19(e)(3)(ii)(A)): sum the bucket's CD amounts and
// its LE amounts separately and compare the difference against 10% of the LE sum. It is
// deliberately NOT the sum of the positive per-fee increases -- that quantity ignores fee
// decreases and over-reports (ART216-AGGREGATE-TOLERANCE-1).
function referenceCure(fees) {
  let zeroSum = 0, tenLe = 0, tenCd = 0;
  for (const f of fees) {
    if (f.changed_circumstance) continue;
    const inc = r2(f.cd_amount - f.le_amount);
    if (f.bucket === 'zero_tolerance') {
      if (inc > 0.005) zeroSum += inc;
    } else if (f.bucket === 'ten_pct_cumulative') {
      tenLe += f.le_amount;
      tenCd += f.cd_amount;
    }
  }
  const threshold = r2(tenLe * 0.10);
  const excess = r2(Math.max(0, r2(tenCd - tenLe) - threshold));
  return r2(zeroSum + excess);
}

const TRIALS = 5000;

// ---------- P1: termination — always resolves for any fee-array length up to a bound ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 30);
    const fees = randomFees(rand, n);
    const { output_payload: o } = compute({ fees });
    checked++;
    if (o.fee_analysis.length !== n) violations++;
    if (o.violations.length > n + 1) violations++; // at most one violation per fee + one aggregate
  }
  return { name: 'P1_termination_bounded_by_fees_length', trials: checked, violations };
}

// ---------- P2: boundedness — cure_amount / excess / threshold never negative ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 20);
    const fees = randomFees(rand, n);
    const { output_payload: o } = compute({ fees });
    checked++;
    if (o.cure_amount < 0) violations++;
    if (o.ten_pct_excess < 0) violations++;
    if (o.ten_pct_threshold < 0) violations++;
    if (o.cure_required !== (o.total_violations > 0)) violations++;
  }
  return { name: 'P2_cure_and_excess_never_negative', trials: checked, violations };
}

// ---------- P3 (differential): cure_amount matches an independent re-derivation ----------
function checkP3_differentialCure() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 20);
    const fees = randomFees(rand, n);
    const { output_payload: o } = compute({ fees });
    checked++;
    const ref = referenceCure(fees);
    if (Math.abs(o.cure_amount - ref) > 0.01) violations++;
  }
  return { name: 'P3_differential_cure_amount_matches_independent_derivation', trials: checked, violations };
}

// ---------- P4 (metamorphic): permutation-invariance of aggregate outputs under fee reordering ----------
// Note: reducer sums (le_amount/increase) are floating-point-addition order-dependent, so exact
// equality is not guaranteed at the cent level near a rounding boundary -- allow a 1-cent tolerance
// rather than requiring bit-exact identity (a known, documented floating-point non-associativity gap,
// not a kernel defect).
function checkP4_permutationInvariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const n = Math.floor(rand() * 15);
    const fees = randomFees(rand, n);
    const shuffled = [...fees];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const a = compute({ fees }).output_payload;
    const b = compute({ fees: shuffled }).output_payload;
    checked++;
    if (Math.abs(a.cure_amount - b.cure_amount) > 0.01) violations++;
    if (a.cure_required !== b.cure_required) violations++;
    if (a.total_violations !== b.total_violations) violations++;
    if (Math.abs(a.ten_pct_bucket_le_sum - b.ten_pct_bucket_le_sum) > 0.01) violations++;
  }
  return { name: 'P4_permutation_invariance_of_aggregate_outputs', trials: checked, violations };
}

// ---------- P5 (ULP-forcing, float:yes): $0.005 slack and 10% threshold boundaries ----------
function checkP5_ulpForcing() {
  let violations = 0, checked = 0;
  const cases = [
    // exactly at the $0.005 zero-tolerance slack -- must NOT violate
    { fees: [{ name: 'f', bucket: 'zero_tolerance', le_amount: 100, cd_amount: 100.005 }] },
    // just over the slack -- MUST violate
    { fees: [{ name: 'f', bucket: 'zero_tolerance', le_amount: 100, cd_amount: 100.006 }] },
    // exactly at the 10% threshold -- must NOT violate (excess === 0)
    { fees: [{ name: 'f', bucket: 'ten_pct_cumulative', le_amount: 1000, cd_amount: 1100 }] },
    // just over the 10% threshold -- MUST violate
    { fees: [{ name: 'f', bucket: 'ten_pct_cumulative', le_amount: 1000, cd_amount: 1100.01 }] },
    // zero and negative-zero amounts
    { fees: [{ name: 'f', bucket: 'zero_tolerance', le_amount: 0, cd_amount: -0 }] },
    // denormal-scale amounts
    { fees: [{ name: 'f', bucket: 'ten_pct_cumulative', le_amount: 1e-300, cd_amount: 2e-300 }] },
  ];
  for (const c of cases) {
    checked++;
    const { output_payload: o } = compute(c);
    if (!Number.isFinite(o.cure_amount)) violations++;
    if (o.cure_amount < 0) violations++;
  }
  // exact-slack case must not be flagged a violation
  const exact = compute(cases[0]).output_payload;
  if (exact.zero_tolerance_violations !== 0) violations++;
  const over = compute(cases[1]).output_payload;
  if (over.zero_tolerance_violations !== 1) violations++;
  const atThresh = compute(cases[2]).output_payload;
  if (atThresh.ten_pct_violation !== false) violations++;
  const overThresh = compute(cases[3]).output_payload;
  if (overThresh.ten_pct_violation !== true) violations++;
  return { name: 'P5_ulp_boundary_forcing_slack_and_threshold', trials: checked, violations };
}

// ---------- P6: the 10% verdict is a function of the AGGREGATES, never of the positive increases ----------
// Discriminating property for ART216-AGGREGATE-TOLERANCE-1: the pre-fix kernel summed only the
// positive per-fee increases, so a bucket whose aggregate FELL could still be flagged. Here the
// bucket totals are recomputed from the raw fee list and the verdict is required to agree with
// them -- including the direction check that no bucket whose CD total is at or below its LE total
// may ever be a violation.
function checkP6_verdictFollowsAggregates() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 20);
    const fees = randomFees(rand, n);
    const { output_payload: o } = compute({ fees });
    checked++;
    let le = 0, cd = 0;
    for (const f of fees) {
      if (f.changed_circumstance || f.bucket !== 'ten_pct_cumulative') continue;
      le += f.le_amount; cd += f.cd_amount;
    }
    const expectedExcess = r2(Math.max(0, r2(cd - le) - r2(le * 0.10)));
    if (Math.abs(o.ten_pct_excess - expectedExcess) > 0.01) violations++;
    if (o.ten_pct_violation !== (expectedExcess > 0.005)) violations++;
    // direction check: aggregate did not rise => never a violation
    if (cd <= le && o.ten_pct_violation) violations++;
  }
  return { name: 'P6_ten_pct_verdict_follows_bucket_aggregates', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_differentialCure());
results.properties.push(checkP4_permutationInvariance());
results.properties.push(checkP5_ulpForcing());
results.properties.push(checkP6_verdictFollowsAggregates());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-216-trid-tolerance-cure',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
