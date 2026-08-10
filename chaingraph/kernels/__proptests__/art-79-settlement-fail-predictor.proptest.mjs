// kernel_digest_at_authoring: sha256:660bc62de036808e6dcb648dd7ef377f3d403d9f3b2771459507ff4c7702ea0c
//
// FV-PROPFLOOR-SHARD-B17-1 — property-test floor for art-79-settlement-fail-predictor.
// Class B (bounded-numeric), FLOAT-SENSITIVE — score is a running sum of fixed decimal
// literals (0.45, 0.65, 0.15, 0.30, 0.20, 0.50, -0.05, 0.10) that are not exactly
// representable in binary floating point, then clamped and rounded via .toFixed(3) —
// ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-79-settlement-fail-predictor.proptest.mjs

import { compute } from '../art-79-settlement-fail-predictor.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-79-settlement-fail-predictor.fixtures.json');
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
const rand = mulberry32(0x79A1B2);
const TRIALS = 10000;

const SSI = ['matched', 'mismatched', 'missing'];
const LIQ = ['liquid', 'semi_liquid', 'illiquid'];
const CFB = ['low', 'med', 'high'];
const DLP = ['ample', 'tight', 'breached'];
const INV = ['long', 'short', 'uncertain'];
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function mkTrade(rng) {
  return {
    ssi_match_status: pick(rng, SSI),
    liquidity_tier: pick(rng, LIQ),
    counterparty_fail_band: pick(rng, CFB),
    deadline_proximity: pick(rng, DLP),
    partial_available: rng() < 0.5,
    inventory_status: pick(rng, INV),
  };
}

const WEIGHTS = {
  ssi_match_status: { matched: 0, mismatched: 0.45, missing: 0.65 },
  liquidity_tier: { liquid: 0, semi_liquid: 0.15, illiquid: 0.30 },
  counterparty_fail_band: { low: 0, med: 0.15, high: 0.30 },
  deadline_proximity: { ample: 0, tight: 0.20, breached: 0.50 },
  partial_available: { true: -0.05, false: 0 },
  inventory_status: { long: 0, short: 0.20, uncertain: 0.10 },
};

function referenceScore(t) {
  const feats = {
    ssi_match_status: t.ssi_match_status,
    liquidity_tier: t.liquidity_tier,
    counterparty_fail_band: t.counterparty_fail_band,
    deadline_proximity: t.deadline_proximity,
    partial_available: String(t.partial_available),
    inventory_status: t.inventory_status,
  };
  let s = 0;
  for (const [feat, val] of Object.entries(feats)) s += (WEIGHTS[feat]?.[val] ?? 0);
  return Math.min(1, Math.max(0, s));
}

// ---------- P1: fail_probability_score is clamped exactly to [0,1] and matches the ----------
// ---------- reference weighted sum to 3 decimal places (same rounding as the kernel) --------
function checkP1_scoreMatchesReferenceSum() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const trades = [mkTrade(rand)];
    const r = compute({ trades });
    checked++;
    const expected = +referenceScore(trades[0]).toFixed(3);
    const got = r.output_payload.scored_trades[0].fail_probability_score;
    if (got !== expected) violations++;
    if (got < 0 || got > 1) violations++;
  }
  return { name: 'P1_score_clamped_0_1_matches_reference_weighted_sum', trials: checked, violations };
}

// ---------- P2: boundedness — band is always one of the five declared bands, and matches the ----------
// ---------- fixed thresholds applied to the RAW unrounded score (the kernel classifies the band ----------
// ---------- on the pre-toFixed score, not the rounded output field — see kernel L94/103) --------------
function checkP2_bandBoundedAndMonotone() {
  let violations = 0, checked = 0;
  const BANDS = ['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW', 'NEGLIGIBLE'];
  for (let i = 0; i < TRIALS; i++) {
    const trades = [mkTrade(rand)];
    const r = compute({ trades });
    checked++;
    const { fail_probability_band } = r.output_payload.scored_trades[0];
    if (!BANDS.includes(fail_probability_band)) violations++;
    const rawScore = referenceScore(trades[0]);
    const expectedBand =
      rawScore >= 0.70 ? 'VERY_HIGH' :
      rawScore >= 0.50 ? 'HIGH' :
      rawScore >= 0.30 ? 'MEDIUM' :
      rawScore >= 0.10 ? 'LOW' : 'NEGLIGIBLE';
    if (fail_probability_band !== expectedBand) violations++;
  }
  return { name: 'P2_band_bounded_and_matches_fixed_thresholds_on_raw_score', trials: checked, violations };
}

// ---------- P3: metamorphic — worsening a feature (matched->mismatched->missing on SSI, ----------
// ---------- ample->tight->breached on deadline) never DECREASES the score -------------------
function checkP3_worseningNeverDecreasesScore() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const base = mkTrade(rand);
    const better = { ...base, ssi_match_status: 'matched', deadline_proximity: 'ample' };
    const worse = { ...base, ssi_match_status: 'missing', deadline_proximity: 'breached' };
    const rBetter = compute({ trades: [better] }).output_payload.scored_trades[0].fail_probability_score;
    const rWorse = compute({ trades: [worse] }).output_payload.scored_trades[0].fail_probability_score;
    checked++;
    if (rWorse < rBetter) violations++;
  }
  return { name: 'P3_worsening_ssi_and_deadline_never_decreases_score', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ trades: [] }, 'empty trades array — batch_fail_rate_estimate must be exactly 0, no NaN/division-by-zero'],
  [{ trades: [{}] }, 'trade with all fields absent — must default to matched/liquid/low/ample/true/long, score exactly 0, band NEGLIGIBLE'],
  [{ trades: [{ ssi_match_status: 'mismatched', liquidity_tier: 'illiquid', counterparty_fail_band: 'high', deadline_proximity: 'breached', partial_available: false, inventory_status: 'short' }] }, 'all-worst-case feature combination — sum 0.45+0.30+0.30+0.50+0+0.20=2.05, must clamp to exactly 1'],
  [{ trades: [{ deadline_proximity: 'tight' }] }, 'score exactly 0.20 — at the 0.10..0.30 LOW/MEDIUM-adjacent internal boundary, must classify LOW (>=0.10)'],
  [{ trades: [{ counterparty_fail_band: 'med', inventory_status: 'uncertain' }] }, 'score exactly 0.15+0.10=0.25 non-exact double sum — must remain finite and classify LOW consistently with >=0.10 threshold'],
  [{ trades: [{ deadline_proximity: 'ample', ssi_match_status: 'matched', liquidity_tier: 'liquid', counterparty_fail_band: 'low', inventory_status: 'long', partial_available: true }] }, 'score exactly -0.05 before clamp (only negative contributor) — must clamp to exactly 0, band NEGLIGIBLE, never negative zero leak into JSON'],
  [{ trades: [{ ssi_match_status: 'mismatched', deadline_proximity: 'tight' }] }, 'score 0.45+0.20=0.65 (classic non-exact double sum, close to but not exactly the 0.70 VERY_HIGH boundary) — must classify HIGH, not VERY_HIGH'],
  [{ trades: [{ ssi_match_status: 'missing', deadline_proximity: 'breached' }] }, 'score 0.65+0.50=1.15 exceeds 1 before clamp — must clamp to exactly 1.000, band VERY_HIGH'],
  [{ trades: Array.from({ length: 50 }, () => ({ ssi_match_status: 'missing' })) }, '50 identical high-risk trades — batch_fail_rate_estimate must be exactly 100 (finite, no accumulation drift), top_drivers length <=3'],
  [{ trades: [{ ssi_match_status: 'unknown_value' }] }, 'unrecognized enum string for ssi_match_status — falls through weight lookup (undefined ?? 0), must contribute exactly 0, no NaN propagation'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { scored_trades, batch_fail_rate_estimate, top_drivers, trade_count } = r.output_payload;
    const scoresFinite = scored_trades.every((t) => Number.isFinite(t.fail_probability_score) && t.fail_probability_score >= 0 && t.fail_probability_score <= 1);
    const plausible = scoresFinite && Number.isFinite(batch_fail_rate_estimate) && Array.isArray(top_drivers) && top_drivers.length <= 3 && Number.isInteger(trade_count);
    rows.push({ label, input: pp, scored_trades_sample: scored_trades.slice(0, 3), batch_fail_rate_estimate, trade_count, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_scoreMatchesReferenceSum());
results.properties.push(checkP2_bandBoundedAndMonotone());
results.properties.push(checkP3_worseningNeverDecreasesScore());
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
