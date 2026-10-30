// art-211-prediction-market-analyzer.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C7-1).
// kernel_digest_at_authoring: sha256:8fdfcccf67b6a4030ca65675f175ca4a6beef181ba3c1450c4b571d3f162b5eb
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (fdlibm log() for log_score, division-heavy odds/Kelly/fee math).
// Checks: fixture-oracle gate, boundedness (probabilities/scores stay in their declared ranges),
// side/won metamorphic symmetry, ULP-boundary forcing at the entry_price clamp bounds and
// forecast_prob extremes feeding log(), and a termination sanity bound on fractionalOdds' search.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-211-prediction-market-analyzer.proptest.mjs

import { compute } from '../art-211-prediction-market-analyzer.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-211-prediction-market-analyzer.fixtures.json');
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
const rand = mulberry32(0x211A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const VENUES = ['polymarket', 'kalshi', 'cme_event', 'robinhood'];

function randomBinaryInput(rng) {
  return {
    mode: 'binary',
    venue: pick(rng, VENUES),
    side: pick(rng, ['yes', 'no']),
    entry_price: 0.01 + rng() * 0.98,
    n_contracts: 1 + Math.floor(rng() * 500),
    payout: 1,
    won: rng() < 0.5 ? 1 : 0,
    user_probability: rng() < 0.7 ? 0.01 + rng() * 0.98 : undefined,
    bankroll: 100 + rng() * 100000,
    forecast_prob: rng() < 0.7 ? 0.01 + rng() * 0.98 : undefined,
    outcome: rng() < 0.7 ? (rng() < 0.5 ? 1 : 0) : undefined,
  };
}

const TRIALS = 5000;

// ---------- P1: boundedness — probabilities/scores stay within their declared ranges ----------
function checkP1_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const { output_payload: o } = compute(randomBinaryInput(rand));
    checked++;
    if (o.implied_probability < 0 || o.implied_probability > 1) violations++;
    if (o.no_vig_fair_value < 0 || o.no_vig_fair_value > 1) violations++;
    if (o.fee_paid < 0) violations++;
    if (o.brier_score !== null && (o.brier_score < 0 || o.brier_score > 1)) violations++;
    if (o.kelly_fraction !== null && o.kelly_fraction < 0) violations++;
    if (!Number.isFinite(o.pnl)) violations++;
  }
  return { name: 'P1_probability_and_score_boundedness', trials: checked, violations };
}

// ---------- P2 (metamorphic): side/won symmetry — pnl depends only on holdingWon, not label ----------
function checkP2_side_won_symmetry() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const base = randomBinaryInput(rand);
    const a = compute({ ...base, side: 'yes', won: 1 }).output_payload;
    const b = compute({ ...base, side: 'no', won: 0 }).output_payload;
    checked++;
    // both configurations have holdingWon = true (isYes=true&yesWon=true; isYes=false&yesWon=false=>!yesWon=true)
    if (a.pnl !== b.pnl || a.fee_paid !== b.fee_paid) violations++;
  }
  return { name: 'P2_side_won_holdingWon_symmetry', trials: checked, violations };
}

// ---------- P3: termination sanity — fractionalOdds' internal search (d<=99) always completes ----------
function checkP3_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const { output_payload: o } = compute(randomBinaryInput(rand));
    checked++;
    if (typeof o.odds_fractional !== 'string' || o.odds_fractional.length === 0) violations++;
    if (!Number.isFinite(o.odds_american)) violations++;
  }
  return { name: 'P3_odds_search_terminates_and_finite', trials: checked, violations };
}

// ---------- P4 (ULP-forcing, float:yes): clamp boundaries, 0/-0, denormal-scale probabilities ----------
function checkP4_ulpForcing() {
  let violations = 0, checked = 0;
  const cases = [
    { mode: 'binary', venue: 'polymarket', side: 'yes', payout: 1, entry_price: 1 * 0.0001, n_contracts: 1, won: 1 },
    { mode: 'binary', venue: 'polymarket', side: 'yes', payout: 1, entry_price: 1 * 0.9999, n_contracts: 1, won: 1 },
    { mode: 'binary', venue: 'kalshi', side: 'no', payout: 1, entry_price: 0, n_contracts: 10, won: 0 },
    { mode: 'binary', venue: 'kalshi', side: 'yes', payout: 1, entry_price: -0, n_contracts: 10, won: 1 },
    { mode: 'binary', venue: 'polymarket', side: 'yes', payout: 1, entry_price: 0.5, n_contracts: 1, won: 1, forecast_prob: 1e-300, outcome: 1 },
    { mode: 'binary', venue: 'polymarket', side: 'yes', payout: 1, entry_price: 0.5, n_contracts: 1, won: 1, forecast_prob: 1 - 1e-16, outcome: 1 },
    { mode: 'binary', venue: 'polymarket', side: 'yes', payout: 1, entry_price: 0.5, n_contracts: 1, won: 1, user_probability: 0.0001 },
    { mode: 'binary', venue: 'polymarket', side: 'yes', payout: 1, entry_price: 0.5, n_contracts: 1, won: 1, user_probability: 0.9999 },
  ];
  for (const c of cases) {
    checked++;
    const { output_payload: o } = compute(c);
    if (!Number.isFinite(o.pnl)) violations++;
    if (o.implied_probability < 0 || o.implied_probability > 1) violations++;
    if (o.brier_score !== null && !Number.isFinite(o.brier_score)) violations++;
    if (o.log_score !== null && !Number.isFinite(o.log_score)) violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_clamp_and_denormal', trials: checked, violations };
}

// ---------- P5 (PREDMKT-FEE-INPLACE-FIX-1): Kalshi fee equals the exact integer ceil ----------
// fee_cents = ceil(7 * n * pc * (100 - pc) / 10000) for whole n and cent prices; the old float
// expression was one cent high in 120 of these 29,700 cases.
function checkP5_kalshiExactCeil() {
  let violations = 0, checked = 0;
  for (let n = 1; n <= 300; n++) {
    for (let pc = 1; pc <= 99; pc++) {
      checked++;
      const exact = Math.floor((7 * n * pc * (100 - pc) + 9999) / 10000);
      const o = compute({ mode: 'binary', venue: 'kalshi', n_contracts: n, entry_price: pc / 100 }).output_payload;
      if (Math.round(o.fee_paid * 100) !== exact) violations++;
    }
  }
  return { name: 'P5_kalshi_fee_exact_integer_ceil_n1to300_p1to99', trials: checked, violations };
}

// ---------- P6: Polymarket regimes are labelled and never use the Kalshi ceil ----------
// global: truncate to $0.00001 of C * rate * p * (1 - p); us: theta by as_of, half-up to $0.000001.
function checkP6_polymarketRegimes() {
  let violations = 0, checked = 0;
  const RATES = { crypto: 7, sports: 5, finance: 4, politics: 4, geopolitics: 0, other: 5 };
  for (let i = 0; i < 2000; i++) {
    const n = 1 + Math.floor(rand() * 500);
    const pc = 1 + Math.floor(rand() * 99);
    const cat = pick(rand, Object.keys(RATES));
    const g = compute({ mode: 'binary', venue: 'polymarket', market_category: cat, n_contracts: n, entry_price: pc / 100 }).output_payload;
    const gExact = Math.floor(RATES[cat] * n * pc * (100 - pc) / 10);   // units of $0.00001
    checked++;
    if (g.fee_regime !== 'polymarket_global' || Math.round(g.fee_paid * 1e5) !== gExact) violations++;
    const asOf = pick(rand, ['2026-06-30', '2026-07-01', '2026-09-16', '2026-09-17', '2026-10-30']);
    const theta = asOf >= '2026-09-17' ? 695 : asOf >= '2026-07-01' ? 600 : 500;   // per 10,000
    const u = compute({ mode: 'binary', venue: 'polymarket', fee_regime: 'polymarket_us', as_of: asOf, n_contracts: n, entry_price: pc / 100 }).output_payload;
    const uExact = Math.round(theta * n * pc * (100 - pc) / 100);   // units of $0.000001, exact for these magnitudes
    checked++;
    if (u.fee_regime !== 'polymarket_us' || u.fee_as_of !== asOf || Math.round(u.fee_paid * 1e6) !== uExact) violations++;
  }
  return { name: 'P6_polymarket_regime_table_and_rounding', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_boundedness());
results.properties.push(checkP2_side_won_symmetry());
results.properties.push(checkP3_termination());
results.properties.push(checkP4_ulpForcing());
results.properties.push(checkP5_kalshiExactCeil());
results.properties.push(checkP6_polymarketRegimes());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-211-prediction-market-analyzer',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
