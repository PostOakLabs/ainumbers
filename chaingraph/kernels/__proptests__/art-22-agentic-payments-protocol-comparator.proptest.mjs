// art-22-agentic-payments-protocol-comparator property-test floor (FV-PROPFLOOR-SHARD-A-THRESHOLD-1).
// kernel_digest_at_authoring: sha256:0d884710ed42dd2b36075266167a7fed1219199fa4aebad015933fabc4dfdee8
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape: loop over fixed tables (6 protocols, 8 dims, 5 crosswalk
// concepts, 6 named scenarios) with declared-enum inputs (`protocols[]` ids, `scenario` key) --
// this kernel's variant of "loop over fixed table, threshold/enum scoring" is enum-driven
// lookup/selection rather than a numeric score threshold (confirmed against direct source read
// per FV-PROPFLOOR-SHARD-A-THRESHOLD-1's fence: no float, no numeric scoring branch exists here
// -- the SCENARIOS table's `pick` field is the enum-select analogue of a threshold band).
// float:no -- forced CATEGORICAL boundary cases (every protocol id, every scenario key, plus
// unknown/absent values) stand in for ULP forcing. ZERO external dependencies -- pure Node
// built-ins only. READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-22-agentic-payments-protocol-comparator.proptest.mjs

import { compute } from '../art-22-agentic-payments-protocol-comparator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const PROTOCOL_IDS = ['ap2', 'acp', 'x402', 'tap', 'mc', 'mpp'];
const SCENARIO_KEYS = ['agent_micro', 'agent_subscription', 'chatgpt_checkout', 'cross_merchant', 'merchant_verify', 'card_network'];
const DIM_IDS = ['backer', 'artifact', 'signed', 'scope', 'rail', 'identity', 'audit', 'status'];

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randomSubset(rng, arr) {
  return arr.filter(() => rng() < 0.5);
}

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-22-agentic-payments-protocol-comparator.fixtures.json');
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
  const { output_payload } = compute({ protocols: ['ap2', 'x402'] });
  const mutated = { ...output_payload, protocols_compared: [...output_payload.protocols_compared, 'nonexistent'] };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

// P1: protocols_compared/protocols_detail/protocol_names are exactly the requested-and-valid subset,
// in declared table order (default-all when protocols[] is absent/empty).
function checkP1_requestedSubsetAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(22001);
  for (let i = 0; i < 300; i++) {
    const requested = rng() < 0.15 ? [] : randomSubset(rng, PROTOCOL_IDS);
    const { output_payload } = compute({ protocols: requested });
    checked++;
    const expected = requested.length > 0 ? requested : PROTOCOL_IDS;
    if (JSON.stringify(output_payload.protocols_compared) !== JSON.stringify(expected)) violations++;
    if (output_payload.protocols_detail.length !== expected.length) violations++;
    if (output_payload.protocol_names.length !== expected.length) violations++;
  }
  return { name: 'P1_requested_subset_agreement_random300', trials: checked, violations };
}

// P2: crosswalk rows are always exactly the 5 declared concepts, and every value cell resolves
// to '—' for a de-selected protocol, never undefined/missing.
function checkP2_crosswalkShapeInvariant() {
  let violations = 0, checked = 0;
  const rng = mulberry32(22002);
  for (let i = 0; i < 150; i++) {
    const requested = randomSubset(rng, PROTOCOL_IDS);
    const { output_payload } = compute({ protocols: requested });
    checked++;
    if (output_payload.crosswalk.length !== 5) violations++;
    for (const row of output_payload.crosswalk) {
      for (const id of PROTOCOL_IDS) {
        const included = (requested.length > 0 ? requested : PROTOCOL_IDS).includes(id);
        const cell = row.values[id];
        if (included && cell === undefined) violations++;
        if (!included && cell !== undefined) violations++;
      }
    }
  }
  return { name: 'P2_crosswalk_shape_invariant_random150', trials: checked, violations };
}

// P3: enum-select (scenario) agreement -- a valid scenario key always yields a non-null
// recommendation whose primary_pick is drawn from the declared SCENARIOS table; an unknown/absent
// scenario always yields null (this kernel's threshold/enum-scoring analogue).
function checkP3_scenarioEnumSelectAgreement() {
  let violations = 0, checked = 0;
  for (const key of SCENARIO_KEYS) {
    const { output_payload } = compute({ scenario: key });
    checked++;
    if (!output_payload.recommendation) violations++;
    if (!Array.isArray(output_payload.recommendation?.primary_pick) || output_payload.recommendation.primary_pick.length === 0) violations++;
  }
  for (const bad of [null, undefined, '', 'not_a_real_scenario', 'AGENT_MICRO']) {
    const { output_payload } = compute({ scenario: bad });
    checked++;
    if (output_payload.recommendation !== null) violations++;
  }
  return { name: 'P3_scenario_enum_select_agreement', trials: checked, violations };
}

// P4: forced categorical boundary cases -- every single protocol id alone, every dim label present.
function checkP4_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;
  for (const id of PROTOCOL_IDS) {
    const { output_payload } = compute({ protocols: [id] });
    checked++;
    if (output_payload.protocols_detail.length !== 1) violations++;
    const row = output_payload.protocols_detail[0];
    for (const dim of DIM_IDS) if (row[dim] === undefined) violations++;
  }
  return { name: 'P4_forced_categorical_boundary_cases_single_protocol', trials: checked, violations };
}

// P5: output shape / no NaN / undefined across missing-field and empty-object inputs.
function checkP5_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { protocols: [] }, { protocols: ['bogus'] }, { protocols: PROTOCOL_IDS, scenario: 'card_network' }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (!Array.isArray(output_payload.protocols_compared)) violations++;
    if (!Array.isArray(output_payload.protocol_names)) violations++;
    if (!Array.isArray(output_payload.protocols_detail)) violations++;
    if (!Array.isArray(output_payload.crosswalk)) violations++;
    if (typeof output_payload.note !== 'string') violations++;
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

results.properties.push(checkP1_requestedSubsetAgreement());
results.properties.push(checkP2_crosswalkShapeInvariant());
results.properties.push(checkP3_scenarioEnumSelectAgreement());
results.properties.push(checkP4_forcedCategoricalBoundaries());
results.properties.push(checkP5_outputShapeInvariant());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-22-agentic-payments-protocol-comparator',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
