// art-303-aiuc1-control-evidence-linter.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C10-1).
// kernel_digest_at_authoring: sha256:6f0ccad9827533502bb1df8c0b7beedc187822ea5f7bf07363637c00336b8f21
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — overall_coverage and per_pillar_coverage are rational fractions over
// small fixed integer denominators (23 controls total, 2-4 per pillar); confirmed by direct
// read, no rounding or user-controlled magnitude reaches the division.
// Checks: fixture-oracle gate, boundedness (per_control.length fixed at 23 when version
// matches, counts sum to 23), differential re-derivation of overall_coverage and
// per_pillar_coverage from the per-control statuses, and metamorphic irrelevant-input
// invariance (control_evidence entries for control_ids outside the 23-item catalog never
// change the output).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-303-aiuc1-control-evidence-linter.proptest.mjs

import { compute, AUTOMATABLE_CONTROLS, CATALOG_VERSION } from '../art-303-aiuc1-control-evidence-linter.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-303-aiuc1-control-evidence-linter.fixtures.json');
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
const rand = mulberry32(0x303A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomEvidenceEntry(rng) {
  const r = rng();
  if (r < 0.3) return undefined; // no entry for this control -> missing
  if (r < 0.6) return { control_id: '', evidence: [{ type: 'attestation' }] }; // attestation-only
  return { control_id: '', evidence: [{ type: 'receipt', receipt_hash: 'sha256:' + 'a'.repeat(64) }] }; // receipt-backed
}
function randomControlEvidence(rng) {
  const arr = [];
  for (const c of AUTOMATABLE_CONTROLS) {
    const entry = randomEvidenceEntry(rng);
    if (entry) { entry.control_id = c.control_id; arr.push(entry); }
  }
  return arr;
}

const TRIALS = 5000;

// ---------- P1: boundedness — per_control.length fixed at 23, counts sum to 23 ----------
function checkP1_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const control_evidence = randomControlEvidence(rand);
    const { output_payload } = compute({ aiuc1_version: CATALOG_VERSION, control_evidence });
    checked++;
    if (output_payload.per_control.length !== AUTOMATABLE_CONTROLS.length) violations++;
    if (output_payload.receipt_backed_count + output_payload.attestation_only_count + output_payload.missing_count !== AUTOMATABLE_CONTROLS.length) violations++;
  }
  return { name: 'P1_per_control_fixed_and_counts_sum_to_23', trials: checked, violations };
}

// ---------- P2 (differential): overall_coverage + per_pillar_coverage re-derived ----------
function checkP2_coverage_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const control_evidence = randomControlEvidence(rand);
    const { output_payload } = compute({ aiuc1_version: CATALOG_VERSION, control_evidence });
    checked++;
    const expectedOverall = (output_payload.receipt_backed_count + 0.5 * output_payload.attestation_only_count) / AUTOMATABLE_CONTROLS.length;
    if (output_payload.overall_coverage !== expectedOverall) violations++;

    const pillarTotals = {}, pillarScores = {};
    for (const c of AUTOMATABLE_CONTROLS) { pillarTotals[c.pillar] = (pillarTotals[c.pillar] || 0) + 1; pillarScores[c.pillar] = 0; }
    for (const row of output_payload.per_control) {
      if (row.status === 'receipt-backed') pillarScores[row.pillar] += 1;
      else if (row.status === 'attestation-only') pillarScores[row.pillar] += 0.5;
    }
    for (const pillar of Object.keys(pillarTotals)) {
      const expected = pillarScores[pillar] / pillarTotals[pillar];
      if (output_payload.per_pillar_coverage[pillar] !== expected) violations++;
    }
  }
  return { name: 'P2_coverage_fractions_differential', trials: checked, violations };
}

// ---------- P3: version mismatch — automatable_scope stays 23, per_control empty ----------
function checkP3_version_mismatch_shape() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const control_evidence = randomControlEvidence(rand);
    const { output_payload } = compute({ aiuc1_version: 'not-a-real-version', control_evidence });
    checked++;
    if (output_payload.automatable_scope !== AUTOMATABLE_CONTROLS.length) violations++;
    if (output_payload.per_control.length !== 0) violations++;
    if (output_payload.version_mismatch !== true) violations++;
  }
  return { name: 'P3_version_mismatch_shape_bounded', trials: checked, violations };
}

// ---------- P4: metamorphic — evidence for out-of-catalog control_ids never affects output ----------
function checkP4_irrelevant_input_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const control_evidence = randomControlEvidence(rand);
    const noisyExtra = { control_id: 'AIUC-Z-99-NOT-IN-CATALOG', evidence: [{ type: 'receipt', receipt_hash: 'sha256:' + 'b'.repeat(64) }] };
    const r1 = compute({ aiuc1_version: CATALOG_VERSION, control_evidence }).output_payload;
    const r2 = compute({ aiuc1_version: CATALOG_VERSION, control_evidence: control_evidence.concat([noisyExtra]) }).output_payload;
    checked++;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
  }
  return { name: 'P4_out_of_catalog_control_ids_are_irrelevant', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_bounded());
results.properties.push(checkP2_coverage_differential());
results.properties.push(checkP3_version_mismatch_shape());
results.properties.push(checkP4_irrelevant_input_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-303-aiuc1-control-evidence-linter',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
