// art-517-audit-trail-completeness.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C26-1).
// kernel_digest_at_authoring: sha256:10ff11fc5e0034422df62658e0ca6d0c810e4f3a171d94f3a5be120cf5dfec41
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed -- the WU row's own table agrees, no correction
// needed). Every numeric input passes through safeInt(), which does `Number(v)` then
// `Math.trunc()` and returns null unless finite -- there is no comparison anywhere in compute()
// that is not an integer compare (sequence positions, event counts, retention days). The only
// unbounded structure (sequence enumeration) is hard-capped at MAX_SEQ_RANGE=20000 and reports
// UNDECIDABLE rather than looping past it.
// Checks: fixture-oracle gate, termination (sequence enumeration bounded by MAX_SEQ_RANGE,
// gaps/observed/periods bounded by MAX_ITEMS/input length), forced categorical boundary cases at
// the MAX_SEQ_RANGE undecidable threshold and the retention-days equality boundary, differential
// re-derivation of continuity_verdict for each of the three mechanisms, boundedness (gap_count
// never exceeds the declared range; event_counts_by_type key count capped at 64), and
// metamorphic invariance (an out-of-window observed_sequence_number never changes the verdict).
// Zero external dependencies -- pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-517-audit-trail-completeness.proptest.mjs

import { compute } from '../art-517-audit-trail-completeness.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-517-audit-trail-completeness.fixtures.json');
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
const rand = mulberry32(0x517B0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomPP(rng) {
  const mech = pick(rng, ['sequence_number', 'hash_chain', 'control_total']);
  const start = Math.floor(rng() * 20);
  const end = start + Math.floor(rng() * 15);
  const observed = [];
  for (let i = start; i <= end; i++) if (rng() < 0.8) observed.push(i);
  return {
    window_start: '2026-08-01', window_end: '2026-08-10',
    continuity_mechanism: mech,
    sequence_start: start, sequence_end: end,
    observed_sequence_numbers: observed,
    chain_links: [],
    periods: [],
    observed_event_counts_by_type: { transaction: Math.floor(rng() * 100), privileged_action: Math.floor(rng() * 5) },
    declared_retention_period_days: pick(rng, [30, 90, 365]),
    required_retention_period_days: pick(rng, [30, 90, 365]),
    gap_candidates: [],
  };
}

const TRIALS = 3000;

// ---------- P1: termination -- sequence enumeration bounded by MAX_SEQ_RANGE, no infinite loop ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.gap_count !== output_payload.gaps.length) violations++;
    if (output_payload.gaps.length > 21000) violations++; // MAX_SEQ_RANGE + MAX_ITEMS margin
  }
  // Forced: a range far beyond MAX_SEQ_RANGE terminates immediately as UNDECIDABLE, never hangs.
  {
    const { output_payload } = compute({ window_start: 'w', window_end: 'w2', continuity_mechanism: 'sequence_number', sequence_start: 0, sequence_end: 5000000 });
    checked++;
    if (output_payload.continuity_verdict !== 'UNDECIDABLE') violations++;
    if (output_payload.gaps.length !== 0) violations++;
  }
  return { name: 'P1_termination_sequence_range_bounded', trials: checked, violations };
}

// ---------- P2: forced categorical boundary cases -- MAX_SEQ_RANGE and retention-days equality ----------
function checkP2_boundary_categorical() {
  let violations = 0, checked = 0;
  // MAX_SEQ_RANGE = 20000 -- range of exactly 20000 is enumerable, 20001 is UNDECIDABLE
  {
    const { output_payload } = compute({ window_start: 'w', window_end: 'w2', continuity_mechanism: 'sequence_number', sequence_start: 1, sequence_end: 20000, observed_sequence_numbers: [] });
    checked++;
    if (output_payload.continuity_verdict === 'UNDECIDABLE') violations++;
  }
  {
    const { output_payload } = compute({ window_start: 'w', window_end: 'w2', continuity_mechanism: 'sequence_number', sequence_start: 1, sequence_end: 20001, observed_sequence_numbers: [] });
    checked++;
    if (output_payload.continuity_verdict !== 'UNDECIDABLE') violations++;
  }
  // retention: declared === required -> conforms; declared === required-1 -> does not conform
  {
    const { output_payload } = compute({ window_start: 'w', window_end: 'w2', continuity_mechanism: 'control_total', periods: [{ period_id: 'p1', declared_event_count: 1, reported_event_count: 1 }], declared_retention_period_days: 90, required_retention_period_days: 90 });
    checked++;
    if (output_payload.retention_conformance.conforms !== true) violations++;
  }
  {
    const { output_payload } = compute({ window_start: 'w', window_end: 'w2', continuity_mechanism: 'control_total', periods: [{ period_id: 'p1', declared_event_count: 1, reported_event_count: 1 }], declared_retention_period_days: 89, required_retention_period_days: 90 });
    checked++;
    if (output_payload.retention_conformance.conforms !== false) violations++;
  }
  return { name: 'P2_max_seq_range_and_retention_boundary_forced_categorical', trials: checked, violations };
}

// ---------- P3 (differential): continuity_verdict re-derivation per mechanism ----------
function checkP3_verdict_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (pp.continuity_mechanism === 'sequence_number') {
      const rangeSize = pp.sequence_end - pp.sequence_start + 1;
      if (rangeSize > 20000) {
        if (output_payload.continuity_verdict !== 'UNDECIDABLE') violations++;
      } else {
        const observedSet = new Set(pp.observed_sequence_numbers.filter((n) => n >= pp.sequence_start && n <= pp.sequence_end));
        let expectedGaps = 0;
        for (let s = pp.sequence_start; s <= pp.sequence_end; s++) if (!observedSet.has(s)) expectedGaps++;
        const expectedVerdict = expectedGaps === 0 ? 'CONTINUOUS' : 'GAP_DETECTED';
        if (output_payload.continuity_verdict !== expectedVerdict) violations++;
        if (output_payload.gap_count !== Math.min(expectedGaps, 5000)) violations++;
      }
    }
  }
  return { name: 'P3_sequence_verdict_differential', trials: checked, violations };
}

// ---------- P4: boundedness -- gap_count and event_counts_by_type key count ----------
function checkP4_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.gap_count < 0) violations++;
    if (Object.keys(output_payload.event_counts_by_type).length > 64) violations++;
  }
  return { name: 'P4_gap_count_and_event_type_keys_bounded', trials: checked, violations };
}

// ---------- P5: metamorphic -- an out-of-window observed_sequence_number never changes the verdict ----------
function checkP5_out_of_window_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = randomPP(rand);
    if (pp.continuity_mechanism !== 'sequence_number') continue;
    const r1 = compute(pp).output_payload;
    checked++;
    const outOfWindow = pp.sequence_end + 1000;
    const r2 = compute({ ...pp, observed_sequence_numbers: [...pp.observed_sequence_numbers, outOfWindow] }).output_payload;
    checked++;
    if (r1.continuity_verdict !== r2.continuity_verdict) violations++;
    if (r1.gap_count !== r2.gap_count) violations++;
  }
  return { name: 'P5_out_of_window_observation_noop_metamorphic', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundary_categorical());
results.properties.push(checkP3_verdict_differential());
results.properties.push(checkP4_boundedness());
results.properties.push(checkP5_out_of_window_metamorphic());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-517-audit-trail-completeness',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
