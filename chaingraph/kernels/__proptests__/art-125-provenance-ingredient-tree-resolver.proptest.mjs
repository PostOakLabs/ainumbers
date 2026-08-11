// art-125-provenance-ingredient-tree-resolver.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C3-1).
// kernel_digest_at_authoring: sha256:7bae0dc529d7955478c147173fb20c3a752a9964162b83434abc62521887e527
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (string-prefix + presence checks, integer array-length counting only).
// Checks: fixture-oracle gate, termination (edges/broken_edges/depth bounded by ingredients
// array length), differential re-derivation of resolved/tree_intact from the field-presence
// booleans, and metamorphic permutation-invariance of the ingredients array (order never changes
// which ingredients resolve or the tree_intact verdict).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-125-provenance-ingredient-tree-resolver.proptest.mjs

import { compute } from '../art-125-provenance-ingredient-tree-resolver.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

async function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-125-provenance-ingredient-tree-resolver.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = await compute(vec.policy_parameters);
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
const rand = mulberry32(0x125C5);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function maybe(rng, v, p = 0.7) { return rng() < p ? v : undefined; }

function randomIngredient(rng, i) {
  return {
    label: 'c2pa.ingredient',
    hashed_uri: maybe(rng, `self#jumbf=c2pa/${i}`),
    nested_manifest_hash: pick(rng, [`sha256:${'a'.repeat(8)}${i}`, 'md5:notallowed', undefined]),
    relationship: pick(rng, ['parentOf', 'componentOf']),
    redacted: pick(rng, [true, false, undefined]),
  };
}

function randomPP(rng) {
  const n = Math.floor(rng() * 8);
  return {
    active_manifest_hash: pick(rng, [`sha256:${'b'.repeat(10)}`, 'not-sha256', undefined]),
    ingredients: Array.from({ length: n }, (_, i) => randomIngredient(rng, i)),
  };
}

const TRIALS = 5000;

// ---------- P1: termination — edges/broken_edges/depth bounded by ingredients.length ----------
async function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = await compute(pp);
    checked++;
    if (output_payload.depth !== pp.ingredients.length) violations++;
    if (output_payload.edges.length !== pp.ingredients.length) violations++;
    if (output_payload.broken_edges.length > pp.ingredients.length) violations++;
  }
  return { name: 'P1_termination_bounded_by_ingredients_length', trials: checked, violations };
}

// ---------- P2 (differential): resolved/tree_intact re-derivation ----------
async function checkP2_resolved_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = await compute(pp);
    checked++;
    const root_ok = typeof pp.active_manifest_hash === 'string' && pp.active_manifest_hash.startsWith('sha256:');
    if (output_payload.root_ok !== root_ok) violations++;
    let expBroken = 0;
    output_payload.edges.forEach((edge, idx) => {
      const ing = pp.ingredients[idx];
      const has_binding = typeof ing.hashed_uri === 'string' && ing.hashed_uri.length > 0;
      const has_nested = typeof ing.nested_manifest_hash === 'string' && ing.nested_manifest_hash.startsWith('sha256:');
      const redacted = ing.redacted === true;
      const expResolved = redacted ? true : (has_binding && has_nested);
      if (edge.resolved !== expResolved) violations++;
      if (!expResolved) expBroken++;
    });
    if (output_payload.broken_edges.length !== expBroken) violations++;
    const expTreeIntact = root_ok && output_payload.broken_edges.length === 0;
    if (output_payload.tree_intact !== expTreeIntact) violations++;
  }
  return { name: 'P2_resolved_and_tree_intact_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — permutation-invariance of ingredients order ----------
async function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const n = Math.floor(rand() * 8);
    const pp = { active_manifest_hash: `sha256:${'c'.repeat(10)}`, ingredients: Array.from({ length: n }, (_, i) => randomIngredient(rand, i)) };
    const shuffledPp = { ...pp, ingredients: shuffle(rand, pp.ingredients) };
    const r1 = (await compute(pp)).output_payload;
    const r2 = (await compute(shuffledPp)).output_payload;
    checked++;
    if (r1.tree_intact !== r2.tree_intact) violations++;
    if (r1.depth !== r2.depth) violations++;
    const resolvedSet = (r) => r.edges.map((e) => e.resolved).sort();
    if (JSON.stringify(resolvedSet(r1)) !== JSON.stringify(resolvedSet(r2))) violations++;
  }
  return { name: 'P3_permutation_invariance_ingredients', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = await runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(await checkP1_termination());
results.properties.push(await checkP2_resolved_differential());
results.properties.push(await checkP3_permutation_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-125-provenance-ingredient-tree-resolver',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
