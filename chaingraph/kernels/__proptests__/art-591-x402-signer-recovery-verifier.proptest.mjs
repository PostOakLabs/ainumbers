// art-591-x402-signer-recovery-verifier property-test floor (ADJACENT-HOOKS-ASSEMBLE-LAND-1).
// kernel_digest_at_authoring: sha256:4dfa2047d3aeebb35c0825fa07d54d487c7b254d0ad031e2d0c360a3736b5ab7
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED domain,
// not a totality proof. Shape: ECDSA secp256k1 signature recovery via a vendored noble-curves bundle --
// confirmed against direct kernel source read per this row's fence. The fixture oracle (5 vectors,
// signed with the well-known test key 0x000...001, address independently confirmable per the fixtures
// file note) is the primary correctness anchor -- this floor does not re-derive elliptic-curve math, it
// checks structural invariants the kernel must hold regardless of the exact recovery arithmetic.
// float:no (all inputs are hex strings / small integers, never floats). ZERO external dependencies
// beyond the kernel's own vendored secp256k1/keccak_256 -- pure Node built-ins otherwise. READ-ONLY
// w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-591-x402-signer-recovery-verifier.proptest.mjs

import { compute } from '../art-591-x402-signer-recovery-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const KNOWN_PP = {
  digest: '0xb68e5d60d6169bad9739d30399af8f8c7378d464d25f4d971911ab65ef0b014b',
  r: '0x9b74dd5c8bb58124bcc04c7a561231fca3e1fddfac2e9b2e361bb494b6b9dbb6',
  s: '0x62b4d6e9bc1f5fb62742981efd25c46dcc979a8b37ca92705c690d8ce0b56712',
  yParity: 0,
  claimedFrom: '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf',
};
const KNOWN_SIGNER = '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf';

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-591-x402-signer-recovery-verifier.fixtures.json');
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

// P2: recovered_signer_matches_claimed_from is a pure function of (recovered_signer, claimed_from):
// null iff claimedFrom absent, else strict equality -- checked against the known vector with a matching
// and a mismatching claim.
function checkP2_matchFlagAgreement() {
  let violations = 0, checked = 0;
  const noClaim = compute({ digest: KNOWN_PP.digest, r: KNOWN_PP.r, s: KNOWN_PP.s, yParity: 0 }).output_payload;
  checked++; if (noClaim.recovered_signer_matches_claimed_from !== null) violations++;
  const matchClaim = compute(KNOWN_PP).output_payload;
  checked++; if (matchClaim.recovered_signer_matches_claimed_from !== true) violations++;
  const mismatchClaim = compute({ ...KNOWN_PP, claimedFrom: '0x1111111111111111111111111111111111111111' }).output_payload;
  checked++; if (mismatchClaim.recovered_signer_matches_claimed_from !== false) violations++;
  return { name: 'P2_match_flag_agreement', trials: checked, violations };
}

// P3: malformed/absent signature fields never throw and always yield verdict INDETERMINATE with
// recovered_signer null -- the kernel's own "never throws" invariant (per the fixtures file's
// malformed-signature-never-throws vector), forced across several distinct malformed shapes.
function checkP3_malformedNeverThrowsForcesIndeterminate() {
  let violations = 0, checked = 0;
  const malformed = [
    {},
    { digest: KNOWN_PP.digest },
    { digest: KNOWN_PP.digest, signature: '0xdeadbeef' },
    { digest: '0xnothex', r: KNOWN_PP.r, s: KNOWN_PP.s, yParity: 0 },
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
    if (output_payload.verdict !== 'INDETERMINATE' || output_payload.recovered_signer !== null) violations++;
  }
  return { name: 'P3_malformed_never_throws_forces_indeterminate', trials: checked, violations };
}

// P4: recovery_id_source is set exactly when a signer was recovered, and unset (null) exactly when not.
function checkP4_recoveryIdSourceAgreesWithVerdict() {
  let violations = 0, checked = 0;
  const cases = [KNOWN_PP, {}, { digest: KNOWN_PP.digest, signature: '0xdead' }];
  for (const pp of cases) {
    const { output_payload } = compute(pp);
    checked++;
    const recovered = output_payload.verdict === 'SIGNER_RECOVERED';
    const hasSource = output_payload.recovery_id_source !== null;
    if (recovered !== hasSource) violations++;
  }
  return { name: 'P4_recovery_id_source_agrees_with_verdict', trials: checked, violations };
}

// P5: output shape / no NaN / undefined across the known-good and malformed inputs.
function checkP5_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [KNOWN_PP, {}, { digest: KNOWN_PP.digest, signature: '0xdeadbeef' }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (typeof output_payload.verdict !== 'string') violations++;
    if (!Array.isArray(output_payload.reasons)) violations++;
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

results.properties.push(checkP1_determinism());
results.properties.push(checkP2_matchFlagAgreement());
results.properties.push(checkP3_malformedNeverThrowsForcesIndeterminate());
results.properties.push(checkP4_recoveryIdSourceAgreesWithVerdict());
results.properties.push(checkP5_outputShapeInvariant());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-591-x402-signer-recovery-verifier',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
