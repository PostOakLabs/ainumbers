// kernel_digest_at_authoring: sha256:e7cbaf562ec7a4b991bdd70cfafb39fcd09bb43a73d085fd0ea270e45dd2c0cb
//
// FV-PROPFLOOR-SHARD-B15-1 — property-test floor for art-64-ai-act-highrisk-fit-diagnostic.
// Class B (bounded-numeric), FLOAT-SENSITIVE (dim_scores[k].score and overall_score are computed
// via division by dim-array length, then /4*100, then toFixed(1) — same weighted-average
// rounding surface as art-60/art-67/art-68) — ULP-boundary forcing is MANDATORY per
// FV-PBT-FLOOR-BUILD-SPEC.md §3.
// Zero external dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-64-ai-act-highrisk-fit-diagnostic.proptest.mjs

import { compute } from '../art-64-ai-act-highrisk-fit-diagnostic.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-64-ai-act-highrisk-fit-diagnostic.fixtures.json');
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
const rand = mulberry32(0x64A11);
const TRIALS = 8000;
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const PROHIBITED = ['none', 'borderline', 'likely'];
const LITERACY = ['in-place', 'partial', 'none'];
const GPAI_DEP = ['none', 'GPAI', 'GPAI-systemic'];
const ANNEX_III = ['clear-high-risk', 'borderline', 'out-of-scope'];
const ROLE = ['both', 'provider', 'deployer', 'GPAI-provider'];
const RM_STATUS = ['full', 'partial', 'none'];
const FRIA_STATUS = ['complete', 'partial', 'not-started'];
const PMM = ['defined', 'partial', 'none'];
const MODEL_RISK = ['SR-26-2-aligned', 'SR-11-7-aligned', 'partial', 'none'];
const USE_CASE = ['credit-scoring', 'insurance-pricing', 'financial-standing', 'fraud-AML', 'other'];

function mkPP(rng) {
  return {
    prohibited_practice_exposure: pick(rng, PROHIBITED),
    ai_literacy_programme: pick(rng, LITERACY),
    foundation_model_dependency: pick(rng, GPAI_DEP),
    use_case: pick(rng, USE_CASE),
    annex_iii_match: pick(rng, ANNEX_III),
    actor_role: pick(rng, ROLE),
    risk_mgmt_system: pick(rng, RM_STATUS),
    data_governance: pick(rng, RM_STATUS),
    technical_documentation: pick(rng, RM_STATUS),
    logging_oversight: pick(rng, RM_STATUS),
    fria_status: pick(rng, FRIA_STATUS),
    post_market_monitoring: pick(rng, PMM),
    model_risk_framework: pick(rng, MODEL_RISK),
    system_name: 'sys',
    eu_nexus: rng() < 0.8,
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

// ---------- P3: fixed-rule agreement — prohibited_practice_verdict text matches prohibited_practice_exposure exactly ----------
function checkP3_prohibitedVerdictFixedRule() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const v = r.output_payload.prohibited_practice_verdict;
    const startsRight =
      (pp.prohibited_practice_exposure === 'likely' && v.startsWith('CRITICAL')) ||
      (pp.prohibited_practice_exposure === 'borderline' && v.startsWith('WARNING')) ||
      (pp.prohibited_practice_exposure === 'none' && v.startsWith('PASS'));
    if (!startsRight) violations++;
  }
  return { name: 'P3_prohibited_practice_verdict_matches_exposure_exactly', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{}, 'all-defaults (weakest values across the board) — overall_score must be finite, no NaN from any 0/4 division'],
  [{ prohibited_practice_exposure: 'none', ai_literacy_programme: 'in-place', foundation_model_dependency: 'none', annex_iii_match: 'out-of-scope', actor_role: 'provider', risk_mgmt_system: 'full', data_governance: 'full', technical_documentation: 'full', logging_oversight: 'full', fria_status: 'complete', post_market_monitoring: 'defined', model_risk_framework: 'SR-26-2-aligned' }, 'all-best-case — every sub-score at its max, overall_score must equal exactly 100.0 (WEIGHTS sum to 1.0 exactly: 0.10+0.08+0.07+0.25+0.10+0.20+0.12+0.08)'],
  [{ prohibited_practice_exposure: 'likely' }, 'prohibited=likely (score 0) — prohibited dim must floor to exactly 0.0, verdict must be CRITICAL text'],
  [{ risk_mgmt_system: 'full', data_governance: 'partial', technical_documentation: 'partial', logging_oversight: 'none' }, 'articles_9_15 sub-scores average (4+2+2+0)/4=2 — dim score must be exactly 50.0, not a repeating-binary artifact'],
  [{ actor_role: 'GPAI-provider' }, 'actor_role GPAI-provider (score 1) — role dim score = 1/4*100=25.0 exactly'],
  [{ model_risk_framework: 'SR-11-7-aligned' }, 'legacy SR-11-7-aligned key — must score identically to SR-26-2-aligned (both map to 4) per the supersession note'],
  [{ fria_status: 'partial', post_market_monitoring: 'partial' }, 'deployer sub-scores average (2+2)/2=2 — dim score must be exactly 50.0'],
  [{ annex_iii_match: 'borderline' }, 'annex_iii_match borderline (score 2) — classification dim score must be exactly 50.0, high_risk_verdict must start with BORDERLINE'],
  [{ use_case: 'fraud-AML' }, 'use_case fraud-AML — annex_iii_basis text must be the fraud-AML carve-out string exactly, not the default other-case text'],
  [{ risk_mgmt_system: 'full', data_governance: 'full', technical_documentation: 'full', logging_oversight: 'partial' }, 'articles_9_15 sub-scores average (4+4+4+2)/4=3.5 — dim score = 3.5/4*100=87.5 exactly, right above the 85 A-grade boundary'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = { ...overrides };
    const r = compute(pp);
    const { dim_scores, overall_score, overall_grade, prohibited_practice_verdict, high_risk_verdict, annex_iii_basis } = r.output_payload;
    let plausible = Number.isFinite(overall_score) && overall_score >= 0 && overall_score <= 100 && typeof overall_grade === 'string';
    for (const k of Object.keys(dim_scores)) {
      if (!Number.isFinite(dim_scores[k].score)) plausible = false;
    }
    rows.push({ label, input: pp, overall_score, overall_grade, prohibited_practice_verdict, high_risk_verdict, annex_iii_basis, plausible });
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
results.properties.push(checkP3_prohibitedVerdictFixedRule());
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
