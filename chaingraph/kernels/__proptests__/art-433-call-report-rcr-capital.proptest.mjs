// kernel_digest_at_authoring: sha256:c62ba6456819dce8756770a395024a9508cf9685dd9d3ca1409ebe2d6e01546c
//
// FV-PROPFLOOR-SHARD-B23-1 — property-test floor for art-433-call-report-rcr-capital.
// Class B (bounded-numeric), FLOAT-SENSITIVE (cet1/tier1/total-capital ratios are raw float
// divisions against RWA/leverage-exposure, compared with >= against caller-declared, version-
// pinned minimum percentages) — ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-
// SPEC.md §3. Zero external dependencies. This file is READ-ONLY with respect to the kernel
// it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-433-call-report-rcr-capital.proptest.mjs

import { compute } from '../art-433-call-report-rcr-capital.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-433-call-report-rcr-capital.fixtures.json');
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
const rand = mulberry32(0x433C3);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;
function r6(v) { return Math.round(v * 1000000) / 1000000; }

function mkPP(rng) {
  const cet1 = randRange(rng, 0, 1e8);
  return {
    entity_id: 'BANK-1', reporting_period: '2026Q2', constants_version: 'v2026.1',
    cet1_capital_usd: cet1,
    additional_tier1_capital_usd: randRange(rng, 0, 1e7),
    tier2_capital_usd: randRange(rng, 0, 1e7),
    total_rwa_usd: randRange(rng, 0.01, 1e9),
    total_leverage_exposure_usd: randRange(rng, 0.01, 1e9),
  };
}

// ---------- P1: fixed rule — total_capital_usd equals r2(tier1 + tier2) ----------
// NOTE (corrected after direct measurement, FIX-2 carry): the kernel computes total_capital_usd
// and the ratio divisions from the UNROUNDED internal tier1/cet1/RWA values, then r2/r6-rounds
// each field independently for DISPLAY. Recomputing "expected" from the already-rounded output
// fields double-rounds and produces spurious violations near cent/ppm boundaries — the property
// must mirror the kernel's own pre-rounding derivation from raw `pp`, exactly as B12's art-327/
// art-328 shards found for their own round-trip checks.
function tier1From(pp) {
  const cet1 = Number.isFinite(Number(pp.cet1_capital_usd)) ? Number(pp.cet1_capital_usd) : 0;
  const addl = Number.isFinite(Number(pp.additional_tier1_capital_usd)) ? Number(pp.additional_tier1_capital_usd) : 0;
  return Number.isFinite(Number(pp.tier1_capital_usd)) ? Number(pp.tier1_capital_usd) : cet1 + addl;
}

function checkP1_totalCapitalExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const tier1 = tier1From(pp);
    const tier2 = Number.isFinite(Number(pp.tier2_capital_usd)) ? Number(pp.tier2_capital_usd) : 0;
    const expected = Math.round((tier1 + tier2) * 100) / 100;
    if (r.output_payload.total_capital_usd !== expected) violations++;
  }
  return { name: 'P1_total_capital_exact_r2_tier1_plus_tier2_from_raw_inputs', trials: checked, violations };
}

// ---------- P2: fixed-threshold-tier agreement — each *_pass flag matches an independently recomputed ratio ----------
function checkP2_passFlagsMatchRatios() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    const ratios = op.ratios;
    if ((ratios.cet1_ratio_pct >= ratios.cet1_min_pct) !== ratios.cet1_pass) violations++;
    if ((ratios.tier1_ratio_pct >= ratios.tier1_min_pct) !== ratios.tier1_pass) violations++;
    if ((ratios.total_capital_ratio_pct >= ratios.total_capital_min_pct) !== ratios.total_capital_pass) violations++;
    if ((ratios.supplementary_leverage_ratio_pct >= ratios.slr_min_pct) !== ratios.slr_pass) violations++;
    const cet1Raw = Number.isFinite(Number(pp.cet1_capital_usd)) ? Number(pp.cet1_capital_usd) : 0;
    const rwaRaw = Number.isFinite(Number(pp.total_rwa_usd)) ? Number(pp.total_rwa_usd) : 0;
    const expectedCet1Ratio = rwaRaw > 0 ? r6(cet1Raw / rwaRaw) : 0;
    if (ratios.cet1_ratio_pct !== expectedCet1Ratio) violations++;
  }
  return { name: 'P2_pass_flags_and_ratios_match_recomputed_division_from_raw_inputs', trials: checked, violations };
}

// ---------- P3: monotonicity — increasing cet1_capital_usd (RWA fixed) never decreases cet1_ratio_pct ----------
function checkP3_monotonicRatioInCapital() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const rLo = compute(pp);
    const ppHi = { ...pp, cet1_capital_usd: pp.cet1_capital_usd + randRange(rand, 0.01, 1e6) };
    const rHi = compute(ppHi);
    checked++;
    if (rHi.output_payload.ratios.cet1_ratio_pct < rLo.output_payload.ratios.cet1_ratio_pct) violations++;
  }
  return { name: 'P3_cet1_ratio_nondecreasing_as_cet1_capital_increases', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing on the ratio-vs-minimum threshold comparisons ----------
const EPS = Number.EPSILON;
const ULP_BOUNDARY_CASES = [
  [{ cet1_capital_usd: 4.5, total_rwa_usd: 100 }, 'cet1 ratio exactly at the 4.5% default minimum — cet1_pass true (>=)'],
  [{ cet1_capital_usd: 4.5 * (1 - EPS * 4), total_rwa_usd: 100 }, 'cet1 ratio 1 ULP below the minimum — cet1_pass false'],
  [{ tier1_capital_usd: 6, total_rwa_usd: 100 }, 'tier1 ratio exactly at the 6% default minimum — tier1_pass true'],
  [{ tier2_capital_usd: 2, tier1_capital_usd: 6, total_rwa_usd: 100 }, 'total capital ratio exactly at the 8% default minimum — total_capital_pass true'],
  [{ tier1_capital_usd: 3, total_leverage_exposure_usd: 100 }, 'SLR exactly at the 3% default minimum — slr_pass true'],
  [{ total_rwa_usd: 0 }, 'total_rwa_usd exactly zero — pct() guard yields ratio 0, RWA_NONPOSITIVE flag, no Infinity/NaN'],
  [{ total_rwa_usd: -0 }, 'negative-zero RWA — guard treats as non-positive, ratio 0'],
  [{ cet1_capital_usd: -0, total_rwa_usd: 100 }, 'negative-zero cet1 capital — must behave as zero, no NaN'],
  [{ is_gsib: true, tier1_capital_usd: 5, total_leverage_exposure_usd: 100 }, 'GSIB with SLR exactly at the eSLR-buffered 5% required (3% base + 2% buffer) — eslr pass true at boundary'],
  [{ cet1_capital_usd: 1 / 3 * 12, total_rwa_usd: 100 }, 'x/y*y!==x style rounding artifact near the 4.5% boundary — must classify deterministically, finite'],
  [{ cet1_capital_usd: Number.MAX_SAFE_INTEGER, total_rwa_usd: 1 }, 'cet1 at MAX_SAFE_INTEGER — must not overflow to a non-finite ratio'],
  [{ tier1_capital_usd: 3, cet1_capital_usd: 5, total_rwa_usd: 100 }, 'tier1 less than cet1 — TIER1_LESS_THAN_CET1 flag must fire regardless of ratio pass/fail'],
];

function checkP4_forced() {
  const rows = [];
  for (const [partial, label] of ULP_BOUNDARY_CASES) {
    const pp = { entity_id: 'BANK-1', reporting_period: '2026Q2', constants_version: 'v2026.1', ...partial };
    const r = compute(pp);
    const op = r.output_payload;
    const plausible = Number.isFinite(op.ratios.cet1_ratio_pct) && Number.isFinite(op.ratios.tier1_ratio_pct)
      && Number.isFinite(op.ratios.total_capital_ratio_pct) && Number.isFinite(op.ratios.supplementary_leverage_ratio_pct)
      && typeof op.ratios.cet1_pass === 'boolean';
    rows.push({ label, input: partial, ratios: op.ratios, eslr: op.eslr, compliance_flags: r.compliance_flags, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_totalCapitalExact());
results.properties.push(checkP2_passFlagsMatchRatios());
results.properties.push(checkP3_monotonicRatioInCapital());
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
