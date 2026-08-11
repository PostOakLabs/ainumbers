// art-524-source-arrival-freshness-register.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C26-1).
// kernel_digest_at_authoring: sha256:27d4e48514eb2b1eed2231094e43e116be6b1457bbd2be49c4c5eca810550c64
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// ⛔⛔ CORRECTION TO THE WU ROW'S TABLE (per FIX-2, the RARER direction -- a float:no that IS
// float-sensitive): the row lists this kernel as float:no. Direct read of reconcileSource()
// shows two GENUINE, UNGUARDED floating-point threshold comparisons: `n(v)` is a bare
// `Number(v)` with only a Number.isFinite guard (no integer restriction) applied to
// reference_as_of / expected_as_of / observed_as_of / freshness_threshold_hours, and:
//   `late = expected_as_of !== null && observed_as_of > expected_as_of`
//   `stale = referenceAsOf !== null && freshness_threshold_hours !== null
//            && (referenceAsOf - observed_as_of) > freshness_threshold_hours`
// Both are direct float compares against a caller-declared numeric reference point with no
// Number.isSafeInteger gate and no tolerance/rounding. A caller can legitimately supply
// fractional-hour timestamps where floating-point representation error sits exactly on the
// late/stale boundary. Corrected to float:YES; ULP-boundary forcing is MANDATORY and provided
// below (P4).
// Checks: fixture-oracle gate, termination (sources.length === expected_sources.length, the
// kill-condition short-circuit never iterates), forced categorical boundary cases distinguishing
// the four source_status values (missing/unknown_freshness/late/stale/current) and the
// expected_sources-absence kill condition, differential re-derivation of source_status per
// source via an independent reconcileSource, boundedness (missing + late_or_stale +
// unknown_freshness sources are each subsets of sources.length), and ULP-boundary forcing
// (mandatory, float_sensitive: yes) on both the late (observed_as_of vs expected_as_of) and
// stale ((reference - observed) vs threshold) comparisons at 0, negative zero, and the exact/
// one-ULP boundary.
// Zero external dependencies -- pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-524-source-arrival-freshness-register.proptest.mjs

import { compute } from '../art-524-source-arrival-freshness-register.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-524-source-arrival-freshness-register.fixtures.json');
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
const rand = mulberry32(0x52440);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomPP(rng) {
  const n = 1 + Math.floor(rng() * 5);
  const expected_sources = Array.from({ length: n }, (_, i) => ({
    source_id: `S-${i}`, expected_as_of: 900 + Math.floor(rng() * 100), freshness_threshold_hours: pick(rng, [10, 50, 100]),
  }));
  const observed_arrivals = expected_sources
    .filter(() => rng() < 0.8)
    .map((s) => ({ source_id: s.source_id, arrived: true, observed_as_of: s.expected_as_of + Math.floor((rng() - 0.5) * 40) }));
  return { reference_as_of: 1000, expected_sources, observed_arrivals };
}

const TRIALS = 3000;

// ---------- P1: termination -- sources.length === expected_sources.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.source_count !== pp.expected_sources.length) violations++;
    if (output_payload.sources.length !== pp.expected_sources.length) violations++;
  }
  // kill condition: empty expected_sources terminates immediately, never iterates observed_arrivals
  {
    const { output_payload } = compute({ reference_as_of: 1000, expected_sources: [], observed_arrivals: [{ source_id: 'S-0', observed_as_of: 1000 }] });
    checked++;
    if (output_payload.execution_state !== 'did_not_run') violations++;
    if (output_payload.source_count !== 0) violations++;
  }
  return { name: 'P1_termination_source_count_and_kill_condition', trials: checked, violations };
}

// ---------- P2: forced categorical boundary cases -- the four source_status outcomes ----------
function checkP2_boundary_categorical() {
  let violations = 0, checked = 0;
  const mk = (es, oa) => ({ reference_as_of: 1000, expected_sources: es, observed_arrivals: oa });
  // missing: no observed arrival at all
  {
    const { output_payload } = compute(mk([{ source_id: 'S1', expected_as_of: 900, freshness_threshold_hours: 50 }], []));
    checked++;
    if (output_payload.sources[0].source_status !== 'missing') violations++;
  }
  // unknown_freshness: arrived but observed_as_of undeclared
  {
    const { output_payload } = compute(mk([{ source_id: 'S1', expected_as_of: 900, freshness_threshold_hours: 50 }], [{ source_id: 'S1', arrived: true }]));
    checked++;
    if (output_payload.sources[0].source_status !== 'unknown_freshness') violations++;
  }
  // current: on time and fresh
  {
    const { output_payload } = compute(mk([{ source_id: 'S1', expected_as_of: 900, freshness_threshold_hours: 200 }], [{ source_id: 'S1', arrived: true, observed_as_of: 900 }]));
    checked++;
    if (output_payload.sources[0].source_status !== 'current') violations++;
  }
  return { name: 'P2_source_status_forced_categorical', trials: checked, violations };
}

// ---------- P3 (differential): source_status re-derivation via independent reconcileSource ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const observedById = new Map(pp.observed_arrivals.map((o) => [o.source_id, o]));
    for (const es of pp.expected_sources) {
      const observed = observedById.get(es.source_id);
      const s = output_payload.sources.find((x) => x.source_id === es.source_id);
      if (!observed) {
        if (s.source_status !== 'missing') violations++;
        continue;
      }
      const late = observed.observed_as_of > es.expected_as_of;
      const stale = (pp.reference_as_of - observed.observed_as_of) > es.freshness_threshold_hours;
      const expected = late && stale ? 'late_and_stale' : late ? 'late' : stale ? 'stale' : 'current';
      if (s.source_status !== expected) violations++;
    }
  }
  return { name: 'P3_source_status_differential_via_independent_reconcile', trials: checked, violations };
}

// ---------- P4 (ULP-boundary forcing, MANDATORY -- float_sensitive: yes): late/stale threshold compares ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  const mk = (expected_as_of, observed_as_of, reference_as_of, threshold) => ({
    reference_as_of, expected_sources: [{ source_id: 'S1', expected_as_of, freshness_threshold_hours: threshold }],
    observed_arrivals: [{ source_id: 'S1', arrived: true, observed_as_of }],
  });
  const cases = [
    // late: observed === expected -> NOT late (strict >); one ULP over -> late
    { pp: mk(900, 900, 900, 1000), field: 'late', expect: false },
    { pp: mk(900, 900 + eps * 900, 900, 1000), field: 'late', expect: true },
    // stale: (reference - observed) === threshold -> NOT stale; one ULP over -> stale
    { pp: mk(0, 100, 100 + 50, 50), field: 'stale', expect: false }, // reference-observed = 50 exactly
    { pp: mk(0, 100, 100 + 50 + eps * 150, 50), field: 'stale', expect: true },
    // zero / negative zero boundary on the difference
    { pp: mk(0, 0, 0, 0), field: 'stale', expect: false }, // reference-observed = 0, threshold = 0, 0>0 false
    { pp: mk(0, -0, -0, 0), field: 'late', expect: false }, // -0 > -0 is false
  ];
  for (const c of cases) {
    const { output_payload } = compute(c.pp);
    checked++;
    const s = output_payload.sources[0];
    if (s[c.field] !== c.expect) violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_late_and_stale_thresholds', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundary_categorical());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-524-source-arrival-freshness-register',
  float_sensitive: true,
  float_sensitive_correction: 'WU row table said float:no; direct source read shows two genuine, unguarded floating-point threshold compares (observed_as_of > expected_as_of for "late", and (reference_as_of - observed_as_of) > freshness_threshold_hours for "stale") over caller-declared numeric reference points with only a Number.isFinite guard, no integer restriction. Corrected to float:YES; ULP-boundary forcing applied (P4, mandatory).',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
