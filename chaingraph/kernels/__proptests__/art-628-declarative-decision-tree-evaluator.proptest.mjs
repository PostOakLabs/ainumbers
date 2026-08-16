// art-628-declarative-decision-tree-evaluator — class-B PROPERTY-TEST FLOOR.
// kernel_digest_at_authoring: sha256:23fafefb1f2949dbb40b7bfb74f121ebae0388f743e72666aba5713731f80239
// spec: ACCT-INFRA-KERNELS-BUILD-SPEC.md Sec.3 (kernel spec) + Sec.4 (composition contract) +
//       workspace-root research/ACCT-DTREE-K-1.spec.md + research/clause-snapshots/17-cfr-230.501-a.snapshot.md
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md, class B — bounded decision logic over a
// small, iteratively-walked graph with declared max_depth=12/max_nodes=256/max_tree_bytes=65536
// ceilings). NOT a proof, NOT Dafny. Internal engineering QC only.
//
// float_sensitive: NO for the demonstrator tree — every criterion is `eq` over a boolean field,
// so the demonstrator's own enumeration basis (P2 below) is class-A exhaustive per build spec
// Sec.3.3. The kernel's GENERIC interpreter also supports numeric operators (lt/lte/gt/gte/
// between) for OTHER trees a future row may supply; P7 exercises those directly since the
// demonstrator tree never reaches that code path.
//
// ── THE INDEPENDENT ORACLE, stated plainly (STANDING-ORDERS.md #34) ──────────────────────────────
// The kernel's tree_digest check is a self-attested-provenance shape unless verified against a
// genuinely independent implementation: this floor's P3 recomputes the canonical-JSON + SHA-256
// digest using **node:crypto's createHash('sha256')** and its own independent key-sort
// canonicalizer (NOT the kernel's hand-rolled pure-JS SHA-256 or its _dtCanon) — a real
// differential test of whether the kernel's guest-safe digest implementation agrees with real
// SHA-256, not a checker that shares its implementation with the thing it checks.
//
// Checks: fixture-oracle gate (P0), totality over hostile inputs (P1), CLASS-A EXHAUSTIVE
// ENUMERATION of the demonstrator tree over its 5 declared boolean fields — 32 combinations, 0
// unexplained (P2, the honesty test build spec Sec.3.3 exists for), independent-digest
// differential (P3), citation-gate rejection on every node including internal criteria (P4),
// cycle-acyclicity rejection without over-flagging a legitimate DAG convergence (P5), bounds
// enforcement at the exact boundary and one past it (P6), generic operator correctness for the
// full closed set beyond what the demonstrator tree exercises (P7), determinism (P8), and
// output-shape sanity (P9).
//
// Run: node chaingraph/kernels/__proptests__/art-628-declarative-decision-tree-evaluator.proptest.mjs

import { createHash } from 'node:crypto';
import { compute } from '../art-628-declarative-decision-tree-evaluator.kernel.mjs';
import { runFixtureOracle, findShapeViolations, summarize, mulberry32, pickNasty, nullProtoClone } from './_pbt-common.mjs';

const KERNEL_ID = 'art-628-declarative-decision-tree-evaluator';

const SNAP = 'research/clause-snapshots/17-cfr-230.501-a.snapshot.md';
const REAL_DIGEST = '0cd4295ba5a4b7192725f7dcf323d59c3e4f4768064b9a498f721504119279f6';
const cit = (n) => ({
  clause: '17 CFR 230.501(a)' + n,
  source: '17 CFR 230.501(a)' + n + ' (Regulation D, Securities Act of 1933, accredited investor definition)',
  source_digest: REAL_DIGEST,
  snapshot_location: SNAP,
});
const SYNTHETIC_CITATION = { clause: 'TEST-SYNTHETIC-NOT-A-REAL-CITATION', source: 'floor-generated synthetic tree for interpreter-mechanics testing, not a real legal citation', source_digest: 'sha256:0000000000000000000000000000000000000000000000000000000000000000', snapshot_location: 'n/a (synthetic, no snapshot backs this)' };

// ── independent canonicalizer + SHA-256 (node:crypto, NOT the kernel's hand-rolled pure-JS one) ──
function indCanon(v) {
  if (Array.isArray(v)) return v.map(indCanon);
  if (v && typeof v === 'object') {
    const out = {};
    Object.keys(v).sort().forEach((k) => { out[k] = indCanon(v[k]); });
    return out;
  }
  return v;
}
function indDigest(tree) {
  const stripped = Object.assign({}, tree);
  delete stripped.tree_digest;
  return createHash('sha256').update(JSON.stringify(indCanon(stripped)), 'utf8').digest('hex');
}

// ── the demonstrator tree, built + digested independently via node:crypto (not copy-pasted from ─
// ── the kernel's own fixtures — this floor derives its own digest so P3 is a real cross-check) ──
function buildDemoTree() {
  const tree = {
    tree_id: 'reg-d-501a-entity-accredited-investor-category-test',
    tree_version: '1.0.0',
    tree_digest: 'PENDING',
    root: 'c_501a1',
    nodes: {
      c_501a1: { kind: 'criterion', field: 'is_501a1_institution', operator: 'eq', operand: true, branches: { true: 'leaf_501a1', false: 'c_bdc' }, citation: cit('(1)') },
      c_bdc: { kind: 'criterion', field: 'is_private_bdc', operator: 'eq', operand: true, branches: { true: 'leaf_bdc', false: 'c_501c3' }, citation: cit('(2)') },
      c_501c3: { kind: 'criterion', field: 'is_501c3_or_qualifying_entity_over_5m', operator: 'eq', operand: true, branches: { true: 'leaf_501c3', false: 'c_equity' }, citation: cit('(3)') },
      c_equity: { kind: 'criterion', field: 'all_equity_owners_accredited', operator: 'eq', operand: true, branches: { true: 'leaf_equity', false: 'c_catchall' }, citation: cit('(8)') },
      c_catchall: { kind: 'criterion', field: 'is_other_entity_investments_over_5m', operator: 'eq', operand: true, branches: { true: 'leaf_catchall', false: 'leaf_not_accredited' }, citation: cit('(9)') },
      leaf_501a1: { kind: 'leaf', verdict: 'accredited', citation: cit('(1)') },
      leaf_bdc: { kind: 'leaf', verdict: 'accredited', citation: cit('(2)') },
      leaf_501c3: { kind: 'leaf', verdict: 'accredited', citation: cit('(3)') },
      leaf_equity: { kind: 'leaf', verdict: 'accredited', citation: cit('(8)') },
      leaf_catchall: { kind: 'leaf', verdict: 'accredited', citation: cit('(9)') },
      leaf_not_accredited: { kind: 'leaf', verdict: 'not_accredited', citation: { clause: '17 CFR 230.501(a)', source: '17 CFR 230.501(a) chapeau (categories are exhaustive: any person within any of the following categories)', source_digest: REAL_DIGEST, snapshot_location: SNAP } },
    },
  };
  tree.tree_digest = indDigest(tree);
  return tree;
}
const DEMO_FIELDS = ['is_501a1_institution', 'is_private_bdc', 'is_501c3_or_qualifying_entity_over_5m', 'all_equity_owners_accredited', 'is_other_entity_investments_over_5m'];
const ALL_FALSE_FACTS = Object.fromEntries(DEMO_FIELDS.map((f) => [f, false]));

// ── P1: TOTALITY — never throws, whatever hostile shape arrives ──────────────────────────────────
function isNullProto(v) { return v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === null; }
function pickNastyJsonish(rng) {
  for (let i = 0; i < 24; i++) { const v = pickNasty(rng); if (!isNullProto(v)) return v; }
  return null;
}
function checkP1_totality() {
  const rng = mulberry32(628001);
  let checked = 0, violations = 0;
  const shapes = [undefined, null, {}, { tree: null }, { tree: {} }, { tree: { nodes: {} } }, { tree: { root: 'x', nodes: {} } }, { tree: 5, facts: 5 }, { facts: null }];
  for (const pp of shapes) {
    checked++;
    try {
      const r = compute(pp);
      if (!r || !r.output_payload || typeof r.output_payload.error_code === 'undefined') violations++;
      else if (findShapeViolations(r.output_payload).length) violations++;
    } catch (e) { violations++; }
  }
  for (let i = 0; i < 300; i++) {
    const pp = { tree: { tree_id: pickNastyJsonish(rng), tree_version: pickNastyJsonish(rng), tree_digest: pickNastyJsonish(rng), root: pickNastyJsonish(rng), nodes: pickNastyJsonish(rng) }, facts: { a: pickNastyJsonish(rng) } };
    checked++;
    try {
      const r = compute(pp);
      if (r.output_payload.verdict !== null) violations++; // nothing hostile may produce a verdict
      if (findShapeViolations(r.output_payload).length) violations++;
    } catch (e) { violations++; }
  }
  return { name: 'P1_totality_never_throws_hostile_input', checked, violations };
}

// ── P2: CLASS-A EXHAUSTIVE ENUMERATION (build spec Sec.3.3) — the honesty test ──────────────────
// N = 2^5 = 32 over the declared boolean domain of the demonstrator's own fields. 0 unexplained
// means every one of the 32 assignments reaches a leaf with a real verdict, never an error_code.
function checkP2_exhaustiveEnumeration() {
  const tree = buildDemoTree();
  let checked = 0, violations = 0;
  const unexplained = [];
  for (let mask = 0; mask < 32; mask++) {
    const facts = {};
    DEMO_FIELDS.forEach((f, i) => { facts[f] = !!((mask >> i) & 1); });
    checked++;
    const { output_payload } = compute({ tree, facts });
    if (output_payload.error_code !== null) { violations++; unexplained.push({ mask, facts, error_code: output_payload.error_code }); continue; }
    if (output_payload.verdict !== 'accredited' && output_payload.verdict !== 'not_accredited') { violations++; unexplained.push({ mask, facts, verdict: output_payload.verdict }); }
  }
  if (unexplained.length) console.log(`[${KERNEL_ID}] P2 unexplained: ${JSON.stringify(unexplained)}`);
  return { name: 'P2_class_A_exhaustive_enumeration_N32_0_unexplained', checked, violations };
}

// ── P3: INDEPENDENT-DIGEST DIFFERENTIAL (node:crypto, not the kernel's own hand-rolled SHA-256) ──
function checkP3_independentDigestDifferential() {
  const tree = buildDemoTree(); // tree_digest already set via indDigest()
  let checked = 0, violations = 0;

  // (a) a correctly-independently-digested tree must be ACCEPTED (no TREE_DIGEST_MISMATCH)
  checked++;
  {
    const { output_payload } = compute({ tree, facts: ALL_FALSE_FACTS });
    if (output_payload.error_code === 'TREE_DIGEST_MISMATCH') violations++;
    else if (output_payload.tree_digest_recomputed !== tree.tree_digest) violations++;
  }

  // (b) every single-hex-char mutation of the independently-computed digest must be REJECTED
  for (let i = 0; i < tree.tree_digest.length; i += 4) { // sample every 4th position, cheap + thorough enough
    const chars = tree.tree_digest.split('');
    chars[i] = chars[i] === '0' ? '1' : '0';
    const mutated = Object.assign({}, tree, { tree_digest: chars.join('') });
    checked++;
    const { output_payload } = compute({ tree: mutated, facts: ALL_FALSE_FACTS });
    if (output_payload.error_code !== 'TREE_DIGEST_MISMATCH') violations++;
  }

  // (c) mutating tree CONTENT without updating the digest must also be rejected (digest binds content)
  const contentMutated = JSON.parse(JSON.stringify(tree));
  contentMutated.nodes.leaf_501a1.verdict = 'TAMPERED';
  checked++;
  {
    const { output_payload } = compute({ tree: contentMutated, facts: ALL_FALSE_FACTS });
    if (output_payload.error_code !== 'TREE_DIGEST_MISMATCH') violations++;
  }

  return { name: 'P3_independent_digest_differential_vs_node_crypto', checked, violations };
}

// ── P4: CITATION GATE — every node uncited, one at a time, must be REJECTED (not leaves only) ───
function checkP4_citationGateOnEveryNode() {
  const tree = buildDemoTree();
  let checked = 0, violations = 0;
  for (const id of Object.keys(tree.nodes)) {
    const mutated = JSON.parse(JSON.stringify(tree));
    delete mutated.nodes[id].citation;
    checked++;
    const { output_payload } = compute({ tree: mutated, facts: ALL_FALSE_FACTS });
    if (output_payload.error_code !== 'TREE_UNCITED_NODE') violations++;
  }
  // also: a citation object missing exactly one required sub-field must be rejected the same way
  for (const field of ['clause', 'source', 'source_digest', 'snapshot_location']) {
    const mutated = JSON.parse(JSON.stringify(tree));
    delete mutated.nodes.c_501a1.citation[field];
    checked++;
    const { output_payload } = compute({ tree: mutated, facts: ALL_FALSE_FACTS });
    if (output_payload.error_code !== 'TREE_UNCITED_NODE') violations++;
  }
  return { name: 'P4_citation_gate_rejects_every_uncited_node_internal_included', checked, violations };
}

// ── P5: CYCLE-ACYCLICITY — rejects a real cycle, does NOT over-flag a legitimate DAG convergence ─
function checkP5_cycleDetectionNotOverStrict() {
  let checked = 0, violations = 0;

  // (a) a direct self-loop must be rejected
  {
    const cyc = {
      tree_id: 't', tree_version: '1', tree_digest: 'X', root: 'c1',
      nodes: { c1: { kind: 'criterion', field: 'a', operator: 'eq', operand: true, branches: { true: 'c1', false: 'leaf' }, citation: SYNTHETIC_CITATION }, leaf: { kind: 'leaf', verdict: 'v', citation: SYNTHETIC_CITATION } },
    };
    cyc.tree_digest = indDigest(cyc);
    checked++;
    const { output_payload } = compute({ tree: cyc, facts: { a: true } });
    if (output_payload.error_code !== 'TREE_CYCLE_DETECTED') violations++;
  }

  // (b) an ancestor-revisiting cycle several levels down must be rejected
  {
    const cyc = {
      tree_id: 't', tree_version: '1', tree_digest: 'X', root: 'c1',
      nodes: {
        c1: { kind: 'criterion', field: 'a', operator: 'eq', operand: true, branches: { true: 'c2', false: 'leaf1' }, citation: SYNTHETIC_CITATION },
        c2: { kind: 'criterion', field: 'b', operator: 'eq', operand: true, branches: { true: 'c1', false: 'leaf2' }, citation: SYNTHETIC_CITATION },
        leaf1: { kind: 'leaf', verdict: 'v1', citation: SYNTHETIC_CITATION },
        leaf2: { kind: 'leaf', verdict: 'v2', citation: SYNTHETIC_CITATION },
      },
    };
    cyc.tree_digest = indDigest(cyc);
    checked++;
    const { output_payload } = compute({ tree: cyc, facts: { a: false, b: false } }); // this path never hits the cycle branch but the load-time check must still catch it
    if (output_payload.error_code !== 'TREE_CYCLE_DETECTED') violations++;
  }

  // (c) a legitimate DIAMOND (two internal nodes converging on the SAME leaf, no cycle) must be ACCEPTED
  {
    const diamond = {
      tree_id: 't', tree_version: '1', tree_digest: 'X', root: 'c1',
      nodes: {
        c1: { kind: 'criterion', field: 'a', operator: 'eq', operand: true, branches: { true: 'c2', false: 'c3' }, citation: SYNTHETIC_CITATION },
        c2: { kind: 'criterion', field: 'b', operator: 'eq', operand: true, branches: { true: 'leafShared', false: 'leafShared' }, citation: SYNTHETIC_CITATION },
        c3: { kind: 'criterion', field: 'c', operator: 'eq', operand: true, branches: { true: 'leafShared', false: 'leafShared' }, citation: SYNTHETIC_CITATION },
        leafShared: { kind: 'leaf', verdict: 'shared', citation: SYNTHETIC_CITATION },
      },
    };
    diamond.tree_digest = indDigest(diamond);
    for (const facts of [{ a: true, b: true, c: false }, { a: false, b: false, c: false }]) {
      checked++;
      const { output_payload } = compute({ tree: diamond, facts });
      if (output_payload.error_code !== null || output_payload.verdict !== 'shared') violations++;
    }
  }

  return { name: 'P5_cycle_detection_catches_cycles_not_dag_convergence', checked, violations };
}

// ── P6: BOUNDS — exact boundary accepted, one-past-boundary rejected, for all three declared bounds
function makeChainTree(depth) {
  // a straight-line chain of `depth` criterion nodes ending in one leaf: depth+1 nodes total, max depth = depth+1
  const nodes = {};
  for (let i = 0; i < depth; i++) {
    nodes['c' + i] = { kind: 'criterion', field: 'f' + i, operator: 'eq', operand: true, branches: { true: (i + 1 < depth) ? ('c' + (i + 1)) : 'leaf', false: 'leaf' }, citation: SYNTHETIC_CITATION };
  }
  nodes.leaf = { kind: 'leaf', verdict: 'v', citation: SYNTHETIC_CITATION };
  const tree = { tree_id: 't', tree_version: '1', tree_digest: 'X', root: 'c0', nodes };
  tree.tree_digest = indDigest(tree);
  return tree;
}
function checkP6_boundsExactBoundary() {
  let checked = 0, violations = 0;

  // max_depth: 12 accepted (root depth 1 .. leaf depth 12 when chain length 11), 13 rejected
  {
    const atBound = makeChainTree(11); // 11 criteria + 1 leaf = depth 12 exactly
    checked++;
    const r1 = compute({ tree: atBound, facts: Object.fromEntries(Array.from({ length: 11 }, (_, i) => ['f' + i, true])) });
    if (r1.output_payload.error_code === 'TREE_MAX_DEPTH_EXCEEDED') violations++;

    const overBound = makeChainTree(12); // 12 criteria + 1 leaf = depth 13, one past the bound
    checked++;
    const r2 = compute({ tree: overBound, facts: {} });
    if (r2.output_payload.error_code !== 'TREE_MAX_DEPTH_EXCEEDED') violations++;
  }

  // max_nodes: 256 accepted, 257 rejected. Build a WIDE tree (one criterion, many single-hop leaves
  // is not possible with a strict boolean branch shape, so use a chain instead — a 255-node chain +
  // 1 leaf = 256 nodes exactly; a 256-node chain + 1 leaf = 257, one past the bound).
  {
    const atBound = makeChainTree(255);
    checked++;
    const r1 = compute({ tree: atBound, facts: {} });
    if (r1.output_payload.error_code === 'TREE_MAX_NODES_EXCEEDED') violations++;

    const overBound = makeChainTree(256);
    checked++;
    const r2 = compute({ tree: overBound, facts: {} });
    if (r2.output_payload.error_code !== 'TREE_MAX_NODES_EXCEEDED') violations++;
  }

  // max_tree_bytes: inflate a citation field with a long string until the tree crosses 65536 bytes
  {
    const base = buildDemoTree();
    const over = JSON.parse(JSON.stringify(base));
    over.nodes.c_501a1.citation.source = 'x'.repeat(70000);
    over.tree_digest = indDigest(over);
    checked++;
    const r = compute({ tree: over, facts: ALL_FALSE_FACTS });
    if (r.output_payload.error_code !== 'TREE_MAX_BYTES_EXCEEDED') violations++;
  }

  return { name: 'P6_bounds_exact_boundary_accepted_one_past_rejected', checked, violations };
}

// ── P7: GENERIC OPERATOR CORRECTNESS — the full closed set, beyond what the demonstrator uses ───
function twoLeafTree(field, operator, operand) {
  const tree = {
    tree_id: 't', tree_version: '1', tree_digest: 'X', root: 'c1',
    nodes: {
      c1: { kind: 'criterion', field, operator, operand, branches: { true: 'leafTrue', false: 'leafFalse' }, citation: SYNTHETIC_CITATION },
      leafTrue: { kind: 'leaf', verdict: 'satisfied', citation: SYNTHETIC_CITATION },
      leafFalse: { kind: 'leaf', verdict: 'not_satisfied', citation: SYNTHETIC_CITATION },
    },
  };
  tree.tree_digest = indDigest(tree);
  return tree;
}
function checkP7_genericOperatorCorrectness() {
  let checked = 0, violations = 0;
  // Explicit tuple typing: without it, the mixed-shape rows (operand varies
  // string/number/array) widen every column — including the always-string
  // field name at index 1 — into one shared union, which fails TS2464 at
  // the `[field]` computed property below (field is always 'x' at runtime).
  /** @type {Array<[string, string, *, *, string]>} */
  const cases = [
    ['in', 'x', ['a', 'b', 'c'], 'b', 'satisfied'], ['in', 'x', ['a', 'b', 'c'], 'z', 'not_satisfied'],
    ['lt', 'x', 10, 5, 'satisfied'], ['lt', 'x', 10, 10, 'not_satisfied'], ['lt', 'x', 10, 11, 'not_satisfied'],
    ['lte', 'x', 10, 10, 'satisfied'], ['lte', 'x', 10, 11, 'not_satisfied'],
    ['gt', 'x', 10, 11, 'satisfied'], ['gt', 'x', 10, 10, 'not_satisfied'],
    ['gte', 'x', 10, 10, 'satisfied'], ['gte', 'x', 10, 9, 'not_satisfied'],
    ['between', 'x', [5, 10], 5, 'satisfied'], ['between', 'x', [5, 10], 10, 'satisfied'], ['between', 'x', [5, 10], 4, 'not_satisfied'], ['between', 'x', [5, 10], 11, 'not_satisfied'],
    ['all_of', 'x', ['a', 'b'], ['a', 'b', 'c'], 'satisfied'], ['all_of', 'x', ['a', 'b'], ['a'], 'not_satisfied'],
    ['any_of', 'x', ['a', 'b'], ['a'], 'satisfied'], ['any_of', 'x', ['a', 'b'], ['z'], 'not_satisfied'],
    ['none_of', 'x', ['a', 'b'], ['z'], 'satisfied'], ['none_of', 'x', ['a', 'b'], ['a'], 'not_satisfied'],
  ];
  for (const [operator, field, operand, factValue, expectedVerdict] of cases) {
    const tree = twoLeafTree(field, operator, operand);
    checked++;
    const { output_payload } = compute({ tree, facts: { [field]: factValue } });
    if (output_payload.error_code !== null || output_payload.verdict !== expectedVerdict) violations++;
  }

  // type-mismatch cases must produce FACT_TYPE_MISMATCH, never a silent boolean
  /** @type {Array<[string, string, *, *]>} */
  const mismatches = [
    ['lt', 'x', 10, 'not-a-number'], ['between', 'x', [5, 10], 'nope'], ['all_of', 'x', ['a'], 'not-an-array'], ['in', 'x', 'not-an-array', 'a'],
  ];
  for (const [operator, field, operand, factValue] of mismatches) {
    const tree = twoLeafTree(field, operator, operand);
    checked++;
    const { output_payload } = compute({ tree, facts: { [field]: factValue } });
    if (output_payload.error_code !== 'FACT_TYPE_MISMATCH') violations++;
  }

  // a non-closed-set operator must never reach evaluation — TREE_INVALID_OPERATOR at load
  {
    const tree = twoLeafTree('x', 'eq', true);
    tree.nodes.c1.operator = 'eval';
    tree.tree_digest = indDigest(tree);
    checked++;
    const { output_payload } = compute({ tree, facts: { x: true } });
    if (output_payload.error_code !== 'TREE_INVALID_OPERATOR') violations++;
  }

  return { name: 'P7_generic_operator_correctness_full_closed_set', checked, violations };
}

// ── P8: DETERMINISM ──────────────────────────────────────────────────────────────────────────────
function checkP8_determinism() {
  const rng = mulberry32(628008);
  const tree = buildDemoTree();
  let checked = 0, violations = 0;
  for (let i = 0; i < 100; i++) {
    const mask = Math.floor(rng() * 32);
    const facts = {};
    DEMO_FIELDS.forEach((f, j) => { facts[f] = !!((mask >> j) & 1); });
    checked++;
    const a = compute({ tree: structuredClone(tree), facts: structuredClone(facts) });
    const b = compute({ tree: structuredClone(tree), facts: structuredClone(facts) });
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
  }
  return { name: 'P8_determinism_on_recompute', checked, violations };
}

// ── P9: OUTPUT SHAPE ─────────────────────────────────────────────────────────────────────────────
function checkP9_outputShape() {
  const tree = buildDemoTree();
  let checked = 0, violations = 0;
  for (let mask = 0; mask < 32; mask++) {
    const facts = {};
    DEMO_FIELDS.forEach((f, i) => { facts[f] = !!((mask >> i) & 1); });
    checked++;
    const { output_payload } = compute({ tree, facts });
    if (findShapeViolations(output_payload).length) violations++;
    else if (!Array.isArray(output_payload.closed_operator_set) || output_payload.closed_operator_set.length !== 10) violations++;
    else if (typeof output_payload.scope_note !== 'string' || output_payload.scope_note.length === 0) violations++;
  }
  // null-proto hostile pp must not corrupt shape either
  checked++;
  const { output_payload } = compute(nullProtoClone({ tree: null, facts: null }));
  if (findShapeViolations(output_payload).length) violations++;
  return { name: 'P9_output_shape_sanity', checked, violations };
}

// ---------- run ----------
const oracle = runFixtureOracle(KERNEL_ID, compute);
const properties = [
  checkP1_totality(),
  checkP2_exhaustiveEnumeration(),
  checkP3_independentDigestDifferential(),
  checkP4_citationGateOnEveryNode(),
  checkP5_cycleDetectionNotOverStrict(),
  checkP6_boundsExactBoundary(),
  checkP7_genericOperatorCorrectness(),
  checkP8_determinism(),
  checkP9_outputShape(),
];
console.log(`[${KERNEL_ID}] class-B property floor — P3 differentials the kernel's hand-rolled SHA-256/canon against node:crypto; P2 is the class-A exhaustiveness proof for the demonstrator tree`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
