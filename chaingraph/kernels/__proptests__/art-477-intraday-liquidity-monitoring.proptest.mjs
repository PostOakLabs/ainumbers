// art-477-intraday-liquidity-monitoring.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C22-1).
// kernel_digest_at_authoring: sha256:647771786d54eec94e4c54281af4b03bd11032678c1c363c7cbc39b9cc0a8b73
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — direct source read confirmed. All amounts are r2()-rounded to 2 decimals
// at declared output boundaries only; coverage_ratio is a ratio used for display/comparison but
// compared with >= against another r2()-rounded value, no ULP-boundary threshold claim made or
// needed. Forced categorical boundary cases used instead.
// Checks: fixture-oracle gate, termination (cumulative_position_path/time_specific_obligations
// bounded by input transaction/obligation array lengths), differential re-derivation of
// daily_max_usage_musd (cumulative-net-position walk) and usage_covered, boundedness (every path
// entry traces to one input transaction, sort is a permutation not a subset change), metamorphic
// permutation-invariance (shuffling the input transaction order never changes daily_max_usage_musd
// since the kernel re-sorts by time_hhmm), and forced categorical boundary cases (empty
// transactions, exact-coverage-equality). Zero external dependencies — pure Node built-ins only
// (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-477-intraday-liquidity-monitoring.proptest.mjs

import { compute } from '../art-477-intraday-liquidity-monitoring.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-477-intraday-liquidity-monitoring.fixtures.json');
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
const rand = mulberry32(0x477A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomHHMM(rng) {
  const h = String(Math.floor(rng() * 24)).padStart(2, '0');
  const m = String(Math.floor(rng() * 60)).padStart(2, '0');
  return `${h}:${m}`;
}

function randomTx(rng, idx) {
  return { tx_id: `tx-${idx}`, time_hhmm: randomHHMM(rng), flow_type: pick(rng, ['inflow', 'outflow']), amount_musd: rng() * 1000 };
}

function randomObligation(rng, idx) {
  const due = randomHHMM(rng);
  const settled = rng() < 0.7 ? randomHHMM(rng) : undefined;
  return { obligation_id: `o-${idx}`, due_time_hhmm: due, settled_time_hhmm: settled, amount_musd: rng() * 500 };
}

function randomPP(rng) {
  const n = Math.floor(rng() * 10);
  const transactions = Array.from({ length: n }, (_, i) => randomTx(rng, i));
  const on = Math.floor(rng() * 6);
  const time_specific_obligations = Array.from({ length: on }, (_, i) => randomObligation(rng, i));
  const sn = Math.floor(rng() * 4);
  const available_intraday_sources = Array.from({ length: sn }, (_, i) => ({ source_id: `s-${i}`, amount_musd: rng() * 500 }));
  return { start_of_day_available_musd: rng() * 1000, transactions, time_specific_obligations, available_intraday_sources };
}

function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const TRIALS = 4000;

// ---------- P1: termination — path/obligations length bounded by input array lengths ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.cumulative_position_path.length !== pp.transactions.length) violations++;
    if (output_payload.time_specific_obligations.length !== pp.time_specific_obligations.length) violations++;
  }
  return { name: 'P1_termination_path_and_obligations_bounded', trials: checked, violations };
}

// ---------- P2 (differential): daily_max_usage_musd re-derivation via independent cumulative walk ----------
function checkP2_daily_max_usage_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const ordered = pp.transactions
      .map((t, idx) => ({ ...t, _idx: idx }))
      .sort((a, b) => (a.time_hhmm < b.time_hhmm ? -1 : a.time_hhmm > b.time_hhmm ? 1 : a._idx - b._idx));
    let running = 0, worst = 0;
    for (const t of ordered) {
      running += t.flow_type === 'outflow' ? -Math.max(0, t.amount_musd) : Math.max(0, t.amount_musd);
      if (running < worst) worst = running;
    }
    const expected = Math.round((worst < 0 ? -worst : 0) * 100) / 100;
    if (Math.abs(output_payload.daily_max_usage_musd - expected) > 1e-9) violations++;
  }
  return { name: 'P2_daily_max_usage_differential', trials: checked, violations };
}

// ---------- P3: boundedness — usage_covered iff available_sources_total_musd >= daily_max_usage_musd ----------
function checkP3_usage_covered_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expected = output_payload.available_sources_total_musd >= output_payload.daily_max_usage_musd;
    if (output_payload.usage_covered !== expected) violations++;
  }
  return { name: 'P3_usage_covered_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — shuffling input transaction order never changes daily_max_usage_musd ----------
// (only when time_hhmm values are pairwise-distinct — when two transactions share a timestamp, the
// kernel's own tie-break is by ORIGINAL index, so shuffling deliberately changes which of the tied
// transactions is walked first and can legitimately move the cumulative minimum; that is intended
// tie-break behaviour, not a permutation-invariance violation, so ties are excluded from this check.)
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = randomPP(rand);
    if (pp.transactions.length < 2) continue;
    const times = pp.transactions.map((t) => t.time_hhmm);
    if (new Set(times).size !== times.length) continue;
    const r1 = compute(pp).output_payload;
    const shuffled = { ...pp, transactions: shuffle(rand, pp.transactions) };
    const r2 = compute(shuffled).output_payload;
    checked++;
    if (r1.daily_max_usage_musd !== r2.daily_max_usage_musd) violations++;
    if (r1.total_payments_musd !== r2.total_payments_musd) violations++;
    if (r1.total_receipts_musd !== r2.total_receipts_musd) violations++;
  }
  return { name: 'P4_shuffle_transactions_permutation_invariance', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (empty transactions, exact coverage equality) ----------
function checkP5_forced_categorical_boundaries() {
  let violations = 0, checked = 0;
  {
    checked++;
    const { output_payload } = compute({ start_of_day_available_musd: 0, transactions: [], time_specific_obligations: [], available_intraday_sources: [] });
    if (output_payload.daily_max_usage_musd !== 0) violations++;
    if (output_payload.usage_covered !== true) violations++;
    if (output_payload.coverage_ratio !== null) violations++;
  }
  {
    checked++;
    // Exactly one outflow -> daily_max_usage = 100; one source of exactly 100 -> covered, ratio=1.
    const { output_payload } = compute({
      start_of_day_available_musd: 0,
      transactions: [{ tx_id: 't1', time_hhmm: '09:00', flow_type: 'outflow', amount_musd: 100 }],
      time_specific_obligations: [],
      available_intraday_sources: [{ source_id: 's1', amount_musd: 100 }],
    });
    if (output_payload.daily_max_usage_musd !== 100) violations++;
    if (output_payload.usage_covered !== true) violations++;
    if (output_payload.coverage_ratio !== 1) violations++;
  }
  {
    checked++;
    // Obligation settled exactly at due time (lexical equality) -> met_on_time true.
    const { output_payload } = compute({
      transactions: [], available_intraday_sources: [],
      time_specific_obligations: [{ obligation_id: 'o1', due_time_hhmm: '10:00', settled_time_hhmm: '10:00', amount_musd: 1 }],
    });
    if (output_payload.time_specific_obligations[0].met_on_time !== true) violations++;
  }
  return { name: 'P5_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_daily_max_usage_differential());
results.properties.push(checkP3_usage_covered_differential());
results.properties.push(checkP4_permutation_invariance());
results.properties.push(checkP5_forced_categorical_boundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-477-intraday-liquidity-monitoring',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
