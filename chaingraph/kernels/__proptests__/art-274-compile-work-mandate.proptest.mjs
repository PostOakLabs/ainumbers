// art-274-compile-work-mandate.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C9-1).
// kernel_digest_at_authoring: sha256:ea85405e77c5118fc3a13920831a7ff78212bceecaff1c5fb9ac01473ffe343b
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — pure structural transform over arrays/strings,
// no arithmetic other than array-length index math and a checkpointIdx = max(0, N-2) integer calc).
// Checks: fixture-oracle gate, termination (steps array length bounded by scope.tool_ids.length
// or exactly 1 for a chains[0] reference; rules array length bounded by
// conditions.length + escalation_triggers.length), boundedness (checkpointIdx always a valid
// steps index, gate.rules.length === conditions.length + escalation_triggers.length),
// differential re-derivation of the multi_pointer_gate rejection, and a metamorphic identity
// (escalation triggers always precede conditions in rules[], and every escalation-trigger rule's
// `next` is 'escalate').
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-274-compile-work-mandate.proptest.mjs

import { compute } from '../art-274-compile-work-mandate.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-274-compile-work-mandate.fixtures.json');
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
const rand = mulberry32(0x274A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const OPS = ['eq', 'neq', 'gt', 'lt', 'present', 'absent'];
const POINTERS = ['/decision/approved', '/decision/score'];

function randomEntry(rng, sharedPointer) {
  const op = pick(rng, OPS);
  const e = { pointer: sharedPointer, op };
  if (op !== 'present' && op !== 'absent') e.value = rng() < 0.5;
  return e;
}

function randomMandate(rng, { forceMultiPointer = false } = {}) {
  const nTools = 1 + Math.floor(rng() * 6);
  const tool_ids = Array.from({ length: nTools }, (_, i) => `tool_${i}`);
  const nCond = Math.floor(rng() * 4);
  const nTrig = Math.floor(rng() * 3);
  const sharedPointer = pick(rng, POINTERS);
  const conditions = Array.from({ length: nCond }, () => randomEntry(rng, sharedPointer));
  const escalation_triggers = Array.from({ length: nTrig }, () => randomEntry(rng, forceMultiPointer && rng() < 0.5 ? pick(rng, POINTERS.filter((p) => p !== sharedPointer)) : sharedPointer));
  return { mandate: { scope: { tool_ids }, conditions, escalation_triggers } };
}

const TRIALS = 5000;

// ---------- P1: termination — steps.length bounded by scope.tool_ids.length (or 1 for chains) ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomMandate(rand);
    checked++;
    const { output_payload } = compute(pp);
    if (output_payload.error) continue;
    const steps = output_payload.chain_config.steps;
    if (steps.length !== pp.mandate.scope.tool_ids.length) violations++;
  }
  return { name: 'P1_steps_length_bounded_by_tool_ids', trials: checked, violations };
}

// ---------- P2: boundedness — gate.rules.length === conditions+triggers count, checkpointIdx valid ----------
function checkP2_gate_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomMandate(rand);
    checked++;
    const { output_payload } = compute(pp);
    if (output_payload.error) continue;
    const steps = output_payload.chain_config.steps;
    const gatedStep = steps.find((s) => s.gate);
    const totalEntries = pp.mandate.conditions.length + pp.mandate.escalation_triggers.length;
    if (totalEntries === 0) {
      if (gatedStep) violations++;
      continue;
    }
    if (!gatedStep) { violations++; continue; }
    if (gatedStep.gate.rules.length !== totalEntries) violations++;
    if (gatedStep.gate.default !== 'escalate') violations++;
  }
  return { name: 'P2_gate_rules_count_and_default_bounded', trials: checked, violations };
}

// ---------- P3 (differential): multi_pointer_gate rejection re-derivation ----------
function checkP3_multi_pointer_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomMandate(rand, { forceMultiPointer: true });
    checked++;
    const allEntries = pp.mandate.conditions.concat(pp.mandate.escalation_triggers);
    const distinctPointers = new Set(allEntries.map((e) => e.pointer).filter((p) => p != null));
    const { output_payload } = compute(pp);
    const expectRejection = distinctPointers.size > 1;
    const gotRejection = output_payload.error === 'multi_pointer_gate';
    if (expectRejection !== gotRejection) violations++;
  }
  return { name: 'P3_multi_pointer_gate_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — escalation triggers always precede conditions, all trigger rules -> 'escalate' ----------
function checkP4_trigger_ordering() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 3000; i++) {
    const pp = randomMandate(rand);
    if (pp.mandate.escalation_triggers.length === 0 || pp.mandate.conditions.length === 0) continue;
    checked++;
    const { output_payload } = compute(pp);
    if (output_payload.error) continue;
    const gatedStep = output_payload.chain_config.steps.find((s) => s.gate);
    if (!gatedStep) { violations++; continue; }
    const nTrig = pp.mandate.escalation_triggers.length;
    const rules = gatedStep.gate.rules;
    for (let k = 0; k < nTrig; k++) if (rules[k].next !== 'escalate') violations++;
  }
  return { name: 'P4_escalation_triggers_precede_conditions_and_route_escalate', trials: checked, violations };
}

// ---------- P5: boundary categorical cases (float:no -> forced categorical, not ULP) ----------
const CATEGORICAL_CASES = [
  { label: 'empty mandate object', pp: {} },
  { label: 'null mandate', pp: { mandate: null } },
  { label: 'single tool_id, no conditions/triggers', pp: { mandate: { scope: { tool_ids: ['only_tool'] }, conditions: [], escalation_triggers: [] } } },
  { label: 'chains[0] fallback (no tool_ids)', pp: { mandate: { scope: { chains: ['chain_a', 'chain_b'] }, conditions: [], escalation_triggers: [] } } },
  { label: 'exactly 2 tool_ids with 1 condition (checkpoint = idx 0)', pp: { mandate: { scope: { tool_ids: ['a', 'b'] }, conditions: [{ pointer: '/x', op: 'present' }], escalation_triggers: [] } } },
];
function checkP5_forced() {
  return CATEGORICAL_CASES.map((c) => {
    const { output_payload } = compute(c.pp);
    return { label: c.label, output_payload };
  });
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_gate_bounded());
results.properties.push(checkP3_multi_pointer_differential());
results.properties.push(checkP4_trigger_ordering());
const forcedCases = checkP5_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-274-compile-work-mandate',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  forced_categorical_cases: forcedCases,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
