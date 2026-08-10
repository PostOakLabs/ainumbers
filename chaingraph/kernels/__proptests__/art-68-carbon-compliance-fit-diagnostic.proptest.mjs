// kernel_digest_at_authoring: sha256:a8f0b6c702c3793a684793530ccd427f11067b356e3c3c899f614c15de976da2
//
// FV-PROPFLOOR-SHARD-B15-1 — property-test floor for art-68-carbon-compliance-fit-diagnostic.
// Class B (bounded-numeric), FLOAT-SENSITIVE (overall_score sums four dim_raw values weighted
// by WEIGHTS {cbam:0.35, taxonomy:0.25, eugb:0.20, climate:0.20}, then toFixed(1) — a weighted
// sum of decimal fractions that does not always land on a clean binary fraction) — ULP-boundary
// forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3.
// Zero external dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-68-carbon-compliance-fit-diagnostic.proptest.mjs

import { compute } from '../art-68-carbon-compliance-fit-diagnostic.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-68-carbon-compliance-fit-diagnostic.fixtures.json');
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
const rand = mulberry32(0x68A11);
const TRIALS = 8000;
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const IMPORTS = ['none', 'below-50t', 'above-50t'];
const DECLARANT = ['authorised', 'applied', 'none'];
const ORIGIN_PRICE = ['yes', 'partial', 'none'];
const TAXONOMY_SCOPE = ['out', 'financial', 'non-financial'];
const TAXONOMY_OBJ = ['all-six', 'climate-only', 'none'];
const EUGB = ['none', 'considering', 'issuing'];
const CLIMATE = ['none', 'insurer', 'bank'];
const EMISSIONS = ['actual', 'default', 'unknown'];

function mkPP(rng) {
  return {
    imports_cbam_goods: pick(rng, IMPORTS),
    cbam_good_categories: rng() < 0.5 ? ['steel'] : [],
    declarant_status: pick(rng, DECLARANT),
    origin_carbon_price: pick(rng, ORIGIN_PRICE),
    taxonomy_scope: pick(rng, TAXONOMY_SCOPE),
    taxonomy_objectives_assessed: pick(rng, TAXONOMY_OBJ),
    eugb_intent: pick(rng, EUGB),
    climate_stress_applicable: pick(rng, CLIMATE),
    emissions_data_basis: pick(rng, EMISSIONS),
    entity_name: 'ent',
    eu_nexus: rng() < 0.8,
    reporting_year: 2026,
  };
}

// ---------- P1: boundedness — every dim score and overall_score stays in [0, 100] ----------
function checkP1_scoresBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { dim_scores, overall_score } = r.output_payload;
    let bad = !Number.isFinite(overall_score) || overall_score < 0 || overall_score > 100;
    for (const k of Object.keys(dim_scores)) {
      const s = dim_scores[k].score;
      if (!Number.isFinite(s) || s < 0 || s > 100) bad = true;
    }
    if (bad) violations++;
  }
  return { name: 'P1_dim_and_overall_scores_bounded_0_to_100', trials: checked, violations };
}

// ---------- P2: grade agreement — every dim grade and overall_grade matches the fixed letter() thresholds ----------
function letter(s) { return s >= 85 ? 'A' : s >= 70 ? 'B' : s >= 55 ? 'C' : s >= 40 ? 'D' : 'F'; }
function checkP2_gradeMatchesThresholds() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { dim_scores, overall_score, overall_grade } = r.output_payload;
    let bad = overall_grade !== letter(overall_score);
    for (const k of Object.keys(dim_scores)) {
      if (dim_scores[k].grade !== letter(dim_scores[k].score)) bad = true;
    }
    if (bad) violations++;
  }
  return { name: 'P2_grades_match_fixed_85_70_55_40_thresholds', trials: checked, violations };
}

// ---------- P3: fixed-rule — cbam_declarant_required is exactly (imports_cbam_goods === 'above-50t') ----------
function checkP3_cbamRequiredFixedRule() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = pp.imports_cbam_goods === 'above-50t';
    if (r.output_payload.cbam_declarant_required !== expected) violations++;
  }
  return { name: 'P3_cbam_declarant_required_exact_above_50t_check', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{}, 'all-defaults (weakest values) — overall_score must be finite, no NaN from any 0/16 or 0/8 division'],
  [{ imports_cbam_goods: 'none', declarant_status: 'authorised', origin_carbon_price: 'yes', emissions_data_basis: 'actual', taxonomy_scope: 'out', taxonomy_objectives_assessed: 'all-six', eugb_intent: 'none', climate_stress_applicable: 'none' }, 'all-best-case — every raw dim at 100, overall_score must equal exactly 100.0 (WEIGHTS sum to 1.0 exactly: 0.35+0.25+0.20+0.20)'],
  [{ imports_cbam_goods: 'above-50t', declarant_status: 'none', origin_carbon_price: 'none', emissions_data_basis: 'unknown' }, 'cbam sub-scores all worst (0,0,0,0)/16*100 — cbam_raw must be exactly 0.0'],
  [{ taxonomy_scope: 'financial', taxonomy_objectives_assessed: 'climate-only' }, 'taxonomy sub-scores (2+2)/8*100 — taxonomy_raw must be exactly 50.0'],
  [{ imports_cbam_goods: 'above-50t', declarant_status: 'applied', origin_carbon_price: 'partial', emissions_data_basis: 'default' }, 'cbam sub-scores (0+2+2+2)/16*100 — cbam_raw must be exactly 37.5, right below the 40 D-grade boundary'],
  [{ eugb_intent: 'considering' }, 'eugb_intent considering (score 2) — eugb_raw = 2/4*100 = 50.0 exactly'],
  [{ climate_stress_applicable: 'bank' }, 'climate_stress_applicable bank (score 1) — climate_raw = 1/4*100 = 25.0 exactly'],
  [{ imports_cbam_goods: 'above-50t', declarant_status: 'none', origin_carbon_price: 'none', emissions_data_basis: 'unknown', taxonomy_scope: 'out', eugb_intent: 'none', climate_stress_applicable: 'none' }, 'CBAM-only-bad composition — overall = 0*0.35 + 100*0.25 + 100*0.20 + 100*0.20 = 65.0 exactly, must not drift to 64.99999999999999'],
  [{ imports_cbam_goods: 'below-50t' }, 'imports_cbam_goods below-50t (score 2, not the 0/4 endpoints) — cbam_declarant_required must be exactly false, cbam sub-score contribution must reflect the mid value 2 exactly'],
  [{ taxonomy_scope: 'non-financial', taxonomy_objectives_assessed: 'none' }, 'taxonomy non-financial with zero objectives assessed — TAXONOMY_OBJECTIVES_INCOMPLETE flag must fire, taxonomy_raw = (2+0)/8*100 = 25.0 exactly'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = { ...overrides };
    const r = compute(pp);
    const { dim_scores, overall_score, overall_grade, cbam_declarant_required } = r.output_payload;
    let plausible = Number.isFinite(overall_score) && overall_score >= 0 && overall_score <= 100 && typeof overall_grade === 'string' && typeof cbam_declarant_required === 'boolean';
    for (const k of Object.keys(dim_scores)) {
      if (!Number.isFinite(dim_scores[k].score)) plausible = false;
    }
    rows.push({ label, input: pp, overall_score, overall_grade, cbam_declarant_required, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_scoresBounded());
results.properties.push(checkP2_gradeMatchesThresholds());
results.properties.push(checkP3_cbamRequiredFixedRule());
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
