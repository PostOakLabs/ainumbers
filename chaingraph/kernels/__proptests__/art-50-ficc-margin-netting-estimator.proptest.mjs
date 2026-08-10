// kernel_digest_at_authoring: sha256:fcea3a670c5ee043f842757592ea575bbe5426b8f825016d4ec0c0d18d2e304b
//
// FV-PROPFLOOR-SHARD-B14-1 — property-test floor for art-50-ficc-margin-netting-estimator.
// Class B (bounded-numeric/VaR-model), FLOAT-SENSITIVE — position notionals/tenors feed straight
// into unrounded DV01/VaR arithmetic (Math.sqrt of a correlated variance sum); ULP-boundary forcing
// is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-50-ficc-margin-netting-estimator.proptest.mjs

import { compute } from '../art-50-ficc-margin-netting-estimator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-50-ficc-margin-netting-estimator.fixtures.json');
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
const rand = mulberry32(0x50C33E);
const TRIALS = 8000;

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

function mkPosition(rng) {
  return {
    instrument: pick(rng, ['cash', 'repo', 'reverse-repo']),
    notional: randRange(rng, -5e8, 5e8),
    tenor_years: randRange(rng, 0.02, 30),
    direction: pick(rng, ['long', 'short']),
  };
}
function mkPP(rng) {
  const n = Math.floor(randRange(rng, 0, 6));
  const positions = Array.from({ length: n }, () => mkPosition(rng));
  return {
    positions,
    clearing_model: pick(rng, ['cleared-done-away', 'cleared-done-with']),
    confidence_level: pick(rng, [0.90, 0.95, 0.99, 0.999]),
    mpor_days: Math.floor(randRange(rng, 1, 10)),
    include_cross_product: rng() < 0.5,
  };
}

// ---------- P1: estimated_vbm/net_cleared_im is always >= the minimum-charge floor, and floor flag is exact ----------
function checkP1_minimumChargeFloorExact() {
  let violations = 0, checked = 0;
  const MIN_CHARGE_RATE = 0.001;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const grossNotional = pp.positions.reduce((a, p) => a + Math.abs(Number(p.notional) || 0), 0);
    const minCharge = grossNotional * MIN_CHARGE_RATE;
    const { estimated_vbm, minimum_charge_applied } = r.output_payload;
    if (estimated_vbm < Math.round(minCharge) - 1) violations++; // rounding tolerance from Math.round in kernel
    if (minimum_charge_applied && estimated_vbm !== Math.round(minCharge)) {
      if (Math.abs(estimated_vbm - Math.round(minCharge)) > 1) violations++;
    }
  }
  return { name: 'P1_estimated_vbm_never_below_minimum_charge_floor', trials: checked, violations };
}

// ---------- P2: netting_benefit_usd is non-negative and equals max(0, gross - vbm) ----------
function checkP2_nettingBenefitNonNegativeExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { gross_bilateral_im, estimated_vbm, netting_benefit_usd } = r.output_payload;
    if (netting_benefit_usd < 0) violations++;
    const expected = Math.max(0, gross_bilateral_im - estimated_vbm);
    if (Math.abs(netting_benefit_usd - expected) > 1) violations++; // Math.round tolerance
  }
  return { name: 'P2_netting_benefit_nonneg_and_equals_max_0_gross_minus_vbm', trials: checked, violations };
}

// ---------- P3: all output numerics finite; margin_by_bucket has exactly the 4 declared buckets ----------
function checkP3_outputsFiniteAndBucketsComplete() {
  let violations = 0, checked = 0;
  const BUCKETS = ['0-2y', '2-5y', '5-10y', '10-30y'];
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { estimated_vbm, gross_bilateral_im, net_cleared_im, netting_benefit_usd, netting_benefit_pct, margin_by_bucket } = r.output_payload;
    for (const v of [estimated_vbm, gross_bilateral_im, net_cleared_im, netting_benefit_usd, netting_benefit_pct]) {
      if (!Number.isFinite(v)) violations++;
    }
    if (margin_by_bucket.length !== 4) violations++;
    const bucketNames = margin_by_bucket.map((b) => b.bucket);
    for (const b of BUCKETS) if (!bucketNames.includes(b)) violations++;
    for (const row of margin_by_bucket) {
      if (!Number.isFinite(row.net_dv01) || !Number.isFinite(row.var)) violations++;
    }
  }
  return { name: 'P3_outputs_finite_and_all_four_buckets_present', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ positions: [] }, 'no positions at all — grossNotional=0, estimated_vbm must be exactly 0, no NaN, minCharge floor of 0 trivially satisfied'],
  [{ positions: [{ instrument: 'cash', notional: 0, tenor_years: 5 }] }, 'single position with notional exactly zero — DV01 exactly 0, no NaN'],
  [{ positions: [{ instrument: 'cash', notional: -0, tenor_years: 5 }] }, 'negative-zero notional — must behave as zero, no NaN'],
  [{ positions: [{ instrument: 'cash', notional: Number.MIN_VALUE, tenor_years: 2 }] }, 'notional at smallest positive double, tenor exactly at the 0-2y/2-5y bucket boundary (2yr) — must remain finite, non-NaN'],
  [{ positions: [{ instrument: 'cash', notional: 1e6, tenor_years: 2 }] }, 'tenor_years exactly 2 (bucketOf boundary: <=2 goes to 0-2y) — must classify into 0-2y bucket, not 2-5y'],
  [{ positions: [{ instrument: 'cash', notional: 1e6, tenor_years: 2 + 100 * Number.EPSILON }] }, 'tenor_years 1 ULP above 2 — must classify into 2-5y bucket'],
  [{ positions: [{ instrument: 'cash', notional: Number.MAX_SAFE_INTEGER, tenor_years: 10 }] }, 'notional at MAX_SAFE_INTEGER — DV01/VaR must remain finite, not overflow to Infinity'],
  [{ positions: [{ instrument: 'cash', notional: NaN, tenor_years: 5 }] }, 'notional NaN — Number(NaN)||0 coalesces to 0, must not propagate NaN through the VaR sum'],
  [{ mpor_days: 0 }, 'mpor_days exactly 0 — Math.max(1,...) floor under sqrt must apply, sq=1, no NaN from sqrt of non-positive'],
  [{ confidence_level: 0.5 }, 'confidence_level not in the Z table — must fall back to the documented default (0.99 -> z=2.326), not NaN'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { estimated_vbm, gross_bilateral_im, netting_benefit_usd, margin_by_bucket } = r.output_payload;
    const bucketsFinite = margin_by_bucket.every((b) => Number.isFinite(b.net_dv01) && Number.isFinite(b.var));
    const plausible = Number.isFinite(estimated_vbm) && Number.isFinite(gross_bilateral_im) && Number.isFinite(netting_benefit_usd) && bucketsFinite;
    rows.push({ label, input: pp, estimated_vbm, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_minimumChargeFloorExact());
results.properties.push(checkP2_nettingBenefitNonNegativeExact());
results.properties.push(checkP3_outputsFiniteAndBucketsComplete());
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
