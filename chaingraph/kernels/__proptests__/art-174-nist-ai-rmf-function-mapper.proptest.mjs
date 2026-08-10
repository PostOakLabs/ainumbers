// art-174-nist-ai-rmf-function-mapper property-test floor (FV-PROPFLOOR-SHARD-A-THRESHOLD-1).
// kernel_digest_at_authoring: sha256:a4ebaa6b0d2dc5a1fe2ef52ae2850bc85dcbea7221acd8dbae939d00039b6f9e
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape: loop over a fixed table (4 NIST functions x 17 boolean
// evidence fields), per-function 0-100 score, overall average, threshold band
// (<25 Minimal / <50 Partial / <75 Substantial / else Comprehensive) -- confirmed against direct
// kernel source read per FV-PROPFLOOR-SHARD-A-THRESHOLD-1's fence.
// float:no (all inputs are declared booleans; scores are Math.round()'d integers) -- forced
// CATEGORICAL boundary cases (every field true/false, band-boundary counts) stand in for ULP
// forcing. ZERO external dependencies -- pure Node built-ins only. READ-ONLY w.r.t. the kernel
// it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-174-nist-ai-rmf-function-mapper.proptest.mjs

import { compute } from '../art-174-nist-ai-rmf-function-mapper.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const FUNCTIONS = {
  GOVERN: ['govern_policy', 'govern_roles', 'govern_culture', 'govern_transparency', 'govern_accountability'],
  MAP: ['map_context', 'map_categorization', 'map_risk_identification', 'map_stakeholders'],
  MEASURE: ['measure_analysis', 'measure_monitoring', 'measure_testing', 'measure_benchmarking'],
  MANAGE: ['manage_response', 'manage_prioritization', 'manage_treatment', 'manage_residual_risk'],
};
const ALL_FIELDS = Object.values(FUNCTIONS).flat();

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randomEvidence(rng) {
  const e = {};
  for (const f of ALL_FIELDS) e[f] = rng() < 0.5;
  return e;
}

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-174-nist-ai-rmf-function-mapper.fixtures.json');
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
  const { output_payload } = compute({ evidence: {} });
  const mutated = { ...output_payload, overall_coverage: output_payload.overall_coverage === 100 ? 0 : 100 };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

// P1: per-function score == round(present/total*100); overall_coverage == round(mean of 4 scores);
// present+gaps.length == total for every function.
function checkP1_scoreAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(174001);
  for (let i = 0; i < 300; i++) {
    const evidence = randomEvidence(rng);
    const { output_payload } = compute({ evidence });
    checked++;
    let sum = 0;
    for (const [fn, fields] of Object.entries(FUNCTIONS)) {
      const present = fields.filter((f) => evidence[f] === true).length;
      const expectedScore = Math.round((present / fields.length) * 100);
      const fc = output_payload.function_coverage[fn];
      if (fc.score !== expectedScore) violations++;
      if (fc.present !== present) violations++;
      if (fc.present + fc.gaps.length !== fc.total) violations++;
      sum += fc.score;
    }
    const expectedOverall = Math.round(sum / 4);
    if (output_payload.overall_coverage !== expectedOverall) violations++;
  }
  return { name: 'P1_score_agreement_random300', trials: checked, violations };
}

// P2: threshold-band agreement -- coverage_band bands (<25/<50/<75/else) hold for every overall_coverage.
function checkP2_thresholdBandAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(174002);
  for (let i = 0; i < 300; i++) {
    const { output_payload } = compute({ evidence: randomEvidence(rng) });
    checked++;
    const c = output_payload.overall_coverage;
    const expected = c < 25 ? 'Minimal' : c < 50 ? 'Partial' : c < 75 ? 'Substantial' : 'Comprehensive';
    if (output_payload.coverage_band !== expected) violations++;
  }
  return { name: 'P2_threshold_band_agreement_random300', trials: checked, violations };
}

// P3: total_controls is fixed at 17; controls_present == 17 - all_gaps.length; boundedness [0,100].
function checkP3_totalControlsAndBoundedness() {
  let violations = 0, checked = 0;
  const rng = mulberry32(174003);
  for (let i = 0; i < 300; i++) {
    const { output_payload } = compute({ evidence: randomEvidence(rng) });
    checked++;
    if (output_payload.total_controls !== 17) violations++;
    if (output_payload.controls_present !== 17 - output_payload.all_gaps.length) violations++;
    if (output_payload.overall_coverage < 0 || output_payload.overall_coverage > 100) violations++;
    for (const fn of Object.keys(FUNCTIONS)) {
      const s = output_payload.function_coverage[fn].score;
      if (s < 0 || s > 100) violations++;
    }
  }
  return { name: 'P3_total_controls_fixed_and_boundedness_random300', trials: checked, violations };
}

// P4: forced categorical boundary cases -- all-false (0), all-true (100), and each function
// individually fully-true with the rest false (band boundaries).
function checkP4_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;
  const allFalse = Object.fromEntries(ALL_FIELDS.map((f) => [f, false]));
  const allTrue = Object.fromEntries(ALL_FIELDS.map((f) => [f, true]));
  let r = compute({ evidence: allFalse }).output_payload; checked++;
  if (r.overall_coverage !== 0 || r.coverage_band !== 'Minimal') violations++;
  r = compute({ evidence: allTrue }).output_payload; checked++;
  if (r.overall_coverage !== 100 || r.coverage_band !== 'Comprehensive') violations++;
  for (const fn of Object.keys(FUNCTIONS)) {
    const evidence = { ...allFalse };
    for (const f of FUNCTIONS[fn]) evidence[f] = true;
    const out = compute({ evidence }).output_payload;
    checked++;
    if (out.function_coverage[fn].score !== 100) violations++;
    if (out.function_coverage[fn].gaps.length !== 0) violations++;
  }
  return { name: 'P4_forced_categorical_boundary_cases_all_and_per_function', trials: checked, violations };
}

// P5: non-boolean / truthy-but-not-true values never count as present (strict === true read).
function checkP5_strictBooleanRead() {
  let violations = 0, checked = 0;
  const NEAR_TRUE = [1, '1', 'true', [], {}, null, undefined, 0, ''];
  for (const v of NEAR_TRUE) {
    const evidence = Object.fromEntries(ALL_FIELDS.map((f) => [f, v]));
    const { output_payload } = compute({ evidence });
    checked++;
    if (output_payload.overall_coverage !== 0) violations++;
  }
  return { name: 'P5_strict_boolean_read_non_true_never_counts', trials: checked, violations };
}

// P6: output shape / no NaN / undefined across missing-field and empty-object inputs.
function checkP6_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { evidence: {} }, { evidence: { govern_policy: true } }, { evidence: { measure_testing: true, manage_response: true } }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (!Number.isFinite(output_payload.overall_coverage)) violations++;
    if (typeof output_payload.coverage_band !== 'string') violations++;
    if (!Array.isArray(output_payload.all_gaps)) violations++;
    if (!Number.isFinite(output_payload.total_controls) || !Number.isFinite(output_payload.controls_present)) violations++;
    for (const fn of Object.keys(FUNCTIONS)) {
      if (!output_payload.function_coverage[fn]) violations++;
    }
  }
  return { name: 'P6_output_shape_no_nan_undefined', trials: checked, violations };
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

results.properties.push(checkP1_scoreAgreement());
results.properties.push(checkP2_thresholdBandAgreement());
results.properties.push(checkP3_totalControlsAndBoundedness());
results.properties.push(checkP4_forcedCategoricalBoundaries());
results.properties.push(checkP5_strictBooleanRead());
results.properties.push(checkP6_outputShapeInvariant());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-174-nist-ai-rmf-function-mapper',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
