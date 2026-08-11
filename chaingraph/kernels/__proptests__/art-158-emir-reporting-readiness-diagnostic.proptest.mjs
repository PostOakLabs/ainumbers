// art-158-emir-reporting-readiness-diagnostic property-test floor (FV-PROPFLOOR-SHARD-A-REMAINDER-1).
// kernel_digest_at_authoring: sha256:ba0317cc05e0610e68e6437fcb9a46d69ab6269f880d37d61987314c1142faed
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape confirmed by direct kernel source read: 5 independent
// boolean dimensions gapped by strict `!== true` comparison, 2^5=32 fixed-dim gap check per the
// row's own estimate. float:no (every input is boolean, or treated as gap-if-not-strictly-true)
// -- the declared domain is itself only 32 cells, so the "forced categorical boundary" property
// below enumerates the FULL declared boolean grid, which is boundary forcing for a 5-boolean
// kernel, not a totality claim over an unbounded domain. ZERO external dependencies -- pure Node
// built-ins only. READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-158-emir-reporting-readiness-diagnostic.proptest.mjs

import { compute } from '../art-158-emir-reporting-readiness-diagnostic.kernel.mjs';
import { runFixtureOracle, findShapeViolations, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-158-emir-reporting-readiness-diagnostic';

const DIMS = ['iso20022_cutover_done', 'upi_sourcing_configured', 'uti_sharing_sla_met', 'reconciliation_tolerance_set', 'lifecycle_action_controls'];
const GRADES = ['F', 'E', 'D', 'C', 'B', 'A'];

// P1: forced categorical boundary cases -- the full declared 2^5=32-cell boolean grid. gaps,
// dimensions_passed, grade, and ready must all agree with the kernel's declared rule.
function checkP1_forcedGridAgreement() {
  let violations = 0, checked = 0;
  for (let mask = 0; mask < 32; mask++) {
    const pp = {};
    DIMS.forEach((d, i) => { pp[d] = Boolean(mask & (1 << i)); });
    const { output_payload } = compute(pp);
    checked++;
    const expectedGaps = DIMS.filter((d) => pp[d] !== true);
    if (JSON.stringify([...output_payload.gaps].sort()) !== JSON.stringify([...expectedGaps].sort())) violations++;
    const passed = 5 - expectedGaps.length;
    if (output_payload.dimensions_passed !== passed) violations++;
    if (output_payload.grade !== GRADES[passed]) violations++;
    if (output_payload.ready !== (expectedGaps.length === 0)) violations++;
  }
  return { name: 'P1_forced_categorical_grid_agreement_32cells', checked, violations };
}

// P2: strict-boolean read -- any non-`true` value (false, string, number, null, undefined)
// counts as a gap for that dimension, never treated as passing.
function checkP2_strictBooleanNeverCountsNonTrue() {
  let violations = 0, checked = 0;
  const nonTrueValues = [false, 'true', 1, null, undefined, 0];
  for (const v of nonTrueValues) {
    for (const d of DIMS) {
      const pp = {};
      DIMS.forEach((k) => { pp[k] = true; });
      pp[d] = v;
      const { output_payload } = compute(pp);
      checked++;
      if (!output_payload.gaps.includes(d)) violations++;
      if (output_payload.ready !== false) violations++;
    }
  }
  return { name: 'P2_strict_boolean_read_non_true_never_counts', checked, violations };
}

// P3: compliance_flags baseline shape -- always-present tag, exactly-one ready/gaps tag.
function checkP3_complianceFlagsShape() {
  let violations = 0, checked = 0;
  for (let mask = 0; mask < 32; mask++) {
    const pp = {};
    DIMS.forEach((d, i) => { pp[d] = Boolean(mask & (1 << i)); });
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    if (!compliance_flags.includes('EMIR_REPORTING_FIT_ASSESSED')) violations++;
    const readyTag = compliance_flags.includes('EMIR_REPORTING_READY');
    const gapsTag = compliance_flags.includes('EMIR_REPORTING_GAPS');
    if (readyTag === gapsTag) violations++;
    if (readyTag !== output_payload.ready) violations++;
  }
  return { name: 'P3_compliance_flags_shape_32cells', checked, violations };
}

// P4: output shape / no NaN / undefined across missing-field and empty-object inputs.
function checkP4_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { iso20022_cutover_done: true }, { upi_sourcing_configured: true, uti_sharing_sla_met: true }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (typeof output_payload.ready !== 'boolean') violations++;
    if (!GRADES.includes(output_payload.grade)) violations++;
    if (typeof output_payload.dimensions_passed !== 'number') violations++;
    if (!Array.isArray(output_payload.gaps)) violations++;
    if (findShapeViolations({ ready: output_payload.ready, grade: output_payload.grade, dimensions_passed: output_payload.dimensions_passed, gaps: output_payload.gaps }).length) violations++;
  }
  return { name: 'P4_output_shape_no_nan_undefined', checked, violations };
}

// ---------- run ----------
const oracle = runFixtureOracle(KERNEL_ID, compute);
const properties = [
  checkP1_forcedGridAgreement(),
  checkP2_strictBooleanNeverCountsNonTrue(),
  checkP3_complianceFlagsShape(),
  checkP4_outputShapeInvariant(),
];
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
