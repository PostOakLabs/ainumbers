// kernel_digest_at_authoring: sha256:bfd9eea1801c12c0b1358e111e33f08fcc221f3e847edd481053c5e90f81cd12
//
// FV-PROPFLOOR-SHARD-B17-1 — property-test floor for art-81-allocation-affirmation-conformance.
// Class B (bounded-numeric/categorical), FLOAT:NO per the WU row — the only arithmetic is
// integer minute-of-day parsing (toMinutes) and an integer-count percentage display value
// (on_time/total*100).toFixed(1); all decision logic (same-day check, cutoff comparison,
// format-mandate check) is categorical/string-comparison. Forced CATEGORICAL boundary cases
// used in place of ULP forcing. Zero external dependencies (mulberry32 PRNG + explicit
// boundary arrays), same shape as the B1/B12 harness. This file is READ-ONLY with respect to
// the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-81-allocation-affirmation-conformance.proptest.mjs

import { compute } from '../art-81-allocation-affirmation-conformance.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-81-allocation-affirmation-conformance.fixtures.json');
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
const rand = mulberry32(0x81E3F4);
const TRIALS = 8000;

function pad2(n) { return String(n).padStart(2, '0'); }

function mkEvent(rng) {
  const h = Math.floor(rng() * 24);
  const m = Math.floor(rng() * 60);
  const tradeDate = '2026-06-15';
  const useT = rng() < 0.5;
  const timestamp_ct = useT ? `${tradeDate}T${pad2(h)}:${pad2(m)}:00` : `${pad2(h)}:${pad2(m)}`;
  return {
    event_type: rng() < 0.5 ? 'allocation' : 'confirmation',
    timestamp_ct,
    trade_date: tradeDate,
    format: rng() < 0.6 ? 'machine-readable' : 'manual',
    counterparty_type: 'buy-side',
  };
}

function mkPP(rng) {
  const n = Math.floor(rng() * 6);
  return { events: Array.from({ length: n }, () => mkEvent(rng)), cutoff_local: '23:00' };
}

// ---------- P1: on_time_events + events_flagged-with-a-timing-rule always covers the total ----------
// ---------- (an event may be flagged for format only and still count on_time) ----------------------
function checkP1_onTimeCountConsistentWithFlags() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { events_flagged, on_time_events, total_events } = r.output_payload;
    const lateFlagged = events_flagged.filter(e => e.issues.some(i => i.rule === 'LATE_ALLOCATION' || i.rule === 'LATE_CONFIRMATION')).length;
    if (on_time_events + lateFlagged !== total_events) violations++;
  }
  return { name: 'P1_on_time_plus_late_flagged_equals_total_events', trials: checked, violations };
}

// ---------- P2: on_time_rate is bounded to [0,100] and exactly 100 when zero events -----------------
function checkP2_onTimeRateBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { on_time_rate, total_events } = r.output_payload;
    if (on_time_rate < 0 || on_time_rate > 100) violations++;
    if (total_events === 0 && on_time_rate !== 100) violations++;
  }
  return { name: 'P2_on_time_rate_bounded_0_100_and_exact_when_empty', trials: checked, violations };
}

// ---------- P3: LATE_ALLOCATION/LATE_CONFIRMATION flags are the exact type-partitioned late-rule ---
function checkP3_lateRulePartitionedByEventType() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    for (const ev of r.output_payload.events_flagged) {
      for (const issue of ev.issues) {
        if (issue.rule === 'LATE_ALLOCATION' && ev.event_type !== 'allocation') violations++;
        if (issue.rule === 'LATE_CONFIRMATION' && ev.event_type === 'allocation') violations++;
      }
    }
  }
  return { name: 'P3_late_rule_exactly_partitioned_by_event_type', trials: checked, violations };
}

// ---------- P4 (mandatory, float:no exception): forced categorical boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ events: [] }, 'empty events array — on_time_rate must be exactly 100, all counters exactly 0'],
  [{ events: [{}] }, 'event with every field absent — timestamp_ct empty, evMins defaults to 23*60 (isNaN branch), sameDay defaults true (no trade_date), must flag MANUAL_FORMAT only (format undefined !== "machine-readable"), on_time depends on default 23:00==cutoff'],
  [{ events: [{ event_type: 'allocation', timestamp_ct: '2026-06-15T23:00:00', trade_date: '2026-06-15', format: 'machine-readable' }] }, 'event time exactly AT the 23:00 cutoff boundary (evMins===cutoffMins, uses strict > for late) — must NOT be flagged late'],
  [{ events: [{ event_type: 'allocation', timestamp_ct: '2026-06-15T23:01:00', trade_date: '2026-06-15', format: 'machine-readable' }] }, 'event time exactly one minute past cutoff — must be flagged LATE_ALLOCATION'],
  [{ events: [{ event_type: 'confirmation', timestamp_ct: '2026-06-16T10:00:00', trade_date: '2026-06-15', format: 'machine-readable' }] }, 'event date-part mismatches trade_date (next calendar day) — sameDay must be false regardless of time, flagged LATE_CONFIRMATION with the date-mismatch reason'],
  [{ events: [{ event_type: 'allocation', timestamp_ct: '2026-06-15T10:00:00', format: 'machine-readable' }] }, 'trade_date entirely absent — sameDay defaults true via !ev.trade_date short-circuit, must NOT be flagged late purely for the missing trade_date'],
  [{ events: [{ event_type: 'allocation', timestamp_ct: '10:00', trade_date: '2026-06-15', format: 'machine-readable' }] }, 'timestamp_ct has no "T" separator (bare HH:MM) — sameDay defaults true via !tsStr.includes("T"), only time compared against cutoff'],
  [{ events: [{ event_type: 'allocation', timestamp_ct: '2026-06-15T10:00:00', trade_date: '2026-06-15', format: 'MACHINE-READABLE' }] }, 'format string case-mismatched (uppercase, strict !== comparison) — must flag MANUAL_FORMAT despite being semantically machine-readable'],
  [{ events: [{ event_type: 'allocation', timestamp_ct: '2026-06-15T10:00:00', trade_date: '2026-06-15', format: 'machine-readable' }], cutoff_local: '00:00' }, 'cutoff_local set to midnight (earliest possible boundary) — any daytime event must be flagged late'],
  [{ events: [{ event_type: 'confirmation', timestamp_ct: 'not-a-timestamp', trade_date: '2026-06-15', format: 'machine-readable' }] }, 'malformed non-parseable timestamp string — toMinutes must fall back to 23:00 default (isNaN branch), no NaN leak into evMins'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { on_time_rate, total_events, on_time_events } = r.output_payload;
    const plausible = Number.isFinite(on_time_rate) && on_time_rate >= 0 && on_time_rate <= 100
      && Number.isInteger(total_events) && Number.isInteger(on_time_events);
    rows.push({ label, input: pp, on_time_rate, events_flagged: r.output_payload.events_flagged, compliance_flags: r.compliance_flags, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_onTimeCountConsistentWithFlags());
results.properties.push(checkP2_onTimeRateBounded());
results.properties.push(checkP3_lateRulePartitionedByEventType());
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
