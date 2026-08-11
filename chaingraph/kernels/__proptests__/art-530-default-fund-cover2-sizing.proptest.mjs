// art-530-default-fund-cover2-sizing.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C27-1).
// kernel_digest_at_authoring: sha256:4d53619712ff1da614212e1de80b28da3a815322d590e9fa5f7dd3db647c59b2
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — the WU row's triage table listed this kernel as float:yes; RE-CONFIRMED BY
// DIRECT READ per FIX-2 and that classification does NOT hold. The kernel's own docstring states
// "FIXED-POINT MONEY MATH ... No floating-point arithmetic in compute()" and the code matches: every
// amount is a safe-integer number of minor units, member_stress_loss = Math.trunc(exposure * loss_bps
// / 10000) truncates to an integer, and every comparison is an integer comparison. The one division is
// always by the fixed constant 10000, immediately truncated — never a caller-controlled denominator,
// never a value that reaches a threshold compare unrounded. Forced categorical boundary cases are used
// in place of ULP forcing.
// Checks: fixture-oracle gate, termination (P1: per_scenario.length === stress_scenarios.length,
// member_losses.length === members.length per scenario, both bounded by the caller-declared array
// lengths, no matter how many entries are supplied), boundedness (P2: cover2_requirement_minor_units
// === largest+second_largest exactly, worst_case is the true max across per_scenario, never negative),
// a differential re-derivation of the Cover-2 arithmetic against an independent reimplementation (P3),
// two metamorphic identities (P4: permutation-invariance of the members[] array -- the Cover-2
// requirement is a top-2 selection so it cannot depend on input order -- and fund-size monotonicity --
// raising fund_size_minor_units can only move fund_adequate from false to true, never the reverse), and
// forced categorical boundary cases (P5: zero members/zero scenarios finite gate, single-member edge
// where second_largest is null, a fractional exposure input coerced to 0 and named in rejected_inputs).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-530-default-fund-cover2-sizing.proptest.mjs

import { compute } from '../art-530-default-fund-cover2-sizing.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-530-default-fund-cover2-sizing.fixtures.json');
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
const rand = mulberry32(0x530C27);

function randomMembers(rng, n) {
  return Array.from({ length: n }, (_, i) => ({ member_id: `member-${i}`, exposure_minor_units: Math.floor(rng() * 1000000000) }));
}
function randomScenarios(rng, n) {
  return Array.from({ length: n }, (_, i) => ({ scenario_id: `scenario-${i}`, loss_bps: Math.floor(rng() * 10000) }));
}
function randomPP(rng) {
  const nm = Math.floor(rng() * 8);
  const ns = Math.floor(rng() * 5);
  return { as_of: '2026-08-01', fund_size_minor_units: Math.floor(rng() * 2000000000), members: randomMembers(rng, nm), stress_scenarios: randomScenarios(rng, ns) };
}

// Independent reimplementation of the Cover-2 arithmetic, for the differential check (P3).
function reimplement(members, scenarios) {
  const per_scenario = scenarios.map((sc) => {
    const losses = members.map((m) => Math.trunc((m.exposure_minor_units * sc.loss_bps) / 10000)).sort((a, b) => b - a);
    const largest = losses.length > 0 ? losses[0] : 0;
    const second = losses.length > 1 ? losses[1] : 0;
    return largest + second;
  });
  let worst = 0;
  for (const v of per_scenario) if (v > worst) worst = v;
  return { per_scenario, worst };
}

const TRIALS = 4000;

// ---------- P1: termination — per_scenario/member_losses bounded by declared array lengths ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.per_scenario.length !== pp.stress_scenarios.length) violations++;
    for (const row of o.per_scenario) { if (row.member_losses.length !== pp.members.length) violations++; }
  }
  return { name: 'P1_termination_bounded_by_declared_array_lengths', trials: checked, violations };
}

// ---------- P2: boundedness — cover2 = largest+second_largest exactly, worst is the true max, never negative ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    for (const row of o.per_scenario) {
      const expected = (row.largest ? row.largest.stress_loss_minor_units : 0) + (row.second_largest ? row.second_largest.stress_loss_minor_units : 0);
      if (row.cover2_requirement_minor_units !== expected) violations++;
      if (row.cover2_requirement_minor_units < 0) violations++;
    }
    const trueMax = o.per_scenario.length === 0 ? 0 : Math.max(...o.per_scenario.map((r) => r.cover2_requirement_minor_units));
    if (o.worst_case_cover2_requirement_minor_units !== trueMax) violations++;
    if (o.shortfall_minor_units < 0) violations++;
    if (o.fund_adequate !== (o.fund_size_minor_units >= o.worst_case_cover2_requirement_minor_units)) violations++;
  }
  return { name: 'P2_boundedness_cover2_sum_and_worst_case_max', trials: checked, violations };
}

// ---------- P3: differential — Cover-2 arithmetic re-derived against an independent reimplementation ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    const expected = reimplement(pp.members, pp.stress_scenarios);
    for (let s = 0; s < expected.per_scenario.length; s++) {
      if (o.per_scenario[s].cover2_requirement_minor_units !== expected.per_scenario[s]) violations++;
    }
    if (o.worst_case_cover2_requirement_minor_units !== expected.worst) violations++;
  }
  return { name: 'P3_cover2_arithmetic_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — member-order permutation invariance + fund-size monotonicity ----------
function checkP4_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1000; i++) {
    const pp = randomPP(rand);
    if (pp.members.length < 2) continue;
    const shuffled = [...pp.members].reverse();
    const a = compute({ ...pp, members: pp.members }).output_payload;
    const b = compute({ ...pp, members: shuffled }).output_payload;
    checked++;
    if (a.worst_case_cover2_requirement_minor_units !== b.worst_case_cover2_requirement_minor_units) violations++;
    for (let s = 0; s < a.per_scenario.length; s++) {
      if (a.per_scenario[s].cover2_requirement_minor_units !== b.per_scenario[s].cover2_requirement_minor_units) violations++;
    }
  }
  for (let i = 0; i < 1000; i++) {
    const pp = randomPP(rand);
    const bumped = { ...pp, fund_size_minor_units: pp.fund_size_minor_units + Math.floor(rand() * 1000000000) };
    const a = compute(pp).output_payload;
    const b = compute(bumped).output_payload;
    checked++;
    if (a.fund_adequate && !b.fund_adequate) violations++; // once adequate, raising fund_size can never make it inadequate
  }
  return { name: 'P4_permutation_invariance_and_fund_size_monotonicity', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no) ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  // zero members / zero scenarios finite gate
  {
    const { output_payload: o, compliance_flags } = compute({ as_of: '2026-08-01', fund_size_minor_units: 0, members: [], stress_scenarios: [] });
    checked++;
    if (!Number.isFinite(o.worst_case_cover2_requirement_minor_units) || o.worst_case_cover2_requirement_minor_units !== 0) violations++;
    if (!compliance_flags.includes('COVER2_INPUTS_INSUFFICIENT')) violations++;
  }
  // single-member edge: second_largest null, cover2 collapses to the one member's loss
  {
    const { output_payload: o } = compute({ as_of: '2026-08-01', fund_size_minor_units: 0, members: [{ member_id: 'solo', exposure_minor_units: 10000000 }], stress_scenarios: [{ scenario_id: 's', loss_bps: 2850 }] });
    checked++;
    if (o.per_scenario[0].second_largest !== null) violations++;
    if (o.per_scenario[0].cover2_requirement_minor_units !== o.per_scenario[0].largest.stress_loss_minor_units) violations++;
  }
  // fractional exposure coerced to 0 and named
  {
    const { output_payload: o } = compute({ as_of: '2026-08-01', fund_size_minor_units: 0, members: [{ member_id: 'm', exposure_minor_units: 1.5 }], stress_scenarios: [{ scenario_id: 's', loss_bps: 100 }] });
    checked++;
    if (o.per_scenario[0].member_losses[0].stress_loss_minor_units !== 0) violations++;
    if (!o.rejected_inputs.some((r) => r.where === 'members[0].exposure_minor_units')) violations++;
  }
  return { name: 'P5_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_metamorphic());
results.properties.push(checkP5_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-530-default-fund-cover2-sizing',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
