// art-317-rhc-multiplier-reconciler.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C11-1).
// kernel_digest_at_authoring: sha256:429e977403062feed23c749598080acc370be7c4fbe83704b1c1884bccc3a94f
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (ratio_match compares computed_ratio to expected_ratio against a fixed
// EPS=1e-9 threshold — direct read confirmed) — ULP-boundary forcing is MANDATORY per spec §3.
// Checks: fixture-oracle gate, termination (event_count bounded by event_log.length),
// ULP-boundary forcing around the EPS=1e-9 ratio-match threshold, differential re-derivation of
// the discrepancies list (duplicate/missed/non-monotonic/balance-invariant), and metamorphic
// duplicate-event-append (appending a duplicate ex_date must flip duplicate_events to true).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-317-rhc-multiplier-reconciler.proptest.mjs

import { compute } from '../art-317-rhc-multiplier-reconciler.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-317-rhc-multiplier-reconciler.fixtures.json');
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
const rand = mulberry32(0x317E0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomEventLog(rng, n, monotone) {
  const dates = [];
  let d = 1;
  for (let i = 0; i < n; i++) {
    d += monotone ? Math.floor(rng() * 3) + 1 : (rng() < 0.5 ? 1 : -1);
    dates.push(`2026-01-${String(Math.max(1, Math.min(28, d))).padStart(2, '0')}`);
  }
  return dates.map((ex_date) => ({ ex_date }));
}

function randomPP(rng) {
  const prior = pick(rng, [1, 2, 4, 0.5]);
  const ratioTrue = pick(rng, [2, 3, 0.5, 4]);
  const current = prior * ratioTrue;
  const declaredRatio = rng() < 0.7 ? ratioTrue : ratioTrue + (rng() - 0.5) * 0.5;
  const n = Math.floor(rng() * 6);
  return {
    declared_action: { type: 'split', ratio: declaredRatio, ex_date: null },
    prior_multiplier: prior,
    current_multiplier: current,
    raw_balance_before: 1000,
    raw_balance_after: rng() < 0.85 ? 1000 : 1000 + rng() * 10,
    event_log: randomEventLog(rng, n, rng() < 0.7),
  };
}

const TRIALS = 5000;

// ---------- P1: termination — event_count bounded/exact vs event_log.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.event_count !== pp.event_log.length) violations++;
  }
  return { name: 'P1_termination_event_count_exact', trials: checked, violations };
}

// ---------- P2: ULP-boundary forcing around EPS=1e-9 ratio-match threshold (mandatory) ----------
function checkP2_ulp_forcing() {
  let violations = 0, checked = 0;
  const EPS = 1e-9;
  const deltas = [0, EPS * 0.5, -EPS * 0.5, EPS * 0.999999, -EPS * 0.999999, EPS * 1.5, -EPS * 1.5, Number.EPSILON, -Number.EPSILON, 0, -0];
  for (const d of deltas) {
    const prior = 2, current = 4, expectedRatio = 2 + d;
    const pp = { declared_action: { type: 'split', ratio: expectedRatio }, prior_multiplier: prior, current_multiplier: current, event_log: [{ ex_date: '2026-01-01' }] };
    const { output_payload } = compute(pp);
    checked++;
    const computed = current / prior;
    const shouldMatch = Math.abs(computed - expectedRatio) < EPS;
    if (output_payload.ratio_match !== shouldMatch) violations++;
  }
  // denormal / negative-zero prior boundary
  const denormalCases = [
    { prior: Number.MIN_VALUE, current: Number.MIN_VALUE, ratio: 1 },
    { prior: -0, current: 0, ratio: 1 },
  ];
  for (const c of denormalCases) {
    const pp = { declared_action: { type: 'split', ratio: c.ratio }, prior_multiplier: c.prior, current_multiplier: c.current, event_log: [{ ex_date: '2026-01-01' }] };
    const { output_payload } = compute(pp);
    checked++;
    // prior_multiplier <= 0 (including -0, which is not > 0) must be treated as invalid, per source's `prior_multiplier > 0` guard
    if (c.prior > 0) {
      const computed = c.current / c.prior;
      const shouldMatch = Math.abs(computed - c.ratio) < EPS;
      if (output_payload.ratio_match !== shouldMatch) violations++;
    } else {
      if (output_payload.computed_ratio !== null) violations++;
      if (!output_payload.discrepancies.includes('invalid_prior_multiplier')) violations++;
    }
  }
  return { name: 'P2_ulp_boundary_forcing_ratio_match_eps', trials: checked, violations };
}

// ---------- P3 (differential): discrepancies list re-derivation ----------
function checkP3_discrepancies_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const seen = new Set();
    let dup = false;
    for (const ev of pp.event_log) {
      if (ev.ex_date) { if (seen.has(ev.ex_date)) dup = true; seen.add(ev.ex_date); }
    }
    const missed = pp.event_log.length === 0;
    let monotonic = true;
    for (let j = 1; j < pp.event_log.length; j++) {
      if (String(pp.event_log[j].ex_date) < String(pp.event_log[j - 1].ex_date)) { monotonic = false; break; }
    }
    if (dup !== output_payload.discrepancies.includes('duplicate_event_application')) violations++;
    if (missed !== output_payload.discrepancies.includes('no_event_log_entry')) violations++;
    if ((!monotonic) !== output_payload.discrepancies.includes('non_monotonic_event_sequence')) violations++;
    const balanceInvariant = pp.raw_balance_before === pp.raw_balance_after;
    if ((!balanceInvariant) !== output_payload.discrepancies.includes('raw_balance_moved_without_redemption')) violations++;
  }
  return { name: 'P3_discrepancies_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — appending a duplicate ex_date must flip duplicate_events to true ----------
function checkP4_duplicate_append_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    if (pp.event_log.length === 0) continue;
    const last = pp.event_log[pp.event_log.length - 1];
    const extended = { ...pp, event_log: [...pp.event_log, { ex_date: last.ex_date }] };
    const r2 = compute(extended).output_payload;
    checked++;
    if (!r2.discrepancies.includes('duplicate_event_application')) violations++;
    if (r2.event_count !== pp.event_log.length + 1) violations++;
  }
  return { name: 'P4_duplicate_ex_date_append_metamorphic', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_ulp_forcing());
results.properties.push(checkP3_discrepancies_differential());
results.properties.push(checkP4_duplicate_append_metamorphic());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-317-rhc-multiplier-reconciler',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
