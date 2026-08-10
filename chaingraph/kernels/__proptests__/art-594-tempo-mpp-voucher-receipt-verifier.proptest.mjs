// art-594-tempo-mpp-voucher-receipt-verifier property-test floor (ADJACENT-HOOKS-ASSEMBLE-LAND-2).
// kernel_digest_at_authoring: sha256:4db1842bc9f674ac0c7f1039f1226c4ce9e91ce798e02470bd81a6ee6302ce3b
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED domain,
// not a totality proof. Shape: three independent legs (voucher EIP-712 ecrecover, TIP-20 memo shape
// check, HTTP 402 challenge/receipt render) via a vendored secp256k1/keccak256 -- same vendored bundle
// already floored by art-590/591/592/593. The fixture oracle (6 vectors, cross-checked against the
// primary TIP20ChannelReserve.sol contract source per the fixtures file note) is the primary
// correctness anchor; properties below are structural invariants this three-leg decision kernel must
// hold regardless of the exact ecrecover arithmetic. float:no (all amounts are decimal strings,
// compared as BigInt). ZERO external dependencies beyond the kernel's own vendored crypto -- pure Node
// built-ins otherwise. READ-ONLY w.r.t. the kernel it imports. compute() is synchronous.
//
// Run: node chaingraph/kernels/__proptests__/art-594-tempo-mpp-voucher-receipt-verifier.proptest.mjs

import { compute } from '../art-594-tempo-mpp-voucher-receipt-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

// "happy-path" vector from the fixtures file (valid voucher, valid memo, valid challenge).
const BASE_PP = {
  protocolVersion: 'v2', domainName: 'TIP20 Channel Reserve', domainVersion: '1', domainChainId: '4217',
  domainVerifyingContract: '0x1234567890123456789012345678901234567890',
  channelId: '0x1111111111111111111111111111111111111111111111111111111111111111',
  cumulativeAmount: '1000',
  r: '0xebf4fa27ba15333e85d176eb025f89fe05df0127b30aafbe0014054ea6182e8f',
  s: '0x56b886bd4b7a4b6c7ce54e8a80b8758f650fe32a59d71a8d6fa738ca88d170a2',
  yParity: 1,
  channelPayer: '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf',
  channelSettled: '0', channelDeposit: '10000', channelCloseRequestedAt: '0',
  memoValue: '0x0000000000000000000000000000000000000000000000000000000000000001',
  memoExpectedReferenceHash: '0x0000000000000000000000000000000000000000000000000000000000000001',
  challengeId: 'chal-abc-123', challengeRealm: 'api.example.com', challengeIntent: 'session',
  challengeAmount: '500', challengeCurrency: 'USDC', challengeRecipient: 'merchant-receiving-address-string',
  challengeEscrowContract: '0x1234567890123456789012345678901234567890',
  challengeChannelId: '0x1111111111111111111111111111111111111111111111111111111111111111',
  subjectExecutionHash: 'sha256:deadbeef', now: '2026-08-10T00:00:00Z',
};

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-594-tempo-mpp-voucher-receipt-verifier.fixtures.json');
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
  const mutated = { ...output_payload, voucher: { ...output_payload.voucher, verdict: 'VOUCHER_INVALID_SIGNATURE' } };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

// P1: determinism -- same input, called twice, byte-identical output (no signing/randomness inside
// compute -- ecrecover over caller-supplied (r,s) is a pure function).
function checkP1_determinism() {
  const a = compute(BASE_PP).output_payload;
  const b = compute(BASE_PP).output_payload;
  const violations = JSON.stringify(a) === JSON.stringify(b) ? 0 : 1;
  return { name: 'P1_determinism_repeat_call', trials: 1, violations };
}

// P2: empty input -> voucher/memo/challenge/receipt all reach an INDETERMINATE/SKIPPED/WITHHELD
// terminal state, never a thrown exception and never a VALID/EMITTED verdict.
function checkP2_emptyInputNeverValidates() {
  let violations = 0, checked = 0;
  const { output_payload } = compute({});
  checked++; if (output_payload.voucher.verdict === 'VOUCHER_VALID') violations++;
  checked++; if (output_payload.receipt.verdict === 'RECEIPT_EMITTED') violations++;
  checked++; if (output_payload.receipt.paymentReceipt !== null) violations++;
  return { name: 'P2_empty_input_never_validates', trials: checked, violations };
}

// P3: signature sensitivity -- flipping one bit of the signed digest's input (the nonce-equivalent
// cumulativeAmount, holding r/s fixed) changes the recovered signer away from the expected signer, so
// the voucher no longer validates against channelPayer. A wrong-signature voucher must never reach
// RECEIPT_EMITTED.
function checkP3_signatureSensitivity() {
  let violations = 0, checked = 0;
  const tampered = { ...BASE_PP, cumulativeAmount: '999999999' }; // same (r,s) now signs a different digest
  const { output_payload } = compute(tampered);
  checked++; if (output_payload.voucher.verdict === 'VOUCHER_VALID') violations++;
  checked++; if (output_payload.receipt.verdict === 'RECEIPT_EMITTED') violations++;
  return { name: 'P3_signature_sensitivity_tampered_amount', trials: checked, violations };
}

// P4: output shape -- voucher/memo/challenge/receipt sub-objects and a top-level reasons array are
// always present with the right JS types, across a spread of malformed and well-formed inputs.
function checkP4_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, BASE_PP, { ...BASE_PP, cumulativeAmount: '0' }, { memoValue: '0xdeadbeef' }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (typeof output_payload.voucher !== 'object' || output_payload.voucher === null) violations++;
    if (typeof output_payload.memo !== 'object' || output_payload.memo === null) violations++;
    if (typeof output_payload.challenge !== 'object' || output_payload.challenge === null) violations++;
    if (typeof output_payload.receipt !== 'object' || output_payload.receipt === null) violations++;
    if (!Array.isArray(output_payload.reasons)) violations++;
    if (typeof output_payload.voucher.verdict !== 'string') violations++;
  }
  return { name: 'P4_output_shape_invariant', trials: checked, violations };
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
results.properties.push(checkP2_emptyInputNeverValidates());
results.properties.push(checkP3_signatureSensitivity());
results.properties.push(checkP4_outputShapeInvariant());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-594-tempo-mpp-voucher-receipt-verifier',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
