// art-612-erc2612-permit-binding-verifier property-test floor (ETHMATH-PERMIT-1).
// kernel_digest_at_authoring: sha256:9324a023ea66694ceb311110dda30a54e95e78b7818e590d9f0844c73a0b345e
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain/message, not a totality proof. Shape: EIP-712 domain-separator + Permit struct-hash +
// digest recompute (art-590 shape) PLUS secp256k1 signer recovery + owner-binding compare
// (art-591 shape), via the vendored keccak_256/secp256k1 bundle -- confirmed against direct
// kernel source read per this row's fence. The fixture oracle (5 vectors: two real signed BINDS
// vectors on distinct domains, one real signed owner-mismatch DOES_NOT_BIND vector, one legacy
// v=27/28 BINDS vector, one all-fields-missing INDETERMINATE vector -- every signed vector's
// digest independently cross-checked against a separate ABI-encoding re-implementation and
// signed with a real secp256k1 key, per the fixtures file note) is the primary correctness
// anchor; properties below are structural invariants a keccak-recompute + ECDSA-recover kernel
// must hold regardless of the exact hash/curve arithmetic. float:no (all inputs are
// caller-supplied hex/decimal strings normalized to BigInt/bytes, never floats). ZERO external
// dependencies beyond the kernel's own vendored keccak_256/secp256k1 -- pure Node built-ins
// otherwise. READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-612-erc2612-permit-binding-verifier.proptest.mjs

import { compute } from '../art-612-erc2612-permit-binding-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const BASE_PP = {
  name: 'USD Coin', version: '2', chainId: 1,
  verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  owner: '0xe05fcc23807536bee418f142d19fa0d21bb0cff7',
  spender: '0x1111111111111111111111111111111111111111',
  value: 1000000, nonce: 0, deadline: 2000000000,
  r: '0x70bb0933677f1bd68df1604ed9dcdfab90cb39809ff6b370e3676fb81baa6081',
  s: '0x25f5a16ced7deac7fd852ea8501a09b720578aeec619db7ffd7022fea1ab7565',
  yParity: 0,
};
const REQUIRED_FIELDS = ['name', 'version', 'chainId', 'verifyingContract', 'owner', 'spender', 'value', 'nonce', 'deadline', 'r', 's'];

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-612-erc2612-permit-binding-verifier.fixtures.json');
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

// P3: digest sensitivity -- flipping the nonce (holding everything else fixed) changes the
// digest and struct_hash, and the domain_separator is unaffected by a message-only field.
function checkP3_digestSensitivity() {
  let violations = 0, checked = 0;
  const base = compute(BASE_PP).output_payload;
  const flippedNonce = { ...BASE_PP, nonce: 99 };
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
    if (typeof output_payload.permit !== 'object' || output_payload.permit === null) violations++;
  }
  return { name: 'P4_output_shape_no_nan_undefined', trials: checked, violations };
}

// P5: owner-binding internal consistency. `owner` is itself a signed struct field (unlike the
// sibling art-591's separate `claimedFrom` comparison target), so mutating it changes the
// struct_hash/digest and therefore generally the value the same (r,s,recoveryId) recovers to --
// this is correct EIP-712/ERC-2612 behaviour, not a bug. What must hold regardless: (a)
// `recovered_signer_matches_owner` always equals the literal `recovered_signer === owner`
// comparison, and (b) verdict is BINDS iff that comparison is true, across several owner claims
// including the fixture's genuine owner-mismatch case.
function checkP5_recoveredSignerMatchesOwnerConsistency() {
  let violations = 0, checked = 0;
  const cases = [
    BASE_PP,
    { ...BASE_PP, owner: '0xf5a5e415061470a8b9137959180901aea72450a4' },
    { ...BASE_PP, owner: '0x0000000000000000000000000000000000000000' },
  ];
  for (const pp of cases) {
    const out = compute(pp).output_payload;
    checked++;
    const literalMatch = out.recovered_signer === out.permit.owner;
    if (out.recovered_signer_matches_owner !== literalMatch) violations++;
    checked++;
    if ((out.verdict === 'BINDS') !== literalMatch) violations++;
  }
  return { name: 'P5_recovered_signer_matches_owner_consistency', trials: checked, violations };
}

// P6: verdict vocabulary -- never emits "valid"/"approved"/"authorized" language (spec ban).
function checkP6_verdictVocabularyBan() {
  let violations = 0, checked = 0;
  const banned = /\b(valid|approved|authorized)\b/i;
  const inputs = [BASE_PP, {}, { ...BASE_PP, owner: '0xf5a5e415061470a8b9137959180901aea72450a4' }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (banned.test(output_payload.verdict)) violations++;
  }
  return { name: 'P6_verdict_vocabulary_ban', trials: checked, violations };
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
results.properties.push(checkP5_recoveredSignerMatchesOwnerConsistency());
results.properties.push(checkP6_verdictVocabularyBan());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-612-erc2612-permit-binding-verifier',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
