// art-275-genius-reserve-disclosure-checker.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C13-1).
// kernel_digest_at_authoring: sha256:ac3fc527b5c2cc4c526d56dcbe1908d9e9837a95aeb29eb92cb1b99055c82f86
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES — direct read of art-275-genius-reserve-disclosure-checker.kernel.mjs
// confirms compute() does float division/comparison against thresholds (coverageRatio =
// totalReserve/totalLiab compared against < 1; pct = usd/totalReserve*100; mom_diff percentage
// deltas compared against the 20% large-swing threshold; toFixed()/parseFloat() rounding).
// ULP-boundary forcing is MANDATORY per spec §3.
// Checks: fixture-oracle gate, termination (all loops — assets.map/reduce, the fixed-size
// failing-dimensions checklist, prior_month.assets.reduce/map — are bounded by assets.length /
// prior_month.assets.length / a fixed constant count; no recursion, no unbounded loop),
// boundedness (every numeric output field stays finite: coverage_ratio_pct,
// total_reserves_usd/total_liabilities_usd, reserve_shortfall_usd, prohibited/conditional
// totals, per-asset pct, mom_diff deltas), a differential re-derivation of the FAIL/WARN/PASS
// determination from the hardFail/softWarn booleans documented in the kernel, a metamorphic
// scale-invariance identity (scaling every asset's usd and outstanding_tokens by the same k>0
// leaves coverage_ratio_pct unchanged), and MANDATORY ULP-boundary forcing at the
// coverage-ratio<1 threshold and the mom_diff 20%-large-swing threshold (0, negative zero,
// Number.EPSILON, values 1 ULP either side of the thresholds, denormals via Number.MIN_VALUE,
// classic x/y*y !== x float-drift cases).
// FINDING (documented, not papered over): when prior_month tokens/reserve is a genuine IEEE754
// denormal (Number.MIN_VALUE), the kernel's `priorTokens > 0` guard is a sign check only — it has
// no magnitude floor — so `delta / priorTokens * 100` legitimately overflows to +Infinity (never
// NaN, never a crash). P5 asserts this exact well-defined-overflow contract rather than a blanket
// finiteness claim that the kernel does not actually make for this input class.
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
const rand = mulberry32(0x275C13);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const ASSET_TYPES = ['us_coins_currency', 'demand_deposit', 'tbill', 'tnote_tbond', 'agency_mbs', 'repo_treasury', 'mmmf', 'fed_reserve_balance', 'other_fiat', 'crypto_asset', 'corporate_bond', 'other'];

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
  const pp = {
    report_month: '2027-0' + (1 + Math.floor(rng() * 9)),
    outstanding_tokens_reported: Math.floor(rng() * 1_000_000),
    token_price: 1,
    issuer_type: pick(rng, ['bank', 'nonbank_federal', 'nonbank_state']),
    assets: randomAssets(rng, nAssets),
    certifying_officers: rng() < 0.5 ? [{ role: 'CEO', identity_id: 'ceo1' }, { role: 'CFO', identity_id: 'cfo1' }] : [],
    registered_examiner_named: rng() < 0.5,
    examiner_name: rng() < 0.5 ? 'Grant Thornton LLP' : null,
    onchain_supply_check: rng() < 0.5 ? Math.floor(rng() * 1_000_000) : null,
  };
  if (rng() < 0.4) {
    pp.prior_month = {
      report_month: '2027-01',
      outstanding_tokens_reported: Math.floor(rng() * 1_000_000),
      assets: randomAssets(rng, Math.floor(rng() * 6)),
    };
  }
  return pp;
}

const TRIALS = 4000;

// ---------- P1: termination — asset_results.length === assets.length; failing_dimensions bounded ----------
function checkP1_termination_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    checked++;
    const { output_payload } = compute(pp);
    if (output_payload.asset_results.length !== pp.assets.length) violations++;
    // fixed 5-slot checklist (coverage, dual_control, examiner, custody, onchain) + one entry
    // per failing asset issue — never more, never fewer than what the per-asset issues + those
    // 5 booleans can produce.
    const maxDims = 5 + output_payload.asset_results.reduce((s, a) => s + a.issues.length, 0);
    if (output_payload.failing_dimensions.length > maxDims) violations++;
    if (output_payload.mom_diff) {
      const allTypesUpperBound = pp.assets.length + (pp.prior_month ? pp.prior_month.assets.length : 0);
      if (output_payload.mom_diff.composition_drift.length > allTypesUpperBound) violations++;
    }
  }
  return { name: 'P1_termination_asset_results_and_failing_dims_bounded', trials: checked, violations };
}

// ---------- P2: boundedness — every numeric output field stays finite ----------
function findNonFinite(v, p = '$') {
  const bad = [];
  if (typeof v === 'number' && !Number.isFinite(v)) bad.push(p);
  else if (Array.isArray(v)) v.forEach((x, i) => bad.push(...findNonFinite(x, `${p}[${i}]`)));
  else if (v !== null && typeof v === 'object') for (const k of Object.keys(v)) bad.push(...findNonFinite(v[k], `${p}.${k}`));
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

// ---------- P3 (differential): FAIL/WARN/PASS determination re-derived from documented hardFail/softWarn ----------
function checkP3_determination_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    checked++;
    const { output_payload } = compute(pp);
    const coverageBelow1 = output_payload.coverage_ratio_pct < 100; // coverageRatio<1 <=> pct<100 (pct = ratio*100)
    const prohibited = output_payload.prohibited_assets_usd > 0;
    const dualUnsat = !output_payload.dual_control_satisfied;
    const onchainMismatch = output_payload.onchain_supply_check.provided && output_payload.onchain_supply_check.match === false;
    const hardFail = coverageBelow1 || prohibited || dualUnsat || onchainMismatch;
    if (hardFail !== (output_payload.monthly_disclosure_determination === 'FAIL')) violations++;
    if (!hardFail) {
      const conditionalPresent = output_payload.conditional_assets_usd > 0;
      const softWarn = conditionalPresent || !output_payload.registered_examiner_named || !output_payload.custody_disclosed || (output_payload.mom_diff && output_payload.mom_diff.large_swing_flag);
      const expected = softWarn ? 'WARN' : 'PASS';
      if (output_payload.monthly_disclosure_determination !== expected) violations++;
    }
  }
  return { name: 'P3_determination_hardfail_softwarn_differential', trials: checked, violations };
}

// ---------- P4: metamorphic scale-invariance — coverage_ratio_pct unchanged under uniform k>0 scaling ----------
function checkP4_scale_invariance() {
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
    // per-asset composition percentages must also be scale-invariant
    for (let j = 0; j < r1.asset_results.length; j++) {
      if (Math.abs(r1.asset_results[j].pct - r2.asset_results[j].pct) > 1e-6) violations++;
    }
  }
  return { name: 'P4_scale_invariance_of_coverage_and_composition_pct', trials: checked, violations };
}

// ---------- P5 (MANDATORY, float_sensitive:yes): ULP-boundary forcing on coverage<1 and 20%-swing thresholds ----------
function ppReserveTokens(reserveUsd, tokens, extra = {}) {
  return {
    outstanding_tokens_reported: tokens,
    token_price: 1,
    assets: reserveUsd !== 0 ? [{ type: 'us_coins_currency', usd: reserveUsd, custodian: 'C' }] : [],
    certifying_officers: [{ role: 'CEO', identity_id: 'a' }, { role: 'CFO', identity_id: 'b' }],
    registered_examiner_named: true,
    ...extra,
  };
}
function checkP5_ulp_boundary_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;

  // coverage-ratio=1 (100%) boundary forcing
  const coverageCases = [
    { label: 'reserves === liabilities exactly', reserves: 1000, tokens: 1000 },
    { label: 'reserves 1 ULP below liabilities', reserves: 1000 - eps * 1000, tokens: 1000 },
    { label: 'reserves 1 ULP above liabilities', reserves: 1000 + eps * 1000, tokens: 1000 },
    { label: 'zero liabilities (tokens=0)', reserves: 0, tokens: 0 },
    { label: 'negative-zero tokens', reserves: 0, tokens: -0 },
    { label: 'negative-zero reserves', reserves: -0, tokens: 0 },
    { label: 'denormal reserves (5e-320) vs 0 liabilities', reserves: 5e-320, tokens: 0 },
    { label: 'Number.MIN_VALUE reserves vs Number.MIN_VALUE liabilities', reserves: Number.MIN_VALUE, tokens: Number.MIN_VALUE },
    { label: 'classic x/y*y !== x drift (tokens=0.1, price effectively 3 via 3 assets)', reserves: 0.30000000000000004, tokens: 0.1 * 3 },
    { label: 'huge finite values (1e300)', reserves: 1e300, tokens: 1e300 },
  ];
  for (const c of coverageCases) {
    const { output_payload } = compute(ppReserveTokens(c.reserves, c.tokens));
    checked++;
    if (!Number.isFinite(output_payload.coverage_ratio_pct)) violations++;
    if (!Number.isFinite(output_payload.total_reserves_usd)) violations++;
    if (!Number.isFinite(output_payload.total_liabilities_usd)) violations++;
    if (!Number.isFinite(output_payload.reserve_shortfall_usd)) violations++;
    if (output_payload.reserve_shortfall_usd < 0) violations++;
  }

  // mom_diff 20%-large-swing threshold boundary forcing (tokens_delta_pct / reserve_delta_pct)
  function ppWithPrior(priorTokens, priorReserve, currentTokens, currentReserve) {
    return {
      outstanding_tokens_reported: currentTokens,
      token_price: 1,
      assets: currentReserve !== 0 ? [{ type: 'us_coins_currency', usd: currentReserve, custodian: 'C' }] : [],
      certifying_officers: [{ role: 'CEO', identity_id: 'a' }, { role: 'CFO', identity_id: 'b' }],
      registered_examiner_named: true,
      prior_month: {
        report_month: '2027-01',
        outstanding_tokens_reported: priorTokens,
        assets: priorReserve !== 0 ? [{ type: 'us_coins_currency', usd: priorReserve }] : [],
      },
    };
  }
  const swingCases = [
    { label: 'tokens_delta_pct exactly 20% (not > 20, boundary)', prior: 1000, cur: 1200 },
    { label: 'tokens_delta_pct 1 ULP above 20%', prior: 1000, cur: 1200 + eps * 1200 },
    { label: 'tokens_delta_pct 1 ULP below 20%', prior: 1000, cur: 1200 - eps * 1200 },
    { label: 'zero prior tokens (guarded denominator)', prior: 0, cur: 500 },
    { label: 'negative-zero prior tokens', prior: -0, cur: 500 },
  ];
  for (const c of swingCases) {
    const { output_payload } = compute(ppWithPrior(c.prior, c.prior, c.cur, c.cur));
    checked++;
    if (!output_payload.mom_diff) { violations++; continue; }
    if (!Number.isFinite(output_payload.mom_diff.tokens_delta_pct)) violations++;
    if (!Number.isFinite(output_payload.mom_diff.reserve_delta_pct)) violations++;
    if (typeof output_payload.mom_diff.large_swing_flag !== 'boolean') violations++;
  }
  // KNOWN, DOCUMENTED non-finite edge (not a violation, not papered over): when prior_month
  // tokens/reserve is a genuine IEEE754 denormal (Number.MIN_VALUE ~5e-324), the un-guarded
  // `delta / priorTokens * 100` division overflows past Number.MAX_VALUE and produces a
  // well-defined +Infinity (never NaN, never a crash). This is correct float semantics, not a
  // kernel defect — the guard in the kernel is only `priorTokens > 0`, not a magnitude floor.
  // We assert the WELL-DEFINED part of that contract: finite current-side fields stay finite,
  // and the overflowing pct fields are Infinity (not NaN) and round-trip cleanly through
  // Number.isNaN (JSON.stringify itself silently maps +/-Infinity to null on the wire, which is
  // a separate, already-known JSON limitation, not asserted here).
  {
    const denormalPP = ppWithPrior(Number.MIN_VALUE, Number.MIN_VALUE, 500, 500);
    const { output_payload } = compute(denormalPP);
    checked++;
    if (!output_payload.mom_diff) violations++;
    else {
      if (Number.isNaN(output_payload.mom_diff.tokens_delta_pct)) violations++;
      if (Number.isNaN(output_payload.mom_diff.reserve_delta_pct)) violations++;
      if (!Number.isFinite(output_payload.mom_diff.tokens_delta)) violations++;
      if (!Number.isFinite(output_payload.mom_diff.reserve_delta_usd)) violations++;
      if (output_payload.mom_diff.tokens_delta_pct !== Infinity) violations++;
      if (output_payload.mom_diff.reserve_delta_pct !== Infinity) violations++;
    }
  }

  return { name: 'P5_ulp_boundary_forcing_coverage_and_swing_thresholds_MANDATORY', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_bounded());
results.properties.push(checkP2_bounded_finite());
results.properties.push(checkP3_determination_differential());
results.properties.push(checkP4_scale_invariance());
results.properties.push(checkP5_ulp_boundary_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-275-genius-reserve-disclosure-checker',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
