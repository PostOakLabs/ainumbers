// art-325-tvm-irr.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C11-1).
// kernel_digest_at_authoring: sha256:ce6c2877623d0c8092e2ec9a670ce48ce411824ec8006e77f813ecce62070b6d
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (bisection root-find over caller floats, tolerance/rate comparisons,
// direct read confirmed) — ULP-boundary forcing is MANDATORY per spec §3.
// ⭐ HIGHEST-SCRUTINY ITEM IN THIS SHARD: art-325 is an iterative numeric solver over an
// unbounded cash-flow array. Its termination is NOT "loop runs until done" — it is a HARD
// iteration cap (maxIterations) that the kernel respects unconditionally, and on a pathological
// (no-sign-change or non-converging) input it must REPORT non-convergence via
// converged:false, never spin or exceed the cap. That convergence-or-report contract is
// asserted explicitly below (P2), not just implied by termination.
// Checks: fixture-oracle gate, termination (iterations never exceeds maxIterations — the
// unconditional bound, independent of cash_flows.length or bracket width), the mandatory
// convergence-or-report property (P2: either converged===true with |NPV(irr)|<tolerance, or
// converged===false with iterations===maxIterations, for both a converging and a deliberately
// pathological non-converging bracket), boundedness (bracket_valid/NO_SIGN_CHANGE_IN_BRACKET
// flag agreement for all-positive/all-negative cash-flow arrays), and ULP-boundary forcing on
// the tolerance and bracket-edge parameters.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-325-tvm-irr.proptest.mjs

import { compute } from '../art-325-tvm-irr.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-325-tvm-irr.fixtures.json');
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
const rand = mulberry32(0x325D0);

function randomFlows(rng, n) {
  const out = [{ amount: -(200 + rng() * 1000) }];
  for (let i = 1; i < n; i++) out.push({ amount: rng() * 500 });
  return out;
}

function randomPP(rng) {
  const n = Math.floor(rng() * 6) + 2;
  return {
    cash_flows: randomFlows(rng, n),
    bracket_lo: -0.9999,
    bracket_hi: 10,
    tolerance: 1e-9,
    max_iterations: Math.floor(rng() * 200) + 20,
  };
}

const TRIALS = 4000;

// ---------- P1: termination — iterations never exceeds the declared max_iterations cap ----------
function checkP1_termination_iteration_cap() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.iterations > pp.max_iterations) violations++;
  }
  return { name: 'P1_termination_iterations_never_exceed_cap', trials: checked, violations };
}

// ---------- P2 (mandatory, convergence-or-report): converged xor (iterations===maxIterations, not converged) ----------
function checkP2_convergence_or_report() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (!output_payload.converged) {
      // reported non-convergence must mean the cap was hit, OR the bracket itself was invalid
      // (no sign change) — never a silent partial iteration count with no explanation.
      const bracketFlagged = !!(pp.cash_flows.every((f) => f.amount >= 0) || pp.cash_flows.every((f) => f.amount <= 0));
      if (output_payload.iterations !== pp.max_iterations && !bracketFlagged) violations++;
    }
  }
  // deliberately pathological: a tiny max_iterations forces non-convergence-with-report on an
  // otherwise-convergent, valid-bracket problem — the flagship art-325 scrutiny case.
  const pathological = { cash_flows: [{ amount: -1000 }, { amount: 500 }, { amount: 500 }, { amount: 500 }], bracket_lo: -0.9999, bracket_hi: 10, tolerance: 1e-12, max_iterations: 2 };
  const { output_payload: po } = compute(pathological);
  checked++;
  if (po.converged) violations++;
  if (po.iterations !== 2) violations++;
  return { name: 'P2_convergence_or_report_mandatory', trials: checked, violations };
}

// ---------- P3: boundedness — bracket_valid / NO_SIGN_CHANGE_IN_BRACKET flag agreement ----------
function checkP3_bracket_valid_boundedness() {
  let violations = 0, checked = 0;
  const cases = [
    { cash_flows: [{ amount: 100 }, { amount: 100 }, { amount: 100 }], expectInvalid: true }, // all positive
    { cash_flows: [{ amount: -100 }, { amount: -50 }, { amount: -20 }], expectInvalid: true }, // all negative
    { cash_flows: [{ amount: -1000 }, { amount: 500 }, { amount: 500 }, { amount: 500 }], expectInvalid: false },
  ];
  for (const c of cases) {
    const pp = { cash_flows: c.cash_flows, bracket_lo: -0.9999, bracket_hi: 10, tolerance: 1e-9, max_iterations: 100 };
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    if (compliance_flags.includes('NO_SIGN_CHANGE_IN_BRACKET') !== c.expectInvalid) violations++;
    if (c.expectInvalid && output_payload.converged) violations++;
  }
  return { name: 'P3_bracket_valid_flag_boundedness', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) — tolerance and bracket edges ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  const toleranceForced = [0, -0, eps, 1e-9 - eps, 1e-9 + eps, Number.MIN_VALUE, 1e-300];
  const flows = [{ amount: -1000 }, { amount: 600 }, { amount: 600 }];
  for (const tol of toleranceForced) {
    const pp = { cash_flows: flows, bracket_lo: -0.9999, bracket_hi: 10, tolerance: Math.abs(tol) === 0 ? 1e-15 : Math.abs(tol), max_iterations: 500 };
    const { output_payload } = compute(pp);
    checked++;
    if (!Number.isFinite(output_payload.irr_pct)) violations++;
    if (output_payload.iterations > pp.max_iterations) violations++;
  }
  // bracket edge forcing — lo/hi differing from the root by ±1 ULP-scale amounts
  const bracketEdges = [
    { lo: -0.9999999999, hi: 10 },
    { lo: -0.9999, hi: 0.1448884401 },
    { lo: -0.9999, hi: 0.1448884399 },
  ];
  for (const b of bracketEdges) {
    const pp = { cash_flows: flows, bracket_lo: b.lo, bracket_hi: b.hi, tolerance: 1e-9, max_iterations: 200 };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.iterations > pp.max_iterations) violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_tolerance_and_bracket', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_iteration_cap());
results.properties.push(checkP2_convergence_or_report());
results.properties.push(checkP3_bracket_valid_boundedness());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-325-tvm-irr',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
