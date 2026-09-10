// art-236-build-ai-decision-log-record.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C7-1).
// kernel_digest_at_authoring: sha256:d45fd5d7dc550addeff5e297d0fe8a9dc4a233743d78c6021443a6e891ea654e
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — the only numeric field, `confidence`, is clamped
// via Math.max/min and rounded to 3dp for display; it is never combined into a derived value or
// compared against a threshold that a rounding difference could flip [LOW_CONFIDENCE uses the
// caller-supplied value directly, verbatim clamp comparison]).
// Checks: fixture-oracle gate, termination (bounded by human_accountability_records.length in
// assembleEvidenceBundle's filter/map chain), boundedness (confidence in [0,1], completeness
// score in [0,100], retention_months >= 6), a metamorphic subject_hash-filter check (unrelated
// accountability records never leak into the evidence bundle), and forced categorical boundary
// cases (empty input, retention clamp at 5/6, confidence clamp at -1/2, override without by,
// declared-presence omissions: model_version/subject_ref/override_flag refuse certification,
// declared-false override_flag stays complete — CCPP-FIX-ART236-1).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-236-build-ai-decision-log-record.proptest.mjs

import { compute } from '../art-236-build-ai-decision-log-record.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-236-build-ai-decision-log-record.fixtures.json');
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

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x236A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomInput(rng) {
  return {
    model_id: `model-${Math.floor(rng() * 100)}`,
    model_version: '1.0.0',
    input_digest: 'a'.repeat(64),
    output_digest: 'b'.repeat(64),
    decision_label: pick(rng, ['CREDIT_APPROVED', 'CREDIT_DENIED', 'PREMIUM_TIER_1', '']),
    confidence: rng() * 2 - 0.5, // deliberately out-of-[0,1] range sometimes
    override_flag: rng() < 0.2,
    subject_ref: `CASE-${Math.floor(rng() * 1000)}`,
    retention_months: Math.floor(rng() * 20) - 5, // deliberately below-6 sometimes
    operator_id: `op-${Math.floor(rng() * 10)}`,
  };
}

const TRIALS = 4000;

// ---------- P1: boundedness — confidence/completeness/retention stay in their declared ranges ----------
function checkP1_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const { output_payload: o } = compute(randomInput(rand));
    checked++;
    if (o.record_status === 'EMPTY_INPUT') continue;
    if (o.confidence < 0 || o.confidence > 1) violations++;
    if (o.art12_completeness_score < 0 || o.art12_completeness_score > 100) violations++;
    if (o.retention_months < 6) violations++;
  }
  return { name: 'P1_confidence_completeness_retention_bounded', trials: checked, violations };
}

// ---------- P2: termination — record building always resolves for any human_accountability_records length ----------
function checkP2_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 30);
    const records = Array.from({ length: n }, (_, j) => ({
      record_type: pick(rand, ['approval', 'annotation', 'override']),
      role: pick(rand, ['reviewer', 'approver']),
      subject_hash: rand() < 0.7 ? 'sha256:target' : 'sha256:other',
      identity: { id: `did:key:z${j}` },
      decision: 'approve',
    }));
    const input = randomInput(rand);
    input.subject_hash = 'sha256:target';
    input.human_accountability_records = records;
    const { output_payload: o } = compute(input);
    checked++;
    if (o.record_status === 'EMPTY_INPUT') continue;
    if (o.ha_evidence_bundle) {
      const total = (o.ha_evidence_bundle.reviewers?.length || 0) + (o.ha_evidence_bundle.approvers?.length || 0);
      if (total > n) violations++;
    }
  }
  return { name: 'P2_termination_evidence_bundle_bounded_by_records_length', trials: checked, violations };
}

// ---------- P3 (metamorphic): subject_hash filter — unrelated records never leak into the bundle ----------
function checkP3_subjectHashFilterMetamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const input = randomInput(rand);
    input.subject_hash = 'sha256:target';
    const unrelated = { record_type: 'approval', role: 'reviewer', subject_hash: 'sha256:unrelated', identity: { id: 'did:key:zUNRELATED' } };
    const a = compute({ ...input, human_accountability_records: [] }).output_payload;
    const b = compute({ ...input, human_accountability_records: [unrelated] }).output_payload;
    checked++;
    if (a.record_status === 'EMPTY_INPUT') continue;
    // adding a record for a DIFFERENT subject_hash must never change the evidence bundle
    if (JSON.stringify(a.ha_evidence_bundle) !== JSON.stringify(b.ha_evidence_bundle)) violations++;
  }
  return { name: 'P3_subject_hash_filter_metamorphic', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no) ----------
// CCPP-FIX-ART236-1 (2026-09-10): the Art 12 required-field set grew to the
// estate-declared seven (model_version/override_flag/subject_ref added). The clamp
// cases now declare the full set so they exercise the COMPLETE path; new forced
// cases pin the declared-presence semantics: omitting model_version (which the
// kernel defaults to '0.0.0'), subject_ref, or override_flag (a boolean — DECLARED
// false is present, undefined is missing) must refuse certification.
function checkP4_categoricalBoundaries() {
  let violations = 0, checked = 0;
  const FULL = { model_id: 'm', model_version: '1.0.0', input_digest: 'x', output_digest: 'y', decision_label: 'd', override_flag: false, subject_ref: 'CASE-1' };
  const cases = [
    {}, // empty input -> EMPTY_INPUT sentinel
    { ...FULL, retention_months: 5 }, // clamp to 6
    { ...FULL, retention_months: 6 }, // exact boundary
    { ...FULL, confidence: -1 }, // clamp to 0
    { ...FULL, confidence: 2 }, // clamp to 1
    { ...FULL, override_flag: true }, // override without override_by
  ];
  for (const c of cases) {
    checked++;
    const { output_payload: o } = compute(c);
    if (o.confidence < 0 || o.confidence > 1) violations++;
    if (o.retention_months < 6) violations++;
  }
  const empty = compute(cases[0]).output_payload;
  if (empty.record_status !== 'EMPTY_INPUT') violations++;
  const clampLow = compute(cases[1]).output_payload;
  if (clampLow.retention_months !== 6) violations++;
  const clampConfLo = compute(cases[3]).output_payload;
  if (clampConfLo.confidence !== 0) violations++;
  const clampConfHi = compute(cases[4]).output_payload;
  if (clampConfHi.confidence !== 1) violations++;
  const overrideDefault = compute(cases[5]).output_payload;
  if (overrideDefault.override_by !== 'human-reviewer') violations++;

  // Declared-presence pins (CCPP-FIX-ART236-1): each single omission refuses
  // COMPLETE certification; a DECLARED false override_flag stays complete.
  const omissions = [
    { model_version: undefined }, { model_version: '' },
    { subject_ref: '' }, { override_flag: undefined },
  ];
  for (const omit of omissions) {
    checked++;
    const pp = { ...FULL, ...omit };
    delete pp[Object.keys(omit)[0]];
    const o = compute(pp).output_payload;
    if (o.record_status === 'COMPLETE' || o.art12_fields_present) violations++;
    if (!o.missing_art12_fields?.includes(Object.keys(omit)[0])) violations++;
  }
  const declaredFalse = compute({ ...FULL, override_flag: false }).output_payload;
  if (declaredFalse.record_status !== 'COMPLETE' || declaredFalse.art12_completeness_score !== 100) violations++;
  checked++;
  return { name: 'P4_forced_categorical_boundaries', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_boundedness());
results.properties.push(checkP2_termination());
results.properties.push(checkP3_subjectHashFilterMetamorphic());
results.properties.push(checkP4_categoricalBoundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-236-build-ai-decision-log-record',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
