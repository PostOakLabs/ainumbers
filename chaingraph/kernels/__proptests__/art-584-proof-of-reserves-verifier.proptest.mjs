// art-584-proof-of-reserves-verifier.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C30-1).
// kernel_digest_at_authoring: sha256:a520181a18f687b07cce4f7425b1604a49251cc0730721086ed86302f3934cf4
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
//
// KERNEL-FAILOPEN-P3-ART584-1 amendment: the three top-level inputs (reserve_proof,
// liability_branch, published_reserve_figures) are now REQUIRED. Positive-path properties
// therefore build FULL inputs (all three present, published figure matching the recomputed
// reserve sum). P6 proves buildArtifact never throws on junk (D6-ANYKERNEL-1115); P7 mutates
// each required field of every positive vector to delete / null / '' / '   ' and asserts the
// determination is never positive, at the overall level or any finding level.
//
// Checks: fixture-oracle gate, termination/boundedness (P1), differential re-derivation against
// an independent node:crypto SHA-256 (P3), determinism (P4), ULP-boundary forcing (P5),
// buildArtifact_never_throws (P6), required_fields_never_positive (P7).
// Zero external dependencies — pure Node built-ins only.
//
// Run: node chaingraph/kernels/__proptests__/art-584-proof-of-reserves-verifier.proptest.mjs

import { compute, buildArtifact } from '../art-584-proof-of-reserves-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_PATH = path.join(__dirname, '..', 'fixtures', 'art-584-proof-of-reserves-verifier.fixtures.json');
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixtures = JSON.parse(readFileSync(FIXTURES_PATH, 'utf8'));
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

function validLiability(rng, leafSum) {
  const p = buildValidProof(rng, 'liab-branch', leafSum, Math.floor(rng() * 6));
  return { leaf_label: 'liab-branch', leaf_sum: leafSum, path: p.path, root: p.root };
}

// Full input: all three required fields present, published figure equal to the recomputed
// reserve root sum (delta 0) so the positive path is exercised without a tolerance trip.
function fullPP(rng, reserveLeaf, liabilityLeaf, depth) {
  const reserveProof = buildValidProof(rng, 'user-1', reserveLeaf, depth);
  return {
    reserve_proof: { leaf_user_id_hash: 'user-1', leaf_balance: reserveLeaf, path: reserveProof.path, root: reserveProof.root },
    liability_branch: validLiability(rng, liabilityLeaf),
    published_reserve_figures: { total_reserves_usd: reserveProof.root.sum, as_of: '2026-08-01', source: 'synthetic' },
  };
}

function randomPP(rng) {
  return fullPP(rng, Math.floor(rng() * 1_000_000), Math.floor(rng() * 1_000_000), Math.floor(rng() * 6));
}

const TRIALS = 1200;

// ---------- P1: termination/boundedness — MAX_PATH_DEPTH=40 hard cap ----------
function checkP1_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 800; i++) {
    const { output_payload: o } = compute(randomPP(rand));
    checked++;
    if (o.coverage_ratio_pct !== null && !Number.isFinite(o.coverage_ratio_pct)) violations++;
  }
  {
    const proof = buildValidProof(rand, 'x', 100, 41);
    const pp = {
      reserve_proof: { leaf_user_id_hash: 'x', leaf_balance: 100, path: proof.path, root: proof.root },
      liability_branch: validLiability(rand, 100),
      published_reserve_figures: { total_reserves_usd: proof.root.sum, as_of: 'x', source: 'x' },
    };
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.findings[0].verdict !== 'INDETERMINATE') violations++;
  }
  {
    const proof = buildValidProof(rand, 'x', 100, 40);
    const pp = {
      reserve_proof: { leaf_user_id_hash: 'x', leaf_balance: 100, path: proof.path, root: proof.root },
      liability_branch: validLiability(rand, 100),
      published_reserve_figures: { total_reserves_usd: proof.root.sum, as_of: 'x', source: 'x' },
    };
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.findings[0].verdict !== 'CONSISTENT') violations++;
  }
  return { name: 'P1_termination_max_path_depth_boundary', trials: checked, violations };
}

// ---------- P3: differential vs independent node:crypto SHA-256 ----------
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

// ---------- P4: determinism ----------
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

// ---------- P5: ULP-boundary forcing ----------
function checkP5_ulp_forcing() {
  let violations = 0, checked = 0;
  function makeSingleLeafProofs(reserveSum, liabilitySum) {
    const rLeaf = leafNode('r', reserveSum);
    const lLeaf = leafNode('l', liabilitySum);
    return {
      reserve_proof: { leaf_user_id_hash: 'r', leaf_balance: reserveSum, path: [], root: { hash: rLeaf.hash, sum: rLeaf.sum } },
      liability_branch: { leaf_label: 'l', leaf_sum: liabilitySum, path: [], root: { hash: lLeaf.hash, sum: lLeaf.sum } },
      published_reserve_figures: { total_reserves_usd: reserveSum, as_of: '2026-08-01', source: 'x' },
    };
  }
  for (const published of [1_000_100, 1_000_101, 1_000_099]) {
    const base = makeSingleLeafProofs(1_000_000, 500_000);
    const pp = { ...base, published_reserve_figures: { total_reserves_usd: published, as_of: '2026-08-01', source: 'x' } };
    const { output_payload: o } = compute(pp);
    checked++;
    const expectedWithin = published === 1_000_100 || published === 1_000_099;
    if (o.reserve_figure_cross_check.within_tolerance !== expectedWithin) violations++;
  }
  {
    const base = makeSingleLeafProofs(0, 500_000);
    const pp = { ...base, published_reserve_figures: { total_reserves_usd: 0, as_of: '2026-08-01', source: 'x' } };
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.reserve_figure_cross_check.delta_pct !== 0) violations++;
    if (!o.reserve_figure_cross_check.within_tolerance) violations++;
  }
  {
    const base = makeSingleLeafProofs(0, 500_000);
    const pp = { ...base, published_reserve_figures: { total_reserves_usd: 5, as_of: '2026-08-01', source: 'x' } };
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.reserve_figure_cross_check.delta_pct !== null) violations++;
    if (o.reserve_figure_cross_check.within_tolerance) violations++;
  }
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
  {
    const base = makeSingleLeafProofs(Number.MIN_VALUE, 500);
    const { output_payload: o } = compute(base);
    checked++;
    if (o.findings[0].verdict !== 'CONSISTENT') violations++;
    if (o.coverage_ratio_pct !== null && !Number.isFinite(o.coverage_ratio_pct)) violations++;
  }
  return { name: 'P5_ulp_boundary_forcing_coverage_tolerance', trials: checked, violations };
}

// ---------- P6: buildArtifact_never_throws (D6-ANYKERNEL-1115) ----------
function deepObj(n) { let o = JSON.parse('{}'); const r = o; for (let i = 0; i < n; i++) { o.x = {}; o = o.x; } return r; }
async function checkP6_buildArtifactNeverThrows() {
  const cases = [
    ['1e300', 1e300], ['NaN', NaN], ['-Infinity', -Infinity],
    ['depth511', deepObj(511)], ['depth600', deepObj(600)],
    ['array>1e6', new Array(1_000_001).fill(1)],
  ];
  const detail = [];
  let violations = 0;
  for (const [name, junk] of cases) {
    let a = null, threw = null;
    try { a = await buildArtifact({ reserve_proof: junk }); }
    catch (e) { threw = e.name + ': ' + String(e.message).slice(0, 80); }
    if (threw) { violations++; detail.push(`${name}: THROW ${threw}`); continue; }
    const h = a?.execution_hash ?? null;
    const ref = JSON.stringify(a ?? {}).includes('hash_refusal');
    detail.push(`${name}: hash=${h === null ? 'null' : 'set'} refusal=${ref}`);
    if (name !== 'depth511' && !(h === null && ref)) violations++;
  }
  return { name: 'P6_buildArtifact_never_throws', trials: cases.length, violations, detail };
}

// ---------- P7: required_fields_never_positive ----------
function checkP7_requiredFieldsNeverPositive() {
  const fields = ['reserve_proof', 'liability_branch', 'published_reserve_figures'];
  const modes = ['delete', 'null', 'empty', 'whitespace'];
  const fixtures = JSON.parse(readFileSync(FIXTURES_PATH, 'utf8'));
  let violations = 0, checked = 0;
  for (const v of fixtures.vectors) {
    if (compute(v.policy_parameters).output_payload.overall_determination !== 'CONSISTENT') continue;
    for (const f of fields) for (const m of modes) {
      const c = structuredClone(v.policy_parameters);
      if (m === 'delete') delete c[f];
      else if (m === 'null') c[f] = null;
      else if (m === 'empty') c[f] = '';
      else c[f] = '   ';
      const { output_payload: o } = compute(c);
      checked++;
      if (o.overall_determination === 'CONSISTENT' || o.findings.some((x) => x.verdict === 'CONSISTENT')) violations++;
    }
  }
  return { name: 'P7_required_fields_never_positive', trials: checked, violations };
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
results.properties.push(await checkP6_buildArtifactNeverThrows());
results.properties.push(checkP7_requiredFieldsNeverPositive());

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
