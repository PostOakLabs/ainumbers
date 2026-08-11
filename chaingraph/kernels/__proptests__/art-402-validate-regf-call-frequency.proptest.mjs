// art-402-validate-regf-call-frequency.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C19-1).
// kernel_digest_at_authoring: sha256:49d5b68d9b602859352499b88b4a3748a4eb06f8c6e3e58b98c6198ca136bc9f
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — every date value is parsed to integer epoch-ms via
// Date.UTC + a declared integer timezone_offset_minutes, day_index is Math.floor of an integer
// division by the constant MS_PER_DAY, and every downstream comparison is integer count/day-index
// comparison; no fractional arithmetic reaches a threshold decision — forced categorical boundary
// cases used instead of ULP forcing).
// Checks: fixture-oracle gate, termination (the O(n^2) 7-in-7 rolling-window walk and the O(n^2)
// quiet-period backward scan are both bounded by calls.length per debt group — no recursion, no
// unbounded accumulation), boundedness (seven_in_seven_trips/quiet_period_violations counts never
// exceed the per-debt call count), a differential re-derivation of the 7-in-7 and quiet-period
// presumption predicates against an independent reimplementation, a metamorphic identity
// (aggregate presumption counts, which do not depend on input_index, are invariant to shuffling
// the input calls array before parsing — only the per-record input_index labels change), and
// forced categorical boundary cases (exactly 7 calls in the 7-day window = no trip, the 8th call =
// trip, quiet-period gap of exactly 1 day and exactly 7 days = violation, gap of 8 days = clear,
// unparseable timestamp).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-402-validate-regf-call-frequency.proptest.mjs

import { compute } from '../art-402-validate-regf-call-frequency.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-402-validate-regf-call-frequency.fixtures.json');
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
const rand = mulberry32(0x402C19);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function iso(epochMs) { return new Date(epochMs).toISOString().slice(0, 19); }

const DEBTS = ['DEBT-A', 'DEBT-B'];
const BASE_MS = Date.UTC(2026, 0, 1);
const MS_PER_DAY = 86400000;

function randomCalls(rng, n) {
  const calls = [];
  let t = BASE_MS;
  for (let i = 0; i < n; i++) {
    t += Math.floor(rng() * MS_PER_DAY * 2);
    calls.push({
      timestamp: iso(t),
      debt_id: pick(rng, DEBTS),
      connected: rng() < 0.4,
    });
  }
  return calls;
}

function randomPP(rng) {
  const n = Math.floor(rng() * 15);
  return { inputs: { timezone_offset_minutes: 0, calls: randomCalls(rng, n) } };
}

// Independent reimplementation, used for the differential property.
function reimplement(calls) {
  const parsed = calls.map((c, idx) => {
    const t = Date.parse(c.timestamp + 'Z');
    return { idx, debt_id: c.debt_id, connected: !!c.connected, day: Math.floor(t / MS_PER_DAY) };
  });
  const byDebt = new Map();
  for (const c of parsed) { if (!byDebt.has(c.debt_id)) byDebt.set(c.debt_id, []); byDebt.get(c.debt_id).push(c); }
  const out = new Map();
  for (const [debt_id, list] of byDebt) {
    const sorted = list.slice().sort((a, b) => a.day - b.day || a.idx - b.idx);
    let sevenTrips = 0;
    for (let i = 0; i < sorted.length; i++) {
      const windowStart = sorted[i].day - 6;
      let count = 0;
      for (let j = 0; j <= i; j++) if (sorted[j].day >= windowStart && sorted[j].day <= sorted[i].day) count++;
      if (count > 7) sevenTrips++;
    }
    let quietViolations = 0;
    for (let i = 0; i < sorted.length; i++) {
      let priorDay = null;
      for (let j = i - 1; j >= 0; j--) if (sorted[j].connected) { priorDay = sorted[j].day; break; }
      if (priorDay === null) continue;
      const gap = sorted[i].day - priorDay;
      if (gap >= 1 && gap <= 7) quietViolations++;
    }
    out.set(debt_id, { has_7in7: sevenTrips > 0, has_quiet: quietViolations > 0 });
  }
  return out;
}

const TRIALS = 3000;

// ---------- P1: termination — trip/violation counts bounded by per-debt call count ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    for (const d of o.debts) {
      if (d.seven_in_seven_trips.length > d.calls_checked) violations++;
      if (d.quiet_period_violations.length > d.calls_checked) violations++;
    }
  }
  return { name: 'P1_termination_trips_bounded_by_calls_checked', trials: checked, violations };
}

// ---------- P2: boundedness — debts_checked matches distinct debt_ids among valid calls ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    const distinctDebts = new Set(pp.inputs.calls.map((c) => c.debt_id)).size;
    if (pp.inputs.calls.length > 0 && o.debts_checked > distinctDebts) violations++;
    if (o.debts_with_seven_in_seven_presumption > o.debts_checked) violations++;
    if (o.debts_with_quiet_period_presumption > o.debts_checked) violations++;
  }
  return { name: 'P2_debts_checked_bounded_by_distinct_debt_ids', trials: checked, violations };
}

// ---------- P3: differential — 7-in-7 and quiet-period presumption predicates re-derived ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    const reimpl = reimplement(pp.inputs.calls);
    for (const d of o.debts) {
      checked++;
      const r = reimpl.get(d.debt_id);
      if (!r) { violations++; continue; }
      if (d.seven_in_seven_presumption !== r.has_7in7) violations++;
      if (d.quiet_period_presumption !== r.has_quiet) violations++;
    }
  }
  return { name: 'P3_presumption_predicates_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — aggregate presumption counts invariant under input shuffle ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1000; i++) {
    const pp = randomPP(rand);
    if (pp.inputs.calls.length < 2) continue;
    const r1 = compute(pp).output_payload;
    const shuffled = [...pp.inputs.calls];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const r2 = compute({ inputs: { ...pp.inputs, calls: shuffled } }).output_payload;
    checked++;
    if (r1.debts_with_seven_in_seven_presumption !== r2.debts_with_seven_in_seven_presumption) violations++;
    if (r1.debts_with_quiet_period_presumption !== r2.debts_with_quiet_period_presumption) violations++;
    if (r1.debts_checked !== r2.debts_checked) violations++;
  }
  return { name: 'P4_aggregate_presumption_counts_permutation_invariant', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no) ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  // exactly 7 calls in 7 consecutive days -> no trip
  {
    const calls = Array.from({ length: 7 }, (_, i) => ({ timestamp: iso(BASE_MS + i * MS_PER_DAY), debt_id: 'D1', connected: false }));
    const { output_payload: o } = compute({ inputs: { timezone_offset_minutes: 0, calls } });
    checked++;
    if (o.debts[0].seven_in_seven_presumption) violations++;
  }
  // 8th call in the same 7-day window -> trip
  {
    const calls = Array.from({ length: 8 }, (_, i) => ({ timestamp: iso(BASE_MS + Math.floor(i * 6 / 7) * MS_PER_DAY), debt_id: 'D1', connected: false }));
    const { output_payload: o } = compute({ inputs: { timezone_offset_minutes: 0, calls } });
    checked++;
    if (!o.debts[0].seven_in_seven_presumption) violations++;
  }
  // quiet period exactly 1 day and exactly 7 days after a connected call -> violation; 8 days -> clear
  {
    const calls = [
      { timestamp: iso(BASE_MS), debt_id: 'D2', connected: true },
      { timestamp: iso(BASE_MS + 1 * MS_PER_DAY), debt_id: 'D2', connected: false },
      { timestamp: iso(BASE_MS + 8 * MS_PER_DAY), debt_id: 'D2', connected: true },
      { timestamp: iso(BASE_MS + 15 * MS_PER_DAY), debt_id: 'D2', connected: false },
      { timestamp: iso(BASE_MS + 23 * MS_PER_DAY), debt_id: 'D2', connected: false },
    ];
    const { output_payload: o } = compute({ inputs: { timezone_offset_minutes: 0, calls } });
    checked++;
    if (!o.debts[0].quiet_period_presumption) violations++;
    const v = o.debts[0].quiet_period_violations.map((x) => x.days_since_conversation);
    if (!v.includes(1) || !v.includes(7)) violations++;
    if (v.includes(8)) violations++;
  }
  // unparseable timestamp -> reported in invalid_call_indices, excluded from debts
  {
    const { output_payload: o } = compute({ inputs: { timezone_offset_minutes: 0, calls: [{ timestamp: 'not-a-date', debt_id: 'D3', connected: false }] } });
    checked++;
    if (!o.invalid_call_indices.includes(0)) violations++;
    if (o.debts_checked !== 0) violations++;
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
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_permutation_invariance());
results.properties.push(checkP5_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-402-validate-regf-call-frequency',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
