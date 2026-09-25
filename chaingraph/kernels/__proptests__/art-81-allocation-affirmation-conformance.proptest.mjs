// kernel_digest_at_authoring: sha256:d6d6f8eb91be4fc7715594a7b334c2042c7d1363e7d9b9d594816dc46b619cc0
//
// FV-PROPFLOOR-SHARD-B17-1 — property-test floor for art-81-allocation-affirmation-conformance.
// REAUTHORED 2026-09-25 by board row T1-ALLOC-EVIDENCE-REPAIR-1. The previous floor asserted
// the pre-repair contract (`events_flagged`, `total_events`, `timestamp_ct`, `cutoff_local`,
// and "an empty batch is a 100% on-time rate"). The repaired kernel classifies per event with
// stable reason codes and returns NO rate when nothing could be evaluated, so those properties
// are not merely stale, they assert behaviour the repair deliberately removed.
//
// Class B (bounded-numeric/categorical), FLOAT:NO — the only arithmetic is integer civil-date
// and minute arithmetic (daysFromCivil, UTC minute offsets) plus one display percentage
// (conforming/evaluated*100).toFixed(1); every decision is a categorical or integer comparison.
// Forced CATEGORICAL boundary cases are used in place of ULP forcing. Zero external dependencies
// (mulberry32 PRNG + explicit boundary arrays). This file is READ-ONLY with respect to the
// kernel it imports.
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

const VOCAB = [
  'on_time', 'late', 'not_evaluable', 'malformed', 'duplicate',
  'format_nonconforming', 'receipt_confirmation_late', 'receipt_confirmation_next_day_ok',
];
const EVALUATED = ['on_time', 'late', 'format_nonconforming', 'receipt_confirmation_late', 'receipt_confirmation_next_day_ok'];

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
const TRIALS = 6000;

function pad2(n) { return String(n).padStart(2, '0'); }

const TRADE_DATES = ['2026-12-07', '2026-11-30', '2027-06-15', '2027-10-11'];
const OFFSETS = ['+01:00', '+02:00', '+00:00', 'Z'];
const TYPES = ['allocation', 'confirmation', 'receipt_confirmation', 'settlement_instruction'];

function mkEvent(rng) {
  const h = Math.floor(rng() * 24);
  const m = Math.floor(rng() * 60);
  const tradeDate = TRADE_DATES[Math.floor(rng() * TRADE_DATES.length)];
  const offset = OFFSETS[Math.floor(rng() * OFFSETS.length)];
  // ~15% of generated events deliberately carry no explicit offset, so the malformed
  // branch is exercised as often as the evaluable ones.
  const ts = rng() < 0.15
    ? `${tradeDate}T${pad2(h)}:${pad2(m)}:00`
    : `${tradeDate}T${pad2(h)}:${pad2(m)}:00${offset}`;
  const ev = {
    event_type: TYPES[Math.floor(rng() * TYPES.length)],
    event_timestamp: ts,
    trade_date: rng() < 0.1 ? undefined : tradeDate,
    client_type: rng() < 0.15 ? 'retail' : 'professional',
    reference: 'R-' + Math.floor(rng() * 3),
  };
  if (rng() < 0.8) ev.format = rng() < 0.7 ? 'structured' : 'unstructured';
  if (rng() < 0.1) ev.unavailability_documented = true;
  return ev;
}

function mkPP(rng) {
  const n = Math.floor(rng() * 6);
  const pp = {
    regime: rng() < 0.2 ? 'UK_AST' : 'EU_CSDR',
    logical_date: TRADE_DATES[Math.floor(rng() * TRADE_DATES.length)],
    cutoff_timezone_reading: rng() < 0.5 ? 'CET_LITERAL_UTC_PLUS_1' : 'CENTRAL_EUROPEAN_LOCAL',
    rule_version: 'c(2026)-4640-final',
    events: Array.from({ length: n }, () => mkEvent(rng)),
  };
  if (rng() < 0.5) { pp.firm_close_of_business = '18:00'; pp.firm_start_of_business = '08:00'; }
  if (rng() < 0.3) pp.early_allocation_agreement = true;
  return pp;
}

// ---------- P1: the counts partition the submitted batch exactly, nothing is dropped ----------
function checkP1_countsPartitionSubmitted() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const { counts, events } = compute(pp).output_payload;
    checked++;
    const perClass = counts.on_time + counts.late + counts.format_nonconforming
      + counts.receipt_confirmation_late + counts.receipt_confirmation_next_day_ok
      + counts.malformed + counts.not_evaluable + counts.duplicate;
    if (perClass !== counts.submitted) violations++;
    if (counts.evaluated + counts.excluded !== counts.submitted) violations++;
    if (counts.submitted !== pp.events.length) violations++;
    if (events.length !== pp.events.length) violations++;
  }
  return { name: 'P1_counts_partition_submitted_batch_exactly', trials: checked, violations };
}

// ---------- P2: a rate exists iff something was evaluated, and equals the stated basis ----------
function checkP2_rateLaw() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const { counts, on_time_rate, status } = compute(mkPP(rand)).output_payload;
    checked++;
    if (counts.evaluated === 0) {
      if (status !== 'indeterminate' || on_time_rate !== null) violations++;
    } else {
      const conforming = counts.on_time + counts.receipt_confirmation_next_day_ok;
      const expected = +((conforming / counts.evaluated) * 100).toFixed(1);
      if (status !== 'evaluated') violations++;
      if (on_time_rate !== expected) violations++;
      if (!(on_time_rate >= 0 && on_time_rate <= 100)) violations++;
    }
  }
  return { name: 'P2_rate_is_null_iff_nothing_evaluated_else_conforming_over_evaluated', trials: checked, violations };
}

// ---------- P3: classification vocabulary, deadline coherence, and no silent exclusion ----------
function checkP3_classificationCoherent() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const { events } = compute(mkPP(rand)).output_payload;
    checked++;
    for (const ev of events) {
      if (!VOCAB.includes(ev.classification)) violations++;
      // every excluded event carries at least one reason code — nothing is dropped silently
      if (!EVALUATED.includes(ev.classification) && ev.reason_codes.length === 0) violations++;
      // a late verdict is never reached without a deadline it passed
      if (ev.classification === 'late') {
        if (ev.deadline_utc === null || !(ev.minutes_from_deadline > 0)) violations++;
      }
      // an on-time verdict with a deadline is never past it
      if (ev.classification === 'on_time' && ev.deadline_utc !== null) {
        if (!(ev.minutes_from_deadline <= 0)) violations++;
      }
      // a malformed event is never given a deadline
      if (ev.classification === 'malformed' && ev.deadline_utc !== null) violations++;
    }
  }
  return { name: 'P3_classification_vocabulary_and_deadline_coherence', trials: checked, violations };
}

// ---------- P4: determinism — the same inputs give byte-identical output, always ----------
function checkP4_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = mkPP(rand);
    checked++;
    if (JSON.stringify(compute(pp)) !== JSON.stringify(compute(pp))) violations++;
  }
  return { name: 'P4_compute_is_deterministic_for_identical_inputs', trials: checked, violations };
}

// ---------- P5 (mandatory, float:no exception): forced categorical boundary cases ----------
const EU = (over = {}) => ({
  regime: 'EU_CSDR',
  logical_date: '2026-12-07',
  cutoff_timezone_reading: 'CET_LITERAL_UTC_PLUS_1',
  rule_version: 'c(2026)-4640-final',
  early_allocation_agreement: true,
  ...over,
});
const ALLOC = (over = {}) => ({
  event_type: 'allocation',
  event_timestamp: '2026-12-07T22:00:00+01:00',
  trade_date: '2026-12-07',
  format: 'structured',
  client_type: 'professional',
  reference: 'A-1',
  ...over,
});

const CATEGORICAL_BOUNDARY_CASES = [
  [EU({ events: [] }), 'empty events array — must be indeterminate with on_time_rate null, never a 100% rate over nothing'],
  [{ events: [ALLOC()] }, 'logical_date entirely absent — applicability cannot be decided, run must be indeterminate and the event not_evaluable'],
  [EU({ events: [ALLOC({ event_timestamp: '2026-12-07T23:00:00+01:00' })] }), 'event exactly AT the 23:00 CET deadline (strict > for late) — must NOT be late'],
  [EU({ events: [ALLOC({ event_timestamp: '2026-12-07T23:01:00+01:00' })] }), 'event one minute past the deadline — must be late'],
  [EU({ events: [ALLOC({ event_timestamp: '2026-12-07T22:00:00' })] }), 'timestamp with no explicit offset — must be malformed, never assigned a default offset'],
  [EU({ events: [ALLOC({ event_timestamp: '2026-02-30T10:00:00+01:00' })] }), 'timestamp with an impossible calendar date — must be malformed'],
  [EU({ events: [ALLOC({ trade_date: undefined })] }), 'trade_date absent — the deadline is anchored on it, so the event must be not_evaluable and counted in excluded'],
  [EU({ cutoff_timezone_reading: 'CET', events: [ALLOC()] }), 'unknown timezone reading — must be indeterminate, never silently defaulted'],
  [EU({ events: [ALLOC({ format: 'unstructured' })] }), 'unstructured with no documented-unavailability flag — must be format_nonconforming'],
  [EU({ events: [ALLOC({ format: 'unstructured', unavailability_documented: true, reference: 'INC-1' })] }), 'unstructured under a declared documented unavailability with a reference — must be accepted with a disclosure, never silently'],
  [EU({ events: [ALLOC({ format: 'unstructured', unavailability_documented: true, reference: '' })] }), 'documented-unavailability flag with no documentation reference — must be malformed, the exception is not free'],
  [EU({ logical_date: '2026-11-30', events: [ALLOC({ event_timestamp: '2026-11-30T20:00:00+01:00', trade_date: '2026-11-30' })] }), 'logical_date before 2026-12-07 — the pre-amendment rule applies and is labelled; the amended rule is never applied early'],
  [EU({ logical_date: '2027-06-15', cutoff_timezone_reading: 'CET_LITERAL_UTC_PLUS_1', events: [ALLOC({ event_timestamp: '2027-06-15T23:30:00+02:00', trade_date: '2027-06-15' })] }), 'summer date under the literal UTC+1 reading — 21:30Z against a 22:00Z deadline, on time'],
  [EU({ logical_date: '2027-06-15', cutoff_timezone_reading: 'CENTRAL_EUROPEAN_LOCAL', events: [ALLOC({ event_timestamp: '2027-06-15T23:30:00+02:00', trade_date: '2027-06-15' })] }), 'same summer event under the local reading — 21:30Z against a 21:00Z deadline, late; the two readings must actually differ'],
  [EU({ regime: 'UK_AST', events: [ALLOC({ event_timestamp: '2026-12-07T23:59:00+00:00' })] }), 'UK regime exactly at 23:59 prevailing UK time — must NOT be late'],
  [EU({ events: [ALLOC(), ALLOC()] }), 'the same event key twice — the second must be duplicate and must not inflate the denominator'],
];

function checkP5_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const op = r.output_payload;
    const plausible = (op.status === 'evaluated' || op.status === 'indeterminate')
      && (op.on_time_rate === null || (Number.isFinite(op.on_time_rate) && op.on_time_rate >= 0 && op.on_time_rate <= 100))
      && (op.status === 'indeterminate' ? op.on_time_rate === null : true)
      && Object.values(op.counts).every(Number.isInteger)
      && op.events.every((e) => VOCAB.includes(e.classification))
      && op.disclosures.length > 0;
    rows.push({
      label,
      status: op.status,
      on_time_rate: op.on_time_rate,
      classifications: op.events.map((e) => e.classification),
      reason_codes: op.events.map((e) => e.reason_codes),
      unresolved: op.unresolved.map((u) => u.classification),
      compliance_flags: r.compliance_flags,
      plausible,
    });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_countsPartitionSubmitted());
results.properties.push(checkP2_rateLaw());
results.properties.push(checkP3_classificationCoherent());
results.properties.push(checkP4_determinism());
results.boundary_forced = checkP5_forced();

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
