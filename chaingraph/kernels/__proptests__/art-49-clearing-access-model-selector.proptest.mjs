// kernel_digest_at_authoring: sha256:ff9e78cf7128918984b55cbf858c74f3ca3a6e818389e067899863b8cd570034
//
// FV-PROPFLOOR-SHARD-B14-1 — property-test floor for art-49-clearing-access-model-selector.
// Class B (bounded-numeric/cost-model), FLOAT-SENSITIVE — cash_notional_annual, repo_notional_daily,
// im_funding_rate, capital_charge_rate, pledged_collateral_value are continuous user-supplied floats
// feeding straight into unrounded division/normalization (norm(), dealerNet cap, blended score); ULP-
// boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-49-clearing-access-model-selector.proptest.mjs

import { compute } from '../art-49-clearing-access-model-selector.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-49-clearing-access-model-selector.fixtures.json');
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
const rand = mulberry32(0x49B22D);
const TRIALS = 8000;
const MODELS = ['direct', 'sponsored_done_with', 'sponsored_done_away', 'agent_done_away'];

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

function mkPP(rng) {
  return {
    firm_type: pick(rng, ['hedge-fund', 'bank-dealer', 'nonbank-dealer', 'mmf', 'asset-manager']),
    cash_notional_annual: randRange(rng, 0, 2e11),
    repo_notional_daily: randRange(rng, 0, 5e9),
    current_access: pick(rng, ['direct-member', 'sponsored', 'agent', 'none']),
    num_executing_dealers: Math.floor(randRange(rng, 0, 10)),
    want_execution_flexibility: rng() < 0.5,
    capital_constrained: rng() < 0.5,
    margin_segregation_pref: pick(rng, ['no-pref', 'segregated', 'non-segregated']),
    im_funding_rate: randRange(rng, 0, 0.20),
    capital_charge_rate: randRange(rng, 0, 0.02),
    collateral_in_lieu_eligible: rng() < 0.5,
    pledged_collateral_value: randRange(rng, 0, 1e9),
  };
}

// ---------- P1: recommended_model is always the eligible model with the highest blended score ----------
function checkP1_bestIsMaxBlendedEligible() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { model_scores, recommended_model } = r.output_payload;
    let best = null, bestBlended = -Infinity;
    for (const m of MODELS) {
      const s = model_scores[m];
      if (s.eligible && s.blended > bestBlended) { bestBlended = s.blended; best = m; }
    }
    if (recommended_model !== best) violations++;
  }
  return { name: 'P1_recommended_model_is_max_blended_among_eligible', trials: checked, violations };
}

// ---------- P2: direct eligibility is an exact function of firm_type and fee base > $50B ----------
function checkP2_directEligibilityExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const feeBase = (Number(pp.cash_notional_annual) || 0) + (Number(pp.repo_notional_daily) || 0) * 250;
    const expected = (pp.firm_type === 'bank-dealer' || pp.firm_type === 'nonbank-dealer') && feeBase > 50e9;
    const { model_scores, eligibility_gates } = r.output_payload;
    if (model_scores.direct.eligible !== expected) violations++;
    if (!expected !== eligibility_gates.includes('DIRECT_MEMBERSHIP_INELIGIBLE')) violations++;
  }
  return { name: 'P2_direct_eligibility_exact_function_of_firm_type_and_50B_threshold', trials: checked, violations };
}

// ---------- P3: all four blended scores are finite and cost/exec sub-scores bounded 0..100 ----------
function checkP3_scoresBoundedFinite() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    for (const m of MODELS) {
      const s = r.output_payload.model_scores[m];
      if (!Number.isFinite(s.blended)) violations++;
      if (s.cost_score < 0 || s.cost_score > 100) violations++;
      if (s.exec_score < 0 || s.exec_score > 100) violations++;
      if (!Number.isFinite(r.output_payload.annual_cost_by_model[m])) violations++;
      if (!Number.isFinite(r.output_payload.im_estimate_by_model[m])) violations++;
    }
  }
  return { name: 'P3_all_model_scores_and_estimates_finite_and_bounded', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ firm_type: 'bank-dealer', cash_notional_annual: 50e9, repo_notional_daily: 0 }, 'feeBase exactly $50B (boundary is strict >, not >=) — direct must be INELIGIBLE at exactly the threshold'],
  [{ firm_type: 'bank-dealer', cash_notional_annual: 50e9 + 1, repo_notional_daily: 0 }, 'feeBase 1 unit above $50B threshold — direct must be ELIGIBLE'],
  [{ firm_type: 'bank-dealer', cash_notional_annual: 50e9 * (1 + Number.EPSILON), repo_notional_daily: 0 }, 'feeBase 1 ULP above $50B — boundary must resolve consistently with the strict > comparison'],
  [{ cash_notional_annual: 0, repo_notional_daily: 0 }, 'feeBase and imNotional exactly zero — all costs/IM must be exactly 0, no NaN, norm() with hi===lo must return 100 not divide-by-zero NaN'],
  [{ cash_notional_annual: -0, repo_notional_daily: -0 }, 'negative-zero notionals — must behave as zero, no NaN'],
  [{ num_executing_dealers: 0 }, 'num_executing_dealers exactly 0 — Math.max(1,...) floor must apply, dealers=1, no division by zero'],
  [{ num_executing_dealers: NaN }, 'num_executing_dealers is NaN — Number(NaN)||1 coalesces to 1 via the max(1,...) floor, must not propagate NaN'],
  [{ cash_notional_annual: Number.MAX_SAFE_INTEGER, repo_notional_daily: Number.MAX_SAFE_INTEGER }, 'notionals at MAX_SAFE_INTEGER — costs/IM must remain finite, not overflow to Infinity'],
  [{ im_funding_rate: NaN, cash_notional_annual: 1e9 }, 'im_funding_rate NaN — Number(NaN)||0.05 coalesces to the 0.05 default, must not propagate NaN into imFunding'],
  [{ pledged_collateral_value: Number.MIN_VALUE, collateral_in_lieu_eligible: true, repo_notional_daily: 1e6 }, 'pledged_collateral_value smallest positive double — collateral_sufficient comparison must remain finite and false (insufficient), no NaN'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { model_scores, annual_cost_by_model, recommended_model, collateral_in_lieu } = r.output_payload;
    const allFinite = MODELS.every((m) => Number.isFinite(model_scores[m].blended) && Number.isFinite(annual_cost_by_model[m]));
    const plausible = allFinite && typeof recommended_model === 'string' && Number.isFinite(collateral_in_lieu.lien_required_usd);
    rows.push({ label, input: pp, recommended_model, direct_eligible: model_scores.direct.eligible, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_bestIsMaxBlendedEligible());
results.properties.push(checkP2_directEligibilityExact());
results.properties.push(checkP3_scoresBoundedFinite());
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
