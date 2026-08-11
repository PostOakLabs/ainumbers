// art-307-claim-dispute-bundle-builder.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C11-1).
// kernel_digest_at_authoring: sha256:1daef6202ad1566e6f94d6f395e4e645e4d15288589e2864a84c2c2e33415211
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (measuredAggregate averages numbers but comparisons are plain > / <
// against a caller threshold, no ULP-boundary claim made or needed — forced categorical
// boundary cases used instead, per direct source read).
// Checks: fixture-oracle gate, termination (validReceipts/kpi_breach bounded by input array
// length), differential re-derivation of claim_strength and kpi_breach.breached, boundedness
// (output receipts is a subset of input claim_receipts), and metamorphic append-invariance.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-307-claim-dispute-bundle-builder.proptest.mjs

import { compute } from '../art-307-claim-dispute-bundle-builder.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-307-claim-dispute-bundle-builder.fixtures.json');
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
const rand = mulberry32(0x307A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomReceipts(rng, n, validRatio) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(rng() < validRatio ? { receipt_hash: `rh-${i}-${Math.floor(rng() * 1e6)}` } : { receipt_hash: pick(rng, ['', null, undefined]) });
  }
  return out;
}

function randomPP(rng) {
  const hasClaim = rng() < 0.7;
  const n = Math.floor(rng() * 10);
  const validRatio = pick(rng, [0, 0.3, 0.6, 1]);
  const receipts = randomReceipts(rng, n, validRatio);
  const execution_claim = hasClaim
    ? { execution_hash: rng() < 0.9 ? `hash-${Math.floor(rng() * 1e6)}` : null, tool_id: 'art-999', receipts }
    : null;
  const hasChallenge = rng() < 0.4;
  const challenge = hasChallenge ? { digest: `chal-${Math.floor(rng() * 1e6)}` } : null;
  const hasWarranty = rng() < 0.5;
  const kn = Math.floor(rng() * 6);
  const kpiReceipts = [];
  for (let i = 0; i < kn; i++) kpiReceipts.push(rng() < 0.8 ? { measured_metric: (rng() - 0.5) * 200 } : { measured_metric: 'not-a-number' });
  const warranty_kpi_breach = hasWarranty
    ? { kpi: 'defect_rate', threshold: (rng() - 0.5) * 100, direction: pick(rng, ['above', 'below']), receipts: kpiReceipts }
    : undefined;
  return { execution_claim, challenge, warranty_kpi_breach };
}

const TRIALS = 5000;

// ---------- P1: termination — validReceipts/output.receipts bounded by input claim_receipts.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const inputLen = pp.execution_claim && Array.isArray(pp.execution_claim.receipts) ? pp.execution_claim.receipts.length : 0;
    if (output_payload.receipts.length > inputLen) violations++;
  }
  return { name: 'P1_termination_receipts_bounded_by_input_length', trials: checked, violations };
}

// ---------- P2 (differential): claim_strength re-derivation ----------
function checkP2_claim_strength_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const claimReceipts = pp.execution_claim && Array.isArray(pp.execution_claim.receipts) ? pp.execution_claim.receipts : [];
    const digest = pp.execution_claim && typeof pp.execution_claim.execution_hash === 'string' ? pp.execution_claim.execution_hash : null;
    const validN = claimReceipts.filter((r) => r && typeof r.receipt_hash === 'string' && r.receipt_hash.length > 0).length;
    let expected;
    if (!digest) expected = 'missing';
    else if (validN > 0 && validN === claimReceipts.length) expected = 'receipt-backed';
    else expected = 'attestation-only';
    if (output_payload.bundle_claim_strength !== expected) violations++;
  }
  return { name: 'P2_claim_strength_differential', trials: checked, violations };
}

// ---------- P3 (differential): kpi_breach.breached re-derivation ----------
function checkP3_kpi_breach_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const warranty = pp.warranty_kpi_breach;
    if (!warranty || typeof warranty.kpi !== 'string' || typeof warranty.threshold !== 'number') {
      if (output_payload.kpi_breach !== null) violations++;
      continue;
    }
    const vals = (warranty.receipts || []).map((r) => r && r.measured_metric).filter((v) => typeof v === 'number' && Number.isFinite(v));
    const measured = vals.length === 0 ? null : vals.reduce((a, b) => a + b, 0) / vals.length;
    const direction = warranty.direction === 'above' ? 'above' : 'below';
    const breached = measured === null ? false : (direction === 'below' ? measured < warranty.threshold : measured > warranty.threshold);
    if (!output_payload.kpi_breach || output_payload.kpi_breach.breached !== breached) violations++;
  }
  return { name: 'P3_kpi_breach_differential', trials: checked, violations };
}

// ---------- P4: boundedness — every output.receipts element is in input claim_receipts and has a valid hash ----------
function checkP4_receipts_subset() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const claimReceipts = pp.execution_claim && Array.isArray(pp.execution_claim.receipts) ? pp.execution_claim.receipts : [];
    for (const r of output_payload.receipts) {
      if (typeof r.receipt_hash !== 'string' || r.receipt_hash.length === 0) violations++;
      if (!claimReceipts.includes(r)) violations++;
    }
  }
  return { name: 'P4_output_receipts_subset_of_input', trials: checked, violations };
}

// ---------- P5: metamorphic — appending an invalid receipt never increases output.receipts and never flips claim_strength favorably ----------
function checkP5_append_invalid_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    if (!pp.execution_claim) continue;
    const base = pp.execution_claim.receipts || [];
    const r1 = compute(pp).output_payload;
    const extended = { ...pp, execution_claim: { ...pp.execution_claim, receipts: [...base, { receipt_hash: '' }] } };
    const r2 = compute(extended).output_payload;
    checked++;
    // appending an invalid receipt can never add to the valid-receipts output
    if (r2.receipts.length !== r1.receipts.length) violations++;
    // and can never move claim_strength from 'missing' to something else, or leave
    // 'receipt-backed' unaffected by a newly-invalid receipt (must drop to attestation-only)
    if (r1.bundle_claim_strength === 'missing' && r2.bundle_claim_strength !== 'missing') violations++;
    if (r1.bundle_claim_strength === 'receipt-backed' && r2.bundle_claim_strength !== 'attestation-only') violations++;
  }
  return { name: 'P5_append_invalid_receipt_metamorphic', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_claim_strength_differential());
results.properties.push(checkP3_kpi_breach_differential());
results.properties.push(checkP4_receipts_subset());
results.properties.push(checkP5_append_invalid_metamorphic());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-307-claim-dispute-bundle-builder',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
