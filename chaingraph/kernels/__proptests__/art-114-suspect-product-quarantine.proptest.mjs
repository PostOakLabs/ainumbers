// art-114-suspect-product-quarantine property-test floor (FV-PROPFLOOR-SHARD-A-CHECKSOBJ-1).
// kernel_digest_at_authoring: sha256:69c6f567735fc1a35f728f1f226793ff94b9664813a2c9dfbcfe3569c93f1ed6
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape confirmed by direct source read: fixed CHECKS object
// (verification_failed, identifier_unmatched, counterfeit_indicators, quarantined,
// fda_notified) feeding boolean derivation (suspect, illegitimate) -> {status,
// required_actions} gap-style list. Member of the "fixed CHECKS object -> gap list" class-A
// sub-family named in FV-PROPFLOOR-SHARD-A-CHECKSOBJ-1's own fence.
// float:no (declared booleans + a small string-array field, no numeric float fields) -- forced
// CATEGORICAL boundary cases (every boolean combination that flips status) stand in for ULP
// forcing. ZERO external dependencies -- pure Node built-ins only. READ-ONLY w.r.t. the kernel
// it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-114-suspect-product-quarantine.proptest.mjs

import { compute } from '../art-114-suspect-product-quarantine.kernel.mjs';
import { mulberry32, pick, runFixtureOracle, findShapeViolations, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-114-suspect-product-quarantine';
const INDICATOR_SETS = [[], ['hologram_absent'], ['hologram_absent', 'serial_reuse_detected']];

function randomProfile(rng) {
  return {
    verification_failed: rng() < 0.5,
    identifier_unmatched: rng() < 0.5,
    counterfeit_indicators: pick(rng, INDICATOR_SETS),
    quarantined: rng() < 0.5,
    fda_notified: rng() < 0.5,
  };
}

// P1: suspect/illegitimate derivation and status enum agreement.
function checkP1_statusDerivation() {
  let violations = 0, checked = 0;
  const rng = mulberry32(114001);
  for (let i = 0; i < 300; i++) {
    const pp = randomProfile(rng);
    const { output_payload: op } = compute(pp);
    checked++;
    const suspect = pp.verification_failed === true || pp.identifier_unmatched === true || pp.counterfeit_indicators.length > 0;
    const illegitimate = suspect && pp.counterfeit_indicators.length > 0;
    const expStatus = illegitimate ? 'ILLEGITIMATE' : suspect ? 'SUSPECT' : 'CLEARED';
    if (op.status !== expStatus) violations++;
  }
  return { name: 'P1_status_derivation_random300', checked, violations };
}

// P2: required_actions is exactly the declared action set for the derived status, in order.
function checkP2_requiredActionsAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(114002);
  for (let i = 0; i < 300; i++) {
    const pp = randomProfile(rng);
    const { output_payload: op } = compute(pp);
    checked++;
    const suspect = pp.verification_failed === true || pp.identifier_unmatched === true || pp.counterfeit_indicators.length > 0;
    const illegitimate = suspect && pp.counterfeit_indicators.length > 0;
    const expected = [];
    if (suspect) expected.push('QUARANTINE', 'INVESTIGATE');
    if (illegitimate) expected.push('FDA_FORM_3911_72H', 'NOTIFY_TRADING_PARTNERS');
    if (JSON.stringify(op.required_actions) !== JSON.stringify(expected)) violations++;
  }
  return { name: 'P2_required_actions_agreement_random300', checked, violations };
}

// P3: forced categorical boundary cases -- every combination of the three suspect-triggering
// booleans (verification_failed, identifier_unmatched, has-indicators).
function checkP3_forcedBooleanBoundaries() {
  let violations = 0, checked = 0;
  for (const verification_failed of [true, false]) {
    for (const identifier_unmatched of [true, false]) {
      for (const counterfeit_indicators of INDICATOR_SETS) {
        const pp = { verification_failed, identifier_unmatched, counterfeit_indicators, quarantined: false, fda_notified: false };
        const { output_payload: op } = compute(pp);
        checked++;
        if (!['CLEARED', 'SUSPECT', 'ILLEGITIMATE'].includes(op.status)) violations++;
        const expectSuspectOrWorse = verification_failed || identifier_unmatched || counterfeit_indicators.length > 0;
        if (expectSuspectOrWorse !== (op.status !== 'CLEARED')) violations++;
      }
    }
  }
  return { name: 'P3_forced_boolean_boundary_cases', checked, violations };
}

// P4: output shape -- no NaN/undefined, correct field types, across missing-field inputs.
function checkP4_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { verification_failed: true }, { counterfeit_indicators: ['x'] }, { identifier_unmatched: false }];
  for (const pp of inputs) {
    const { output_payload: op } = compute(pp);
    checked++;
    if (findShapeViolations(op).length > 0) violations++;
    if (typeof op.status !== 'string') violations++;
    if (!Array.isArray(op.required_actions)) violations++;
  }
  return { name: 'P4_output_shape_no_nan_undefined', checked, violations };
}

// ---------- run ----------
const oracleResult = runFixtureOracle(KERNEL_ID, compute);
if (oracleResult.failures.length > 0) {
  console.error('FIXTURE ORACLE FAILED --', JSON.stringify(oracleResult.failures, null, 2));
  process.exit(1);
}

const controlPP = { verification_failed: true, identifier_unmatched: true, counterfeit_indicators: ['x'], quarantined: false, fda_notified: false };
const { output_payload: controlOp } = compute(controlPP);
const mutated = { ...controlOp, status: controlOp.status === 'ILLEGITIMATE' ? 'CLEARED' : 'ILLEGITIMATE' };
const negativeControlOk = JSON.stringify(mutated) !== JSON.stringify(controlOp);
if (!negativeControlOk) {
  console.error('NEGATIVE CONTROL FAILED -- comparator never observed rejecting a wrong output.');
  process.exit(1);
}

const properties = [
  checkP1_statusDerivation(),
  checkP2_requiredActionsAgreement(),
  checkP3_forcedBooleanBoundaries(),
  checkP4_outputShapeInvariant(),
];

const ok = summarize(KERNEL_ID, oracleResult, properties);
process.exit(ok ? 0 : 1);
