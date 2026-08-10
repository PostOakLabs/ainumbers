// kernel_digest_at_authoring: sha256:3eb8ae80e279ce36b74155e260a9f47adda9dd53dc62f3668ff6dd3a1e90b295
//
// FV-PROPFLOOR-SHARD-B24-1 — property-test floor for art-436-bhc-schedule-hcr-capital.
// Class B (bounded-numeric), FLOAT-SENSITIVE (capital/RWA/leverage-exposure USD amounts feed
// unrounded ratio division, compared against threshold minimums) — ULP-boundary forcing is
// MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-436-bhc-schedule-hcr-capital.proptest.mjs

import { compute } from '../art-436-bhc-schedule-hcr-capital.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-436-bhc-schedule-hcr-capital.fixtures.json');
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
const rand = mulberry32(0x436C3);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function rngPositive(rng) { return 0.01 + rng() * 2; }
const TRIALS = 10000;

function mkPP(rng) {
  const cet1 = randRange(rng, 1e6, 1e11);
  const at1 = randRange(rng, 0, 1e10);
  const tier2 = randRange(rng, 0, 5e10);
  const rwa = randRange(rng, 1e7, 1e12);
  const lev = randRange(rng, 1e7, 1e12);
  return {
    entity_id: 'X', reporting_period: '2026-03-31', constants_version: 'v1',
    is_gsib: rng() < 0.5,
    cet1_capital_usd: cet1, additional_tier1_capital_usd: at1, tier2_capital_usd: tier2,
    total_rwa_usd: rwa, total_leverage_exposure_usd: lev,
  };
}

// ---------- P1: fixed-threshold-tier agreement — each *_pass flag exactly matches ratio >= min ----------
function checkP1_thresholdAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const rt = r.ratios;
    if (rt.cet1_pass !== (rt.cet1_ratio_pct >= rt.cet1_min_pct)) violations++;
    if (rt.tier1_pass !== (rt.tier1_ratio_pct >= rt.tier1_min_pct)) violations++;
    if (rt.total_capital_pass !== (rt.total_capital_ratio_pct >= rt.total_capital_min_pct)) violations++;
    if (rt.slr_pass !== (rt.supplementary_leverage_ratio_pct >= rt.slr_min_pct)) violations++;
  }
  return { name: 'P1_threshold_tier_agreement_pass_flags_match_ratio_vs_min', trials: checked, violations };
}

// ---------- P2: monotonicity — increasing total_rwa_usd never increases the RWA-denominated ratios ----------
function checkP2_rwaMonotone() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r1 = compute(pp).output_payload.ratios;
    const pp2 = { ...pp, total_rwa_usd: pp.total_rwa_usd * (1 + rngPositive(rand)) };
    const r2v = compute(pp2).output_payload.ratios;
    checked++;
    if (r2v.cet1_ratio_pct > r1.cet1_ratio_pct) violations++;
    if (r2v.tier1_ratio_pct > r1.tier1_ratio_pct) violations++;
    if (r2v.total_capital_ratio_pct > r1.total_capital_ratio_pct) violations++;
  }
  return { name: 'P2_ratios_nonincreasing_as_rwa_denominator_grows', trials: checked, violations };
}

// ---------- P3: fixed rule — total_capital_usd is exactly r2(tier1+tier2), tier1 defaults to cet1+at1 ----------
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }
function checkP3_totalCapitalExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const expectedTier1 = pp.cet1_capital_usd + pp.additional_tier1_capital_usd;
    const expectedTotal = r2(expectedTier1 + pp.tier2_capital_usd);
    if (r.total_capital_usd !== expectedTotal) violations++;
    if (r.tier1_capital_usd !== r2(expectedTier1)) violations++;
  }
  return { name: 'P3_total_capital_exact_r2_tier1_plus_tier2', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const BASE = { entity_id: 'X', reporting_period: '2026-03-31', constants_version: 'v1', is_gsib: false,
  cet1_capital_usd: 100, additional_tier1_capital_usd: 0, tier2_capital_usd: 0,
  total_rwa_usd: 1000, total_leverage_exposure_usd: 1000 };
const ULP_BOUNDARY_CASES = [
  [{ ...BASE, total_rwa_usd: 0 }, 'total_rwa_usd exactly zero — pct() zero-denominator branch, ratio must be 0 not NaN/Infinity'],
  [{ ...BASE, total_rwa_usd: -0 }, 'total_rwa_usd negative zero — must not trip the >0 denominator gate, ratio 0'],
  [{ ...BASE, cet1_capital_usd: 100, total_rwa_usd: 100 / 0.045 }, 'cet1_ratio_pct at exactly the 4.5% minimum — cet1_pass must be true (>=, not >)'],
  [{ ...BASE, cet1_capital_usd: 100 - Number.EPSILON * 100, total_rwa_usd: 100 / 0.045 }, 'cet1_ratio_pct 1 ULP below the minimum — cet1_pass must flip to false'],
  [{ ...BASE, cet1_capital_usd: Number.MIN_VALUE, total_rwa_usd: 1 }, 'cet1_capital_usd smallest positive double — ratio finite, non-NaN'],
  [{ ...BASE, cet1_capital_usd: Number.MAX_SAFE_INTEGER, total_rwa_usd: 1 }, 'cet1_capital_usd at MAX_SAFE_INTEGER — no overflow to Infinity'],
  [{ ...BASE, cet1_capital_usd: 0.1, additional_tier1_capital_usd: 0.2, total_rwa_usd: 1 }, 'classic 0.1+0.2 rounding artifact feeding tier1 default sum'],
  [{ ...BASE, is_gsib: true, cet1_capital_usd: 100, total_rwa_usd: 1000, total_leverage_exposure_usd: 100 / 0.05 }, 'GSIB eSLR: SLR exactly at required 5% (3%+2% buffer) — eslr pass must be true'],
  [{ ...BASE, is_gsib: true, cet1_capital_usd: 100, total_rwa_usd: 1000, total_leverage_exposure_usd: (100 / 0.05) * (1 + 1e-9) }, 'GSIB eSLR: SLR 1 ULP-scale below required 5% — eslr pass must flip false'],
  [{ ...BASE, total_leverage_exposure_usd: 0 }, 'total_leverage_exposure_usd exactly zero — SLR must be 0, not NaN/Infinity'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const rt = r.ratios;
    const finite = [rt.cet1_ratio_pct, rt.tier1_ratio_pct, rt.total_capital_ratio_pct, rt.supplementary_leverage_ratio_pct]
      .every((v) => Number.isFinite(v));
    const plausible = finite;
    rows.push({ label, cet1_ratio_pct: rt.cet1_ratio_pct, cet1_pass: rt.cet1_pass, slr_pass: rt.slr_pass, eslr_pass: r.eslr.pass, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_thresholdAgreement());
results.properties.push(checkP2_rwaMonotone());
results.properties.push(checkP3_totalCapitalExact());
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
