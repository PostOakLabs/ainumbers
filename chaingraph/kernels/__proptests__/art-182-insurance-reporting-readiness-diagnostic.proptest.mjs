// art-182-insurance-reporting-readiness-diagnostic property-test floor (FV-PROPFLOOR-SHARD-A-BOOLDIM-1).
// kernel_digest_at_authoring: sha256:b782a726871e3099cb51e0210048566f971438e63256bf61e5a39aec96bc4a90
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED domain,
// not a totality proof. Domain is 6 independent booleans read via `=== true` -- 2^6 = 64 states, small
// enough to enumerate exhaustively at zero extra cost over "a few hundred random samples".
// ZERO external dependencies -- pure Node built-ins only. READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-182-insurance-reporting-readiness-diagnostic.proptest.mjs

import { compute } from '../art-182-insurance-reporting-readiness-diagnostic.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-182-insurance-reporting-readiness-diagnostic.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    const a = JSON.stringify(output_payload);
    const b = JSON.stringify(vec.output_payload);
    if (a !== b) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
  }
  results.fixture_oracle = { total: fixtures.vectors.length, failures };
  return failures.length === 0;
}

function negativeControl() {
  const good = { ifrs17_measurement_model_elected: true, csm_system_implemented: true, risk_adjustment_disclosed: true, sii_qrt_reporting_complete: true, sii_ifrs17_reconciliation_done: true, ics_assessed: true };
  const { output_payload } = compute({ entity: good });
  const mutated = { ...output_payload, readiness_grade: output_payload.readiness_grade === 'A' ? 'F' : 'A' };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

const DIM_KEYS = ['ifrs17_measurement_model_elected', 'csm_system_implemented', 'risk_adjustment_disclosed', 'sii_qrt_reporting_complete', 'sii_ifrs17_reconciliation_done', 'ics_assessed'];
const GRADES = ['F', 'F', 'E', 'D', 'C', 'B', 'A'];

// P1: full 2^6 enumeration -- dimensions_met, readiness_score, grade, gaps all agree exactly with the mask.
function checkP1_fullEnumAgreement() {
  let violations = 0, checked = 0;
  for (let mask = 0; mask < 64; mask++) {
    const entity = {};
    let expectedMet = 0;
    const expectedGaps = [];
    DIM_KEYS.forEach((dim, i) => {
      const on = (mask >> i) & 1;
      if (on) { entity[dim] = true; expectedMet++; } else { expectedGaps.push(dim); }
    });
    const { output_payload } = compute({ entity });
    checked++;
    const expectedScore = Math.round((expectedMet / 6) * 100);
    if (output_payload.dimensions_met !== expectedMet) violations++;
    if (output_payload.readiness_score !== expectedScore) violations++;
    if (output_payload.readiness_grade !== GRADES[expectedMet]) violations++;
    if (output_payload.fully_ready !== (expectedMet === 6)) violations++;
    if (JSON.stringify(output_payload.gaps) !== JSON.stringify(expectedGaps)) violations++;
  }
  return { name: 'P1_full_64_state_enum_agreement', trials: checked, violations };
}

// P2: monotone in dimensions added.
function checkP2_monotoneInDimensionsAdded() {
  let violations = 0, checked = 0;
  for (let mask = 0; mask < 63; mask++) {
    for (let bit = 0; bit < 6; bit++) {
      if ((mask >> bit) & 1) continue;
      const maskPlus = mask | (1 << bit);
      const entityOf = (m) => {
        const e = {};
        DIM_KEYS.forEach((dim, i) => { if ((m >> i) & 1) e[dim] = true; });
        return e;
      };
      const r1 = compute({ entity: entityOf(mask) }).output_payload;
      const r2 = compute({ entity: entityOf(maskPlus) }).output_payload;
      checked++;
      if (r2.dimensions_met < r1.dimensions_met) violations++;
      if (r2.readiness_score < r1.readiness_score) violations++;
      if (GRADES.indexOf(r2.readiness_grade) < GRADES.indexOf(r1.readiness_grade)) violations++;
    }
  }
  return { name: 'P2_monotone_in_dimensions_added', trials: checked, violations };
}

// P3: strict boolean read -- non-`true` truthy values never count as met.
function checkP3_strictBooleanRead() {
  let violations = 0, checked = 0;
  const NEAR_TRUE = [1, '1', 'true', [], {}, null, undefined, 0, ''];
  for (const v of NEAR_TRUE) {
    const entity = {};
    DIM_KEYS.forEach((dim) => { entity[dim] = v; });
    const { output_payload } = compute({ entity });
    checked++;
    if (output_payload.dimensions_met !== 0) violations++;
    if (output_payload.readiness_grade !== 'F') violations++;
  }
  return { name: 'P3_strict_boolean_read_non_true_never_counts', trials: checked, violations };
}

// P4: output shape / no NaN / undefined.
function checkP4_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { entity: {} }, { entity: { ifrs17_measurement_model_elected: true } }, { entity: { csm_system_implemented: true, ics_assessed: true } }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (!Number.isFinite(output_payload.readiness_score)) violations++;
    if (output_payload.readiness_score < 0 || output_payload.readiness_score > 100) violations++;
    if (typeof output_payload.fully_ready !== 'boolean') violations++;
    if (!Array.isArray(output_payload.gaps)) violations++;
    if (!GRADES.includes(output_payload.readiness_grade)) violations++;
  }
  return { name: 'P4_output_shape_no_nan_undefined', trials: checked, violations };
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

const negControl = negativeControl();
if (!negControl.rejected_wrong_spec) {
  console.error('NEGATIVE CONTROL FAILED -- comparator never observed rejecting a wrong output.');
  process.exit(1);
}

results.properties.push(checkP1_fullEnumAgreement());
results.properties.push(checkP2_monotoneInDimensionsAdded());
results.properties.push(checkP3_strictBooleanRead());
results.properties.push(checkP4_outputShapeInvariant());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-182-insurance-reporting-readiness-diagnostic',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
