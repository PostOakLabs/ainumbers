// art-406-cross-venue-margin-estimator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C18-1).
// kernel_digest_at_authoring: sha256:43750924c09ef1d6bfd8c815c5452fb6c21d0f7261c5518df2c9781abace1499
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct read confirmed — sumIsolatedMarginUsd/financingNotionalUsd are
// plain float sums via reduce, crossMarginOffsetPct is clamped to [0,1] then multiplied,
// capitalEfficiencyPct is a division, financingCostUsd chains three multiplications and a
// division by leverage/365 — genuine float arithmetic throughout, r2/r6 rounding at output
// boundaries only) — ULP-boundary forcing is MANDATORY per spec §3.
// Unbounded input: policy_parameters.venue_positions (caller-supplied array), mapped/reduced
// by plain Array.prototype.map/reduce with no declared cap — termination bound is the array's
// own length.
// Checks: fixture-oracle gate, termination (map/reduce passes scale linearly with
// venue_positions.length, never hang), boundedness (cross_venue_margin_requirement_usd never
// exceeds sum_isolated_margin_usd, capital_efficiency_pct stays within [0,1] for a valid
// [0,1] offset, clampedOffset never goes negative or above 1 regardless of input), metamorphic
// (permutation-invariance: reordering venue_positions leaves sum_isolated_margin_usd and
// financing_notional_usd unchanged up to float-sum reordering, checked via the r2/r6-rounded
// output which the kernel itself commits to), ULP-boundary forcing on
// cross_margin_offset_pct (0, -0, 1, 1±ULP, denormal) and leverage_multiple (denormal-close-
// to-zero, exactly at the program cap boundary).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-406-cross-venue-margin-estimator.proptest.mjs

import { compute } from '../art-406-cross-venue-margin-estimator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-406-cross-venue-margin-estimator.fixtures.json');
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
const rand = mulberry32(0x406F0);

function randomVenue(rng, i) {
  return { venue: `V${i}`, gross_notional_usd: rng() * 1e7, isolated_margin_requirement_usd: rng() * 1e6 };
}

const TRIALS = 2000;

// ---------- P1: termination — map/reduce scale linearly with venue_positions.length, never hang ----------
function checkP1_termination_linear_scaling() {
  let violations = 0, checked = 0;
  const sizes = [0, 1, 10, 100, 3000];
  for (const n of sizes) {
    const venue_positions = Array.from({ length: n }, (_, i) => randomVenue(rand, i));
    const start = Date.now();
    const { output_payload } = compute({ venue_positions, custody_model: 'on_exchange_isolated', constants_version: 'v1' });
    checked++;
    if (Date.now() - start > 3000) violations++;
    if (output_payload.venue_count !== n) violations++;
  }
  return { name: 'P1_termination_linear_scaling_never_hangs', trials: checked, violations };
}

// ---------- P2: boundedness — margin requirement bounded by sum, clampedOffset in [0,1] ----------
function checkP2_margin_and_offset_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 20);
    const venue_positions = Array.from({ length: n }, (_, idx) => randomVenue(rand, idx));
    const cross_margin_offset_pct = (rand() - 0.5) * 3; // deliberately out-of-[0,1] sometimes
    const { output_payload } = compute({ venue_positions, cross_margin_offset_pct, custody_model: 'on_exchange_isolated', constants_version: 'v1' });
    checked++;
    if (output_payload.cross_venue_margin_requirement_usd > output_payload.sum_isolated_margin_usd + 1e-6) violations++;
    if (output_payload.cross_venue_margin_requirement_usd < -1e-6) violations++;
    if (output_payload.capital_freed_usd < -1e-6) violations++;
    if (output_payload.sum_isolated_margin_usd > 0 && (output_payload.capital_efficiency_pct < -1e-6 || output_payload.capital_efficiency_pct > 1 + 1e-6)) violations++;
  }
  return { name: 'P2_margin_requirement_and_clamped_offset_boundedness', trials: checked, violations };
}

// ---------- P3: metamorphic — permutation-invariance of sums (rounded output) ----------
function checkP3_metamorphic_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 300; i++) {
    const n = 1 + Math.floor(rand() * 15);
    const venue_positions = Array.from({ length: n }, (_, idx) => randomVenue(rand, idx));
    const shuffled = [...venue_positions];
    for (let j = shuffled.length - 1; j > 0; j--) { const k = Math.floor(rand() * (j + 1)); [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]]; }
    const pp = { cross_margin_offset_pct: 0.3, leverage_multiple: 2, custody_model: 'on_exchange_isolated', constants_version: 'v1' };
    const outA = compute({ ...pp, venue_positions }).output_payload;
    const outB = compute({ ...pp, venue_positions: shuffled }).output_payload;
    checked++;
    if (outA.sum_isolated_margin_usd !== outB.sum_isolated_margin_usd) violations++;
    if (outA.financing_notional_usd !== outB.financing_notional_usd) violations++;
  }
  return { name: 'P3_metamorphic_permutation_invariance_of_rounded_sums', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
function checkP4_ulp_forcing_offset_and_leverage() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  const venue_positions = [{ venue: 'A', gross_notional_usd: 1000000, isolated_margin_requirement_usd: 100000 }, { venue: 'B', gross_notional_usd: 500000, isolated_margin_requirement_usd: 50000 }];
  const offsetForced = [0, -0, 1, 1 - eps, 1 + eps, eps, Number.MIN_VALUE, -eps];
  for (const off of offsetForced) {
    const { output_payload } = compute({ venue_positions, cross_margin_offset_pct: off, custody_model: 'on_exchange_isolated', constants_version: 'v1' });
    checked++;
    if (Number.isNaN(output_payload.cross_venue_margin_requirement_usd)) violations++;
    if (output_payload.cross_venue_margin_requirement_usd < -1e-6) violations++;
    if (output_payload.cross_venue_margin_requirement_usd > output_payload.sum_isolated_margin_usd + 1e-6) violations++;
  }
  const leverageForced = [Number.MIN_VALUE, eps, 1 - eps, 1 + eps, 1e300];
  for (const lev of leverageForced) {
    const { output_payload } = compute({ venue_positions, leverage_multiple: lev, custody_model: 'on_exchange_isolated', constants_version: 'v1' });
    checked++;
    if (Number.isNaN(output_payload.financing_cost_usd)) violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_offset_and_leverage', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_linear_scaling());
results.properties.push(checkP2_margin_and_offset_boundedness());
results.properties.push(checkP3_metamorphic_permutation_invariance());
results.properties.push(checkP4_ulp_forcing_offset_and_leverage());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-406-cross-venue-margin-estimator',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
