// art-346-compute-experience-mod.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C14-1).
// kernel_digest_at_authoring: sha256:23a53d6a4168ee19c365556e8672f02cf9d36e2f6445a4d2fc8db1c511d953f5
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct read confirmed — the split point/expected-loss/weighting/ballast
// arithmetic is float division, `denominator <= 0` and `mod > 1` / `mod < 1` are float-boundary
// classification decisions) — ULP-boundary forcing is MANDATORY per spec §3.
// Checks: fixture-oracle gate, termination (the claims[] loop is bounded by claims.length, and
// actual_primary_losses/actual_excess_losses are bounded by the sum of incurred losses),
// a differential re-derivation of the primary/excess split invariant (primary + excess ==
// incurred for every non-negative claim, so actual_total_losses == sum of clamped incurred
// losses), a metamorphic permutation-invariance identity (claims order never affects the sums),
// and ULP-boundary forcing on the zero-denominator guard, the weighting_value [0,1] clamp, and
// the mod==1 unity/debit/credit classification boundary.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-346-compute-experience-mod.proptest.mjs

import { compute } from '../art-346-compute-experience-mod.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-346-compute-experience-mod.fixtures.json');
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
const rand = mulberry32(0x346D0);

function randomClaims(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ incurred_losses: Math.round(rng() * 100000 * 100) / 100 });
  return out;
}

function randomPP(rng) {
  const n = Math.floor(rng() * 12);
  return {
    claims: randomClaims(rng, n),
    split_point: Math.round(rng() * 30000 * 100) / 100,
    expected_losses: Math.round(rng() * 150000 * 100) / 100,
    expected_primary_losses: Math.round(rng() * 60000 * 100) / 100,
    weighting_value: rng(),
    ballast_value: Math.round(rng() * 20000 * 100) / 100,
  };
}

const TRIALS = 5000;

// ---------- P1: termination — sums bounded by claims.length / sum of incurred losses ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.claim_count !== pp.claims.length) violations++;
    const sumIncurred = pp.claims.reduce((s, c) => s + Math.max(0, c.incurred_losses), 0);
    if (output_payload.actual_total_losses > sumIncurred + 0.01) violations++;
  }
  return { name: 'P1_termination_sums_bounded_by_claims', trials: checked, violations };
}

// ---------- P2 (differential): primary + excess split invariant re-derivation ----------
function checkP2_split_invariant_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (Math.abs(output_payload.actual_total_losses - (output_payload.actual_primary_losses + output_payload.actual_excess_losses)) > 0.02) violations++;
    const sumIncurred = Math.round(pp.claims.reduce((s, c) => s + Math.max(0, c.incurred_losses), 0) * 100) / 100;
    if (Math.abs(output_payload.actual_total_losses - sumIncurred) > 0.02) violations++;
    if (output_payload.actual_primary_losses < 0 || output_payload.actual_excess_losses < 0) violations++;
  }
  return { name: 'P2_primary_excess_split_invariant', trials: checked, violations };
}

// ---------- P3: metamorphic — permutation-invariance of claims order ----------
function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    const shuffled = [...pp.claims];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const r1 = compute(pp).output_payload;
    const r2v = compute({ ...pp, claims: shuffled }).output_payload;
    checked++;
    if (r1.mod !== r2v.mod) violations++;
    if (r1.actual_primary_losses !== r2v.actual_primary_losses) violations++;
    if (r1.actual_excess_losses !== r2v.actual_excess_losses) violations++;
  }
  return { name: 'P3_permutation_invariance_claims_order', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;

  // zero-denominator guard: expected_primary_losses + ballast_value at/around 0
  const denomEdges = [0, -0, eps, -eps, Number.MIN_VALUE, -Number.MIN_VALUE];
  for (const bv of denomEdges) {
    const pp = { claims: [{ incurred_losses: 1000 }], split_point: 500, expected_losses: 1000, expected_primary_losses: 0, weighting_value: 0.5, ballast_value: bv };
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    const isZeroDenom = (0 + bv) <= 0;
    if (isZeroDenom && !compliance_flags.includes('EXPMOD_ZERO_DENOMINATOR')) violations++;
    if (isZeroDenom && output_payload.mod !== 0) violations++;
    if (!Number.isFinite(output_payload.mod)) violations++;
  }

  // weighting_value [0,1] clamp boundary
  const wEdges = [0, 1, -eps, 1 + eps, -1e-9, 1 + 1e-9, -1, 2];
  for (const w of wEdges) {
    const pp = { claims: [{ incurred_losses: 20000 }], split_point: 10000, expected_losses: 30000, expected_primary_losses: 10000, weighting_value: w, ballast_value: 5000 };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.weighting_value < 0 || output_payload.weighting_value > 1) violations++;
    if (!Number.isFinite(output_payload.mod)) violations++;
  }

  // mod == 1 unity boundary: numerator == denominator exactly
  const unityPP = { claims: [{ incurred_losses: 10000 }], split_point: 10000, expected_losses: 10000, expected_primary_losses: 10000, weighting_value: 1, ballast_value: 0 };
  const { output_payload: uo } = compute(unityPP);
  checked++;
  if (uo.mod !== 1 || uo.rating_class !== 'unity') violations++;
  const justAbove = { ...unityPP, claims: [{ incurred_losses: 10000.01 }] };
  const { output_payload: ao } = compute(justAbove);
  checked++;
  if (ao.mod > 1 && ao.rating_class !== 'debit') violations++;
  if (ao.mod < 1 && ao.rating_class !== 'credit') violations++;

  return { name: 'P4_ulp_boundary_forcing_denominator_clamp_unity', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_split_invariant_differential());
results.properties.push(checkP3_permutation_invariance());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-346-compute-experience-mod',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
