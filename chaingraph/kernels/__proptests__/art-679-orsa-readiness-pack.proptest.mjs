// art-679-orsa-readiness-pack — class-K property-test FLOOR. Authored by ORSA-READINESS-BUILD-1
// per FV-PBT-FLOOR-BUILD-SPEC.md.
// kernel_digest_at_authoring: sha256:1dc812c6c0a705895c7f5cc8c6a10acd3ba2d7d30d833fa04ebffa55ac5d2e93
// spec: ORSA-READINESS-BUILD-SPEC.md (canonical preimage, execution_hash pinned at staging:
// 2a945db112b542787fc284bdb549140ba10bd147732126fd7faf052fc5fc52c0)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-679-orsa-readiness-pack.proptest.mjs

import { compute } from '../art-679-orsa-readiness-pack.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, deepEqual, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = 'art-679-orsa-readiness-pack';

const SCENARIO_POOL = ['orderly_transition', 'disorderly_transition', 'physical_risk_hot_house', 'internal_custom'];

function randomScenarios(rng) {
  const n = 1 + Math.floor(rng() * SCENARIO_POOL.length);
  const out = [];
  for (let i = 0; i < n; i++) out.push(SCENARIO_POOL[Math.floor(rng() * SCENARIO_POOL.length)]);
  return out;
}

// P1: set-difference and flag consistency on the success path. For random
// well-formed inputs: scenarios_missing is exactly required minus run (order
// preserved), liquidity_plan matches the declared flag, and overall is READY
// exactly when nothing is missing AND the plan is documented.
function checkSetArithmetic() {
  const rng = mulberry32(679);
  let checked = 0; const violations = [];
  for (let i = 0; i < 300; i++) {
    const required = randomScenarios(rng);
    const run = randomScenarios(rng);
    const flag = rng() < 0.5;
    const pp = { scenarios_required: required, scenarios_run: run, liquidity_plan_documented: flag };
    const { output_payload: op, compliance_flags } = compute(pp);
    checked++;
    const runSet = new Set(run);
    const expectedMissing = required.filter((s) => !runSet.has(s));
    if (JSON.stringify(op.scenarios_missing) !== JSON.stringify(expectedMissing)) {
      violations.push(`scenarios_missing ${JSON.stringify(op.scenarios_missing)} != ${JSON.stringify(expectedMissing)}`);
    }
    if (op.liquidity_plan !== (flag ? 'DOCUMENTED' : 'MISSING')) violations.push('liquidity_plan inconsistent with flag');
    const expectedOverall = expectedMissing.length === 0 && flag ? 'READY' : 'NOT_READY';
    if (op.overall !== expectedOverall) violations.push(`overall ${op.overall} != ${expectedOverall}`);
    if (op.overall === 'READY' && (op.scenarios_missing.length > 0 || op.liquidity_plan !== 'DOCUMENTED')) {
      violations.push('READY verdict with missing pieces');
    }
    if (compliance_flags.length !== 0) violations.push(`unexpected flags ${compliance_flags.join(',')}`);
    if (typeof op.trace !== 'string' || !op.trace.includes('liquidity plan flag')) violations.push('trace missing');
  }
  return { name: 'set_difference_consistency', checked, violations: violations.length };
}

// P2: invalid-domain rejection — malformed inputs always fail closed with named
// errors, null output fields, and never a partially computed verdict.
function checkFailClosed() {
  const rng = mulberry32(6791);
  let checked = 0; const violations = [];
  const badInputs = [
    {},
    { scenarios_required: null, scenarios_run: null, liquidity_plan_documented: null },
    { scenarios_required: [], scenarios_run: [], liquidity_plan_documented: true },
    { scenarios_required: ['orderly_transition', ''], scenarios_run: [], liquidity_plan_documented: true },
    { scenarios_required: 'orderly_transition', scenarios_run: [], liquidity_plan_documented: true },
    { scenarios_required: ['orderly_transition'], scenarios_run: 'orderly_transition', liquidity_plan_documented: true },
    { scenarios_required: ['orderly_transition'], scenarios_run: [42], liquidity_plan_documented: true },
    { scenarios_required: ['orderly_transition'], scenarios_run: [], liquidity_plan_documented: 1 },
    { scenarios_required: ['orderly_transition'], scenarios_run: [], liquidity_plan_documented: true, capital_contingency_note: '' },
    { scenarios_required: ['orderly_transition'], scenarios_run: [], liquidity_plan_documented: true, board_sign_off_reference: 7 },
  ];
  for (const pp of badInputs) {
    const { output_payload: op, compliance_flags } = compute(pp);
    checked++;
    if (!Array.isArray(op.domain_errors) || op.domain_errors.length === 0) violations.push('no domain_errors on malformed input');
    if (op.scenarios_missing !== null || op.liquidity_plan !== null || op.overall !== null) {
      violations.push('fail-closed payload did not null every output field');
    }
    if (!compliance_flags.includes('DOMAIN_ERROR')) violations.push('DOMAIN_ERROR flag missing');
  }
  // fuzz: random junk shapes must never throw and never produce a computable verdict
  for (let i = 0; i < 200; i++) {
    const junk = {};
    const keys = ['scenarios_required', 'scenarios_run', 'liquidity_plan_documented'];
    for (const k of keys) {
      const r = rng();
      if (r < 0.3) continue; // absent
      else if (r < 0.5) junk[k] = null;
      else if (r < 0.7) junk[k] = Math.floor(rng() * 100);
      else if (k === 'liquidity_plan_documented') junk[k] = rng() < 0.5 ? true : 'nope';
      else junk[k] = rng() < 0.5 ? [] : [rng() < 0.5 ? 'orderly_transition' : null];
    }
    const { output_payload: op } = compute(junk);
    checked++;
    const validReq = Array.isArray(junk.scenarios_required) && junk.scenarios_required.length > 0 && junk.scenarios_required.every((s) => typeof s === 'string' && s.length > 0);
    const validRun = Array.isArray(junk.scenarios_run) && junk.scenarios_run.every((s) => typeof s === 'string' && s.length > 0);
    const validFlag = typeof junk.liquidity_plan_documented === 'boolean';
    if ((op.overall === 'READY' || op.overall === 'NOT_READY') && !(validReq && validRun && validFlag)) {
      violations.push('computable verdict reached from a malformed input');
    }
    if ((validReq && validRun && validFlag) && Array.isArray(op.domain_errors)) {
      violations.push('well-formed input was refused');
    }
  }
  return { name: 'fail_closed_rejection', checked, violations: violations.length };
}

// P3: determinism — identical inputs produce byte-identical outputs across repeated calls.
function checkDeterminism() {
  const rng = mulberry32(6792);
  let checked = 0; const violations = [];
  for (let i = 0; i < 100; i++) {
    const pp = { scenarios_required: randomScenarios(rng), scenarios_run: randomScenarios(rng), liquidity_plan_documented: rng() < 0.5 };
    const a = compute(pp); const b = compute(pp);
    checked++;
    if (!deepEqual(a, b)) violations.push('repeated compute() diverged');
  }
  return { name: 'determinism', checked, violations: violations.length };
}

// P4: output shape — success path carries exactly the four pinned fields,
// no NaN/undefined anywhere.
function checkOutputShape() {
  const rng = mulberry32(6793);
  let checked = 0; const violations = [];
  const SUCCESS_KEYS = ['scenarios_missing', 'liquidity_plan', 'trace', 'overall'];
  const FAIL_KEYS = ['scenarios_missing', 'liquidity_plan', 'trace', 'overall', 'domain_errors'];
  for (let i = 0; i < 200; i++) {
    const good = rng() < 0.5;
    const pp = good
      ? { scenarios_required: ['orderly_transition', 'disorderly_transition'], scenarios_run: ['orderly_transition'], liquidity_plan_documented: rng() < 0.5 }
      : { scenarios_required: null, scenarios_run: {}, liquidity_plan_documented: 'maybe' };
    const { output_payload: op } = compute(pp);
    checked++;
    const keys = Object.keys(op).sort().join(',');
    const expectedKeys = (good ? SUCCESS_KEYS : FAIL_KEYS).slice().sort().join(',');
    if (keys !== expectedKeys) violations.push(`payload keys ${keys} != ${expectedKeys}`);
    const shape = findShapeViolations(op);
    if (shape.length) violations.push(shape.join('; '));
    if (good && !(op.overall === 'READY' || op.overall === 'NOT_READY')) violations.push('bad overall on success path');
  }
  return { name: 'output_shape_pinned', checked, violations: violations.length };
}

// P5: monotonicity — running one more declared scenario can only shrink the
// missing set and can only flip the verdict NOT_READY-ward is impossible: it
// moves readiness upward or leaves it unchanged; it never removes readiness.
function checkMonotonicity() {
  const rng = mulberry32(6794);
  let checked = 0; const violations = [];
  for (let i = 0; i < 200; i++) {
    const required = ['orderly_transition', 'disorderly_transition', 'physical_risk_hot_house'];
    const run = randomScenarios(rng);
    const extra = 'internal_custom';
    const flag = rng() < 0.5;
    const A = { scenarios_required: required, scenarios_run: run, liquidity_plan_documented: flag };
    const B = { scenarios_required: required, scenarios_run: run.concat([extra]), liquidity_plan_documented: flag };
    const a = compute(A).output_payload;
    const b = compute(B).output_payload;
    checked++;
    if (b.scenarios_missing.length > a.scenarios_missing.length) violations.push('adding a run grew the missing set');
    if (a.overall === 'READY' && b.overall === 'NOT_READY') violations.push('adding a run removed readiness');
  }
  return { name: 'run_monotonicity', checked, violations: violations.length };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkSetArithmetic(),
  checkFailClosed(),
  checkDeterminism(),
  checkOutputShape(),
  checkMonotonicity(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — ORSA-READINESS-BUILD-1.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
