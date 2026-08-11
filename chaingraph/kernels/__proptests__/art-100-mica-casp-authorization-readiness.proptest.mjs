// art-100-mica-casp-authorization-readiness property-test floor (FV-PROPFLOOR-SHARD-A-REMAINDER-1).
// kernel_digest_at_authoring: sha256:83af4fb729adb2375b158401895030ed23a4469569312c67aa80c1240640c70e
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape confirmed by direct kernel source read: 7 independent
// dimension inputs, each mapped through the SAME DIM_SCORE lookup table, averaged into a
// composite score and graded, ~6^7 * 2^10-ish enum+service-set composite per the row's estimate.
// float:no (every input is a declared string enum; `services` array is accepted but unused in
// scoring) -- forced CATEGORICAL boundary cases (every declared DIM_SCORE key, per spec §3's
// float:no carve-out) stand in for ULP forcing. ZERO external dependencies -- pure Node
// built-ins only. READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-100-mica-casp-authorization-readiness.proptest.mjs

import { compute } from '../art-100-mica-casp-authorization-readiness.kernel.mjs';
import { mulberry32, pick, runFixtureOracle, findShapeViolations, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-100-mica-casp-authorization-readiness';

// Declared DIM_SCORE domain (mirrors the kernel's own lookup table -- a stated constant, not
// business logic, so copying it here is a spec-fidelity check, not a reimplementation risk).
const DIM_SCORE = { 'in-place': 100, 'dora-aligned': 100, 'defined': 100, 'full': 100, 'partial': 50, 'none': 0 };
const ENUM_VALUES = Object.keys(DIM_SCORE);
const DIMS = ['governance_board', 'fit_and_proper', 'internal_controls', 'custody_segregation', 'complaints_handling', 'conflicts_policy', 'ict_resilience'];
const GRADES = ['A', 'B', 'C', 'D', 'F'];

function randomPP(rng) {
  const pp = {};
  for (const d of DIMS) pp[d] = pick(rng, ENUM_VALUES);
  return pp;
}

// P1: dimension_scores mirror DIM_SCORE exactly and stay in [0,100]; composite_pct is the
// rounded mean of the 7 dimension scores.
function checkP1_compositeAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(100001);
  for (let i = 0; i < 300; i++) {
    const pp = randomPP(rng);
    const { output_payload } = compute(pp);
    checked++;
    let sum = 0;
    for (const d of DIMS) {
      const expected = DIM_SCORE[pp[d]] ?? 0;
      if (output_payload.dimension_scores[d] !== expected) violations++;
      if (expected < 0 || expected > 100) violations++;
      sum += expected;
    }
    const expectedComposite = Math.round(sum / 7);
    if (output_payload.composite_pct !== expectedComposite) violations++;
  }
  return { name: 'P1_composite_agreement_random300', checked, violations };
}

// P2: authorization_grade band agreement (>=88 A, >=72 B, >=56 C, >=40 D, else F).
function checkP2_gradeBandAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(100002);
  for (let i = 0; i < 300; i++) {
    const { output_payload } = compute(randomPP(rng));
    checked++;
    const pct = output_payload.composite_pct;
    const expected = pct >= 88 ? 'A' : pct >= 72 ? 'B' : pct >= 56 ? 'C' : pct >= 40 ? 'D' : 'F';
    if (output_payload.authorization_grade !== expected) violations++;
    if (!GRADES.includes(output_payload.authorization_grade)) violations++;
  }
  return { name: 'P2_grade_band_agreement_random300', checked, violations };
}

// P3: gaps is exactly the set of dimensions scoring <75, and compliance_flags GOVERNANCE_GAP /
// CUSTODY_SEGREGATION_INCOMPLETE agree with their declared triggers.
function checkP3_gapsAndFlagsAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(100003);
  for (let i = 0; i < 300; i++) {
    const pp = randomPP(rng);
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    const expectedGapAreas = DIMS.filter((d) => (DIM_SCORE[pp[d]] ?? 0) < 75).sort();
    const gotGapAreas = output_payload.gaps.map((g) => g.area).sort();
    if (JSON.stringify(expectedGapAreas) !== JSON.stringify(gotGapAreas)) violations++;
    const expectGovGap = pp.governance_board !== 'in-place' || pp.fit_and_proper !== 'in-place';
    if (compliance_flags.includes('GOVERNANCE_GAP') !== expectGovGap) violations++;
    const expectCustodyGap = pp.custody_segregation !== 'full';
    if (compliance_flags.includes('CUSTODY_SEGREGATION_INCOMPLETE') !== expectCustodyGap) violations++;
  }
  return { name: 'P3_gaps_and_flags_agreement_random300', checked, violations };
}

// P4: forced categorical boundary cases -- every declared DIM_SCORE value for every dimension.
function checkP4_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;
  const base = {};
  for (const d of DIMS) base[d] = 'in-place';
  for (const d of DIMS) {
    for (const v of ENUM_VALUES) {
      const pp = { ...base, [d]: v };
      const { output_payload } = compute(pp);
      checked++;
      if (!GRADES.includes(output_payload.authorization_grade)) violations++;
      if (findShapeViolations(output_payload.dimension_scores).length) violations++;
    }
  }
  return { name: 'P4_forced_categorical_boundary_cases_all_dim_score_values', checked, violations };
}

// P5: output shape / no NaN / undefined -- omitted-field defaults ('none' per destructure) still
// produce a well-shaped, fully-graded payload.
function checkP5_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { governance_board: 'in-place' }, { services: ['custody', 'exchange'] }, { custody_segregation: 'full', ict_resilience: 'dora-aligned' }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (findShapeViolations(output_payload).length) violations++;
    if (!GRADES.includes(output_payload.authorization_grade)) violations++;
    if (!Array.isArray(output_payload.gaps)) violations++;
    if (!Array.isArray(output_payload.application_pack_checklist) || output_payload.application_pack_checklist.length !== 7) violations++;
  }
  return { name: 'P5_output_shape_no_nan_undefined', checked, violations };
}

// ---------- run ----------
const oracle = runFixtureOracle(KERNEL_ID, compute);
const properties = [
  checkP1_compositeAgreement(),
  checkP2_gradeBandAgreement(),
  checkP3_gapsAndFlagsAgreement(),
  checkP4_forcedCategoricalBoundaries(),
  checkP5_outputShapeInvariant(),
];
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
