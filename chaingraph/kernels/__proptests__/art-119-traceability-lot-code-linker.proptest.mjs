// art-119-traceability-lot-code-linker.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C3-1).
// kernel_digest_at_authoring: sha256:9c508df29c7b972a6c75f1ad355d117b4554a2b3faebc82012baddb301528df5
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (linkage is pure string equality / boolean logic, no arithmetic).
// Checks: fixture-oracle gate, termination (lineage/depth bounded by events.length),
// boundedness (breaks subset of event indices), differential re-derivation of the linked flag,
// and metamorphic prefix-invariance (appending events never changes an earlier step's result).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-119-traceability-lot-code-linker.proptest.mjs

import { compute } from '../art-119-traceability-lot-code-linker.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-119-traceability-lot-code-linker.fixtures.json');
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
const rand = mulberry32(0x119A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const CTES = ['harvesting', 'shipping', 'receiving', 'transformation'];
const TLCS = ['TLC-001', 'TLC-002', 'TLC-003', 'TLC-WRONG'];

function randomEvents(rng, n) {
  const events = [];
  for (let i = 0; i < n; i++) {
    // bias toward a mostly-linked chain so breaks are exercised on both sides
    const prev_tlc = i === 0 ? null : (rng() < 0.6 ? events[i - 1].tlc : pick(rng, TLCS));
    events.push({ cte: pick(rng, CTES), tlc: pick(rng, TLCS), prev_tlc, location_gln: `GLN-${i}`, date: `2026-05-${(i % 28) + 1}` });
  }
  return events;
}

const TRIALS = 5000;

// ---------- P1: termination — lineage/depth exactly bounded by events.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 12);
    const events = randomEvents(rand, n);
    const { output_payload } = compute({ events });
    checked++;
    if (output_payload.lineage.length !== n) violations++;
    if (output_payload.depth !== n) violations++;
    if (output_payload.breaks.length > n) violations++;
  }
  return { name: 'P1_termination_bounded_by_events_length', trials: checked, violations };
}

// ---------- P2 (differential): linked flag re-derivation ----------
function checkP2_linked_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 12);
    const events = randomEvents(rand, n);
    const { output_payload } = compute({ events });
    checked++;
    output_payload.lineage.forEach((step, idx) => {
      const expected = idx === 0 ? true : events[idx].prev_tlc === events[idx - 1].tlc;
      if (step.linked !== expected) violations++;
    });
  }
  return { name: 'P2_linked_flag_differential', trials: checked, violations };
}

// ---------- P3: boundedness — every break index in [1, n-1], every non-transformation link failure reported ----------
function checkP3_breaks_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 12);
    const events = randomEvents(rand, n);
    const { output_payload } = compute({ events });
    checked++;
    for (const b of output_payload.breaks) {
      if (b.index < 1 || b.index >= n) violations++;
      if (events[b.index].cte === 'transformation') violations++; // transformations never count as breaks
    }
  }
  return { name: 'P3_breaks_index_bounded_and_not_transformation', trials: checked, violations };
}

// ---------- P4: metamorphic — prefix-invariance (appending events leaves earlier steps unchanged) ----------
function checkP4_prefix_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const n = Math.floor(rand() * 8);
    const base = randomEvents(rand, n);
    const extraN = Math.floor(rand() * 5);
    const extra = randomEvents(rand, extraN);
    const extended = base.concat(extra.map((e, j) => ({ ...e, prev_tlc: j === 0 ? (base[base.length - 1]?.tlc ?? e.prev_tlc) : extra[j - 1].tlc })));
    const r1 = compute({ events: base }).output_payload;
    const r2 = compute({ events: extended }).output_payload;
    checked++;
    if (JSON.stringify(r1.lineage) !== JSON.stringify(r2.lineage.slice(0, n))) violations++;
    const breaksInPrefix = r2.breaks.filter((b) => b.index < n);
    if (JSON.stringify(r1.breaks) !== JSON.stringify(breaksInPrefix)) violations++;
  }
  return { name: 'P4_prefix_invariance_on_append', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_linked_differential());
results.properties.push(checkP3_breaks_bounded());
results.properties.push(checkP4_prefix_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-119-traceability-lot-code-linker',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
