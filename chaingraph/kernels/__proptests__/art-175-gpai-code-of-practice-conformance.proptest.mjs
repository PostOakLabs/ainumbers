// art-175-gpai-code-of-practice-conformance property-test floor (FV-PROPFLOOR-SHARD-A-REMAINDER-2).
// kernel_digest_at_authoring: sha256:2d637077ba70bc4b83f6fac794cc8969d09aefb67b7e5db694afbe5d9ffe8907
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape: base+systemic checklist scorer -- 4 base Art.53 boolean
// checks + (conditionally) 4 Art.55 systemic-risk boolean checks, each rolled into a 0-100
// Math.round() score, with a not_applicable short-circuit when is_gpai_provider is false --
// confirmed against direct kernel source read per this row's fence.
// float:no (all inputs are declared booleans, scores are Math.round()'d integers) -- forced
// CATEGORICAL boundary cases (every base x systemic true/false combination) stand in for ULP
// forcing. ZERO external dependencies -- pure Node built-ins only. READ-ONLY w.r.t. the kernel
// it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-175-gpai-code-of-practice-conformance.proptest.mjs

import { compute } from '../art-175-gpai-code-of-practice-conformance.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const BASE_CHECKS = ['technical_documentation', 'training_data_summary', 'copyright_policy', 'model_card_published'];
const SYSTEMIC_CHECKS = ['systemic_risk_eval_conducted', 'adversarial_testing_done', 'incident_reporting_active', 'cybersecurity_measures'];

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randomProvider(rng) {
  const p = { is_gpai_provider: rng() < 0.85, is_systemic_risk: rng() < 0.5, code_of_practice_signed: rng() < 0.5 };
  for (const k of [...BASE_CHECKS, ...SYSTEMIC_CHECKS]) p[k] = rng() < 0.5;
  return p;
}

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-175-gpai-code-of-practice-conformance.fixtures.json');
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
  const { output_payload } = compute({ provider: { is_gpai_provider: true } });
  const mutated = { ...output_payload, base_score: output_payload.base_score === 0 ? 100 : 0 };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

// P1: not_applicable short-circuit is exact -- only fires when is_gpai_provider !== true.
function checkP1_notApplicableShortCircuit() {
  let violations = 0, checked = 0;
  const rng = mulberry32(175001);
  for (let i = 0; i < 300; i++) {
    const provider = randomProvider(rng);
    const { output_payload } = compute({ provider });
    checked++;
    const shouldBeNA = provider.is_gpai_provider !== true;
    if (shouldBeNA && output_payload.not_applicable !== true) violations++;
    if (!shouldBeNA && output_payload.not_applicable !== undefined) violations++;
  }
  return { name: 'P1_not_applicable_short_circuit_random300', trials: checked, violations };
}

// P2: base_score/base_conformant/base_gaps agree with the 4-item Art.53 checklist.
function checkP2_baseScoreAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(175002);
  for (let i = 0; i < 300; i++) {
    const provider = { ...randomProvider(rng), is_gpai_provider: true };
    const { output_payload } = compute({ provider });
    checked++;
    const passed = BASE_CHECKS.filter((k) => provider[k] === true).length;
    const expectedScore = Math.round((passed / BASE_CHECKS.length) * 100);
    if (output_payload.base_score !== expectedScore) violations++;
    if (output_payload.base_conformant !== (passed === BASE_CHECKS.length)) violations++;
    if (output_payload.base_gaps.length !== BASE_CHECKS.length - passed) violations++;
  }
  return { name: 'P2_base_score_agreement_random300', trials: checked, violations };
}

// P3: systemic fields null when not systemic-risk; scored correctly when they are;
// overall_score = mean(base,systemic) when systemic, else base_score.
function checkP3_systemicAndOverallAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(175003);
  for (let i = 0; i < 300; i++) {
    const provider = { ...randomProvider(rng), is_gpai_provider: true };
    const { output_payload } = compute({ provider });
    checked++;
    if (!provider.is_systemic_risk) {
      if (output_payload.systemic_score !== null) violations++;
      if (output_payload.systemic_risk_conformant !== null) violations++;
      if (output_payload.overall_score !== output_payload.base_score) violations++;
    } else {
      const passed = SYSTEMIC_CHECKS.filter((k) => provider[k] === true).length;
      const expectedSystemic = Math.round((passed / SYSTEMIC_CHECKS.length) * 100);
      if (output_payload.systemic_score !== expectedSystemic) violations++;
      if (output_payload.systemic_risk_conformant !== (passed === SYSTEMIC_CHECKS.length)) violations++;
      const expectedOverall = Math.round((output_payload.base_score + expectedSystemic) / 2);
      if (output_payload.overall_score !== expectedOverall) violations++;
    }
  }
  return { name: 'P3_systemic_and_overall_agreement_random300', trials: checked, violations };
}

// P4: forced categorical boundary cases -- not-a-provider, all-false, all-true (base + systemic),
// and systemic-risk with base-only conformance.
function checkP4_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;

  let r = compute({ provider: { is_gpai_provider: false } }).output_payload;
  checked++; if (r.not_applicable !== true) violations++;

  const allFalse = { is_gpai_provider: true, is_systemic_risk: true };
  for (const k of [...BASE_CHECKS, ...SYSTEMIC_CHECKS]) allFalse[k] = false;
  r = compute({ provider: allFalse }).output_payload;
  checked++; if (r.base_score !== 0 || r.systemic_score !== 0 || r.overall_score !== 0) violations++;

  const allTrue = { is_gpai_provider: true, is_systemic_risk: true, code_of_practice_signed: true };
  for (const k of [...BASE_CHECKS, ...SYSTEMIC_CHECKS]) allTrue[k] = true;
  r = compute({ provider: allTrue }).output_payload;
  checked++; if (r.base_score !== 100 || r.systemic_score !== 100 || r.overall_score !== 100) violations++;

  const baseOnly = { is_gpai_provider: true, is_systemic_risk: false };
  for (const k of BASE_CHECKS) baseOnly[k] = true;
  r = compute({ provider: baseOnly }).output_payload;
  checked++; if (r.base_score !== 100 || r.overall_score !== 100 || r.systemic_score !== null) violations++;

  return { name: 'P4_forced_categorical_boundary_cases_all_and_not_applicable', trials: checked, violations };
}

// P5: output shape / no NaN / undefined across missing-field and empty-object inputs.
function checkP5_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { provider: {} }, { provider: { is_gpai_provider: true } }, { provider: { is_gpai_provider: true, is_systemic_risk: true } }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.not_applicable === true) {
      if (typeof output_payload.reason !== 'string') violations++;
    } else {
      if (typeof output_payload.is_gpai_provider !== 'boolean') violations++;
      if (!Array.isArray(output_payload.base_gaps)) violations++;
    }
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

results.properties.push(checkP1_notApplicableShortCircuit());
results.properties.push(checkP2_baseScoreAgreement());
results.properties.push(checkP3_systemicAndOverallAgreement());
results.properties.push(checkP4_forcedCategoricalBoundaries());
results.properties.push(checkP5_outputShapeInvariant());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-175-gpai-code-of-practice-conformance',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
