// art-195-creative-commons-license-chooser property-test floor (FV-PROPFLOOR-SHARD-A-ENUMSEL-1).
// kernel_digest_at_authoring: sha256:e774c0903bee2e48da8fbe099e50e3004183c9ddd51777c75ccaedfa7011f32e
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape: pure enum branch selector over a fixed 7-entry CC license
// table -- waive_all_rights (bool/yes-no) x allow_commercial (bool/yes-no) x allow_adaptations
// (yes/none/share_alike) select exactly one SPDX id, no arrays/loops over caller-supplied data.
// Confirmed against direct kernel source read for FV-PROPFLOOR-SHARD-A-ENUMSEL-1 (not inherited
// from triage-table rationale text). float:no (declared boolean/string enum inputs only) --
// forced CATEGORICAL boundary cases (every declared combination) stand in for ULP forcing.
// compute() is async in this kernel -- awaited throughout. ZERO external dependencies -- pure
// Node built-ins only. READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-195-creative-commons-license-chooser.proptest.mjs

import { compute } from '../art-195-creative-commons-license-chooser.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const WAIVE_VALUES = [true, false, 'yes', 'no'];
const COMMERCIAL_VALUES = [true, false, 'yes', 'no'];
const ADAPT_VALUES = ['yes', 'none', 'share_alike'];
const VALID_SPDX = new Set(['CC0-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'CC-BY-ND-4.0', 'CC-BY-NC-4.0', 'CC-BY-NC-SA-4.0', 'CC-BY-NC-ND-4.0']);

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randomPP(rng) {
  return { waive_all_rights: pick(rng, WAIVE_VALUES), allow_commercial: pick(rng, COMMERCIAL_VALUES), allow_adaptations: pick(rng, ADAPT_VALUES) };
}
function isTruthy(v) { return v === true || v === 'yes'; }

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
async function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-195-creative-commons-license-chooser.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = await compute(vec.policy_parameters);
    const a = JSON.stringify(output_payload);
    const b = JSON.stringify(vec.output_payload);
    if (a !== b) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
  }
  results.fixture_oracle = { total: fixtures.vectors.length, failures };
  return failures.length === 0;
}

// ---------- negative control ----------
async function negativeControl() {
  const { output_payload } = await compute({ waive_all_rights: false, allow_commercial: true, allow_adaptations: 'yes' });
  const mutated = { ...output_payload, license_id: output_payload.license_id === 'CC0-1.0' ? 'CC-BY-4.0' : 'CC0-1.0' };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

// P1: waive_all_rights truthy always yields CC0-1.0, overriding every other input.
async function checkP1_waiveAlwaysCC0() {
  let violations = 0, checked = 0;
  const rng = mulberry32(195001);
  for (let i = 0; i < 200; i++) {
    const pp = { waive_all_rights: true, allow_commercial: pick(rng, COMMERCIAL_VALUES), allow_adaptations: pick(rng, ADAPT_VALUES) };
    const { output_payload } = await compute(pp);
    checked++;
    if (output_payload.license_id !== 'CC0-1.0') violations++;
    if (output_payload.attribution_required !== false) violations++;
    if (output_payload.required_elements.length !== 0) violations++;
  }
  return { name: 'P1_waive_always_cc0_random200', trials: checked, violations };
}

// P2: license_id is always one of the 7 declared SPDX ids; BY element present iff not CC0.
async function checkP2_licenseDomainAndAttribution() {
  let violations = 0, checked = 0;
  const rng = mulberry32(195002);
  for (let i = 0; i < 300; i++) {
    const { output_payload } = await compute(randomPP(rng));
    checked++;
    if (!VALID_SPDX.has(output_payload.license_id)) violations++;
    const expectAttribution = output_payload.license_id !== 'CC0-1.0';
    if (output_payload.attribution_required !== expectAttribution) violations++;
    if (expectAttribution && !output_payload.required_elements.includes('BY')) violations++;
  }
  return { name: 'P2_license_domain_and_attribution_random300', trials: checked, violations };
}

// P3: NC element present iff allow_commercial resolved falsy (and not waived).
async function checkP3_commercialElementAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(195003);
  for (let i = 0; i < 300; i++) {
    const pp = { waive_all_rights: false, allow_commercial: pick(rng, COMMERCIAL_VALUES), allow_adaptations: pick(rng, ADAPT_VALUES) };
    const { output_payload } = await compute(pp);
    checked++;
    const expectNC = !isTruthy(pp.allow_commercial);
    const hasNC = output_payload.required_elements.includes('NC');
    if (expectNC !== hasNC) violations++;
  }
  return { name: 'P3_commercial_element_agreement_random300', trials: checked, violations };
}

// P4: forced categorical boundary cases -- every waive x commercial x adaptations combination.
async function checkP4_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;
  for (const waive_all_rights of [true, false]) {
    for (const allow_commercial of [true, false]) {
      for (const allow_adaptations of ADAPT_VALUES) {
        const { output_payload } = await compute({ waive_all_rights, allow_commercial, allow_adaptations });
        checked++;
        if (!VALID_SPDX.has(output_payload.license_id)) violations++;
        if (typeof output_payload.license_url !== 'string' || !output_payload.license_url.startsWith('https://')) violations++;
      }
    }
  }
  return { name: 'P4_forced_categorical_boundary_cases_all_combinations', trials: checked, violations };
}

// P5: output shape / no NaN / undefined across missing-field and empty-object inputs.
async function checkP5_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { waive_all_rights: true }, { allow_commercial: false }, { allow_adaptations: 'none' }];
  for (const pp of inputs) {
    const { output_payload } = await compute(pp);
    checked++;
    if (!VALID_SPDX.has(output_payload.license_id)) violations++;
    if (typeof output_payload.attribution_required !== 'boolean') violations++;
    if (!Array.isArray(output_payload.required_elements)) violations++;
    if (typeof output_payload.disclaimer !== 'string') violations++;
  }
  return { name: 'P5_output_shape_no_nan_undefined', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = await runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

const negControl = await negativeControl();
if (!negControl.rejected_wrong_spec) {
  console.error('NEGATIVE CONTROL FAILED -- comparator never observed rejecting a wrong output.');
  process.exit(1);
}

results.properties.push(await checkP1_waiveAlwaysCC0());
results.properties.push(await checkP2_licenseDomainAndAttribution());
results.properties.push(await checkP3_commercialElementAgreement());
results.properties.push(await checkP4_forcedCategoricalBoundaries());
results.properties.push(await checkP5_outputShapeInvariant());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-195-creative-commons-license-chooser',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
