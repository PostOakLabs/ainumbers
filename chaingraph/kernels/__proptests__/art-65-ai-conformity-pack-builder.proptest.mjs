// kernel_digest_at_authoring: sha256:4d9a56ae5ea8a88287765b48baed1e6137e5d8cac49886082c0a07310239f74e
//
// FV-PROPFLOOR-SHARD-B15-1 — property-test floor for art-65-ai-conformity-pack-builder.
// Class B (bounded-numeric), FLOAT:NO per the WU row — annex_iv_score and art_score are
// computed from a fixed integer STATUS_SCORE table {complete:4,partial:2,missing:0} divided
// by a fixed section count (40 = 10 sections x 4), so every possible tdTotal (multiple of 2,
// 0-40) yields tdTotal*2.5, which is exactly representable as a half-integer double — there is
// no irrational division or accumulating float error to force ULP boundaries against. Per
// FV-PBT-FLOOR-BUILD-SPEC.md §3 this is a stated float:no exception — forced CATEGORICAL
// boundary cases (all-missing, all-complete, exact CE-readiness thresholds) stand in for
// ULP forcing.
// Zero external dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-65-ai-conformity-pack-builder.proptest.mjs

import { compute } from '../art-65-ai-conformity-pack-builder.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-65-ai-conformity-pack-builder.fixtures.json');
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
const rand = mulberry32(0x65A11);
const TRIALS = 8000;
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const ANNEX_IV_IDS = ['description', 'design', 'training', 'validation', 'standards', 'qa', 'risk', 'changes', 'copies', 'declaration'];
const TD_STATUS = ['complete', 'partial', 'missing'];
const RM_STATUS = ['full', 'partial', 'none'];
const ROUTES = ['internal-control', 'notified-body'];

function mkPP(rng) {
  const technical_documentation = ANNEX_IV_IDS.map(section => ({
    section,
    status: pick(rng, TD_STATUS),
    evidence_ref: rng() < 0.5 ? 'ref' : null,
  }));
  return {
    system: { name: 'sys', role: 'provider', annex_iii_use_case: 'credit-scoring' },
    technical_documentation,
    conformity_route: pick(rng, ROUTES),
    risk_mgmt_system: pick(rng, RM_STATUS),
    data_governance: pick(rng, RM_STATUS),
    accuracy_robustness_cyber: pick(rng, RM_STATUS),
    quality_management: pick(rng, RM_STATUS),
  };
}

// ---------- P1: boundedness — annex_iv_score, art_score, overall (conformity_grade-driving) score stay in [0, 100] ----------
function checkP1_scoresBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { annex_iv_score } = r.output_payload;
    const artScores = r.output_payload.articles_status;
    const artVals = [artScores.art9.score, artScores.art10.score, artScores.art15.score, artScores.art17.score];
    let bad = annex_iv_score < 0 || annex_iv_score > 100 || !Number.isFinite(annex_iv_score);
    for (const v of artVals) if (v < 0 || v > 4) bad = true;
    if (bad) violations++;
  }
  return { name: 'P1_annex_iv_and_article_scores_bounded', trials: checked, violations };
}

// ---------- P2: exactness — annex_iv_score is exactly the half-integer tdTotal*2.5, never a rounding artifact ----------
function checkP2_annexIvScoreExactHalfInteger() {
  const STATUS_SCORE = { complete: 4, partial: 2, missing: 0 };
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const tdTotal = pp.technical_documentation.reduce((a, td) => a + (STATUS_SCORE[td.status] ?? 0), 0);
    const expected = +(tdTotal / 40 * 100).toFixed(1);
    if (Math.abs(r.output_payload.annex_iv_score - expected) > 1e-9) violations++;
  }
  return { name: 'P2_annex_iv_score_exact_tdTotal_over_40_times_100', trials: checked, violations };
}

// ---------- P3: fixed-rule — ce_ready is exactly the declared AND of its three conditions ----------
function checkP3_ceReadyFixedRule() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const artScores = r.output_payload.articles_status;
    const artMean = (artScores.art9.score + artScores.art10.score + artScores.art15.score + artScores.art17.score) / 4;
    const art_score = +(artMean / 4 * 100).toFixed(1);
    const expected = r.output_payload.annex_iv_score >= 85 && art_score >= 70 && pp.technical_documentation.length >= 10;
    if (r.output_payload.ce_ready !== expected) violations++;
  }
  return { name: 'P3_ce_ready_exact_AND_of_annexiv_ge85_art_ge70_len_ge10', trials: checked, violations };
}

// ---------- P4 (mandatory float:no exception): forced categorical boundary cases ----------
function checkP4_forced() {
  const base = mkPP(mulberry32(0x65B22));
  const rows = [];
  const push = (overrides, label) => {
    const pp = { ...base, ...overrides };
    const r = compute(pp);
    const { annex_iv_score, annex_iv_grade, ce_ready } = r.output_payload;
    const plausible = Number.isFinite(annex_iv_score) && annex_iv_score >= 0 && annex_iv_score <= 100 && typeof ce_ready === 'boolean';
    rows.push({ label, annex_iv_score, annex_iv_grade, ce_ready, plausible });
  };

  push({ technical_documentation: ANNEX_IV_IDS.map(section => ({ section, status: 'complete' })) }, 'all 10 Annex IV sections complete — annex_iv_score must be exactly 100.0');
  push({ technical_documentation: ANNEX_IV_IDS.map(section => ({ section, status: 'missing' })) }, 'all 10 Annex IV sections missing — annex_iv_score must be exactly 0.0');
  push({ technical_documentation: [] }, 'empty technical_documentation array — every section falls to the ?? "missing" default, score must be 0.0, must not throw');
  push({ technical_documentation: ANNEX_IV_IDS.map((section, i) => ({ section, status: i < 8 ? 'complete' : 'missing' })) }, '8/10 complete, 2/10 missing — tdTotal=32, annex_iv_score must be exactly 80.0');
  push({ risk_mgmt_system: 'full', data_governance: 'full', accuracy_robustness_cyber: 'full', quality_management: 'partial' }, 'articles 9/10/15 full, 17 partial — artMean=(4+4+4+2)/4=3.5, art_score must be exactly 87.5');
  push({ conformity_route: 'notified-body' }, 'notified-body route — conformity_route_note must be the notified-body text and NOTIFIED_BODY_REQUIRED flag must be present');
  push({ technical_documentation: ANNEX_IV_IDS.map(section => ({ section, status: 'complete' })), risk_mgmt_system: 'full', data_governance: 'full', accuracy_robustness_cyber: 'full', quality_management: 'full' }, 'fully complete pack — ce_ready must be exactly true');
  push({ technical_documentation: ANNEX_IV_IDS.slice(0, 9).map(section => ({ section, status: 'complete' })) }, 'exactly 9/10 sections present (one missing entirely, not just incomplete) — technical_documentation.length >= 10 gate must fail ce_ready even if scores are high');
  push({ system: { name: '', role: 'provider', annex_iii_use_case: 'credit-scoring' } }, 'empty system name — declaration_of_conformity_skeleton template must fall back to placeholder text, not throw or emit undefined');
  push({ technical_documentation: ANNEX_IV_IDS.map(section => ({ section, status: 'partial' })) }, 'all 10 sections partial — tdTotal=20, annex_iv_score must be exactly 50.0, right at the C/D boundary edge');

  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_scoresBounded());
results.properties.push(checkP2_annexIvScoreExactHalfInteger());
results.properties.push(checkP3_ceReadyFixedRule());
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
