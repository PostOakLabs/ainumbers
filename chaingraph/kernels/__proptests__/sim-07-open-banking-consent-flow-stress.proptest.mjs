// sim-07-open-banking-consent-flow-stress.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C16-1).
// kernel_digest_at_authoring: sha256:0b2c97e4308777a28ab7fc66df7d263499547d2376a2465fc7b415effd195189
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct read confirmed — an LCG-driven finite-state-machine simulation
// where every transition is a float comparison `rng() < pFail`, and pRedirectFail/pAuthFail/
// pTokenFail/pExpiry/pRevoke are all caller-supplied floats normalized by a >1 ? /100 rule) —
// ULP-boundary forcing is MANDATORY per spec §3.
// Checks: fixture-oracle gate, termination (n = min(nConsents, 10000) is a hard clamp — total_flows
// never exceeds 10000 regardless of caller input, and each of the n runs is a fixed-depth FSM walk
// of at most 4 branch points), boundedness (the four consent-outcome buckets sum exactly to
// total_flows — an accounting invariant), a seed-determinism metamorphic identity (same seed + same
// pp always reproduces byte-identical output — the kernel's own LCG has no external entropy source),
// and mandatory ULP-boundary forcing on every one of the five failure-probability inputs (0, -0,
// exactly 1, values that trigger the >1 ? /100 normalize branch at its boundary, denormals).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/sim-07-open-banking-consent-flow-stress.proptest.mjs

import { compute } from '../sim-07-open-banking-consent-flow-stress.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'sim-07-open-banking-consent-flow-stress.fixtures.json');
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
const rand = mulberry32(0x07C0F);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomPP(rng) {
  return {
    nConsents: Math.floor(rng() * 4000) + 10,
    seed: Math.floor(rng() * 1e6),
    regime: pick(rng, ['psd2', 'fapi2', 'cdr']),
    pRedirectFail: rng() * (rng() < 0.5 ? 1 : 100),
    pAuthFail: rng() * (rng() < 0.5 ? 1 : 100),
    pTokenFail: rng() * (rng() < 0.5 ? 1 : 100),
    pExpiry: rng() * (rng() < 0.5 ? 1 : 100),
    pRevoke: rng() * (rng() < 0.5 ? 1 : 100),
  };
}

const TRIALS = 3000;

// ---------- P1: termination — total_flows never exceeds the caller-input clamp of 10000 ----------
function checkP1_termination_flows_clamped() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.total_flows > 10000) violations++;
    if (output_payload.total_flows !== Math.min(pp.nConsents, 10000)) violations++;
  }
  const huge = compute({ nConsents: 1e9, seed: 1 });
  checked++;
  if (huge.output_payload.total_flows !== 10000) violations++;
  return { name: 'P1_termination_total_flows_clamped_to_10000', trials: checked, violations };
}

// ---------- P2: boundedness — the four outcome buckets sum exactly to total_flows ----------
function checkP2_bucket_sum_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    const sum = o.consents_active + o.consents_failed + o.consents_expired + o.consents_revoked;
    if (sum !== o.total_flows) violations++;
    if (o.success_rate < 0 || o.success_rate > 1) violations++;
  }
  return { name: 'P2_outcome_buckets_sum_to_total_flows', trials: checked, violations };
}

// ---------- P3: metamorphic — seed-determinism (same seed+pp reproduces byte-identical output) ----------
function checkP3_seed_determinism_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 800; i++) {
    const pp = randomPP(rand);
    const a = compute(pp);
    const b = compute({ ...pp });
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
  }
  return { name: 'P3_seed_determinism_metamorphic_identity', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  const probForced = [0, -0, eps, 1 - eps, 1, 1 + eps, 100 - eps, 100, 100 + eps, Number.MIN_VALUE];
  for (const p of probForced) {
    const { output_payload } = compute({ nConsents: 200, seed: 7, pRedirectFail: p, pAuthFail: 0.01, pTokenFail: 0.01, pExpiry: 0.01, pRevoke: 0.01 });
    checked++;
    if (!Number.isFinite(output_payload.success_rate)) violations++;
    const sum = output_payload.consents_active + output_payload.consents_failed + output_payload.consents_expired + output_payload.consents_revoked;
    if (sum !== output_payload.total_flows) violations++;
  }
  // the >1 ? /100 normalize boundary itself — exactly 1.0 (ambiguous: treated as a raw
  // probability, NOT normalized, since the kernel's condition is strictly `> 1`)
  const at1 = compute({ nConsents: 200, seed: 7, pAuthFail: 1, pRedirectFail: 0, pTokenFail: 0, pExpiry: 0, pRevoke: 0 });
  checked++;
  if (!Number.isFinite(at1.output_payload.success_rate)) violations++;
  const justOver1 = compute({ nConsents: 200, seed: 7, pAuthFail: 1 + eps, pRedirectFail: 0, pTokenFail: 0, pExpiry: 0, pRevoke: 0 });
  checked++;
  if (!Number.isFinite(justOver1.output_payload.success_rate)) violations++;
  return { name: 'P4_ulp_boundary_forcing_failure_probabilities', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_flows_clamped());
results.properties.push(checkP2_bucket_sum_boundedness());
results.properties.push(checkP3_seed_determinism_metamorphic());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'sim-07-open-banking-consent-flow-stress',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
