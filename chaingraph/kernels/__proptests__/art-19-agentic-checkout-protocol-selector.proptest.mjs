// art-19-agentic-checkout-protocol-selector property-test floor (FV-PROPFLOOR-SHARD-A-THRESHOLD-1).
// kernel_digest_at_authoring: sha256:54bf86b639f6937f1bebc4f6917ea4d67b90b1dac613e45cd88b01467013ba5f
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape: loop over a fixed table (4 protocols UCP/ACP/x402/TAP,
// each a hand-written score() over declared-enum fields), then threshold scoring
// (scoreLabel: >=70 recommended, >=45 viable, >=25 marginal, else not_recommended). This is a
// NEW class-A sub-family per FV-PROPFLOOR-SHARD-A-THRESHOLD-1's own fence -- confirmed against
// direct kernel source read, not inherited from the triage-table rationale text.
// float:no (all inputs are declared string enums / one boolean, no numeric float fields) --
// forced CATEGORICAL boundary cases (every enum value, per spec §3's float:no carve-out) stand
// in for ULP forcing. ZERO external dependencies -- pure Node built-ins only. READ-ONLY w.r.t.
// the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-19-agentic-checkout-protocol-selector.proptest.mjs

import { compute } from '../art-19-agentic-checkout-protocol-selector.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const PROTOCOLS = ['UCP', 'ACP', 'x402', 'TAP'];
const ENUM_DOMAIN = {
  platform: ['saas', 'shopify', 'custom', 'nocode'],
  buyer_type: ['consumer', 'mixed', 'agent'],
  aov: ['micro', 'low', 'mid', 'high', 'enterprise'],
  agent_appetite: ['none', 'moderate', 'high'],
  geo: ['us', 'global', 'other'],
  tech_cap: ['api', 'nocode', 'other'],
};

// mulberry32 -- deterministic, reproducible seed (B1 pilot's proven zero-dep pattern).
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randomProfile(rng) {
  return {
    platform: pick(rng, ENUM_DOMAIN.platform),
    buyer_type: pick(rng, ENUM_DOMAIN.buyer_type),
    aov: pick(rng, ENUM_DOMAIN.aov),
    agent_appetite: pick(rng, ENUM_DOMAIN.agent_appetite),
    geo: pick(rng, ENUM_DOMAIN.geo),
    tech_cap: pick(rng, ENUM_DOMAIN.tech_cap),
    stack_card: rng() < 0.5,
    stack_crypto: rng() < 0.5,
  };
}

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-19-agentic-checkout-protocol-selector.fixtures.json');
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
  const { output_payload } = compute({ platform: 'custom', buyer_type: 'agent', aov: 'mid', agent_appetite: 'high' });
  const mutated = { ...output_payload, primary_score: output_payload.primary_score === 100 ? 0 : 100 };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

// P1: every score in [0,100]; primary_recommendation is the argmax; protocol_scores covers all 4.
function checkP1_scoreBoundsAndArgmax() {
  let violations = 0, checked = 0;
  const rng = mulberry32(19001);
  for (let i = 0; i < 300; i++) {
    const { output_payload } = compute(randomProfile(rng));
    checked++;
    if (output_payload.protocol_scores.length !== 4) violations++;
    for (const row of output_payload.protocol_scores) {
      if (!Number.isFinite(row.score) || row.score < 0 || row.score > 100) violations++;
      if (!PROTOCOLS.includes(row.protocol)) violations++;
    }
    const maxScore = Math.max(...output_payload.protocol_scores.map((r) => r.score));
    if (output_payload.primary_score !== maxScore) violations++;
    if (output_payload.primary_score !== output_payload.protocol_scores[0].score) violations++;
  }
  return { name: 'P1_score_bounds_and_argmax_random300', trials: checked, violations };
}

// P2: threshold-label agreement -- scoreLabel bands (>=70/>=45/>=25/else) hold for every row.
function checkP2_thresholdLabelAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(19002);
  for (let i = 0; i < 300; i++) {
    const { output_payload } = compute(randomProfile(rng));
    for (const row of output_payload.protocol_scores) {
      checked++;
      const expected = row.score >= 70 ? 'recommended' : row.score >= 45 ? 'viable' : row.score >= 25 ? 'marginal' : 'not_recommended';
      if (row.label !== expected) violations++;
    }
  }
  return { name: 'P2_threshold_label_agreement_random300', trials: checked, violations };
}

// P3: viable_protocols/recommended_protocols are exactly the score-filtered subsets, monotone nesting.
function checkP3_viableRecommendedSubsetAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(19003);
  for (let i = 0; i < 300; i++) {
    const { output_payload } = compute(randomProfile(rng));
    checked++;
    const expectedViable = output_payload.protocol_scores.filter((r) => r.score >= 45).map((r) => r.protocol);
    const expectedRecommended = output_payload.protocol_scores.filter((r) => r.score >= 70).map((r) => r.protocol);
    if (JSON.stringify(output_payload.viable_protocols) !== JSON.stringify(expectedViable)) violations++;
    if (JSON.stringify(output_payload.recommended_protocols) !== JSON.stringify(expectedRecommended)) violations++;
    // recommended is always a subset of viable (70 >= 45)
    if (!output_payload.recommended_protocols.every((p) => output_payload.viable_protocols.includes(p))) violations++;
  }
  return { name: 'P3_viable_recommended_subset_nesting_random300', trials: checked, violations };
}

// P4: forced categorical boundary cases -- every declared enum value for every dimension, one at a time.
function checkP4_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;
  for (const [dim, values] of Object.entries(ENUM_DOMAIN)) {
    for (const v of values) {
      const pp = { platform: 'custom', buyer_type: 'agent', aov: 'mid', agent_appetite: 'moderate', geo: 'global', tech_cap: 'api', [dim]: v };
      const { output_payload } = compute(pp);
      checked++;
      if (!Number.isFinite(output_payload.primary_score) || output_payload.primary_score < 0 || output_payload.primary_score > 100) violations++;
      if (!PROTOCOLS.includes(output_payload.primary_recommendation)) violations++;
    }
  }
  return { name: 'P4_forced_categorical_boundary_cases_all_enum_values', trials: checked, violations };
}

// P5: output shape / no NaN / undefined across missing-field and empty-object inputs.
function checkP5_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { platform: 'saas' }, { buyer_type: 'consumer', aov: 'enterprise' }, { stack_card: true, stack_crypto: true }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (!Number.isFinite(output_payload.primary_score)) violations++;
    if (typeof output_payload.primary_recommendation !== 'string') violations++;
    if (!Array.isArray(output_payload.protocol_scores) || output_payload.protocol_scores.length !== 4) violations++;
    if (!Array.isArray(output_payload.viable_protocols)) violations++;
    if (!Array.isArray(output_payload.recommended_protocols)) violations++;
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

results.properties.push(checkP1_scoreBoundsAndArgmax());
results.properties.push(checkP2_thresholdLabelAgreement());
results.properties.push(checkP3_viableRecommendedSubsetAgreement());
results.properties.push(checkP4_forcedCategoricalBoundaries());
results.properties.push(checkP5_outputShapeInvariant());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-19-agentic-checkout-protocol-selector',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
