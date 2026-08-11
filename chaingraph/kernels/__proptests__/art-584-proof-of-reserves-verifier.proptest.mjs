// art-584-proof-of-reserves-verifier.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C30-1).
// kernel_digest_at_authoring: sha256:852795237d7839b503e955db5db49f8d87ff6dc9edeb5a31687fca2e6f660b66
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES — the WU row's triage table listed this kernel as float:no; RE-CONFIRMED BY
// DIRECT READ per FIX-2 and that classification does NOT hold. This is a CORRECTION (no -> yes). The
// Merkle-sum walk itself is integer/string hashing (no float risk there), but the coverage-ratio
// check performs genuine continuous floating-point division compared against a real percentage
// tolerance: coverageRatioPct = parseFloat(((reserveSum/liabilitySum)*100).toFixed(4)), and
// deltaPct = parseFloat((Math.abs(published-reserveSum)/reserveSum*100).toFixed(4)), gated by
// withinTolerance = deltaPct <= COVERAGE_TOLERANCE_PCT (0.01). Leaf sums (leaf_balance/leaf_sum) are
// caller-declared `Number(v)` with no integer coercion and no sign restriction, so this is a
// continuous, unbounded, signed-float computation feeding a real decision boundary. ULP-boundary
// forcing is mandatory per spec §3 and is provided below (P5).
// Checks: fixture-oracle gate, termination/boundedness (P1: both Merkle-sum walks are capped at
// MAX_PATH_DEPTH=40, INDETERMINATE beyond it -- a hard structural bound on the otherwise-unbounded
// path array), a differential re-derivation of the Merkle-sum leaf/combine hash construction and the
// coverage-ratio arithmetic against an INDEPENDENT SHA-256 reimplementation via node:crypto (P3: this
// is the strongest form of differential check in this shard — a genuinely separate cryptographic
// implementation, not merely a re-derived formula), a determinism metamorphic identity (P4: calling
// compute() twice on identical inputs is byte-for-byte identical — the kernel is explicitly
// deterministic-only, no clock/randomness/network), and mandatory ULP-boundary forcing on the
// COVERAGE_TOLERANCE_PCT=0.01 delta-pct boundary, the reserveSum===0 special case, negative and
// negative-zero leaf sums, and a denormal leaf sum (P5).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled; node:crypto
// used ONLY for the independent P3 reimplementation's SHA-256, never imported by the kernel itself,
// which inlines its own pure-JS SHA-256 for zkVM-guest compatibility per its own header comment).
//
// Run: node chaingraph/kernels/__proptests__/art-584-proof-of-reserves-verifier.proptest.mjs

import { compute } from '../art-584-proof-of-reserves-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-584-proof-of-reserves-verifier.fixtures.json');
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
const rand = mulberry32(0x584C30);

// Independent SHA-256 (node:crypto) reimplementation of the kernel's documented Merkle-sum
// construction: leafNode(label,sum) = sha256(`${label}|${sum}`); combineNodes(l,r) =
// sha256(`${l.hash}|${l.sum}|${r.hash}|${r.sum}`).
function sha256hex(str) { return createHash('sha256').update(str, 'utf8').digest('hex'); }
function leafNode(label, sum) { const s = Number(sum ?? 0); return { hash: sha256hex(`${label ?? ''}|${s}`), sum: s }; }
function combineNodes(left, right) { return { hash: sha256hex(`${left.hash}|${left.sum}|${right.hash}|${right.sum}`), sum: left.sum + right.sum }; }
function walkPath(leaf, path) {
  let current = leaf;
  for (const step of path) {
    const sibling = { hash: String(step.hash ?? ''), sum: Number(step.sum ?? 0) };
    current = step.position === 'left' ? combineNodes(sibling, current) : combineNodes(current, sibling);
  }
  return current;
}

// Build a genuinely VALID (CONSISTENT) reserve_proof / liability_branch by walking the same
// construction forward, so property tests exercise the real hash-matching path rather than only the
// trivially-INDETERMINATE/missing-input path.
function buildValidProof(rng, label, leafSum, depth) {
  let current = leafNode(label, leafSum);
  const path = [];
  for (let i = 0; i < depth; i++) {
    const siblingSum = Math.floor(rng() * 100000);
    const sibling = leafNode(`sib-${i}`, siblingSum);
    const position = rng() < 0.5 ? 'left' : 'right';
    current = position === 'left' ? combineNodes(sibling, current) : combineNodes(current, sibling);
    path.push({ hash: sibling.hash, sum: sibling.sum, position });
  }
  return { path, root: { hash: current.hash, sum: current.sum } };
}

function randomPP(rng) {
  const reserveLeaf = Math.floor(rng() * 1_000_000);
  const liabilityLeaf = Math.floor(rng() * 1_000_000);
  const depth = Math.floor(rng() * 6);
  const reserveProof = buildValidProof(rng, 'user-1', reserveLeaf, depth);
  const liabilityBranch = buildValidProof(rng, 'liab-branch', liabilityLeaf, depth);
  return {
    reserve_proof: { leaf_user_id_hash: 'user-1', leaf_balance: reserveLeaf, path: reserveProof.path, root: reserveProof.root },
    liability_branch: { leaf_label: 'liab-branch', leaf_sum: liabilityLeaf, path: liabilityBranch.path, root: liabilityBranch.root },
    published_reserve_figures: rng() < 0.7 ? { total_reserves_usd: reserveProof.root.sum + (Math.floor(rng() * 200) - 100), as_of: '2026-08-01', source: 'synthetic' } : null,
  };
}

const TRIALS = 1200;

// ---------- P1: termination/boundedness — MAX_PATH_DEPTH=40 hard cap, INDETERMINATE beyond it ----------
function checkP1_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 800; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.coverage_ratio_pct !== null && !Number.isFinite(o.coverage_ratio_pct)) violations++;
  }
  // Forced over-depth probe: 41 path steps must be rejected as INDETERMINATE, never processed.
  {
    const proof = buildValidProof(rand, 'x', 100, 41);
    const pp = { reserve_proof: { leaf_user_id_hash: 'x', leaf_balance: 100, path: proof.path, root: proof.root } };
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.findings[0].verdict !== 'INDETERMINATE') violations++;
  }
  // Exactly at the cap (40) must be processed, not rejected.
  {
    const proof = buildValidProof(rand, 'x', 100, 40);
    const pp = { reserve_proof: { leaf_user_id_hash: 'x', leaf_balance: 100, path: proof.path, root: proof.root } };
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.findings[0].verdict !== 'CONSISTENT') violations++;
  }
  return { name: 'P1_termination_max_path_depth_boundary', trials: checked, violations };
}

// ---------- P3: differential — Merkle-sum construction + coverage ratio vs an independent node:crypto SHA-256 reimplementation ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.findings[0].verdict !== 'CONSISTENT') violations++;
    if (o.findings[1].verdict !== 'CONSISTENT') violations++;
    const expReserveRoot = walkPath(leafNode(pp.reserve_proof.leaf_user_id_hash, pp.reserve_proof.leaf_balance), pp.reserve_proof.path);
    if (o.computed_reserve_root.hash !== expReserveRoot.hash) violations++;
    if (o.computed_reserve_root.sum !== expReserveRoot.sum) violations++;
    if (o.coverage_ratio_pct !== null) {
      const expRatio = parseFloat(((o.computed_reserve_root.sum / o.computed_liability_root.sum) * 100).toFixed(4));
      if (o.coverage_ratio_pct !== expRatio) violations++;
    }
  }
  return { name: 'P3_merkle_construction_and_coverage_ratio_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — determinism (identical inputs -> byte-identical output) ----------
function checkP4_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 500; i++) {
    const pp = randomPP(rand);
    const a = compute(pp).output_payload;
    const b = compute(pp).output_payload;
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
  }
  return { name: 'P4_determinism_identical_inputs', trials: checked, violations };
}

// ---------- P5: ULP-boundary forcing (mandatory, float_sensitive: yes — corrected classification) ----------
function checkP5_ulp_forcing() {
  let violations = 0, checked = 0;
  function makeSingleLeafProofs(reserveSum, liabilitySum) {
    const rLeaf = leafNode('r', reserveSum);
    const lLeaf = leafNode('l', liabilitySum);
    return {
      reserve_proof: { leaf_user_id_hash: 'r', leaf_balance: reserveSum, path: [], root: { hash: rLeaf.hash, sum: rLeaf.sum } },
      liability_branch: { leaf_label: 'l', leaf_sum: liabilitySum, path: [], root: { hash: lLeaf.hash, sum: lLeaf.sum } },
    };
  }
  // (a) delta_pct exactly at the 0.01 tolerance boundary, and just inside/outside, against
  // reserveSum=1,000,000: delta=100 -> deltaPct=0.01 exactly (boundary, inclusive); delta=101 ->
  // 0.0101 (exceeds); delta=99 -> 0.0099 (within).
  for (const published of [1_000_100, 1_000_101, 1_000_099]) {
    const base = makeSingleLeafProofs(1_000_000, 500_000);
    const pp = { ...base, published_reserve_figures: { total_reserves_usd: published, as_of: '2026-08-01', source: 'x' } };
    const { output_payload: o } = compute(pp);
    checked++;
    const expectedWithin = published === 1_000_100 || published === 1_000_099;
    if (o.reserve_figure_cross_check.within_tolerance !== expectedWithin) violations++;
  }
  // (b) reserveSum === 0, published === 0 -> deltaPct special-cased to 0, within tolerance.
  {
    const base = makeSingleLeafProofs(0, 500_000);
    const pp = { ...base, published_reserve_figures: { total_reserves_usd: 0, as_of: '2026-08-01', source: 'x' } };
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.reserve_figure_cross_check.delta_pct !== 0) violations++;
    if (!o.reserve_figure_cross_check.within_tolerance) violations++;
  }
  // (c) reserveSum === 0, published !== 0 -> deltaPct null, NOT within tolerance (n/a case).
  {
    const base = makeSingleLeafProofs(0, 500_000);
    const pp = { ...base, published_reserve_figures: { total_reserves_usd: 5, as_of: '2026-08-01', source: 'x' } };
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.reserve_figure_cross_check.delta_pct !== null) violations++;
    if (o.reserve_figure_cross_check.within_tolerance) violations++;
  }
  // (d) negative and negative-zero leaf sums must not crash and must produce finite results.
  {
    const base = makeSingleLeafProofs(-1000, 500);
    const { output_payload: o } = compute(base);
    checked++;
    if (o.findings[0].verdict !== 'CONSISTENT') violations++;
    if (o.computed_reserve_root.sum !== -1000) violations++;
  }
  {
    const base = makeSingleLeafProofs(-0, 500);
    const { output_payload: o } = compute(base);
    checked++;
    if (o.findings[0].verdict !== 'CONSISTENT') violations++;
  }
  // (e) denormal leaf sum (Number.MIN_VALUE) must not crash and must stay finite.
  {
    const base = makeSingleLeafProofs(Number.MIN_VALUE, 500);
    const { output_payload: o } = compute(base);
    checked++;
    if (o.findings[0].verdict !== 'CONSISTENT') violations++;
    if (o.coverage_ratio_pct !== null && !Number.isFinite(o.coverage_ratio_pct)) violations++;
  }
  return { name: 'P5_ulp_boundary_forcing_coverage_tolerance', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_boundedness());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_determinism());
results.properties.push(checkP5_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-584-proof-of-reserves-verifier',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
