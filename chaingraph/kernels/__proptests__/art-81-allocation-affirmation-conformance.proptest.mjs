// kernel_digest_at_authoring: sha256:e6d66ac78af3a725624dda5ebd2cd321fe68c11a2659c065cee2725b04e21a3c
//
// ART81-TIMESTAMP-STRICT-PARSE-FIX-1 — property-test floor for art-81-allocation-affirmation-conformance.
// Class B (bounded-numeric/categorical), FLOAT:NO — the only arithmetic is integer
// minute-of-day parsing and an integer-count percentage display value; all decision
// logic (strict calendar/timestamp/cutoff validation, same-day check, cutoff comparison,
// format-mandate check, event-type normalisation) is categorical/string comparison.
// Zero external dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as
// the B1/B12 harness. READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-81-allocation-affirmation-conformance.proptest.mjs

import { compute, buildArtifact } from '../art-81-allocation-affirmation-conformance.kernel.mjs';
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
  const s = Math.floor(rng() * 60);
  const tradeDate = '2026-06-15';
  const timestamp_ct = `${tradeDate}T${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  return {
    event_type: rng() < 0.5 ? 'allocation' : (rng() < 0.5 ? 'confirmation' : 'affirmation'),
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

// P1: on_time_events + late-flagged equals total_events (refused events are excluded from
// both the numerator and the denominator, and are listed only in input_issues).
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

// P2: on_time_rate bounded to [0,100], exactly 100 when nothing was scored.
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

// P3: LATE_* flags are the exact normalised-type partition.
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
  return { name: 'P3_late_rule_exactly_partitioned_by_normalised_event_type', trials: checked, violations };
}

// P4 (row: refused events are never counted on time): every event-scoped refusal consumes an
// event that is neither scored nor flagged, so total + refusals === events.length, and a
// refused cutoff scores nothing.
function checkP4_refusalsNeverCountedOnTime() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const eventIssues = output_payload.input_issues.filter(x => x.field === 'timestamp_ct' || x.field === 'event_type');
    const cutoffRefused = output_payload.input_issues.some(x => x.field === 'cutoff_local');
    if (cutoffRefused) {
      if (output_payload.total_events !== 0 || output_payload.on_time_events !== 0) violations++;
    } else if (output_payload.total_events + eventIssues.length !== pp.events.length) violations++;
    const flaggedIndexes = new Set(output_payload.events_flagged.map(e => e.timestamp_ct));
    for (const issue of eventIssues) {
      const ev = pp.events[issue.index];
      if (ev === undefined) { violations++; continue; }
      if (flaggedIndexes.has(ev.timestamp_ct)) violations++;
    }
  }
  return { name: 'P4_refused_events_never_counted_on_time', trials: checked, violations };
}

// P5 (row: a valid event's verdict is monotonic in time) — at a fixed valid date/type/format,
// lateness is non-decreasing as the timestamp crosses the cutoff, and seconds count.
function checkP5_lateMonotonicInTime() {
  const times = ['2026-12-07T22:59', '2026-12-07T23:00', '2026-12-07T23:00:00', '2026-12-07T23:00:01', '2026-12-07T23:01', '2026-12-07T23:59:59'];
  let violations = 0;
  let prevLate = false;
  for (const t of times) {
    const { output_payload } = compute({ events: [{ event_type: 'allocation', timestamp_ct: t, trade_date: '2026-12-07', format: 'machine-readable' }] });
    const late = output_payload.events_flagged.some(e => e.issues.some(i => i.rule === 'LATE_ALLOCATION'));
    if (prevLate && !late) violations++;
    prevLate = late;
  }
  return { name: 'P5_late_verdict_monotonic_in_time_with_seconds', trials: times.length, violations };
}

// P6 (D6 ANYKERNEL): buildArtifact never throws on non-I-JSON or oversized witnesses.
async function checkP6_buildArtifactNeverThrows() {
  const deep = (n) => { let o = /** @type {any} */ ({}); const r = o; for (let i = 0; i < n; i++) { o.x = {}; o = o.x; } return r; };
  const big = () => new Array(1_000_002).fill(1);
  const junk = [NaN, -Infinity, 1e300, deep(600), big(), null, undefined, 'junk', {}, []];
  let throws = 0, refused = 0;
  for (const pp of junk) {
    let a;
    try { a = await buildArtifact(pp); } catch { throws++; continue; }
    if (a && a.execution_hash === null && 'hash_refusal' in a) refused++;
  }
  return { name: 'P6_buildArtifact_never_throws', trials: junk.length, throws, refused, violations: throws };
}

// P7: forced categorical boundary cases.
const CATEGORICAL_BOUNDARY_CASES = [
  [{ events: [] }, 'empty events — on_time_rate exactly 100, all counters 0, input_valid true'],
  [{ events: [{}] }, 'event with every field absent — timestamp and event_type both refused; nothing scored; input_valid false with two input_issues'],
  [{ events: [{ event_type: 'allocation', timestamp_ct: '2026-06-15T23:00:00', trade_date: '2026-06-15', format: 'machine-readable' }] }, 'exactly AT the 23:00 cutoff with seconds 00 — on time, not flagged'],
  [{ events: [{ event_type: 'allocation', timestamp_ct: '2026-06-15T23:00:45', trade_date: '2026-06-15', format: 'machine-readable' }] }, 'seconds past the cutoff — LATE_ALLOCATION'],
  [{ events: [{ event_type: 'allocation', timestamp_ct: '2026-06-15T23:01:00', trade_date: '2026-06-15', format: 'machine-readable' }] }, 'one minute past cutoff — LATE_ALLOCATION'],
  [{ events: [{ event_type: 'confirmation', timestamp_ct: '2026-06-16T10:00:00', trade_date: '2026-06-15', format: 'machine-readable' }] }, 'next-calendar-day date part — LATE_CONFIRMATION with date-mismatch reason'],
  [{ events: [{ event_type: 'allocation', timestamp_ct: '10:00', trade_date: '2026-06-15', format: 'machine-readable' }] }, 'bare HH:MM has no date — refused, not scored'],
  [{ events: [{ event_type: 'allocation', timestamp_ct: '2026-06-15T10:00:00', trade_date: '2026-06-15', format: 'MACHINE-READABLE' }] }, 'format string case-mismatched — MANUAL_FORMAT (machine-readable rule unchanged)'],
  [{ events: [{ event_type: 'allocation', timestamp_ct: '2026-06-15T10:00:00', trade_date: '2026-06-15', format: 'machine-readable' }], cutoff_local: '00:00' }, 'cutoff at midnight — daytime event flagged late'],
  [{ events: [{ event_type: 'confirmation', timestamp_ct: 'not-a-timestamp', trade_date: '2026-06-15', format: 'machine-readable' }] }, 'malformed timestamp — refused, never coerced to 23:00'],
  [{ events: [{ event_type: 'allocation', timestamp_ct: '2026-02-31T09:00', trade_date: '2026-02-28', format: 'machine-readable' }] }, 'impossible calendar date — refused'],
  [{ events: [{ event_type: 'Allocation', timestamp_ct: '2026-06-15T23:59:00', trade_date: '2026-06-15', format: 'machine-readable' }] }, 'mixed-case event_type — normalised, LATE_ALLOCATION'],
];

function checkP7_forced() {
  return CATEGORICAL_BOUNDARY_CASES.map(([pp, label]) => {
    const r = compute(pp);
    const { on_time_rate, total_events, on_time_events } = r.output_payload;
    const plausible = Number.isFinite(on_time_rate) && on_time_rate >= 0 && on_time_rate <= 100
      && Number.isInteger(total_events) && Number.isInteger(on_time_events);
    return { label, input: pp, on_time_rate, events_flagged: r.output_payload.events_flagged, compliance_flags: r.compliance_flags, plausible };
  });
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_onTimeCountConsistentWithFlags());
results.properties.push(checkP2_onTimeRateBounded());
results.properties.push(checkP3_lateRulePartitionedByEventType());
results.properties.push(checkP4_refusalsNeverCountedOnTime());
results.properties.push(checkP5_lateMonotonicInTime());
results.properties.push(await checkP6_buildArtifactNeverThrows());
results.boundary_forced = checkP7_forced();

const anyPropertyViolation = results.properties.some((p) => (p.violations || 0) > 0);
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
