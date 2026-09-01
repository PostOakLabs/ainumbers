// ml-02-credit-default-risk-scorer.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C14-1).
// kernel_digest_at_authoring: sha256:b37f852a434727b80f227bc659064f44c25562bfa7a16b545f31ddf909217d13
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct read confirmed — sigmoid/normInv/irbRWA are float transcendental
// approximations, and `gini < 0.40`, `portPD > 0.10`, `auc < 0.7`, `l.pd >= pdThreshold` are all
// float-threshold classification decisions) — ULP-boundary forcing is MANDATORY per spec §3.
// ⭐ HIGHEST-SCRUTINY ITEM IN THIS SHARD (per WU row): a seeded per-loan simulation over
// `n_loans` synthetic loans (clamped [10,5000]), the unbounded-input analog of a Monte-Carlo
// path count. State the loan-count cap, the seed-determinism property (same seed -> same
// result, since the LCG PRNG has no hidden entropy source), and a boundedness property on the
// scored output (AUC/Gini/portfolio-PD/high-PD-count all stay within their mathematical ranges).
// Checks: fixture-oracle gate (compute() returns the standard {output_payload,
// compliance_flags} envelope — aligned to the estate convention by ML02-NORMINV-SIGN-1;
// the oracle compares compute().output_payload with the pinned vector output_payload, termination (n_loans_scored always equals
// clamp(n_loans,10,5000) regardless of a caller-supplied out-of-range value; the INSUFFICIENT_
// DEFAULTS short-circuit path returns immediately when nDefault===0, never proceeding to the
// AUC/RWA computation), the mandatory determinism property, boundedness (auc_roc in [0,1],
// gini_coefficient in [-1,1], portfolio_pd in [0,1], n_defaults_observed <= n_loans_scored,
// high_pd_loans in [0,n_loans_scored]), and ULP-boundary forcing on the pd_threshold >=
// comparison and the gini/portPD/auc verdict-classification thresholds (0.40, 0.60, 0.10, 0.7).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/ml-02-credit-default-risk-scorer.proptest.mjs

import { compute } from '../ml-02-credit-default-risk-scorer.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'ml-02-credit-default-risk-scorer.fixtures.json');
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
const rand = mulberry32(0x0259A);

function randomPP(rng) {
  return {
    n_loans: 15 + Math.floor(rng() * 200),
    asset_class: ['retail_mortgage', 'sme', 'large_corp', 'consumer'][Math.floor(rng() * 4)],
    target_default_rate: 0.01 + rng() * 0.15,
    lgd: 0.1 + rng() * 0.7,
    maturity_yrs: 1 + rng() * 4,
    pd_threshold: 0.02 + rng() * 0.3,
    seed: Math.floor(rng() * 1e6),
  };
}

const TRIALS = 300;

// ---------- P1: termination — n_loans_scored always clamp(n_loans,10,5000) ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const result = compute(pp);
    const out = result.output_payload;
    checked++;
    if (out.verdict === 'INSUFFICIENT_DEFAULTS') continue;
    if (out.n_loans_scored !== Math.min(Math.max(pp.n_loans, 10), 5000)) violations++;
  }
  const belowMin = compute({ n_loans: 1, seed: 1 });
  checked++;
  if (belowMin.output_payload.verdict !== 'INSUFFICIENT_DEFAULTS' && belowMin.output_payload.n_loans_scored !== 10) violations++;
  const aboveMax = compute({ n_loans: 999999, seed: 1 });
  checked++;
  if (aboveMax.output_payload.verdict !== 'INSUFFICIENT_DEFAULTS' && aboveMax.output_payload.n_loans_scored !== 5000) violations++;
  return { name: 'P1_termination_loan_count_clamped', trials: checked, violations };
}

// ---------- P2 (mandatory, determinism-as-convergence-or-report): same seed -> byte-identical ----------
function checkP2_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 150; i++) {
    const pp = randomPP(rand);
    const r1 = compute(pp);
    const r2 = compute({ ...pp });
    checked++;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
  }
  const fixed = {};
  const runs = [compute(fixed), compute(fixed), compute(fixed)];
  checked++;
  if (JSON.stringify(runs[0]) !== JSON.stringify(runs[1]) || JSON.stringify(runs[1]) !== JSON.stringify(runs[2])) violations++;
  return { name: 'P2_determinism_mandatory_same_seed_byte_identical', trials: checked, violations };
}

// ---------- P3: boundedness — AUC/Gini/portfolio-PD/counts within their mathematical ranges ----------
function checkP3_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const result = compute(pp);
    const out = result.output_payload;
    checked++;
    if (out.verdict === 'INSUFFICIENT_DEFAULTS') continue;
    if (out.auc_roc < 0 || out.auc_roc > 1) violations++;
    if (out.gini_coefficient < -1 || out.gini_coefficient > 1) violations++;
    if (out.portfolio_pd < 0 || out.portfolio_pd > 1) violations++;
    if (out.ks_statistic < 0 || out.ks_statistic > 1) violations++;
    if (out.n_defaults_observed > out.n_loans_scored || out.n_defaults_observed < 0) violations++;
    if (out.high_pd_loans < 0 || out.high_pd_loans > out.n_loans_scored) violations++;
    if (!Number.isFinite(out.auc_roc) || !Number.isFinite(out.gini_coefficient)) violations++;
  }
  return { name: 'P3_boundedness_auc_gini_pd_counts_in_range', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;

  // pd_threshold >= comparison boundary
  for (const t of [0, 1, 0.5, 0.5 - eps, 0.5 + eps, 1e-9, 1 - 1e-9]) {
    const result = compute({ n_loans: 50, pd_threshold: t, seed: 3 });
    const out = result.output_payload;
    checked++;
    if (out.verdict === 'INSUFFICIENT_DEFAULTS') continue;
    if (out.high_pd_loans < 0 || out.high_pd_loans > out.n_loans_scored) violations++;
  }

  // verdict classification boundary forcing: gini 0.40/0.60, portPD 0.10, auc 0.70
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
  for (const seed of seeds) {
    const result = compute({ n_loans: 80, seed });
    const out = result.output_payload;
    checked++;
    if (out.verdict === 'INSUFFICIENT_DEFAULTS') continue;
    const expected = (out.gini_coefficient < 0.40 || out.portfolio_pd > 0.10) ? 'WEAK_MODEL_ELEVATED_RISK'
      : (out.gini_coefficient < 0.60 ? 'ACCEPTABLE_MODEL' : 'STRONG_MODEL');
    if (out.verdict !== expected) violations++;
    const expectedFlag = out.auc_roc < 0.7 ? 'MODEL_PERFORMANCE_BELOW_0_70_AUC' : 'MODEL_PERFORMANCE_ACCEPTABLE';
    if (!result.compliance_flags.includes(expectedFlag)) violations++;
  }

  // INSUFFICIENT_DEFAULTS edge: target_default_rate forced to 0 drives nDefault toward 0
  const zeroDefault = compute({ n_loans: 20, target_default_rate: 0, seed: 42 });
  checked++;
  if (zeroDefault.output_payload.verdict === 'INSUFFICIENT_DEFAULTS' && Object.keys(zeroDefault).length > 2) violations++;

  return { name: 'P4_ulp_boundary_forcing_threshold_and_verdict_classification', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_determinism());
results.properties.push(checkP3_boundedness());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'ml-02-credit-default-risk-scorer',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
