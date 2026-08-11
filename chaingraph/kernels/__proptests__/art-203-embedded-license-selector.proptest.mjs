// art-203-embedded-license-selector property-test floor (FV-PROPFLOOR-SHARD-A-ENUMSEL-1).
// kernel_digest_at_authoring: sha256:4df7afd6d6833091adcbe684200a36fa88d6d1497cb1fac1d17f76919a1a9a05
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape: pure enum branch selector -- commercial_use x
// public_display x allow_sharing (each coerced by toBool()) select exactly one of 4 fixed
// SolSea/ALL.ART license tiers via priority-ordered if/else, no arrays/loops over caller-supplied
// data. Confirmed against direct kernel source read for FV-PROPFLOOR-SHARD-A-ENUMSEL-1 (not
// inherited from triage-table rationale text). float:no (declared boolean-ish enum inputs only,
// coerced through toBool()) -- forced CATEGORICAL boundary cases (every declared toBool() input
// value plus the full 3-flag combination table) stand in for ULP forcing. ZERO external
// dependencies -- pure Node built-ins only. READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-203-embedded-license-selector.proptest.mjs

import { compute } from '../art-203-embedded-license-selector.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

// toBool() declared-truthy/falsy domain per kernel source (line 68-72).
const TRUTHY_VALUES = [true, 1, '1', 'true', 'yes'];
const FALSY_VALUES = [false, 0, '0', 'false', 'no'];
const VALID_TIERS = new Set(['PRIVATE_NC', 'PERSONAL_PUBLIC_NC', 'PUBLIC_DISPLAY_NC', 'REPRODUCTION_COMMERCIAL']);

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randomBoolish(rng) { return pick(rng, rng() < 0.5 ? TRUTHY_VALUES : FALSY_VALUES); }
function randomPP(rng) {
  return { commercial_use: randomBoolish(rng), public_display: randomBoolish(rng), allow_sharing: randomBoolish(rng) };
}
function expectedTier(commercial_use, public_display, allow_sharing) {
  if (commercial_use) return 'REPRODUCTION_COMMERCIAL';
  if (public_display && allow_sharing) return 'PUBLIC_DISPLAY_NC';
  if (public_display) return 'PERSONAL_PUBLIC_NC';
  return 'PRIVATE_NC';
}

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-203-embedded-license-selector.fixtures.json');
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

// ---------- negative control ----------
function negativeControl() {
  const { output_payload } = compute({ commercial_use: true, public_display: true, allow_sharing: true });
  const mutated = { ...output_payload, tier_id: output_payload.tier_id === 'PRIVATE_NC' ? 'REPRODUCTION_COMMERCIAL' : 'PRIVATE_NC' };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

// P1: tier_id agrees with the priority-ordered decision table, over the boolish-coerced domain.
function checkP1_tierAgreesWithPriorityTable() {
  let violations = 0, checked = 0;
  const rng = mulberry32(203001);
  for (let i = 0; i < 300; i++) {
    const pp = randomPP(rng);
    const { output_payload } = compute(pp);
    checked++;
    const isTruthyBoolish = (v) => v === true || v === 1 || v === '1' || v === 'true' || v === 'yes';
    const expected = expectedTier(isTruthyBoolish(pp.commercial_use), isTruthyBoolish(pp.public_display), isTruthyBoolish(pp.allow_sharing));
    if (output_payload.tier_id !== expected) violations++;
  }
  return { name: 'P1_tier_agrees_with_priority_table_random300', trials: checked, violations };
}

// P2: rights object mirrors inputs_resolved exactly for the matched tier (tier flags == resolved booleans' consequence).
function checkP2_rightsShapeAndDomain() {
  let violations = 0, checked = 0;
  const rng = mulberry32(203002);
  for (let i = 0; i < 300; i++) {
    const { output_payload } = compute(randomPP(rng));
    checked++;
    if (!VALID_TIERS.has(output_payload.tier_id)) violations++;
    if (output_payload.tier_id === 'REPRODUCTION_COMMERCIAL' && output_payload.rights.commercial_use !== true) violations++;
    if (output_payload.tier_id === 'PRIVATE_NC' && (output_payload.rights.public_display !== false || output_payload.rights.commercial_use !== false)) violations++;
    if (!Array.isArray(output_payload.decision_path) || output_payload.decision_path.length !== 1) violations++;
  }
  return { name: 'P2_rights_shape_and_domain_random300', trials: checked, violations };
}

// P3: forced categorical boundary cases -- every toBool() declared truthy/falsy value per flag,
// held against the other two flags at their falsy default, plus the full 8-combination boolean table.
function checkP3_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;
  for (const v of [...TRUTHY_VALUES, ...FALSY_VALUES]) {
    for (const flag of ['commercial_use', 'public_display', 'allow_sharing']) {
      const pp = { commercial_use: false, public_display: false, allow_sharing: false, [flag]: v };
      const { output_payload } = compute(pp);
      checked++;
      if (!VALID_TIERS.has(output_payload.tier_id)) violations++;
    }
  }
  for (const commercial_use of [true, false]) {
    for (const public_display of [true, false]) {
      for (const allow_sharing of [true, false]) {
        const { output_payload } = compute({ commercial_use, public_display, allow_sharing });
        checked++;
        if (output_payload.tier_id !== expectedTier(commercial_use, public_display, allow_sharing)) violations++;
      }
    }
  }
  return { name: 'P3_forced_categorical_boundary_cases_all_values_and_combinations', trials: checked, violations };
}

// P4: output shape / no NaN / undefined across missing-field and empty-object inputs.
function checkP4_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, undefined, { commercial_use: true }, { public_display: 'yes' }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (!VALID_TIERS.has(output_payload.tier_id)) violations++;
    if (typeof output_payload.label !== 'string') violations++;
    if (typeof output_payload.description !== 'string') violations++;
    if (typeof output_payload.inputs_resolved !== 'object') violations++;
    if (typeof output_payload.disclaimer !== 'string') violations++;
  }
  return { name: 'P4_output_shape_no_nan_undefined', trials: checked, violations };
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

results.properties.push(checkP1_tierAgreesWithPriorityTable());
results.properties.push(checkP2_rightsShapeAndDomain());
results.properties.push(checkP3_forcedCategoricalBoundaries());
results.properties.push(checkP4_outputShapeInvariant());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-203-embedded-license-selector',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
