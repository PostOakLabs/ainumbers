// art-127-dual-layer-disclosure-verifier property-test floor (FV-PROPFLOOR-SHARD-A-CHECKSOBJ-1).
// kernel_digest_at_authoring: sha256:56cd22eca21423290fd3c332d722f6e6afd0c5a3b24650cf68b266aa33db0ae8
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape confirmed by direct source read: fixed CHECKS object
// (c2pa_metadata_present, watermark_present, method_recognized against a declared 5-value
// enum) feeding `layers_present`/`missing_layer` -> `dual_layer_ok` verdict. Member of the
// "fixed CHECKS object -> gap list" class-A sub-family named in FV-PROPFLOOR-SHARD-A-CHECKSOBJ-1's
// own fence.
// float:no (declared booleans + string enum, no numeric float fields) -- forced CATEGORICAL
// boundary cases (both booleans x every declared WATERMARK_METHODS value) stand in for ULP
// forcing. ZERO external dependencies -- pure Node built-ins only. READ-ONLY w.r.t. the kernel
// it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-127-dual-layer-disclosure-verifier.proptest.mjs

import { compute } from '../art-127-dual-layer-disclosure-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mulberry32, pick, findShapeViolations, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-127-dual-layer-disclosure-verifier';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WATERMARK_METHODS = ['synthid', 'digimarc', 'trustmark', 'c2pa.soft_binding', 'other'];
const UNRECOGNIZED_METHODS = ['unknown_method', null];

function buildProfile(c2paPresent, watermarkPresent, method) {
  return { c2pa_metadata_present: c2paPresent, watermark_present: watermarkPresent, watermark_method: method };
}

function randomProfile(rng) {
  const allMethods = [...WATERMARK_METHODS, ...UNRECOGNIZED_METHODS];
  return buildProfile(rng() < 0.5, rng() < 0.5, pick(rng, allMethods));
}

// P1: layers_present, method_recognized, dual_layer_ok, missing_layer are correct
// re-derivations of the declared checks.
async function checkP1_checksDerivation() {
  let violations = 0, checked = 0;
  const rng = mulberry32(127001);
  for (let i = 0; i < 300; i++) {
    const pp = randomProfile(rng);
    const { output_payload: op } = await compute(pp);
    checked++;
    const expLayers = [];
    if (pp.c2pa_metadata_present === true) expLayers.push('c2pa_signed_metadata');
    if (pp.watermark_present === true) expLayers.push('imperceptible_watermark');
    const expRecognized = typeof pp.watermark_method === 'string' && WATERMARK_METHODS.includes(pp.watermark_method);
    const expDualOk = pp.c2pa_metadata_present === true && pp.watermark_present === true;
    const expMissing = expDualOk ? null : (pp.c2pa_metadata_present !== true ? 'c2pa_signed_metadata' : 'imperceptible_watermark');
    if (JSON.stringify(op.layers_present) !== JSON.stringify(expLayers)) violations++;
    if (op.method_recognized !== expRecognized) violations++;
    if (op.dual_layer_ok !== expDualOk) violations++;
    if (op.missing_layer !== expMissing) violations++;
  }
  return { name: 'P1_checks_derivation_random300', checked, violations };
}

// P2: forced categorical boundary cases -- both governing booleans x every declared method
// value (recognized and unrecognized).
async function checkP2_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;
  const allMethods = [...WATERMARK_METHODS, ...UNRECOGNIZED_METHODS];
  for (const c2pa of [true, false]) {
    for (const watermark of [true, false]) {
      for (const method of allMethods) {
        const pp = buildProfile(c2pa, watermark, method);
        const { output_payload: op } = await compute(pp);
        checked++;
        if (op.dual_layer_ok !== (c2pa && watermark)) violations++;
        if (typeof op.method_recognized !== 'boolean') violations++;
      }
    }
  }
  return { name: 'P2_forced_categorical_boundary_cases', checked, violations };
}

// P3: output shape -- no NaN/undefined, correct field types, across missing-field inputs.
async function checkP3_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { c2pa_metadata_present: true }, { watermark_present: true }, { watermark_method: 'synthid' }];
  for (const pp of inputs) {
    const { output_payload: op } = await compute(pp);
    checked++;
    if (findShapeViolations(op).length > 0) violations++;
    if (typeof op.dual_layer_ok !== 'boolean') violations++;
    if (!Array.isArray(op.layers_present)) violations++;
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

  const controlPP = buildProfile(true, true, 'synthid');
  const { output_payload: controlOp } = await compute(controlPP);
  const mutated = { ...controlOp, dual_layer_ok: !controlOp.dual_layer_ok };
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
