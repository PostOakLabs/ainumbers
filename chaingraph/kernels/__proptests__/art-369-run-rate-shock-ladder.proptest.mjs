// art-369-run-rate-shock-ladder.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C17-1).
// kernel_digest_at_authoring: sha256:de868c58a20dd6f595ff271e2b5eb0aef3b83b50ba4c011b4cb0cbd7adf2e5a8
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (delta_eve/delta_nii shock arithmetic, r2 rounding on every emitted
// number — direct read confirmed) — ULP-boundary forcing is MANDATORY per spec §3.
// Checks: fixture-oracle gate, termination (unbounded shock_presets array — bound is array
// length; the fixed BUCKETS/MAGNITUDES_BPS loops are compile-time bounded, not unbounded),
// boundedness (delta_eve/delta_nii always finite), metamorphic (shock_presets permutation
// invariance of the preset_shocks map and the fixed ladder, since preset_shocks is keyed by
// declared name), ULP-boundary forcing on repricing_gaps/nii_12m_gap.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-369-run-rate-shock-ladder.proptest.mjs

import { compute } from '../art-369-run-rate-shock-ladder.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-369-run-rate-shock-ladder.fixtures.json');
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
const rand = mulberry32(0x369D0);

function randomGaps(rng) {
  return {
    on_1m: Math.round((rng() - 0.5) * 400000),
    m1_y1: Math.round((rng() - 0.5) * 400000),
    y1_y3: Math.round((rng() - 0.5) * 400000),
    y3_y5: Math.round((rng() - 0.5) * 400000),
    y5_y10: Math.round((rng() - 0.5) * 400000),
    y10_plus: Math.round((rng() - 0.5) * 400000),
  };
}

function randomPreset(rng, name) {
  return { name, short_bps: Math.round((rng() - 0.5) * 200), long_bps: Math.round((rng() - 0.5) * 200) };
}

function randomPP(rng, nPresets) {
  const presets = [];
  for (let i = 0; i < nPresets; i++) presets.push(randomPreset(rng, `preset_${i}`));
  return { repricing_gaps: randomGaps(rng), nii_12m_gap: Math.round((rng() - 0.5) * 600000), shock_presets: presets };
}

const TRIALS = 3000;

// ---------- P1: termination — unbounded shock_presets array, bound is array length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  const sizes = [0, 1, 5, 50, 300];
  for (const n of sizes) {
    const pp = randomPP(rand, n);
    const { output_payload } = compute(pp);
    checked++;
    if (Object.keys(output_payload.preset_shocks).length !== n) violations++;
    if (Object.keys(output_payload.ladder).length !== 8) violations++; // 4 magnitudes x 2 dirs, fixed
  }
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 20);
    const pp = randomPP(rand, n);
    const { output_payload } = compute(pp);
    checked++;
    if (Object.keys(output_payload.preset_shocks).length !== n) violations++;
  }
  return { name: 'P1_termination_array_length_bound', trials: checked, violations };
}

// ---------- P2: boundedness — delta_eve/delta_nii always finite ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand, 1 + Math.floor(rand() * 6));
    const { output_payload } = compute(pp);
    checked++;
    for (const k of Object.keys(output_payload.ladder)) {
      const s = output_payload.ladder[k];
      if (!Number.isFinite(s.delta_eve) || !Number.isFinite(s.delta_nii)) violations++;
    }
    for (const k of Object.keys(output_payload.preset_shocks)) {
      const s = output_payload.preset_shocks[k];
      if (!Number.isFinite(s.delta_eve)) violations++;
      if (s.delta_nii !== null) violations++; // non-parallel presets always report delta_nii: null
    }
    if (!Number.isFinite(output_payload.worst_delta_eve)) violations++;
  }
  return { name: 'P2_boundedness_delta_eve_nii_finite', trials: checked, violations };
}

// stable stringify: sorts object keys recursively so a permuted key-insertion order (from a
// reversed input array feeding a name-keyed map) does not itself register as a value diff.
function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const keys = Object.keys(v).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
}

// ---------- P3: metamorphic — shock_presets permutation invariance (name-keyed map, no ties by construction) ----------
function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS / 3; i++) {
    const n = 2 + Math.floor(rand() * 6);
    const pp = randomPP(rand, n);
    const shuffled = { ...pp, shock_presets: [...pp.shock_presets].reverse() };
    const a = compute(pp).output_payload;
    const b = compute(shuffled).output_payload;
    checked++;
    if (stableStringify(a.ladder) !== stableStringify(b.ladder)) violations++;
    if (stableStringify(a.preset_shocks) !== stableStringify(b.preset_shocks)) violations++;
    if (a.total_net_gap !== b.total_net_gap) violations++;
  }
  return { name: 'P3_permutation_invariance_of_preset_shocks_map', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) — repricing_gaps/nii_12m_gap ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  const boundary = [0, -0, eps, -eps, Number.MIN_VALUE, 1e-300];
  for (const v of boundary) {
    const pp = {
      repricing_gaps: { on_1m: v, m1_y1: v, y1_y3: v, y3_y5: v, y5_y10: v, y10_plus: v },
      nii_12m_gap: v,
      shock_presets: [],
    };
    const { output_payload } = compute(pp);
    checked++;
    for (const k of Object.keys(output_payload.ladder)) {
      const s = output_payload.ladder[k];
      if (!Number.isFinite(s.delta_eve) || !Number.isFinite(s.delta_nii)) violations++;
    }
    if (!Number.isFinite(output_payload.total_net_gap)) violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_repricing_gaps_and_nii', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_permutation_invariance());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-369-run-rate-shock-ladder',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
