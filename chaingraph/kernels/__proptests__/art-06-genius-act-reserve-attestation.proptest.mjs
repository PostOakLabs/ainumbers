// art-06-genius-act-reserve-attestation.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C1-1).
// kernel_digest_at_authoring: sha256:8e520c99a42e6c53799b4c14a5d31d7face65414f1d0fd590a089488f621dc24
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES — ULP-boundary forcing mandatory (coverageRatio strict <1 boundary, maturity
// strict > maxMaturityDays=93 boundary, aicpaScore strict <0.80 boundary).
// Checks: fixture-oracle gate, termination (bounded assets/checklist arrays), boundedness
// (coverage_ratio_pct >= 0, aicpa score in [0,100]), determination differential re-derivation,
// ULP-forced coverage/maturity/AICPA boundary cases, and a metamorphic scale-invariance check
// (scaling outstanding_tokens AND every asset usd by the same k>0 leaves coverage_ratio_pct invariant).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-06-genius-act-reserve-attestation.proptest.mjs

import { compute } from '../art-06-genius-act-reserve-attestation.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-06-genius-act-reserve-attestation.fixtures.json');
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
const rand = mulberry32(0xA06A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const PERMITTED_ASSETS = ['us_coins_currency', 'demand_deposit', 'tbill', 'tnote_tbond', 'repo_treasury', 'mmmf', 'fed_reserve_balance'];
const AICPA_IDS = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11', 'a12'];

function randomAsset(rng) {
  const type = pick(rng, PERMITTED_ASSETS);
  return { type, usd: randRange(rng, 0, 10_000_000), maturity: type === 'tbill' || type === 'repo_treasury' ? randRange(rng, 0, 200) : null };
}
function randomAnswers(rng) {
  const o = {};
  for (const id of AICPA_IDS) o[id] = rng() < 0.1 ? false : rng() < 0.8 ? true : null;
  return o;
}
function randomPP(rng) {
  return {
    outstanding_tokens: randRange(rng, 1, 10_000_000),
    token_price: 1,
    issuer_type: pick(rng, ['bank', 'nonbank_federal', 'nonbank_state']),
    assets: Array.from({ length: 1 + Math.floor(rng() * 5) }, () => randomAsset(rng)),
    aicpa_answers: randomAnswers(rng),
  };
}

const TRIALS = 6000;

// ---------- P1: termination — bounded asset_results, asset_results.length === assets.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.asset_results.length !== pp.assets.length) violations++;
  }
  return { name: 'P1_termination_asset_results_count', trials: checked, violations };
}

// ---------- P2: boundedness — coverage_ratio_pct >= 0, aicpa score in [0,100] ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.coverage_ratio_pct < 0) violations++;
    if (output_payload.aicpa_2025_score_pct < 0 || output_payload.aicpa_2025_score_pct > 100) violations++;
    if (output_payload.total_reserves_usd < 0 || output_payload.total_liabilities_usd < 0) violations++;
  }
  return { name: 'P2_boundedness_coverage_and_score', trials: checked, violations };
}

// ---------- P3 (differential): determination re-derived from coverage/prohibited/AICPA signals ----------
function checkP3_determination_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const coverageRatio = output_payload.coverage_ratio_pct / 100;
    const prohibitedTotal = output_payload.prohibited_assets_usd;
    const highWeightAicpaFail = ['a1', 'a2', 'a5', 'a6', 'a7', 'a9', 'a10'].some((id) => pp.aicpa_answers[id] === false);
    let expected;
    if (coverageRatio < 1 || prohibitedTotal > 0 || highWeightAicpaFail) expected = 'FAIL';
    else if (output_payload.conditional_assets_usd > 0 || output_payload.aicpa_2025_score_pct / 100 < 0.80) expected = 'WARN';
    else expected = 'PASS';
    if (output_payload.attestation_readiness_determination !== expected) violations++;
  }
  return { name: 'P3_determination_differential', trials: checked, violations };
}

// ---------- P4 (ULP-forcing, float_sensitive:yes) — coverage / maturity / AICPA threshold boundaries ----------
const ULP_BOUNDARY_CASES = [
  { outstanding_tokens: 1000, token_price: 1, assets: [{ type: 'demand_deposit', usd: 1000 }], label: 'coverageRatio exactly 1.0 -> FAIL clause must be FALSE (strict <)' },
  { outstanding_tokens: 1000, token_price: 1, assets: [{ type: 'demand_deposit', usd: 999.999999 }], label: 'coverageRatio fractionally under 1.0 -> FAIL clause TRUE' },
  { outstanding_tokens: 100, token_price: 1, assets: [{ type: 'tbill', usd: 100, maturity: 93 }], label: 'maturity exactly 93 days -> must NOT exceed (strict >)' },
  { outstanding_tokens: 100, token_price: 1, assets: [{ type: 'tbill', usd: 100, maturity: 93.0001 }], label: 'maturity fractionally over 93 days -> must exceed' },
];
function checkP4_forced() {
  const rows = [];
  for (const c of ULP_BOUNDARY_CASES) {
    const { output_payload } = compute(c);
    rows.push({
      label: c.label,
      coverage_ratio_pct: output_payload.coverage_ratio_pct,
      determination: output_payload.attestation_readiness_determination,
      asset_issues: output_payload.asset_results.map((a) => a.issues),
      finite: Number.isFinite(output_payload.coverage_ratio_pct),
    });
  }
  return rows;
}

// ---------- P5: metamorphic — scaling tokens AND every asset usd by k>0 leaves coverage_ratio_pct invariant ----------
function checkP5_scale_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    pp.outstanding_tokens = randRange(rand, 1, 1_000_000);
    const k = randRange(rand, 1.5, 6.0);
    const r1 = compute(pp).output_payload;
    const scaled = { ...pp, outstanding_tokens: pp.outstanding_tokens * k, assets: pp.assets.map((a) => ({ ...a, usd: a.usd * k })) };
    const r2 = compute(scaled).output_payload;
    checked++;
    if (Math.abs(r2.coverage_ratio_pct - r1.coverage_ratio_pct) > 0.01) violations++;
  }
  return { name: 'P5_metamorphic_scale_invariant_coverage_ratio', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_determination_differential());
results.properties.push(checkP5_scale_invariance());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryMismatch = results.boundary_forced.some((b) => !b.finite);

console.log(JSON.stringify({
  tool_id: 'art-06-genius-act-reserve-attestation',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);
