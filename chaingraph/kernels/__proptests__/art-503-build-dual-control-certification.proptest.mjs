// art-503-build-dual-control-certification.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C24-1).
// kernel_digest_at_authoring: sha256:a57bc96bcfdea16261374e636c9a22668fd91415abc1e441540e6d48306026b0
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// ⛔⛔ CORRECTION TO THE WU ROW'S TABLE (per FIX-2): the row lists this kernel as float:yes.
// Direct read of the full compute() body shows this is pure threshold COUNTING: the only numeric
// input is threshold_n, gated by `Number.isSafeInteger(threshold_raw) && threshold_raw >= 1`, and
// the verdict compares two non-negative integers (distinct_identities_counted >= threshold_n).
// Every other check is string/identity/date-string comparison. There is no floating-point
// arithmetic and no floating-point threshold anywhere in this kernel. Corrected to float:no;
// floored with forced categorical boundary cases at the integer threshold_n boundary (exactly at
// N, one below N, non-integer/zero/negative threshold) instead of an ULP claim, per spec §3's
// float:no fallback.
// Checks: fixture-oracle gate, termination (counted_records/duplicate collapse bounded by input
// signatory_records.length), forced categorical boundary cases at the threshold_n integer boundary,
// differential re-derivation of distinct_identities_counted and threshold_satisfied, boundedness
// (distinct_identities_counted <= counted_records.length <= supplied.length), and metamorphic
// invariance (duplicating an already-counted identity's approval record never changes
// distinct_identities_counted; a rejection record for the required role always blocks the gate
// regardless of how many approvals are present).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-503-build-dual-control-certification.proptest.mjs

import { compute } from '../art-503-build-dual-control-certification.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-503-build-dual-control-certification.fixtures.json');
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
const rand = mulberry32(0x503D0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const SUBJ = 'sha256:' + 's'.repeat(64);
function conformantRecord(identity_id, role, record_type) {
  return {
    identity_id, role, record_type: record_type || 'approval', subject_hash: SUBJ,
    audit_signature: { proof: { cryptosuite: 'eddsa-jcs-2022', verificationMethod: `${identity_id}#key-1` } },
  };
}

function randomRecords(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const conformant = rng() < 0.7;
    const identity_id = `id-${Math.floor(rng() * 5)}`;
    const rec_type = pick(rng, ['approval', 'approval', 'approval', 'rejection', 'override']);
    if (conformant) out.push(conformantRecord(identity_id, 'approver', rec_type));
    else out.push({ identity_id, role: 'approver', record_type: rec_type, subject_hash: SUBJ });
  }
  return out;
}

function randomPP(rng) {
  const n = Math.floor(rng() * 8);
  return {
    regime_label: 'TEST-REGIME',
    certification_ref: 'CERT-1',
    as_of_date: '2026-01-15',
    subject_hash: SUBJ,
    subject_class: 'node_output',
    required_role: 'approver',
    threshold_n: pick(rng, [1, 2, 3, 0, -1, 1.5, null]),
    signatory_records: randomRecords(rng, n),
    prepared_by: {},
  };
}

const TRIALS = 5000;

// ---------- P1: termination — counted_records bounded by input signatory_records.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.counted_records.length > pp.signatory_records.length) violations++;
    if (output_payload.records_summary.supplied_count !== pp.signatory_records.length) violations++;
    if (output_payload.distinct_identities_counted > output_payload.counted_records.length) violations++;
  }
  return { name: 'P1_termination_counted_records_bounded_by_input_length', trials: checked, violations };
}

// ---------- P2: forced categorical boundary cases at the integer threshold_n boundary ----------
function checkP2_threshold_boundary_categorical() {
  let violations = 0, checked = 0;
  const twoConformant = [conformantRecord('a', 'approver'), conformantRecord('b', 'approver')];
  const cases = [
    { threshold_n: 2, records: twoConformant, expectSatisfied: true }, // exactly at N
    { threshold_n: 3, records: twoConformant, expectSatisfied: false }, // one short
    { threshold_n: 1, records: twoConformant, expectSatisfied: true },
    { threshold_n: 0, records: twoConformant, expectSatisfied: false }, // invalid (< 1)
    { threshold_n: -1, records: twoConformant, expectSatisfied: false },
    { threshold_n: 1.5, records: twoConformant, expectSatisfied: false }, // non-integer
    { threshold_n: null, records: twoConformant, expectSatisfied: false },
  ];
  for (const c of cases) {
    const pp = { regime_label: 'R', certification_ref: 'C', as_of_date: '2026-01-01', subject_hash: SUBJ, subject_class: 'node_output', required_role: 'approver', threshold_n: c.threshold_n, signatory_records: c.records, prepared_by: {} };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.threshold_satisfied !== c.expectSatisfied) violations++;
  }
  return { name: 'P2_threshold_n_forced_categorical_boundary', trials: checked, violations };
}

// ---------- P3 (differential): distinct_identities_counted + threshold_satisfied re-derivation ----------
function checkP3_threshold_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const conformant = pp.signatory_records.filter((r) =>
      r.role === pp.required_role && r.record_type === 'approval' && r.identity_id &&
      r.audit_signature && r.audit_signature.proof && r.audit_signature.proof.cryptosuite === 'eddsa-jcs-2022' &&
      typeof r.audit_signature.proof.verificationMethod === 'string' && r.audit_signature.proof.verificationMethod.indexOf(r.identity_id) === 0);
    const distinctIds = [...new Set(conformant.map((r) => r.identity_id))];
    const hasRejection = pp.signatory_records.some((r) => r.role === pp.required_role && r.record_type === 'rejection');
    const thresholdValid = Number.isSafeInteger(pp.threshold_n) && pp.threshold_n >= 1;
    const expectedSatisfied = thresholdValid && !hasRejection && distinctIds.length >= pp.threshold_n;
    if (output_payload.distinct_identities_counted !== distinctIds.length) violations++;
    if (output_payload.threshold_satisfied !== expectedSatisfied) violations++;
  }
  return { name: 'P3_distinct_identities_and_threshold_satisfied_differential', trials: checked, violations };
}

// ---------- P4: boundedness — distinct_identities_counted <= counted_records.length <= supplied.length ----------
function checkP4_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (!(output_payload.distinct_identities_counted <= output_payload.counted_records.length)) violations++;
    if (!(output_payload.counted_records.length <= pp.signatory_records.length)) violations++;
    if (output_payload.threshold_shortfall !== null && output_payload.threshold_shortfall < 0) violations++;
  }
  return { name: 'P4_counted_records_boundedness_chain', trials: checked, violations };
}

// ---------- P5: metamorphic — duplicate approval from an already-counted identity is a no-op on
// the count; a rejection record always blocks regardless of approval count ----------
function checkP5_duplicate_and_rejection_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = randomPP(rand);
    const r1 = compute(pp).output_payload;
    checked++;
    if (r1.counted_records.length > 0) {
      const existingId = r1.counted_records[0].identity_id;
      const dup = conformantRecord(existingId, 'approver');
      const r2 = compute({ ...pp, signatory_records: [...pp.signatory_records, dup] }).output_payload;
      checked++;
      if (r2.distinct_identities_counted !== r1.distinct_identities_counted) violations++;
    }
    const withRejection = { ...pp, signatory_records: [...pp.signatory_records, { identity_id: 'rejector', role: pp.required_role, record_type: 'rejection', subject_hash: SUBJ }] };
    const r3 = compute(withRejection).output_payload;
    checked++;
    if (r3.threshold_satisfied !== false) violations++;
  }
  return { name: 'P5_duplicate_noop_and_rejection_blocks_metamorphic', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_threshold_boundary_categorical());
results.properties.push(checkP3_threshold_differential());
results.properties.push(checkP4_boundedness());
results.properties.push(checkP5_duplicate_and_rejection_metamorphic());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-503-build-dual-control-certification',
  float_sensitive: false,
  float_sensitive_correction: 'WU row table said float:yes; direct source read shows pure threshold counting over integers and identity/string comparison — threshold_n is gated by Number.isSafeInteger, and the verdict is an integer >= compare. No floating-point arithmetic or threshold exists anywhere. Corrected to float:no; floored with forced categorical boundary cases instead of ULP-boundary forcing.',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
