// art-613-erc4337-userop-math property-test floor (ETHMATH-USEROP-1).
// kernel_digest_at_authoring: sha256:5590e940c1c036d108e0bfb8662b88bdfec6c275cc55843ac2a9f14cd0c78ba9
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- a cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape: ERC-4337 userOpHash recompute over two declared EntryPoint
// struct layouts, plus uint256 prefund arithmetic and a declared-input reconciliation. The fixture
// oracle (10 vectors, every hash cross-checked against an independent from-spec Keccak-256 and ABI
// encoder per the fixtures file note) is the primary correctness anchor; the properties below are
// structural invariants this kernel must hold regardless of the exact hash arithmetic. float:no
// (every numeric input is normalized to BigInt; no floating point anywhere in the kernel).
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
const DIGEST_AT_AUTHORING = 'sha256:5590e940c1c036d108e0bfb8662b88bdfec6c275cc55843ac2a9f14cd0c78ba9';

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

// P3: the declared EntryPoint version is load-bearing -- identical field values under v0.6 and v0.7
// MUST hash differently, and neither may be produced by an unrecognised version.
function checkP3_versionIsLoadBearing() {
  let violations = 0, checked = 0;
  const h6 = compute(BASE06).output_payload;
  const h7 = compute({ ...BASE06, entryPointVersion: '0.7' }).output_payload;
  checked++; if (h6.user_op_hash === h7.user_op_hash) violations++;
  checked++; if (h6.packed_words.word_count !== 10 || h7.packed_words.word_count !== 8) violations++;
  for (const bad of ['0.8', '0.5', 'latest', '', 'v1']) {
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
