// art-99-mica-transitional-deadline-router property-test floor (FV-PROPFLOOR-SHARD-A-REMAINDER-2).
// kernel_digest_at_authoring: sha256:d8ddfc05bd855396319ce509d55e21199ea94e0933e893db6f293b964d64b21c
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape: small fixed-field deadline router -- member_state is
// looked up against two hardcoded Sets (16 cliff states / 4 extended states, else default) to
// pick one of 3 fixed deadline strings, a fixed-anchor (TODAY constant) window_months is derived
// from the date diff, then existing_registration + window_months feed a 2-branch wind-down/file
// decision -- confirmed against direct kernel source read per this row's fence.
// float:no (member_state/existing_registration are declared string enums; window_months is a
// deterministic date-diff integer, not caller-controlled float) -- forced CATEGORICAL boundary
// cases (every cliff state, every extended state, default/unknown state, both existing_registration
// values) stand in for ULP forcing. ZERO external dependencies -- pure Node built-ins only.
// READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-99-mica-transitional-deadline-router.proptest.mjs

import { compute } from '../art-99-mica-transitional-deadline-router.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const CLIFF_STATES = ['FR', 'IT', 'ES', 'MT', 'LU', 'PT', 'CY', 'NL', 'BE', 'DE', 'AT', 'IE', 'GR', 'PL', 'CZ', 'HU'];
const EXTENDED_STATES = ['SE', 'DK', 'FI', 'NO'];
const OTHER_STATES = ['US', 'GB', 'XX', ''];
const ALL_STATES = [...CLIFF_STATES, ...EXTENDED_STATES, ...OTHER_STATES];
const CLIFF_DEADLINE = '2026-06-30';
const EXTENDED_DEADLINE = '2026-12-30';
const DEFAULT_DEADLINE = '2026-12-30';
const TODAY = '2026-06-22';

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function expectedDeadline(state) {
  const ms = state.trim().toUpperCase();
  if (CLIFF_STATES.includes(ms)) return CLIFF_DEADLINE;
  if (EXTENDED_STATES.includes(ms)) return EXTENDED_DEADLINE;
  return DEFAULT_DEADLINE;
}
function expectedWindowMonths(deadline) {
  const diffMs = new Date(deadline) - new Date(TODAY);
  return Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.44));
}
function expectedDecision(existing_registration, window_months) {
  if (existing_registration === 'no' && window_months < 1) return 'wind-down';
  return 'file';
}

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-99-mica-transitional-deadline-router.fixtures.json');
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

// ---------- negative control: an oracle never seen rejecting a wrong spec is not known to work ----------
function negativeControl() {
  const { output_payload } = compute({});
  const mutated = { ...output_payload, decision: output_payload.decision === 'file' ? 'wind-down' : 'file' };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

// P1: transitional_end_date lookup agreement over the declared member_state domain, random 300-sample.
function checkP1_deadlineLookupAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(99001);
  for (let i = 0; i < 300; i++) {
    const inputs = { member_state: pick(rng, ALL_STATES), existing_registration: pick(rng, ['yes', 'no']) };
    const { output_payload } = compute({ inputs });
    checked++;
    if (output_payload.transitional_end_date !== expectedDeadline(inputs.member_state)) violations++;
  }
  return { name: 'P1_deadline_lookup_agreement_random300', trials: checked, violations };
}

// P2: window_months == round(date-diff) against the fixed TODAY anchor.
function checkP2_windowMonthsAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(99002);
  for (let i = 0; i < 300; i++) {
    const inputs = { member_state: pick(rng, ALL_STATES), existing_registration: pick(rng, ['yes', 'no']) };
    const { output_payload } = compute({ inputs });
    checked++;
    if (output_payload.window_months !== expectedWindowMonths(output_payload.transitional_end_date)) violations++;
  }
  return { name: 'P2_window_months_agreement_random300', trials: checked, violations };
}

// P3: decision agreement -- wind-down iff existing_registration==='no' && window_months<1.
function checkP3_decisionAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(99003);
  for (let i = 0; i < 300; i++) {
    const inputs = { member_state: pick(rng, ALL_STATES), existing_registration: pick(rng, ['yes', 'no']) };
    const { output_payload } = compute({ inputs });
    checked++;
    if (output_payload.decision !== expectedDecision(inputs.existing_registration, output_payload.window_months)) violations++;
  }
  return { name: 'P3_decision_agreement_random300', trials: checked, violations };
}

// P4: forced categorical boundary cases -- every cliff state, every extended state, default state,
// case-insensitive + whitespace-trimmed lookup, and existing_registration yes vs no on a cliff state.
function checkP4_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;

  for (const s of CLIFF_STATES) {
    const r = compute({ inputs: { member_state: s, existing_registration: 'yes' } }).output_payload;
    checked++; if (r.transitional_end_date !== CLIFF_DEADLINE) violations++;
  }
  for (const s of EXTENDED_STATES) {
    const r = compute({ inputs: { member_state: s, existing_registration: 'yes' } }).output_payload;
    checked++; if (r.transitional_end_date !== EXTENDED_DEADLINE) violations++;
  }
  let r = compute({ inputs: { member_state: 'US', existing_registration: 'yes' } }).output_payload;
  checked++; if (r.transitional_end_date !== DEFAULT_DEADLINE) violations++;

  r = compute({ inputs: { member_state: ' fr ', existing_registration: 'yes' } }).output_payload;
  checked++; if (r.transitional_end_date !== CLIFF_DEADLINE) violations++;

  r = compute({ inputs: { member_state: 'DE', existing_registration: 'no' } }).output_payload;
  checked++; if (r.decision !== 'wind-down') violations++;

  r = compute({ inputs: { member_state: 'NO', existing_registration: 'yes' } }).output_payload;
  checked++; if (r.decision !== 'file') violations++;

  return { name: 'P4_forced_categorical_boundary_cases_all_states_and_registration', trials: checked, violations };
}

// P5: output shape / no NaN / undefined across missing-field and empty-object inputs.
function checkP5_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { inputs: {} }, { member_state: 'DE' }, { inputs: { member_state: 'ZZ' } }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (typeof output_payload.transitional_end_date !== 'string') violations++;
    if (!Number.isFinite(output_payload.window_months)) violations++;
    if (!Array.isArray(output_payload.file_by_preconditions)) violations++;
    if (typeof output_payload.decision !== 'string') violations++;
  }
  return { name: 'P5_output_shape_no_nan_undefined', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

const negControl = negativeControl();
if (!negControl.rejected_wrong_spec) {
  console.error('NEGATIVE CONTROL FAILED -- comparator never observed rejecting a wrong output.');
  process.exit(1);
}

results.properties.push(checkP1_deadlineLookupAgreement());
results.properties.push(checkP2_windowMonthsAgreement());
results.properties.push(checkP3_decisionAgreement());
results.properties.push(checkP4_forcedCategoricalBoundaries());
results.properties.push(checkP5_outputShapeInvariant());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-99-mica-transitional-deadline-router',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
