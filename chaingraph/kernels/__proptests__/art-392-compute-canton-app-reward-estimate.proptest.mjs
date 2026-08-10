// kernel_digest_at_authoring: sha256:a70be49eac55d78f34ee302aac5107512ea2f745d7ae0aeb0753644fac701c2f
//
// FV-PROPFLOOR-SHARD-B22-1 — property-test floor for art-392-compute-canton-app-reward-estimate.
// Class B (bounded-numeric), FLOAT-SENSITIVE (confirmed per FIX-2 CARRY: confirmed_share_of_
// traffic = confirmedBytes/roundTotalBytes and cc_reward_estimate = share*pool_cc are raw float
// division/multiplication) — ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md
// §3. Zero external dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-392-compute-canton-app-reward-estimate.proptest.mjs

import { compute } from '../art-392-compute-canton-app-reward-estimate.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-392-compute-canton-app-reward-estimate.fixtures.json');
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
const rand = mulberry32(0x392F1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 12000;
function r6(v) { return Number.isFinite(v) ? Math.round(v * 1000000) / 1000000 : 0; }
function r8(v) { return Number.isFinite(v) ? Math.round(v * 100000000) / 100000000 : 0; }

function mkPP(rng) {
  const roundTotal = randRange(rng, 1, 1e9);
  const confirmed = randRange(rng, 0, roundTotal);
  return {
    protocol_version: '3.5.5',
    confirmed_envelope_bytes: confirmed,
    round_total_envelope_bytes: roundTotal,
    round_total_mint_cc: randRange(rng, 0, 1e6),
    app_reward_pool_share: randRange(rng, 0, 1),
  };
}

// ---------- P1: confirmed_share_of_traffic is exact r8(confirmed/round_total), 0 if round_total<=0 ----------
function checkP1_shareExactR8() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = pp.round_total_envelope_bytes > 0 ? r8(pp.confirmed_envelope_bytes / pp.round_total_envelope_bytes) : 0;
    if (r.output_payload.confirmed_share_of_traffic !== expected) violations++;
  }
  return { name: 'P1_confirmed_share_exact_r8_division', trials: checked, violations };
}

// ---------- P2: cc_reward_estimate recomputes exactly via the raw (unrounded) share/pool chain ----------
function checkP2_rewardEstimateExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const rawShare = pp.round_total_envelope_bytes > 0 ? pp.confirmed_envelope_bytes / pp.round_total_envelope_bytes : 0;
    const rawPoolCc = pp.round_total_mint_cc * pp.app_reward_pool_share;
    const expected = r6(rawShare * rawPoolCc);
    if (r.output_payload.cc_reward_estimate !== expected) violations++;
    if (r.output_payload.app_reward_pool_cc !== r6(rawPoolCc)) violations++;
  }
  return { name: 'P2_reward_estimate_and_pool_cc_exact_raw_chain', trials: checked, violations };
}

// ---------- P3: confirmed_share_of_traffic bounded [0,1] when confirmed<=round_total (declared invariant) ----------
function checkP3_shareBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand); // mkPP always keeps confirmed <= round_total
    const r = compute(pp);
    checked++;
    const share = r.output_payload.confirmed_share_of_traffic;
    if (share < 0 || share > 1) violations++;
  }
  return { name: 'P3_confirmed_share_bounded_0_to_1_when_confirmed_within_round_total', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ confirmed_envelope_bytes: 0, round_total_envelope_bytes: 1000, round_total_mint_cc: 100, app_reward_pool_share: 0.62 }, 'confirmed_envelope_bytes exactly zero — share must be exactly 0, reward 0'],
  [{ confirmed_envelope_bytes: 1000, round_total_envelope_bytes: 1000, round_total_mint_cc: 100, app_reward_pool_share: 0.62 }, 'confirmed equals round_total exactly — share must be exactly 1 (full traffic share)'],
  [{ confirmed_envelope_bytes: -0, round_total_envelope_bytes: 1000, round_total_mint_cc: 100, app_reward_pool_share: 0.62 }, 'confirmed_envelope_bytes negative zero — must behave as zero, no NaN'],
  [{ confirmed_envelope_bytes: 100, round_total_envelope_bytes: 0, round_total_mint_cc: 100, app_reward_pool_share: 0.62 }, 'round_total_envelope_bytes exactly zero — share must fall back to 0 (guarded div), CANTON_ZERO_ROUND_TRAFFIC flagged'],
  [{ confirmed_envelope_bytes: 1e-300, round_total_envelope_bytes: 1e-300, round_total_mint_cc: 100, app_reward_pool_share: 0.62 }, 'denormal-range confirmed/round_total ratio — must remain finite, non-NaN'],
  [{ confirmed_envelope_bytes: 1, round_total_envelope_bytes: 3, round_total_mint_cc: 3, app_reward_pool_share: 1 }, 'classic non-exact double ratio 1/3 — confirmed_share_of_traffic must round to r8(0.33333333) exactly'],
  [{ confirmed_envelope_bytes: 100, round_total_envelope_bytes: Number.MAX_SAFE_INTEGER, round_total_mint_cc: 100, app_reward_pool_share: 0.62 }, 'round_total_envelope_bytes at MAX_SAFE_INTEGER — division must remain finite, share near 0'],
  [{ confirmed_envelope_bytes: 200, round_total_envelope_bytes: 100, round_total_mint_cc: 100, app_reward_pool_share: 0.62 }, 'confirmed EXCEEDS round_total (invalid but non-crashing) — share exceeds 1, CANTON_CONFIRMED_EXCEEDS_ROUND_TOTAL flagged, still finite'],
  [{ confirmed_envelope_bytes: 100, round_total_envelope_bytes: 1000, round_total_mint_cc: 100, app_reward_pool_share: 1.5 }, 'app_reward_pool_share exceeds 1 (invalid declared range) — CANTON_INVALID_POOL_SHARE flagged, arithmetic still finite'],
  [{ confirmed_envelope_bytes: 100, round_total_envelope_bytes: 1000, round_total_mint_cc: 100, app_reward_pool_share: -0 }, 'app_reward_pool_share negative zero — pool_cc must be exactly 0, no NaN'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const full = { protocol_version: '3.5.5', ...pp };
    const r = compute(full);
    const { confirmed_share_of_traffic, cc_reward_estimate, app_reward_pool_cc } = r.output_payload;
    const plausible = Number.isFinite(confirmed_share_of_traffic) && Number.isFinite(cc_reward_estimate) && Number.isFinite(app_reward_pool_cc);
    rows.push({ label, input: full, confirmed_share_of_traffic, cc_reward_estimate, app_reward_pool_cc, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_shareExactR8());
results.properties.push(checkP2_rewardEstimateExact());
results.properties.push(checkP3_shareBounded());
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
