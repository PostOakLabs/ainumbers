// art-120-recall-trace-resolver.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C3-1).
// kernel_digest_at_authoring: sha256:572a3d1b5f06617e9230439c2f639209dc51f1969e4f7fa9709c23349334b9b2
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (pure string-equality edge filtering + integer counting).
// Checks: fixture-oracle gate, termination (sources+recipients bounded by edges.length),
// differential re-derivation of sources/recipients/traced_count from direction+edges,
// and metamorphic edge-permutation-invariance (edge order never changes the resolved sets).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-120-recall-trace-resolver.proptest.mjs

import { compute } from '../art-120-recall-trace-resolver.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-120-recall-trace-resolver.fixtures.json');
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
const rand = mulberry32(0x1200A1);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const TLCS = ['TLC-A', 'TLC-B', 'TLC-C', 'TLC-D'];
const DIRECTIONS = ['back', 'forward', 'both'];

function randomEdges(rng, n) {
  const edges = [];
  for (let i = 0; i < n; i++) {
    edges.push({ from_tlc: pick(rng, TLCS), to_tlc: pick(rng, TLCS), from_gln: `GLN-F${i}`, to_gln: `GLN-T${i}`, date: `2026-05-${(i % 28) + 1}` });
  }
  return edges;
}

const TRIALS = 5000;

// ---------- P1: termination — sources+recipients bounded by edges.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 20);
    const edges = randomEdges(rand, n);
    const contaminated_tlc = pick(rand, TLCS);
    const direction = pick(rand, DIRECTIONS);
    const { output_payload } = compute({ contaminated_tlc, direction, edges });
    checked++;
    // a self-loop edge (from_tlc === to_tlc === contaminated_tlc) counts in both sets under 'both' — bound is 2n, not n
    if (output_payload.sources.length + output_payload.recipients.length > 2 * n) violations++;
    if (output_payload.traced_count !== output_payload.sources.length + output_payload.recipients.length) violations++;
  }
  return { name: 'P1_termination_bounded_by_edges_length', trials: checked, violations };
}

// ---------- P2 (differential): sources/recipients re-derivation from direction+edges ----------
function checkP2_direction_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 20);
    const edges = randomEdges(rand, n);
    const contaminated_tlc = pick(rand, TLCS);
    const direction = pick(rand, DIRECTIONS);
    const { output_payload } = compute({ contaminated_tlc, direction, edges });
    checked++;
    const expSources = [], expRecipients = [];
    edges.forEach((e) => {
      if ((direction === 'back' || direction === 'both') && e.to_tlc === contaminated_tlc) expSources.push({ tlc: e.from_tlc, gln: e.from_gln, date: e.date });
      if ((direction === 'forward' || direction === 'both') && e.from_tlc === contaminated_tlc) expRecipients.push({ tlc: e.to_tlc, gln: e.to_gln, date: e.date });
    });
    if (JSON.stringify(output_payload.sources) !== JSON.stringify(expSources)) violations++;
    if (JSON.stringify(output_payload.recipients) !== JSON.stringify(expRecipients)) violations++;
  }
  return { name: 'P2_direction_filter_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — permutation-invariance of edges order (set equality, order-independent) ----------
function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const n = Math.floor(rand() * 15);
    const edges = randomEdges(rand, n);
    const shuffled = shuffle(rand, edges);
    const contaminated_tlc = pick(rand, TLCS);
    const direction = pick(rand, DIRECTIONS);
    const r1 = compute({ contaminated_tlc, direction, edges }).output_payload;
    const r2 = compute({ contaminated_tlc, direction, edges: shuffled }).output_payload;
    checked++;
    if (r1.traced_count !== r2.traced_count) violations++;
    const sortKey = (arr) => arr.map((x) => JSON.stringify(x)).sort();
    if (JSON.stringify(sortKey(r1.sources)) !== JSON.stringify(sortKey(r2.sources))) violations++;
    if (JSON.stringify(sortKey(r1.recipients)) !== JSON.stringify(sortKey(r2.recipients))) violations++;
  }
  return { name: 'P3_permutation_invariance_edges', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_direction_differential());
results.properties.push(checkP3_permutation_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-120-recall-trace-resolver',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
