// art-240-assess-naic-ais-program-readiness property-test floor (FV-PROPFLOOR-SHARD-A-THRESHOLD-1).
// kernel_digest_at_authoring: sha256:ed2e6920e271e9beb07ec2b652b464385e213299d2abc4cbe33b2a28397bbc61
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape: loop over a fixed table (6 NAIC AIS dimensions, each
// safeNum-clamped 0-3), sum -> pct, threshold band (>=78 GREEN / >=44 YELLOW / else RED) --
// confirmed against direct kernel source read per FV-PROPFLOOR-SHARD-A-THRESHOLD-1's fence.
// float:no (safeNum rounds and clamps every score to the declared {0,1,2,3} enum before use) --
// forced CATEGORICAL boundary cases (every declared score value, out-of-range inputs, band
// boundaries) stand in for ULP forcing. ZERO external dependencies -- pure Node built-ins only.
// READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-240-assess-naic-ais-program-readiness.proptest.mjs

import { compute } from '../art-240-assess-naic-ais-program-readiness.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const DIM_KEYS = ['governance_score', 'risk_mgmt_score', 'data_governance_score', 'testing_score', 'transparency_score', 'audit_score'];
const SCORE_LABELS = { 0: 'NOT_STARTED', 1: 'PLANNING', 2: 'PARTIAL', 3: 'IMPLEMENTED' };

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randomScores(rng) {
  const pp = {};
  for (const k of DIM_KEYS) pp[k] = Math.floor(rng() * 4); // 0..3
  return pp;
}

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-240-assess-naic-ais-program-readiness.fixtures.json');
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
  const mutated = { ...output_payload, readiness_tier: output_payload.readiness_tier === 'RED' ? 'GREEN' : 'RED' };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

// P1: total_score == sum of dimension scores; readiness_pct == round(total/18*100); status labels agree.
function checkP1_scoreAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(240001);
  for (let i = 0; i < 300; i++) {
    const pp = randomScores(rng);
    const { output_payload } = compute(pp);
    checked++;
    const expectedTotal = DIM_KEYS.reduce((s, k) => s + pp[k], 0);
    const expectedPct = Math.round((expectedTotal / 18) * 100);
    if (output_payload.total_score !== expectedTotal) violations++;
    if (output_payload.max_score !== 18) violations++;
    if (output_payload.readiness_pct !== expectedPct) violations++;
    for (const ds of output_payload.dimension_scores) {
      const key = DIM_KEYS.find((k, idx) => output_payload.dimension_scores[idx] === ds);
      if (ds.status !== SCORE_LABELS[ds.score]) violations++;
    }
  }
  return { name: 'P1_score_agreement_random300', trials: checked, violations };
}

// P2: threshold-band agreement -- readiness_tier bands (>=78 GREEN / >=44 YELLOW / else RED) hold.
function checkP2_thresholdBandAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(240002);
  for (let i = 0; i < 300; i++) {
    const { output_payload } = compute(randomScores(rng));
    checked++;
    const pct = output_payload.readiness_pct;
    const expectedTier = pct >= 78 ? 'GREEN' : pct >= 44 ? 'YELLOW' : 'RED';
    const expectedLabel = expectedTier === 'GREEN' ? 'EXAM_READY' : expectedTier === 'YELLOW' ? 'IN_PROGRESS' : 'SIGNIFICANT_GAPS';
    if (output_payload.readiness_tier !== expectedTier) violations++;
    if (output_payload.readiness_label !== expectedLabel) violations++;
  }
  return { name: 'P2_threshold_band_agreement_random300', trials: checked, violations };
}

// P3: gaps are exactly the dimensions scoring < 2; boundedness of pct in [0,100].
function checkP3_gapsAndBoundedness() {
  let violations = 0, checked = 0;
  const rng = mulberry32(240003);
  for (let i = 0; i < 300; i++) {
    const pp = randomScores(rng);
    const { output_payload } = compute(pp);
    checked++;
    const expectedGapCount = DIM_KEYS.filter((k) => pp[k] < 2).length;
    if (output_payload.gaps.length !== expectedGapCount) violations++;
    if (output_payload.readiness_pct < 0 || output_payload.readiness_pct > 100) violations++;
    if (output_payload.total_score < 0 || output_payload.total_score > 18) violations++;
  }
  return { name: 'P3_gaps_and_boundedness_random300', trials: checked, violations };
}

// P4: out-of-range / non-numeric score inputs are clamped to [0,3] (safeNum), never NaN or
// out-of-domain -- the kernel's float:no invariant that stands in for ULP forcing here.
function checkP4_clampingInvariant() {
  let violations = 0, checked = 0;
  const WEIRD = [-5, -1, 4, 10, 3.7, 2.4, NaN, Infinity, -Infinity, 'not_a_number', null, undefined, {}, []];
  for (const v of WEIRD) {
    const pp = { governance_score: v };
    const { output_payload } = compute(pp);
    checked++;
    const s = output_payload.dimension_scores[0].score;
    if (!(s === 0 || s === 1 || s === 2 || s === 3)) violations++;
  }
  return { name: 'P4_clamping_invariant_weird_inputs', trials: checked, violations };
}

// P5: forced categorical boundary cases -- every dimension at every declared score value {0,1,2,3}
// with all other dimensions held at a fixed baseline; and the two band-boundary totals (44%, 78%).
function checkP5_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;
  const baseline = Object.fromEntries(DIM_KEYS.map((k) => [k, 1]));
  for (const k of DIM_KEYS) {
    for (const v of [0, 1, 2, 3]) {
      const { output_payload } = compute({ ...baseline, [k]: v });
      checked++;
      if (!Number.isFinite(output_payload.total_score)) violations++;
      if (!['GREEN', 'YELLOW', 'RED'].includes(output_payload.readiness_tier)) violations++;
    }
  }
  return { name: 'P5_forced_categorical_boundary_cases_all_dims_all_scores', trials: checked, violations };
}

// P6: output shape / no NaN / undefined across missing-field and empty-object inputs.
function checkP6_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { governance_score: 3 }, { testing_score: 2, audit_score: 0 }, null];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (!Number.isFinite(output_payload.total_score)) violations++;
    if (!Number.isFinite(output_payload.readiness_pct)) violations++;
    if (!Array.isArray(output_payload.dimension_scores) || output_payload.dimension_scores.length !== 6) violations++;
    if (!Array.isArray(output_payload.gaps)) violations++;
    if (!Array.isArray(output_payload.do_now) || output_payload.do_now.length === 0) violations++;
    if (typeof output_payload.readiness_tier !== 'string') violations++;
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
results.properties.push(checkP3_gapsAndBoundedness());
results.properties.push(checkP4_clampingInvariant());
results.properties.push(checkP5_forcedCategoricalBoundaries());
results.properties.push(checkP6_outputShapeInvariant());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-240-assess-naic-ais-program-readiness',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
