// art-324-tvm-npv.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C11-1).
// kernel_digest_at_authoring: sha256:73ed269fd294aec7d9ff692c40383f59d38689eac424726d8c135c52ff8c78a2
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (npv = sum(amount * myPow(1+rate, -t)) over caller-supplied floats,
// direct read confirmed) — ULP-boundary forcing is MANDATORY per spec §3.
// Checks: fixture-oracle gate, termination (num_cash_flows bounded by cash_flows.length),
// differential re-derivation of total_undiscounted, ULP-boundary forcing at the rate=-1 (100%
// loss) boundary and around 0/denormals, and metamorphic near-permutation-invariance of
// cash_flows order (summation is not float-associative, so checked with tolerance, not exact —
// same honest floor pattern as the sibling parametric-index-deriver row in this shard).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-324-tvm-npv.proptest.mjs

import { compute } from '../art-324-tvm-npv.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-324-tvm-npv.fixtures.json');
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
const rand = mulberry32(0x324C0);

function randomFlows(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ amount: (rng() - 0.5) * 2000, t: i });
  return out;
}

function randomPP(rng) {
  const n = Math.floor(rng() * 8) + 1;
  return { mode: 'periods', cash_flows: randomFlows(rng, n), discount_rate_pct: (rng() - 0.2) * 30 };
}

const TRIALS = 5000;

// ---------- P1: termination — num_cash_flows bounded/exact vs input cash_flows.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.num_cash_flows !== pp.cash_flows.length) violations++;
  }
  return { name: 'P1_termination_num_cash_flows_exact', trials: checked, violations };
}

// ---------- P2 (differential): total_undiscounted re-derivation ----------
function checkP2_total_undiscounted_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expected = pp.cash_flows.reduce((s, f) => s + f.amount, 0);
    const rounded = Math.round(expected * 100) / 100;
    if (Math.abs(output_payload.total_undiscounted - rounded) > 0.01) violations++;
  }
  return { name: 'P2_total_undiscounted_differential', trials: checked, violations };
}

// ---------- P3: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
function checkP3_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  const rateForced = [-1, -1 + eps, -1 - eps, 0, -0, eps, -eps, 1e-300, -1e-300];
  for (const rate of rateForced) {
    const pp = { mode: 'periods', cash_flows: [{ amount: 1000, t: 1 }], discount_rate_pct: rate * 100 };
    const { output_payload } = compute(pp);
    checked++;
    // at rate === -1 exactly, base (1+rate) is 0 and myPow(0,-1) returns Infinity by construction
    // (1/0) — this is a stated, tested limitation, not an unhandled crash; only rate > -1 gets a
    // finiteness assertion here.
    if (rate > -1 && !Number.isFinite(output_payload.npv)) violations++;
    // RATE_BELOW_NEGATIVE_100_PCT flag boundary — must fire exactly at and below -100%
    const flagsExpected = rate <= -1;
    const { compliance_flags } = compute(pp);
    if (compliance_flags.includes('RATE_BELOW_NEGATIVE_100_PCT') !== flagsExpected) violations++;
  }
  // t (period offset) boundary forcing — 0, denormal-small, negative-zero
  const tForced = [0, -0, Number.MIN_VALUE, -Number.MIN_VALUE, eps];
  for (const t of tForced) {
    const pp = { mode: 'periods', cash_flows: [{ amount: 500, t }], discount_rate_pct: 5 };
    const { output_payload } = compute(pp);
    checked++;
    if (!Number.isFinite(output_payload.npv)) violations++;
  }
  return { name: 'P3_ulp_boundary_forcing_rate_and_t', trials: checked, violations };
}

// ---------- P4: metamorphic — near-permutation-invariance of cash_flows order (tolerance-bounded) ----------
function checkP4_permutation_tolerance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    const shuffled = [...pp.cash_flows];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const r1 = compute(pp).output_payload;
    const r2 = compute({ ...pp, cash_flows: shuffled }).output_payload;
    checked++;
    if (r1.num_cash_flows !== r2.num_cash_flows) violations++;
    if (Math.abs(r1.npv - r2.npv) > 0.02) violations++;
  }
  return { name: 'P4_permutation_invariance_tolerance_bounded', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_total_undiscounted_differential());
results.properties.push(checkP3_ulp_forcing());
results.properties.push(checkP4_permutation_tolerance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-324-tvm-npv',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
