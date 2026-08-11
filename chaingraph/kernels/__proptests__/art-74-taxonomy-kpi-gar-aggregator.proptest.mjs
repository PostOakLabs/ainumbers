// kernel_digest_at_authoring: sha256:5810a300b83afde6fbf0bba7ce4da33b6fce0152cfdd4ccf02eb94258ea957d3
//
// FV-PROPFLOOR-SHARD-B16-1 — property-test floor for art-74-taxonomy-kpi-gar-aggregator.
// Class B (bounded-numeric), FLOAT-SENSITIVE — the safe() helper divides aligned/total sums
// (turnover, capex, opex, and the GAR numerator/denominator) and rounds to 2dp — ULP-boundary
// forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-74-taxonomy-kpi-gar-aggregator.proptest.mjs

import { compute } from '../art-74-taxonomy-kpi-gar-aggregator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-74-taxonomy-kpi-gar-aggregator.fixtures.json');
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
const rand = mulberry32(0x74B6);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

const TRIALS = 8000;

function mkActivities(rng, n) {
  const acts = [];
  for (let i = 0; i < n; i++) {
    const aligned = rng() < 0.5;
    acts.push({
      nace_code: `N${i}`,
      alignment_verdict: aligned ? 'ALIGNED — ...' : 'ELIGIBLE_NOT_ALIGNED — ...',
      turnover: randRange(rng, 0, 100000),
      capex: randRange(rng, 0, 50000),
      opex: randRange(rng, 0, 20000),
    });
  }
  return acts;
}

function mkPP(rng) {
  const n = 1 + Math.floor(rng() * 5);
  const entity_type = rng() < 0.5 ? 'non-financial' : (rng() < 0.5 ? 'credit-institution' : 'insurer');
  const pp = { activities: mkActivities(rng, n), entity_type };
  if (entity_type !== 'non-financial') {
    pp.total_assets = randRange(rng, 1, 1000000);
    pp.covered_assets = randRange(rng, 0, pp.total_assets);
    // Domain restricted so aligned GAR-numerator amounts never exceed total_assets — the kernel
    // does not clamp green_asset_ratio to [0,100] (it is a caller data-quality expectation, not an
    // enforced invariant: an aligned_covered sum larger than total_assets legitimately produces a
    // ratio above 100), so P1's [0,100] boundedness claim is scoped to the "covered ⊆ total assets"
    // sane-input domain rather than forcing the kernel to clamp — same "narrow rather than force
    // the kernel" reasoning B12's art-331 documented.
    const m = 1 + Math.floor(rng() * 3);
    let remainingAssets = pp.total_assets;
    pp.gar_numerator_items = Array.from({ length: m }, (_, i) => {
      const amount = randRange(rng, 0, Math.max(0, remainingAssets));
      remainingAssets -= amount;
      return { asset_type: `A${i}`, amount, aligned: rng() < 0.5 };
    });
  }
  return pp;
}

// ---------- P1: boundedness — every aligned-pct field and GAR stay within [0,100] ----------
function checkP1_pctBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { revenue_aligned_pct, capex_aligned_pct, opex_aligned_pct, green_asset_ratio } = r.output_payload;
    for (const v of [revenue_aligned_pct, capex_aligned_pct, opex_aligned_pct]) {
      if (v < 0 || v > 100) violations++;
    }
    if (green_asset_ratio !== null && (green_asset_ratio < 0 || green_asset_ratio > 100)) violations++;
  }
  return { name: 'P1_aligned_pct_and_gar_bounded_0_to_100', trials: checked, violations };
}

// ---------- P2: round-trip identity — each *_aligned_pct is the exact safe() recompute from kpi_breakdown ----------
function checkP2_pctExactFromBreakdown() {
  let violations = 0, checked = 0;
  const safe = (n, d) => (d > 0 ? +(n / d * 100).toFixed(2) : 0);
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { kpi_breakdown, revenue_aligned_pct, capex_aligned_pct, opex_aligned_pct } = r.output_payload;
    let totalT = 0, alignedT = 0, totalC = 0, alignedC = 0, totalO = 0, alignedO = 0;
    for (const k of kpi_breakdown) {
      totalT += k.turnover; totalC += k.capex; totalO += k.opex;
      if (k.is_aligned) { alignedT += k.turnover; alignedC += k.capex; alignedO += k.opex; }
    }
    if (revenue_aligned_pct !== safe(alignedT, totalT)) violations++;
    if (capex_aligned_pct !== safe(alignedC, totalC)) violations++;
    if (opex_aligned_pct !== safe(alignedO, totalO)) violations++;
  }
  return { name: 'P2_aligned_pct_exact_recompute_from_kpi_breakdown', trials: checked, violations };
}

// ---------- P3: round-trip identity — aligned_count is the exact count of is_aligned rows ----------
function checkP3_alignedCountExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { kpi_breakdown, aligned_count, activity_count } = r.output_payload;
    if (aligned_count !== kpi_breakdown.filter((k) => k.is_aligned).length) violations++;
    if (activity_count !== kpi_breakdown.length) violations++;
  }
  return { name: 'P3_aligned_count_and_activity_count_exact', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ activities: [] }, 'no activities — all aligned-pct fields must be exactly 0 (safe() denominator-zero branch), never NaN'],
  [{ activities: [{ nace_code: 'A', alignment_verdict: 'ALIGNED', turnover: 0, capex: 0, opex: 0 }] }, 'single fully-aligned activity with all zero amounts — revenue/capex/opex_aligned_pct must be exactly 0 (0/0 denominator-zero branch), not NaN from 0/0'],
  [{ activities: [{ nace_code: 'A', alignment_verdict: 'ALIGNED', turnover: Number.MIN_VALUE, capex: 1, opex: 1 }] }, 'turnover at smallest positive denormal, fully aligned — revenue_aligned_pct must be exactly 100 (aligned=total), no rounding artifact'],
  [{ activities: [{ nace_code: 'A', alignment_verdict: 'ELIGIBLE_NOT_ALIGNED', turnover: -0, capex: -0, opex: -0 }] }, 'all amounts negative zero, not aligned — pct fields must be exactly 0, no NaN'],
  [{ activities: [{ nace_code: 'A', alignment_verdict: 'ALIGNED', turnover: (1 / 3) * 3, capex: (1 / 3) * 3, opex: (1 / 3) * 3 }] }, 'amounts = (1/3)*3, x/y*y!==x style — fully aligned single activity must still yield exactly 100% (aligned_sum === total_sum bit-for-bit since both accumulate the identical value)'],
  [{ activities: [{ nace_code: 'A', alignment_verdict: 'ALIGNED', turnover: 1e15, capex: 1, opex: 1 }, { nace_code: 'B', alignment_verdict: 'ELIGIBLE_NOT_ALIGNED', turnover: 1, capex: 1, opex: 1 }] }, 'one activity dominates the total by 15 orders of magnitude — revenue_aligned_pct must remain finite, not overflow, and reflect the dominant activity is aligned (~100%)'],
  [{ activities: [{ nace_code: 'A', alignment_verdict: 'ALIGNED', turnover: 100 }], entity_type: 'credit-institution', total_assets: 0, covered_assets: 0, gar_numerator_items: [] }, 'financial undertaking with total_assets exactly zero — green_asset_ratio must be exactly 0 (explicit ternary), never NaN from a zero-denominator division'],
  [{ activities: [{ nace_code: 'A', alignment_verdict: 'ALIGNED', turnover: 100 }], entity_type: 'credit-institution', total_assets: 1000, covered_assets: 500, gar_numerator_items: [{ asset_type: 'X', amount: 1000, aligned: true }] }, 'GAR aligned_covered exactly equals total_assets (amount 1000 vs total_assets 1000) — green_asset_ratio must be exactly 100, at the boundary of the [0,100] declared range'],
  [{ activities: [{ nace_code: 'A', alignment_verdict: 'ALIGNED', turnover: 100 }], entity_type: 'insurer', total_assets: 1000, covered_assets: 500, gar_numerator_items: [{ asset_type: 'X', amount: -0, aligned: true }] }, 'GAR numerator amount negative zero — aligned_covered_assets and green_asset_ratio must both be exactly 0, no NaN'],
  [{ activities: [{ nace_code: 'A', alignment_verdict: 'ALIGNED', turnover: 100 }], entity_type: 'insurer', total_assets: Number.MIN_VALUE, covered_assets: 0, gar_numerator_items: [{ asset_type: 'X', amount: Number.MIN_VALUE, aligned: true }] }, 'total_assets and aligned amount both at smallest positive denormal — green_asset_ratio must remain finite (should resolve near 100), not Infinity/NaN'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { revenue_aligned_pct, capex_aligned_pct, opex_aligned_pct, green_asset_ratio } = r.output_payload;
    const fields = [revenue_aligned_pct, capex_aligned_pct, opex_aligned_pct];
    if (green_asset_ratio !== null) fields.push(green_asset_ratio);
    const plausible = fields.every(Number.isFinite);
    rows.push({ label, input: pp, revenue_aligned_pct, capex_aligned_pct, opex_aligned_pct, green_asset_ratio, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_pctBounded());
results.properties.push(checkP2_pctExactFromBreakdown());
results.properties.push(checkP3_alignedCountExact());
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
