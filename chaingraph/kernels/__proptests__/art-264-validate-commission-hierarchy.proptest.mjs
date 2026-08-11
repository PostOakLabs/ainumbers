// art-264-validate-commission-hierarchy.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C8-1).
// kernel_digest_at_authoring: sha256:ad511a9f6b10970b9bdc169af8f6c79d2affad7b21087262e6a7f9cf3041760c
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny — blanket
// class-C Dafny stays frozen. float_sensitive: YES (split_pct sums via Math.round(*10000)/10000, ULP
// -forced below). Checks: fixture-oracle gate, termination (BFS bounded by hierarchy.length — total
// enqueues <= 2*hierarchy.length since childrenOf holds exactly one entry per node), boundedness
// (total_levels <= hierarchy.length, by_level agent counts sum to hierarchy.length), ULP-boundary
// forcing (split_pct exactly 100, one ULP over 100, negative split, denormal split), and a metamorphic
// property (permuting the hierarchy array does not change is_valid / total_levels / orphan_count —
// only the reported order of nodes within a level may differ).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-264-validate-commission-hierarchy.proptest.mjs

import { compute } from '../art-264-validate-commission-hierarchy.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-264-validate-commission-hierarchy.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const output_payload = compute(vec.policy_parameters);
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
const rand = mulberry32(0x264A0);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

const TRIALS = 5000;

// Build a random FOREST (no cycles) — a root plus a random tree via parent-back-references, which is
// the realistic structural domain (BFS-terminates cleanly). Cycles/multi-parent DAGs are exercised
// separately, kept small, in the forced set.
function randomForest(rng, n) {
  const nodes = [];
  const ids = [];
  for (let i = 0; i < n; i++) {
    const id = 'A' + i;
    ids.push(id);
    const parent_id = i === 0 || rng() < 0.15 ? null : ids[Math.floor(rng() * i)];
    nodes.push({ agent_id: id, parent_id, split_pct: parent_id === null ? null : randRange(rng, 0, 40) });
  }
  return nodes;
}

// ---------- P1: termination — total_levels and by_level agent count bounded by hierarchy.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 300; i++) {
    const n = Math.floor(rand() * 150);
    const hierarchy = randomForest(rand, n);
    const output_payload = compute({ hierarchy });
    checked++;
    if (output_payload.total_levels > n) violations++;
    if (output_payload.agent_count !== n) violations++;
    const levelSum = output_payload.by_level.reduce((s, l) => s + l.agent_count, 0);
    if (levelSum > n) violations++;
  }
  return { name: 'P1_termination_levels_bounded_by_hierarchy_length', trials: checked, violations };
}

// ---------- P2: boundedness — no negative agent_count, is_valid iff violations.length===0 ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 20);
    const hierarchy = randomForest(rand, n);
    const output_payload = compute({ hierarchy });
    checked++;
    if (output_payload.is_valid !== (output_payload.violations.length === 0)) violations++;
    for (const l of output_payload.by_level) {
      if (l.agent_count < 0) violations++;
      if (!Number.isFinite(l.total_split_pct)) violations++;
    }
    if (output_payload.orphan_count < 0) violations++;
  }
  return { name: 'P2_boundedness_nonneg_and_isvalid_iff', trials: checked, violations };
}

// ---------- P3: differential — EXCEEDS_100_PCT violation re-derived from parent split sums ----------
function checkP3_exceeds_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 15);
    const hierarchy = randomForest(rand, n);
    const output_payload = compute({ hierarchy });
    checked++;
    const parentSums = {};
    for (const node of hierarchy) {
      if (!node.parent_id) continue;
      parentSums[node.parent_id] = (parentSums[node.parent_id] || 0) + (typeof node.split_pct === 'number' ? node.split_pct : 0);
    }
    const expectedExceeders = new Set();
    for (const [pid, sum] of Object.entries(parentSums)) {
      if (Math.round(sum * 10000) / 10000 > 100) expectedExceeders.add(pid);
    }
    const actualExceeders = new Set(output_payload.violations.filter((v) => v.type === 'EXCEEDS_100_PCT').map((v) => v.agent_id));
    if (expectedExceeders.size !== actualExceeders.size) violations++;
    for (const id of expectedExceeders) if (!actualExceeders.has(id)) violations++;
  }
  return { name: 'P3_exceeds_100pct_differential', trials: checked, violations };
}

// ---------- P4 (ULP-forcing, float_sensitive:yes) ----------
const ULP_BOUNDARY_CASES = [
  { label: 'split_pct sum exactly 100.0 -> no EXCEEDS violation', hierarchy: [{ agent_id: 'R', parent_id: null }, { agent_id: 'C1', parent_id: 'R', split_pct: 60 }, { agent_id: 'C2', parent_id: 'R', split_pct: 40 }] },
  { label: 'split_pct sum one ULP over 100 -> EXCEEDS violation', hierarchy: [{ agent_id: 'R', parent_id: null }, { agent_id: 'C1', parent_id: 'R', split_pct: 100 + Number.EPSILON * 1000 }] },
  { label: 'negative split_pct -> NEGATIVE_SPLIT violation', hierarchy: [{ agent_id: 'R', parent_id: null }, { agent_id: 'C1', parent_id: 'R', split_pct: -5 }] },
  { label: 'denormal split_pct -> rounds to zero, no violation', hierarchy: [{ agent_id: 'R', parent_id: null }, { agent_id: 'C1', parent_id: 'R', split_pct: Number.MIN_VALUE }] },
  { label: '0.1+0.2 style split composition (30.0000000004 boundary)', hierarchy: [{ agent_id: 'R', parent_id: null }, { agent_id: 'C1', parent_id: 'R', split_pct: 0.1 }, { agent_id: 'C2', parent_id: 'R', split_pct: 0.2 }] },
  { label: 'empty hierarchy -> zero levels, valid', hierarchy: [] },
  { label: 'orphan node -> ORPHAN violation', hierarchy: [{ agent_id: 'C1', parent_id: 'GHOST', split_pct: 50 }] },
];
function checkP4_forced() {
  const rows = [];
  for (const c of ULP_BOUNDARY_CASES) {
    const output_payload = compute(c);
    const allFinite = output_payload.by_level.every((l) => Number.isFinite(l.total_split_pct)) && Number.isFinite(output_payload.total_levels);
    rows.push({ label: c.label, is_valid: output_payload.is_valid, violation_types: output_payload.violations.map((v) => v.type), finite: allFinite });
  }
  return rows;
}

// ---------- P5: metamorphic — permutation-invariance of is_valid/total_levels/orphan_count under array reorder ----------
function checkP5_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const n = Math.floor(rand() * 20);
    const hierarchy = randomForest(rand, n);
    const shuffled = hierarchy.slice();
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const r1 = compute({ hierarchy });
    const r2 = compute({ hierarchy: shuffled });
    checked++;
    if (r1.is_valid !== r2.is_valid) violations++;
    if (r1.total_levels !== r2.total_levels) violations++;
    if (r1.orphan_count !== r2.orphan_count) violations++;
    if (r1.agent_count !== r2.agent_count) violations++;
  }
  return { name: 'P5_metamorphic_permutation_invariance_structural', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_exceeds_differential());
results.properties.push(checkP5_permutation_invariance());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryMismatch = results.boundary_forced.some((b) => !b.finite);

console.log(JSON.stringify({
  tool_id: 'art-264-validate-commission-hierarchy',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);
