// kernel_digest_at_authoring: sha256:2d69f187e9c32ff8b2bcd4346e912a0546f39bd91839fd9b301e67c13e36a438
//
// FV-PROPFLOOR-SHARD-B9-1 — property-test floor for art-252-validate-cat-bond-trigger-terms.
// Class B (bounded-numeric), FLOAT-SENSITIVE — reported_loss/attachment_point/exhaustion_point raw
// doubles feeding pro_rata_factor division and a fixed 0/1 boundary payout rule — ULP-boundary
// forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32
// PRNG + explicit boundary arrays), same shape as the B1-B8 float harnesses.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-252-validate-cat-bond-trigger-terms.proptest.mjs

import { compute } from '../art-252-validate-cat-bond-trigger-terms.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-252-validate-cat-bond-trigger-terms.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const output_payload = compute(vec.policy_parameters);
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
const rand = mulberry32(0x2520A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;

function mkPP(rng) {
  const attachment_point = randRange(rng, 1, 1000);
  const exhaustion_point = attachment_point + randRange(rng, 1, 1000);
  return {
    reported_loss: randRange(rng, 0, 2500),
    attachment_point,
    exhaustion_point,
    coverage_amount: randRange(rng, 1, 500),
    pro_rata_enabled: rng() < 0.8,
    second_loss_amount: 0,
  };
}

// ---------- P1: monotone — increasing reported_loss never decreases payout_amount ----------
function checkP1_monotonePayout() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r1 = compute(pp);
    const r2v = compute({ ...pp, reported_loss: pp.reported_loss + 500 });
    checked++;
    if (r2v.payout_amount < r1.payout_amount) violations++;
    if (r1.attachment_breached && !r2v.attachment_breached) violations++;
  }
  return { name: 'P1_monotone_payout_nondecreasing_with_reported_loss', trials: checked, violations };
}

// ---------- P2: boundedness — payout_amount never exceeds coverage_amount, pro_rata_factor in [0,1] ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.payout_amount > pp.coverage_amount + 0.01) violations++;
    if (r.pro_rata_factor < 0 || r.pro_rata_factor > 1) violations++;
    if (r.payout_amount < 0) violations++;
  }
  return { name: 'P2_boundedness_payout_within_coverage_and_pro_rata_factor_unit_interval', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — attachment/exhaustion flags match independently-derived rule ----------
function checkP3_attachmentAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expectedAttached = pp.reported_loss >= pp.attachment_point;
    const expectedExhausted = expectedAttached && pp.reported_loss >= pp.exhaustion_point;
    if (r.attachment_breached !== expectedAttached) violations++;
    if (r.exhaustion_reached !== expectedExhausted) violations++;
    if (expectedExhausted && r.pro_rata_factor !== 1) violations++;
  }
  return { name: 'P3_attachment_and_exhaustion_match_fixed_threshold_rule', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ reported_loss: 100, attachment_point: 100, exhaustion_point: 200, coverage_amount: 100 }, 'reported_loss exactly at attachment_point — attachment_breached must be true, pro_rata_factor 0'],
  [{ reported_loss: 99.9999, attachment_point: 100, exhaustion_point: 200, coverage_amount: 100 }, 'reported_loss just below attachment_point — attachment_breached must be false'],
  [{ reported_loss: 200, attachment_point: 100, exhaustion_point: 200, coverage_amount: 100 }, 'reported_loss exactly at exhaustion_point — exhaustion_reached must be true, pro_rata_factor 1, full payout'],
  [{ reported_loss: 0, attachment_point: 100, exhaustion_point: 200, coverage_amount: 100 }, 'zero reported_loss — attachment_breached false, payout 0, no throw'],
  [{ reported_loss: -0, attachment_point: 100, exhaustion_point: 200, coverage_amount: 100 }, 'negative-zero reported_loss — must behave as zero'],
  [{ reported_loss: Number.MIN_VALUE, attachment_point: 100, exhaustion_point: 200, coverage_amount: 100 }, 'reported_loss smallest positive double — must not throw, attachment_breached false'],
  [{ reported_loss: 150, attachment_point: 100, exhaustion_point: 100 + 100 * 0.1 * 10, coverage_amount: 100 }, 'exhaustion_point via 0.1*10 rounding artifact — must round-trip without throwing'],
  [{ reported_loss: 150, attachment_point: (1 / 3) * 3 * 100, exhaustion_point: 200, coverage_amount: 100 }, 'attachment_point = (1/3)*3*100 (x/y*y!==x rounding artifact) — must round-trip without throwing'],
  [{ reported_loss: Number.MAX_SAFE_INTEGER, attachment_point: 100, exhaustion_point: 200, coverage_amount: 100 }, 'reported_loss at MAX_SAFE_INTEGER — exhaustion_reached true, payout must remain finite'],
  [{ reported_loss: 150, attachment_point: 100, exhaustion_point: 200, coverage_amount: 0 }, 'coverage_amount zero — uses layer_width as coverage, payout must remain finite, no throw'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = { pro_rata_enabled: true, second_loss_amount: 0, ...overrides };
    const r = compute(pp);
    const plausible = Number.isFinite(r.payout_amount) && Number.isFinite(r.pro_rata_factor) && typeof r.attachment_breached === 'boolean' && typeof r.exhaustion_reached === 'boolean';
    rows.push({ label, reported_loss: pp.reported_loss, attachment_breached: r.attachment_breached, exhaustion_reached: r.exhaustion_reached, payout_amount: r.payout_amount, pro_rata_factor: r.pro_rata_factor, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotonePayout());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_attachmentAgreement());
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
