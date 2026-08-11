// art-459-sod-matrix-check.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C21-1).
// kernel_digest_at_authoring: sha256:991bda6ad22de1f56d310c7cfbe98b6a7a9e4fdace9805007b0cc161d05cd7cd
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — the entire kernel is pure Set/Map membership and
// string comparison over caller-declared user_id/role/reason_code strings; no arithmetic
// division, multiplication, or threshold compare on a floating quantity exists anywhere in
// compute()). Forced categorical boundary cases are used instead of ULP-forcing, per spec §3's
// float:no row.
// Checks: fixture-oracle gate, termination (bounded by assignments.length * O(roles^2) pairwise
// scan per user, no recursion), boundedness (conflict_count never exceeds the total possible
// pairs across all users; clean iff conflict_count===0), a permutation-invariance metamorphic
// identity (reordering assignments, and reordering roles within a single user's role list,
// leaves conflict_count/clean/users_with_conflicts unchanged), and forced categorical boundary
// cases (empty ruleset, empty assignments, self-pair role_a===role_b skipped from the ruleset,
// duplicate roles within one user's list collapsed via Set before pairing, a role pair declared
// in reverse order in the ruleset).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-459-sod-matrix-check.proptest.mjs

import { compute } from '../art-459-sod-matrix-check.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-459-sod-matrix-check.fixtures.json');
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
const rand = mulberry32(0x45900);

const ROLE_POOL = ['ap_clerk', 'ap_approver', 'gl_poster', 'gl_reconciler', 'vendor_master', 'payroll_admin', 'bank_admin'];

function randomRuleset(rng) {
  const n = Math.floor(rng() * 6);
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = ROLE_POOL[Math.floor(rng() * ROLE_POOL.length)];
    let b = ROLE_POOL[Math.floor(rng() * ROLE_POOL.length)];
    if (a === b) continue;
    out.push({ role_a: a, role_b: b, reason_code: `SOD_${i}` });
  }
  return out;
}

function randomAssignments(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const rn = 1 + Math.floor(rng() * 4);
    const roles = [];
    for (let j = 0; j < rn; j++) roles.push(ROLE_POOL[Math.floor(rng() * ROLE_POOL.length)]);
    out.push({ user_id: `u${i}`, roles });
  }
  return out;
}

function randomPP(rng) {
  const n = Math.floor(rng() * 10);
  return { ruleset_version: 'v1', conflict_ruleset: randomRuleset(rng), assignments: randomAssignments(rng, n) };
}

const TRIALS = 5000;

// ---------- P1: termination — bounded by assignments.length and pairwise role scan ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.users_evaluated !== pp.assignments.length) violations++;
  }
  const bigAssignments = [];
  for (let i = 0; i < 3000; i++) bigAssignments.push({ user_id: `u${i}`, roles: ROLE_POOL.slice() });
  const { output_payload: bigOut } = compute({ ruleset_version: 'v1', conflict_ruleset: randomRuleset(rand), assignments: bigAssignments });
  checked++;
  if (bigOut.users_evaluated !== 3000) violations++;
  if (!Number.isFinite(bigOut.conflict_count)) violations++;
  return { name: 'P1_termination_bounded_by_assignments_and_role_pairs', trials: checked, violations };
}

// ---------- P2: boundedness — conflict_count bounded by total possible pairs; clean<->0 conflicts ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    const maxPairs = pp.assignments.reduce((s, a) => {
      const roles = new Set((a.roles || []));
      const r = roles.size;
      return s + (r * (r - 1)) / 2;
    }, 0);
    if (o.conflict_count > maxPairs) violations++;
    if (o.clean !== (o.conflict_count === 0)) violations++;
    if (o.users_with_conflicts > o.users_evaluated) violations++;
  }
  return { name: 'P2_conflict_count_bounded_by_pairs_and_clean_consistency', trials: checked, violations };
}

// ---------- P3: metamorphic — permutation-invariance of assignments and per-user role order ----------
function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    if (pp.assignments.length < 2) continue;
    const shuffled = [...pp.assignments].map((a) => ({ ...a, roles: [...a.roles].reverse() }));
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const base = compute(pp).output_payload;
    const perm = compute({ ...pp, assignments: shuffled }).output_payload;
    checked++;
    if (base.conflict_count !== perm.conflict_count) violations++;
    if (base.clean !== perm.clean) violations++;
    if (base.users_with_conflicts !== perm.users_with_conflicts) violations++;
  }
  return { name: 'P3_permutation_invariance_of_assignments_and_roles', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception, per spec §3) ----------
function checkP4_categorical_boundaries() {
  let violations = 0, checked = 0;
  // empty ruleset -> no conflicts possible regardless of assignments
  const emptyRuleset = compute({ ruleset_version: 'v1', conflict_ruleset: [], assignments: [{ user_id: 'u1', roles: ['ap_clerk', 'ap_approver'] }] });
  checked++;
  if (emptyRuleset.output_payload.conflict_count !== 0 || !emptyRuleset.output_payload.clean) violations++;
  // empty assignments -> users_evaluated 0, clean true
  const emptyAssignments = compute({ ruleset_version: 'v1', conflict_ruleset: [{ role_a: 'a', role_b: 'b' }], assignments: [] });
  checked++;
  if (emptyAssignments.output_payload.users_evaluated !== 0 || !emptyAssignments.output_payload.clean) violations++;
  // self-pair role_a===role_b is skipped from ruleset entirely -> never a conflict
  const selfPair = compute({ ruleset_version: 'v1', conflict_ruleset: [{ role_a: 'x', role_b: 'x' }], assignments: [{ user_id: 'u1', roles: ['x'] }] });
  checked++;
  if (selfPair.output_payload.conflict_rules_evaluated !== 0) violations++;
  // duplicate roles within a user's list collapsed via Set -> a user with ['a','a'] has no pair
  const dupRoles = compute({ ruleset_version: 'v1', conflict_ruleset: [{ role_a: 'a', role_b: 'b' }], assignments: [{ user_id: 'u1', roles: ['a', 'a'] }] });
  checked++;
  if (dupRoles.output_payload.conflict_count !== 0) violations++;
  // rule declared in reverse order still matches (conflictKey is order-independent)
  const reverseRule = compute({ ruleset_version: 'v1', conflict_ruleset: [{ role_a: 'b', role_b: 'a' }], assignments: [{ user_id: 'u1', roles: ['a', 'b'] }] });
  checked++;
  if (reverseRule.output_payload.conflict_count !== 1) violations++;
  return { name: 'P4_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_permutation_invariance());
results.properties.push(checkP4_categorical_boundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-459-sod-matrix-check',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
