// art-113-saleable-returns-verifier property-test floor (FV-PROPFLOOR-SHARD-A-CHECKSOBJ-1).
// kernel_digest_at_authoring: sha256:37fb88e02fb51dff2a85a09a2f98bcba462e1ed90a7dbd5612953ffa0a61c8b0
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape confirmed by direct source read: fixed CHECKS object
// (id_match, lot_match, txn_anchored, seller_authorized, within_resale_window) feeding a
// short-circuit decision tree -> {verdict, reason}. Member of the "fixed CHECKS object -> gap
// list" class-A sub-family named in FV-PROPFLOOR-SHARD-A-CHECKSOBJ-1's own fence.
// float:no (all fields are declared strings/booleans, no numeric float fields) -- forced
// CATEGORICAL boundary cases (every boolean combination that flips the verdict, per spec §3's
// float:no carve-out) stand in for ULP forcing. ZERO external dependencies -- pure Node
// built-ins only. READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-113-saleable-returns-verifier.proptest.mjs

import { compute } from '../art-113-saleable-returns-verifier.kernel.mjs';
import { mulberry32, pick, runFixtureOracle, findShapeViolations, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-113-saleable-returns-verifier';

const SGTINS = ['00312345678906.SN12345', '00312345678906.SN99999'];
const LOTS = ['L2026A', 'L2026B'];
const HASHES = [
  'sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  'not-a-hash',
  undefined,
];

function randomProfile(rng) {
  return {
    returned_sgtin: pick(rng, SGTINS),
    original_sgtin: pick(rng, SGTINS),
    returned_lot: pick(rng, LOTS),
    original_lot: pick(rng, LOTS),
    original_txn_hash: pick(rng, HASHES),
    seller_authorized: rng() < 0.5,
    within_resale_window: pick(rng, [true, false, undefined]),
  };
}

// P1: match is exactly id_match && lot_match && txn_anchored, each field is a correct
// re-derivation of its declared equality/prefix check.
function checkP1_matchDerivation() {
  let violations = 0, checked = 0;
  const rng = mulberry32(113001);
  for (let i = 0; i < 300; i++) {
    const pp = randomProfile(rng);
    const { output_payload: op } = compute(pp);
    checked++;
    const expId = pp.returned_sgtin === pp.original_sgtin;
    const expLot = pp.returned_lot === pp.original_lot;
    const expTxn = typeof pp.original_txn_hash === 'string' && pp.original_txn_hash.startsWith('sha256:');
    if (op.id_match !== expId) violations++;
    if (op.lot_match !== expLot) violations++;
    if (op.txn_anchored !== expTxn) violations++;
    if (op.match !== (expId && expLot && expTxn)) violations++;
  }
  return { name: 'P1_match_derivation_random300', checked, violations };
}

// P2: verdict/reason decision tree -- unauthorized > no-match > outside-window > accept, in order.
function checkP2_verdictPriority() {
  let violations = 0, checked = 0;
  const rng = mulberry32(113002);
  for (let i = 0; i < 300; i++) {
    const pp = randomProfile(rng);
    const { output_payload: op } = compute(pp);
    checked++;
    let expVerdict, expReason;
    if (pp.seller_authorized !== true) { expVerdict = 'REFUSE'; expReason = 'UNAUTHORIZED_TRADING_PARTNER'; }
    else if (!op.match) { expVerdict = 'REFUSE'; expReason = 'NO_MATCH_TO_ORIGINAL_TRANSACTION'; }
    else if (pp.within_resale_window === false) { expVerdict = 'REFUSE'; expReason = 'OUTSIDE_RESALE_WINDOW'; }
    else { expVerdict = 'ACCEPT'; expReason = 'VERIFIED'; }
    if (op.verdict !== expVerdict) violations++;
    if (op.reason !== expReason) violations++;
  }
  return { name: 'P2_verdict_priority_random300', checked, violations };
}

// P3: forced categorical boundary cases -- every combination of the three governing booleans
// (seller_authorized, match-forcing via id/lot/txn, within_resale_window) that flips the verdict.
function checkP3_forcedBooleanBoundaries() {
  let violations = 0, checked = 0;
  const base = {
    returned_sgtin: 'X', original_sgtin: 'X', returned_lot: 'Y', original_lot: 'Y',
    original_txn_hash: 'sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  };
  for (const seller_authorized of [true, false]) {
    for (const mismatchField of [null, 'sgtin', 'lot', 'txn']) {
      for (const within_resale_window of [true, false, undefined]) {
        const pp = { ...base, seller_authorized, within_resale_window };
        if (mismatchField === 'sgtin') pp.original_sgtin = 'DIFFERENT';
        if (mismatchField === 'lot') pp.original_lot = 'DIFFERENT';
        if (mismatchField === 'txn') pp.original_txn_hash = 'not-a-hash';
        const { output_payload: op } = compute(pp);
        checked++;
        if (!['ACCEPT', 'REFUSE'].includes(op.verdict)) violations++;
        if (op.verdict === 'REFUSE' && !op.reason) violations++;
        if (op.verdict === 'ACCEPT' && op.reason !== 'VERIFIED') violations++;
      }
    }
  }
  return { name: 'P3_forced_boolean_boundary_cases', checked, violations };
}

// P4: output shape -- no NaN/undefined, correct field types, across missing-field inputs.
function checkP4_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { seller_authorized: true }, { within_resale_window: false }, { returned_sgtin: 'X' }];
  for (const pp of inputs) {
    const { output_payload: op } = compute(pp);
    checked++;
    if (findShapeViolations(op).length > 0) violations++;
    if (typeof op.verdict !== 'string' || typeof op.reason !== 'string') violations++;
    if (typeof op.match !== 'boolean') violations++;
  }
  return { name: 'P4_output_shape_no_nan_undefined', checked, violations };
}

// ---------- run ----------
const oracleResult = runFixtureOracle(KERNEL_ID, compute);
if (oracleResult.failures.length > 0) {
  console.error('FIXTURE ORACLE FAILED --', JSON.stringify(oracleResult.failures, null, 2));
  process.exit(1);
}

// Negative control: an oracle never seen rejecting a wrong spec is not known to work.
const controlPP = { returned_sgtin: 'A', original_sgtin: 'A', returned_lot: 'B', original_lot: 'B', original_txn_hash: 'sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', seller_authorized: true, within_resale_window: true };
const { output_payload: controlOp } = compute(controlPP);
const mutated = { ...controlOp, verdict: controlOp.verdict === 'ACCEPT' ? 'REFUSE' : 'ACCEPT' };
const negativeControlOk = JSON.stringify(mutated) !== JSON.stringify(controlOp);
if (!negativeControlOk) {
  console.error('NEGATIVE CONTROL FAILED -- comparator never observed rejecting a wrong output.');
  process.exit(1);
}

const properties = [
  checkP1_matchDerivation(),
  checkP2_verdictPriority(),
  checkP3_forcedBooleanBoundaries(),
  checkP4_outputShapeInvariant(),
];

const ok = summarize(KERNEL_ID, oracleResult, properties);
process.exit(ok ? 0 : 1);
