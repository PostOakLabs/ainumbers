// art-613-erc4337-userop-math property-test floor (ETHMATH-USEROP-1; amended by ZZ-EIP7702-USEROP-CHAIN-1).
// kernel_digest_at_authoring: sha256:20a75b55a56107be6125e18d224efc78e95e3de8fa3aff404dad07655d8726ec
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- a cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape: ERC-4337 userOpHash recompute over the declared EntryPoint
// struct layouts (v0.6 10-word pack, v0.7/v0.8/v0.9 PackedUserOperation, with v0.8/v0.9 hashed as
// an EIP-712 typed hash over the ERC4337 domain), plus uint256 prefund arithmetic and a
// declared-input reconciliation. The fixture oracle (17 vectors, every hash cross-checked against
// an independent from-spec Keccak-256 and ABI encoder per the fixtures file note, and the v0.8/v0.9
// vectors against the same oracle extended with the domain separator, the Eip7702Support override
// and the v0.9 paymasterDataKeccak rule) is the primary correctness anchor; the properties below
// are structural invariants this kernel must hold regardless of the exact hash arithmetic.
// float:no (every numeric input is normalized to BigInt; no floating point anywhere in the kernel).
// ZERO external dependencies beyond the kernel's own vendored keccak_256 -- pure Node built-ins
// otherwise. READ-ONLY w.r.t. the kernel it imports.
//
// The digest above is recomputed and asserted at run time against the kernel's own bytes, so this
// floor cannot silently drift off the kernel it claims to cover (SO #34: a gate must recompute the
// value it validates from the primary source, never read it back from the artifact under test).
//
// Run: node chaingraph/kernels/__proptests__/art-613-erc4337-userop-math.proptest.mjs

import { compute } from '../art-613-erc4337-userop-math.kernel.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const KERNEL_PATH = path.join(__dirname, '..', 'art-613-erc4337-userop-math.kernel.mjs');
const DIGEST_AT_AUTHORING = 'sha256:20a75b55a56107be6125e18d224efc78e95e3de8fa3aff404dad07655d8726ec';

const BASE06 = {
  entryPointVersion: '0.6',
  entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
  chainId: 1,
  sender: '0x2A1530C4C41db0B0b2bB646CB5Eb1A67b7158667',
  nonce: 0,
  initCode: '0x',
  callData: '0xb61d27f60000000000000000000000005ff137d4b0fdcd49dca30c7cf57e578a026d2789',
  paymasterAndData: '0x',
  callGasLimit: 100000,
  verificationGasLimit: 150000,
  preVerificationGas: 21000,
  maxFeePerGas: 2000000000,
  maxPriorityFeePerGas: 1000000000,
};
const BASE07 = { ...BASE06, entryPointVersion: '0.7', entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032' };

const BASE08P = {
  ...BASE07,
  entryPointVersion: '0.8',
  eip7702Delegate: '0x0101010101010101010101010101010101010101',
};

const REQUIRED_FIELDS = ['entryPointVersion', 'entryPoint', 'chainId', 'sender', 'nonce', 'initCode',
  'callData', 'paymasterAndData', 'callGasLimit', 'verificationGasLimit', 'preVerificationGas',
  'maxFeePerGas', 'maxPriorityFeePerGas'];

// ---------- kernel-digest freshness (recomputed from the kernel bytes, never read back) ----------
function checkDigestFreshness() {
  const actual = 'sha256:' + createHash('sha256').update(readFileSync(KERNEL_PATH)).digest('hex');
  return { matches: actual === DIGEST_AT_AUTHORING, actual, declared: DIGEST_AT_AUTHORING };
}

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-613-erc4337-userop-math.fixtures.json');
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
  const { output_payload } = compute(BASE06);
  const mutated = { ...output_payload, user_op_hash: output_payload.user_op_hash === '0xdead' ? '0xbeef' : '0xdead' };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

// P1: determinism -- same input, called twice, byte-identical output.
function checkP1_determinism() {
  let violations = 0, checked = 0;
  for (const pp of [BASE06, BASE07]) {
    const a = compute(pp).output_payload;
    const b = compute(pp).output_payload;
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
  }
  return { name: 'P1_determinism_repeat_call', trials: checked, violations };
}

// P2: every REQUIRED field missing individually -> INDETERMINATE with a null userOpHash.
function checkP2_requiredFieldMissingForcesIndeterminate() {
  let violations = 0, checked = 0;
  for (const base of [BASE06, BASE07]) {
    for (const field of REQUIRED_FIELDS) {
      const pp = { ...base };
      delete pp[field];
      const { output_payload } = compute(pp);
      checked++;
      if (output_payload.verdict !== 'INDETERMINATE' || output_payload.user_op_hash !== null) violations++;
    }
  }
  return { name: 'P2_required_field_missing_forces_indeterminate', trials: checked, violations };
}

// P3: the declared EntryPoint version is load-bearing -- identical field values under v0.6, v0.7,
// v0.8 and v0.9 MUST hash differently, and none may be produced by an unrecognised version.
function checkP3_versionIsLoadBearing() {
  let violations = 0, checked = 0;
  const h6 = compute(BASE06).output_payload;
  const h7 = compute({ ...BASE06, entryPointVersion: '0.7' }).output_payload;
  const h8 = compute(BASE08P).output_payload;
  const h9 = compute({ ...BASE08P, entryPointVersion: '0.9' }).output_payload;
  // Pinned: the ONLY v0.8/v0.9 delta is paymasterDataKeccak, so with no appended paymaster
  // signature (and none here) the two versions hash identically.
  checked++; if (h8.user_op_hash !== h9.user_op_hash) violations++;
  const header = '1234567890abcdef1234567890abcdef12345678'
    + '000000000000000000000000000186a0'
    + '0000000000000000000000000000c350';
  const pmSig = '0x' + header + 'cafebabe' + 'ab'.repeat(65)
    + '0041' + '22e325a297439656';
  const h8sig = compute({ ...BASE08P, paymasterAndData: pmSig }).output_payload;
  const h9sig = compute({ ...BASE08P, entryPointVersion: '0.9', paymasterAndData: pmSig }).output_payload;
  const hashes = [h6.user_op_hash, h7.user_op_hash, h8.user_op_hash, h9sig.user_op_hash];
  for (let i = 0; i < hashes.length; i++) {
    for (let j = i + 1; j < hashes.length; j++) {
      checked++; if (hashes[i] === hashes[j]) violations++;
    }
  }
  checked++; if (h6.packed_words.word_count !== 10 || h7.packed_words.word_count !== 8) violations++;
  checked++; if (h8.packed_words.word_count !== 9 || h9.packed_words.word_count !== 9) violations++;
  // accepted declared forms: bare, v-prefixed, and .0-suffixed all canonicalise per version
  for (const [forms, want] of [[['0.8', 'v0.8', '0.8.0'], h8.user_op_hash], [['0.9', 'v0.9', '0.9.0'], h9.user_op_hash]]) {
    for (const form of forms) {
      const { output_payload } = compute({ ...BASE08P, entryPointVersion: form });
      checked++; if (output_payload.user_op_hash !== want) violations++;
    }
  }
  for (const bad of ['0.5', 'latest', '', 'v1', '0.10']) {
    const { output_payload } = compute({ ...BASE06, entryPointVersion: bad });
    checked++;
    if (output_payload.verdict !== 'INDETERMINATE' || output_payload.user_op_hash !== null) violations++;
  }
  return { name: 'P3_entrypoint_version_is_load_bearing', trials: checked, violations };
}

// P4: hash sensitivity -- every hashed field, flipped alone, changes the userOpHash.
function checkP4_hashSensitivity() {
  let violations = 0, checked = 0;
  const mutations = [
    ['sender', '0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f2'],
    ['nonce', 1],
    ['initCode', '0xabcd'],
    ['callData', '0x00'],
    ['paymasterAndData', '0xdeadbeef'],
    ['callGasLimit', 100001],
    ['verificationGasLimit', 150001],
    ['preVerificationGas', 21001],
    ['maxFeePerGas', 2000000001],
    ['maxPriorityFeePerGas', 1000000001],
    // Distinct from BOTH bases' entryPoint values on purpose: substituting a base's own address
    // would be a no-op mutation that the property would then pass vacuously.
    ['entryPoint', '0x00000000000000000000000000000000000000ff'],
    ['chainId', 8453],
  ];
  for (const base of [BASE06, BASE07]) {
    const ref = compute(base).output_payload.user_op_hash;
    for (const [field, value] of mutations) {
      const { output_payload } = compute({ ...base, [field]: value });
      checked++;
      if (output_payload.user_op_hash === ref) violations++;
    }
  }
  return { name: 'P4_every_hashed_field_changes_the_hash', trials: checked, violations };
}

// P5: the signature field is NOT part of the hashed struct (ERC-4337 excludes it), so supplying
// one must not move the hash. Guards against accidentally folding it in.
function checkP5_signatureExcludedFromHash() {
  let violations = 0, checked = 0;
  for (const base of [BASE06, BASE07]) {
    const ref = compute(base).output_payload.user_op_hash;
    for (const sig of ['0x', '0xdeadbeef', '0x' + 'ab'.repeat(65)]) {
      const { output_payload } = compute({ ...base, signature: sig });
      checked++;
      if (output_payload.user_op_hash !== ref) violations++;
    }
  }
  return { name: 'P5_signature_excluded_from_hashed_struct', trials: checked, violations };
}

// P6: prefund monotonicity -- raising any gas limit or maxFeePerGas never lowers the required
// prefund, and the v0.6 paymaster multiplier strictly raises it over the no-paymaster case.
function checkP6_prefundMonotonicity() {
  let violations = 0, checked = 0;
  const bumps = ['callGasLimit', 'verificationGasLimit', 'preVerificationGas', 'maxFeePerGas'];
  for (const base of [BASE06, BASE07]) {
    const ref = BigInt(compute(base).output_payload.gas_accounting.required_prefund_wei);
    for (const field of bumps) {
      const pp = { ...base, [field]: Number(base[field]) + 1000 };
      const got = BigInt(compute(pp).output_payload.gas_accounting.required_prefund_wei);
      checked++;
      if (got < ref) violations++;
    }
  }
  // v0.6 multiplier: a paymaster raises the prefund by exactly 2x verificationGasLimit x maxFeePerGas.
  const noPm = compute(BASE06).output_payload.gas_accounting;
  const withPm = compute({ ...BASE06, paymasterAndData: '0x' + '11'.repeat(20) }).output_payload.gas_accounting;
  const expectedDelta = 2n * BigInt(BASE06.verificationGasLimit) * BigInt(BASE06.maxFeePerGas);
  checked++;
  if (BigInt(withPm.required_prefund_wei) - BigInt(noPm.required_prefund_wei) !== expectedDelta) violations++;
  checked++;
  if (noPm.paymaster_multiplier_applied !== '1' || withPm.paymaster_multiplier_applied !== '3') violations++;
  return { name: 'P6_prefund_monotonic_and_v06_multiplier', trials: checked, violations };
}

// P7: the L1-fee / basefee boundary is never crossed. With differing fee caps and no declared
// basefee the effective price stays null and reconciliation is NOT_ATTEMPTED -- never a guess.
// With equal caps the legacy shortcut applies and no basefee is needed.
function checkP7_neverDerivesUnfetchableFees() {
  let violations = 0, checked = 0;
  for (const base of [BASE06, BASE07]) {
    const noBase = compute(base).output_payload;
    checked++; if (noBase.gas_accounting.effective_gas_price_wei !== null) violations++;
    checked++; if (noBase.paymaster_reconciliation.status !== 'NOT_ATTEMPTED') violations++;
    checked++; if (!Array.isArray(noBase.never_fetched) || noBase.never_fetched.length === 0) violations++;

    const legacy = compute({ ...base, maxPriorityFeePerGas: base.maxFeePerGas }).output_payload;
    checked++; if (legacy.gas_accounting.effective_gas_price_wei !== String(base.maxFeePerGas)) violations++;

    const declared = compute({ ...base, declaredBaseFeePerGas: 500000000 }).output_payload;
    // min(2e9, 1e9 + 5e8) = 1.5e9
    checked++; if (declared.gas_accounting.effective_gas_price_wei !== '1500000000') violations++;
  }
  // never_fetched is present on INDETERMINATE runs too -- the boundary copy is unconditional.
  const bad = compute({}).output_payload;
  checked++; if (!Array.isArray(bad.never_fetched) || bad.never_fetched.length === 0) violations++;
  return { name: 'P7_never_derives_l1_or_basefee', trials: checked, violations };
}

// P8: reconciliation arithmetic -- an exactly-consistent declared charge reconciles, and a charge
// off by more than the tolerance does not. Tolerance is honoured on both sides of zero.
function checkP8_reconciliationArithmetic() {
  let violations = 0, checked = 0;
  const pp = { ...BASE07, declaredBaseFeePerGas: 500000000, declaredActualGasUsed: 180000 };
  const exact = 180000n * 1500000000n; // 2.7e14
  const ok = compute({ ...pp, declaredActualGasCostWei: exact.toString() }).output_payload.paymaster_reconciliation;
  checked++; if (ok.status !== 'RECONCILED' || ok.residual_wei !== '0') violations++;

  const over = compute({ ...pp, declaredActualGasCostWei: (exact + 1000n).toString() }).output_payload.paymaster_reconciliation;
  checked++; if (over.status !== 'RESIDUAL_UNEXPLAINED' || over.residual_wei !== '1000') violations++;

  const under = compute({ ...pp, declaredActualGasCostWei: (exact - 1000n).toString() }).output_payload.paymaster_reconciliation;
  checked++; if (under.status !== 'RESIDUAL_UNEXPLAINED' || under.residual_wei !== '-1000') violations++;

  for (const sign of [1n, -1n]) {
    const tol = compute({ ...pp, declaredActualGasCostWei: (exact + sign * 1000n).toString(), reconciliationToleranceWei: 1000 })
      .output_payload.paymaster_reconciliation;
    checked++; if (tol.status !== 'RECONCILED') violations++;
  }
  // A declared L1 data fee closes the residual it explains, and is never invented when absent.
  const withL1 = compute({ ...pp, declaredActualGasCostWei: (exact + 1000n).toString(), declaredL1DataFeeWei: 1000 })
    .output_payload.paymaster_reconciliation;
  checked++; if (withL1.status !== 'RECONCILED' || withL1.residual_wei !== '0') violations++;
  checked++; if (over.declared_l1_data_fee_wei !== null) violations++;
  return { name: 'P8_reconciliation_arithmetic_and_tolerance', trials: checked, violations };
}

// P9: output shape / no NaN / no undefined across malformed and well-formed inputs.
function checkP9_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, null, BASE06, BASE07, { ...BASE06, nonce: 'not-a-number' },
    { ...BASE07, callData: '0xodd' }, { ...BASE06, initCode: '0xabc' }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (typeof output_payload.verdict !== 'string') violations++;
    if (!Array.isArray(output_payload.reasons)) violations++;
    if (typeof output_payload.scope_note !== 'string' || output_payload.scope_note.length === 0) violations++;
    if (JSON.stringify(output_payload).includes('undefined')) violations++;
    if (JSON.stringify(output_payload).includes('NaN')) violations++;
  }
  return { name: 'P9_output_shape_no_nan_undefined', trials: checked, violations };
}

// P10: the Eip7702Support override is delegate-load-bearing and marker-gated. A different declared
// delegate changes the v0.8 hash; a non-marker initCode leaves the hash identical to the no-delegate
// run and reports no bound delegate; a marker initCode without a declared delegate is INDETERMINATE
// (the delegate is read from chain by the EntryPoint and is never fetched here).
function checkP10_eip7702OverrideBehaviour() {
  let violations = 0, checked = 0;
  const marker = '0x7702000000000000000000000000000000000000';
  const withA = compute({ ...BASE08P, initCode: marker }).output_payload;
  const withB = compute({ ...BASE08P, initCode: marker, eip7702Delegate: '0x0202020202020202020202020202020202020202' }).output_payload;
  checked++; if (withA.user_op_hash === withB.user_op_hash) violations++;
  checked++; if (withA.eip7702_delegate_bound !== '0x0101010101010101010101010101010101010101') violations++;
  checked++; if (withB.eip7702_delegate_bound !== '0x0202020202020202020202020202020202020202') violations++;
  const noMarkerRes = compute({ ...BASE08P, eip7702Delegate: '0x0202020202020202020202020202020202020202' });
  const noMarker = noMarkerRes.output_payload;
  const plain = compute({ ...BASE08P }).output_payload;
  checked++; if (noMarker.user_op_hash !== plain.user_op_hash) violations++;
  checked++; if (noMarker.eip7702_delegate_bound !== null) violations++;
  checked++; if (!noMarkerRes.compliance_flags.includes('ERC4337_EIP7702_INITCODE_OVERRIDE_NOT_APPLIED')) violations++;
  const missingDelegate = compute({ ...BASE08P, initCode: marker, eip7702Delegate: undefined });
  checked++; if (missingDelegate.output_payload.verdict !== 'INDETERMINATE' || missingDelegate.output_payload.user_op_hash !== null) violations++;
  checked++; if (!missingDelegate.output_payload.reasons.some((r) => r.includes('eip7702Delegate is required'))) violations++;
  // near-marker initCode (nonzero byte inside the first 20) is NOT the marker
  const nearInit = '0x77020000000000000000000000000000000000ff01';
  const nearMarker = compute({ ...BASE08P, initCode: nearInit }).output_payload;
  const nearPlain = compute({ ...BASE08P, initCode: nearInit, eip7702Delegate: undefined });
  checked++; if (nearMarker.eip7702_delegate_bound !== null) violations++;
  checked++; if (nearMarker.user_op_hash !== nearPlain.output_payload.user_op_hash) violations++;
  checked++; if (nearPlain.output_payload.verdict !== 'USEROP_RECOMPUTED') violations++;
  return { name: 'P10_eip7702_override_delegate_load_bearing_and_marker_gated', trials: checked, violations };
}

// P11: the v0.9 paymasterDataKeccak rule. Changing only the appended paymaster signature leaves the
// v0.9 hash, struct hash and paymasterAndData hash unchanged, while the same mutation moves the
// v0.8-path hash of the identical operation (v0.8 hashes the whole field). A length field reaching
// before the 52-byte header is the pinned revert shape and stays INDETERMINATE.
function checkP11_v09PaymasterSignatureExcluded() {
  let violations = 0, checked = 0;
  const header = '1234567890abcdef1234567890abcdef12345678'
    + '000000000000000000000000000186a0'
    + '0000000000000000000000000000c350';
  const pmWith = (sigHex) => '0x' + header + 'cafebabe' + sigHex
    + (sigHex.length / 2).toString(16).padStart(4, '0') + '22e325a297439656';
  const base09 = { ...BASE08P, entryPointVersion: '0.9' };
  const sigARes = compute({ ...base09, paymasterAndData: pmWith('ab'.repeat(65)) });
  const sigA = sigARes.output_payload;
  const sigB = compute({ ...base09, paymasterAndData: pmWith('cd'.repeat(65)) }).output_payload;
  checked++; if (sigA.user_op_hash !== sigB.user_op_hash) violations++;
  checked++; if (sigA.packed_user_op_hash !== sigB.packed_user_op_hash) violations++;
  checked++; if (sigA.field_hashes.paymaster_and_data_hash !== sigB.field_hashes.paymaster_and_data_hash) violations++;
  checked++; if (!sigARes.compliance_flags.includes('ERC4337_V09_PAYMASTER_SIGNATURE_EXCLUDED_FROM_HASH')) violations++;
  const v08A = compute({ ...base09, entryPointVersion: '0.8', paymasterAndData: pmWith('ab'.repeat(65)) }).output_payload;
  const v08B = compute({ ...base09, entryPointVersion: '0.8', paymasterAndData: pmWith('cd'.repeat(65)) }).output_payload;
  checked++; if (v08A.user_op_hash === v08B.user_op_hash) violations++;
  checked++; if (v08A.user_op_hash === sigA.user_op_hash) violations++;
  const bad = compute({ ...base09, paymasterAndData: '0x' + header + 'cafebabe' + 'ab'.repeat(2) + '0064' + '22e325a297439656' });
  checked++; if (bad.output_payload.verdict !== 'INDETERMINATE' || bad.output_payload.user_op_hash !== null) violations++;
  // no magic suffix: the whole field is hashed, exactly like v0.8
  const plainPm = '0x' + header + 'cafebabe';
  const p09 = compute({ ...base09, paymasterAndData: plainPm }).output_payload;
  const p08 = compute({ ...base09, entryPointVersion: '0.8', paymasterAndData: plainPm }).output_payload;
  checked++; if (p09.field_hashes.paymaster_and_data_hash !== p08.field_hashes.paymaster_and_data_hash) violations++;
  checked++; if (p09.user_op_hash !== p08.user_op_hash) violations++; // pinned: no suffix means the two paths hash identically
  return { name: 'P11_v09_paymaster_signature_excluded_from_hash', trials: checked, violations };
}

// P12: the declared authority drives sender_matches_declared_authority, which is null when absent,
// true on a match and false on a mismatch -- never a pass when undeclared.
function checkP12_declaredAuthorityFact() {
  let violations = 0, checked = 0;
  const absent = compute(BASE08P).output_payload;
  checked++; if (absent.sender_matches_declared_authority !== null) violations++;
  const match = compute({ ...BASE08P, eip7702Authority: BASE08P.sender }).output_payload;
  checked++; if (match.sender_matches_declared_authority !== true) violations++;
  const mismatch = compute({ ...BASE08P, eip7702Authority: '0x0303030303030303030303030303030303030303' }).output_payload;
  checked++; if (mismatch.sender_matches_declared_authority !== false) violations++;
  const malformed = compute({ ...BASE08P, eip7702Authority: '0x1234' });
  checked++; if (malformed.output_payload.verdict !== 'INDETERMINATE') violations++;
  return { name: 'P12_declared_authority_fact', trials: checked, violations };
}

// ---------- run ----------
const digest = checkDigestFreshness();
if (!digest.matches) {
  console.error('KERNEL DIGEST DRIFT -- this floor was authored against ' + digest.declared
    + ' but the kernel now hashes to ' + digest.actual
    + '. Re-verify the floor against the changed kernel and update the header, or revert the kernel.');
  process.exit(1);
}

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
results.properties.push(checkP2_requiredFieldMissingForcesIndeterminate());
results.properties.push(checkP3_versionIsLoadBearing());
results.properties.push(checkP4_hashSensitivity());
results.properties.push(checkP5_signatureExcludedFromHash());
results.properties.push(checkP6_prefundMonotonicity());
results.properties.push(checkP7_neverDerivesUnfetchableFees());
results.properties.push(checkP8_reconciliationArithmetic());
results.properties.push(checkP9_outputShapeInvariant());
results.properties.push(checkP10_eip7702OverrideBehaviour());
results.properties.push(checkP11_v09PaymasterSignatureExcluded());
results.properties.push(checkP12_declaredAuthorityFact());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-613-erc4337-userop-math',
  kernel_digest_verified: digest.actual,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
