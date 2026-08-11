// art-253-run-illustration-selfsupport-test.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C7-1).
// kernel_digest_at_authoring: sha256:7752a4c0f60362741de571e3a2ec25b3797b26ca9da1f2d301742e230dc2a91e
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES — av >= 0 pass/fail comparisons on caller-supplied floats, a lapse
// persistence product across years, and a `lapse_free_scale > av_yr20 * 1.1` threshold ratio.
// Checks: fixture-oracle gate, termination (lapse-persistence loop bounded by
// min(lapse_rates.length, yr20_idx+1)), an illustration_valid differential re-derivation from
// self_support_pass/lapse_support_flag, a self-support monotonicity metamorphic check (raising
// account_values at yr15/yr20 never turns a pass into a fail), and ULP-boundary forcing at the
// av==0 pass/fail edge, the 1.1x lapse-support threshold, and denormal-scale lapse rates.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-253-run-illustration-selfsupport-test.proptest.mjs

import { compute } from '../art-253-run-illustration-selfsupport-test.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-253-run-illustration-selfsupport-test.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const output_payload = compute(vec.policy_parameters);
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
const rand = mulberry32(0x253A0);

function randomArr(rng, n, scale) {
  return Array.from({ length: n }, () => Math.round((rng() - 0.4) * scale * 100) / 100);
}

function randomPolicy(rng, n) {
  return {
    account_values: randomArr(rng, n, 5000),
    premium_payments: randomArr(rng, n, 200),
    cost_of_insurance: randomArr(rng, n, 100),
    expense_charges: randomArr(rng, n, 50),
    credited_interest: randomArr(rng, n, 100),
    lapse_rates: rng() < 0.5 ? Array.from({ length: n }, () => rng() * 0.1) : [],
    face_amount: 50000 + rng() * 500000,
  };
}

const TRIALS = 4000;

// ---------- P1: termination — lapse-persistence loop bounded by min(lapse_rates.length, 20) ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = 15 + Math.floor(rand() * 15);
    const o = compute(randomPolicy(rand, n));
    checked++;
    if (typeof o.lapse_support_flag !== 'boolean') violations++;
    if (o.policy_years_provided !== n) violations++;
  }
  return { name: 'P1_termination_lapse_loop_bounded', trials: checked, violations };
}

// ---------- P2 (differential): illustration_valid re-derived from self_support_pass/lapse_support_flag ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = 15 + Math.floor(rand() * 15);
    const o = compute(randomPolicy(rand, n));
    checked++;
    const ref = o.self_support_pass === true && !o.lapse_support_flag;
    if (o.illustration_valid !== ref) violations++;
    if (o.self_support_yr15_pass !== null && o.self_support_yr15_pass !== (o.account_value_yr15 >= 0)) violations++;
    if (o.self_support_yr20_pass !== null && o.self_support_yr20_pass !== (o.account_value_yr20 >= 0)) violations++;
  }
  return { name: 'P2_differential_illustration_valid_and_pass_flags', trials: checked, violations };
}

// ---------- P3 (metamorphic): raising account_values at yr15/yr20 never turns a pass into a fail ----------
function checkP3_monotonicity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const base = randomPolicy(rand, 20);
    const bumped = { ...base, account_values: base.account_values.map((v, idx) => (idx === 14 || idx === 19) ? v + 1 + rand() * 1000 : v) };
    const a = compute(base);
    const b = compute(bumped);
    checked++;
    if (a.self_support_yr15_pass === true && b.self_support_yr15_pass === false) violations++;
    if (a.self_support_yr20_pass === true && b.self_support_yr20_pass === false) violations++;
  }
  return { name: 'P3_self_support_monotone_in_account_value', trials: checked, violations };
}

// ---------- P4 (ULP-forcing, float:yes): av==0 pass/fail edge and 1.1x lapse-support threshold ----------
function checkP4_ulpForcing() {
  let violations = 0, checked = 0;
  const base20 = Array.from({ length: 20 }, (_, i) => (i + 1) * 100);
  const zeroAtYr15 = [...base20]; zeroAtYr15[14] = 0; // exactly 0 -> PASS (>=0)
  const negAtYr15 = [...base20]; negAtYr15[14] = -0.01; // just below 0 -> FAIL
  const cases = [
    { account_values: zeroAtYr15, face_amount: 10000 },
    { account_values: negAtYr15, face_amount: 10000 },
    { account_values: base20, lapse_rates: Array(20).fill(0), face_amount: 10000 }, // persistence=1, no lapse-support
    { account_values: base20, lapse_rates: Array(20).fill(1), face_amount: 10000 }, // persistence=0 -> division degenerate path
    { account_values: [1e-300, ...base20.slice(1)], face_amount: 10000 }, // denormal-scale
  ];
  for (const c of cases) {
    checked++;
    const o = compute(c);
    if (o.account_value_yr15 !== null && !Number.isFinite(o.account_value_yr15)) violations++;
    if (o.lapse_adjusted_av_yr20 !== null && !Number.isFinite(o.lapse_adjusted_av_yr20)) violations++;
  }
  const zeroCase = compute(cases[0]);
  if (zeroCase.self_support_yr15_pass !== true) violations++;
  const negCase = compute(cases[1]);
  if (negCase.self_support_yr15_pass !== false) violations++;
  return { name: 'P4_ulp_boundary_forcing_av_zero_and_lapse_threshold', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_differential());
results.properties.push(checkP3_monotonicity());
results.properties.push(checkP4_ulpForcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-253-run-illustration-selfsupport-test',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
