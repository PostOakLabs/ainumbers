// rca-01-frtb-ima-pre-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C15-1).
// kernel_digest_at_authoring: sha256:270c13fb871367dfb26354afef861b44f31e9ab426a797814c7cd667b1f4a584
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (Monte Carlo P&L simulation over an LCG PRNG, confidenceLevel/nmrfRate float
// comparisons, direct read confirmed) — ULP-boundary forcing is MANDATORY.
// Checks: fixture-oracle gate, termination (nScenarios/nPositions are NOT implementation-clamped —
// compute() runs `Math.max(1, Number(pp.nScenarios) || 2000)` iterations exactly once per declared
// value, so the termination bound is the caller-supplied input itself, a class-C data-dependent-loop
// shape; the property asserts n_scenarios/n_positions echo the requested value and the loop performs
// no extra work), boundedness/differential (capital_required === max(capital_ima, sa_floor) and
// floor_binding === capital_ima < sa_floor, recomputed directly), seed-determinism metamorphic (same
// pp -> byte-identical output, twice), ULP-boundary forcing on confidenceLevel/nmrfRate, and P5
// diagnostic-labeling (RCA01-PLA-SCOPE-1): the convergence output is labeled as the Monte-Carlo
// convergence diagnostic it is (mc_convergence_* keys, MC_CONVERGENCE_* flag, MC Convergence verdict)
// and the retired PLA/eligibility attestation labels never reappear; and P6 detmath helper
// round-trip: EVERY det.* helper in the kernel's inlined fdlibm block is exercised through a
// closed inverse composition derived from the ACTUAL kernel bytes (BEGIN..END detmath slice).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/rca-01-frtb-ima-pre-validator.proptest.mjs

import { compute } from '../rca-01-frtb-ima-pre-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'rca-01-frtb-ima-pre-validator.fixtures.json');
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
const rand = mulberry32(0x1103a6);

function randomPP(rng) {
  return {
    nPositions: Math.floor(rng() * 30) + 1,
    // kept small (compute cost is O(nScenarios^2)-ish across the per-class re-simulation loop) —
    // the WU row's own class-C shape ("data-dependent loops", termination bound = caller input) is
    // exercised precisely because there is no implementation clamp to test instead.
    nScenarios: Math.floor(rng() * 300) + 10,
    confidenceLevel: pick(rng, [0.95, 0.975, 0.99]),
    nRiskClasses: Math.floor(rng() * 5) + 1,
    nmrfRate: rng() * 0.3,
    seed: Math.floor(rng() * 1e9),
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const TRIALS = 100;

// ---------- P1: termination — declared nScenarios/nPositions is the exact bound, not a clamp ----------
function checkP1_termination_input_bound() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.n_scenarios !== pp.nScenarios) violations++;
    if (output_payload.n_positions !== pp.nPositions) violations++;
    if (output_payload.es_by_lh_class.length !== 5) violations++; // fixed LH_DAYS table length
  }
  return { name: 'P1_termination_bound_equals_declared_input', trials: checked, violations };
}

// ---------- P2 (differential): capital_required === max(capital_ima, sa_floor); floor_binding agreement ----------
function checkP2_capital_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expectedCapital = +Math.max(output_payload.capital_ima, output_payload.sa_floor).toFixed(2);
    if (Math.abs(expectedCapital - output_payload.capital_required) > 0.02) violations++;
    if (output_payload.floor_binding !== (output_payload.capital_ima < output_payload.sa_floor)) violations++;
    if (!Number.isFinite(output_payload.mc_convergence_ratio)) violations++;
  }
  return { name: 'P2_capital_required_and_floor_binding_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — seed-determinism (same pp twice -> byte-identical output) ----------
function checkP3_seed_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 80; i++) {
    const pp = randomPP(rand);
    const r1 = compute(pp);
    const r2 = compute(pp);
    checked++;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
  }
  return { name: 'P3_seed_determinism_metamorphic', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  const clForced = [0, -0, eps, 0.975 - eps, 0.975 + eps, 1 - eps, 1, Number.MIN_VALUE];
  for (const cl of clForced) {
    const { output_payload } = compute({ confidenceLevel: cl, nScenarios: 50, seed: 7 });
    checked++;
    if (!Number.isFinite(output_payload.mc_convergence_ratio)) violations++;
  }
  const nmrfForced = [0, -0, eps, 1 - eps, 1, Number.MIN_VALUE];
  for (const nr of nmrfForced) {
    const { output_payload } = compute({ nmrfRate: nr, nScenarios: 50, seed: 7 });
    checked++;
    if (!Number.isFinite(output_payload.nmrf_surcharge)) violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_confidenceLevel_and_nmrfRate', trials: checked, violations };
}

// ---------- P5: diagnostic-labeling (RCA01-PLA-SCOPE-1) ----------
// The convergence metric must present as a Monte-Carlo convergence diagnostic, never as a
// regulatory P&L-attribution result or an IMA-eligibility attestation.
function checkP5_convergence_diagnostic_labeling() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    for (const key of Object.keys(output_payload)) {
      if (key.startsWith('pla_')) violations++;                       // retired key family
    }
    if (typeof output_payload.verdict === 'string' && (output_payload.verdict.includes('PLA') || output_payload.verdict.includes('IMA Pre-Validation'))) violations++;
    if (typeof output_payload.mc_convergence_status !== 'string' || !['GREEN', 'AMBER', 'RED'].includes(output_payload.mc_convergence_status)) violations++;
    if (typeof output_payload.mc_convergence_ratio !== 'number' || !Number.isFinite(output_payload.mc_convergence_ratio)) violations++;
    const mcFlags = compliance_flags.filter((f) => typeof f === 'string' && f.startsWith('MC_CONVERGENCE_'));
    const plaFlags = compliance_flags.filter((f) => typeof f === 'string' && f.startsWith('PLA_TEST_'));
    if (mcFlags.length !== 1) violations++;                            // exactly one, COMPUTED from status
    if (plaFlags.length !== 0) violations++;                           // retired flag family
    if (mcFlags.length === 1 && mcFlags[0] !== 'MC_CONVERGENCE_' + output_payload.mc_convergence_status) violations++;
  }
  return { name: 'P5_convergence_diagnostic_labeling', trials: checked, violations };
}

// ---------- P6: detmath helper round-trip (RCA01-PLA-SCOPE-1 checklist item 3) ----------
// The kernel's det module (pure-JS fdlibm) is module-private, so this property derives it from
// the kernel's own bytes: slice the BEGIN..END detmath block, evaluate it, and round-trip EVERY
// exported helper through a closed inverse composition. Trig has no asin/acos/atan in the block,
// so its inverse compositions run through the other helpers: sin/cos recover from tan via the
// exact identities sin = t/sqrt(1+t^2), cos = 1/sqrt(1+t^2) (sqrt is IEEE-bit-portable), and tan
// closes as sin/cos.
function loadDetFromKernelBytes() {
  const src = readFileSync(path.join(__dirname, '..', 'rca-01-frtb-ima-pre-validator.kernel.mjs'), 'utf8');
  const begin = src.indexOf('/* ===== BEGIN deterministic transcendental math');
  const endMarker = '/* ===== END deterministic transcendental math ===== */';
  const end = src.indexOf(endMarker);
  if (begin < 0 || end < 0 || end <= begin) throw new Error('detmath block markers not found in kernel bytes');
  const slice = src.slice(begin, end + endMarker.length);
  // The slice is `const det = (function () { ... return {...}; })();` — evaluate and hand back det.
  return new Function('"use strict";' + slice + ';return det;')();
}

function relErr(a, b) { return Math.abs(a - b) / Math.abs(b); }

function checkP6_detmath_helper_roundtrip() {
  const det = loadDetFromKernelBytes();
  const checks = [];
  let violations = 0;
  const TOL = 5e-13; // fdlibm is <1ulp per op; a closed round-trip must be far below 2^-40

  // helper: exp — inverse log
  {
    let max = 0;
    for (let i = 0; i < 4000; i++) {
      const p = -700 + (i / 3999) * 1400 + 1e-9 * ((i % 7) - 3);
      const r = relErr(det.log(det.exp(p)), p); if (Number.isFinite(r)) max = Math.max(max, r);
    }
    checks.push({ helper: 'exp', roundtrip: 'log(exp(p))==p', n: 4000, max_rel_err: max, pass: max <= TOL });
  }
  // helper: log — inverse exp
  {
    let max = 0;
    for (let i = 0; i < 4000; i++) {
      const p = Math.pow(10, -280 + (i / 3999) * 580); // 1e-280 .. 1e300
      const r = relErr(det.exp(det.log(p)), p); if (Number.isFinite(r)) max = Math.max(max, r);
    }
    checks.push({ helper: 'log', roundtrip: 'exp(log(p))==p', n: 4000, max_rel_err: max, pass: max <= TOL });
  }
  // helper: log2 — inverse pow(2, .)
  {
    let max = 0;
    for (let i = 0; i < 4000; i++) {
      const p = Math.pow(10, -280 + (i / 3999) * 580);
      const r = relErr(det.pow(2, det.log2(p)), p); if (Number.isFinite(r)) max = Math.max(max, r);
    }
    checks.push({ helper: 'log2', roundtrip: 'pow(2,log2(p))==p', n: 4000, max_rel_err: max, pass: max <= TOL });
  }
  // helper: pow — inverse via 1/y exponent (odd y=3 on positive base), plus log2(pow(2,p))==p
  {
    let max = 0;
    for (let i = 0; i < 4000; i++) {
      const p = Math.pow(10, -90 + (i / 3999) * 180);
      const r = relErr(det.pow(det.pow(p, 1 / 3), 3), p); if (Number.isFinite(r)) max = Math.max(max, r);
      const r2 = relErr(det.log2(det.pow(2, (i / 3999) * 2000 - 1000)), (i / 3999) * 2000 - 1000);
      if (Number.isFinite(r2)) max = Math.max(max, r2);
    }
    checks.push({ helper: 'pow', roundtrip: 'pow(pow(p,1/3),3)==p; log2(pow(2,p))==p', n: 8000, max_rel_err: max, pass: max <= TOL });
  }
  // helpers: sin, cos, tan — closed compositions through the sibling helpers (no asin/acos/atan
  // exists in the block). tan closes full-range as sin/cos (exercises Payne-Hanek reduction).
  // The half-round identities sin(p)=t/sqrt(1+t^2), cos(p)=1/sqrt(1+t^2) hold only where
  // cos(p)>0, so they run on |p| < 1.5 (< pi/2) as absolute-error checks on O(1) values.
  // Full-range closure for sin/cos is the zero-free Pythagorean identity sin^2+cos^2==1
  // (shift identities are excluded: the +/-pi/2 shift is inexact in doubles at large |p|,
  // which makes the INSTRUMENT fail near zeros of sin/cos, not the helpers).
  {
    let maxS = 0, maxC = 0, maxT = 0, maxPyth = 0;
    for (let i = 0; i < 4000; i++) {
      const p = -40 + (i / 3999) * 80 + 1e-7 * ((i % 13) - 6);
      const t = det.tan(p), s = det.sin(p), c = det.cos(p);
      const rT = Math.abs(t - s / c); if (Number.isFinite(rT)) maxT = Math.max(maxT, rT / (Math.abs(t) || 1));
      const rP = Math.abs(s * s + c * c - 1); if (Number.isFinite(rP)) maxPyth = Math.max(maxPyth, rP);
      if (Math.abs(p) < 1.5) {
        const tq = det.tan(p);
        const rSq = Math.abs(det.sin(p) - tq / Math.sqrt(1 + tq * tq)); if (Number.isFinite(rSq)) maxS = Math.max(maxS, rSq);
        const rCq = Math.abs(det.cos(p) - 1 / Math.sqrt(1 + tq * tq)); if (Number.isFinite(rCq)) maxC = Math.max(maxC, rCq);
      }
    }
    maxS = Math.max(maxS, maxPyth); maxC = Math.max(maxC, maxPyth);
    checks.push({ helper: 'sin', roundtrip: 'sin==tan/sqrt(1+tan^2) on |p|<pi/2; sin^2+cos^2==1 full-range', n: 8000, max_rel_err: maxS, pass: maxS <= 1e-14 });
    checks.push({ helper: 'cos', roundtrip: 'cos==1/sqrt(1+tan^2) on |p|<pi/2; sin^2+cos^2==1 full-range', n: 8000, max_rel_err: maxC, pass: maxC <= 1e-14 });
    checks.push({ helper: 'tan', roundtrip: 'tan(p)==sin(p)/cos(p)', n: 4000, max_rel_err: maxT, pass: maxT <= TOL });
  }

  for (const c of checks) if (!c.pass) violations++;
  return { name: 'P6_detmath_helper_roundtrip', tolerance_rel: TOL, helpers: checks, violations };
}


// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_input_bound());
results.properties.push(checkP2_capital_differential());
results.properties.push(checkP3_seed_determinism());
results.properties.push(checkP4_ulp_forcing());
results.properties.push(checkP5_convergence_diagnostic_labeling());
results.properties.push(checkP6_detmath_helper_roundtrip());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'rca-01-frtb-ima-pre-validator',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
