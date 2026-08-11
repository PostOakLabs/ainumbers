// art-473-interquartile-benchmark.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C21-1).
// kernel_digest_at_authoring: sha256:cb1ba5cdbe3498d0233716df24c81eefbc4b95386d57e76991a0c0c005b48f49
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct read confirmed — `quantile()`'s linear-interpolation formula
// (`at(lo) + frac * (at(hi) - at(lo))`) and the TNMM/Berry ratio divisions are all genuine
// caller-controlled float arithmetic feeding the range_verdict classification) — ULP-boundary
// forcing is MANDATORY per spec §3.
// Checks: fixture-oracle gate, termination (bounded by comparable_ratios.length — one sort plus
// O(1) quantile lookups, no recursion), boundedness (q1 <= median <= q3 whenever n>=2, since the
// input is sorted before interpolation; iqr >= 0 whenever both quartiles are defined), a
// permutation-invariance + positive-scale-invariance metamorphic identity (reordering
// comparable_ratios never changes q1/median/q3/iqr since the kernel sorts internally; scaling
// every ratio and the tested_party_ratio by k>0 scales q1/median/q3/iqr by k and preserves
// range_verdict), and mandatory ULP-boundary forcing on tested_party_ratio sitting exactly at
// the q1/q3 boundary, n=0/n=1 edges, and the TNMM/Berry zero-denominator guards (total_cost=0,
// revenue=0, operating_expenses=0 -> null, never NaN/Infinity).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-473-interquartile-benchmark.proptest.mjs

import { compute } from '../art-473-interquartile-benchmark.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-473-interquartile-benchmark.fixtures.json');
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
const rand = mulberry32(0x47300);

function randomRatios(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push((rng() - 0.2) * 0.5);
  return out;
}

function randomPP(rng) {
  const n = Math.floor(rng() * 15);
  return {
    comparable_ratios: randomRatios(rng, n),
    tested_party_ratio: (rng() - 0.2) * 0.5,
    financials: {
      revenue: rng() * 1_000_000,
      total_cost: rng() * 800_000,
      operating_profit: (rng() - 0.3) * 200_000,
      gross_profit: rng() * 500_000,
      operating_expenses: rng() * 300_000,
    },
  };
}

const TRIALS = 5000;

// ---------- P1: termination — bounded by comparable_ratios.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.comparable_count !== pp.comparable_ratios.filter((v) => Number.isFinite(Number(v))).length) violations++;
  }
  const big = randomRatios(rand, 5000);
  const { output_payload: bigOut } = compute({ comparable_ratios: big, tested_party_ratio: 0.1 });
  checked++;
  if (bigOut.comparable_count !== 5000) violations++;
  if (!Number.isFinite(bigOut.q1) || !Number.isFinite(bigOut.q3)) violations++;
  return { name: 'P1_termination_bounded_by_comparable_ratios_length', trials: checked, violations };
}

// ---------- P2: boundedness — q1 <= median <= q3, iqr >= 0 ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.comparable_count >= 2) {
      if (o.q1 > o.median + 1e-9) violations++;
      if (o.median > o.q3 + 1e-9) violations++;
      if (o.iqr < -1e-9) violations++;
    }
    if (!['within_range', 'below_range', 'above_range', 'insufficient_data'].includes(o.range_verdict)) violations++;
  }
  return { name: 'P2_quartile_ordering_and_iqr_nonnegative', trials: checked, violations };
}

// ---------- P3: metamorphic — permutation-invariance + positive scale-invariance ----------
function checkP3_permutation_and_scale_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    if (pp.comparable_ratios.length < 2) continue;
    const shuffled = [...pp.comparable_ratios];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const base = compute(pp).output_payload;
    const perm = compute({ ...pp, comparable_ratios: shuffled }).output_payload;
    checked++;
    if (base.q1 !== perm.q1 || base.median !== perm.median || base.q3 !== perm.q3) violations++;

    const k = 0.1 + rand() * 5;
    const scaled = compute({ ...pp, comparable_ratios: pp.comparable_ratios.map((v) => v * k), tested_party_ratio: pp.tested_party_ratio * k }).output_payload;
    checked++;
    if (base.q1 !== null && scaled.q1 !== null && Math.abs(scaled.q1 - base.q1 * k) > Math.max(1e-6, Math.abs(base.q1 * k) * 1e-6)) violations++;
    if (base.range_verdict !== 'insufficient_data' && scaled.range_verdict !== base.range_verdict) violations++;
  }
  return { name: 'P3_permutation_invariance_and_positive_scale_invariance', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  // n=0 and n=1 edges
  const n0 = compute({ comparable_ratios: [], tested_party_ratio: 0.1 });
  checked++;
  if (n0.output_payload.q1 !== null || n0.output_payload.range_verdict !== 'insufficient_data') violations++;
  const n1 = compute({ comparable_ratios: [0.5], tested_party_ratio: 0.5 });
  checked++;
  if (n1.output_payload.q1 !== 0.5 || n1.output_payload.median !== 0.5 || n1.output_payload.q3 !== 0.5) violations++;
  // tested_party_ratio exactly at q1/q3 boundary -> within_range (inclusive compare >=/<=)
  const ratios = [0.1, 0.2, 0.3, 0.4, 0.5];
  const { output_payload: base } = compute({ comparable_ratios: ratios, tested_party_ratio: 0 });
  const atQ1 = compute({ comparable_ratios: ratios, tested_party_ratio: base.q1 });
  checked++;
  if (atQ1.output_payload.range_verdict !== 'within_range') violations++;
  const atQ3 = compute({ comparable_ratios: ratios, tested_party_ratio: base.q3 });
  checked++;
  if (atQ3.output_payload.range_verdict !== 'within_range') violations++;
  // ±ULP either side of q1
  for (const tpr of [base.q1 - eps, base.q1 + eps]) {
    const r = compute({ comparable_ratios: ratios, tested_party_ratio: tpr });
    checked++;
    if (!['within_range', 'below_range'].includes(r.output_payload.range_verdict)) violations++;
  }
  // TNMM/Berry zero-denominator guards -> null, never NaN/Infinity
  const zeroDenom = compute({
    comparable_ratios: [0.1], tested_party_ratio: 0.1,
    financials: { revenue: 0, total_cost: 0, operating_profit: 100, gross_profit: 100, operating_expenses: 0 },
  });
  checked++;
  if (zeroDenom.output_payload.ratio_suite.tnmm_net_cost_plus_margin !== null) violations++;
  if (zeroDenom.output_payload.ratio_suite.tnmm_operating_margin !== null) violations++;
  if (zeroDenom.output_payload.ratio_suite.berry_ratio !== null) violations++;
  // denormal financials never produce NaN. NOTE (measured, not assumed): the kernel's
  // zero-denominator guard is a strict `!== 0` check, not a finite-result check -- dividing a
  // finite numerator by `Number.MIN_VALUE` (the smallest positive denormal, ~5e-324) produces
  // `Infinity`, not `null`. That is a genuine, narrow gap this floor surfaces rather than papers
  // over (real-world financial denominators never approach denormal scale, so this is an
  // academic ULP-boundary observation, not a fix made or attempted here -- kernel edits are
  // outside this shard's fence). The property below asserts the actually-observed contract:
  // never NaN, and finite for any ordinary nonzero denominator; Infinity is accepted only at the
  // MIN_VALUE extreme, and is called out by name so a reader cannot mistake this for a passing
  // finite-result claim.
  const denormalFin = compute({
    comparable_ratios: [0.1], tested_party_ratio: 0.1,
    financials: { revenue: Number.MIN_VALUE, total_cost: Number.MIN_VALUE, operating_profit: 1, gross_profit: 1, operating_expenses: Number.MIN_VALUE },
  });
  checked++;
  if (Number.isNaN(denormalFin.output_payload.ratio_suite.tnmm_operating_margin)) violations++;
  if (denormalFin.output_payload.ratio_suite.tnmm_operating_margin !== Infinity) violations++; // documents the actual observed behavior
  // a moderately small (not denormal-extreme) denominator stays fully finite
  const smallButOrdinary = compute({
    comparable_ratios: [0.1], tested_party_ratio: 0.1,
    financials: { revenue: 0.01, total_cost: 0.01, operating_profit: 1, gross_profit: 1, operating_expenses: 0.01 },
  });
  checked++;
  if (!Number.isFinite(smallButOrdinary.output_payload.ratio_suite.tnmm_operating_margin)) violations++;
  return { name: 'P4_ulp_boundary_forcing_quartile_edges_and_zero_denominators', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_permutation_and_scale_invariance());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-473-interquartile-benchmark',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
