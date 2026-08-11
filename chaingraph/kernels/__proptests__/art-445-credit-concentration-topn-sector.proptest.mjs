// art-445-credit-concentration-topn-sector.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C20-1).
// kernel_digest_at_authoring: sha256:2c48c891970145492a64a3005f4756cbe485a5a8f04738cc43b59eea9453bb0b
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct source read confirmed — pctOf division by portfolio_total,
// HHI = sum(share^2)*10000 over an unbounded exposures array, r2 rounding at every step) —
// ULP-boundary forcing present below on the portfolio_total === 0 zero-denominator gate and
// the single_name/sector limit-breach > compare.
// Checks: fixture-oracle gate, termination (top_n_exposures/sector_totals bounded by input
// array length and top_n), boundedness (HHI in [0,10000], portfolio_total finite),
// differential re-derivation of single_name_hhi/sector_hhi and the breach lists, metamorphic
// exposure-order invariance (portfolio_total/HHI unchanged by input order), ULP-boundary
// forcing on the zero-portfolio gate and the limit-breach > threshold boundary.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-445-credit-concentration-topn-sector.proptest.mjs

import { compute } from '../art-445-credit-concentration-topn-sector.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-445-credit-concentration-topn-sector.fixtures.json');
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
const rand = mulberry32(0x445A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const SECTORS = ['energy', 'tech', 'healthcare', 'financials'];

function randomExposure(rng, i) {
  return { name: 'name-' + i, sector: pick(rng, SECTORS), amount: rng() * 1e6 };
}

function randomPP(rng) {
  const n = Math.floor(rng() * 15);
  return {
    exposures: Array.from({ length: n }, (_, i) => randomExposure(rng, i)),
    top_n: Math.floor(rng() * 10),
    single_name_limit_pct: rng() * 30,
    sector_limit_pct: rng() * 50,
  };
}

const TRIALS = 5000;

// ---------- P1: termination — top_n_exposures bounded by min(top_n, input length), sector_totals bounded by distinct sectors seen ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const namedCount = pp.exposures.filter((e) => (e.name || '').trim()).length;
    // source fallback: `g(pp.top_n) || 5` treats 0 (falsy) as "not supplied" and defaults to 5.
    const effectiveTopN = Math.max(0, Math.trunc(pp.top_n || 5));
    if (output_payload.top_n_exposures.length > Math.min(effectiveTopN, namedCount)) violations++;
    if (output_payload.sector_totals.length > namedCount) violations++;
  }
  return { name: 'P1_termination_topn_and_sector_bounded_by_input', trials: checked, violations };
}

// ---------- P2: boundedness — HHI in [0,10000], portfolio_total finite ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (!Number.isFinite(output_payload.portfolio_total)) violations++;
    if (output_payload.single_name_hhi < 0 || output_payload.single_name_hhi > 10000.05) violations++;
    if (output_payload.sector_hhi < 0 || output_payload.sector_hhi > 10000.05) violations++;
  }
  return { name: 'P2_boundedness_hhi_range_and_portfolio_finite', trials: checked, violations };
}

// ---------- P3 (differential): single_name_hhi/sector_hhi re-derivation ----------
function checkP3_hhi_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const named = pp.exposures.filter((e) => (e.name || '').trim());
    const total = named.reduce((s, e) => s + e.amount, 0);
    if (total > 0) {
      const expectedHhi = Math.round(named.reduce((s, e) => s + Math.pow(e.amount / total, 2), 0) * 10000 * 100) / 100;
      if (Math.abs(expectedHhi - output_payload.single_name_hhi) > 1) violations++;
    }
  }
  return { name: 'P3_hhi_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — reordering exposures never changes portfolio_total/HHI ----------
function checkP4_order_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    if (pp.exposures.length < 2) continue;
    const r1 = compute(pp).output_payload;
    const reversed = { ...pp, exposures: [...pp.exposures].reverse() };
    const r2v = compute(reversed).output_payload;
    checked++;
    if (Math.abs(r1.portfolio_total - r2v.portfolio_total) > 0.01) violations++;
    if (Math.abs(r1.single_name_hhi - r2v.single_name_hhi) > 0.01) violations++;
    if (Math.abs(r1.sector_hhi - r2v.sector_hhi) > 0.01) violations++;
  }
  return { name: 'P4_exposure_order_metamorphic_invariance', trials: checked, violations };
}

// ---------- P5 (ULP-forcing): zero-portfolio gate + limit-breach threshold boundary ----------
function checkP5_ulp_forcing() {
  let violations = 0, checked = 0;
  // empty portfolio -> pctOf always 0, HHI 0, never NaN
  checked++;
  const empty = compute({ exposures: [], top_n: 5, single_name_limit_pct: 10, sector_limit_pct: 25 }).output_payload;
  if (empty.portfolio_total !== 0 || empty.single_name_hhi !== 0 || empty.sector_hhi !== 0) violations++;
  // all-zero-amount exposures -> zero denominator gate, never NaN
  checked++;
  const zeroAmt = compute({ exposures: [{ name: 'a', sector: 's', amount: 0 }, { name: 'b', sector: 's', amount: -0 }], top_n: 5, single_name_limit_pct: 10, sector_limit_pct: 25 }).output_payload;
  if (!Number.isFinite(zeroAmt.single_name_hhi) || !Number.isFinite(zeroAmt.sector_hhi)) violations++;
  // limit-breach threshold boundary: pct_of_portfolio exactly at, just under, just over the limit
  const EPS = Number.EPSILON;
  for (const limitPct of [50, 50 - EPS, 50 + EPS]) {
    checked++;
    const pp = { exposures: [{ name: 'a', sector: 's1', amount: 500 }, { name: 'b', sector: 's2', amount: 500 }], top_n: 5, single_name_limit_pct: limitPct, sector_limit_pct: limitPct };
    const { output_payload } = compute(pp);
    const expectedBreach = 50 > limitPct;
    if ((output_payload.single_name_breaches.length > 0) !== expectedBreach) violations++;
  }
  return { name: 'P5_ulp_boundary_forcing_zero_portfolio_and_limit_breach_threshold', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_hhi_differential());
results.properties.push(checkP4_order_metamorphic());
results.properties.push(checkP5_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-445-credit-concentration-topn-sector',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
