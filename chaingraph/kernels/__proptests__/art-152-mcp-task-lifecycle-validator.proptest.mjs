// art-152-mcp-task-lifecycle-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C4-1).
// kernel_digest_at_authoring: sha256:4e79c3b40641330a83eb57be5d97170403a99d2473aed7aa63205b19f116334c
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (pure state-machine table lookup, string equality, array membership — no arithmetic).
// Checks: fixture-oracle gate, termination (illegal_transitions bounded by transitions.length),
// boundedness (every illegal index in range, every from/to pair either legal-per-table or reported),
// differential re-derivation of illegal_transitions and lifecycle_valid against the same LEGAL table,
// and metamorphic prefix-invariance (appending transitions never changes an earlier illegal-transition
// report, since each transition's legality is checked independently of position).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-152-mcp-task-lifecycle-validator.proptest.mjs

import { compute } from '../art-152-mcp-task-lifecycle-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-152-mcp-task-lifecycle-validator.fixtures.json');
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
const rand = mulberry32(0x152A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const STATES = ['working', 'input_required', 'completed', 'failed', 'cancelled', 'bogus'];
const LEGAL = {
  working: ['working', 'input_required', 'completed', 'failed', 'cancelled'],
  input_required: ['working', 'cancelled', 'failed'],
  completed: [], failed: [], cancelled: [],
};

function randomTransitions(rng, n) {
  return Array.from({ length: n }, () => ({ from: pick(rng, STATES), to: pick(rng, STATES) }));
}

const TRIALS = 5000;

// ---------- P1: termination — illegal_transitions bounded by transitions.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 12);
    const transitions = randomTransitions(rand, n);
    const { output_payload } = compute({ transitions });
    checked++;
    if (output_payload.transition_count !== n) violations++;
    if (output_payload.illegal_transitions.length > n) violations++;
  }
  return { name: 'P1_termination_bounded_by_transitions_length', trials: checked, violations };
}

// ---------- P2 (differential): re-derive illegal_transitions and lifecycle_valid ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 12);
    const transitions = randomTransitions(rand, n);
    const { output_payload: o } = compute({ transitions });
    checked++;
    const illegal = [];
    transitions.forEach((t, idx) => {
      const allowed = LEGAL[t.from];
      if (!allowed || !allowed.includes(t.to)) illegal.push({ index: idx, from: t.from, to: t.to });
    });
    if (JSON.stringify(o.illegal_transitions) !== JSON.stringify(illegal)) violations++;
    const expected_valid = n > 0 && illegal.length === 0;
    if (o.lifecycle_valid !== expected_valid) violations++;
  }
  return { name: 'P2_illegal_and_valid_differential', trials: checked, violations };
}

// ---------- P3: boundedness — every illegal index in [0,n-1], every from/to drawn from state table domain ----------
function checkP3_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 12);
    const transitions = randomTransitions(rand, n);
    const { output_payload } = compute({ transitions });
    checked++;
    for (const row of output_payload.illegal_transitions) {
      if (row.index < 0 || row.index >= n) violations++;
      const allowed = LEGAL[row.from];
      if (allowed && allowed.includes(row.to)) violations++; // reported illegal but table says legal
    }
  }
  return { name: 'P3_illegal_index_and_table_bounded', trials: checked, violations };
}

// ---------- P4: metamorphic — appending transitions leaves earlier illegal-transition reports unchanged ----------
function checkP4_prefix_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const n = Math.floor(rand() * 8);
    const base = randomTransitions(rand, n);
    const extraN = Math.floor(rand() * 5);
    const extra = randomTransitions(rand, extraN);
    const extended = base.concat(extra);
    const r1 = compute({ transitions: base }).output_payload;
    const r2 = compute({ transitions: extended }).output_payload;
    checked++;
    const prefixIllegal = r2.illegal_transitions.filter((x) => x.index < n);
    if (JSON.stringify(r1.illegal_transitions) !== JSON.stringify(prefixIllegal)) violations++;
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
results.properties.push(checkP2_differential());
results.properties.push(checkP3_bounded());
results.properties.push(checkP4_prefix_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-152-mcp-task-lifecycle-validator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
