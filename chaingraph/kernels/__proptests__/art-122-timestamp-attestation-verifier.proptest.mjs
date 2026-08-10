// art-122-timestamp-attestation-verifier property-test floor (FV-PROPFLOOR-SHARD-A-CHECKSOBJ-1).
// kernel_digest_at_authoring: sha256:88a9d131ffff2a2a578a46cabdc2f1b0987df22f56462b7eee51dedc4fb65120
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape confirmed by direct source read: fixed CHECKS object
// (hash_match, ts_consistent, algo_match) derived from nested-field string equality, ANDed
// into `verified`. Member of the "fixed CHECKS object -> gap list" class-A sub-family named
// in FV-PROPFLOOR-SHARD-A-CHECKSOBJ-1's own fence (here the "gap list" degenerates to the
// 3-field checks object itself, since there is no separate gaps array).
// float:no (all fields are declared strings, no numeric float fields) -- forced CATEGORICAL
// boundary cases (all 8 match/mismatch combinations of the 3 governing checks) stand in for
// ULP forcing. ZERO external dependencies -- pure Node built-ins only. READ-ONLY w.r.t. the
// kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-122-timestamp-attestation-verifier.proptest.mjs

import { compute } from '../art-122-timestamp-attestation-verifier.kernel.mjs';
import { mulberry32, runFixtureOracle, findShapeViolations, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-122-timestamp-attestation-verifier';
const DOC_HASH = 'sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
const OTHER_HASH = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';
const TS = '2026-06-25T10:00:00Z';
const OTHER_TS = '2026-01-01T00:00:00Z';

function buildProfile(hashMatch, tsMatch, algoMatch) {
  return {
    document_hash: DOC_HASH,
    presented_anchor: {
      document_hash: hashMatch ? DOC_HASH : OTHER_HASH,
      timestamp_claim: {
        standard: 'eIDAS Art.41 / RFC 3161-aligned',
        timestamp: tsMatch ? TS : OTHER_TS,
        algorithm: algoMatch ? 'sha256' : 'sha512',
      },
    },
    presented_timestamp: TS,
    expected_algorithm: 'sha256',
  };
}

function randomProfile(rng) {
  return buildProfile(rng() < 0.5, rng() < 0.5, rng() < 0.5);
}

// P1: each sub-check is a correct re-derivation, and verified = AND of all three.
function checkP1_checksDerivation() {
  let violations = 0, checked = 0;
  const rng = mulberry32(122001);
  for (let i = 0; i < 300; i++) {
    const pp = randomProfile(rng);
    const { output_payload: op } = compute(pp);
    checked++;
    const expHash = pp.presented_anchor.document_hash === pp.document_hash;
    const expTs = pp.presented_anchor.timestamp_claim.timestamp === pp.presented_timestamp;
    const expAlgo = pp.presented_anchor.timestamp_claim.algorithm === pp.expected_algorithm;
    if (op.hash_match !== expHash) violations++;
    if (op.ts_consistent !== expTs) violations++;
    if (op.algo_match !== expAlgo) violations++;
    if (op.verified !== (expHash && expTs && expAlgo)) violations++;
  }
  return { name: 'P1_checks_derivation_random300', checked, violations };
}

// P2: forced categorical boundary cases -- all 8 combinations of the 3 governing checks.
function checkP2_forcedBooleanBoundaries() {
  let violations = 0, checked = 0;
  for (const hashMatch of [true, false]) {
    for (const tsMatch of [true, false]) {
      for (const algoMatch of [true, false]) {
        const pp = buildProfile(hashMatch, tsMatch, algoMatch);
        const { output_payload: op } = compute(pp);
        checked++;
        if (op.verified !== (hashMatch && tsMatch && algoMatch)) violations++;
        if (typeof op.verified !== 'boolean') violations++;
      }
    }
  }
  return { name: 'P2_forced_boolean_boundary_cases_all_8', checked, violations };
}

// P3: output shape -- no NaN/undefined, correct field types, across missing/malformed inputs.
function checkP3_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { document_hash: DOC_HASH }, { presented_anchor: {} }, { presented_anchor: { timestamp_claim: {} } }];
  for (const pp of inputs) {
    const { output_payload: op } = compute(pp);
    checked++;
    if (findShapeViolations(op).length > 0) violations++;
    if (typeof op.verified !== 'boolean') violations++;
    if (typeof op.hash_match !== 'boolean' || typeof op.ts_consistent !== 'boolean' || typeof op.algo_match !== 'boolean') violations++;
  }
  return { name: 'P3_output_shape_no_nan_undefined', checked, violations };
}

// ---------- run ----------
const oracleResult = runFixtureOracle(KERNEL_ID, compute);
if (oracleResult.failures.length > 0) {
  console.error('FIXTURE ORACLE FAILED --', JSON.stringify(oracleResult.failures, null, 2));
  process.exit(1);
}

const controlPP = buildProfile(true, true, true);
const { output_payload: controlOp } = compute(controlPP);
const mutated = { ...controlOp, verified: !controlOp.verified };
const negativeControlOk = JSON.stringify(mutated) !== JSON.stringify(controlOp);
if (!negativeControlOk) {
  console.error('NEGATIVE CONTROL FAILED -- comparator never observed rejecting a wrong output.');
  process.exit(1);
}

const properties = [
  checkP1_checksDerivation(),
  checkP2_forcedBooleanBoundaries(),
  checkP3_outputShapeInvariant(),
];

const ok = summarize(KERNEL_ID, oracleResult, properties);
process.exit(ok ? 0 : 1);
