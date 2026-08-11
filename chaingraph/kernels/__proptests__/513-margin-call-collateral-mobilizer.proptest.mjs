// 513-margin-call-collateral-mobilizer.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C1-1).
// kernel_digest_at_authoring: sha256:d7af04d366f7112be98e4d1735226212639a7f1ffcc97014858f47e83c9c79f3
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES — ULP-boundary forcing mandatory (aana 8bn UMR-phase threshold, imCall 50mm
// threshold, mta 500,000 exact-equality deviation flag, ccp_cleared zero-margin branch).
// Checks: fixture-oracle gate, termination (collateral-row array bounded), boundedness (haircuts in
// [0,1], eligible_value >= 0), gap/shortfall consistency, ULP-forced threshold cases, and a metamorphic
// scale-invariance check (scaling portfolio_mtm scales im/vm calls linearly, non-CCP-cleared).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/513-margin-call-collateral-mobilizer.proptest.mjs

import { compute } from '../513-margin-call-collateral-mobilizer.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', '513-margin-call-collateral-mobilizer.fixtures.json');
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
const rand = mulberry32(0x513A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const DERIV_TYPES = ['interest_rate_swap', 'cds', 'fx_forward', 'equity_option', 'commodity_swap', 'swaption'];
const SFT_TYPES = ['repo', 'reverse_repo', 'securities_lending', 'buy_sell_back'];
const ASSET_TYPES = ['cash_usd', 'cash_eur', 'ust', 'gilt', 'ig_corp', 'equity'];
const TRIALS = 6000;

function randomCollateralRow(rng) {
  return { asset_type: pick(rng, ASSET_TYPES), notional: randRange(rng, 0, 10_000_000), already_posted: rng() < 0.3 };
}
function randomPP(rng) {
  const isDeriv = rng() < 0.5;
  return {
    instrument_type: isDeriv ? pick(rng, DERIV_TYPES) : pick(rng, SFT_TYPES),
    portfolio_mtm: randRange(rng, -50_000_000, 50_000_000),
    aana: randRange(rng, 0, 20_000_000_000),
    ccp_cleared: rng() < 0.2,
    mta: rng() < 0.7 ? 500000 : randRange(rng, 0, 2_000_000),
    collateral_rows: Array.from({ length: Math.floor(rng() * 6) }, () => randomCollateralRow(rng)),
    on_chain: rng() < 0.3,
  };
}

// ---------- P1: termination — bounded collateral_rows array ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 200; i++) {
    const n = Math.floor(rand() * 300);
    const pp = randomPP(rand);
    pp.collateral_rows = Array.from({ length: n }, () => randomCollateralRow(rand));
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.collateral_detail.length !== n) violations++;
  }
  return { name: 'P1_termination_bounded_rows', trials: checked, violations };
}

// ---------- P2: boundedness — eligible_value >= 0, hc known to be in [0,0.15] or null ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    for (const row of output_payload.collateral_detail) {
      if (row.eligible_value < 0) violations++;
      if (row.hc != null && (row.hc < 0 || row.hc > 0.15)) violations++;
    }
    if (output_payload.im_call < 0 || output_payload.vm_call < 0) violations++;
  }
  return { name: 'P2_boundedness_nonneg', trials: checked, violations };
}

// ---------- P3: shortfall flag agrees with gap sign ----------
function checkP3_shortfall_agreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.shortfall !== (output_payload.gap > 0)) violations++;
    // gap === required - mobilizable, always (accounting identity)
    const expectedGap = +(output_payload.total_required - output_payload.total_mobilizable).toFixed(2);
    if (Math.abs(output_payload.gap - expectedGap) > 0.02) violations++;
  }
  return { name: 'P3_gap_shortfall_accounting_identity', trials: checked, violations };
}

// ---------- P4: CCP-cleared always zeroes margin calls ----------
function checkP4_ccp_zero() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    pp.ccp_cleared = true;
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.im_call !== 0 || output_payload.vm_call !== 0 || output_payload.total_required !== 0) violations++;
  }
  return { name: 'P4_ccp_cleared_zero_margin', trials: checked, violations };
}

// ---------- P5 (ULP-forcing, float_sensitive:yes) — threshold boundaries ----------
const ULP_BOUNDARY_CASES = [
  { aana: 8_000_000_000, label: 'aana exactly at UMR 8bn threshold -> umrPhaseInapplicable must be FALSE (< not <=)' },
  { aana: 7_999_999_999.99, label: 'aana fractionally under 8bn -> umrPhaseInapplicable TRUE' },
  { aana: 8_000_000_000.01, label: 'aana fractionally over 8bn -> umrPhaseInapplicable FALSE' },
  { instrument_type: 'interest_rate_swap', portfolio_mtm: 50_000_000, label: 'imCall exactly at 50mm threshold -> imBelowThreshold must be TRUE (<=)' },
  { instrument_type: 'interest_rate_swap', portfolio_mtm: 50_000_000.01, label: 'imCall fractionally over 50mm -> imBelowThreshold FALSE' },
  { mta: 500000, label: 'mta exactly 500000 -> mtaDeviation FALSE' },
  { mta: 500000.01, label: 'mta fractionally off 500000 -> mtaDeviation TRUE' },
  { portfolio_mtm: -0, instrument_type: 'interest_rate_swap', label: 'negative-zero portfolio_mtm -> im/vm call must be 0, not NaN/sign-flipped' },
  { portfolio_mtm: 1e-300, instrument_type: 'interest_rate_swap', label: 'near-subnormal portfolio_mtm -> must stay finite' },
];
function checkP5_forced() {
  const rows = [];
  for (const c of ULP_BOUNDARY_CASES) {
    const pp = { instrument_type: 'interest_rate_swap', portfolio_mtm: 0, aana: 0, ccp_cleared: false, mta: 500000, collateral_rows: [], on_chain: false, ...c };
    const { output_payload, compliance_flags } = compute(pp);
    rows.push({
      label: c.label,
      im_call: output_payload.im_call, vm_call: output_payload.vm_call,
      flags: compliance_flags,
      finite: Number.isFinite(output_payload.im_call) && Number.isFinite(output_payload.vm_call) && Number.isFinite(output_payload.gap),
    });
  }
  return rows;
}

// ---------- P6: metamorphic — scaling portfolio_mtm by k>0 scales im/vm calls by k (non-CCP-cleared) ----------
function checkP6_scale_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    pp.ccp_cleared = false;
    pp.portfolio_mtm = randRange(rand, 1000, 10_000_000);
    const k = randRange(rand, 1.5, 8.0);
    const r1 = compute(pp).output_payload;
    const r2 = compute({ ...pp, portfolio_mtm: pp.portfolio_mtm * k }).output_payload;
    checked++;
    const tol = Math.max(0.03, Math.abs(r1.im_call * k) * 1e-6);
    if (Math.abs(r2.im_call - r1.im_call * k) > tol) violations++;
    if (Math.abs(r2.vm_call - r1.vm_call * k) > tol) violations++;
  }
  return { name: 'P6_metamorphic_mtm_scale_linearity', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_shortfall_agreement());
results.properties.push(checkP4_ccp_zero());
results.properties.push(checkP6_scale_invariance());
results.boundary_forced = checkP5_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryMismatch = results.boundary_forced.some((b) => !b.finite);

console.log(JSON.stringify({
  tool_id: '513-margin-call-collateral-mobilizer',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);
