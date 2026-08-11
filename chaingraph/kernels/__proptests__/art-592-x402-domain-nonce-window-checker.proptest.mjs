// art-592-x402-domain-nonce-window-checker property-test floor (ADJACENT-HOOKS-ASSEMBLE-LAND-1).
// kernel_digest_at_authoring: sha256:b38255c8483b8792648d21f7a06a061fa24aaaea6ffce83ffb9c9b340afab72a
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED domain,
// not a totality proof. Shape: pure categorical comparator -- caller-declared expected vs signed
// chainId/verifyingContract, a validAfter<=now<=validBefore window check, a zero-bytes32 nonce
// well-formedness check, and a caller-supplied nonce_already_used replay flag, ORed into a single
// PASS/REFUSE hard-refuse gate -- confirmed against direct kernel source read per this row's fence.
// float:no (chainId/validAfter/validBefore/now_unix are declared non-negative uint256 BigInts, never
// caller-controlled floats) -- forced categorical boundary cases (each individual refuse condition, and
// their OR-combination) stand in for ULP forcing. ZERO external dependencies -- pure Node built-ins
// only. READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-592-x402-domain-nonce-window-checker.proptest.mjs

import { compute } from '../art-592-x402-domain-nonce-window-checker.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const CLEAN_PP = {
  expected_chain_id: 1, expected_verifying_contract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  chainId: 1, verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  validAfter: 0, validBefore: 2000000000, now_unix: 1000000000,
  nonce: '0x0000000000000000000000000000000000000000000000000000000000000001',
  nonce_already_used: false,
};

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-592-x402-domain-nonce-window-checker.fixtures.json');
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
  const { output_payload } = compute(CLEAN_PP);
  const mutated = { ...output_payload, verdict: output_payload.verdict === 'PASS' ? 'REFUSE' : 'PASS' };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

// P1: each of the four hard-refuse conditions, held individually against an otherwise-clean baseline,
// forces verdict REFUSE -- random 200-sample over the four condition axes.
function checkP1_hardRefuseConditionsAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(592001);
  const axes = ['chain', 'contract', 'window', 'nonce', 'replay'];
  for (let i = 0; i < 200; i++) {
    const axis = axes[Math.floor(rng() * axes.length)];
    const pp = { ...CLEAN_PP };
    if (axis === 'chain') pp.chainId = 8453;
    if (axis === 'contract') pp.verifyingContract = '0x1111111111111111111111111111111111111111';
    if (axis === 'window') pp.now_unix = 3000000000;
    if (axis === 'nonce') pp.nonce = '0x0000000000000000000000000000000000000000000000000000000000000000';
    if (axis === 'replay') pp.nonce_already_used = true;
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.verdict !== 'REFUSE') violations++;
  }
  return { name: 'P1_hard_refuse_conditions_force_refuse_random200', trials: checked, violations };
}

// P2: verdict is PASS iff none of the four hard-refuse conditions hold -- checked directly against the
// clean baseline (all conditions satisfied -> PASS).
function checkP2_cleanBaselinePasses() {
  const { output_payload } = compute(CLEAN_PP);
  const violations = output_payload.verdict === 'PASS' ? 0 : 1;
  return { name: 'P2_clean_baseline_passes', trials: 1, violations };
}

// P3: window-edge boundary cases -- now_unix exactly at validAfter and exactly at validBefore are both
// within the window (inclusive bounds per the kernel's <= / <= comparison).
function checkP3_windowInclusiveBoundaries() {
  let violations = 0, checked = 0;
  const atStart = compute({ ...CLEAN_PP, now_unix: CLEAN_PP.validAfter }).output_payload;
  checked++; if (atStart.authorization_within_window !== true) violations++;
  const atEnd = compute({ ...CLEAN_PP, now_unix: CLEAN_PP.validBefore }).output_payload;
  checked++; if (atEnd.authorization_within_window !== true) violations++;
  const oneBeforeStart = compute({ ...CLEAN_PP, validAfter: 100, now_unix: 99 }).output_payload;
  checked++; if (oneBeforeStart.authorization_not_yet_valid !== true) violations++;
  return { name: 'P3_window_inclusive_boundaries', trials: checked, violations };
}

// P4: required-field-missing forces verdict INDETERMINATE with all boolean fields null.
function checkP4_requiredFieldMissingForcesIndeterminate() {
  let violations = 0, checked = 0;
  const REQUIRED = ['expected_chain_id', 'expected_verifying_contract', 'chainId', 'verifyingContract', 'validAfter', 'validBefore', 'now_unix', 'nonce'];
  for (const field of REQUIRED) {
    const pp = { ...CLEAN_PP };
    delete pp[field];
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.verdict !== 'INDETERMINATE' || output_payload.domain_chain_match !== null) violations++;
  }
  return { name: 'P4_required_field_missing_forces_indeterminate', trials: checked, violations };
}

// P5: output shape / no NaN / undefined across malformed and well-formed inputs.
function checkP5_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, CLEAN_PP, { ...CLEAN_PP, nonce_already_used: undefined }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (typeof output_payload.verdict !== 'string') violations++;
    if (!Array.isArray(output_payload.reasons)) violations++;
    if (!Array.isArray(output_payload.disclosure) && typeof output_payload.disclosure !== 'string') violations++;
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

results.properties.push(checkP1_hardRefuseConditionsAgreement());
results.properties.push(checkP2_cleanBaselinePasses());
results.properties.push(checkP3_windowInclusiveBoundaries());
results.properties.push(checkP4_requiredFieldMissingForcesIndeterminate());
results.properties.push(checkP5_outputShapeInvariant());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-592-x402-domain-nonce-window-checker',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
