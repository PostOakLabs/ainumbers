// art-604-erc8004-registry-entry-verifier property-test floor (ADJACENT-HOOKS-ASSEMBLE-LAND-2).
// kernel_digest_at_authoring: sha256:e070d771eff503f44fbf430cb47475cbb4ff2b2db6cc3692e6d4f3b93370a8c3
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED domain,
// not a totality proof. Shape: a pure, stateless field-by-field comparator between a caller-supplied
// claimed_entry and a caller-supplied onchain_record, plus an EIP-55 checksum check on address-shaped
// fields -- no network calls, no per-registry-type adapter, generic schema only. The fixture oracle
// (3 vectors) is the primary correctness anchor; properties below are structural invariants a
// consistency comparator must hold regardless of the exact field-matching arithmetic. float:no (all
// inputs are strings/objects). ZERO external dependencies. READ-ONLY w.r.t. the kernel it imports.
// compute() is synchronous.
//
// Run: node chaingraph/kernels/__proptests__/art-604-erc8004-registry-entry-verifier.proptest.mjs

import { compute, buildArtifact } from '../art-604-erc8004-registry-entry-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const BASE_PP = {
  registry_type: 'identity',
  chain_id: '1',
  registry_address: '0x5FbDB2315678afecb367f032d93F642f64180aa',
  claimed_entry: { agentId: '42', agentDomain: 'agent.example.com', agentAddress: '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4' },
  onchain_record: { agentId: '42', agentDomain: 'agent.example.com', agentAddress: '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4' },
};

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-604-erc8004-registry-entry-verifier.fixtures.json');
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
  const mutated = { ...output_payload, overall_determination: output_payload.overall_determination === 'CONSISTENT' ? 'INCONSISTENT' : 'CONSISTENT' };
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

// P2: missing registry_type/claimed_entry/onchain_record forces INDETERMINATE, with an empty
// field_comparison and address_checksum_findings.
function checkP2_missingRequiredForcesIndeterminate() {
  let violations = 0, checked = 0;
  const cases = [{}, { registry_type: 'identity' }, { claimed_entry: {}, onchain_record: {} }];
  for (const pp of cases) {
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.overall_determination !== 'INDETERMINATE') violations++;
    if (!Array.isArray(output_payload.field_comparison) || output_payload.field_comparison.length !== 0) violations++;
  }
  return { name: 'P2_missing_required_forces_indeterminate', trials: checked, violations };
}

// P3: a field present in both records but differing in value flips overall_determination to
// INCONSISTENT and records that field with match:false.
function checkP3_valueMismatchForcesInconsistent() {
  let violations = 0, checked = 0;
  const mismatched = { ...BASE_PP, onchain_record: { ...BASE_PP.onchain_record, agentId: '99' } };
  const { output_payload } = compute(mismatched);
  checked++; if (output_payload.overall_determination !== 'INCONSISTENT') violations++;
  const agentIdRow = output_payload.field_comparison.find((f) => f.field === 'agentId');
  checked++; if (!agentIdRow || agentIdRow.match !== false) violations++;
  return { name: 'P3_value_mismatch_forces_inconsistent', trials: checked, violations };
}

// P4: output shape -- overall_determination is always one of the three known verdicts, and
// field_comparison / address_checksum_findings / findings / not_proven are always arrays.
function checkP4_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const VERDICTS = new Set(['CONSISTENT', 'INCONSISTENT', 'INDETERMINATE']);
  const inputs = [{}, BASE_PP, { ...BASE_PP, registry_type: 'reputation' }, { ...BASE_PP, claimed_entry: { foo: 'bar' }, onchain_record: { foo: 'baz' } }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (!VERDICTS.has(output_payload.overall_determination)) violations++;
    if (!Array.isArray(output_payload.field_comparison)) violations++;
    if (!Array.isArray(output_payload.address_checksum_findings)) violations++;
    if (!Array.isArray(output_payload.findings)) violations++;
    if (!Array.isArray(output_payload.not_proven)) violations++;
  }
  return { name: 'P4_output_shape_invariant', trials: checked, violations };
}

// ---------- P5: every required field of every positive vector, mutated to delete / null / "" / "   ", never stays positive ----------
function checkP5_requiredFieldNeverPositive() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-604-erc8004-registry-entry-verifier.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const required = ['chain_id', 'claimed_entry', 'onchain_record', 'registry_address', 'registry_type'];
  let violations = 0, checked = 0, positives = 0;
  for (const vec of fixtures.vectors) {
    if (compute(vec.policy_parameters).output_payload.overall_determination !== 'CONSISTENT') continue;
    positives++;
    for (const f of required) {
      for (const mode of ['delete', 'null', 'empty', 'blank']) {
        const pp = JSON.parse(JSON.stringify(vec.policy_parameters));
        if (mode === 'delete') delete pp[f];
        else pp[f] = mode === 'null' ? null : mode === 'empty' ? '' : '   ';
        checked++;
        if (compute(pp).output_payload.overall_determination === 'CONSISTENT') violations++;
      }
    }
  }
  if (positives === 0) violations++;
  return { name: 'P5_required_field_blank_never_positive', trials: checked, positives, violations };
}

// ---------- P6: buildArtifact_never_throws — one fixture per unhashable class ----------
async function checkP6_buildArtifactNeverThrows() {
  let deep = {}; let cur = deep;
  for (let i = 0; i < 511; i++) { cur.n = {}; cur = cur.n; }
  const classes = [
    ['junk_1e300', { chain_id: 1e300 }],
    ['nan', { chain_id: NaN }],
    ['neg_infinity', { chain_id: -Infinity }],
    ['depth_511', { chain_id: deep }],
    ['over_1e6_values', { chain_id: new Array(1000001).fill(0) }],
  ];
  let violations = 0; const rows = [];
  for (const [label, pp] of classes) {
    try {
      const a = await buildArtifact(pp);
      const ok = a.execution_hash === null && a.hash_refusal && typeof a.hash_refusal.reason === 'string';
      if (!ok) violations++;
      rows.push({ label, refused: !!ok });
    } catch (e) { violations++; rows.push({ label, threw: String(e && e.message).slice(0, 80) }); }
  }
  return { name: 'buildArtifact_never_throws', trials: classes.length, violations, rows };
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
results.properties.push(checkP3_valueMismatchForcesInconsistent());
results.properties.push(checkP4_outputShapeInvariant());
results.properties.push(checkP5_requiredFieldNeverPositive());
results.properties.push(await checkP6_buildArtifactNeverThrows());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-604-erc8004-registry-entry-verifier',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
