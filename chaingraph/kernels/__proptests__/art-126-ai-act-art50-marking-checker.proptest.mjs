// art-126-ai-act-art50-marking-checker property-test floor (FV-PROPFLOOR-SHARD-A-CHECKSOBJ-1).
// kernel_digest_at_authoring: sha256:7b3eb5f17b46b43c54e96195da8716c39b2eccc9ac75080186ff0dd578e31411
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape confirmed by direct source read: fixed CHECKS object
// (source_type_recognized against a declared 6-value enum, machine_readable_marking_present,
// deepfake_disclosure_ok) feeding a `gaps` array and `art50_conformant` verdict. Member of the
// "fixed CHECKS object -> gap list" class-A sub-family named in FV-PROPFLOOR-SHARD-A-CHECKSOBJ-1's
// own fence.
// float:no (declared string enum + booleans, no numeric float fields) -- forced CATEGORICAL
// boundary cases (every declared AI_SOURCE_TYPES enum value x marking/deepfake/disclosure
// booleans) stand in for ULP forcing. ZERO external dependencies -- pure Node built-ins only.
// READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-126-ai-act-art50-marking-checker.proptest.mjs

import { compute } from '../art-126-ai-act-art50-marking-checker.kernel.mjs';
import { mulberry32, pick, findShapeViolations, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-126-ai-act-art50-marking-checker';
const AI_SOURCE_TYPES = [
  'trainedAlgorithmicMedia',
  'compositeWithTrainedAlgorithmicMedia',
  'algorithmicMedia',
  'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia',
  'http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia',
  'http://cv.iptc.org/newscodes/digitalsourcetype/algorithmicMedia',
];
const UNRECOGNIZED_TYPES = ['humanCreated', undefined];

function buildProfile(sourceType, markingPresent, isDeepfake, disclosurePresent) {
  return {
    actions: sourceType === undefined ? [] : [{ action: 'c2pa.created', digitalSourceType: sourceType }],
    machine_readable_marking_present: markingPresent,
    is_deepfake: isDeepfake,
    deepfake_disclosure_present: disclosurePresent,
  };
}

function randomProfile(rng) {
  const allTypes = [...AI_SOURCE_TYPES, ...UNRECOGNIZED_TYPES];
  return buildProfile(pick(rng, allTypes), rng() < 0.5, rng() < 0.5, rng() < 0.5);
}

// P1: source_type_recognized, ai_marking_present, deepfake_disclosure_ok are correct
// re-derivations, and art50_conformant = AND of ai_marking_present and disclosure_ok.
async function checkP1_checksDerivation() {
  let violations = 0, checked = 0;
  const rng = mulberry32(126001);
  for (let i = 0; i < 300; i++) {
    const pp = randomProfile(rng);
    const { output_payload: op } = await compute(pp);
    checked++;
    const expRecognized = AI_SOURCE_TYPES.includes(pp.actions[0]?.digitalSourceType);
    const expMarking = expRecognized && pp.machine_readable_marking_present === true;
    const expDisclosureOk = pp.is_deepfake === true ? pp.deepfake_disclosure_present === true : true;
    const expConformant = expMarking && expDisclosureOk;
    if (op.source_type_recognized !== expRecognized) violations++;
    if (op.ai_marking_present !== expMarking) violations++;
    if (op.deepfake_disclosure_ok !== expDisclosureOk) violations++;
    if (op.art50_conformant !== expConformant) violations++;
  }
  return { name: 'P1_checks_derivation_random300', checked, violations };
}

// P2: gaps array is exactly the declared gap set for the derived checks, no extras/omissions.
async function checkP2_gapsAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(126002);
  for (let i = 0; i < 300; i++) {
    const pp = randomProfile(rng);
    const { output_payload: op } = await compute(pp);
    checked++;
    const expected = [];
    if (!op.source_type_recognized) expected.push('NO_RECOGNIZED_AI_SOURCE_TYPE');
    if (pp.machine_readable_marking_present !== true) expected.push('MARKING_NOT_MACHINE_READABLE');
    if (pp.is_deepfake === true && pp.deepfake_disclosure_present !== true) expected.push('DEEPFAKE_DISCLOSURE_MISSING');
    if (JSON.stringify(op.gaps) !== JSON.stringify(expected)) violations++;
  }
  return { name: 'P2_gaps_agreement_random300', checked, violations };
}

// P3: forced categorical boundary cases -- every declared AI_SOURCE_TYPES enum value, one at a
// time, plus every unrecognized value, each crossed with the marking/deepfake/disclosure flags.
async function checkP3_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;
  const allTypes = [...AI_SOURCE_TYPES, ...UNRECOGNIZED_TYPES];
  for (const sourceType of allTypes) {
    for (const markingPresent of [true, false]) {
      for (const isDeepfake of [true, false]) {
        for (const disclosurePresent of [true, false]) {
          const pp = buildProfile(sourceType, markingPresent, isDeepfake, disclosurePresent);
          const { output_payload: op } = await compute(pp);
          checked++;
          if (typeof op.art50_conformant !== 'boolean') violations++;
          if (!Array.isArray(op.gaps)) violations++;
        }
      }
    }
  }
  return { name: 'P3_forced_categorical_boundary_cases_all_source_types', checked, violations };
}

// P4: output shape -- no NaN/undefined, correct field types, across missing-field inputs.
async function checkP4_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { actions: [] }, { machine_readable_marking_present: true }, { is_deepfake: true }];
  for (const pp of inputs) {
    const { output_payload: op } = await compute(pp);
    checked++;
    if (findShapeViolations(op).length > 0) violations++;
    if (typeof op.art50_conformant !== 'boolean') violations++;
    if (!Array.isArray(op.gaps)) violations++;
  }
  return { name: 'P4_output_shape_no_nan_undefined', checked, violations };
}

// ---------- run ----------
async function main() {
  // compute() is async for this kernel -- _pbt-common's runFixtureOracle is sync-only,
  // so the oracle gate is reimplemented inline here to await it correctly.
  const fixturesModule = await import('node:fs');
  const path = await import('node:path');
  const url = await import('node:url');
  const HERE = path.dirname(url.fileURLToPath(import.meta.url));
  const fixtures = JSON.parse(fixturesModule.readFileSync(path.join(HERE, '..', 'fixtures', `${KERNEL_ID}.fixtures.json`), 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = await compute(vec.policy_parameters);
    if (JSON.stringify(output_payload) !== JSON.stringify(vec.output_payload)) {
      failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
    }
  }
  const realOracleResult = { total: fixtures.vectors.length, failures };
  if (realOracleResult.failures.length > 0) {
    console.error('FIXTURE ORACLE FAILED --', JSON.stringify(realOracleResult.failures, null, 2));
    process.exit(1);
  }

  const controlPP = buildProfile('trainedAlgorithmicMedia', true, false, false);
  const { output_payload: controlOp } = await compute(controlPP);
  const mutated = { ...controlOp, art50_conformant: !controlOp.art50_conformant };
  const negativeControlOk = JSON.stringify(mutated) !== JSON.stringify(controlOp);
  if (!negativeControlOk) {
    console.error('NEGATIVE CONTROL FAILED -- comparator never observed rejecting a wrong output.');
    process.exit(1);
  }

  const properties = [
    await checkP1_checksDerivation(),
    await checkP2_gapsAgreement(),
    await checkP3_forcedCategoricalBoundaries(),
    await checkP4_outputShapeInvariant(),
  ];

  const ok = summarize(KERNEL_ID, realOracleResult, properties);
  process.exit(ok ? 0 : 1);
}

main();
