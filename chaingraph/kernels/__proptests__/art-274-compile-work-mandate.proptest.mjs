// art-274-compile-work-mandate.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C13-1).
// kernel_digest_at_authoring: sha256:dfaeb21e94c9b39448879e93b1365cb0b50c1251a16b57a90133275b8739d6ad
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — direct read of art-274-compile-work-mandate.kernel.mjs confirms compute()
// does only structural/string/array transforms (pointer string equality, array-length index math,
// a checkpointIdx = max(0, N-2) integer calc, String() coercion) with zero float arithmetic and
// zero threshold comparisons on numbers. Per spec §3, forced categorical boundary cases replace
// ULP forcing for this kernel.
// Checks: fixture-oracle gate, termination (single-pass over conditions+escalation_triggers and
// scope arrays — output size is bounded by input array length; the kernel is non-iterative so
// there is no iteration cap to state), boundedness (steps.length matches the declared scope size,
// gate.rules.length never exceeds conditions.length+escalation_triggers.length, no NaN/undefined
// in id/tool_id strings or rule shape), the §22.4 Rule 2 multi-pointer rejection metamorphic
// property (>1 distinct pointer among conditions+escalation_triggers always yields the
// multi_pointer_gate rejection shape, and reversibly: <=1 distinct pointer never does), the
// §22.4 Rule 3/4 checkpoint-placement + rule-order metamorphic identity (escalation triggers
// always precede conditions in rules[], every trigger rule routes to 'escalate', default is
// always 'escalate'), determinism (same input -> byte-identical output, pure function), and
// forced categorical boundary cases (empty mandate, N=1, N=2, large N=50, chains[] fallback,
// present/absent ops carrying no value field, conditions present but empty scope).
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
const rand = mulberry32(0x274C13);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const OPS = ['eq', 'neq', 'gt', 'lt', 'present', 'absent'];
const POINTERS = ['/decision/approved', '/decision/score', '/amount/usd'];

function randomEntry(rng, sharedPointer) {
  const op = pick(rng, OPS);
  const e = { pointer: sharedPointer, op };
  if (op !== 'present' && op !== 'absent') e.value = rng() < 0.5 ? true : rng() * 100;
  return e;
}

// Well-formed mandate: conditions+escalation_triggers always share a single pointer (or are
// empty). Used for the termination/boundedness/checkpoint-placement property suite.
function randomWellFormedMandate(rng) {
  const nTools = 1 + Math.floor(rng() * 8);
  const tool_ids = Array.from({ length: nTools }, (_, i) => `tool_${i}`);
  const nCond = Math.floor(rng() * 4);
  const nTrig = Math.floor(rng() * 3);
  const sharedPointer = pick(rng, POINTERS);
  const conditions = Array.from({ length: nCond }, () => randomEntry(rng, sharedPointer));
  const escalation_triggers = Array.from({ length: nTrig }, () => randomEntry(rng, sharedPointer));
  return { mandate: { mandate_type: 'work_mandate', scope: { tool_ids, chains: [] }, conditions, escalation_triggers } };
}

// Deliberately constructed with >=2 DISTINCT pointers among conditions+escalation_triggers —
// used for the multi-pointer-rejection differential property.
function randomMultiPointerMandate(rng) {
  const nTools = 2 + Math.floor(rng() * 6);
  const tool_ids = Array.from({ length: nTools }, (_, i) => `tool_${i}`);
  const nDistinct = 2 + Math.floor(rng() * 2); // 2 or 3
  const chosenPointers = POINTERS.slice(0, nDistinct);
  const total = 2 + Math.floor(rng() * 5);
  const allEntries = Array.from({ length: total }, (_, i) => randomEntry(rng, chosenPointers[i % chosenPointers.length]));
  const conditions = [];
  const escalation_triggers = [];
  for (const e of allEntries) (rng() < 0.5 ? conditions : escalation_triggers).push(e);
  return { mandate: { mandate_type: 'work_mandate', scope: { tool_ids, chains: [] }, conditions, escalation_triggers } };
}

const TRIALS = 4000;

// ---------- P1: termination — steps.length always equals the declared scope size ----------
function checkP1_termination_bounded_by_scope() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomWellFormedMandate(rand);
    const { output_payload } = compute(pp);
    checked++;
    const steps = output_payload.chain_config.steps;
    if (steps.length !== pp.mandate.scope.tool_ids.length) violations++;
  }
  return { name: 'P1_termination_steps_length_bounded_by_scope', trials: checked, violations };
}

// ---------- P2: boundedness — gate.rules.length bounded, no NaN/undefined, default always 'escalate' ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomWellFormedMandate(rand);
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    if (!Array.isArray(compliance_flags)) violations++;
    const steps = output_payload.chain_config.steps;
    const totalEntries = pp.mandate.conditions.length + pp.mandate.escalation_triggers.length;
    for (const step of steps) {
      if (typeof step.tool_id !== 'string' || step.tool_id === 'undefined') violations++;
      if (typeof step.id !== 'string' || step.id === 'undefined') violations++;
      if (step.gate) {
        if (step.gate.default !== 'escalate') violations++;
        if (!Array.isArray(step.gate.rules) || step.gate.rules.length > totalEntries) violations++;
        for (const rule of step.gate.rules) {
          if (rule.next == null) violations++;
          if (rule.op !== 'present' && rule.op !== 'absent' && rule.value === undefined) violations++;
        }
      }
    }
  }
  return { name: 'P2_boundedness_gate_rules_and_shape', trials: checked, violations };
}

// ---------- P3: checkpoint-placement + rule-order metamorphic property (§22.4 Rule 3/4) ----------
function checkP3_checkpoint_and_rule_order() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomWellFormedMandate(rand);
    const { output_payload } = compute(pp);
    checked++;
    const steps = output_payload.chain_config.steps;
    const hasEntries = pp.mandate.conditions.length > 0 || pp.mandate.escalation_triggers.length > 0;
    if (!hasEntries || steps.length === 0) continue;
    const checkpointIdx = steps.length >= 2 ? steps.length - 2 : 0;
    const gatedStep = steps[checkpointIdx];
    if (!gatedStep.gate) { violations++; continue; }
    const nTrig = pp.mandate.escalation_triggers.length;
    const rules = gatedStep.gate.rules;
    for (let k = 0; k < nTrig; k++) if (rules[k].next !== 'escalate') violations++;
    const nextStepId = (checkpointIdx + 1 < steps.length) ? steps[checkpointIdx + 1].id : 'end';
    for (let k = nTrig; k < rules.length; k++) if (rules[k].next !== nextStepId) violations++;
    // no other step carries a gate
    for (let s = 0; s < steps.length; s++) if (s !== checkpointIdx && steps[s].gate) violations++;
  }
  return { name: 'P3_checkpoint_placement_and_rule_order', trials: checked, violations };
}

// ---------- P4 (differential): multi-pointer rejection re-derivation (§22.4 Rule 2, both directions) ----------
function checkP4_multi_pointer_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = rand() < 0.5 ? randomMultiPointerMandate(rand) : randomWellFormedMandate(rand);
    const allEntries = pp.mandate.conditions.concat(pp.mandate.escalation_triggers);
    const distinctPointers = new Set(allEntries.map((e) => e.pointer).filter((p) => p != null));
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    const expectRejection = distinctPointers.size > 1;
    const gotRejection = output_payload.error === 'multi_pointer_gate';
    if (expectRejection !== gotRejection) violations++;
    if (expectRejection) {
      if (!compliance_flags.includes('MULTI_POINTER_GATE_REJECTED')) violations++;
      if (!Array.isArray(output_payload.found) || output_payload.found.length < 2) violations++;
      if (output_payload.chain_config !== undefined) violations++;
    }
  }
  return { name: 'P4_multi_pointer_rejection_differential_both_directions', trials: checked, violations };
}

// ---------- P5: determinism — same input twice, byte-identical output (pure function) ----------
function checkP5_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = rand() < 0.5 ? randomWellFormedMandate(rand) : randomMultiPointerMandate(rand);
    const r1 = compute(pp);
    const r2 = compute(pp);
    checked++;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
  }
  return { name: 'P5_determinism_same_input_same_output', trials: checked, violations };
}

// ---------- P6: forced categorical boundary cases (float:no — replaces ULP forcing) ----------
function checkP6_forced_categorical_boundaries() {
  let violations = 0, checked = 0;
  const cases = [
    { label: 'empty mandate object', pp: {} },
    { label: 'null mandate', pp: { mandate: null } },
    {
      label: 'N=1 step, one condition -> checkpointIdx = max(0, 1-2) = 0',
      pp: { mandate: { scope: { tool_ids: ['only_step'] }, conditions: [{ pointer: '/x', op: 'eq', value: 1 }], escalation_triggers: [] } },
    },
    {
      label: 'N=2 steps, one condition -> checkpointIdx = 0',
      pp: { mandate: { scope: { tool_ids: ['a', 'b'] }, conditions: [{ pointer: '/x', op: 'gt', value: 5 }], escalation_triggers: [] } },
    },
    {
      label: 'large N=50 tool_ids -> checkpointIdx = 48',
      pp: { mandate: { scope: { tool_ids: Array.from({ length: 50 }, (_, i) => `t${i}`) }, conditions: [{ pointer: '/x', op: 'eq', value: true }], escalation_triggers: [] } },
    },
    {
      label: 'chains[] fallback when tool_ids absent',
      pp: { mandate: { scope: { tool_ids: [], chains: ['fallback_chain', 'ignored_second'] }, conditions: [], escalation_triggers: [] } },
    },
    {
      label: 'present/absent ops carry no value field',
      pp: { mandate: { scope: { tool_ids: ['a', 'b'] }, conditions: [{ pointer: '/x', op: 'present' }], escalation_triggers: [{ pointer: '/x', op: 'absent' }] } },
    },
    {
      label: 'conditions present but scope empty -> no steps, no gate possible',
      pp: { mandate: { scope: {}, conditions: [{ pointer: '/x', op: 'eq', value: 1 }], escalation_triggers: [] } },
    },
  ];
  for (const c of cases) {
    const { output_payload, compliance_flags } = compute(c.pp);
    checked++;
    if (!output_payload || typeof output_payload !== 'object') { violations++; continue; }
    if (!Array.isArray(compliance_flags)) violations++;
    if (output_payload.chain_config && !Array.isArray(output_payload.chain_config.steps)) violations++;
  }
  // explicit checkpoint-index assertions for the N=1 and N=50 cases above (indices 2 and 4)
  const n1 = compute(cases[2].pp).output_payload.chain_config.steps;
  checked++;
  if (!n1[0].gate) violations++;
  const n50 = compute(cases[4].pp).output_payload.chain_config.steps;
  checked++;
  if (!n50[48].gate) violations++;
  if (n50[49].gate) violations++;
  // empty-scope-with-conditions case must yield zero steps
  const emptyScope = compute(cases[7].pp).output_payload.chain_config.steps;
  checked++;
  if (emptyScope.length !== 0) violations++;
  return { name: 'P6_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_bounded_by_scope());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_checkpoint_and_rule_order());
results.properties.push(checkP4_multi_pointer_differential());
results.properties.push(checkP5_determinism());
results.properties.push(checkP6_forced_categorical_boundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-274-compile-work-mandate',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
