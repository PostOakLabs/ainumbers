// art-173-ai-system-governance-classifier property-test floor (FV-PROPFLOOR-SHARD-A-REMAINDER-2).
// kernel_digest_at_authoring: sha256:5caa326f1f78233acb0b409deb37a1a0a943cd726640f2c145b2ddcfb4f632e6
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape: boolean/enum classifier -- 8 boolean/string flags feed a
// fixed if/else cascade producing eu_ai_act_tier (prohibited/high_risk/limited_risk/minimal_risk),
// which then deterministically derives nist_rmf_profile and iso42001_control_set, plus a
// gpai_obligations sub-object -- confirmed against direct kernel source read per this row's fence.
// float:no (all inputs are declared booleans/strings, no numeric fields) -- forced CATEGORICAL
// boundary cases (every prohibited/high-risk trigger combination) stand in for ULP forcing.
// ZERO external dependencies -- pure Node built-ins only. READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-173-ai-system-governance-classifier.proptest.mjs

import { compute } from '../art-173-ai-system-governance-classifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const HIGH_RISK_CONTEXTS = ['employment', 'credit', 'education', 'medical', 'law_enforcement', 'migration', 'justice'];
const BOOL_FIELDS = ['is_gpai', 'has_systemic_risk', 'is_autonomous', 'processes_biometrics', 'affects_critical_infrastructure', 'is_emotion_recognition'];
const DEPLOYMENT_CONTEXTS = [...HIGH_RISK_CONTEXTS, 'general', 'public_space_law_enforcement', 'workplace'];

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randomSystem(rng) {
  const s = { use_case: 'synthetic', deployment_context: pick(rng, DEPLOYMENT_CONTEXTS) };
  for (const f of BOOL_FIELDS) s[f] = rng() < 0.5;
  return s;
}
function expectedTier(s) {
  if ((s.processes_biometrics && s.deployment_context === 'public_space_law_enforcement') ||
      (s.is_emotion_recognition && (s.deployment_context === 'workplace' || s.deployment_context === 'education'))) {
    return 'prohibited';
  }
  if (s.affects_critical_infrastructure || HIGH_RISK_CONTEXTS.includes(s.deployment_context)) return 'high_risk';
  if (s.is_autonomous) return 'limited_risk';
  return 'minimal_risk';
}
function expectedProfileAndControlSet(tier) {
  if (tier === 'prohibited' || tier === 'high_risk') return { nist: 'T3_enhanced', iso: 'enhanced' };
  if (tier === 'limited_risk') return { nist: 'T2_standard', iso: 'standard' };
  return { nist: 'T1_basic', iso: 'light' };
}

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-173-ai-system-governance-classifier.fixtures.json');
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
  const { output_payload } = compute({ system: {} });
  const mutated = { ...output_payload, eu_ai_act_tier: output_payload.eu_ai_act_tier === 'minimal_risk' ? 'high_risk' : 'minimal_risk' };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

// P1: tier cascade agreement over the random declared-domain sample.
function checkP1_tierCascadeAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(173001);
  for (let i = 0; i < 300; i++) {
    const system = randomSystem(rng);
    const { output_payload } = compute({ system });
    checked++;
    if (output_payload.eu_ai_act_tier !== expectedTier(system)) violations++;
  }
  return { name: 'P1_tier_cascade_agreement_random300', trials: checked, violations };
}

// P2: nist_rmf_profile / iso42001_control_set are a pure function of eu_ai_act_tier.
function checkP2_profileControlSetAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(173002);
  for (let i = 0; i < 300; i++) {
    const { output_payload } = compute({ system: randomSystem(rng) });
    checked++;
    const exp = expectedProfileAndControlSet(output_payload.eu_ai_act_tier);
    if (output_payload.nist_rmf_profile !== exp.nist) violations++;
    if (output_payload.iso42001_control_set !== exp.iso) violations++;
  }
  return { name: 'P2_profile_control_set_pure_function_of_tier_random300', trials: checked, violations };
}

// P3: gpai_obligations shape -- applies mirrors is_gpai, systemic_risk true only if both set.
function checkP3_gpaiObligationsAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(173003);
  for (let i = 0; i < 300; i++) {
    const system = randomSystem(rng);
    const { output_payload } = compute({ system });
    checked++;
    if (output_payload.gpai_obligations.applies !== system.is_gpai) violations++;
    if (output_payload.gpai_obligations.systemic_risk !== (system.is_gpai && system.has_systemic_risk)) violations++;
  }
  return { name: 'P3_gpai_obligations_agreement_random300', trials: checked, violations };
}

// P4: forced categorical boundary cases -- both prohibited triggers, each high-risk context alone,
// autonomous-only, and the all-false minimal-risk floor.
function checkP4_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;
  const base = { deployment_context: 'general', is_gpai: false, has_systemic_risk: false, is_autonomous: false, processes_biometrics: false, affects_critical_infrastructure: false, is_emotion_recognition: false };

  let r = compute({ system: { ...base, processes_biometrics: true, deployment_context: 'public_space_law_enforcement' } }).output_payload;
  checked++; if (r.eu_ai_act_tier !== 'prohibited') violations++;

  r = compute({ system: { ...base, is_emotion_recognition: true, deployment_context: 'workplace' } }).output_payload;
  checked++; if (r.eu_ai_act_tier !== 'prohibited') violations++;

  r = compute({ system: { ...base, is_emotion_recognition: true, deployment_context: 'education' } }).output_payload;
  checked++; if (r.eu_ai_act_tier !== 'prohibited') violations++;

  for (const ctx of HIGH_RISK_CONTEXTS) {
    r = compute({ system: { ...base, deployment_context: ctx } }).output_payload;
    checked++; if (r.eu_ai_act_tier !== 'high_risk') violations++;
  }

  r = compute({ system: { ...base, affects_critical_infrastructure: true } }).output_payload;
  checked++; if (r.eu_ai_act_tier !== 'high_risk') violations++;

  r = compute({ system: { ...base, is_autonomous: true } }).output_payload;
  checked++; if (r.eu_ai_act_tier !== 'limited_risk') violations++;

  r = compute({ system: { ...base } }).output_payload;
  checked++; if (r.eu_ai_act_tier !== 'minimal_risk') violations++;

  return { name: 'P4_forced_categorical_boundary_cases_all_triggers', trials: checked, violations };
}

// P5: output shape / no NaN / undefined across missing-field and empty-object inputs.
function checkP5_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { system: {} }, { system: { use_case: 'x' } }, { system: { deployment_context: 'credit', is_gpai: true } }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (typeof output_payload.eu_ai_act_tier !== 'string') violations++;
    if (typeof output_payload.nist_rmf_profile !== 'string') violations++;
    if (typeof output_payload.iso42001_control_set !== 'string') violations++;
    if (typeof output_payload.gpai_obligations !== 'object' || output_payload.gpai_obligations === null) violations++;
    if (typeof output_payload.gpai_obligations.applies !== 'boolean') violations++;
    if (typeof output_payload.gpai_obligations.systemic_risk !== 'boolean') violations++;
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

results.properties.push(checkP1_tierCascadeAgreement());
results.properties.push(checkP2_profileControlSetAgreement());
results.properties.push(checkP3_gpaiObligationsAgreement());
results.properties.push(checkP4_forcedCategoricalBoundaries());
results.properties.push(checkP5_outputShapeInvariant());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-173-ai-system-governance-classifier',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
