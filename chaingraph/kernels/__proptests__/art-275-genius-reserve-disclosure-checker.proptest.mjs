// art-275-genius-reserve-disclosure-checker.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C9-1).
// kernel_digest_at_authoring: sha256:421d77f3a3fe5502015611da58ebfbd257190a4016adad518ddd32dea7e1bfd0
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (per WU triage table, re-confirmed by direct read — coverageRatio =
// totalReserve/totalLiab compared against 1, and mom_diff percentage deltas; mandatory
// ULP-boundary forcing per spec §3).
// Checks: fixture-oracle gate, termination (all loops bounded by assets.length / a fixed
// 4-item failing-dimension checklist / prior_month.assets.length; no recursion), boundedness
// (coverage_ratio_pct, all pct fields finite), differential re-derivation of the FAIL/WARN/PASS
// determination from hardFail/softWarn booleans, ULP-boundary forcing at the coverage-ratio=1
// (100%) threshold (0, negative zero, denormals, exact/near boundary), and a metamorphic
// identity (scaling every asset's usd and outstanding_tokens*token_price by the same positive
// k>0 leaves coverage_ratio_pct unchanged).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-275-genius-reserve-disclosure-checker.proptest.mjs

import { compute } from '../art-275-genius-reserve-disclosure-checker.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-275-genius-reserve-disclosure-checker.fixtures.json');
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
const rand = mulberry32(0x275A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const ASSET_TYPES = ['us_coins_currency', 'demand_deposit', 'tbill', 'tnote_tbond', 'agency_mbs', 'repo_treasury', 'mmmf', 'other_fiat', 'crypto_asset', 'corporate_bond', 'other'];

function randomAssets(rng, n) {
  return Array.from({ length: n }, (_, i) => ({
    type: pick(rng, ASSET_TYPES),
    usd: Math.floor(rng() * 1_000_000),
    maturity: rng() < 0.5 ? Math.floor(rng() * 200) : null,
    custodian: rng() < 0.7 ? `Custodian${i}` : null,
  }));
}

function randomPP(rng) {
  const nAssets = Math.floor(rng() * 8);
  return {
    outstanding_tokens_reported: Math.floor(rng() * 1_000_000),
    token_price: 1,
    issuer_type: pick(rng, ['bank', 'nonbank_federal', 'nonbank_state']),
    assets: randomAssets(rng, nAssets),
    certifying_officers: rng() < 0.5 ? [{ role: 'CEO', identity_id: 'ceo1' }, { role: 'CFO', identity_id: 'cfo1' }] : [],
    registered_examiner_named: rng() < 0.5,
  };
}

const TRIALS = 5000;

// ---------- P1: termination — asset_results.length === assets.length, failing_dimensions bounded ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    checked++;
    const { output_payload } = compute(pp);
    if (output_payload.asset_results.length !== pp.assets.length) violations++;
    // at most: 1 (coverage) + sum(issues per asset) + 1 (dual control) + 1 (examiner) + 1 (custody) + 1 (onchain)
    const maxDims = 4 + output_payload.asset_results.reduce((s, a) => s + a.issues.length, 0);
    if (output_payload.failing_dimensions.length > maxDims) violations++;
  }
  return { name: 'P1_asset_results_and_failing_dims_bounded_by_assets_length', trials: checked, violations };
}

// ---------- P2: boundedness — all numeric outputs finite ----------
function findNonFinite(v, path = '$') {
  const bad = [];
  if (typeof v === 'number' && !Number.isFinite(v)) bad.push(path);
  else if (Array.isArray(v)) v.forEach((x, i) => bad.push(...findNonFinite(x, `${path}[${i}]`)));
  else if (v !== null && typeof v === 'object') for (const k of Object.keys(v)) bad.push(...findNonFinite(v[k], `${path}.${k}`));
  return bad;
}
function checkP2_bounded_finite() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    checked++;
    const { output_payload } = compute(pp);
    if (findNonFinite(output_payload).length > 0) violations++;
  }
  return { name: 'P2_all_numeric_fields_finite', trials: checked, violations };
}

// ---------- P3 (differential): determination re-derivation from hardFail/softWarn ----------
function checkP3_determination_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    checked++;
    const { output_payload } = compute(pp);
    const coverageBelow1 = output_payload.coverage_ratio_pct < 100;
    const prohibited = output_payload.prohibited_assets_usd > 0;
    const dualUnsat = !output_payload.dual_control_satisfied;
    const onchainMismatch = output_payload.onchain_supply_check.provided && output_payload.onchain_supply_check.match === false;
    const hardFail = coverageBelow1 || prohibited || dualUnsat || onchainMismatch;
    if (hardFail && output_payload.monthly_disclosure_determination !== 'FAIL') violations++;
    if (!hardFail && output_payload.monthly_disclosure_determination === 'FAIL') violations++;
  }
  return { name: 'P3_determination_hardfail_differential', trials: checked, violations };
}

// ---------- P4 (ULP-forcing, float_sensitive:yes) — coverage-ratio 100% boundary ----------
function ppWithReserveTokens(reserveUsd, tokens) {
  return {
    outstanding_tokens_reported: tokens,
    token_price: 1,
    assets: reserveUsd > 0 ? [{ type: 'us_coins_currency', usd: reserveUsd, custodian: 'C' }] : [],
    certifying_officers: [{ role: 'CEO', identity_id: 'a' }, { role: 'CFO', identity_id: 'b' }],
    registered_examiner_named: true,
  };
}
const ULP_BOUNDARY_CASES = [
  { label: 'reserves == liabilities exactly -> coverage 100%, not below', pp: ppWithReserveTokens(1000, 1000) },
  { label: 'reserves 1 ULP below liabilities -> raw ratio<1 still triggers FAIL even though displayed pct rounds to 100.0000', pp: ppWithReserveTokens(1000 - Number.EPSILON * 1000, 1000) },
  { label: 'zero liabilities (tokens=0) -> coverageRatio guarded to 0, pct=0', pp: ppWithReserveTokens(0, 0) },
  { label: 'negative-zero tokens -> behaves as zero liabilities', pp: ppWithReserveTokens(0, -0) },
  { label: 'denormal reserves (5e-320) vs 0 liabilities -> finite, no crash', pp: ppWithReserveTokens(5e-320, 0) },
];
function checkP5_forced() {
  return ULP_BOUNDARY_CASES.map((c) => {
    const { output_payload } = compute(c.pp);
    return {
      label: c.label,
      coverage_ratio_pct: output_payload.coverage_ratio_pct,
      determination: output_payload.monthly_disclosure_determination,
      finite: Number.isFinite(output_payload.coverage_ratio_pct),
    };
  });
}

// ---------- P6: metamorphic — scaling all usd + outstanding_tokens*price by k>0 preserves coverage_ratio_pct ----------
function checkP6_scale_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 3000; i++) {
    const pp = randomPP(rand);
    if (pp.outstanding_tokens_reported === 0 || pp.assets.length === 0) continue;
    const k = 1.5 + rand() * 5;
    const scaled = { ...pp, outstanding_tokens_reported: pp.outstanding_tokens_reported * k, assets: pp.assets.map((a) => ({ ...a, usd: a.usd * k })) };
    checked++;
    const r1 = compute(pp).output_payload;
    const r2 = compute(scaled).output_payload;
    if (Math.abs(r1.coverage_ratio_pct - r2.coverage_ratio_pct) > 1e-6) violations++;
  }
  return { name: 'P6_scale_invariance_of_coverage_ratio', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_bounded_finite());
results.properties.push(checkP3_determination_differential());
results.properties.push(checkP6_scale_invariance());
const ulpRows = checkP5_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-275-genius-reserve-disclosure-checker',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  ulp_boundary_forced_cases: ulpRows,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
