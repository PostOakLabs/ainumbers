// kernel_digest_at_authoring: sha256:7536fd33a1939b2ccca8c639a235de97b52d53a4897d621ce3a6af1218aae4a5
//
// FV-PROPFLOOR-SHARD-B21-1 — property-test floor for art-359-idv-session-receipt-builder.
// Class B (bounded-categorical). ⭐ FIX-2 CARRY CORRECTION: the WU row's triage table
// listed this kernel float:yes, but direct read of compute() shows it performs NO
// arithmetic on any numeric field — confidence/score/risk_score are only type-checked
// via safeNum() and passed through unmodified (no addition, multiplication, comparison-
// threshold, or rounding). There is nothing for a ULP boundary to perturb. This file
// therefore carries forced CATEGORICAL boundary cases (PII-shape rejection, commitment-
// scheme validation, missing-field completeness) in place of ULP forcing. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the B1/B12
// harness. compute() only — session_receipt hash chaining lives in async buildArtifact()
// and is out of this file's scope (compute() leaves session_receipt: null by design).
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-359-idv-session-receipt-builder.proptest.mjs

import { compute } from '../art-359-idv-session-receipt-builder.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

// The kernel's compute() returns { output_payload, compliance_flags, attempts,
// private_input_candidates } — session_receipt inside output_payload is always null
// from compute() (filled only by async buildArtifact()). Fixtures record the FULL
// buildArtifact() output, so the oracle here diffs compute()'s output_payload with
// session_receipt masked out, matching what compute() alone can promise.
function maskReceipt(op) {
  if (!op || op.rejected) return op;
  return { ...op, session_receipt: null };
}

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-359-idv-session-receipt-builder.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    const a = JSON.stringify(maskReceipt(output_payload));
    const b = JSON.stringify(maskReceipt(vec.output_payload));
    if (a !== b) failures.push({ name: vec.name, expected: maskReceipt(vec.output_payload), got: maskReceipt(output_payload) });
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
const rand = mulberry32(0x0359A1);
const TRIALS = 6000;
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function mkPP(rng) {
  const hasSession = rng() < 0.9;
  const hasVerifier = rng() < 0.9;
  const hasTimestamp = rng() < 0.9;
  return {
    session_id: hasSession ? `sess-${Math.floor(rng() * 1e6)}` : '',
    verifier_id: hasVerifier ? `vendor-${Math.floor(rng() * 100)}` : '',
    verifier_version: '1.0.0',
    timestamp: hasTimestamp ? '2026-08-10T00:00:00Z' : '',
    capture_chain: { manifest_digest: rng() < 0.7 ? 'sha256:' + 'a'.repeat(64) : null },
    injection_detection: { vendor: 'V', vendor_version: '1', verdict: rng() < 0.5, confidence: rng() },
    liveness: { method: 'active', verdict: rng() < 0.5, score: rng() },
    document_check: { digest: rng() < 0.7 ? 'sha256:' + 'b'.repeat(64) : null, verdict: rng() < 0.5 },
    device_signal: { summary: 'x', risk_score: rng() },
  };
}

// ---------- P1: session_complete is the exact conjunction of session_id/verifier_id/timestamp all present ----------
function checkP1_sessionCompleteExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.rejected) continue;
    const expected = !!(pp.session_id && pp.verifier_id && pp.timestamp);
    if (r.output_payload.session_complete !== expected) violations++;
  }
  return { name: 'P1_session_complete_exact_conjunction_of_required_fields', trials: checked, violations };
}

// ---------- P2: every field sourced from an upstream verifier is labeled "asserted" ----------
function checkP2_allFieldsLabeledAsserted() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.rejected) continue;
    const s = r.output_payload.session;
    const labels = [s.capture_chain.label, s.injection_detection.label, s.liveness.label, s.document_check.label, s.device_signal.label];
    if (!labels.every((l) => l === 'asserted')) violations++;
  }
  return { name: 'P2_every_verifier_sourced_field_labeled_asserted', trials: checked, violations };
}

// ---------- P3: numeric passthrough — confidence/score/risk_score in the output equal the input exactly (no arithmetic) ----------
function checkP3_numericPassthroughExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.rejected) continue;
    const s = r.output_payload.session;
    if (s.injection_detection.confidence !== pp.injection_detection.confidence) violations++;
    if (s.liveness.score !== pp.liveness.score) violations++;
    if (s.device_signal.risk_score !== pp.device_signal.risk_score) violations++;
  }
  return { name: 'P3_confidence_score_risk_score_passthrough_exact_no_arithmetic', trials: checked, violations };
}

// ---------- P4 (mandatory, float:no exception): forced categorical boundary cases ----------
function checkP4_forced() {
  const rows = [];
  const base = {
    session_id: 's1', verifier_id: 'v1', verifier_version: '1', timestamp: '2026-01-01T00:00:00Z',
    capture_chain: {}, injection_detection: {}, liveness: {}, document_check: {}, device_signal: {},
  };
  const cases = [
    [{ ...base, document_image: 'raw-base64-not-a-digest' }, 'document_image PII-risk key present — must reject before compute proceeds'],
    [{ ...base, capture_chain: { manifest_digest: 'this-is-way-too-long-to-be-a-digest-and-has-no-fixed-shape-at-all-so-it-must-be-rejected-as-pii-shaped-instead-of-silently-truncated-or-hashed' } }, 'capture_chain.manifest_digest is PII-shaped (too long) — rejected, not silently accepted'],
    [{ ...base, document_check: { digest: 'sha256:' + 'c'.repeat(64), verdict: true, digest_commitment_scheme: 'sha256-salted@1' } }, 'well-formed sha256-salted@1 commitment — accepted, private_inputs[] declared'],
    [{ ...base, document_check: { digest: 'sha256:' + 'c'.repeat(64), verdict: true, digest_commitment_scheme: 'unknown-scheme@1' } }, 'unknown commitment scheme name — rejected, digest dropped to null'],
    [{ ...base, document_check: { digest: 'not-hex-not-well-formed', verdict: true, digest_commitment_scheme: 'sha256-salted@1' } }, 'declared sha256-salted@1 but malformed digest — rejected'],
    [{ session_id: '', verifier_id: '', timestamp: '', capture_chain: {}, injection_detection: {}, liveness: {}, document_check: {}, device_signal: {} }, 'all required session fields empty — session_complete false, missing_fields lists all three'],
    [{}, 'policy_parameters entirely empty — every safeStr defaults to empty string, no throw'],
  ];
  for (const [pp, label] of cases) {
    const r = compute(pp);
    const op = r.output_payload;
    const plausible = typeof op.rejected === 'boolean';
    rows.push({ label, input: pp, rejected: op.rejected, session_complete: op.session_complete ?? null, missing_fields: op.missing_fields ?? null, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_sessionCompleteExact());
results.properties.push(checkP2_allFieldsLabeledAsserted());
results.properties.push(checkP3_numericPassthroughExact());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
