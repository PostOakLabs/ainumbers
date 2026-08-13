// art-606-erc165-interface-id-verifier property-test floor (ETHMATH-RIDERS-1).
// kernel_digest_at_authoring: sha256:4e23a23b5e2ec1ba559f1dc3c84e9e352b8006df0c0049b25a218cf70c88fede
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- inputs are a bounded declared list of
// function signatures plus an optional claimed id, enumeration-friendly. Shape: a pure,
// stateless XOR of 4-byte keccak256 selectors over a caller-declared signature list -- no
// network calls, no chain reads. The fixture oracle (4 vectors, including the ERC-721/
// ERC-1155 known-standard reproductions) is the primary correctness anchor; properties below
// are structural invariants an ERC-165 recompute must hold regardless of the exact selector
// arithmetic, plus the XOR-specific order-independence property. float:no (all inputs are
// strings/objects). ZERO external dependencies beyond the already-vendored keccak256 inlined
// in the kernel. READ-ONLY w.r.t. the kernel it imports. compute() is synchronous.
//
// Run: node chaingraph/kernels/__proptests__/art-606-erc165-interface-id-verifier.proptest.mjs

import { compute } from '../art-606-erc165-interface-id-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const ERC721_SIGS = [
  'balanceOf(address)', 'ownerOf(uint256)', 'safeTransferFrom(address,address,uint256,bytes)',
  'safeTransferFrom(address,address,uint256)', 'transferFrom(address,address,uint256)',
  'approve(address,uint256)', 'setApprovalForAll(address,bool)', 'getApproved(uint256)',
  'isApprovedForAll(address,address)',
];
const BASE_PP = { function_signatures: ERC721_SIGS, claimed_interface_id: '0x80ac58cd' };

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-606-erc165-interface-id-verifier.fixtures.json');
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
  const mutated = { ...output_payload, computed_interface_id: '0xdeadbeef' };
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

// P2: missing/empty function_signatures forces INDETERMINATE with an empty selectors array.
function checkP2_missingSignaturesForcesIndeterminate() {
  let violations = 0, checked = 0;
  const cases = [{}, { function_signatures: [] }, { function_signatures: [], claimed_interface_id: '0x80ac58cd' }];
  for (const pp of cases) {
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.overall_determination !== 'INDETERMINATE') violations++;
    if (!Array.isArray(output_payload.selectors) || output_payload.selectors.length !== 0) violations++;
    if (output_payload.computed_interface_id !== null) violations++;
  }
  return { name: 'P2_missing_signatures_forces_indeterminate', trials: checked, violations };
}

// P3: XOR is commutative -- reordering a well-formed signature list never changes
// computed_interface_id (the arithmetic this kernel exists to perform must not be order-sensitive).
function checkP3_xorOrderIndependence() {
  let violations = 0, checked = 0;
  const shuffled = [ERC721_SIGS[3], ERC721_SIGS[0], ERC721_SIGS[8], ERC721_SIGS[1], ERC721_SIGS[6], ERC721_SIGS[2], ERC721_SIGS[7], ERC721_SIGS[4], ERC721_SIGS[5]];
  const a = compute({ function_signatures: ERC721_SIGS }).output_payload;
  const b = compute({ function_signatures: shuffled }).output_payload;
  checked++; if (a.computed_interface_id !== b.computed_interface_id) violations++;
  checked++; if (a.computed_interface_id !== '0x80ac58cd') violations++;
  return { name: 'P3_xor_order_independence', trials: checked, violations };
}

// P4: a mismatched claimed_interface_id always forces overall_determination INCONSISTENT and
// a claimed_id_match finding of INCONSISTENT.
function checkP4_mismatchForcesInconsistent() {
  let violations = 0, checked = 0;
  const mismatched = { function_signatures: ERC721_SIGS, claimed_interface_id: '0xffffffff' };
  const { output_payload } = compute(mismatched);
  checked++; if (output_payload.overall_determination !== 'INCONSISTENT') violations++;
  const claimFinding = output_payload.findings.find((f) => f.check === 'claimed_id_match');
  checked++; if (!claimFinding || claimFinding.verdict !== 'INCONSISTENT') violations++;
  return { name: 'P4_claim_mismatch_forces_inconsistent', trials: checked, violations };
}

// P5: output shape -- overall_determination is always one of the three known verdicts, and
// selectors / malformed_signatures / duplicate_signatures / not_proven are always arrays.
function checkP5_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const VERDICTS = new Set(['CONSISTENT', 'INCONSISTENT', 'INDETERMINATE']);
  const inputs = [{}, BASE_PP, { function_signatures: ['ownerOf(uint256)', 'bad!!'] }, { function_signatures: ['transfer(address,uint256)'] }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (!VERDICTS.has(output_payload.overall_determination)) violations++;
    if (!Array.isArray(output_payload.selectors)) violations++;
    if (!Array.isArray(output_payload.malformed_signatures)) violations++;
    if (!Array.isArray(output_payload.duplicate_signatures)) violations++;
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
results.properties.push(checkP2_missingSignaturesForcesIndeterminate());
results.properties.push(checkP3_xorOrderIndependence());
results.properties.push(checkP4_mismatchForcesInconsistent());
results.properties.push(checkP5_outputShapeInvariant());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-606-erc165-interface-id-verifier',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
