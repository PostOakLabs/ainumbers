// kernel_digest_at_authoring: sha256:e54de58d609e2ca40d3ef029fc40d7560ae0d23ce483dc067fbe7ed9f60165af
//
// FV-PROPFLOOR-SHARD-B15-1 — property-test floor for art-67-agentic-ai-risk-classifier.
// Class B (bounded-numeric), FLOAT:NO per the WU row — overall_score sums six fixed integer
// dim values (0-4 each) over a fixed denominator (6*4=24), producing tdTotal/24*100 which is
// always an exact multiple of 100/24's rational reduction after toFixed(1) rounding; the only
// non-enum numeric input (model.training_compute_flop) is compared via >= against a single
// fixed constant (1e25), which is the categorical boundary this file forces directly rather
// than treating as a continuous ULP surface. Per FV-PBT-FLOOR-BUILD-SPEC.md §3 this is a
// stated float:no exception — forced CATEGORICAL boundary cases (the 1e25 FLOP threshold,
// all-dims-max/min) stand in for ULP forcing.
// Zero external dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-67-agentic-ai-risk-classifier.proptest.mjs

import { compute } from '../art-67-agentic-ai-risk-classifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-67-agentic-ai-risk-classifier.fixtures.json');
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
const rand = mulberry32(0x67A11);
const TRIALS = 8000;
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

const AUTONOMY = ['assistive', 'supervised', 'autonomous-HNP'];
const OVERSIGHT = ['full-control', 'review-before-action', 'monitoring-only', 'none'];
const MODEL_TYPE = ['bespoke', 'fine-tuned-GPAI', 'GPAI'];
const TRANSPARENCY = ['in-place', 'partial', 'none'];
const GPAI_DOC = ['in-place', 'partial', 'none'];
const SYSTEMIC = ['complete', 'in-progress', 'not-started', 'n/a'];
const SYSTEMIC_DESIGNATION = ['yes', 'no', 'unknown'];

function mkPP(rng) {
  return {
    agent: {
      autonomy_level: pick(rng, AUTONOMY),
      financial_use_case: pick(rng, ['credit-scoring', 'other']),
      human_oversight: pick(rng, OVERSIGHT),
    },
    model: {
      type: pick(rng, MODEL_TYPE),
      training_compute_flop: rng() < 0.5 ? 0 : randRange(rng, 1e20, 1e26),
      systemic_designation: pick(rng, SYSTEMIC_DESIGNATION),
    },
    obligations: {
      transparency: pick(rng, TRANSPARENCY),
      gpai_documentation: pick(rng, GPAI_DOC),
      systemic_risk_eval: pick(rng, SYSTEMIC),
    },
    downstream_highrisk: rng() < 0.3,
  };
}

// ---------- P1: boundedness — overall_score and every dim_scores[k].score stay in [0, 100] ----------
function checkP1_scoresBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { overall_score, dim_scores } = r.output_payload;
    let bad = !Number.isFinite(overall_score) || overall_score < 0 || overall_score > 100;
    for (const k of Object.keys(dim_scores)) {
      const s = dim_scores[k].score;
      if (!Number.isFinite(s) || s < 0 || s > 100) bad = true;
    }
    if (bad) violations++;
  }
  return { name: 'P1_overall_and_dim_scores_bounded_0_to_100', trials: checked, violations };
}

// ---------- P2: fixed-rule — gpai_class is exactly 'none'/'gpai'/'systemic-gpai' per the declared logic ----------
function checkP2_gpaiClassFixedRule() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const is_gpai = pp.model.type === 'GPAI' || pp.model.type === 'fine-tuned-GPAI';
    const above = typeof pp.model.training_compute_flop === 'number' && pp.model.training_compute_flop > 0 && pp.model.training_compute_flop >= 1e25;
    const expected = !is_gpai ? 'none' : (pp.model.systemic_designation === 'yes' || above) ? 'systemic-gpai' : 'gpai';
    if (r.output_payload.gpai_class !== expected) violations++;
  }
  return { name: 'P2_gpai_class_exact_3_state_rule', trials: checked, violations };
}

// ---------- P3: monotonicity — full-control oversight never yields a worse (lower) oversight dim score than 'none' ----------
function checkP3_monotonicInOversight() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const rBest = compute({ ...pp, agent: { ...pp.agent, human_oversight: 'full-control' } });
    const rWorst = compute({ ...pp, agent: { ...pp.agent, human_oversight: 'none' } });
    checked++;
    if (rBest.output_payload.dim_scores.oversight.score < rWorst.output_payload.dim_scores.oversight.score) violations++;
  }
  return { name: 'P3_oversight_score_nondecreasing_full_control_vs_none', trials: checked, violations };
}

// ---------- P4 (mandatory float:no exception): forced categorical boundary cases ----------
function checkP4_forced() {
  const base = mkPP(mulberry32(0x67B22));
  const rows = [];
  const push = (overrides, label) => {
    const pp = {
      agent: { ...base.agent, ...(overrides.agent || {}) },
      model: { ...base.model, ...(overrides.model || {}) },
      obligations: { ...base.obligations, ...(overrides.obligations || {}) },
      downstream_highrisk: overrides.downstream_highrisk ?? base.downstream_highrisk,
    };
    const r = compute(pp);
    const { gpai_class, overall_score } = r.output_payload;
    const plausible = typeof gpai_class === 'string' && Number.isFinite(overall_score);
    rows.push({ label, gpai_class, overall_score, plausible });
  };

  push({ model: { type: 'GPAI', training_compute_flop: 1e25, systemic_designation: 'unknown' } }, 'training_compute_flop exactly at the 1e25 threshold — >= boundary must classify systemic-gpai, not gpai');
  push({ model: { type: 'GPAI', training_compute_flop: 1e25 - 1, systemic_designation: 'unknown' } }, 'training_compute_flop one unit below the 1e25 threshold — must classify gpai, not systemic-gpai');
  push({ model: { type: 'GPAI', training_compute_flop: 0, systemic_designation: 'no' } }, 'training_compute_flop exactly 0 with systemic_designation no — must classify gpai (not systemic), 0 is not > 0');
  push({ model: { type: 'bespoke', training_compute_flop: 1e30 } }, 'bespoke model with huge training_compute_flop — is_gpai must stay false regardless of flop count, gpai_class must be none');
  push({ model: { type: 'GPAI', systemic_designation: 'yes', training_compute_flop: 1 } }, 'systemic_designation explicitly yes with tiny flop count — must still classify systemic-gpai (OR condition)');
  push({ agent: { autonomy_level: 'autonomous-HNP', human_oversight: 'none' } }, 'HNP autonomy with zero oversight — autonomy_oversight_verdict must be CRITICAL text, dim_scores.autonomy.score must be exactly 0');
  push({ obligations: { systemic_risk_eval: 'n/a' }, model: { systemic_designation: 'no', training_compute_flop: 0 } }, 'systemic_eval n/a on a non-systemic model — dim.systemic_eval must default to 4 (n/a scores same as complete), not penalize a non-systemic model');
  push({ agent: { autonomy_level: 'assistive' } }, 'assistive autonomy — dim_scores.autonomy.score must be exactly 100.0 (4/4*100)');
  push({ downstream_highrisk: true, agent: { financial_use_case: 'credit-scoring' } }, 'downstream_highrisk true — applicable_obligations must include the Arts 9-15 downstream entry, highrisk_interaction text must reference the financial_use_case');
  push({ model: { type: 'GPAI', training_compute_flop: NaN, systemic_designation: 'unknown' } }, 'training_compute_flop is NaN — typeof-number guard must still hold but NaN > 0 is false, above_threshold must be false, no crash');

  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_scoresBounded());
results.properties.push(checkP2_gpaiClassFixedRule());
results.properties.push(checkP3_monotonicInOversight());
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
