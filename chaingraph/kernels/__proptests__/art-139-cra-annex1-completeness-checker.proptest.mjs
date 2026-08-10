// art-139-cra-annex1-completeness-checker property-test floor (FV-PROPFLOOR-SHARD-A-CHECKSOBJ-1).
// kernel_digest_at_authoring: sha256:8d0924a6bc66cc3c3c6e9211692dd759285b3c07143163946ef596a4b48c6235
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape confirmed by direct source read: a fixed CHECKS object
// (5 booleans) -> `gaps` array, PLUS a `conformity_route` declared 3-value enum contributing
// its own gap entry -- the "fixed CHECKS object -> gap list" class-A sub-family named in
// FV-PROPFLOOR-SHARD-A-CHECKSOBJ-1's own fence, extended with one enum-membership check.
// float:no (5 declared booleans + a string enum, no numeric float fields) -- forced
// CATEGORICAL boundary cases (all 32 boolean combinations x every declared ROUTES value)
// stand in for ULP forcing. ZERO external dependencies -- pure Node built-ins only. READ-ONLY
// w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-139-cra-annex1-completeness-checker.proptest.mjs

import { compute } from '../art-139-cra-annex1-completeness-checker.kernel.mjs';
import { mulberry32, pick, runFixtureOracle, findShapeViolations, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-139-cra-annex1-completeness-checker';
const CHECK_KEYS = ['sbom_present', 'sbom_machine_readable', 'top_level_deps_covered', 'vuln_handling_policy_present', 'secure_by_default'];
const ROUTES = ['self_assessment', 'eu_type_examination', 'full_quality_assurance'];
const INVALID_ROUTES = ['bespoke_route', undefined];

function buildProfile(flags, route) {
  const pp = {};
  CHECK_KEYS.forEach((k, i) => { pp[k] = flags[i]; });
  pp.conformity_route = route;
  return pp;
}

function randomProfile(rng) {
  const allRoutes = [...ROUTES, ...INVALID_ROUTES];
  return buildProfile(CHECK_KEYS.map(() => rng() < 0.5), pick(rng, allRoutes));
}

// P1: gaps is exactly the boolean-check gaps plus 'conformity_route' when the enum is
// unrecognized; annex1_complete = gaps.length === 0; conformity_route echoes back only when
// route_ok, else null.
function checkP1_gapsAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(139001);
  for (let i = 0; i < 300; i++) {
    const pp = randomProfile(rng);
    const { output_payload: op } = compute(pp);
    checked++;
    const routeOk = ROUTES.includes(pp.conformity_route);
    const expGaps = CHECK_KEYS.filter((k) => pp[k] !== true);
    if (!routeOk) expGaps.push('conformity_route');
    if (JSON.stringify(op.gaps) !== JSON.stringify(expGaps)) violations++;
    if (op.annex1_complete !== (expGaps.length === 0)) violations++;
    if (op.conformity_route !== (routeOk ? pp.conformity_route : null)) violations++;
  }
  return { name: 'P1_gaps_agreement_random300', checked, violations };
}

// P2: forced categorical boundary cases -- all 32 boolean combinations x every declared
// ROUTES value (valid and invalid).
function checkP2_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;
  const allRoutes = [...ROUTES, ...INVALID_ROUTES];
  for (let mask = 0; mask < 32; mask++) {
    const flags = CHECK_KEYS.map((_, i) => Boolean(mask & (1 << i)));
    for (const route of allRoutes) {
      const pp = buildProfile(flags, route);
      const { output_payload: op } = compute(pp);
      checked++;
      const routeOk = ROUTES.includes(route);
      const expComplete = mask === 31 && routeOk;
      if (op.annex1_complete !== expComplete) violations++;
    }
  }
  return { name: 'P2_forced_categorical_boundary_cases_32x5', checked, violations };
}

// P3: output shape -- no NaN/undefined, correct field types, across missing-field inputs.
function checkP3_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { sbom_present: true }, buildProfile([true, true, true, true, true], 'self_assessment'), buildProfile([false, false, false, false, false], undefined)];
  for (const pp of inputs) {
    const { output_payload: op } = compute(pp);
    checked++;
    if (findShapeViolations(op).length > 0) violations++;
    if (typeof op.annex1_complete !== 'boolean') violations++;
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

const controlPP = buildProfile([true, true, true, true, true], 'self_assessment');
const { output_payload: controlOp } = compute(controlPP);
const mutated = { ...controlOp, annex1_complete: !controlOp.annex1_complete };
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
