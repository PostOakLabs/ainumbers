// art-573-section16b-short-swing-profit-recompute.proptest.mjs -- FV property-test FLOOR
// (FV-PROPFLOOR-SHARD-C29-1).
// kernel_digest_at_authoring: sha256:2bf576ae353041e722a9e64447d9484503c9d7208b320a9338562368f15e41d2
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md Sec3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES -- confirmed by direct source read (matches the WU row). Every price/profit
// value is a safe-integer minor unit and the matched-pair profit itself is integer multiplication
// (`(sale.price_minor_units - purchase.price_minor_units) * shares_matched`), but `display()` repeats
// the same `Math.trunc(abs / MINOR_SCALE)` division the C25 shard kept float:yes for on
// art-509/art-508 -- exercised on every price and profit figure in the output. ULP-boundary forcing
// is applied around that division.
// Checks: fixture-oracle gate, termination (bounded by the nested sales x purchases matching loop,
// which is bounded by transactions.length^2 and breaks early once a side is exhausted -- never
// unbounded), differential re-derivation of the lowest-in/highest-out matched-pair construction and
// total profit, ULP-boundary forcing on display()'s Math.trunc(abs/100) boundary, and a metamorphic
// identity (the input transactions[] array order never changes the matched-pair total, since the
// kernel re-sorts purchases ascending and sales descending internally before matching).
//
// Run: node chaingraph/kernels/__proptests__/art-573-section16b-short-swing-profit-recompute.proptest.mjs

import { compute } from '../art-573-section16b-short-swing-profit-recompute.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-573-section16b-short-swing-profit-recompute.fixtures.json');
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
const rand = mulberry32(0x57300);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomTransactions(rng) {
  const n = 2 + Math.floor(rng() * 8);
  const out = [];
  for (let i = 0; i < n; i++) {
    const month = 1 + Math.floor(rng() * 12);
    const day = 1 + Math.floor(rng() * 27);
    out.push({ txn_id: `T${i}`, type: pick(rng, ['buy', 'sell']), date: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, price_minor_units: 100 + Math.floor(rng() * 100000), shares: 1 + Math.floor(rng() * 1000) });
  }
  return out;
}

function randomPP(rng) {
  return { insider_ref: 'I1', issuer_ref: 'ISS1', currency: 'USD', transactions: randomTransactions(rng), insider_status: { officer_or_director: rng() < 0.7, ten_pct_owner: rng() < 0.3, foreign_private_issuer: rng() < 0.2 } };
}

const TRIALS = 2500;

// ---------- P1: termination -- nested matching loop bounded by transactions.length^2, breaks on exhaustion ----------
function checkP1_termination_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const maxPairs = pp.transactions.length * pp.transactions.length;
    if (output_payload.matched_pairs.length > maxPairs) violations++;
    if (output_payload.usable_transaction_count > pp.transactions.length) violations++;
  }
  return { name: 'P1_termination_matched_pairs_bounded', trials: checked, violations };
}

// ---------- P2 (differential): re-derive lowest-in/highest-out matching and total profit ----------
function checkP2_matching_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const parsed = pp.transactions.map((t) => ({ ...t, days: Math.floor(Date.parse(t.date + 'T00:00:00Z') / 86400000), shares_remaining: t.shares }));
    const purchases = parsed.filter((t) => t.type === 'buy').sort((a, b) => a.price_minor_units - b.price_minor_units || a.days - b.days);
    const sales = parsed.filter((t) => t.type === 'sell').sort((a, b) => b.price_minor_units - a.price_minor_units || a.days - b.days);
    let totalProfit = 0, pairCount = 0;
    for (const sale of sales) {
      for (const purchase of purchases) {
        if (sale.shares_remaining <= 0) break;
        if (purchase.shares_remaining <= 0) continue;
        if (sale.price_minor_units <= purchase.price_minor_units) continue;
        if (Math.abs(sale.days - purchase.days) >= 183) continue;
        const matched = Math.min(sale.shares_remaining, purchase.shares_remaining);
        totalProfit += (sale.price_minor_units - purchase.price_minor_units) * matched;
        sale.shares_remaining -= matched; purchase.shares_remaining -= matched;
        pairCount++;
      }
    }
    if (output_payload.total_profit_minor_units !== totalProfit) violations++;
    if (output_payload.matched_pairs.length !== pairCount) violations++;
  }
  return { name: 'P2_lowest_in_highest_out_differential', trials: checked, violations };
}

// ---------- P3: ULP-boundary forcing on display()'s Math.trunc(abs/100) division ----------
function checkP3_ulp_display_boundary() {
  let violations = 0, checked = 0;
  const forcedPrices = [0, 1, 99, 100, 101, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1];
  for (const price of forcedPrices) {
    if (!Number.isSafeInteger(price)) continue;
    checked++;
    // exemption_flags forces the transaction into excluded_transactions[] (which carries
    // price_display) without needing a matching counterpart -- display() runs identically on an
    // excluded or a matched transaction's price, so this exercises the same division.
    const pp = { insider_ref: 'I', issuer_ref: 'S', currency: 'USD', transactions: [{ txn_id: 'T1', type: 'buy', date: '2026-01-01', price_minor_units: price, shares: 1, exemption_flags: ['rule_16b-3'] }] };
    const { output_payload } = compute(pp);
    const whole = Math.trunc(price / 100); const frac = price - whole * 100;
    const expected = String(whole) + '.' + String(frac).padStart(2, '0');
    if (output_payload.excluded_transactions[0].price_display !== expected) violations++;
  }
  // exact-multiples-of-100 sweep near a large safe-integer boundary.
  for (let k = 0; k < 100; k++) {
    const n = Math.floor(rand() * 1e14) * 100 + pick(rand, [0, 1, 99]);
    if (!Number.isSafeInteger(n)) continue;
    checked++;
    const pp = { insider_ref: 'I', issuer_ref: 'S', currency: 'USD', transactions: [{ txn_id: 'T1', type: 'sell', date: '2026-01-01', price_minor_units: n, shares: 1, exemption_flags: ['rule_16b-3'] }] };
    const { output_payload } = compute(pp);
    const whole = Math.trunc(n / 100); const frac = n - whole * 100;
    const expected = String(whole) + '.' + String(frac).padStart(2, '0');
    if (output_payload.excluded_transactions[0].price_display !== expected) violations++;
  }
  return { name: 'P3_ulp_display_trunc_div100_boundary', trials: checked, violations };
}

// ---------- P4: metamorphic -- input transactions[] order never changes the matched-pair total ----------
function checkP4_transaction_order_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 800; i++) {
    const pp = randomPP(rand);
    if (pp.transactions.length < 2) continue;
    const shuffled = { ...pp, transactions: [...pp.transactions].sort(() => rand() - 0.5) };
    checked++;
    const r1 = compute(pp).output_payload;
    const r2 = compute(shuffled).output_payload;
    if (r1.total_profit_minor_units !== r2.total_profit_minor_units) violations++;
    if (r1.matched_pairs.length !== r2.matched_pairs.length) violations++;
  }
  return { name: 'P4_transaction_array_order_invariance', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_bounded());
results.properties.push(checkP2_matching_differential());
results.properties.push(checkP3_ulp_display_boundary());
results.properties.push(checkP4_transaction_order_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-573-section16b-short-swing-profit-recompute',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
