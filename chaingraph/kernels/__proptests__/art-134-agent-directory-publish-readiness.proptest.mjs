// art-134-agent-directory-publish-readiness property-test floor (FV-PROPFLOOR-SHARD-A-CHECKSOBJ-1).
// kernel_digest_at_authoring: sha256:46abd179f6af07c11f97b205b1762ce25fc640e75366b96c65663b338f3b9f7b
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape confirmed by direct source read: this IS the archetype
// of the "fixed CHECKS object -> gap list" class-A sub-family named in
// FV-PROPFLOOR-SHARD-A-CHECKSOBJ-1's own fence -- a literal `checks = {5 booleans}` object,
// `gaps = Object.entries(checks).filter(not true).map(key)`, `ready = gaps.length === 0`.
// float:no (5 declared booleans, no numeric float fields) -- forced CATEGORICAL boundary
// cases (all 32 combinations of the 5 governing booleans) stand in for ULP forcing. ZERO
// external dependencies -- pure Node built-ins only. READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-134-agent-directory-publish-readiness.proptest.mjs

import { compute } from '../art-134-agent-directory-publish-readiness.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mulberry32, findShapeViolations, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-134-agent-directory-publish-readiness';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHECK_KEYS = ['well_known_path_ok', 'jwks_reachable', 'card_complete', 'rotation_posture_ok', 'alg_ed25519'];

function buildProfile(flags) {
  const pp = {};
  CHECK_KEYS.forEach((k, i) => { pp[k] = flags[i]; });
  return pp;
}

function randomProfile(rng) {
  return buildProfile(CHECK_KEYS.map(() => rng() < 0.5));
}

// P1: gaps is exactly the set of keys whose value !== true, ready = gaps.length === 0.
async function checkP1_gapsAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(134001);
  for (let i = 0; i < 300; i++) {
    const pp = randomProfile(rng);
    const { output_payload: op } = await compute(pp);
    checked++;
    const expGaps = CHECK_KEYS.filter((k) => pp[k] !== true);
    if (JSON.stringify(op.gaps) !== JSON.stringify(expGaps)) violations++;
    if (op.ready !== (expGaps.length === 0)) violations++;
  }
  return { name: 'P1_gaps_agreement_random300', checked, violations };
}

// P2: forced categorical boundary cases -- all 32 combinations of the 5 governing booleans.
async function checkP2_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;
  for (let mask = 0; mask < 32; mask++) {
    const flags = CHECK_KEYS.map((_, i) => Boolean(mask & (1 << i)));
    const pp = buildProfile(flags);
    const { output_payload: op } = await compute(pp);
    checked++;
    const expGaps = CHECK_KEYS.filter((_, i) => !flags[i]);
    if (JSON.stringify(op.gaps) !== JSON.stringify(expGaps)) violations++;
    if (op.ready !== (mask === 31)) violations++;
  }
  return { name: 'P2_forced_categorical_boundary_cases_all_32', checked, violations };
}

// P3: output shape -- no NaN/undefined, correct field types, across missing-field inputs.
async function checkP3_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { well_known_path_ok: true }, buildProfile([true, true, true, true, false]), buildProfile([false, false, false, false, false])];
  for (const pp of inputs) {
    const { output_payload: op } = await compute(pp);
    checked++;
    if (findShapeViolations(op).length > 0) violations++;
    if (typeof op.ready !== 'boolean') violations++;
    if (!Array.isArray(op.gaps)) violations++;
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

  const controlPP = buildProfile([true, true, true, true, true]);
  const { output_payload: controlOp } = await compute(controlPP);
  const mutated = { ...controlOp, ready: !controlOp.ready };
  const negativeControlOk = JSON.stringify(mutated) !== JSON.stringify(controlOp);
  if (!negativeControlOk) {
    console.error('NEGATIVE CONTROL FAILED -- comparator never observed rejecting a wrong output.');
    process.exit(1);
  }

  const properties = [
    await checkP1_gapsAgreement(),
    await checkP2_forcedCategoricalBoundaries(),
    await checkP3_outputShapeInvariant(),
  ];

  const ok = summarize(KERNEL_ID, oracleResult, properties);
  process.exit(ok ? 0 : 1);
}

main();
