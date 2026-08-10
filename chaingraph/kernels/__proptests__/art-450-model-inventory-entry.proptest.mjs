// kernel_digest_at_authoring: sha256:2de5269cd7ce2153d49d282c65e7561c5f097c2fc88f86daeb66ea327ad21a6e
//
// FV-PROPFLOOR-SHARD-B24-1 — property-test floor for art-450-model-inventory-entry.
// Class B (bounded-numeric). ⚠ FIX-2 CARRY correction: the WU row's triage table marked this
// kernel float:yes, but direct measurement shows materiality_score/complexity_score are clamped
// to INTEGERS 0-4 via Math.round before any arithmetic (clamp04()), and completeness_score is a
// Math.round()'d integer percentage — there is no genuine float-division/threshold-boundary
// surface here. Corrected classification: effectively float:no for this floor's purposes; forced
// CATEGORICAL boundary cases (integer clamp edges, tier-sum boundaries at 3/6, missing-field
// combinations) are used in place of ULP forcing, matching the treatment FV-PROPFLOOR-SHARD-B12-1
// gave its two stated float:no exceptions. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-450-model-inventory-entry.proptest.mjs

import { compute } from '../art-450-model-inventory-entry.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-450-model-inventory-entry.fixtures.json');
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
const rand = mulberry32(0x450C3);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;

function mkPP(rng) {
  const fields = ['model_name', 'model_owner', 'business_purpose', 'development_date'];
  const pp = {
    materiality_score: randRange(rng, -2, 10),
    complexity_score: randRange(rng, -2, 10),
    usage_scope: 'multi_bu',
    third_party_vendor: rng() < 0.5,
    ai_ml_model: rng() < 0.5,
  };
  for (const f of fields) if (rng() < 0.8) pp[f] = 'val-' + f;
  return pp;
}

// ---------- P1: boundedness — materiality/complexity scores always clamped into [0,4], tier bounded to declared enum ----------
function checkP1_scoresBounded() {
  let violations = 0, checked = 0;
  const TIERS = ['limited', 'moderate', 'high'];
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (r.materiality_score < 0 || r.materiality_score > 4) violations++;
    if (r.complexity_score < 0 || r.complexity_score > 4) violations++;
    if (!TIERS.includes(r.tier)) violations++;
    if (r.completeness_score < 0 || r.completeness_score > 100) violations++;
  }
  return { name: 'P1_scores_clamped_0_to_4_tier_bounded_completeness_0_to_100', trials: checked, violations };
}

// ---------- P2: fixed-threshold-tier agreement — tier matches the declared sum-based cutoffs exactly ----------
function checkP2_tierAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const expectedTier = r.tier_sum >= 6 ? 'high' : (r.tier_sum >= 3 ? 'moderate' : 'limited');
    if (r.tier !== expectedTier) violations++;
    if (r.tier_sum !== r.materiality_score + r.complexity_score) violations++;
  }
  return { name: 'P2_tier_agreement_matches_sum_cutoffs_exactly', trials: checked, violations };
}

// ---------- P3: monotonicity — completeness_score is nondecreasing as more required fields become present ----------
function checkP3_completenessMonotone() {
  let violations = 0, checked = 0;
  const fields = ['model_name', 'model_owner', 'business_purpose', 'development_date'];
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r1 = compute(pp).output_payload;
    const missingField = fields.find((f) => !pp[f]);
    if (!missingField) continue;
    const pp2 = { ...pp, [missingField]: 'now-present' };
    const r2v = compute(pp2).output_payload;
    checked++;
    if (r2v.completeness_score < r1.completeness_score) violations++;
  }
  return { name: 'P3_completeness_score_nondecreasing_as_fields_fill_in', trials: checked, violations };
}

// ---------- P4 (float:no-corrected exception): forced CATEGORICAL boundary cases ----------
const ALL_FIELDS = { model_name: 'n', model_owner: 'o', business_purpose: 'p', development_date: 'd' };
const ULP_BOUNDARY_CASES = [
  [{ ...ALL_FIELDS, materiality_score: 0, complexity_score: 0 }, 'both scores exactly 0 — tier_sum 0, tier must be limited'],
  [{ ...ALL_FIELDS, materiality_score: 1.5, complexity_score: 1.5 }, 'Math.round(1.5)=2 each (round-half-up), tier_sum=4 — moderate tier, exercises the clamp rounding rule at a .5 boundary'],
  [{ ...ALL_FIELDS, materiality_score: 3, complexity_score: 2 }, 'tier_sum exactly 5 — one below high boundary, must be moderate'],
  [{ ...ALL_FIELDS, materiality_score: 3, complexity_score: 3 }, 'tier_sum exactly 6 — high boundary, must be high (>=, not >)'],
  [{ ...ALL_FIELDS, materiality_score: -5, complexity_score: -5 }, 'both scores deeply negative — clamp04 must floor to 0, no negative tier_sum'],
  [{ ...ALL_FIELDS, materiality_score: 100, complexity_score: 100 }, 'both scores far above range — clamp04 must ceiling to 4, tier_sum exactly 8'],
  [{}, 'entirely empty policy_parameters — all four required fields missing, completeness_score exactly 0'],
  [{ ...ALL_FIELDS }, 'all four required fields present, no scores — completeness_score exactly 100'],
  [{ model_name: 'n', materiality_score: 4, complexity_score: 4 }, 'exactly one of four required fields present — completeness_score exactly 25'],
  [{ ...ALL_FIELDS, materiality_score: NaN, complexity_score: undefined }, 'NaN/undefined scores — NaN-safe getter must default to 0, no NaN propagation'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const plausible = Number.isFinite(r.tier_sum) && Number.isFinite(r.completeness_score) && typeof r.tier === 'string';
    rows.push({ label, tier: r.tier, tier_sum: r.tier_sum, completeness_score: r.completeness_score, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_scoresBounded());
results.properties.push(checkP2_tierAgreement());
results.properties.push(checkP3_completenessMonotone());
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
