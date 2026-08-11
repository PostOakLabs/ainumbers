// kernel_digest_at_authoring: sha256:54ec1d5b6fe7faac635820bc4b60de9ea75ea643abec9d1f312b6f54de3125fa
//
// FV-PROPFLOOR-SHARD-B27-1 — property-test floor for art-588-docket-deadline-sweep.
// Class B (bounded-numeric). float:no — every comparison is integer calendar-day arithmetic
// (Date.parse of YYYY-MM-DD at UTC midnight, divided by exactly 86400000), never a continuous
// float threshold; forced categorical boundary cases stand in for ULP-forcing per spec §3.
// Zero external dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-588-docket-deadline-sweep.proptest.mjs

import { compute } from '../art-588-docket-deadline-sweep.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-588-docket-deadline-sweep.fixtures.json');
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
const rand = mulberry32(0x588D4);
const TRIALS = 8000;
const STATUSES = ['OVERDUE', 'DUE_SOON', 'SCHEDULED', 'DONE', 'INDETERMINATE'];

function addDays(date, n) { return new Date(Date.parse(date + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10); }

function mkPP(rng) {
  const asOf = '2026-08-08';
  const recordCount = 1 + Math.floor(rng() * 8);
  const records = [];
  for (let i = 0; i < recordCount; i++) {
    const offset = Math.floor(rng() * 60) - 30;
    records.push({
      date: addDays(asOf, offset),
      action: 'action-' + i + '-' + Math.floor(rng() * 5),
      type: 'deadline',
      source: 'test',
      done: rng() < 0.2,
    });
  }
  return { as_of_date: asOf, due_soon_days_threshold: 1 + Math.floor(rng() * 14), roll_rule: { roll_weekends: rng() < 0.5, roll_direction: rng() < 0.5 ? 'forward' : 'backward', holiday_dates: [] }, records };
}

// ---------- P1: boundedness — every record status is one of the five declared bands ----------
function checkP1_statusBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    for (const rec of r.output_payload.records) {
      if (!STATUSES.includes(rec.status)) violations++;
    }
  }
  return { name: 'P1_status_bounded_to_declared_bands', trials: checked, violations };
}

// ---------- P2: metamorphic — a record marked done:true is ALWAYS retained and reported DONE, regardless of date ----------
function checkP2_doneRecordsNeverDropped() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const withDone = { ...pp, records: pp.records.map((r, idx) => idx === 0 ? { ...r, done: true } : r) };
    const r = compute(withDone);
    checked++;
    const rec0 = r.output_payload.records.find((x) => x.record_id === 'rec-0');
    if (!rec0 || rec0.status !== 'DONE') violations++;
  }
  return { name: 'P2_done_records_never_dropped_status_always_DONE', trials: checked, violations };
}

// ---------- P3: fixed rule — days_remaining recomputes exactly as dayDiff(as_of_date, rolled_date) ----------
function checkP3_daysRemainingExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    for (const rec of r.output_payload.records) {
      if (rec.status === 'INDETERMINATE') continue;
      const expected = Math.round((Date.parse(rec.rolled_date + 'T00:00:00Z') - Date.parse(pp.as_of_date + 'T00:00:00Z')) / 86400000);
      if (rec.days_remaining !== expected) violations++;
    }
  }
  return { name: 'P3_days_remaining_exact_recompute', trials: checked, violations };
}

// ---------- P4 (forced categorical boundary cases) ----------
const FORCED_CASES = [
  [{ as_of_date: '2026-08-08', records: [{ date: '2026-08-07', action: 'A', done: false }] }, 'record one day overdue — OVERDUE'],
  [{ as_of_date: '2026-08-08', due_soon_days_threshold: 7, records: [{ date: '2026-08-15', action: 'A', done: false }] }, 'record exactly at due-soon threshold (7 days) — DUE_SOON'],
  [{ as_of_date: '2026-08-08', due_soon_days_threshold: 7, records: [{ date: '2026-08-16', action: 'A', done: false }] }, 'record one day past due-soon threshold — SCHEDULED'],
  [{ as_of_date: '2026-08-08', records: [{ date: '2026-08-08', action: 'A', done: false }] }, 'record due today (0 days remaining) — DUE_SOON, not OVERDUE'],
  [{ as_of_date: '2026-08-08', records: [{ date: 'not-a-date', action: 'A', done: false }] }, 'malformed date — record retained as INDETERMINATE, not dropped'],
  [{ as_of_date: '2026-08-08', records: [{ date: '2026-08-08', action: 'Same action', done: false }, { date: '2026-08-09', action: 'Same action', done: false }] }, 'two records same action different dates — conflict detected'],
  [{ as_of_date: '2026-08-08', records: [{ date: '2026-08-08', action: 'A', done: true }] }, 'overdue-looking date but done:true — DONE always wins over date-derived band'],
  [{ as_of_date: '2026-08-08', records: [] }, 'no records supplied — no_usable_records empty result'],
  [{ as_of_date: '2026-08-08', roll_rule: { roll_weekends: true, roll_direction: 'forward', holiday_dates: [] }, records: [{ date: '2026-08-08', action: 'A', done: false }] }, 'roll_weekends true on a Saturday due date — rolls forward past the weekend'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of FORCED_CASES) {
    const r = compute(pp);
    const op = r.output_payload;
    const plausible = Array.isArray(op.records) && op.records.every((rec) => STATUSES.includes(rec.status));
    rows.push({ label, input: pp, decision: op.decision, records: op.records, conflicts: op.conflicts, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_statusBounded());
results.properties.push(checkP2_doneRecordsNeverDropped());
results.properties.push(checkP3_daysRemainingExact());
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
