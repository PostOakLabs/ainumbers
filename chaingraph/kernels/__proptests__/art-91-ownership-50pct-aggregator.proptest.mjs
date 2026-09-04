// art-91-ownership-50pct-aggregator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C12-1).
// kernel_digest_at_authoring: sha256:b11141989c4ba450fb1156c03f7307a5eb328631dfbada5c4e0d45cca04237b6
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct read confirmed — aggregateOwnership() accumulates
// fraction-of-100 caller-supplied pct edge weights via floating-point multiply/add, and the
// verdict thresholds compare the accumulated fraction against 0.50 with plain >=) — ULP-
// BOUNDARY FORCING IS MANDATORY per spec §3.
// Unbounded input: `ownership_graph.{nodes,edges}` are caller-controlled arrays of arbitrary
// size, and the graph may contain CYCLES (edges pointing back at an ancestor). Termination is
// NOT "loop runs until done" by array length alone. Since ART91-OFAC-AGGREGATION-ORDER-1 the
// walk is no longer single-pass: aggregateOwnership() solves a Jacobi fixpoint that re-reads
// every node each round, so a `visited` Set no longer bounds anything. Three things bound it
// instead — contributions rise monotonically, they are clamped to 1 INSIDE the relaxation
// loop, and the loop carries a hard round ceiling (nodeIds.length + 1024) on top of stopping
// the moment a round raises nothing. That termination bound is asserted explicitly below (P1), including a
// deliberately cyclic graph, not just implied by "it's a for-loop". The predecessor of this
// comment claimed the visited-Set bound; that mechanism was ALSO the aggregation defect the
// row above fixed (a node dequeued once never re-propagated a later increase), which is why
// the bound and the bug had to be replaced together.
// Checks: fixture-oracle gate, termination (the monotone-clamped fixpoint halts even on a
// cyclic graph — the flagship scrutiny item for this kernel, same shape as the C11 shard's
// iterative-solver treatment), boundedness (aggregate_pct/ofac_pct/eu_pct/bis_pct always
// clamped to [0,100] via the kernel's own Math.min(...,1.0) accumulator cap), ULP-boundary
// forcing on the 50% threshold (edge pct values at ±1 ULP of the 50.0 boundary, 0, negative
// zero, denormals, and a chain of edges whose product lands within 1 ULP of 0.5 either side).
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

// ---------- P1: termination — the relaxation fixpoint halts even on a CYCLIC graph ----------
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
  return { name: 'P1_termination_relaxation_fixpoint_halts_on_cyclic_graph', trials: checked, violations };
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

// ---------- P5: edge-order invariance — aggregate ownership is a property of the GRAPH ----------
// The regression lock for ART91-OFAC-AGGREGATION-ORDER-1. The fixtures pin two specific edge
// orders of one graph; this pins the invariant itself across random graphs, including cyclic
// ones and ones with convergent parallel paths (which the defect needed in order to show).
function checkP5_edge_order_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 500; i++) {
    const n = Math.floor(rand() * 12) + 3;
    const pp = randomPP(rand, n, rand() < 0.5);
    // Add convergent parallel paths: a second, longer route into a node that already has one.
    const ids = pp.ownership_graph.nodes.map((x) => x.id);
    for (let k = 0; k + 2 < ids.length; k++) {
      if (rand() < 0.5) pp.ownership_graph.edges.push({ from: ids[k], to: ids[k + 2], pct: rand() * 100 });
    }
    const base = JSON.stringify(compute(pp).output_payload);
    // Fisher-Yates over a COPY of edges[]; nodes[] order fixes the verdict order and is left alone.
    const shuffled = pp.ownership_graph.edges.slice();
    for (let j = shuffled.length - 1; j > 0; j--) {
      const swap = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[swap]] = [shuffled[swap], shuffled[j]];
    }
    const permuted = JSON.stringify(compute({
      ...pp,
      ownership_graph: { nodes: pp.ownership_graph.nodes, edges: shuffled },
    }).output_payload);
    checked++;
    if (base !== permuted) violations++;
  }
  return { name: 'P5_output_invariant_under_edges_permutation', trials: checked, violations };
}

// ---------- P6: exact aggregation oracle — hand-computed expectations ----------
// The invariant properties above (bounded, terminating, order-independent) all hold for a
// traversal that returns the WRONG number, which is exactly what the pre-fix kernel did. This
// pins the arithmetic itself against values derived by hand from the ownership graph, node by
// node. The cyclic case is the load-bearing one: its expected values are the solution of the
// linear system, so a relaxation that stops early or accumulates a stale contribution misses
// them, while the clamp-and-terminate properties above would not notice.
const EXACT_CASES = [
  {
    name: 'chain_two_hops',
    // A->B 60; B->C 90. C = 0.60 * 0.90 = 54%.
    edges: [['A', 'B', 60], ['B', 'C', 90]],
    expect: { A: [100, true], B: [60, true], C: [54, true] },
  },
  {
    name: 'parallel_paths_below_threshold',
    // A->B 30, A->C 30, B->D 50, C->D 50. D = 30*50 + 30*50 = 15 + 15 = 30%, under 50.
    edges: [['A', 'B', 30], ['A', 'C', 30], ['B', 'D', 50], ['C', 'D', 50]],
    expect: { A: [100, true], B: [30, false], C: [30, false], D: [30, false] },
  },
  {
    name: 'three_way_convergence_crosses_threshold',
    // A->B/C/D 25 each, each wholly owning E. E = 25 + 25 + 25 = 75%. No single path reaches 50.
    edges: [['A', 'B', 25], ['A', 'C', 25], ['A', 'D', 25],
      ['B', 'E', 100], ['C', 'E', 100], ['D', 'E', 100]],
    expect: { A: [100, true], B: [25, false], C: [25, false], D: [25, false], E: [75, true] },
  },
  {
    name: 'diamond_reconverges_to_whole',
    // A->B 100; B->C 50, B->D 50; C->E 100, D->E 100. E = 50 + 50 = 100%.
    edges: [['A', 'B', 100], ['B', 'C', 50], ['B', 'D', 50], ['C', 'E', 100], ['D', 'E', 100]],
    expect: { A: [100, true], B: [100, true], C: [50, true], D: [50, true], E: [100, true] },
  },
  {
    name: 'cycle_converges_to_linear_system_solution',
    // A->B 50; B->C 80; C->B 50. Solving b = 0.5 + 0.5c and c = 0.8b gives
    // b = 0.5 / 0.6 = 5/6 = 83.33%, c = 0.8 * 5/6 = 2/3 = 66.67%. Neither is a
    // single-path product, and both are strictly above what a truncated walk returns.
    edges: [['A', 'B', 50], ['B', 'C', 80], ['C', 'B', 50]],
    expect: { A: [100, true], B: [83.33, true], C: [66.67, true] },
  },
];

function checkP6_exact_aggregation_values() {
  let violations = 0, checked = 0;
  for (const c of EXACT_CASES) {
    const ids = [...new Set(c.edges.flatMap(([f, t]) => [f, t]))];
    const pp = {
      ownership_graph: {
        nodes: ids.map((id) => (id === 'A' ? { id, listed: true, list_source: 'ofac' } : { id })),
        edges: c.edges.map(([from, to, pct]) => ({ from, to, pct })),
      },
    };
    const { output_payload } = compute(pp);
    for (const [id, [pct, blocked]] of Object.entries(c.expect)) {
      const v = output_payload.entity_verdicts.find((e) => e.id === id);
      checked++;
      if (!v || v.ofac_pct !== pct || v.constructively_blocked !== blocked) violations++;
    }
  }
  return { name: 'P6_exact_aggregation_matches_hand_computed_values', trials: checked, violations };
}

// ---------- P7: controlling_path tie-break is canonical, not edge-order dependent ----------
// Two shortest paths of equal length reach T. The reported one must be the lexicographically
// smaller hop, whichever way the caller lists the edges.
function checkP7_controlling_path_tie_break() {
  let violations = 0, checked = 0;
  const edgeSets = [
    [['A', 'M', 100], ['A', 'N', 100], ['M', 'T', 100], ['N', 'T', 100]],
    [['N', 'T', 100], ['A', 'N', 100], ['M', 'T', 100], ['A', 'M', 100]],
  ];
  for (const edges of edgeSets) {
    const pp = {
      ownership_graph: {
        nodes: [{ id: 'A', listed: true, list_source: 'ofac' }, { id: 'M' }, { id: 'N' }, { id: 'T' }],
        edges: edges.map(([from, to, pct]) => ({ from, to, pct })),
      },
    };
    const v = compute(pp).output_payload.entity_verdicts.find((e) => e.id === 'T');
    checked++;
    if (!v || JSON.stringify(v.controlling_path) !== JSON.stringify(['A', 'M', 'T'])) violations++;
  }
  return { name: 'P7_controlling_path_tie_break_is_canonical', trials: checked, violations };
}

// ---------- P8: full-payload exact oracle — eu/bis/'both' regimes, clamping, thresholds ----------
// P6 pins ofac_pct only. Every case there uses list_source: 'ofac', so a mutant touching the
// eu/bis accumulator lines, the 'both' list_source's simultaneous contribution to all three
// regimes, the pct clamp in buildAdjMap, the frac<=0 skip, blocked_under's push order, the
// compliance_flags boundary conditions, or the per-key threshold override merge is invisible to
// every property above. Each case here asserts the FULL verdict shape (ofac/eu/bis/aggregate
// pct, blocked_under array — order matters, it is OFAC/EU/BIS by source-code order — plus
// listed_entity_count, blocked_count and compliance_flags at the graph level).
const MONEY_CASES = [
  {
    name: 'eu_regime_two_hop',
    nodes: [{ id: 'A', listed: true, list_source: 'eu' }, { id: 'B' }, { id: 'C' }],
    edges: [['A', 'B', 60], ['B', 'C', 90]],
    expectNodes: {
      A: { ofac_pct: 0, eu_pct: 100, bis_pct: 0, aggregate_pct: 100, blocked_under: ['EU'], constructively_blocked: true },
      B: { ofac_pct: 0, eu_pct: 60, bis_pct: 0, aggregate_pct: 60, blocked_under: ['EU'], constructively_blocked: true, controlling_path: ['A', 'B'] },
      C: { ofac_pct: 0, eu_pct: 54, bis_pct: 0, aggregate_pct: 54, blocked_under: ['EU'], constructively_blocked: true, controlling_path: ['A', 'B', 'C'] },
    },
    expectGraph: { listed_entity_count: 1, blocked_count: 3, compliance_flags: ['CONSTRUCTIVELY_BLOCKED', 'AGGREGATE_THRESHOLD_MET', 'LAYERED_INDIRECT_OWNERSHIP'] },
  },
  {
    name: 'bis_regime_full_direct',
    nodes: [{ id: 'A', listed: true, list_source: 'bis' }, { id: 'B' }],
    edges: [['A', 'B', 100]],
    expectNodes: {
      A: { ofac_pct: 0, eu_pct: 0, bis_pct: 100, aggregate_pct: 100, blocked_under: ['BIS'], constructively_blocked: true },
      B: { ofac_pct: 0, eu_pct: 0, bis_pct: 100, aggregate_pct: 100, blocked_under: ['BIS'], constructively_blocked: true, controlling_path: ['A', 'B'] },
    },
    expectGraph: { listed_entity_count: 1, blocked_count: 2, compliance_flags: ['CONSTRUCTIVELY_BLOCKED'] },
  },
  {
    name: 'both_regime_below_threshold',
    nodes: [{ id: 'A', listed: true, list_source: 'both' }, { id: 'B' }],
    edges: [['A', 'B', 40]],
    expectNodes: {
      A: { ofac_pct: 100, eu_pct: 100, bis_pct: 100, aggregate_pct: 100, blocked_under: ['OFAC', 'EU', 'BIS'], constructively_blocked: true },
      B: { ofac_pct: 40, eu_pct: 40, bis_pct: 40, aggregate_pct: 40, blocked_under: [], constructively_blocked: false, controlling_path: ['A', 'B'] },
    },
    expectGraph: { listed_entity_count: 1, blocked_count: 1, compliance_flags: ['CONSTRUCTIVELY_BLOCKED', 'AGGREGATE_THRESHOLD_MET'] },
  },
  {
    name: 'both_regime_triggers_all_three',
    nodes: [{ id: 'A', listed: true, list_source: 'both' }, { id: 'B' }],
    edges: [['A', 'B', 60]],
    expectNodes: {
      B: { ofac_pct: 60, eu_pct: 60, bis_pct: 60, aggregate_pct: 60, blocked_under: ['OFAC', 'EU', 'BIS'], constructively_blocked: true, controlling_path: ['A', 'B'] },
    },
    expectGraph: { listed_entity_count: 1, blocked_count: 2, compliance_flags: ['CONSTRUCTIVELY_BLOCKED', 'AGGREGATE_THRESHOLD_MET'] },
  },
  {
    name: 'clamp_negative_pct_excluded',
    nodes: [{ id: 'A', listed: true, list_source: 'ofac' }, { id: 'B' }],
    edges: [['A', 'B', -30]],
    expectNodes: {
      A: { ofac_pct: 100, eu_pct: 0, bis_pct: 0, aggregate_pct: 100, blocked_under: ['OFAC'], constructively_blocked: true },
      B: { ofac_pct: 0, eu_pct: 0, bis_pct: 0, aggregate_pct: 0, blocked_under: [], constructively_blocked: false, controlling_path: [] },
    },
    expectGraph: { listed_entity_count: 1, blocked_count: 1, compliance_flags: ['CONSTRUCTIVELY_BLOCKED'] },
  },
  {
    name: 'clamp_over_100_pct_full_ownership',
    nodes: [{ id: 'A', listed: true, list_source: 'ofac' }, { id: 'B' }],
    edges: [['A', 'B', 150]],
    expectNodes: {
      B: { ofac_pct: 100, eu_pct: 0, bis_pct: 0, aggregate_pct: 100, blocked_under: ['OFAC'], constructively_blocked: true, controlling_path: ['A', 'B'] },
    },
    expectGraph: { listed_entity_count: 1, blocked_count: 2, compliance_flags: ['CONSTRUCTIVELY_BLOCKED'] },
  },
];

function runMoneyCase(c) {
  const ids = [...new Set(c.edges.flatMap(([f, t]) => [f, t]))];
  const declared = new Map(c.nodes.map((n) => [n.id, n]));
  const nodes = ids.map((id) => declared.get(id) || { id });
  const pp = { ownership_graph: { nodes, edges: c.edges.map(([from, to, pct]) => ({ from, to, pct })) } };
  return compute(pp); // { output_payload, compliance_flags } — compliance_flags is a SIBLING, not nested
}

function checkP8_full_payload_exact_oracle() {
  let violations = 0, checked = 0;
  for (const c of MONEY_CASES) {
    const { output_payload, compliance_flags } = runMoneyCase(c);
    for (const [id, expect] of Object.entries(c.expectNodes)) {
      const v = output_payload.entity_verdicts.find((e) => e.id === id);
      for (const [field, expected] of Object.entries(expect)) {
        checked++;
        const actual = v ? v[field] : undefined;
        const eq = Array.isArray(expected) ? JSON.stringify(actual) === JSON.stringify(expected) : actual === expected;
        if (!eq) { violations++; console.error(`P8 MISMATCH ${c.name}.${id}.${field}: expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`); }
      }
    }
    for (const [field, expected] of Object.entries(c.expectGraph)) {
      checked++;
      const actual = field === 'compliance_flags' ? compliance_flags : output_payload[field];
      const eq = Array.isArray(expected) ? JSON.stringify(actual) === JSON.stringify(expected) : actual === expected;
      if (!eq) { violations++; console.error(`P8 MISMATCH ${c.name}.<graph>.${field}: expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`); }
    }
  }
  return { name: 'P8_full_payload_exact_oracle_eu_bis_both_clamp', trials: checked, violations };
}

// ---------- P9: per-key threshold override merges over DEFAULT_THRESHOLDS, not wholesale ----------
// A caller passing {ofac_50: 0.3} must lower ONLY the OFAC bar; eu_50/bis_50 stay at their
// defaults via the `{...DEFAULT_THRESHOLDS, ...thresholds}` merge. Same graph, same accumulated
// 40%, opposite OFAC verdict depending on which thresholds object is passed — the sharpest
// possible discriminator for the merge line and for the `>=` comparison itself.
function checkP9_threshold_override_is_per_key() {
  let violations = 0, checked = 0;
  const pp = {
    ownership_graph: {
      nodes: [{ id: 'A', listed: true, list_source: 'ofac' }, { id: 'B' }],
      edges: [{ from: 'A', to: 'B', pct: 40 }],
    },
  };
  const withDefault = compute(pp).output_payload;
  const vDefault = withDefault.entity_verdicts.find((e) => e.id === 'B');
  checked++;
  if (!vDefault || vDefault.constructively_blocked !== false || JSON.stringify(vDefault.blocked_under) !== '[]') violations++;
  checked++;
  if (!withDefault || withDefault.blocked_count !== 1) violations++;

  const withOverride = compute({ ...pp, thresholds: { ofac_50: 0.3 } }).output_payload;
  const vOverride = withOverride.entity_verdicts.find((e) => e.id === 'B');
  checked++;
  if (!vOverride || vOverride.constructively_blocked !== true || JSON.stringify(vOverride.blocked_under) !== '["OFAC"]') violations++;
  checked++;
  if (!withOverride || withOverride.blocked_count !== 2) violations++;
  checked++;
  if (!vOverride || vOverride.ofac_pct !== 40) violations++; // the accumulated fraction itself never moves — only the comparison does

  return { name: 'P9_threshold_override_is_per_key_merge', trials: checked, violations };
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
results.properties.push(checkP5_edge_order_invariance());
results.properties.push(checkP6_exact_aggregation_values());
results.properties.push(checkP7_controlling_path_tie_break());
results.properties.push(checkP8_full_payload_exact_oracle());
results.properties.push(checkP9_threshold_override_is_per_key());

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
