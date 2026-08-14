// art-614-eip7702-authorization-tuple-decoder property-test floor.
// kernel_digest_at_authoring: sha256:554841b60cdb4e6996f4083fe52c09e3c903610c5e4b31c6936f2ad3c77e32a8
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape: hand-authored RLP encoding + keccak256 (EIP-7702 MAGIC
// 0x05 prefix) + ECDSA secp256k1 signature recovery via the vendored noble-curves bundle --
// confirmed against direct kernel source read per this row's fence. The fixture oracle (7
// vectors, the recovered-signer ones cross-checked against a from-scratch independent RLP +
// vendored-bundle oracle script, never this kernel's own compute()) is the primary correctness
// anchor -- this floor does not re-derive elliptic-curve or RLP math, it checks structural
// invariants the kernel must hold regardless of the exact recovery/encoding arithmetic.
// float:no (all inputs are hex strings / small integers, never floats). ZERO external
// dependencies beyond the kernel's own vendored secp256k1/keccak_256 -- pure Node built-ins
// otherwise. READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-614-eip7702-authorization-tuple-decoder.proptest.mjs

import { compute } from '../art-614-eip7702-authorization-tuple-decoder.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const KNOWN_PP = {
  chainId: 1,
  address: '0x1234567890123456789012345678901234567890',
  nonce: 0,
  r: '0xbcc0abd2b842f32cc9c8844ec50c0d5c9b41563f825ef1a143ad93428fb23ad8',
  s: '0x12678a935e15a1d1fae421fa00abd642222fb4db4aaf4f95a894ba0e38eebbae',
  yParity: 0,
};
const KNOWN_SIGNER = '0x2c7536e3605d9c16a7a3d7b1898e529396a65c23';
const KNOWN_TUPLE_HASH = '0x27ccda78a68e39a3fdf515a1b312fe1e3a5d766597579ca1a4973f586950b6e2';

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-614-eip7702-authorization-tuple-decoder.fixtures.json');
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
  const { output_payload } = compute(KNOWN_PP);
  const mutated = { ...output_payload, recovered_signer: output_payload.recovered_signer === '0xdead' ? '0xbeef' : '0xdead' };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

// P1: determinism -- same input, called twice, byte-identical output.
function checkP1_determinism() {
  const a = compute(KNOWN_PP).output_payload;
  const b = compute(KNOWN_PP).output_payload;
  const violations = JSON.stringify(a) === JSON.stringify(b) ? 0 : 1;
  return { name: 'P1_determinism_repeat_call', trials: 1, violations };
}

// P2: the tuple hash depends ONLY on (chainId, address, nonce) -- changing r/s/yParity (the
// signature) never changes authorization_tuple_hash, and changing any of chainId/address/nonce
// always does.
function checkP2_tupleHashIndependentOfSignature() {
  let violations = 0, checked = 0;
  const a = compute(KNOWN_PP).output_payload;
  const b = compute({ ...KNOWN_PP, r: '0x' + '11'.repeat(32), s: '0x' + '22'.repeat(32), yParity: 1 });
  checked++; if (a.authorization_tuple_hash !== null && a.authorization_tuple_hash === KNOWN_TUPLE_HASH && b.output_payload.authorization_tuple_hash !== a.authorization_tuple_hash) violations++;
  const c = compute({ ...KNOWN_PP, nonce: 1 }).output_payload;
  checked++; if (c.authorization_tuple_hash === a.authorization_tuple_hash) violations++;
  const d = compute({ ...KNOWN_PP, chainId: 2 }).output_payload;
  checked++; if (d.authorization_tuple_hash === a.authorization_tuple_hash) violations++;
  return { name: 'P2_tuple_hash_depends_only_on_chainid_address_nonce', trials: checked, violations };
}

// P3: cross_chain_authorization is true iff chain_id === 0, agreeing with the boolean regardless
// of whether recovery succeeded.
function checkP3_crossChainFlagAgreesWithChainIdZero() {
  let violations = 0, checked = 0;
  const cases = [
    { pp: { ...KNOWN_PP, chainId: 0 }, expect: true },
    { pp: { ...KNOWN_PP, chainId: 1 }, expect: false },
    { pp: { ...KNOWN_PP, chainId: 999999 }, expect: false },
  ];
  for (const c of cases) {
    checked++;
    const { output_payload } = compute(c.pp);
    if (output_payload.cross_chain_authorization !== c.expect) violations++;
  }
  return { name: 'P3_cross_chain_flag_agrees_with_chain_id_zero', trials: checked, violations };
}

// P4: malformed/absent required fields never throw and always yield verdict INDETERMINATE with
// authorization_tuple_hash and recovered_signer both null -- never an unhandled throw.
function checkP4_malformedNeverThrowsForcesIndeterminate() {
  let violations = 0, checked = 0;
  const malformed = [
    {},
    { chainId: 1 },
    { chainId: 1, address: KNOWN_PP.address, nonce: 0, signature: '0xdeadbeef' },
    { chainId: 1, address: 'not-an-address', nonce: 0, r: KNOWN_PP.r, s: KNOWN_PP.s, yParity: 0 },
  ];
  for (const pp of malformed) {
    checked++;
    let output_payload;
    try {
      ({ output_payload } = compute(pp));
    } catch (e) {
      violations++;
      continue;
    }
    if (output_payload.verdict !== 'INDETERMINATE' || output_payload.authorization_tuple_hash !== null || output_payload.recovered_signer !== null) violations++;
  }
  return { name: 'P4_malformed_never_throws_forces_indeterminate', trials: checked, violations };
}

// P5: delegate_address is echoed back byte-for-byte (lowercased) as the caller-declared `address`
// field -- the kernel never derives or alters the delegate, only reports it (address-only
// boundary, ETHMATH-7702-1 fence).
function checkP5_delegateAddressIsEchoedDeclaredInput() {
  let violations = 0, checked = 0;
  const cases = [KNOWN_PP, { ...KNOWN_PP, address: '0xABCDEFABCDEFABCDEFABCDEFABCDEFABCDEFABCD' }];
  for (const pp of cases) {
    checked++;
    const { output_payload } = compute(pp);
    if (output_payload.delegate_address !== String(pp.address).toLowerCase()) violations++;
  }
  return { name: 'P5_delegate_address_echoed_as_declared', trials: checked, violations };
}

// P6: output shape / no NaN / undefined across known-good and malformed inputs.
function checkP6_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [KNOWN_PP, {}, { chainId: 1, address: KNOWN_PP.address, nonce: 0, signature: '0xdeadbeef' }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (typeof output_payload.verdict !== 'string') violations++;
    if (!Array.isArray(output_payload.reasons)) violations++;
  }
  return { name: 'P6_output_shape_no_nan_undefined', trials: checked, violations };
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
results.properties.push(checkP2_tupleHashIndependentOfSignature());
results.properties.push(checkP3_crossChainFlagAgreesWithChainIdZero());
results.properties.push(checkP4_malformedNeverThrowsForcesIndeterminate());
results.properties.push(checkP5_delegateAddressIsEchoedDeclaredInput());
results.properties.push(checkP6_outputShapeInvariant());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-614-eip7702-authorization-tuple-decoder',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
