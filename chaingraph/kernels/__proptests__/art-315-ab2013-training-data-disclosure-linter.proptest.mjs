// art-315-ab2013-training-data-disclosure-linter property-test floor (FV-PROPFLOOR-SHARD-A-REMAINDER-2).
// kernel_digest_at_authoring: sha256:669f7fe95b37812eccdd1636cf1b71298e1b1e396e96e5b505afa035a479631e
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape: small fixed-field linter -- 12 named datapoint keys
// checked for presence (isPresent: non-null/undefined, non-empty-after-trim string, or any
// other truthy-shaped value) against a caller-supplied disclosure object, rolled into
// per_datapoint/missing_datapoints/present_count/all_present -- confirmed against direct
// kernel source read per this row's fence.
// float:no (presence is a boolean predicate over declared keys, no numeric fields) -- forced
// CATEGORICAL boundary cases (every datapoint individually present/missing) stand in for ULP
// forcing. ZERO external dependencies -- pure Node built-ins only. READ-ONLY w.r.t. the kernel
// it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-315-ab2013-training-data-disclosure-linter.proptest.mjs

import { compute, AB2013_DATAPOINTS } from '../art-315-ab2013-training-data-disclosure-linter.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function isPresentRef(v) {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  return true;
}
function randomDisclosure(rng) {
  const d = {};
  for (const k of AB2013_DATAPOINTS) {
    const r = rng();
    if (r < 0.4) continue; // omit key
    else if (r < 0.55) d[k] = '';
    else if (r < 0.7) d[k] = '   ';
    else if (r < 0.85) d[k] = 'synthetic value';
    else d[k] = true;
  }
  return d;
}

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-315-ab2013-training-data-disclosure-linter.fixtures.json');
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
  const { output_payload } = compute({ disclosure: {} });
  const mutated = { ...output_payload, present_count: output_payload.present_count === 0 ? 12 : 0 };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

// P1: per_datapoint/status agrees with isPresent for every key, random 300-sample.
function checkP1_perDatapointAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(315001);
  for (let i = 0; i < 300; i++) {
    const disclosure = randomDisclosure(rng);
    const { output_payload } = compute({ disclosure });
    checked++;
    for (const key of AB2013_DATAPOINTS) {
      const expected = isPresentRef(disclosure[key]) ? 'present' : 'missing';
      const row = output_payload.per_datapoint.find((d) => d.datapoint === key);
      if (!row || row.status !== expected) violations++;
    }
  }
  return { name: 'P1_per_datapoint_agreement_random300', trials: checked, violations };
}

// P2: present_count + missing_datapoints.length == total_datapoints == 12; all_present agreement.
function checkP2_countsAndAllPresentAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(315002);
  for (let i = 0; i < 300; i++) {
    const disclosure = randomDisclosure(rng);
    const { output_payload } = compute({ disclosure });
    checked++;
    if (output_payload.total_datapoints !== 12) violations++;
    if (output_payload.present_count + output_payload.missing_datapoints.length !== 12) violations++;
    if (output_payload.all_present !== (output_payload.missing_datapoints.length === 0)) violations++;
  }
  return { name: 'P2_counts_and_all_present_agreement_random300', trials: checked, violations };
}

// P3: insufficient_evidence == (Object.keys(disclosure).length === 0), independent of values.
function checkP3_insufficientEvidenceAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(315003);
  for (let i = 0; i < 300; i++) {
    const disclosure = randomDisclosure(rng);
    const { output_payload } = compute({ disclosure });
    checked++;
    const expected = Object.keys(disclosure).length === 0;
    if (output_payload.insufficient_evidence !== expected) violations++;
  }
  return { name: 'P3_insufficient_evidence_agreement_random300', trials: checked, violations };
}

// P4: forced categorical boundary cases -- all-missing, all-present, and each datapoint
// individually present with the other 11 missing.
function checkP4_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;

  let r = compute({ disclosure: {} }).output_payload;
  checked++; if (r.all_present !== false || r.present_count !== 0 || r.missing_datapoints.length !== 12) violations++;

  const allTrue = Object.fromEntries(AB2013_DATAPOINTS.map((k) => [k, true]));
  r = compute({ disclosure: allTrue }).output_payload;
  checked++; if (r.all_present !== true || r.present_count !== 12) violations++;

  for (const key of AB2013_DATAPOINTS) {
    r = compute({ disclosure: { [key]: 'x' } }).output_payload;
    checked++;
    if (r.present_count !== 1) violations++;
    if (r.missing_datapoints.includes(key)) violations++;
  }

  return { name: 'P4_forced_categorical_boundary_cases_all_and_per_datapoint', trials: checked, violations };
}

// P5: output shape / no NaN / undefined across missing-field and empty-object inputs.
function checkP5_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { disclosure: {} }, { disclosure: { dataset_sources_or_owners: 'x' } }, undefined];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (!Array.isArray(output_payload.per_datapoint) || output_payload.per_datapoint.length !== 12) violations++;
    if (!Array.isArray(output_payload.missing_datapoints)) violations++;
    if (!Number.isFinite(output_payload.present_count)) violations++;
    if (!Number.isFinite(output_payload.total_datapoints)) violations++;
    if (typeof output_payload.all_present !== 'boolean') violations++;
    if (typeof output_payload.insufficient_evidence !== 'boolean') violations++;
  }
  return { name: 'P5_output_shape_no_nan_undefined', trials: checked, violations };
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

results.properties.push(checkP1_perDatapointAgreement());
results.properties.push(checkP2_countsAndAllPresentAgreement());
results.properties.push(checkP3_insufficientEvidenceAgreement());
results.properties.push(checkP4_forcedCategoricalBoundaries());
results.properties.push(checkP5_outputShapeInvariant());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-315-ab2013-training-data-disclosure-linter',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
