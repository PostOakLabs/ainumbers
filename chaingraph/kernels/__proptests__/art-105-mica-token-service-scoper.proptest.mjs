// art-105-mica-token-service-scoper property-test floor (FV-PROPFLOOR-SHARD-A-ENUMSEL-1).
// kernel_digest_at_authoring: sha256:d0eebd3034d330eb5b1a17311674632a9254db5a191bde8f9508ca7f16d2b615
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape: pure enum branch selector -- token_type (art/emt/other/
// utility) x activity (issuance/service/both) route to one of a small fixed set of MiCA
// classifications, no arrays/loops over caller-supplied data. Confirmed against direct kernel
// source read for FV-PROPFLOOR-SHARD-A-ENUMSEL-1 (not inherited from triage-table rationale text).
// float:no (declared string enum inputs only) -- forced CATEGORICAL boundary cases (every
// token_type x activity combination) stand in for ULP forcing. ZERO external dependencies --
// pure Node built-ins only. READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-105-mica-token-service-scoper.proptest.mjs

import { compute } from '../art-105-mica-token-service-scoper.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const TOKEN_TYPES = ['art', 'emt', 'other', 'utility'];
const ACTIVITIES = ['issuance', 'service', 'both'];
const ROUTE_TARGETS = new Set(['existing-stablecoin-chains', 'wave20-mica-chains', 'national-rules-check', 'both']);

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
  return { inputs: { token_type: pick(rng, TOKEN_TYPES), activity: pick(rng, ACTIVITIES) } };
}

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-105-mica-token-service-scoper.fixtures.json');
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
  const { output_payload } = compute({ inputs: { token_type: 'art', activity: 'issuance' } });
  const mutated = { ...output_payload, route_target: output_payload.route_target === 'both' ? 'wave20-mica-chains' : 'both' };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

// P1: delegated_to_existing consistency -- true iff (art|emt) AND activity==='issuance'; the
// two delegation arrays are mutually exclusive and non-empty exactly opposite to the flag.
function checkP1_delegationConsistency() {
  let violations = 0, checked = 0;
  const rng = mulberry32(105001);
  for (let i = 0; i < 300; i++) {
    const pp = randomPP(rng);
    const { output_payload } = compute(pp);
    checked++;
    const isArtEmt = pp.inputs.token_type === 'art' || pp.inputs.token_type === 'emt';
    const expectedDelegated = isArtEmt && pp.inputs.activity === 'issuance';
    if (output_payload.delegated_to_existing !== expectedDelegated) violations++;
    if (expectedDelegated) {
      if (output_payload.existing_chains_delegated.length === 0) violations++;
      if (output_payload.wave20_chains_applicable.length !== 0) violations++;
    } else {
      if (output_payload.wave20_chains_applicable.length === 0) violations++;
      if (output_payload.existing_chains_delegated.length !== 0) violations++;
    }
  }
  return { name: 'P1_delegation_consistency_random300', trials: checked, violations };
}

// P2: route_target is always one of the four declared targets; classification is a non-empty string.
function checkP2_routeTargetDomain() {
  let violations = 0, checked = 0;
  const rng = mulberry32(105002);
  for (let i = 0; i < 300; i++) {
    const { output_payload } = compute(randomPP(rng));
    checked++;
    if (!ROUTE_TARGETS.has(output_payload.route_target)) violations++;
    if (typeof output_payload.classification !== 'string' || output_payload.classification.length === 0) violations++;
    if (typeof output_payload.rationale !== 'string' || output_payload.rationale.length === 0) violations++;
  }
  return { name: 'P2_route_target_domain_random300', trials: checked, violations };
}

// P3: forced categorical boundary cases -- every token_type x activity combination.
function checkP3_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;
  for (const token_type of TOKEN_TYPES) {
    for (const activity of ACTIVITIES) {
      const { output_payload } = compute({ inputs: { token_type, activity } });
      checked++;
      if (!ROUTE_TARGETS.has(output_payload.route_target)) violations++;
      if (typeof output_payload.classification !== 'string' || output_payload.classification.length === 0) violations++;
      if (typeof output_payload.delegated_to_existing !== 'boolean') violations++;
    }
  }
  return { name: 'P3_forced_categorical_boundary_cases_all_combinations', trials: checked, violations };
}

// P4: output shape / no NaN / undefined across missing-field and empty-object inputs.
function checkP4_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { inputs: {} }, { inputs: { token_type: 'art' } }, { inputs: { activity: 'service' } }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (typeof output_payload.classification !== 'string') violations++;
    if (typeof output_payload.route_target !== 'string') violations++;
    if (typeof output_payload.delegated_to_existing !== 'boolean') violations++;
    if (!Array.isArray(output_payload.existing_chains_delegated)) violations++;
    if (!Array.isArray(output_payload.wave20_chains_applicable)) violations++;
    if (output_payload.mica_note === undefined) violations++;
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

results.properties.push(checkP1_delegationConsistency());
results.properties.push(checkP2_routeTargetDomain());
results.properties.push(checkP3_forcedCategoricalBoundaries());
results.properties.push(checkP4_outputShapeInvariant());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-105-mica-token-service-scoper',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
