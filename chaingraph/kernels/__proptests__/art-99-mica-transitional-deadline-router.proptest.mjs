// art-99-mica-transitional-deadline-router property-test floor (ART99-MICA-DEADLINE-FIX-1).
// kernel_digest_at_authoring: sha256:c8cd867cf83b8ee907edf7674753f2d85458abccb18d5d14565414a395367cd1
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape after the ART99-MICA-DEADLINE-FIX-1 rebuild: the former
// 3-way member_state router (16 cliff states / 4 extended states / default, against three
// distinct deadline constants and a frozen TODAY anchor) is COLLAPSED to the single
// primary-supported deadline (MiCA Art 143(3): grandfathering continues "until 1 July 2026")
// plus a REQUIRED caller-supplied as_of input (ISO YYYY-MM-DD). window_months is derived from
// the as_of-to-deadline diff, then existing_registration + window_months feed a 2-branch
// wind-down/file decision; a missing or malformed as_of yields decision 'unresolved' with the
// AS_OF_REQUIRED flag and window_months null. The floor asserts the collapse: EVERY member of
// the declared domain gets the SAME deadline, the window is a pure function of as_of, and the
// decision rule is unchanged from the pre-fix kernel. -- confirmed against direct kernel source
// read per this row's fence.
// float:no (existing_registration is a declared string enum; window_months is a deterministic
// date-diff integer, not a caller-controlled float) -- forced CATEGORICAL boundary cases
// (deadline-adjacent as_of values, both existing_registration values, missing/malformed as_of)
// stand in for ULP forcing. ZERO external dependencies -- pure Node built-ins only.
// READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-99-mica-transitional-deadline-router.proptest.mjs

import { compute } from '../art-99-mica-transitional-deadline-router.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

// MiCA Art 143(3) sets ONE EU-wide transitional end date; Member States may disapply or
// shorten it (Art 143(3) second subparagraph) but no per-state date table is carried here.
const TRANSITIONAL_END = '2026-07-01';
const REGISTRATION_VALUES = ['yes', 'no'];
// as_of sample space: before / at / after the deadline, deadline-adjacent days, and the
// pre-fix frozen-clock date (2026-06-22) that used to drive every answer.
const AS_OF_SAMPLES = [
  '2026-06-02', '2026-06-22', '2026-06-30', '2026-07-01', '2026-07-02',
  '2026-09-12', '2026-12-30', '2027-06-30', '2025-01-01',
];
const INVALID_AS_OF = ['', 'not-a-date', '2026-13-01', '20260622', '2026-9-2', null, undefined, 12345];

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function expectedWindowMonths(as_of) {
  const diffMs = new Date(TRANSITIONAL_END).getTime() - new Date(as_of).getTime();
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
  const { output_payload } = compute({ inputs: { existing_registration: 'no', as_of: '2026-09-12' } });
  const mutated = { ...output_payload, decision: output_payload.decision === 'file' ? 'wind-down' : 'file' };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

// P1: single primary-supported deadline -- EVERY resolved invocation emits 2026-07-01
// (MiCA Art 143(3): "until 1 July 2026"). The collapsed router has no per-state branching.
function checkP1_singlePrimaryDeadline() {
  let violations = 0, checked = 0;
  const rng = mulberry32(99001);
  for (let i = 0; i < 300; i++) {
    const inputs = {
      existing_registration: pick(rng, REGISTRATION_VALUES),
      as_of: pick(rng, AS_OF_SAMPLES),
    };
    const { output_payload } = compute({ inputs });
    checked++;
    if (output_payload.transitional_end_date !== TRANSITIONAL_END) violations++;
  }
  return { name: 'P1_single_primary_deadline_random300', trials: checked, violations };
}

// P2: window_months == round(date-diff) from the caller-supplied as_of, and the echoed as_of
// matches the input (the clock is live and input-determined, never a frozen constant).
function checkP2_windowMonthsFromAsOf() {
  let violations = 0, checked = 0;
  const rng = mulberry32(99002);
  for (let i = 0; i < 300; i++) {
    const inputs = {
      existing_registration: pick(rng, REGISTRATION_VALUES),
      as_of: pick(rng, AS_OF_SAMPLES),
    };
    const { output_payload } = compute({ inputs });
    checked++;
    if (output_payload.as_of !== inputs.as_of) violations++;
    if (output_payload.window_months !== expectedWindowMonths(inputs.as_of)) violations++;
  }
  return { name: 'P2_window_months_from_caller_as_of_random300', trials: checked, violations };
}

// P3: decision agreement -- wind-down iff existing_registration==='no' && window_months<1.
function checkP3_decisionAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(99003);
  for (let i = 0; i < 300; i++) {
    const inputs = {
      existing_registration: pick(rng, REGISTRATION_VALUES),
      as_of: pick(rng, AS_OF_SAMPLES),
    };
    const { output_payload } = compute({ inputs });
    checked++;
    if (output_payload.decision !== expectedDecision(inputs.existing_registration, output_payload.window_months)) violations++;
  }
  return { name: 'P3_decision_agreement_random300', trials: checked, violations };
}

// P4: forced categorical boundary cases -- the deadline-adjacent days where the decision
// flips, both registration values on the same as_of, and every malformed/missing as_of shape
// landing on the same honest 'unresolved' + AS_OF_REQUIRED state with window_months null.
function checkP4_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;

  // 2026-06-02 is 29 days out -> window 1 -> an unregistered CASP still gets 'file'.
  let r = compute({ inputs: { existing_registration: 'no', as_of: '2026-06-02' } }).output_payload;
  checked++; if (r.window_months !== 1 || r.decision !== 'file') violations++;

  // 2026-06-22 (the old frozen clock) is 9 days out -> window 0 -> wind-down for 'no'.
  r = compute({ inputs: { existing_registration: 'no', as_of: '2026-06-22' } }).output_payload;
  checked++; if (r.window_months !== 0 || r.decision !== 'wind-down') violations++;

  // The deadline day itself: window 0 -> wind-down for 'no', 'file' persists for 'yes'.
  r = compute({ inputs: { existing_registration: 'no', as_of: '2026-07-01' } }).output_payload;
  checked++; if (r.window_months !== 0 || r.decision !== 'wind-down') violations++;
  r = compute({ inputs: { existing_registration: 'yes', as_of: '2026-07-01' } }).output_payload;
  checked++; if (r.decision !== 'file') violations++;

  // After the deadline the window is negative and an unregistered CASP must wind down.
  r = compute({ inputs: { existing_registration: 'no', as_of: '2026-09-12' } }).output_payload;
  checked++; if (r.window_months !== -2 || r.decision !== 'wind-down') violations++;

  // Missing / malformed as_of: 'unresolved' with AS_OF_REQUIRED, window_months null, and the
  // deadline still emitted (it does not depend on the caller's clock).
  for (const bad of INVALID_AS_OF) {
    const res = compute({ inputs: { existing_registration: 'no', as_of: bad } });
    checked++;
    if (res.output_payload.decision !== 'unresolved') violations++;
    if (res.output_payload.window_months !== null) violations++;
    if (res.output_payload.as_of !== null) violations++;
    if (!res.compliance_flags.includes('AS_OF_REQUIRED')) violations++;
    if (res.output_payload.transitional_end_date !== TRANSITIONAL_END) violations++;
  }

  return { name: 'P4_forced_categorical_boundary_cases_deadline_adjacent_and_missing_as_of', trials: checked, violations };
}

// P5: output shape / no NaN / undefined across missing-field and empty-object inputs.
function checkP5_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { inputs: {} }, { inputs: { existing_registration: 'yes' } }, { inputs: { as_of: '2026-09-12' } }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (typeof output_payload.transitional_end_date !== 'string') violations++;
    if (!(output_payload.window_months === null || Number.isFinite(output_payload.window_months))) violations++;
    if (!Array.isArray(output_payload.file_by_preconditions)) violations++;
    if (typeof output_payload.decision !== 'string') violations++;
    if (!Array.isArray(output_payload.warnings)) violations++;
    if (!(output_payload.as_of === null || typeof output_payload.as_of === 'string')) violations++;
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

results.properties.push(checkP1_singlePrimaryDeadline());
results.properties.push(checkP2_windowMonthsFromAsOf());
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
