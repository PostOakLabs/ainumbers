// art-132-agent-key-rotation-auditor property-test floor (FV-PROPFLOOR-SHARD-A-CHECKSOBJ-1).
// kernel_digest_at_authoring: sha256:25ff3998171f39653fb0799f0c1892c148031af3615a59fe45b4a7e1ab3cecd3
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape confirmed by direct source read: fixed CHECKS object
// (rotation_due via integer age comparison, alg_ok, next_key_present) feeding a
// `rotation_posture` 3-value enum. Member of the "fixed CHECKS object -> gap list" class-A
// sub-family named in FV-PROPFLOOR-SHARD-A-CHECKSOBJ-1's own fence. The `key_age_s = now -
// created` subtraction is plain integer arithmetic over unix timestamps, not floating point.
// float:no per triage table -- forced CATEGORICAL boundary cases include the integer
// threshold boundary (age == max-1, == max, == max+1) as the declared "no ULP, force the
// categorical edge" carve-out. ZERO external dependencies -- pure Node built-ins only.
// READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-132-agent-key-rotation-auditor.proptest.mjs

import { compute } from '../art-132-agent-key-rotation-auditor.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mulberry32, pick, findShapeViolations, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-132-agent-key-rotation-auditor';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAX_AGE = 7776000;
const BASE_NOW = 1750000000;

function buildProfile(ageOffset, nextKeyPresent, algorithm) {
  return { key_created_unix: BASE_NOW - ageOffset, now_unix: BASE_NOW, max_key_age_s: MAX_AGE, next_key_present: nextKeyPresent, algorithm };
}

function randomProfile(rng) {
  const ages = [0, MAX_AGE - 1, MAX_AGE, MAX_AGE + 1, MAX_AGE * 2];
  return buildProfile(pick(rng, ages), rng() < 0.5, pick(rng, ['ed25519', 'rsa-pss']));
}

// P1: key_age_s, rotation_due, alg_ok, rotation_posture are correct re-derivations.
async function checkP1_checksDerivation() {
  let violations = 0, checked = 0;
  const rng = mulberry32(132001);
  for (let i = 0; i < 300; i++) {
    const pp = randomProfile(rng);
    const { output_payload: op } = await compute(pp);
    checked++;
    const expAge = pp.now_unix - pp.key_created_unix;
    const expDue = expAge >= pp.max_key_age_s;
    const expAlgOk = pp.algorithm === 'ed25519';
    const expPosture = (!expDue && expAlgOk) ? 'HEALTHY' : (expDue && pp.next_key_present === true) ? 'ROTATION_STAGED' : 'ACTION_REQUIRED';
    if (op.key_age_s !== expAge) violations++;
    if (op.rotation_due !== expDue) violations++;
    if (op.alg_ok !== expAlgOk) violations++;
    if (op.rotation_posture !== expPosture) violations++;
  }
  return { name: 'P1_checks_derivation_random300', checked, violations };
}

// P2: forced categorical boundary cases -- integer age threshold (max-1/max/max+1) x
// next_key_present x algorithm, the declared no-ULP categorical edge per spec §3.
async function checkP2_forcedThresholdBoundaries() {
  let violations = 0, checked = 0;
  for (const ageOffset of [MAX_AGE - 1, MAX_AGE, MAX_AGE + 1]) {
    for (const nextKeyPresent of [true, false]) {
      for (const algorithm of ['ed25519', 'rsa-pss']) {
        const pp = buildProfile(ageOffset, nextKeyPresent, algorithm);
        const { output_payload: op } = await compute(pp);
        checked++;
        const expDue = ageOffset >= MAX_AGE;
        if (op.rotation_due !== expDue) violations++;
        if (!['HEALTHY', 'ROTATION_STAGED', 'ACTION_REQUIRED'].includes(op.rotation_posture)) violations++;
      }
    }
  }
  return { name: 'P2_forced_threshold_boundary_cases', checked, violations };
}

// P3: output shape -- no NaN/undefined, correct field types, across missing-field inputs.
async function checkP3_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { key_created_unix: BASE_NOW }, { algorithm: 'ed25519' }, { now_unix: BASE_NOW, key_created_unix: BASE_NOW }];
  for (const pp of inputs) {
    const { output_payload: op } = await compute(pp);
    checked++;
    if (findShapeViolations(op).length > 0) violations++;
    if (typeof op.rotation_posture !== 'string') violations++;
    if (typeof op.rotation_due !== 'boolean') violations++;
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

  const controlPP = buildProfile(0, false, 'ed25519');
  const { output_payload: controlOp } = await compute(controlPP);
  const mutated = { ...controlOp, rotation_posture: controlOp.rotation_posture === 'HEALTHY' ? 'ACTION_REQUIRED' : 'HEALTHY' };
  const negativeControlOk = JSON.stringify(mutated) !== JSON.stringify(controlOp);
  if (!negativeControlOk) {
    console.error('NEGATIVE CONTROL FAILED -- comparator never observed rejecting a wrong output.');
    process.exit(1);
  }

  const properties = [
    await checkP1_checksDerivation(),
    await checkP2_forcedThresholdBoundaries(),
    await checkP3_outputShapeInvariant(),
  ];

  const ok = summarize(KERNEL_ID, oracleResult, properties);
  process.exit(ok ? 0 : 1);
}

main();
