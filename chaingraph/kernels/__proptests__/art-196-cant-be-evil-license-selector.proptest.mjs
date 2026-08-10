// art-196-cant-be-evil-license-selector property-test floor (FV-PROPFLOOR-SHARD-A-ENUMSEL-1).
// kernel_digest_at_authoring: sha256:c523b34f5294d1e6632a8ef888455d88c7fd1c912278c3080af0d1abac2527f4
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape: pure enum branch selector over a fixed 6-entry
// Can't-Be-Evil license matrix -- waive_all x commercial x exclusive x hate_speech_termination
// select exactly one cbe_id, no arrays/loops over caller-supplied data. Confirmed against direct
// kernel source read for FV-PROPFLOOR-SHARD-A-ENUMSEL-1 (not inherited from triage-table rationale
// text). float:no (declared boolean/string enum inputs only) -- forced CATEGORICAL boundary cases
// (every declared combination) stand in for ULP forcing. compute() is async in this kernel --
// awaited throughout. ZERO external dependencies -- pure Node built-ins only. READ-ONLY w.r.t. the
// kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-196-cant-be-evil-license-selector.proptest.mjs

import { compute } from '../art-196-cant-be-evil-license-selector.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const BOOL_VALUES = [true, false, 'yes', 'no'];
const VALID_CBE_IDS = new Set(['CBE_CC0', 'CBE_ECR', 'CBE_NECR', 'CBE_NECR_HS', 'CBE_PR', 'CBE_PR_HS']);

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
  return {
    waive_all: pick(rng, BOOL_VALUES),
    commercial: pick(rng, BOOL_VALUES),
    exclusive: pick(rng, BOOL_VALUES),
    hate_speech_termination: pick(rng, BOOL_VALUES),
  };
}

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
async function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-196-cant-be-evil-license-selector.fixtures.json');
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
  const { output_payload } = await compute({ waive_all: false, commercial: true, exclusive: false });
  const mutated = { ...output_payload, cbe_id: output_payload.cbe_id === 'CBE_ECR' ? 'CBE_NECR' : 'CBE_ECR' };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

// P1: waive_all truthy always yields CBE_CC0, overriding every other input.
async function checkP1_waiveAlwaysCC0() {
  let violations = 0, checked = 0;
  const rng = mulberry32(196001);
  for (let i = 0; i < 200; i++) {
    const pp = { waive_all: true, commercial: pick(rng, BOOL_VALUES), exclusive: pick(rng, BOOL_VALUES), hate_speech_termination: pick(rng, BOOL_VALUES) };
    const { output_payload } = await compute(pp);
    checked++;
    if (output_payload.cbe_id !== 'CBE_CC0') violations++;
    if (output_payload.creator_retains !== false) violations++;
    if (output_payload.license_version_index !== 0) violations++;
  }
  return { name: 'P1_waive_always_cc0_random200', trials: checked, violations };
}

// P2: cbe_id is always one of the 6 declared ids; ord always matches the launch-numbered index.
async function checkP2_cbeDomainAndOrdConsistency() {
  let violations = 0, checked = 0;
  const rng = mulberry32(196002);
  for (let i = 0; i < 300; i++) {
    const { output_payload } = await compute(randomPP(rng));
    checked++;
    if (!VALID_CBE_IDS.has(output_payload.cbe_id)) violations++;
    if (!Number.isInteger(output_payload.license_version_index) || output_payload.license_version_index < 0 || output_payload.license_version_index > 5) violations++;
    if (!output_payload.arweave_uri.endsWith('/' + output_payload.license_version_index)) violations++;
  }
  return { name: 'P2_cbe_domain_and_ord_consistency_random300', trials: checked, violations };
}

// P3: non-commercial branch (commercial falsy, not waived) always selects PERSONAL variants.
async function checkP3_nonCommercialSelectsPersonal() {
  let violations = 0, checked = 0;
  const rng = mulberry32(196003);
  for (let i = 0; i < 300; i++) {
    const pp = { waive_all: false, commercial: false, exclusive: pick(rng, BOOL_VALUES), hate_speech_termination: pick(rng, BOOL_VALUES) };
    const { output_payload } = await compute(pp);
    checked++;
    if (output_payload.cbe_id !== 'CBE_PR' && output_payload.cbe_id !== 'CBE_PR_HS') violations++;
    if (output_payload.commercial !== false) violations++;
    if (output_payload.derivatives !== false) violations++;
  }
  return { name: 'P3_non_commercial_selects_personal_random300', trials: checked, violations };
}

// P4: forced categorical boundary cases -- every waive x commercial x exclusive x hate combination.
async function checkP4_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;
  for (const waive_all of [true, false]) {
    for (const commercial of [true, false]) {
      for (const exclusive of [true, false]) {
        for (const hate_speech_termination of [true, false]) {
          const { output_payload } = await compute({ waive_all, commercial, exclusive, hate_speech_termination });
          checked++;
          if (!VALID_CBE_IDS.has(output_payload.cbe_id)) violations++;
          if (!Array.isArray(output_payload.caveats) || output_payload.caveats.length === 0) violations++;
        }
      }
    }
  }
  return { name: 'P4_forced_categorical_boundary_cases_all_combinations', trials: checked, violations };
}

// P5: output shape / no NaN / undefined across missing-field and empty-object inputs.
async function checkP5_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { waive_all: true }, { commercial: false }, { exclusive: true, hate_speech_termination: true }];
  for (const pp of inputs) {
    const { output_payload } = await compute(pp);
    checked++;
    if (!VALID_CBE_IDS.has(output_payload.cbe_id)) violations++;
    if (typeof output_payload.commercial !== 'boolean') violations++;
    if (typeof output_payload.creator_retains !== 'boolean') violations++;
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
results.properties.push(await checkP2_cbeDomainAndOrdConsistency());
results.properties.push(await checkP3_nonCommercialSelectsPersonal());
results.properties.push(await checkP4_forcedCategoricalBoundaries());
results.properties.push(await checkP5_outputShapeInvariant());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-196-cant-be-evil-license-selector',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
