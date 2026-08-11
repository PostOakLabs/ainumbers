// art-566-iolta-three-way-reconciliation.proptest.mjs -- FV property-test FLOOR (FV-PROPFLOOR-SHARD-C29-1).
// kernel_digest_at_authoring: sha256:891bee3fc15ad70e6efb5440b1b794536e846e9bb77b5a4a9ea06df0153f772a
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md Sec3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO -- CORRECTED from the WU row's float:yes (per FIX-2 discipline). Direct source
// read: every balance, ledger entry, and outstanding item is an integer minor unit gated through
// minorInt() (Number.isSafeInteger), and every arithmetic operation in compute() -- clientTotal,
// activitySum, opening_balance_minor, running/min_running, depositsInTransitTotal,
// unclearedChecksTotal, adjusted_bank_balance_minor, bank_vs_trust_minor, trust_vs_clients_minor,
// bank_vs_clients_minor -- is integer addition/subtraction only, never multiplication or division.
// The ONE Number division in the file is dayDiff()'s Math.round((b-a)/86400000) used only for
// outstanding-item age_days/age_bucket (an informational aging label, never a money value or a
// pass/fail branch threshold): both operands are millisecond timestamps from Date.parse() of
// YYYY-MM-DDT00:00:00Z strings, always an exact multiple of 86400000 apart for any real calendar
// date pair in any realistic magnitude range, so the division is exact and Math.round is a no-op.
// Forced categorical boundary cases are used in place of ULP-boundary forcing.
// Checks: fixture-oracle gate, termination (client_ledgers/outstanding_items bounded by MAX_CLIENTS=60
// /MAX_OUTSTANDING=200, entries bounded by MAX_ENTRIES_PER_CLIENT=500), differential re-derivation of
// the three-way equality and per-client low-point arithmetic, metamorphic permutation-invariance of
// the client_ledgers array (aggregation must not depend on array order), and forced categorical
// boundary cases (tolerance exact boundary, negative client low point, day-count aging exactness).
//
// Run: node chaingraph/kernels/__proptests__/art-566-iolta-three-way-reconciliation.proptest.mjs

import { compute } from '../art-566-iolta-three-way-reconciliation.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-566-iolta-three-way-reconciliation.fixtures.json');
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
const rand = mulberry32(0x56600);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomClient(rng, i) {
  const n = Math.floor(rng() * 4);
  const entries = [];
  for (let j = 0; j < n; j++) {
    const day = 1 + Math.floor(rng() * 27);
    entries.push({ date: `2026-06-${String(day).padStart(2, '0')}`, amount_minor: Math.floor(rng() * 200000) - 100000, description: 'e' + j });
  }
  return {
    client_id: `client-${i}`,
    ending_balance_minor: Math.floor(rng() * 5000000),
    as_of: '2026-06-30',
    entries,
  };
}

function randomPP(rng) {
  const nClients = 1 + Math.floor(rng() * 6);
  const client_ledgers = [];
  for (let i = 0; i < nClients; i++) client_ledgers.push(randomClient(rng, i));
  const clientTotal = client_ledgers.reduce((a, c) => a + c.ending_balance_minor, 0);
  const nOut = Math.floor(rng() * 4);
  const outstanding_items = [];
  let dep = 0, unc = 0;
  for (let i = 0; i < nOut; i++) {
    const type = pick(rng, ['deposit_in_transit', 'uncleared_check']);
    const amt = 1 + Math.floor(rng() * 100000);
    const day = 1 + Math.floor(rng() * 27);
    if (type === 'deposit_in_transit') dep += amt; else unc += amt;
    outstanding_items.push({ type, date: `2026-06-${String(day).padStart(2, '0')}`, amount_minor: amt, description: 'o' + i });
  }
  const bankAligned = rng() < 0.5;
  const bank_ending_balance_minor = bankAligned ? (clientTotal - dep + unc) : (clientTotal - dep + unc + Math.floor(rng() * 2000) - 1000);
  return {
    reconciliation_tolerance_minor: pick(rng, [0, 1, 50, 100]),
    statement_period: { start_date: '2026-06-01', end_date: '2026-06-30' },
    bank: { ending_balance_minor: bank_ending_balance_minor, statement_date: '2026-06-30' },
    trust_ledger: { ending_balance_minor: clientTotal, as_of: '2026-06-30' },
    client_ledgers,
    outstanding_items,
  };
}

const TRIALS = 3000;

// ---------- P1: termination -- bounded by MAX_CLIENTS/MAX_OUTSTANDING/MAX_ENTRIES_PER_CLIENT ----------
function checkP1_termination_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.client_count !== pp.client_ledgers.length) violations++;
    if (output_payload.client_count > 60) violations++;
    if (output_payload.outstanding_items.length > 200) violations++;
  }
  return { name: 'P1_termination_bounded_by_max_counts', trials: checked, violations };
}

// ---------- P2 (differential): three-way arithmetic and client low-point re-derived ----------
function checkP2_three_way_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const tw = output_payload.three_way;
    let dep = 0, unc = 0;
    for (const o of pp.outstanding_items) { if (o.type === 'deposit_in_transit') dep += o.amount_minor; else unc += o.amount_minor; }
    const adjusted = pp.bank.ending_balance_minor + dep - unc;
    if (tw.adjusted_bank_balance_minor !== adjusted) violations++;
    const clientTotal = pp.client_ledgers.reduce((a, c) => a + c.ending_balance_minor, 0);
    if (tw.client_ledger_total_minor !== clientTotal) violations++;
    if (tw.bank_vs_trust_minor !== adjusted - pp.trust_ledger.ending_balance_minor) violations++;
    if (tw.trust_vs_clients_minor !== pp.trust_ledger.ending_balance_minor - clientTotal) violations++;
    // Re-derive each client's low point independently.
    for (let ci = 0; ci < pp.client_ledgers.length; ci++) {
      const c = pp.client_ledgers[ci];
      const sorted = [...c.entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      const activitySum = sorted.reduce((a, e) => a + e.amount_minor, 0);
      let running = c.ending_balance_minor - activitySum;
      let minRunning = running;
      for (const e of sorted) { running += e.amount_minor; if (running < minRunning) minRunning = running; }
      if (output_payload.client_ledgers[ci].low_point_minor !== minRunning) violations++;
    }
  }
  return { name: 'P2_three_way_and_low_point_differential', trials: checked, violations };
}

// ---------- P3: metamorphic -- permuting client_ledgers array never changes aggregate totals ----------
function checkP3_client_order_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1200; i++) {
    const pp = randomPP(rand);
    if (pp.client_ledgers.length < 2) continue;
    const shuffled = { ...pp, client_ledgers: [...pp.client_ledgers].sort(() => rand() - 0.5) };
    checked++;
    const r1 = compute(pp).output_payload;
    const r2 = compute(shuffled).output_payload;
    if (r1.three_way.client_ledger_total_minor !== r2.three_way.client_ledger_total_minor) violations++;
    if (r1.three_way.equality_holds !== r2.three_way.equality_holds) violations++;
    if (r1.negative_balance_findings.length !== r2.negative_balance_findings.length) violations++;
    if (r1.verdict !== r2.verdict) violations++;
  }
  return { name: 'P3_client_ledger_order_invariance', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception -- no ULP forcing applies) ----------
function checkP4_forced_categorical_boundaries() {
  let violations = 0, checked = 0;
  const base = { reconciliation_tolerance_minor: 0, statement_period: { start_date: '2026-06-01', end_date: '2026-06-30' }, bank: { ending_balance_minor: 1000000, statement_date: '2026-06-30' }, trust_ledger: { ending_balance_minor: 1000000, as_of: '2026-06-30' }, client_ledgers: [{ client_id: 'c1', ending_balance_minor: 1000000, as_of: '2026-06-30', entries: [] }], outstanding_items: [] };

  // exact tolerance boundary: difference === tolerance -> equality_holds true
  checked++;
  {
    const r = compute({ ...base, reconciliation_tolerance_minor: 100, bank: { ending_balance_minor: 1000100, statement_date: '2026-06-30' } }).output_payload;
    if (r.three_way.equality_holds !== true) violations++;
  }
  // one unit over tolerance -> equality_holds false
  checked++;
  {
    const r = compute({ ...base, reconciliation_tolerance_minor: 100, bank: { ending_balance_minor: 1000101, statement_date: '2026-06-30' } }).output_payload;
    if (r.three_way.equality_holds !== false || r.verdict !== 'DISCREPANT') violations++;
  }
  // client ledger dips exactly to -1 minor unit at some point -> negative finding
  checked++;
  {
    const pp = { ...base, client_ledgers: [{ client_id: 'c1', ending_balance_minor: 0, as_of: '2026-06-30', entries: [{ date: '2026-06-05', amount_minor: -1, description: 'd' }, { date: '2026-06-10', amount_minor: 1, description: 'r' }] }], bank: { ending_balance_minor: 0, statement_date: '2026-06-30' }, trust_ledger: { ending_balance_minor: 0, as_of: '2026-06-30' } };
    const r = compute(pp).output_payload;
    if (r.negative_balance_findings.length !== 1 || r.negative_balance_findings[0].low_point_minor !== -1) violations++;
  }
  // client low point exactly zero -> no negative finding (boundary: 0 is not negative)
  checked++;
  {
    const pp = { ...base, client_ledgers: [{ client_id: 'c1', ending_balance_minor: 0, as_of: '2026-06-30', entries: [] }], bank: { ending_balance_minor: 0, statement_date: '2026-06-30' }, trust_ledger: { ending_balance_minor: 0, as_of: '2026-06-30' } };
    const r = compute(pp).output_payload;
    if (r.negative_balance_findings.length !== 0) violations++;
  }
  // day-count aging exactness: an item dated exactly 90 days before period end -> "0-30"..90 boundary bucket "61-90"
  checked++;
  {
    const pp = { ...base, outstanding_items: [{ type: 'uncleared_check', date: '2026-04-01', amount_minor: 100, description: 'x' }] };
    const r = compute(pp).output_payload;
    if (r.outstanding_items[0].age_days !== 90 || r.outstanding_items[0].age_bucket !== '61-90') violations++;
  }
  // tolerance not declared -> did_not_run / INCOMPLETE
  checked++;
  {
    const r = compute({ statement_period: base.statement_period, bank: base.bank }).output_payload;
    if (r.verdict !== 'INCOMPLETE' || r.decision.execution_state !== 'did_not_run') violations++;
  }
  return { name: 'P4_forced_categorical_boundaries', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_bounded());
results.properties.push(checkP2_three_way_differential());
results.properties.push(checkP3_client_order_invariance());
results.properties.push(checkP4_forced_categorical_boundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-566-iolta-three-way-reconciliation',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
