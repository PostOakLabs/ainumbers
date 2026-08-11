// art-157-emir-lifecycle-event-validator property-test floor (FV-PROPFLOOR-SHARD-A-REMAINDER-1).
// kernel_digest_at_authoring: sha256:9d3b6b68b0c7bf0cd0b08b8e320a2f27a849be1e49c1044ee5a8fd4c432c9191
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape confirmed by direct kernel source read: two enums
// (action_type against a fixed LEGAL lookup table keyed by prior_state) -- ~24 combos per the
// row's own estimate (3 declared prior_state values x 8 declared action_type values). float:no
// (both inputs are declared string enums) -- since the declared table is itself only ~24 cells,
// the "forced categorical boundary" property below enumerates the full declared grid, which is
// boundary forcing for a 2-enum kernel, not a totality claim over an unbounded domain (an
// unrecognized prior_state/action_type pair outside this table is covered separately by P3).
// ZERO external dependencies -- pure Node built-ins only. READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-157-emir-lifecycle-event-validator.proptest.mjs

import { compute } from '../art-157-emir-lifecycle-event-validator.kernel.mjs';
import { runFixtureOracle, findShapeViolations, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-157-emir-lifecycle-event-validator';

// Declared LEGAL table -- copied verbatim from the kernel source as a stated constant (not
// re-derived business logic), used to check the kernel's own output against its own table.
const LEGAL = {
  none: ['New', 'Position'],
  open: ['Modify', 'Correct', 'Valuation', 'Terminate', 'Error'],
  terminated: ['Revive', 'Correct', 'Error'],
};
const PRIOR_STATES = Object.keys(LEGAL); // ['none', 'open', 'terminated']
const ACTION_TYPES = ['New', 'Position', 'Modify', 'Correct', 'Valuation', 'Terminate', 'Error', 'Revive'];

// P1: forced categorical boundary cases -- the full declared prior_state x action_type grid
// (3 x 8 = 24 cells). action_legal / allowed must agree with the declared LEGAL table exactly.
function checkP1_forcedGridAgreement() {
  let violations = 0, checked = 0;
  for (const prior_state of PRIOR_STATES) {
    for (const action_type of ACTION_TYPES) {
      const { output_payload } = compute({ action_type, prior_state });
      checked++;
      const allowed = LEGAL[prior_state] || [];
      const expectedLegal = allowed.includes(action_type);
      if (output_payload.action_legal !== expectedLegal) violations++;
      if (JSON.stringify(output_payload.allowed) !== JSON.stringify(allowed)) violations++;
      if (output_payload.action_type !== action_type) violations++;
      if (output_payload.prior_state !== prior_state) violations++;
    }
  }
  return { name: 'P1_forced_categorical_grid_agreement_24cells', checked, violations };
}

// P2: compliance_flags baseline shape -- always-present tag, exactly-one valid/invalid tag,
// and the two named diagnostic tags fire exactly on their declared trigger conditions.
function checkP2_complianceFlagsShape() {
  let violations = 0, checked = 0;
  for (const prior_state of PRIOR_STATES) {
    for (const action_type of ACTION_TYPES) {
      const { output_payload, compliance_flags } = compute({ action_type, prior_state });
      checked++;
      if (!compliance_flags.includes('EMIR_LIFECYCLE_ASSESSED')) violations++;
      const validTag = compliance_flags.includes('EMIR_LIFECYCLE_VALID');
      const invalidTag = compliance_flags.includes('EMIR_LIFECYCLE_INVALID');
      if (validTag === invalidTag) violations++;
      if (validTag !== output_payload.action_legal) violations++;
      const expectDup = !output_payload.action_legal && action_type === 'New' && prior_state === 'open';
      if (compliance_flags.includes('DUPLICATE_NEW_ON_OPEN_UTI') !== expectDup) violations++;
      const expectModify = !output_payload.action_legal && (action_type === 'Modify' || action_type === 'Correct') && prior_state === 'none';
      if (compliance_flags.includes('MODIFY_WITHOUT_PRIOR') !== expectModify) violations++;
    }
  }
  return { name: 'P2_compliance_flags_shape_24cells', checked, violations };
}

// P3: an out-of-table prior_state (unrecognized value) always yields action_legal:false and an
// empty allowed[] -- the kernel's `LEGAL[prior_state] || []` fallback.
function checkP3_outOfTablePriorState() {
  let violations = 0, checked = 0;
  for (const prior_state of ['unknown_state', '', undefined, null]) {
    for (const action_type of ['New', 'Modify']) {
      const { output_payload } = compute({ action_type, prior_state });
      checked++;
      if (output_payload.action_legal !== false) violations++;
      if (!Array.isArray(output_payload.allowed) || output_payload.allowed.length !== 0) violations++;
    }
  }
  return { name: 'P3_out_of_table_prior_state_fallback', checked, violations };
}

// P4: output shape / no NaN / undefined across missing-field and empty-object inputs.
function checkP4_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { action_type: 'New' }, { prior_state: 'open' }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (typeof output_payload.action_legal !== 'boolean') violations++;
    if (!Array.isArray(output_payload.allowed)) violations++;
    if (findShapeViolations({ action_legal: output_payload.action_legal, allowed: output_payload.allowed }).length) violations++;
  }
  return { name: 'P4_output_shape_no_nan_undefined', checked, violations };
}

// ---------- run ----------
const oracle = runFixtureOracle(KERNEL_ID, compute);
const properties = [
  checkP1_forcedGridAgreement(),
  checkP2_complianceFlagsShape(),
  checkP3_outOfTablePriorState(),
  checkP4_outputShapeInvariant(),
];
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
