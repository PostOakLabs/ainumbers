// art-541-best-execution-recompute.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C28-1).
// kernel_digest_at_authoring: sha256:3fe3f8f91aee95249b6c690837eac8476621b70688946d1417dda593e4c1915c
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (matches the WU row, direct read confirms). computeFill() divides
// (nbbo_ask - execution_price)/nbbo_ask*10000 (buy) or (execution_price - nbbo_bid)/nbbo_bid*10000
// (sell) -- real IEEE-754 division and multiplication -- and at_or_better gates on the raw
// price_improvement_bps>=0 threshold before r2 rounding is applied for display. avg_price_
// improvement_bps sums and divides scored fills, another real division. ULP-boundary forcing
// is mandatory around the price_improvement_bps===0 (execution_price===NBBO leg exactly)
// at_or_better threshold.
// Checks: fixture-oracle gate, termination (fill_count bounded by FILL_SET_CEILING=5000,
// truncation flag correctly set), boundedness (pct_at_or_better in [0,100] or null,
// scored_count+rejected_count===fill_count), differential re-derivation of price-improvement
// and at_or_better classification, permutation-invariance of fills order (fill_count/
// scored_count/rejected_count/pct_at_or_better are exact integer-ratio aggregates and are
// order-independent by construction; avg_price_improvement_bps is a floating SUM of already-
// rounded per-fill bps and a direct probe found a genuine +/-0.01 order-dependent difference in
// ~0.8% of trials -- IEEE-754 addition is not associative, disclosed here rather than papered
// over, and compared with a 0.01 tolerance), and ULP-boundary forcing around the
// price_improvement_bps===0 threshold plus extreme/denormal NBBO values (0, negative zero,
// denormal, x/y*y!==x cases).
// Zero external dependencies -- pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-541-best-execution-recompute.proptest.mjs

import { compute } from '../art-541-best-execution-recompute.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-541-best-execution-recompute.fixtures.json');
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
const rand = mulberry32(0x54100028);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomFill(rng) {
  const side = pick(rng, ['buy', 'sell', 'buy', 'sell', undefined]);
  const nbbo_bid = 5 + rng() * 100;
  const nbbo_ask = nbbo_bid + rng() * 2;
  const execution_price = rng() < 0.1 ? -1 : (nbbo_bid + (rng() - 0.5) * 4);
  return { side, execution_price, nbbo_bid, nbbo_ask, quantity: Math.floor(rng() * 1000) };
}
function randomPP(rng) {
  const n = Math.floor(rng() * 12);
  return { fills: Array.from({ length: n }, () => randomFill(rng)) };
}

const TRIALS = 3000;

// ---------- P1: termination -- fill_count bounded by FILL_SET_CEILING, truncation flag correct ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  const CEILING = 5000;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expectedTruncated = pp.fills.length > CEILING;
    if (output_payload.fill_count !== Math.min(pp.fills.length, CEILING)) violations++;
    if (output_payload.fill_set_truncated !== expectedTruncated) violations++;
    if (output_payload.scored_count + output_payload.rejected_count !== output_payload.fill_count) violations++;
  }
  return { name: 'P1_fill_count_bounded_by_ceiling_and_truncation_flag', trials: checked, violations };
}

// ---------- P2: boundedness -- pct_at_or_better in [0,100] or null; totals finite ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const pct = output_payload.pct_at_or_better;
    if (pct !== null && (pct < 0 || pct > 100 || !Number.isFinite(pct))) violations++;
    if (output_payload.avg_price_improvement_bps !== null && !Number.isFinite(output_payload.avg_price_improvement_bps)) violations++;
    for (const f of output_payload.fills) {
      if (f.price_improvement_bps !== null && !Number.isFinite(f.price_improvement_bps)) violations++;
    }
  }
  return { name: 'P2_pct_and_avg_bounded_and_finite', trials: checked, violations };
}

// ---------- P3 (differential): price-improvement and at_or_better re-derived from the RAW
// (unrounded) caller-supplied fill values -- output_payload.fills[*].execution_price/nbbo_bid/
// nbbo_ask are r2()-rounded display copies, not the values the kernel actually divided, so the
// re-derivation must read pp.fills[i] (index-aligned 1:1, unshuffled) rather than the output. ----
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    for (let idx = 0; idx < output_payload.fills.length; idx++) {
      const f = output_payload.fills[idx];
      const raw = pp.fills[idx];
      if (f.rejection_reason !== null) continue;
      const expectedBps = raw.side === 'buy'
        ? (raw.nbbo_ask - raw.execution_price) / raw.nbbo_ask * 10000
        : (raw.execution_price - raw.nbbo_bid) / raw.nbbo_bid * 10000;
      const expectedRounded = Math.round(expectedBps * 100) / 100;
      if (f.price_improvement_bps !== expectedRounded) violations++;
      if (f.at_or_better !== (expectedBps >= 0)) violations++;
    }
  }
  return { name: 'P3_price_improvement_and_at_or_better_differential', trials: checked, violations };
}

// ---------- P4: metamorphic -- permutation-invariance of fills order. fill_count/scored_count/
// rejected_count/pct_at_or_better are exact integer-ratio aggregates (order-independent by
// construction, confirmed exact across 1200 trials). avg_price_improvement_bps is a floating
// SUM over already-rounded per-fill bps divided then rounded -- IEEE-754 addition is not
// associative, and a direct probe (documented here, not papered over) found a genuine +/-0.01
// order-dependent difference in 9/1183 trials at these magnitudes; that field is compared with
// a 0.01 tolerance, the exact cent this kernel's own summation order can move by. ----
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1200; i++) {
    const pp = randomPP(rand);
    if (pp.fills.length < 2) continue;
    const shuffled = { fills: [...pp.fills].sort(() => rand() - 0.5) };
    const r1 = compute(pp).output_payload;
    const r2v = compute(shuffled).output_payload;
    checked++;
    if (r1.fill_count !== r2v.fill_count) violations++;
    if (r1.scored_count !== r2v.scored_count) violations++;
    if (r1.rejected_count !== r2v.rejected_count) violations++;
    if (r1.pct_at_or_better !== r2v.pct_at_or_better) violations++;
    const avg1 = r1.avg_price_improvement_bps, avg2 = r2v.avg_price_improvement_bps;
    if ((avg1 === null) !== (avg2 === null)) violations++;
    else if (avg1 !== null && Math.abs(avg1 - avg2) > 0.01 + 1e-9) violations++;
  }
  return { name: 'P4_fills_order_invariance_aggregate_stats_tolerant_avg', trials: checked, violations };
}

// ---------- P5: ULP-boundary forcing around the price_improvement_bps===0 threshold ----------
function checkP5_ulp_boundary_forcing() {
  let violations = 0, checked = 0;
  const mkBuy = (execution_price, nbbo_ask) => ({ fills: [{ side: 'buy', execution_price, nbbo_bid: nbbo_ask - 1, nbbo_ask, quantity: 10 }] });
  const mkSell = (execution_price, nbbo_bid) => ({ fills: [{ side: 'sell', execution_price, nbbo_bid, nbbo_ask: nbbo_bid + 1, quantity: 10 }] });

  // exact boundary: execution_price === nbbo_ask (buy) -> bps===0, at_or_better true
  checked++;
  {
    const r = compute(mkBuy(10, 10)).output_payload;
    if (r.fills[0].price_improvement_bps !== 0 || r.fills[0].at_or_better !== true) violations++;
  }
  // one ULP better than the ask (buy) -> still at_or_better true
  checked++;
  {
    const r = compute(mkBuy(10 * (1 - Number.EPSILON), 10)).output_payload;
    if (r.fills[0].at_or_better !== true) violations++;
  }
  // exact boundary: execution_price === nbbo_bid (sell) -> bps===0, at_or_better true
  checked++;
  {
    const r = compute(mkSell(10, 10)).output_payload;
    if (r.fills[0].price_improvement_bps !== 0 || r.fills[0].at_or_better !== true) violations++;
  }
  // denormal NBBO leg (still >0, so accepted) -> never throws, never NaN/Infinity leaked
  checked++;
  {
    const r = compute(mkBuy(Number.MIN_VALUE, Number.MIN_VALUE)).output_payload;
    if (r.fills[0].price_improvement_bps !== null && !Number.isFinite(r.fills[0].price_improvement_bps)) violations++;
  }
  // negative-zero-adjacent execution_price relative to a tiny ask -> never throws
  checked++;
  {
    const r = compute(mkBuy(-0, 0.0001)).output_payload;
    if (r.fills[0].rejection_reason !== 'INVALID_EXECUTION_PRICE') violations++; // execution_price<=0 rejected by design
  }
  // x/y*y !== x shaped nbbo_ask/execution_price pair -> resolves finite, never throws
  checked++;
  {
    const x = 0.1, y = 3;
    const derived = (x / y) * y;
    const ask = 10 + (derived - x);
    const r = compute(mkBuy(10, ask)).output_payload;
    if (r.fills[0].price_improvement_bps !== null && !Number.isFinite(r.fills[0].price_improvement_bps)) violations++;
  }
  return { name: 'P5_ulp_boundary_forcing_price_improvement_zero_threshold', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_permutation_invariance());
results.properties.push(checkP5_ulp_boundary_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-541-best-execution-recompute',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
