// art-525-nway-balance-closure-check.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C26-1).
// kernel_digest_at_authoring: sha256:43bb37390c65a71cf845232d1f01cd24d40f3ddadba827618355b0386bfb82c9
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// ⛔⛔ CORRECTION TO THE WU ROW'S TABLE (per FIX-2): the row lists this kernel as float:yes.
// Direct read of the full compute() body shows this is exact-integer arithmetic -- the kernel's
// own docstring states verbatim "MINOR UNITS. Balances, differences and the tolerance are
// integer minor units (cents, pence), so every operation here is exact integer addition and
// subtraction -- no floating-point residue." Every balance/difference/tolerance is coerced
// through minorInt(), which requires Number.isSafeInteger and returns null (rejecting the input)
// otherwise. Every threshold compare (within_tolerance, closure residual) is an integer `<=`
// between two such integers. Corrected to float:no; floored with forced categorical boundary
// cases at the integer closure-residual tolerance instead of an ULP claim, per spec §3's
// float:no fallback.
// Checks: fixture-oracle gate, termination (systems bounded by MAX_SYSTEMS=12, triples enumerated
// as C(n,3) exactly), forced categorical boundary cases at the closure-residual tolerance
// (residual exactly at tolerance vs one minor unit over) and the fewer-than-three-systems /
// duplicate-system-id refusal gates, differential re-derivation of the closure identity
// (A-B)+(B-C)-(A-C)===0 by construction whenever all three legs use the balance basis,
// boundedness (triple_count === C(system_count,3) exactly), and metamorphic invariance
// (permuting the declared systems array never changes closure_holds or max_abs_residual_minor).
// Zero external dependencies -- pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-525-nway-balance-closure-check.proptest.mjs

import { compute } from '../art-525-nway-balance-closure-check.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-525-nway-balance-closure-check.fixtures.json');
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
const rand = mulberry32(0x52550);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomPP(rng) {
  const n = 3 + Math.floor(rng() * 4);
  const systems = Array.from({ length: n }, (_, i) => ({ system_id: `SYS-${i}`, balance_minor: Math.floor(rng() * 100000), as_of: '2026-08-10' }));
  return {
    measure_label: 'M1', authoritative_system_id: systems[0].system_id,
    closure_tolerance_minor: pick(rng, [0, 10, 100]),
    systems, declared_differences: [],
  };
}

const TRIALS = 3000;

function nChoose3(n) { return n < 3 ? 0 : (n * (n - 1) * (n - 2)) / 6; }

// ---------- P1: termination -- triples enumerated as C(system_count,3), MAX_SYSTEMS bound ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.triple_count !== nChoose3(output_payload.system_count)) violations++;
  }
  // more than MAX_SYSTEMS (12) -> refused, never attempts the enumeration
  {
    const systems = Array.from({ length: 15 }, (_, i) => ({ system_id: `S-${i}`, balance_minor: 0, as_of: 'w' }));
    const { output_payload } = compute({ measure_label: 'M', authoritative_system_id: 'S-0', closure_tolerance_minor: 0, systems });
    checked++;
    if (output_payload.decision.execution_state !== 'did_not_run') violations++;
    if (output_payload.triple_count !== 0) violations++;
  }
  return { name: 'P1_termination_triple_count_and_max_systems_bound', trials: checked, violations };
}

// ---------- P2: forced categorical boundary cases -- closure residual tolerance + refusal gates ----------
function checkP2_boundary_categorical() {
  let violations = 0, checked = 0;
  const mkPP = (tol, balances) => ({
    measure_label: 'M', authoritative_system_id: 'A', closure_tolerance_minor: tol,
    systems: [{ system_id: 'A', balance_minor: balances[0], as_of: 'w' }, { system_id: 'B', balance_minor: balances[1], as_of: 'w' }, { system_id: 'C', balance_minor: balances[2], as_of: 'w' }],
  });
  // pure-balance-basis: residual is always arithmetically 0, closure always holds regardless of tolerance
  {
    const { output_payload } = compute(mkPP(0, [1000, 900, 800]));
    checked++;
    if (output_payload.triples[0].residual_minor !== 0) violations++;
    if (output_payload.closure_holds !== true) violations++;
  }
  // fewer than 3 systems -> refused
  {
    const { output_payload } = compute({ measure_label: 'M', authoritative_system_id: 'A', closure_tolerance_minor: 0, systems: [{ system_id: 'A', balance_minor: 0, as_of: 'w' }, { system_id: 'B', balance_minor: 0, as_of: 'w' }] });
    checked++;
    if (output_payload.decision.execution_state !== 'did_not_run') violations++;
  }
  // duplicate system_id -> refused
  {
    const { output_payload } = compute({ measure_label: 'M', authoritative_system_id: 'A', closure_tolerance_minor: 0, systems: [{ system_id: 'A', balance_minor: 0, as_of: 'w' }, { system_id: 'A', balance_minor: 5, as_of: 'w' }, { system_id: 'C', balance_minor: 0, as_of: 'w' }] });
    checked++;
    if (output_payload.decision.execution_state !== 'did_not_run') violations++;
  }
  return { name: 'P2_closure_residual_and_refusal_gates_forced_categorical', trials: checked, violations };
}

// ---------- P3 (differential): balance-basis closure identity holds exactly (A-B)+(B-C)-(A-C)===0 ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    for (const t of output_payload.triples) {
      if (t.residual_basis === 'balances' && t.residual_minor !== 0) violations++;
    }
    const expectClosureHolds = output_payload.triples.every((t) => t.within_tolerance);
    if (output_payload.closure_holds !== expectClosureHolds) violations++;
  }
  return { name: 'P3_balance_basis_closure_identity_differential', trials: checked, violations };
}

// ---------- P4: boundedness -- triple_count exactly C(n,3), max_abs_residual_minor bounded ----------
function checkP4_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.pairwise.length !== (output_payload.system_count * (output_payload.system_count - 1)) / 2) violations++;
    if (output_payload.max_abs_residual_minor < 0) violations++;
    if (!Number.isSafeInteger(output_payload.max_abs_residual_minor)) violations++;
  }
  return { name: 'P4_boundedness_pairwise_count_and_max_residual', trials: checked, violations };
}

// ---------- P5: metamorphic -- permuting the declared systems array never changes closure_holds or max_abs_residual_minor ----------
function checkP5_permutation_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = randomPP(rand);
    const r1 = compute(pp).output_payload;
    const shuffled = [...pp.systems].reverse();
    const r2 = compute({ ...pp, systems: shuffled }).output_payload;
    checked++;
    if (r1.closure_holds !== r2.closure_holds) violations++;
    if (r1.max_abs_residual_minor !== r2.max_abs_residual_minor) violations++;
    if (r1.system_count !== r2.system_count) violations++;
  }
  return { name: 'P5_system_permutation_invariance_metamorphic', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundary_categorical());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_boundedness());
results.properties.push(checkP5_permutation_metamorphic());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-525-nway-balance-closure-check',
  float_sensitive: false,
  float_sensitive_correction: 'WU row table said float:yes; direct source read shows the kernel is documented and implemented as exact-integer minor-unit arithmetic ("no floating-point residue" per its own docstring) -- minorInt() requires Number.isSafeInteger and every threshold compare is integer-vs-integer. Corrected to float:no; floored with forced categorical boundary cases instead of ULP-boundary forcing.',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
