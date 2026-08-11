// art-506-classify-t1-posttrade-timing.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C24-1).
// kernel_digest_at_authoring: sha256:bdca1dc3844ae202963a66ac4fb582aeafa1861b4dc2945696bf1d060d5bf780
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — the WU row's own table agrees, no correction
// needed). Every timestamp is parsed via a strict regex into integer calendar fields, converted
// through Date.UTC (an integer millisecond count) and reduced to INTEGER epoch seconds via
// Math.round(baseMs/1000). Every downstream comparison (margin_seconds, at-risk band, breach
// status) is an integer-second compare. There is no floating-point threshold anywhere.
// Checks: fixture-oracle gate, termination (steps bounded by input steps.length + the synthesised
// trade_execution step), forced categorical boundary cases at the integer margin_seconds=0 breach
// threshold and the at-risk band edge, differential re-derivation of per-step status/status_baseline
// from independently-parsed epoch seconds, boundedness (breached+at_risk+on_time+undetermined
// partitions step_count exactly), and metamorphic invariance (shifting a step's achieved_at one
// second later than its cutoff, holding everything else fixed, can only move status toward
// breached, never away — margin_seconds strictly decreases).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-506-classify-t1-posttrade-timing.proptest.mjs

import { compute } from '../art-506-classify-t1-posttrade-timing.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-506-classify-t1-posttrade-timing.fixtures.json');
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
const rand = mulberry32(0x506A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function ts(hour, min, sec) {
  return `2027-10-11T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}Z`;
}

function randomStep(rng, i) {
  const achievedH = Math.floor(rng() * 20);
  const cutT = achievedH + (rng() < 0.5 ? -1 : 1) * Math.floor(rng() * 3);
  return {
    step: `STEP-${i}`,
    achieved_at: rng() < 0.9 ? ts(achievedH, Math.floor(rng() * 60), Math.floor(rng() * 60)) : '',
    cutoff_target: rng() < 0.9 ? ts(Math.max(0, Math.min(23, cutT)), Math.floor(rng() * 60), 0) : '',
    cutoff_baseline: rng() < 0.7 ? ts(Math.max(0, Math.min(23, cutT + 1)), Math.floor(rng() * 60), 0) : '',
  };
}

function randomPP(rng) {
  const n = Math.floor(rng() * 6);
  const steps = [];
  for (let i = 0; i < n; i++) steps.push(randomStep(rng, i));
  return {
    trade_ref: 'TR-1', target_cycle: 'T+1', baseline_cycle: 'T+2',
    time_zone_offset_minutes: pick(rng, [0, 60, -300, null]),
    at_risk_margin_seconds: pick(rng, [0, 60, 300]),
    trade_timestamp: '', venue_cutoff: '',
    steps,
  };
}

const TRIALS = 5000;

// ---------- P1: termination — steps bounded by input steps.length (+ synthesised trade step) ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expectedLen = pp.steps.length + (pp.trade_timestamp && pp.venue_cutoff ? 1 : 0);
    if (output_payload.steps.length !== expectedLen) violations++;
    if (output_payload.step_count !== output_payload.steps.length) violations++;
  }
  return { name: 'P1_termination_steps_bounded_by_input_length', trials: checked, violations };
}

// ---------- P2: forced categorical boundary cases at margin_seconds=0 and the at-risk band edge ----------
function checkP2_margin_boundary_categorical() {
  let violations = 0, checked = 0;
  const cases = [
    { achieved: ts(10, 0, 0), cutoff: ts(10, 0, 0), band: 0, expectStatus: 'on_time' }, // margin exactly 0
    { achieved: ts(10, 0, 1), cutoff: ts(10, 0, 0), band: 0, expectStatus: 'breached' }, // margin -1
    { achieved: ts(10, 0, 0), cutoff: ts(10, 0, 59), band: 60, expectStatus: 'at_risk' }, // margin exactly at band edge
    { achieved: ts(10, 0, 0), cutoff: ts(10, 1, 0), band: 59, expectStatus: 'on_time' }, // margin one second past band
  ];
  for (const c of cases) {
    const pp = { trade_ref: 'T', target_cycle: 'T+1', baseline_cycle: 'T+2', at_risk_margin_seconds: c.band, trade_timestamp: '', venue_cutoff: '', steps: [{ step: 'S1', achieved_at: c.achieved, cutoff_target: c.cutoff, cutoff_baseline: c.cutoff }] };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.steps[0].status !== c.expectStatus) violations++;
  }
  return { name: 'P2_margin_and_at_risk_band_forced_categorical', trials: checked, violations };
}

// ---------- P3 (differential): status re-derivation from independently-computed margin_seconds ----------
function parseEpoch(s, offsetMin) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})?$/.exec((s || '').trim());
  if (!m) return null;
  const base = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0);
  let off = 0;
  if (m[7] === 'Z') off = 0;
  else if (m[7]) off = (m[7][0] === '-' ? -1 : 1) * (+m[7].slice(1, 3) * 60 + +m[7].slice(4, 6));
  else if (typeof offsetMin === 'number') off = offsetMin;
  return Math.round(base / 1000) - off * 60;
}
function checkP3_status_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    for (let j = 0; j < pp.steps.length; j++) {
      const w = pp.steps[j];
      const idxOff = pp.trade_timestamp && pp.venue_cutoff ? 1 : 0;
      const out = output_payload.steps[j + idxOff];
      const ae = parseEpoch(w.achieved_at, pp.time_zone_offset_minutes);
      const ce = parseEpoch(w.cutoff_target, pp.time_zone_offset_minutes);
      const margin = ae !== null && ce !== null ? ce - ae : null;
      const expected = margin === null ? 'undetermined' : (margin < 0 ? 'breached' : (pp.at_risk_margin_seconds > 0 && margin <= pp.at_risk_margin_seconds ? 'at_risk' : 'on_time'));
      if (out.status !== expected) violations++;
      if (out.margin_seconds !== margin) violations++;
    }
  }
  return { name: 'P3_status_and_margin_differential', trials: checked, violations };
}

// ---------- P4: boundedness — breached+at_risk+on_time+undetermined === step_count ----------
function checkP4_status_partition_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.breached_count + output_payload.at_risk_count + output_payload.on_time_count + output_payload.undetermined_count !== output_payload.step_count) violations++;
  }
  return { name: 'P4_status_counts_partition_bounded', trials: checked, violations };
}

// ---------- P5: metamorphic — shifting achieved_at one second later can only move status toward
// breached, never away (margin_seconds strictly decreases by exactly 1) ----------
function checkP5_shift_one_second_metamorphic() {
  let violations = 0, checked = 0;
  const RANK = { on_time: 0, at_risk: 1, breached: 2, undetermined: -1 };
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    if (pp.steps.length === 0) continue;
    const idx = Math.floor(rand() * pp.steps.length);
    const step = pp.steps[idx];
    const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/.exec(step.achieved_at);
    if (!m) continue;
    const r1 = compute(pp).output_payload;
    const idxOff = pp.trade_timestamp && pp.venue_cutoff ? 1 : 0;
    const s1 = r1.steps[idx + idxOff];
    if (s1.status === 'undetermined') continue;
    let sec = +m[4] + 1, min = +m[3], hr = +m[2];
    if (sec >= 60) { sec = 0; min += 1; if (min >= 60) { min = 0; hr += 1; } }
    if (hr > 23) continue; // skip day rollover, out of scope for this property
    const shiftedTs = `${m[1]}T${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}Z`;
    const shiftedSteps = pp.steps.map((s, k) => (k === idx ? { ...s, achieved_at: shiftedTs } : s));
    const r2 = compute({ ...pp, steps: shiftedSteps }).output_payload;
    checked++;
    const s2 = r2.steps[idx + idxOff];
    if (s2.margin_seconds !== null && s1.margin_seconds !== null && s2.margin_seconds !== s1.margin_seconds - 1) violations++;
    if (RANK[s2.status] !== -1 && RANK[s1.status] !== -1 && RANK[s2.status] < RANK[s1.status]) violations++;
  }
  return { name: 'P5_shift_one_second_later_never_improves_status_metamorphic', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_margin_boundary_categorical());
results.properties.push(checkP3_status_differential());
results.properties.push(checkP4_status_partition_bounded());
results.properties.push(checkP5_shift_one_second_metamorphic());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-506-classify-t1-posttrade-timing',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
