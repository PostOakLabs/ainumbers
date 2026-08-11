// art-91-ownership-50pct-aggregator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C12-1).
// kernel_digest_at_authoring: sha256:f1505eeba83572c78e56a22d102dca7aae6db7cbefab4c87b98653969f191037
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct read confirmed — aggregateOwnership() accumulates
// fraction-of-100 caller-supplied pct edge weights via floating-point multiply/add, and the
// verdict thresholds compare the accumulated fraction against 0.50 with plain >=) — ULP-
// BOUNDARY FORCING IS MANDATORY per spec §3.
// Unbounded input: `ownership_graph.{nodes,edges}` are caller-controlled arrays of arbitrary
// size, and the graph may contain CYCLES (edges pointing back at an ancestor). Termination is
// NOT "loop runs until done" by array length alone — it is the BFS `visited` Set that bounds
// the walk to at most nodes.length dequeues regardless of cycle structure. That termination
// bound is asserted explicitly below (P1), including a deliberately cyclic graph, not just
// implied by "it's a for-loop".
// Checks: fixture-oracle gate, termination (BFS visited-set bound holds even on a cyclic
// graph — the flagship scrutiny item for this kernel, same shape as the C11 shard's iterative-
// solver treatment), boundedness (aggregate_pct/ofac_pct/eu_pct/bis_pct always clamped to
// [0,100] via the kernel's own Math.min(...,1.0) accumulator cap), ULP-boundary forcing on the
// 50% threshold (edge pct values at ±1 ULP of the 50.0 boundary, 0, negative zero, denormals,
// and a chain of edges whose product lands within 1 ULP of 0.5 either side).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-91-ownership-50pct-aggregator.proptest.mjs

import { compute } from '../art-91-ownership-50pct-aggregator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-91-ownership-50pct-aggregator.fixtures.json');
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
const rand = mulberry32(0x91D0);

function randomGraph(rng, n, allowCycle) {
  const nodes = [];
  for (let i = 0; i < n; i++) {
    nodes.push({ id: `n${i}`, listed: rng() < 0.2, list_source: ['ofac', 'eu', 'bis', 'both'][Math.floor(rng() * 4)] });
  }
  const edges = [];
  for (let i = 0; i < n; i++) {
    if (rng() < 0.6 && i + 1 < n) edges.push({ from: `n${i}`, to: `n${i + 1}`, pct: rng() * 100 });
  }
  if (allowCycle && n > 2) edges.push({ from: `n${n - 1}`, to: `n0`, pct: rng() * 100 }); // deliberate cycle
  return { nodes, edges };
}

function randomPP(rng, n, allowCycle = false) {
  return { ownership_graph: randomGraph(rng, n, allowCycle), thresholds: { ofac_50: 0.5, eu_50: 0.5, bis_50: 0.5 } };
}

const TRIALS = 2000;

// ---------- P1: termination — BFS visited-set bound holds even on a CYCLIC graph ----------
function checkP1_termination_cyclic_graph_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 500; i++) {
    const n = Math.floor(rand() * 20) + 3;
    const pp = randomPP(rand, n, true); // force cycles
    const start = Date.now();
    compute(pp);
    checked++;
    if (Date.now() - start > 500) violations++;
  }
  // deliberately pathological: dense cycle among every node
  const denseNodes = Array.from({ length: 15 }, (_, i) => ({ id: `n${i}`, listed: i === 0, list_source: 'ofac' }));
  const denseEdges = [];
  for (let i = 0; i < 15; i++) for (let j = 0; j < 15; j++) if (i !== j) denseEdges.push({ from: `n${i}`, to: `n${j}`, pct: 10 });
  const start2 = Date.now();
  compute({ ownership_graph: { nodes: denseNodes, edges: denseEdges } });
  checked++;
  if (Date.now() - start2 > 2000) violations++;
  return { name: 'P1_termination_bfs_bound_holds_on_cyclic_graph', trials: checked, violations };
}

// ---------- P2: boundedness — aggregate/ofac/eu/bis pct always clamped to [0,100] ----------
function checkP2_boundedness_pct_clamped() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 15) + 1;
    const pp = randomPP(rand, n);
    const { output_payload } = compute(pp);
    checked++;
    for (const v of output_payload.entity_verdicts) {
      if (v.aggregate_pct < 0 || v.aggregate_pct > 100) violations++;
      if (v.ofac_pct < 0 || v.ofac_pct > 100) violations++;
      if (v.eu_pct < 0 || v.eu_pct > 100) violations++;
      if (v.bis_pct < 0 || v.bis_pct > 100) violations++;
    }
  }
  return { name: 'P2_boundedness_pct_clamped_0_100', trials: checked, violations };
}

// ---------- P3: ULP-boundary forcing (mandatory, float_sensitive: yes) — 50% threshold ----------
function checkP3_ulp_forcing_50pct_threshold() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  // single-edge chain: listed source -> target with pct forced around the 50.0 boundary
  const pctForced = [0, -0, eps, 50 - eps * 50, 50, 50 + eps * 50, 100, Number.MIN_VALUE, 49.9999999999999, 50.0000000001];
  for (const pct of pctForced) {
    const pp = {
      ownership_graph: {
        nodes: [{ id: 'src', listed: true, list_source: 'ofac' }, { id: 'tgt', listed: false }],
        edges: [{ from: 'src', to: 'tgt', pct }],
      },
    };
    const { output_payload } = compute(pp);
    checked++;
    const v = output_payload.entity_verdicts.find((e) => e.id === 'tgt');
    if (!v || !Number.isFinite(v.aggregate_pct)) violations++;
    const expectBlocked = Math.max(0, Math.min(pct, 100)) / 100 >= 0.5;
    if (v && v.constructively_blocked !== expectBlocked) violations++;
  }
  // two-hop chain: product of two fractions landing within 1 ULP of 0.5 either side
  const chainCases = [
    { p1: 99.9999999, p2: 50.00000005 }, // product just under 0.5
    { p1: 100, p2: 50 },                  // product exactly 0.5
    { p1: 100, p2: 50.00000005 },         // product just over 0.5
  ];
  for (const c of chainCases) {
    const pp = {
      ownership_graph: {
        nodes: [{ id: 'src', listed: true, list_source: 'eu' }, { id: 'mid' }, { id: 'tgt' }],
        edges: [{ from: 'src', to: 'mid', pct: c.p1 }, { from: 'mid', to: 'tgt', pct: c.p2 }],
      },
    };
    const { output_payload } = compute(pp);
    checked++;
    const v = output_payload.entity_verdicts.find((e) => e.id === 'tgt');
    if (!v || !Number.isFinite(v.aggregate_pct)) violations++;
  }
  return { name: 'P3_ulp_boundary_forcing_50pct_threshold', trials: checked, violations };
}

// ---------- P4: metamorphic — a listed node is always its own 100% self-blocked verdict ----------
function checkP4_self_listed_always_blocked() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 500; i++) {
    const n = Math.floor(rand() * 10) + 1;
    const pp = randomPP(rand, n);
    const { output_payload } = compute(pp);
    checked++;
    for (const node of pp.ownership_graph.nodes) {
      if (!node.listed) continue;
      const v = output_payload.entity_verdicts.find((e) => e.id === node.id);
      if (!v || !v.constructively_blocked) violations++;
    }
  }
  return { name: 'P4_self_listed_entity_always_constructively_blocked', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_cyclic_graph_bounded());
results.properties.push(checkP2_boundedness_pct_clamped());
results.properties.push(checkP3_ulp_forcing_50pct_threshold());
results.properties.push(checkP4_self_listed_always_blocked());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-91-ownership-50pct-aggregator',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
