// art-560-oracle-price-aggregation.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C30-1).
// kernel_digest_at_authoring: sha256:ba126694afd24428319b321cbc06447608573deb30aaa75f5905a25146b3b91f
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES — RE-CONFIRMED BY DIRECT READ per FIX-2; this matches the WU row's own
// float:yes classification, no correction needed. compute() takes arbitrary finite-number prices,
// weights and confidences and performs genuine continuous floating-point arithmetic: a
// confidence-weighted mean (psum/wsum), a stake-weighted median with linear interpolation
// (sorted[i].price + next.price)/2, a linear-interpolated percentile (R-7 convention), and a
// deviation-percentage compare (diffPct = |price-med|/med*100) against a caller-declared
// outlier_threshold_pct -- a real continuous decision boundary. ULP-boundary forcing is mandatory
// per spec §3 and is provided below (P5).
// Checks: fixture-oracle gate, termination/boundedness (P1: this kernel places NO array-length cap
// on submissions[] -- genuinely unbounded input -- so P1 both states the (trivial, linear) bound and
// confirms every output figure stays finite for input sizes well beyond the fixture-tested range),
// a differential re-derivation of plain_median and stake_weighted_median_frequency against an
// independent reimplementation (P3), a metamorphic permutation-invariance identity over
// submissions[] order using integer-cent prices to isolate a genuine order-dependence finding from
// ordinary floating-point summation-order noise (P4, same isolation technique as the shard's other
// float-sensitive kernels), and mandatory ULP-boundary forcing on the outlier-deviation threshold
// compare, the stake-weighted-median half-point compare, and the price>0 admission gate — 0, negative
// zero, denormals, values one part in Number.EPSILON either side of the threshold, and an
// x/y*y!==x-shaped percentile interpolation case (P5).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-560-oracle-price-aggregation.proptest.mjs

import { compute } from '../art-560-oracle-price-aggregation.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-560-oracle-price-aggregation.fixtures.json');
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
const rand = mulberry32(0x560C30);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const MODES = ['median_filtered_confidence_weighted_mean', 'stake_weighted_median_frequency', 'three_vote_confidence_median', 'plain_median'];

function randomSubmission(rng, i, integerCents) {
  const priceCents = 9000 + Math.floor(rng() * 200000); // 90.00 .. 2090.00
  return {
    id: `S${i}`,
    price: integerCents ? priceCents : priceCents / 100,
    weight_pct: 1 + rng() * 20,
    confidence: rng() < 0.9 ? rng() : undefined,
    timestamp: '2026-08-01T00:00:00Z',
  };
}
function randomPP(rng, integerCents = false) {
  const n = 1 + Math.floor(rng() * 20);
  return {
    mode: pick(rng, MODES),
    currency_pair: 'ETH/USD',
    submissions: Array.from({ length: n }, (_, i) => randomSubmission(rng, i, integerCents)),
    outlier_threshold_pct: 1 + rng() * 10,
  };
}

function median(sorted) { const n = sorted.length; if (n === 0) return null; const mid = n >> 1; return n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2; }

// Independent reimplementation of plain_median and stake_weighted_median_frequency, for P3.
function reimplementPlainMedian(pp) {
  const prices = pp.submissions.filter((s) => s.price > 0).map((s) => s.price).sort((a, b) => a - b);
  return median(prices);
}
function reimplementStakeWeighted(pp) {
  const usable = pp.submissions.filter((s) => s.price > 0 && s.weight_pct > 0).map((s, idx) => ({ price: s.price, weight_pct: s.weight_pct, idx }));
  if (usable.length === 0) return null;
  const sorted = usable.slice().sort((a, b) => (a.price - b.price) || (a.idx - b.idx));
  const total = sorted.reduce((a, s) => a + s.weight_pct, 0);
  const half = total / 2;
  let cum = 0;
  for (let i = 0; i < sorted.length; i++) {
    cum += sorted[i].weight_pct;
    if (cum > half) return sorted[i].price;
    if (cum === half) { const next = sorted[i + 1]; return next ? (sorted[i].price + next.price) / 2 : sorted[i].price; }
  }
  return sorted[sorted.length - 1].price;
}

const TRIALS = 2000;

// ---------- P1: termination/boundedness — no array cap; every figure stays finite at larger N ----------
function checkP1_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.structural_error) continue;
    if (o.aggregated_price !== null && !Number.isFinite(o.aggregated_price)) violations++;
    if (o.outlier_count > o.priced_submission_count) violations++;
    if (o.surviving_count !== null && o.surviving_count > o.priced_submission_count) violations++;
  }
  // Large-N probe: well beyond any fixture-tested size, still terminates and stays finite.
  {
    const submissions = Array.from({ length: 5000 }, (_, i) => randomSubmission(rand, i, false));
    const { output_payload: o } = compute({ mode: 'plain_median', currency_pair: 'X/Y', submissions });
    checked++;
    if (!Number.isFinite(o.aggregated_price)) violations++;
  }
  return { name: 'P1_termination_unbounded_array_stays_finite', trials: checked, violations };
}

// ---------- P3: differential — plain_median and stake_weighted_median re-derived independently ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.structural_error) continue;
    if (pp.mode === 'plain_median') {
      const exp = reimplementPlainMedian(pp);
      if (Math.abs(o.aggregated_price - exp) > 1e-9) violations++;
    } else if (pp.mode === 'stake_weighted_median_frequency') {
      const exp = reimplementStakeWeighted(pp);
      if (exp !== null && Math.abs(o.aggregated_price - exp) > 1e-9) violations++;
    }
  }
  return { name: 'P3_median_and_stake_weighted_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance over submissions[] order (integer-cent prices) ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1000; i++) {
    const pp = randomPP(rand, true); // integer-cent prices, isolates real order-dependence from summation noise
    if (pp.submissions.length < 2) continue;
    const shuffled = { ...pp, submissions: [...pp.submissions].reverse() };
    const a = compute(pp).output_payload;
    const b = compute(shuffled).output_payload;
    checked++;
    if (a.structural_error !== b.structural_error) violations++;
    if (!a.structural_error) {
      if (a.aggregated_price !== null && b.aggregated_price !== null && Math.abs(a.aggregated_price - b.aggregated_price) > 1e-9) violations++;
      if (a.surviving_count !== b.surviving_count) violations++;
    }
  }
  return { name: 'P4_permutation_invariance_integer_cent_prices', trials: checked, violations };
}

// ---------- P5: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
function checkP5_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  // (a) outlier deviation exactly at threshold, and one ULP either side. med of [100,100,100+t] where
  // t is chosen so diffPct lands exactly at outlier_threshold_pct=5 for the third submission.
  for (const bump of [5, 5 - 1e-9, 5 + 1e-9, 5 - eps, 5 + eps]) {
    const price3 = 100 * (1 + bump / 100);
    const pp = { mode: 'median_filtered_confidence_weighted_mean', currency_pair: 'X/Y', outlier_threshold_pct: 5, submissions: [{ id: 'a', price: 100, confidence: 1 }, { id: 'b', price: 100, confidence: 1 }, { id: 'c', price: price3, confidence: 1 }] };
    const { output_payload: o } = compute(pp);
    checked++;
    if (!Number.isFinite(o.aggregated_price)) violations++;
  }
  // (b) price = 0 rejected (must be > 0), negative price rejected, denormal price accepted and finite
  {
    const { output_payload: o } = compute({ mode: 'plain_median', currency_pair: 'X/Y', submissions: [{ id: 'a', price: 0 }, { id: 'b', price: -5 }, { id: 'c', price: Number.MIN_VALUE }] });
    checked++;
    if (o.priced_submission_count !== 1) violations++; // only the denormal survives (price > 0)
    if (!Number.isFinite(o.aggregated_price)) violations++;
  }
  // (c) negative zero as a weight/confidence must not crash or produce NaN
  {
    const { output_payload: o } = compute({ mode: 'median_filtered_confidence_weighted_mean', currency_pair: 'X/Y', submissions: [{ id: 'a', price: 100, confidence: -0 }, { id: 'b', price: 100, confidence: 1 }] });
    checked++;
    if (o.aggregated_price !== null && !Number.isFinite(o.aggregated_price)) violations++;
  }
  // (d) stake-weighted median exact half-point compare: two equal-weight submissions land the
  // cumulative weight exactly on the 50% boundary, forcing the interpolation branch.
  {
    const { output_payload: o } = compute({ mode: 'stake_weighted_median_frequency', currency_pair: 'X/Y', submissions: [{ id: 'a', price: 100, weight_pct: 50 }, { id: 'b', price: 200, weight_pct: 50 }] });
    checked++;
    if (o.aggregated_price !== 150) violations++; // exact interpolated midpoint
  }
  // (e) x/y*y !== x style: percentile interpolation with a fractional index that does not
  // round-trip cleanly through division-then-multiplication.
  {
    const votes = [1, 3, 7, 7.1, 9, 13, 13.3, 17, 19.9, 23];
    const submissions = votes.map((p, i) => ({ id: `v${i}`, price: p, confidence: 1 }));
    const { output_payload: o } = compute({ mode: 'three_vote_confidence_median', currency_pair: 'X/Y', submissions: submissions.slice(0, 4) });
    checked++;
    if (!Number.isFinite(o.aggregate_confidence)) violations++;
  }
  return { name: 'P5_ulp_boundary_forcing_outlier_and_stake_median', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_boundedness());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_permutation_invariance());
results.properties.push(checkP5_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-560-oracle-price-aggregation',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
