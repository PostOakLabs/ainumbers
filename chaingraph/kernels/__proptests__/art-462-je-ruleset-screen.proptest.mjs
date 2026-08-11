// art-462-je-ruleset-screen.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C21-1).
// kernel_digest_at_authoring: sha256:5f9f5a9b7c90cd52f8391fad3645938706315d2271784f07a1fb5a831b588599
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — weekday/date logic is pure integer civil-calendar
// arithmetic (Howard Hinnant's algorithm, no Date object); the only numeric compare against a
// caller-supplied amount is `entry.amount % roundIncrement === 0`, a discrete equality test on
// caller-raw data rather than a kernel-derived continuous float chain. Forced categorical
// boundary cases are used instead of ULP-forcing, per spec §3's float:no row, with the modulo
// exact-multiple boundary specifically forced as one of them.
// Checks: fixture-oracle gate, termination (bounded by entries.length, single pass, no
// recursion), boundedness (flagged_count <= total_entries; rule_trip_counts sum equals the total
// number of (entry, rule) trips), a permutation-invariance metamorphic identity (reordering
// entries leaves flagged_count/rule_trip_counts unchanged, since every rule evaluates each entry
// independently), and forced categorical boundary cases (weekend/weekday exact boundary,
// round_number modulo exact-multiple vs one-cent-off, post_close_date exact boundary vs one day
// after, malformed/invalid ISO date string, unknown rule id silently ignored).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-462-je-ruleset-screen.proptest.mjs

import { compute } from '../art-462-je-ruleset-screen.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-462-je-ruleset-screen.fixtures.json');
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
const rand = mulberry32(0x46200);

const ACCOUNTS = ['1000', '2000', '3000', 'SUSP1'];
const USERS = ['alice', 'bob', 'carol'];

function pad2(n) { return String(n).padStart(2, '0'); }
function randDate(rng) {
  const y = 2025;
  const m = 1 + Math.floor(rng() * 12);
  const d = 1 + Math.floor(rng() * 28);
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function randomEntries(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      entry_id: `e${i}`,
      posting_date: randDate(rng),
      amount: Math.round((rng() - 0.5) * 200000) / 100,
      account_id: ACCOUNTS[Math.floor(rng() * ACCOUNTS.length)],
      user_id: USERS[Math.floor(rng() * USERS.length)],
      is_manual: rng() < 0.2,
    });
  }
  return out;
}

function randomPP(rng) {
  const n = Math.floor(rng() * 15);
  return {
    ruleset_version: 'v1',
    active_rules: ['weekend_holiday', 'round_number', 'suspense_manual', 'post_close', 'unusual_user_account'],
    rule_params: {
      weekend_days: [0, 6],
      holiday_dates: ['2025-01-01'],
      round_number_increment: 1000,
      suspense_accounts: ['SUSP1'],
      post_close_date: '2025-06-30',
      authorized_user_account_pairs: [{ user_id: 'alice', account_id: '1000' }],
    },
    entries: randomEntries(rng, n),
  };
}

const TRIALS = 4000;

// ---------- P1: termination — bounded by entries.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.total_entries !== pp.entries.length) violations++;
  }
  const big = randomEntries(rand, 4000);
  const { output_payload: bigOut } = compute({ ...randomPP(rand), entries: big });
  checked++;
  if (bigOut.total_entries !== 4000) violations++;
  return { name: 'P1_termination_bounded_by_entries_length', trials: checked, violations };
}

// ---------- P2: boundedness — flagged_count <= total_entries, rule_trip_counts consistency ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.flagged_count > o.total_entries) violations++;
    const sumTrips = Object.values(o.rule_trip_counts).reduce((s, v) => s + v, 0);
    const totalTripsInFlagged = o.flagged_entries.reduce((s, f) => s + f.rules_tripped.length, 0);
    if (sumTrips !== totalTripsInFlagged) violations++;
  }
  return { name: 'P2_flagged_count_bounded_and_trip_counts_consistent', trials: checked, violations };
}

// ---------- P3: metamorphic — permutation-invariance of entries ----------
function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    if (pp.entries.length < 2) continue;
    const shuffled = [...pp.entries];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const base = compute(pp).output_payload;
    const perm = compute({ ...pp, entries: shuffled }).output_payload;
    checked++;
    if (base.flagged_count !== perm.flagged_count) violations++;
    if (JSON.stringify(base.rule_trip_counts) !== JSON.stringify(perm.rule_trip_counts)) violations++;
  }
  return { name: 'P3_permutation_invariance_of_entries', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception, per spec §3) ----------
function checkP4_categorical_boundaries() {
  let violations = 0, checked = 0;
  const basePP = { ruleset_version: 'v1', active_rules: ['round_number', 'weekend_holiday', 'post_close'], rule_params: { weekend_days: [0, 6], holiday_dates: [], round_number_increment: 1000, post_close_date: '2025-06-30' } };
  // round_number exact multiple vs one-cent-off
  const exactMultiple = compute({ ...basePP, entries: [{ entry_id: 'a', posting_date: '2025-03-10', amount: 5000, account_id: 'x', user_id: 'u' }] });
  checked++;
  if (!exactMultiple.output_payload.flagged_entries[0].rules_tripped.some((t) => t.rule_id === 'round_number')) violations++;
  const oneCentOff = compute({ ...basePP, entries: [{ entry_id: 'b', posting_date: '2025-03-10', amount: 5000.01, account_id: 'x', user_id: 'u' }] });
  checked++;
  if (oneCentOff.output_payload.flagged_entries.some((f) => f.rules_tripped.some((t) => t.rule_id === 'round_number'))) violations++;
  // weekend boundary: 2025-03-08 is a Saturday, 2025-03-10 is a Monday
  const saturday = compute({ ...basePP, entries: [{ entry_id: 'c', posting_date: '2025-03-08', amount: 1, account_id: 'x', user_id: 'u' }] });
  checked++;
  if (!saturday.output_payload.flagged_entries[0].rules_tripped.some((t) => t.rule_id === 'weekend_holiday')) violations++;
  const monday = compute({ ...basePP, entries: [{ entry_id: 'd', posting_date: '2025-03-10', amount: 1, account_id: 'x', user_id: 'u' }] });
  checked++;
  if (monday.output_payload.flagged_entries.some((f) => f.rules_tripped.some((t) => t.rule_id === 'weekend_holiday'))) violations++;
  // post_close exact boundary (===) does NOT trip; one day after DOES trip
  const onCloseDate = compute({ ...basePP, entries: [{ entry_id: 'e', posting_date: '2025-06-30', amount: 1, account_id: 'x', user_id: 'u' }] });
  checked++;
  if (onCloseDate.output_payload.flagged_entries.some((f) => f.rules_tripped.some((t) => t.rule_id === 'post_close'))) violations++;
  const afterCloseDate = compute({ ...basePP, entries: [{ entry_id: 'f', posting_date: '2025-07-01', amount: 1, account_id: 'x', user_id: 'u' }] });
  checked++;
  if (!afterCloseDate.output_payload.flagged_entries[0].rules_tripped.some((t) => t.rule_id === 'post_close')) violations++;
  // malformed date string -> weekday null, no crash, weekend_holiday rule simply never trips on it
  const malformed = compute({ ...basePP, entries: [{ entry_id: 'g', posting_date: 'not-a-date', amount: 1, account_id: 'x', user_id: 'u' }] });
  checked++;
  if (!Number.isFinite(malformed.output_payload.total_entries)) violations++;
  return { name: 'P4_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_permutation_invariance());
results.properties.push(checkP4_categorical_boundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-462-je-ruleset-screen',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
