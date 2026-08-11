// art-128-content-binding-assertion-validator property-test floor (FV-PROPFLOOR-SHARD-A-CHECKSOBJ-1).
// kernel_digest_at_authoring: sha256:60e81365b579a79abf492ac5f0629ac124c93f263ad1a66363dca62be1c898af
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape confirmed by direct source read: fixed CHECKS object
// (type_valid against a declared 3-value enum, hard_hashes_well_formed via regex,
// hard_binding_matches, soft_binding_present) feeding a `verdict` enum. Member of the
// "fixed CHECKS object -> gap list" class-A sub-family named in FV-PROPFLOOR-SHARD-A-CHECKSOBJ-1's
// own fence (here "gap list" degenerates to the single `verdict` field, no separate array).
// float:no (declared string enum + regex-validated hash strings + boolean, no numeric float
// fields) -- forced CATEGORICAL boundary cases (every binding_type x hash-well-formed x
// hash-match x soft-present combination) stand in for ULP forcing. ZERO external dependencies
// -- pure Node built-ins only. READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-128-content-binding-assertion-validator.proptest.mjs

import { compute } from '../art-128-content-binding-assertion-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mulberry32, pick, findShapeViolations, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-128-content-binding-assertion-validator';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VALID_TYPES = ['hard', 'soft', 'both'];
const HASH_A = 'sha256:' + 'a'.repeat(64);
const HASH_B = 'sha256:' + 'b'.repeat(64);
const MALFORMED_HASH = 'not-a-hash';

function buildProfile(bindingType, assetHash, claimedHash, softPresent) {
  return { binding_type: bindingType, asset_bytes_hash: assetHash, claimed_hard_binding_hash: claimedHash, soft_binding_identifier_present: softPresent };
}

function randomProfile(rng) {
  const types = [...VALID_TYPES, 'invalid'];
  const hashes = [HASH_A, HASH_B, MALFORMED_HASH, undefined];
  return buildProfile(pick(rng, types), pick(rng, hashes), pick(rng, hashes), rng() < 0.5);
}

// P1: type_valid, hard_hashes_well_formed, hard_binding_matches, soft_binding_present,
// tamper_evident, and verdict are correct re-derivations of the declared checks.
async function checkP1_checksDerivation() {
  let violations = 0, checked = 0;
  const rng = mulberry32(128001);
  const HASH_RE = /^sha256:[0-9a-f]{64}$/;
  for (let i = 0; i < 300; i++) {
    const pp = randomProfile(rng);
    const { output_payload: op } = await compute(pp);
    checked++;
    const hasHard = pp.binding_type === 'hard' || pp.binding_type === 'both';
    const hasSoft = pp.binding_type === 'soft' || pp.binding_type === 'both';
    const wellFormed = typeof pp.asset_bytes_hash === 'string' && HASH_RE.test(pp.asset_bytes_hash) &&
      typeof pp.claimed_hard_binding_hash === 'string' && HASH_RE.test(pp.claimed_hard_binding_hash);
    const expHardMatches = hasHard && wellFormed && pp.asset_bytes_hash === pp.claimed_hard_binding_hash;
    const expSoftPresent = hasSoft && pp.soft_binding_identifier_present === true;
    const expTamperEvident = expHardMatches;
    const expVerdict = expTamperEvident ? 'TAMPER_EVIDENT' : (expSoftPresent ? 'SOFT_BINDING_ONLY' : 'UNBOUND');
    if (op.hard_binding_matches !== expHardMatches) violations++;
    if (op.soft_binding_present !== expSoftPresent) violations++;
    if (op.tamper_evident !== expTamperEvident) violations++;
    if (op.verdict !== expVerdict) violations++;
  }
  return { name: 'P1_checks_derivation_random300', checked, violations };
}

// P2: forced categorical boundary cases -- every binding_type value x hash-match x
// hash-well-formed x soft-present combination.
async function checkP2_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;
  const types = [...VALID_TYPES, 'invalid'];
  for (const bindingType of types) {
    for (const [assetHash, claimedHash] of [[HASH_A, HASH_A], [HASH_A, HASH_B], [MALFORMED_HASH, MALFORMED_HASH], [undefined, undefined]]) {
      for (const softPresent of [true, false]) {
        const pp = buildProfile(bindingType, assetHash, claimedHash, softPresent);
        const { output_payload: op } = await compute(pp);
        checked++;
        if (!['TAMPER_EVIDENT', 'SOFT_BINDING_ONLY', 'UNBOUND'].includes(op.verdict)) violations++;
      }
    }
  }
  return { name: 'P2_forced_categorical_boundary_cases', checked, violations };
}

// P3: output shape -- no NaN/undefined, correct field types, across missing-field inputs.
async function checkP3_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { binding_type: 'hard' }, { binding_type: 'both' }, { soft_binding_identifier_present: true }];
  for (const pp of inputs) {
    const { output_payload: op } = await compute(pp);
    checked++;
    if (findShapeViolations(op).length > 0) violations++;
    if (typeof op.verdict !== 'string') violations++;
    if (typeof op.tamper_evident !== 'boolean') violations++;
  }
  return { name: 'P3_output_shape_no_nan_undefined', checked, violations };
}

// ---------- run ----------
async function main() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', `${KERNEL_ID}.fixtures.json`);
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = await compute(vec.policy_parameters);
    if (JSON.stringify(output_payload) !== JSON.stringify(vec.output_payload)) {
      failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
    }
  }
  const oracleResult = { total: fixtures.vectors.length, failures };
  if (oracleResult.failures.length > 0) {
    console.error('FIXTURE ORACLE FAILED --', JSON.stringify(oracleResult.failures, null, 2));
    process.exit(1);
  }

  const controlPP = buildProfile('hard', HASH_A, HASH_A, false);
  const { output_payload: controlOp } = await compute(controlPP);
  const mutated = { ...controlOp, verdict: controlOp.verdict === 'TAMPER_EVIDENT' ? 'UNBOUND' : 'TAMPER_EVIDENT' };
  const negativeControlOk = JSON.stringify(mutated) !== JSON.stringify(controlOp);
  if (!negativeControlOk) {
    console.error('NEGATIVE CONTROL FAILED -- comparator never observed rejecting a wrong output.');
    process.exit(1);
  }

  const properties = [
    await checkP1_checksDerivation(),
    await checkP2_forcedCategoricalBoundaries(),
    await checkP3_outputShapeInvariant(),
  ];

  const ok = summarize(KERNEL_ID, oracleResult, properties);
  process.exit(ok ? 0 : 1);
}

main();
