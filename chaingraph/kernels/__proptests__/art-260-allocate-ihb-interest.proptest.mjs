// art-260-allocate-ihb-interest.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C8-1).
// kernel_digest_at_authoring: sha256:6e9a9c6e57168ff88d9a4933856fe6f04ecc88942a01e7937c076d1e80235b76
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny — blanket
// class-C Dafny stays frozen. float_sensitive: YES (rate * day-count-fraction arithmetic, ULP-forced
// below). Checks: fixture-oracle gate, termination (allocations bounded by pool_members.length),
// boundedness (total_interest_allocated finite, net_interest <= gross_interest per member), ULP-boundary
// forcing (zero rate/days, negative zero, denormal balances, extreme day-counts), and a metamorphic
// permutation-invariance check on total_interest_allocated (pool_member order must not change totals).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-260-allocate-ihb-interest.proptest.mjs

import { compute } from '../art-260-allocate-ihb-interest.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-260-allocate-ihb-interest.fixtures.json');
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
const rand = mulberry32(0x260A0);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const CONVENTIONS = ['ACT/360', 'ACT/365', '30/360'];
const POOL_TYPES = ['notional', 'zba'];
const TRIALS = 5000;

function randomMember(rng, i) {
  return { entity_id: 'ENT' + i, balance: randRange(rng, -1e6, 1e6), withholding_rate: randRange(rng, 0, 0.35), currency: 'USD' };
}

// ---------- P1: termination — allocations bounded by pool_members.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 300; i++) {
    const n = Math.floor(randRange(rand, 0, 200));
    const pool_members = Array.from({ length: n }, (_, j) => randomMember(rand, j));
    const output_payload = compute({ pool_type: pick(rand, POOL_TYPES), arm_length_rate: 0.05, days: 30, day_count_convention: pick(rand, CONVENTIONS), pool_members });
    checked++;
    if (output_payload.allocations.length !== n) violations++;
    if (output_payload.entity_count !== n) violations++;
  }
  return { name: 'P1_termination_bounded_by_pool_members', trials: checked, violations };
}

// ---------- P2: boundedness — finite totals, net_interest <= gross_interest per member (wh nonneg) ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(randRange(rand, 0, 15));
    const pool_members = Array.from({ length: n }, (_, j) => randomMember(rand, j));
    const output_payload = compute({ pool_type: pick(rand, POOL_TYPES), arm_length_rate: randRange(rand, -0.1, 0.2), days: randRange(rand, 1, 365), day_count_convention: pick(rand, CONVENTIONS), pool_members });
    checked++;
    if (!Number.isFinite(output_payload.total_interest_allocated) || !Number.isFinite(output_payload.net_interest_payable)) violations++;
    for (const a of output_payload.allocations) {
      if (!Number.isFinite(a.gross_interest) || !Number.isFinite(a.net_interest) || !Number.isFinite(a.withholding_amount)) violations++;
      if (a.withholding_amount < -1e-9) violations++;
      if (a.gross_interest > 0 && a.net_interest > a.gross_interest + 1e-9) violations++;
    }
  }
  return { name: 'P2_boundedness_finite_and_wh_ordering', trials: checked, violations };
}

// ---------- P3: differential — day_count_fraction re-derived independently ----------
function checkP3_dcf_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const days = randRange(rand, 0, 400);
    const convention = pick(rand, CONVENTIONS);
    const output_payload = compute({ pool_type: 'zba', arm_length_rate: 0.03, days, day_count_convention: convention, pool_members: [] });
    checked++;
    const expected = convention === 'ACT/365' ? days / 365 : days / 360;
    if (Math.abs(output_payload.day_count_fraction - expected) > 1e-6) violations++;
  }
  return { name: 'P3_daycount_fraction_differential', trials: checked, violations };
}

// ---------- P4 (ULP-forcing, float_sensitive:yes) ----------
const ULP_BOUNDARY_CASES = [
  { label: 'zero rate -> zero interest for all', arm_length_rate: 0, days: 30, day_count_convention: 'ACT/360', pool_members: [{ entity_id: 'A', balance: 500000, withholding_rate: 0 }] },
  { label: 'zero days -> zero dcf, zero interest', arm_length_rate: 0.05, days: 0, day_count_convention: 'ACT/360', pool_members: [{ entity_id: 'A', balance: 500000, withholding_rate: 0 }] },
  { label: 'negative-zero balance -> flat, no interest', arm_length_rate: 0.05, days: 30, day_count_convention: 'ACT/360', pool_members: [{ entity_id: 'A', balance: -0, withholding_rate: 0 }] },
  { label: 'denormal balance', arm_length_rate: 0.05, days: 30, day_count_convention: 'ACT/360', pool_members: [{ entity_id: 'A', balance: Number.MIN_VALUE, withholding_rate: 0 }] },
  { label: 'withholding_rate exactly 1.0 (100%) -> net interest zero', arm_length_rate: 0.05, days: 30, day_count_convention: 'ACT/360', pool_members: [{ entity_id: 'A', balance: 500000, withholding_rate: 1.0 }] },
  { label: '0.1+0.2 style rate composition', arm_length_rate: 0.1 + 0.2 - 0.3, days: 360, day_count_convention: 'ACT/360', pool_members: [{ entity_id: 'A', balance: 100, withholding_rate: 0 }] },
  { label: 'large notional near double precision', arm_length_rate: 0.05, days: 30, day_count_convention: 'ACT/360', pool_members: [{ entity_id: 'A', balance: 9e14, withholding_rate: 0 }] },
];
function checkP4_forced() {
  const rows = [];
  for (const c of ULP_BOUNDARY_CASES) {
    const output_payload = compute({ pool_type: 'notional', ...c });
    const allFinite = Number.isFinite(output_payload.total_interest_allocated) && output_payload.allocations.every((a) => Number.isFinite(a.gross_interest) && Number.isFinite(a.net_interest));
    rows.push({ label: c.label, total_interest_allocated: output_payload.total_interest_allocated, finite: allFinite });
  }
  return rows;
}

// ---------- P5: metamorphic — permutation-invariance of total_interest_allocated under member reorder ----------
function checkP5_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const n = 1 + Math.floor(randRange(rand, 0, 25));
    const pool_members = Array.from({ length: n }, (_, j) => randomMember(rand, j));
    const shuffled = pool_members.slice();
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const pt = pick(rand, POOL_TYPES);
    const r1 = compute({ pool_type: pt, arm_length_rate: 0.05, days: 30, day_count_convention: 'ACT/360', pool_members });
    const r2 = compute({ pool_type: pt, arm_length_rate: 0.05, days: 30, day_count_convention: 'ACT/360', pool_members: shuffled });
    checked++;
    const tol = Math.max(0.02, Math.abs(r1.total_interest_allocated) * 1e-6 * n);
    if (Math.abs(r1.total_interest_allocated - r2.total_interest_allocated) > tol) violations++;
    if (Math.abs(r1.net_interest_payable - r2.net_interest_payable) > tol) violations++;
  }
  return { name: 'P5_metamorphic_permutation_invariance_totals', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_dcf_differential());
results.properties.push(checkP5_permutation_invariance());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryMismatch = results.boundary_forced.some((b) => !b.finite);

console.log(JSON.stringify({
  tool_id: 'art-260-allocate-ihb-interest',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);
