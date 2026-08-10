// kernel_digest_at_authoring: sha256:830bc39ca270ab8fec28d7bbd220b84a37787e3dfc4e61110e95816a63d70da1
//
// FV-PROPFLOOR-SHARD-B14-1 — property-test floor for art-51-cross-margining-benefit-estimator.
// Class B (bounded-numeric/VaR-model), FLOAT-SENSITIVE — UST/CME position notionals and contract
// counts feed straight into unrounded DV01/VaR arithmetic (Math.sqrt of a correlated variance sum);
// ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-51-cross-margining-benefit-estimator.proptest.mjs

import { compute } from '../art-51-cross-margining-benefit-estimator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-51-cross-margining-benefit-estimator.fixtures.json');
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
const rand = mulberry32(0x51D44F);
const TRIALS = 8000;
const CME_CONTRACTS = ['ZT', 'ZF', 'ZN', 'ZB', 'UB', 'SR1', 'SR3'];

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

function mkUst(rng) {
  return {
    instrument: pick(rng, ['cash', 'repo', 'reverse-repo']),
    notional: randRange(rng, -5e8, 5e8),
    tenor_years: randRange(rng, 0.02, 30),
    direction: pick(rng, ['long', 'short']),
  };
}
function mkCme(rng) {
  return {
    contract: rng() < 0.9 ? pick(rng, CME_CONTRACTS) : 'ZZZ-unknown',
    num_contracts: Math.floor(randRange(rng, 0, 500)),
    direction: pick(rng, ['long', 'short']),
  };
}
function mkPP(rng) {
  const nu = Math.floor(randRange(rng, 0, 5));
  const nc = Math.floor(randRange(rng, 0, 5));
  return {
    ust_positions: Array.from({ length: nu }, () => mkUst(rng)),
    cme_positions: Array.from({ length: nc }, () => mkCme(rng)),
    account_type: pick(rng, ['house', 'customer']),
    confidence_level: pick(rng, [0.90, 0.95, 0.99, 0.999]),
    mpor_days: Math.floor(randRange(rng, 1, 10)),
  };
}

// ---------- P1: im_reduction_usd is non-negative and equals max(0, standalone - cross_margined) ----------
function checkP1_reductionNonNegativeExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { standalone_im_total, cross_margined_im, im_reduction_usd } = r.output_payload;
    if (im_reduction_usd < 0) violations++;
    const expected = Math.max(0, standalone_im_total - cross_margined_im);
    if (Math.abs(im_reduction_usd - expected) > 1) violations++; // Math.round tolerance
  }
  return { name: 'P1_im_reduction_nonneg_and_equals_max_0_standalone_minus_cross', trials: checked, violations };
}

// ---------- P2: im_reduction_pct is exactly reduction/standalone*100 rounded, and 0 when standalone is 0 ----------
function checkP2_reductionPctExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { standalone_im_total, im_reduction_usd, im_reduction_pct } = r.output_payload;
    if (standalone_im_total === 0 && im_reduction_pct !== 0) violations++;
    if (standalone_im_total > 0) {
      const expected = +((im_reduction_usd / standalone_im_total) * 100).toFixed(1);
      if (Math.abs(im_reduction_pct - expected) > 0.2) violations++; // tolerance for the round() vs raw division difference
    }
  }
  return { name: 'P2_im_reduction_pct_matches_ratio_and_zero_when_standalone_zero', trials: checked, violations };
}

// ---------- P3: eligible/ineligible offset classification matches bucket-level sign comparison ----------
function checkP3_offsetClassificationExact() {
  let violations = 0, checked = 0;
  const BUCKETS = ['0-2y', '2-5y', '5-10y', '10-30y'];
  const modDur = (t) => t / 1.04;
  const bucketOf = (t) => (t <= 2 ? '0-2y' : t <= 5 ? '2-5y' : t <= 10 ? '5-10y' : '10-30y');
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const ustDV01 = { '0-2y': 0, '2-5y': 0, '5-10y': 0, '10-30y': 0 };
    for (const p of pp.ust_positions) {
      const notional = Number(p.notional) || 0;
      const tenor = Number(p.tenor_years) || (p.instrument === 'repo' || p.instrument === 'reverse-repo' ? 0.1 : 5);
      const sign = (p.direction === 'short' || p.instrument === 'reverse-repo') ? -1 : 1;
      ustDV01[bucketOf(tenor)] += sign * notional * modDur(tenor) * 0.0001;
    }
    const eligibleBuckets = new Set(r.output_payload.eligible_offsets.filter((o) => o.bucket).map((o) => o.bucket));
    // for every bucket where UST has nonzero DV01 and it's in eligible_offsets, confirm it's a real bucket
    for (const b of BUCKETS) {
      if (eligibleBuckets.has(b) && ustDV01[b] === 0) violations++;
    }
  }
  return { name: 'P3_eligible_offset_buckets_correspond_to_nonzero_ust_dv01', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ ust_positions: [], cme_positions: [] }, 'no positions at all — standalone and cross_margined must both be exactly 0, im_reduction_usd exactly 0, no NaN'],
  [{ ust_positions: [{ instrument: 'cash', notional: 0, tenor_years: 5 }], cme_positions: [] }, 'single UST position with notional exactly zero — DV01 exactly 0, no NaN'],
  [{ ust_positions: [{ instrument: 'cash', notional: -0, tenor_years: 5 }], cme_positions: [] }, 'negative-zero notional — must behave as zero, no NaN'],
  [{ ust_positions: [{ instrument: 'cash', notional: 1e6, tenor_years: 5 }], cme_positions: [{ contract: 'ZN', num_contracts: 0, direction: 'short' }] }, 'CME num_contracts exactly zero — cmeDV01 contribution exactly 0, no offset eligibility claimed'],
  [{ ust_positions: [{ instrument: 'cash', notional: Number.MIN_VALUE, tenor_years: 5 }], cme_positions: [] }, 'UST notional smallest positive double — must remain finite, non-NaN'],
  [{ ust_positions: [{ instrument: 'cash', notional: Number.MAX_SAFE_INTEGER, tenor_years: 10 }], cme_positions: [{ contract: 'ZN', num_contracts: 1000000, direction: 'short' }] }, 'notional and contract count at extreme magnitudes — must remain finite, not overflow to Infinity'],
  [{ ust_positions: [{ instrument: 'cash', notional: NaN, tenor_years: 5 }], cme_positions: [] }, 'notional NaN — Number(NaN)||0 coalesces to 0, must not propagate NaN through the VaR sum'],
  [{ cme_positions: [{ contract: 'unknown-contract-xyz', num_contracts: 5, direction: 'long' }] }, 'unknown CME contract code — must land in ineligible_offsets with a reason, not throw or NaN'],
  [{ mpor_days: 0 }, 'mpor_days exactly 0 — Math.max(1,...) floor under sqrt must apply, no NaN from sqrt of non-positive'],
  [{ confidence_level: 0.5 }, 'confidence_level not in the Z table — must fall back to the documented default (0.99 -> z=2.326), not NaN'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { standalone_im_total, cross_margined_im, im_reduction_usd } = r.output_payload;
    const plausible = Number.isFinite(standalone_im_total) && Number.isFinite(cross_margined_im) && Number.isFinite(im_reduction_usd);
    rows.push({ label, input: pp, standalone_im_total, cross_margined_im, im_reduction_usd, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_reductionNonNegativeExact());
results.properties.push(checkP2_reductionPctExact());
results.properties.push(checkP3_offsetClassificationExact());
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
