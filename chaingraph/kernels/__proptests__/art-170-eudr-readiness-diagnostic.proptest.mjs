// art-170-eudr-readiness-diagnostic property-test floor (FV-PROPFLOOR-SHARD-A-BOOLDIM-1).
// kernel_digest_at_authoring: sha256:44e1baff3a59bb7abdc7c86ad7c7205ea8ade03711d4155ba4760b31d08d0371
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED domain,
// not a totality proof. Domain is 6 independent booleans read via `=== true` -- 2^6 = 64 states, small
// enough to enumerate exhaustively at zero extra cost over "a few hundred random samples".
// ZERO external dependencies -- pure Node built-ins only. READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-170-eudr-readiness-diagnostic.proptest.mjs

import { compute } from '../art-170-eudr-readiness-diagnostic.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-170-eudr-readiness-diagnostic.fixtures.json');
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
  const good = { scope_mapped: true, geolocation_data_ready: true, dds_submission_ready: true, risk_assessed: true, mitigation_documented: true, retention_system_ready: true };
  const { output_payload } = compute({ entity: good });
  const mutated = { ...output_payload, readiness_grade: output_payload.readiness_grade === 'A' ? 'F' : 'A' };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

const DIM_KEYS = ['scope_mapped', 'geolocation_data_ready', 'dds_submission_ready', 'risk_assessed', 'mitigation_documented', 'retention_system_ready'];
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

// P2: monotone -- adding a true dimension never decreases dimensions_met/readiness_score, and grade
// index (F=0..A=6) never decreases either (GRADES is a non-decreasing lookup by construction).
function checkP2_monotoneInDimensionsAdded() {
  let violations = 0, checked = 0;
  for (let mask = 0; mask < 63; mask++) {
    for (let bit = 0; bit < 6; bit++) {
      if ((mask >> bit) & 1) continue; // bit already on -- skip, we want mask -> mask|bit
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

// P4: output shape / no NaN / undefined; enforcement_deadlines is the fixed 2-entry list regardless of input.
function checkP4_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { entity: {} }, { entity: { scope_mapped: true } }, { entity: { risk_assessed: true, retention_system_ready: true } }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (!Number.isFinite(output_payload.readiness_score)) violations++;
    if (output_payload.readiness_score < 0 || output_payload.readiness_score > 100) violations++;
    if (typeof output_payload.fully_ready !== 'boolean') violations++;
    if (!Array.isArray(output_payload.gaps)) violations++;
    if (!Array.isArray(output_payload.enforcement_deadlines) || output_payload.enforcement_deadlines.length !== 2) violations++;
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
  kernel_id: 'art-170-eudr-readiness-diagnostic',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
