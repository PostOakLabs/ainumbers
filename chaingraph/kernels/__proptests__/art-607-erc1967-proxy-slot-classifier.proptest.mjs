// art-607-erc1967-proxy-slot-classifier property-test floor (ETHMATH-RIDERS-1).
// kernel_digest_at_authoring: sha256:cb03801af9357ed6b3898dae05c178a7a764302bbb4b1959ac2fa65bad1b065c
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- inputs are a bounded (declared_slot,
// storage_value) pair, enumeration-friendly. Shape: a pure, stateless classifier over four
// fixed keccak256-derived slot constants -- no network calls, no chain reads. The fixture
// oracle (4 vectors, including all three non-rollback known slots) is the primary correctness
// anchor; properties below are structural invariants this classifier must hold regardless of
// the exact slot arithmetic, including that the four known slots never move (a pure function
// of fixed label strings, independent of caller input). float:no (all inputs are hex strings).
// ZERO external dependencies beyond the already-vendored keccak256 inlined in the kernel.
// READ-ONLY w.r.t. the kernel it imports. compute() is synchronous.
//
// Run: node chaingraph/kernels/__proptests__/art-607-erc1967-proxy-slot-classifier.proptest.mjs

import { compute } from '../art-607-erc1967-proxy-slot-classifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const ADMIN_SLOT = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';
const ADDR_VALUE = '0x' + '0'.repeat(24) + '5b38da6a701c568545dcfcb03fcb875f56beddc4';
const BASE_PP = { declared_slot: IMPL_SLOT, storage_value: ADDR_VALUE };

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-607-erc1967-proxy-slot-classifier.fixtures.json');
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
  const { output_payload } = compute(BASE_PP);
  const mutated = { ...output_payload, matched_role: output_payload.matched_role === 'implementation' ? 'admin' : 'implementation' };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

// P1: determinism -- same input, called twice, byte-identical output.
function checkP1_determinism() {
  const a = compute(BASE_PP).output_payload;
  const b = compute(BASE_PP).output_payload;
  const violations = JSON.stringify(a) === JSON.stringify(b) ? 0 : 1;
  return { name: 'P1_determinism_repeat_call', trials: 1, violations };
}

// P2: missing declared_slot/storage_value forces INDETERMINATE with no matched_role and no
// embedded_address.
function checkP2_missingRequiredForcesIndeterminate() {
  let violations = 0, checked = 0;
  const cases = [{}, { declared_slot: IMPL_SLOT }, { storage_value: ADDR_VALUE }, { declared_slot: '0xnothex', storage_value: ADDR_VALUE }];
  for (const pp of cases) {
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.overall_determination !== 'INDETERMINATE') violations++;
    if (output_payload.matched_role !== null) violations++;
    if (output_payload.embedded_address !== null) violations++;
  }
  return { name: 'P2_missing_required_forces_indeterminate', trials: checked, violations };
}

// P3: known_eip1967_slots is a pure constant -- identical across arbitrary different inputs,
// since it is derived from fixed label strings, never from caller input.
function checkP3_knownSlotsAreInputIndependent() {
  let violations = 0, checked = 0;
  const a = compute(BASE_PP).output_payload.known_eip1967_slots;
  const b = compute({ declared_slot: ADMIN_SLOT, storage_value: '0x' + '0'.repeat(64) }).output_payload.known_eip1967_slots;
  const c = compute({}).output_payload.known_eip1967_slots;
  checked++; if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
  checked++; if (JSON.stringify(a) !== JSON.stringify(c)) violations++;
  checked++; if (Object.keys(a).length !== 4) violations++;
  return { name: 'P3_known_slots_input_independent', trials: checked, violations };
}

// P4: any storage_value with a non-zero byte in the 12-byte padding region is NEVER classified
// as address-shaped (CONSISTENT) -- the shape check must reject a mis-shaped value, not guess.
function checkP4_nonZeroPaddingNeverAddressShaped() {
  let violations = 0, checked = 0;
  const badPaddingValues = [
    '0x01' + '0'.repeat(22) + '5b38da6a701c568545dcfcb03fcb875f56beddc4',
    '0x' + 'ff'.repeat(12) + '5b38da6a701c568545dcfcb03fcb875f56beddc4',
  ];
  for (const storage_value of badPaddingValues) {
    const { output_payload } = compute({ declared_slot: IMPL_SLOT, storage_value });
    checked++;
    if (output_payload.findings.find((f) => f.check === 'storage_value_shape').verdict === 'CONSISTENT') violations++;
    if (output_payload.embedded_address !== null) violations++;
  }
  return { name: 'P4_nonzero_padding_never_address_shaped', trials: checked, violations };
}

// P5: output shape -- overall_determination is always one of the three known verdicts, and
// findings / not_proven are always arrays.
function checkP5_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const VERDICTS = new Set(['CONSISTENT', 'INCONSISTENT', 'INDETERMINATE']);
  const inputs = [{}, BASE_PP, { declared_slot: '0x' + 'ab'.repeat(32), storage_value: '0x' + '0'.repeat(64) }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (!VERDICTS.has(output_payload.overall_determination)) violations++;
    if (!Array.isArray(output_payload.findings)) violations++;
    if (!Array.isArray(output_payload.not_proven)) violations++;
  }
  return { name: 'P5_output_shape_invariant', trials: checked, violations };
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

results.properties.push(checkP1_determinism());
results.properties.push(checkP2_missingRequiredForcesIndeterminate());
results.properties.push(checkP3_knownSlotsAreInputIndependent());
results.properties.push(checkP4_nonZeroPaddingNeverAddressShaped());
results.properties.push(checkP5_outputShapeInvariant());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-607-erc1967-proxy-slot-classifier',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
