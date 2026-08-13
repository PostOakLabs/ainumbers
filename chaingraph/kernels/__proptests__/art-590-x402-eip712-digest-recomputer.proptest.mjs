// art-590-x402-eip712-digest-recomputer property-test floor (ADJACENT-HOOKS-ASSEMBLE-LAND-1).
// kernel_digest_at_authoring: sha256:62dbc12bf0d0a66b089587f7c30ca10fa8ec5e33bed5d8867d9d7dfdba7b0b15
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED domain,
// not a totality proof. Shape: EIP-712 domain-separator + struct-hash + digest recompute via a vendored
// keccak_256 -- confirmed against direct kernel source read per this row's fence. The fixture oracle
// (4 vectors, cross-checked against an independent Python/pycryptodome re-implementation per the
// fixtures file note) is the primary correctness anchor; properties below are structural invariants a
// keccak-recompute kernel must hold regardless of the exact hash arithmetic. float:no (all inputs are
// caller-supplied hex/decimal strings normalized to BigInt/bytes, never floats). ZERO external
// dependencies beyond the kernel's own vendored keccak_256 -- pure Node built-ins otherwise. READ-ONLY
// w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-590-x402-eip712-digest-recomputer.proptest.mjs

import { compute } from '../art-590-x402-eip712-digest-recomputer.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const BASE_PP = {
  name: 'USD Coin', version: '2', chainId: 1,
  verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  from: '0x2A1530C4C41db0B0b2bB646CB5Eb1A67b7158667',
  to: '0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f2',
  value: 1000000, validAfter: 0, validBefore: 2000000000,
  nonce: '0x0000000000000000000000000000000000000000000000000000000000000001',
};
const REQUIRED_FIELDS = ['name', 'version', 'chainId', 'verifyingContract', 'from', 'to', 'value', 'validAfter', 'validBefore', 'nonce'];

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-590-x402-eip712-digest-recomputer.fixtures.json');
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
  const mutated = { ...output_payload, digest: output_payload.digest === '0xdead' ? '0xbeef' : '0xdead' };
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

// P2: every REQUIRED field missing individually -> verdict INDETERMINATE, digest null.
function checkP2_requiredFieldMissingForcesIndeterminate() {
  let violations = 0, checked = 0;
  for (const field of REQUIRED_FIELDS) {
    const pp = { ...BASE_PP };
    delete pp[field];
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.verdict !== 'INDETERMINATE' || output_payload.digest !== null) violations++;
  }
  return { name: 'P2_required_field_missing_forces_indeterminate', trials: checked, violations };
}

// P3: digest sensitivity -- flipping the nonce (holding everything else fixed) changes the digest,
// and the domain_separator is unaffected by an authorization-only field (nonce is domain-independent).
function checkP3_digestSensitivity() {
  let violations = 0, checked = 0;
  const base = compute(BASE_PP).output_payload;
  const flippedNonce = { ...BASE_PP, nonce: '0x0000000000000000000000000000000000000000000000000000000000000002' };
  const flipped = compute(flippedNonce).output_payload;
  checked++; if (flipped.digest === base.digest) violations++;
  checked++; if (flipped.domain_separator !== base.domain_separator) violations++;
  checked++; if (flipped.struct_hash === base.struct_hash) violations++;
  return { name: 'P3_digest_sensitivity_nonce_flip', trials: checked, violations };
}

// P4: output shape / no NaN / undefined across a spread of malformed and well-formed inputs.
function checkP4_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, BASE_PP, { ...BASE_PP, value: 0 }, { ...BASE_PP, chainId: 8453 }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (typeof output_payload.verdict !== 'string') violations++;
    if (!Array.isArray(output_payload.reasons)) violations++;
    if (typeof output_payload.domain !== 'object' || output_payload.domain === null) violations++;
    if (typeof output_payload.authorization !== 'object' || output_payload.authorization === null) violations++;
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

results.properties.push(checkP1_determinism());
results.properties.push(checkP2_requiredFieldMissingForcesIndeterminate());
results.properties.push(checkP3_digestSensitivity());
results.properties.push(checkP4_outputShapeInvariant());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-590-x402-eip712-digest-recomputer',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
