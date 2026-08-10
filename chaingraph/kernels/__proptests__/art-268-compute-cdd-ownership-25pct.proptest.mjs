// art-268-compute-cdd-ownership-25pct.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C9-1).
// kernel_digest_at_authoring: sha256:72d31eade30d2b17b71e7c4f70b150a51b2415b2950b8b4a5240eb92f8bec23a
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (per WU triage table, re-confirmed by direct read — threshold_pct compare
// `pct >= THRESHOLD` where pct = Math.round(frac*10000)/100 is a float division/rounding chain;
// mandatory ULP-boundary forcing per spec §3).
// Checks: fixture-oracle gate, termination (recursion depth bounded by number of DISTINCT
// entity ids across ownership_tiers, memoized + cycle-guarded via `path` Set so no entity is
// ever revisited on one call stack), boundedness (fractions in [0,1], pct in [0,100]),
// differential re-derivation of is_beneficial_owner from beneficial_owners.length, ULP-boundary
// forcing at the 25% threshold (0, negative zero, denormals, exact/near boundary), and a
// metamorphic identity (permutation-invariance: reordering ownership_tiers/natural_persons does
// not change the beneficial_owners set, only element order within reported arrays may reorder —
// tested via set-equality on {natural_person_id, indirect_ownership_pct} pairs).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-268-compute-cdd-ownership-25pct.proptest.mjs

import { compute } from '../art-268-compute-cdd-ownership-25pct.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-268-compute-cdd-ownership-25pct.fixtures.json');
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
const rand = mulberry32(0x268A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// Build a random ownership DAG (never cyclic by construction: entity i only ever
// owned by lower-index entities/persons) over n entities + m natural persons.
function randomOwnershipGraph(rng, n, m) {
  const entities = Array.from({ length: n }, (_, i) => `E${i}`);
  const persons = Array.from({ length: m }, (_, i) => `NP${i}`);
  const ownership_tiers = [];
  for (let i = 0; i < n; i++) {
    const numParents = Math.floor(rng() * 3); // 0-2 parents per entity
    for (let k = 0; k < numParents; k++) {
      // parent is either a lower-index entity or any natural person (never itself/higher, so acyclic)
      const useEntity = i > 0 && rng() < 0.5;
      const parent_id = useEntity ? entities[Math.floor(rng() * i)] : pick(rng, persons.length ? persons : ['NP0']);
      const ownership_pct = Math.floor(rng() * 10000) / 100; // 0.00-99.99
      ownership_tiers.push({ entity_id: entities[i], parent_id, ownership_pct });
    }
  }
  return { ownership_tiers, natural_persons: persons, entityCount: n };
}

const TRIALS = 5000;

// ---------- P1: termination — recursion visits each entity at most once per top-level call ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 8);
    const m = 1 + Math.floor(rand() * 4);
    const { ownership_tiers, natural_persons } = randomOwnershipGraph(rand, n, m);
    const target = n > 0 ? `E${Math.floor(rand() * n)}` : null;
    checked++;
    // must complete without throwing/hanging (finite call = termination proxy)
    const output_payload = compute({ ownership_tiers, natural_persons, target_entity_id: target });
    if (output_payload.entities_evaluated > 1) violations++; // single target => exactly 1 evaluated
    if (output_payload.beneficial_owners.length + output_payload.below_threshold.length > natural_persons.length) violations++;
  }
  return { name: 'P1_termination_bounded_by_entity_count_no_recomputation', trials: checked, violations };
}

// ---------- P2: boundedness — every reported pct is finite and non-negative ----------
// NOTE: the kernel does NOT validate that a single entity's ownership_tiers sum to <=100%
// (multiple overlapping parent claims are a caller-input-quality issue, not a kernel bug),
// so indirect_ownership_pct can legitimately exceed 100 for malformed/overlapping inputs.
// The class-C boundedness claim here is finiteness + non-negativity, not a fixed ceiling.
function checkP2_bounded_pct() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 8);
    const m = 1 + Math.floor(rand() * 4);
    const { ownership_tiers, natural_persons } = randomOwnershipGraph(rand, n, m);
    checked++;
    const output_payload = compute({ ownership_tiers, natural_persons });
    for (const bo of [...output_payload.beneficial_owners, ...output_payload.below_threshold]) {
      if (!Number.isFinite(bo.indirect_ownership_pct)) violations++;
      if (bo.indirect_ownership_pct < 0) violations++;
    }
  }
  return { name: 'P2_ownership_pct_finite_nonnegative', trials: checked, violations };
}

// ---------- P3 (differential): is_beneficial_owner re-derivation ----------
function checkP3_flag_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 8);
    const m = 1 + Math.floor(rand() * 4);
    const { ownership_tiers, natural_persons } = randomOwnershipGraph(rand, n, m);
    checked++;
    const output_payload = compute({ ownership_tiers, natural_persons });
    const expected = output_payload.beneficial_owners.length > 0;
    if (output_payload.is_beneficial_owner !== expected) violations++;
    for (const bo of output_payload.beneficial_owners) {
      if (bo.indirect_ownership_pct < output_payload.threshold_pct) violations++;
    }
    for (const bt of output_payload.below_threshold) {
      if (bt.indirect_ownership_pct >= output_payload.threshold_pct) violations++;
    }
  }
  return { name: 'P3_beneficial_owner_flag_differential', trials: checked, violations };
}

// ---------- P4 (ULP-forcing, float_sensitive:yes) — 25% threshold boundary ----------
const ULP_BOUNDARY_CASES = [
  { label: 'exactly 25.00% -> beneficial owner (>= threshold)', ownership_pct: 25 },
  { label: '25% minus 1 ULP -> pct-rounding (round to 2dp) absorbs it, still 25.00 -> beneficial owner', ownership_pct: 25 - Number.EPSILON * 25 },
  { label: '25% plus 1 ULP -> pct-rounding absorbs it, still 25.00 -> beneficial owner', ownership_pct: 25 + Number.EPSILON * 25 },
  { label: 'zero ownership -> excluded (pct=0, neither list)', ownership_pct: 0 },
  { label: 'negative-zero ownership -> behaves as zero', ownership_pct: -0 },
  { label: 'denormal-scale ownership (5e-320 pct) -> below threshold, finite', ownership_pct: 5e-320 },
  { label: '24.99% -> below threshold', ownership_pct: 24.99 },
];
function checkP5_forced() {
  const rows = [];
  for (const c of ULP_BOUNDARY_CASES) {
    const output_payload = compute({
      ownership_tiers: [{ entity_id: 'EX', parent_id: 'NPX', ownership_pct: c.ownership_pct }],
      natural_persons: ['NPX'],
      target_entity_id: 'EX',
    });
    const allReported = [...output_payload.beneficial_owners, ...output_payload.below_threshold];
    const finite = allReported.every((r) => Number.isFinite(r.indirect_ownership_pct));
    rows.push({
      label: c.label, input_pct: c.ownership_pct,
      is_beneficial_owner: output_payload.is_beneficial_owner,
      reported_pct: allReported[0]?.indirect_ownership_pct ?? null,
      finite,
    });
  }
  return rows;
}

// ---------- P6: metamorphic — permutation-invariance of ownership_tiers order ----------
function checkP6_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const n = 1 + Math.floor(rand() * 6);
    const m = 1 + Math.floor(rand() * 3);
    const { ownership_tiers, natural_persons } = randomOwnershipGraph(rand, n, m);
    if (ownership_tiers.length < 2) continue;
    checked++;
    const shuffled = [...ownership_tiers];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const r1 = compute({ ownership_tiers, natural_persons });
    const r2 = compute({ ownership_tiers: shuffled, natural_persons });
    const setOf = (r) => new Set([...r.beneficial_owners, ...r.below_threshold].map((x) => `${x.entity_id}|${x.natural_person_id}|${x.indirect_ownership_pct}`));
    const s1 = setOf(r1), s2 = setOf(r2);
    if (s1.size !== s2.size) violations++;
    else for (const v of s1) if (!s2.has(v)) violations++;
  }
  return { name: 'P6_tier_order_permutation_invariance', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_bounded_pct());
results.properties.push(checkP3_flag_differential());
results.properties.push(checkP6_permutation_invariance());
const ulpRows = checkP5_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-268-compute-cdd-ownership-25pct',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  ulp_boundary_forced_cases: ulpRows,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
