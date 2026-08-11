// art-140-cra-vuln-reporting-readiness property-test floor (FV-PROPFLOOR-SHARD-A-CHECKSOBJ-1).
// kernel_digest_at_authoring: sha256:1f1af6d462795616cf87a1f261b777582c1188b28d24a8324ac7f3f180011b58
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape confirmed by direct source read: same archetype as
// art-134 -- a literal `checks = {5 booleans}` object, `gaps = Object.entries(checks).filter
// (not true).map(key)`, `vuln_reporting_ready = gaps.length === 0`. The "fixed CHECKS object
// -> gap list" class-A sub-family named in FV-PROPFLOOR-SHARD-A-CHECKSOBJ-1's own fence.
// float:no (5 declared booleans, no numeric float fields) -- forced CATEGORICAL boundary
// cases (all 32 combinations of the 5 governing booleans) stand in for ULP forcing. ZERO
// external dependencies -- pure Node built-ins only. READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-140-cra-vuln-reporting-readiness.proptest.mjs

import { compute } from '../art-140-cra-vuln-reporting-readiness.kernel.mjs';
import { mulberry32, runFixtureOracle, findShapeViolations, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-140-cra-vuln-reporting-readiness';
const CHECK_KEYS = ['actively_exploited_detection', 'early_warning_24h_process', 'notification_72h_process', 'csirt_enisa_endpoint_configured', 'coordinated_disclosure_policy'];

function buildProfile(flags) {
  const pp = {};
  CHECK_KEYS.forEach((k, i) => { pp[k] = flags[i]; });
  return pp;
}

function randomProfile(rng) {
  return buildProfile(CHECK_KEYS.map(() => rng() < 0.5));
}

// P1: gaps is exactly the set of keys whose value !== true, vuln_reporting_ready =
// gaps.length === 0.
function checkP1_gapsAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(140001);
  for (let i = 0; i < 300; i++) {
    const pp = randomProfile(rng);
    const { output_payload: op } = compute(pp);
    checked++;
    const expGaps = CHECK_KEYS.filter((k) => pp[k] !== true);
    if (JSON.stringify(op.gaps) !== JSON.stringify(expGaps)) violations++;
    if (op.vuln_reporting_ready !== (expGaps.length === 0)) violations++;
  }
  return { name: 'P1_gaps_agreement_random300', checked, violations };
}

// P2: forced categorical boundary cases -- all 32 combinations of the 5 governing booleans.
function checkP2_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;
  for (let mask = 0; mask < 32; mask++) {
    const flags = CHECK_KEYS.map((_, i) => Boolean(mask & (1 << i)));
    const pp = buildProfile(flags);
    const { output_payload: op } = compute(pp);
    checked++;
    const expGaps = CHECK_KEYS.filter((_, i) => !flags[i]);
    if (JSON.stringify(op.gaps) !== JSON.stringify(expGaps)) violations++;
    if (op.vuln_reporting_ready !== (mask === 31)) violations++;
  }
  return { name: 'P2_forced_categorical_boundary_cases_all_32', checked, violations };
}

// P3: output shape -- no NaN/undefined, correct field types, across missing-field inputs.
function checkP3_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { actively_exploited_detection: true }, buildProfile([true, true, true, true, false]), buildProfile([false, false, false, false, false])];
  for (const pp of inputs) {
    const { output_payload: op } = compute(pp);
    checked++;
    if (findShapeViolations(op).length > 0) violations++;
    if (typeof op.vuln_reporting_ready !== 'boolean') violations++;
    if (!Array.isArray(op.gaps)) violations++;
  }
  return { name: 'P3_output_shape_no_nan_undefined', checked, violations };
}

// ---------- run ----------
const oracleResult = runFixtureOracle(KERNEL_ID, compute);
if (oracleResult.failures.length > 0) {
  console.error('FIXTURE ORACLE FAILED --', JSON.stringify(oracleResult.failures, null, 2));
  process.exit(1);
}

const controlPP = buildProfile([true, true, true, true, true]);
const { output_payload: controlOp } = compute(controlPP);
const mutated = { ...controlOp, vuln_reporting_ready: !controlOp.vuln_reporting_ready };
const negativeControlOk = JSON.stringify(mutated) !== JSON.stringify(controlOp);
if (!negativeControlOk) {
  console.error('NEGATIVE CONTROL FAILED -- comparator never observed rejecting a wrong output.');
  process.exit(1);
}

const properties = [
  checkP1_gapsAgreement(),
  checkP2_forcedCategoricalBoundaries(),
  checkP3_outputShapeInvariant(),
];

const ok = summarize(KERNEL_ID, oracleResult, properties);
process.exit(ok ? 0 : 1);
