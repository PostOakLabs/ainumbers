// art-418-idv-verification-failure-incident-composer.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C19-1).
// kernel_digest_at_authoring: sha256:90527f7f3f2c9cb095cea22dcaef24642147eb19350d1a0d12bc4eeccc168822
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — pure string/regex/enum-coercion decision logic
// over declared fields and a single filter loop over session_evidence; no arithmetic beyond
// integer counting; forced categorical boundary cases used).
// Checks: fixture-oracle gate, termination (the session_evidence filter loop is bounded by
// evidenceIn.length, a single linear pass, no recursion), boundedness (session_evidence.length +
// invalid_evidence_count === evidenceIn.length exactly), a differential re-derivation of
// record_claim_strength from session_receipt_missing/evidence_count and of every *_coerced flag
// from its enum-membership test, and forced categorical boundary cases (missing session_receipt,
// malformed receipt_hash, unknown failure_type/severity_class forced to their coercion defaults,
// evidence entries with an unrecognized evidence_type dropped and counted invalid, no cross-link
// present).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-418-idv-verification-failure-incident-composer.proptest.mjs

import { compute } from '../art-418-idv-verification-failure-incident-composer.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-418-idv-verification-failure-incident-composer.fixtures.json');
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
const rand = mulberry32(0x418C19);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function bit(rng, p = 0.5) { return rng() < p; }

const FAILURE_TYPES = ['injection_detected', 'liveness_failed', 'document_mismatch', 'device_anomaly', 'other', 'bogus_type'];
const SEVERITY_CLASSES = ['affirming', 'warning', 'contraindicated', 'bogus_severity'];
const EVIDENCE_TYPES = ['otel_span', 'in_toto_link', 'bogus_evidence'];

function randomHash(rng) { return bit(rng, 0.7) ? 'sha256:' + 'a'.repeat(16) : 'not-a-hash'; }

function randomPP(rng) {
  const n = Math.floor(rng() * 6);
  return {
    session_receipt: bit(rng, 0.8) ? { session_id: bit(rng, 0.85) ? 's1' : undefined, verifier_id: 'v1', receipt_hash: randomHash(rng) } : {},
    failure_classification: { failure_type: pick(rng, FAILURE_TYPES), severity_class: pick(rng, SEVERITY_CLASSES) },
    session_evidence: Array.from({ length: n }, () => ({ evidence_type: pick(rng, EVIDENCE_TYPES), digest: bit(rng, 0.9) ? 'sha256:' + 'b'.repeat(16) : undefined })),
    remediation: { status: bit(rng, 0.8) ? pick(rng, ['open', 'in_progress', 'resolved']) : 'bogus_status' },
  };
}

const TRIALS = 4000;

// ---------- P1: termination — evidence split bounded by input length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.session_evidence.length + o.invalid_evidence_count !== pp.session_evidence.length) violations++;
    if (o.evidence_count !== o.session_evidence.length) violations++;
  }
  return { name: 'P1_termination_evidence_split_bounded_by_input_length', trials: checked, violations };
}

// ---------- P2: boundedness — every session_evidence entry has a recognized evidence_type ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  const KNOWN = new Set(['otel_span', 'in_toto_link']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (!o.session_evidence.every((e) => KNOWN.has(e.evidence_type))) violations++;
  }
  return { name: 'P2_kept_evidence_always_recognized_type', trials: checked, violations };
}

// ---------- P3: differential — record_claim_strength + coercion flags re-derived ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    const missing = !pp.session_receipt || typeof pp.session_receipt.session_id !== 'string' || !pp.session_receipt.session_id
      || typeof pp.session_receipt.receipt_hash !== 'string';
    const expectedStrength = missing ? 'insufficient' : (o.evidence_count === 0 ? 'declared-only' : 'evidence-backed');
    if (o.record_claim_strength !== expectedStrength) violations++;

    const ft = pp.failure_classification.failure_type;
    const expectedFailureCoerced = !['injection_detected', 'liveness_failed', 'document_mismatch', 'device_anomaly', 'other'].includes(ft);
    if (o.failure_classification.failure_type_coerced_from_unknown_type !== expectedFailureCoerced) violations++;
    if (expectedFailureCoerced && o.failure_classification.failure_type !== 'other') violations++;

    const sc = pp.failure_classification.severity_class;
    const expectedSeverityCoerced = !['affirming', 'warning', 'contraindicated'].includes(sc);
    if (o.failure_classification.severity_coerced_from_forbidden_class !== expectedSeverityCoerced) violations++;
    if (expectedSeverityCoerced && o.failure_classification.severity_class !== 'warning') violations++;
  }
  return { name: 'P3_record_claim_strength_and_coercion_differential', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no) ----------
function checkP4_forced_categorical() {
  let violations = 0, checked = 0;
  // missing session_receipt entirely -> insufficient, flag raised
  {
    const { output_payload: o, compliance_flags } = compute({ failure_classification: {}, session_evidence: [], remediation: {} });
    checked++;
    if (o.record_claim_strength !== 'insufficient') violations++;
    if (!compliance_flags.includes('IS2_SESSION_RECEIPT_LINK_MISSING')) violations++;
  }
  // valid receipt, zero evidence -> declared-only
  {
    const { output_payload: o } = compute({ session_receipt: { session_id: 's1', receipt_hash: 'sha256:' + 'a'.repeat(16) }, failure_classification: {}, session_evidence: [], remediation: {} });
    checked++;
    if (o.record_claim_strength !== 'declared-only') violations++;
  }
  // valid receipt + 1 valid evidence -> evidence-backed
  {
    const { output_payload: o } = compute({ session_receipt: { session_id: 's1', receipt_hash: 'sha256:' + 'a'.repeat(16) }, failure_classification: {}, session_evidence: [{ evidence_type: 'otel_span', digest: 'sha256:' + 'b'.repeat(16) }], remediation: {} });
    checked++;
    if (o.record_claim_strength !== 'evidence-backed') violations++;
  }
  // malformed receipt_hash -> well_formed false, flag raised
  {
    const { output_payload: o, compliance_flags } = compute({ session_receipt: { session_id: 's1', receipt_hash: 'not-a-hash' }, failure_classification: {}, session_evidence: [], remediation: {} });
    checked++;
    if (o.session_receipt.receipt_hash_well_formed) violations++;
    if (!compliance_flags.includes('IS2_SESSION_RECEIPT_HASH_MALFORMED')) violations++;
  }
  // no cross-link declared -> cross_linked false
  {
    const { output_payload: o } = compute({ failure_classification: {}, session_evidence: [], remediation: {} });
    checked++;
    if (o.cross_linked) violations++;
  }
  return { name: 'P4_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-418-idv-verification-failure-incident-composer',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
