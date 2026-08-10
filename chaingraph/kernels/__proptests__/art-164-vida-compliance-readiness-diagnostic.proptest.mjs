// art-164-vida-compliance-readiness-diagnostic property-test floor (FV-PROPFLOOR-SHARD-A-BOOLDIM-1).
// kernel_digest_at_authoring: sha256:574ee6c374f1501a9f75ec34933461c9ed1a9829b3d0882eba36dd0d3c1e93c4
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED domain,
// not a totality proof. Domain is 4 independent booleans read via `=== true` (dim.platform/oss also
// accept a *_not_applicable escape flag, folded into the same boolean read) -- 2^4 = 16 states, small
// enough to enumerate exhaustively at zero extra cost over "a few hundred random samples" (this file
// enumerates the full 16-state domain plus the 4-flag *_not_applicable variants, still << a few hundred).
// ZERO external dependencies -- pure Node built-ins only. READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-164-vida-compliance-readiness-diagnostic.proptest.mjs

import { compute } from '../art-164-vida-compliance-readiness-diagnostic.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-164-vida-compliance-readiness-diagnostic.fixtures.json');
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

// ---------- negative control: an oracle never seen rejecting a wrong spec is not known to work ----------
function negativeControl() {
  const good = { einvoice_ready: true, drr_ready: true, platform_not_applicable: true, oss_scheme_configured: true };
  const { output_payload } = compute({ entity: good });
  const mutated = { ...output_payload, readiness_score: output_payload.readiness_score === 100 ? 50 : 100 };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

// ---------- declared boolean domain: 4 dimensions, each with a real+escape flag for platform/oss ----------
const DIM_FLAG_SETS = {
  einvoice: ['einvoice_ready'],
  drr: ['drr_ready'],
  platform: ['platform_assessed', 'platform_not_applicable'],
  oss: ['oss_scheme_configured', 'oss_not_applicable'],
};
const DIM_KEYS = Object.keys(DIM_FLAG_SETS);

// P1: dimensions_met == count of dims where ANY of that dim's flags is true; readiness_score derived exactly.
function checkP1_scoreAgreement() {
  let violations = 0, checked = 0;
  for (let mask = 0; mask < 16; mask++) {
    const entity = {};
    let expectedMet = 0;
    DIM_KEYS.forEach((dim, i) => {
      const on = (mask >> i) & 1;
      if (on) { entity[DIM_FLAG_SETS[dim][0]] = true; expectedMet++; }
    });
    const { output_payload } = compute({ entity });
    checked++;
    const expectedScore = Math.round((expectedMet / 4) * 100);
    if (output_payload.dimensions_met !== expectedMet) violations++;
    if (output_payload.readiness_score !== expectedScore) violations++;
    if (output_payload.fully_ready !== (expectedMet === 4)) violations++;
    if (output_payload.gaps.length !== 4 - expectedMet) violations++;
  }
  return { name: 'P1_score_agreement_full_16_state_enum', trials: checked, violations };
}

// P2: escape flags (platform_not_applicable / oss_not_applicable) satisfy their dimension identically
// to the primary flag -- both routes must count the dimension met.
function checkP2_escapeFlagsEquivalent() {
  let violations = 0, checked = 0;
  for (const dim of ['platform', 'oss']) {
    const [primary, escape] = DIM_FLAG_SETS[dim];
    const rPrimary = compute({ entity: { [primary]: true } }).output_payload;
    const rEscape = compute({ entity: { [escape]: true } }).output_payload;
    checked += 2;
    if (rPrimary.dimensions_met !== 1) violations++;
    if (rEscape.dimensions_met !== 1) violations++;
    if (rPrimary.readiness_score !== rEscape.readiness_score) violations++;
  }
  return { name: 'P2_escape_flags_equivalent', trials: checked, violations };
}

// P3: non-boolean / truthy-but-not-true values never count as met (strict === true read).
function checkP3_strictBooleanRead() {
  let violations = 0, checked = 0;
  const NEAR_TRUE = [1, '1', 'true', [], {}, null, undefined, 0, ''];
  for (const v of NEAR_TRUE) {
    const { output_payload } = compute({ entity: { einvoice_ready: v, drr_ready: v, platform_assessed: v, oss_scheme_configured: v } });
    checked++;
    if (output_payload.dimensions_met !== 0) violations++;
  }
  return { name: 'P3_strict_boolean_read_non_true_never_counts', trials: checked, violations };
}

// P4: output shape / no NaN / undefined, and the timeline is the fixed 3-entry list regardless of input.
function checkP4_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { entity: {} }, { entity: { einvoice_ready: true } }, { entity: { drr_ready: true, oss_not_applicable: true } }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (!Number.isFinite(output_payload.readiness_score)) violations++;
    if (output_payload.readiness_score < 0 || output_payload.readiness_score > 100) violations++;
    if (typeof output_payload.fully_ready !== 'boolean') violations++;
    if (!Array.isArray(output_payload.gaps)) violations++;
    if (!Array.isArray(output_payload.timeline_obligations) || output_payload.timeline_obligations.length !== 3) violations++;
  }
  return { name: 'P4_output_shape_no_nan_undefined', trials: checked, violations };
}

// ---------- run ----------
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

results.properties.push(checkP1_scoreAgreement());
results.properties.push(checkP2_escapeFlagsEquivalent());
results.properties.push(checkP3_strictBooleanRead());
results.properties.push(checkP4_outputShapeInvariant());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-164-vida-compliance-readiness-diagnostic',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
