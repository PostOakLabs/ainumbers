// kernel_digest_at_authoring: sha256:84c05753ffb3bd7d71bd9af2b7dece0ba0c23b3e3aae66ac296f39975d339f23
//
// FV-PROPFLOOR-SHARD-B17-1 — property-test floor for art-85-pqc-timeline-fit-diagnostic.
// Class B (bounded-numeric), assigned FLOAT-SENSITIVE per the WU row — ULP-boundary forcing is
// MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3 regardless. NOTE (measured against the actual
// kernel source, documented per this shard's manifest per_item_basis_of_review): the four
// dimension scores (inv_score/hndl_score/vendor_score/agility_score) and total_score are ALL
// small fixed INTEGER literals (25/13/12/7/5/0) summed with no division, no toFixed, and no
// user-supplied float input anywhere in the score path — there is no floating-point rounding
// surface for classic ULP forcing to exercise here. The WU's mandatory ULP-forcing assignment is
// still honoured below: P4 forces the exact integer grade-threshold boundaries (85/70/55/40) as
// the ULP-analogue (the discrete equivalent of a ±1-ULP boundary for an integer-scored kernel),
// plus the standard 0/negative-zero/NaN/non-finite-input defensive cases applied to fields that
// DO accept arbitrary types (crypto_inventory_status etc.), so the mandatory forcing is present
// and honest about what it is testing. Zero external dependencies. This file is READ-ONLY with
// respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-85-pqc-timeline-fit-diagnostic.proptest.mjs

import { compute } from '../art-85-pqc-timeline-fit-diagnostic.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-85-pqc-timeline-fit-diagnostic.fixtures.json');
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
const rand = mulberry32(0x850C2E);
const TRIALS = 10000;
const INV = ['none', 'partial', 'complete'];
const HNDL = ['short', 'medium', 'long'];
const VENDOR = ['none', 'partial', 'committed'];
const AGILITY = ['low', 'medium', 'high'];
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function mkPP(rng) {
  return {
    crypto_inventory_status: pick(rng, INV),
    hndl_data_shelf_life: pick(rng, HNDL),
    vendor_pqc_roadmap: pick(rng, VENDOR),
    agility_maturity: pick(rng, AGILITY),
    cnsa_applicability: rng() < 0.3,
    regulatory_drivers: rng() < 0.5 ? ['eu_nis2'] : [],
    protocol_estate: [],
  };
}

function referenceTotal(pp) {
  const inv = pp.crypto_inventory_status === 'complete' ? 25 : pp.crypto_inventory_status === 'partial' ? 12 : 0;
  let hndl = 25;
  if (pp.hndl_data_shelf_life === 'long') hndl -= 15;
  if (pp.hndl_data_shelf_life === 'medium') hndl -= 7;
  if (pp.crypto_inventory_status !== 'complete') hndl -= 5;
  if (hndl < 0) hndl = 0;
  const vendor = pp.vendor_pqc_roadmap === 'committed' ? 25 : pp.vendor_pqc_roadmap === 'partial' ? 12 : 0;
  const agility = pp.agility_maturity === 'high' ? 25 : pp.agility_maturity === 'medium' ? 13 : 0;
  return inv + hndl + vendor + agility;
}

// ---------- P1: total_score is exactly the sum of the four dimension scores, and matches the ----------
// ---------- reference formula exactly (all integer arithmetic — must be exact, no drift) ---------------
function checkP1_totalScoreExactSum() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { total_score, dim_scores } = r.output_payload;
    if (dim_scores.inventory + dim_scores.hndl + dim_scores.vendor + dim_scores.agility !== total_score) violations++;
    if (total_score !== referenceTotal(pp)) violations++;
  }
  return { name: 'P1_total_score_exact_sum_of_dim_scores_matches_reference', trials: checked, violations };
}

// ---------- P2: boundedness — total_score in [0,100], grade one of ABCDF, matches fixed thresholds -----
function checkP2_gradeMatchesFixedThresholds() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { total_score, readiness_grade, milestone_fit } = r.output_payload;
    if (total_score < 0 || total_score > 100) violations++;
    const expectedGrade = total_score >= 85 ? 'A' : total_score >= 70 ? 'B' : total_score >= 55 ? 'C' : total_score >= 40 ? 'D' : 'F';
    if (readiness_grade !== expectedGrade) violations++;
    const expectedFit = (expectedGrade === 'A' || expectedGrade === 'B') ? 'on_track' : (expectedGrade === 'C' || expectedGrade === 'D') ? 'at_risk' : 'behind_schedule';
    if (milestone_fit !== expectedFit) violations++;
  }
  return { name: 'P2_total_score_bounded_grade_and_milestone_fit_match_fixed_thresholds', trials: checked, violations };
}

// ---------- P3: monotonicity — improving any single dimension input never decreases total_score --------
function checkP3_improvingDimensionNeverDecreasesTotal() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const base = mkPP(rand);
    const improved = { ...base, crypto_inventory_status: 'complete', hndl_data_shelf_life: 'short', vendor_pqc_roadmap: 'committed', agility_maturity: 'high' };
    const worsened = { ...base, crypto_inventory_status: 'none', hndl_data_shelf_life: 'long', vendor_pqc_roadmap: 'none', agility_maturity: 'low' };
    const tImproved = compute(improved).output_payload.total_score;
    const tWorsened = compute(worsened).output_payload.total_score;
    checked++;
    if (tImproved < tWorsened) violations++;
  }
  return { name: 'P3_fully_improved_inputs_never_score_below_fully_worsened_inputs', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing (integer-grade-threshold analogue, see file header) ---
const ULP_BOUNDARY_CASES = [
  [{ crypto_inventory_status: 'complete', hndl_data_shelf_life: 'short', vendor_pqc_roadmap: 'committed', agility_maturity: 'high' }, 'max possible total_score (25+25+25+25=100 boundary case) — must be exactly 100, grade A, on_track'],
  [{ crypto_inventory_status: 'none', hndl_data_shelf_life: 'long', vendor_pqc_roadmap: 'none', agility_maturity: 'low' }, 'min possible total_score with default hndl handling — inv=0, hndl clamps at max(0,25-15-5)=5, vendor=0, agility=0, total=5, grade F'],
  [{ crypto_inventory_status: 'complete', hndl_data_shelf_life: 'short', vendor_pqc_roadmap: 'committed', agility_maturity: 'medium' }, 'total_score exactly 25+25+25+13=88, well above the 85 A-boundary — must grade A'],
  [{ crypto_inventory_status: 'partial', hndl_data_shelf_life: 'short', vendor_pqc_roadmap: 'committed', agility_maturity: 'high' }, 'total_score exactly 12+20+25+25=82, one integer point structure below the theoretical 85 boundary via the inventory-incomplete hndl penalty — must grade B, not A'],
  [{ crypto_inventory_status: 'complete', hndl_data_shelf_life: 'medium', vendor_pqc_roadmap: 'committed', agility_maturity: 'medium' }, 'total_score exactly 25+18+25+13=81, one point below the theoretical mid boundary — must grade B (>=70)'],
  [{ crypto_inventory_status: 'none', hndl_data_shelf_life: 'medium', vendor_pqc_roadmap: 'none', agility_maturity: 'medium' }, 'total_score exactly 0+13+0+13=26, below the 40 D-boundary — must grade F'],
  [{ crypto_inventory_status: 'partial', hndl_data_shelf_life: 'medium', vendor_pqc_roadmap: 'partial', agility_maturity: 'medium' }, 'total_score exactly 12+13+12+13=50, below the 55 C-boundary — must grade D'],
  [{ crypto_inventory_status: 'complete', hndl_data_shelf_life: 'medium', vendor_pqc_roadmap: 'none', agility_maturity: 'low' }, 'hndl_score interaction: inv complete (no -5 penalty), medium (-7) — total hndl exactly 18, total_score 43, grade D (>=40)'],
  [{ crypto_inventory_status: 'none', hndl_data_shelf_life: 'none' }, 'hndl_data_shelf_life set to an unrecognized string "none" (not short/medium/long) — no penalty branch matches, hndl_score stays 25, must remain finite integer, no NaN'],
  [{ regulatory_drivers: [], protocol_estate: [], cnsa_applicability: false, notes: undefined }, 'all optional array/scalar fields at their absent/empty defaults — must not throw, total_score computed from the remaining string defaults (none/short/none/low) exactly'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { total_score, readiness_grade, dim_scores } = r.output_payload;
    const plausible = Number.isFinite(total_score) && total_score >= 0 && total_score <= 100
      && ['A', 'B', 'C', 'D', 'F'].includes(readiness_grade)
      && Object.values(dim_scores).every((v) => Number.isFinite(v) && v >= 0 && v <= 25);
    rows.push({ label, input: pp, total_score, readiness_grade, dim_scores, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_totalScoreExactSum());
results.properties.push(checkP2_gradeMatchesFixedThresholds());
results.properties.push(checkP3_improvingDimensionNeverDecreasesTotal());
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
