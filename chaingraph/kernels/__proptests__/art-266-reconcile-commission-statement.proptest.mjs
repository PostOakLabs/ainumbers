// art-266-reconcile-commission-statement.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C8-1).
// kernel_digest_at_authoring: sha256:d648555778e4cc13b038fe1a93fb7fe4325cb249ee3196abf2129e00853ff899
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny — blanket
// class-C Dafny stays frozen. float_sensitive: YES (expected = gross*rate*split with a guarded /expected
// division for diff_pct, ULP-forced below). Checks: fixture-oracle gate, termination (line_results
// exactly statement_lines.length), boundedness (expected_commission finite, discrepancy_pct >= 0),
// ULP-boundary forcing (expected exactly zero -> 999 sentinel guard, negative-zero premium, denormal
// premium, tolerance boundary tie), and a metamorphic permutation-invariance check on
// total_expected/total_stated (statement_lines order must not change the aggregate totals).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-266-reconcile-commission-statement.proptest.mjs

import { compute } from '../art-266-reconcile-commission-statement.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-266-reconcile-commission-statement.fixtures.json');
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
const rand = mulberry32(0x266A0);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

const TRIALS = 5000;

function randomLine(rng, i) {
  const gross_premium = randRange(rng, 100, 100000);
  const commission_rate_pct = randRange(rng, 1, 20);
  const split_pct = randRange(rng, 10, 100);
  const expected = gross_premium * (commission_rate_pct / 100) * (split_pct / 100);
  const stated_commission = expected * randRange(rng, 0.9, 1.1);
  return { agent_id: 'AGT' + i, gross_premium, commission_rate_pct, split_pct, stated_commission };
}

// ---------- P1: termination — line_results exactly statement_lines.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 300; i++) {
    const n = Math.floor(randRange(rand, 0, 200));
    const statement_lines = Array.from({ length: n }, (_, j) => randomLine(rand, j));
    const output_payload = compute({ statement_lines, tolerance_pct: 1 });
    checked++;
    if (output_payload.line_results.length !== n) violations++;
    if (output_payload.line_count !== n) violations++;
  }
  return { name: 'P1_termination_bounded_by_line_count', trials: checked, violations };
}

// ---------- P2: boundedness — expected_commission finite, discrepancy_pct >= 0 ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(randRange(rand, 0, 15));
    const statement_lines = Array.from({ length: n }, (_, j) => randomLine(rand, j));
    const output_payload = compute({ statement_lines, tolerance_pct: randRange(rand, 0, 5) });
    checked++;
    if (!Number.isFinite(output_payload.total_expected) || !Number.isFinite(output_payload.total_stated)) violations++;
    if (output_payload.discrepancy_pct < 0) violations++;
    for (const l of output_payload.line_results) {
      if (!Number.isFinite(l.expected_commission)) violations++;
      if (l.discrepancy_pct < 0) violations++;
    }
  }
  return { name: 'P2_boundedness_finite_and_nonneg_discrepancy', trials: checked, violations };
}

// ---------- P3: differential — has_discrepancy re-derived from total_discrepancy_pct vs tolerance_pct ----------
function checkP3_discrepancy_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(randRange(rand, 0, 15));
    const tolerance_pct = randRange(rand, 0, 5);
    const statement_lines = Array.from({ length: n }, (_, j) => randomLine(rand, j));
    const output_payload = compute({ statement_lines, tolerance_pct });
    checked++;
    const expected = output_payload.discrepancy_pct > tolerance_pct;
    if (output_payload.has_discrepancy !== expected) violations++;
  }
  return { name: 'P3_has_discrepancy_differential', trials: checked, violations };
}

// ---------- P4 (ULP-forcing, float_sensitive:yes) ----------
const ULP_BOUNDARY_CASES = [
  { label: 'expected exactly zero (gross_premium=0) -> guarded diff_pct sentinel', statement_lines: [{ agent_id: 'A', gross_premium: 0, commission_rate_pct: 10, split_pct: 100, stated_commission: 50 }] },
  { label: 'expected zero, stated also zero -> diff_pct 0 not 999', statement_lines: [{ agent_id: 'A', gross_premium: 0, commission_rate_pct: 10, split_pct: 100, stated_commission: 0 }] },
  { label: 'negative-zero gross_premium', statement_lines: [{ agent_id: 'A', gross_premium: -0, commission_rate_pct: 10, split_pct: 100, stated_commission: 0 }] },
  { label: 'denormal gross_premium', statement_lines: [{ agent_id: 'A', gross_premium: Number.MIN_VALUE, commission_rate_pct: 10, split_pct: 100, stated_commission: 0 }] },
  { label: 'discrepancy_pct exactly at tolerance_pct boundary (1.0 == 1.0, within)', statement_lines: [{ agent_id: 'A', gross_premium: 10000, commission_rate_pct: 10, split_pct: 100, stated_commission: 1010 }], tolerance_pct: 1 },
  { label: '0.1+0.2 style rounding across three lines', statement_lines: [{ agent_id: 'A', gross_premium: 0.1, commission_rate_pct: 100, split_pct: 100, stated_commission: 0.1 }, { agent_id: 'B', gross_premium: 0.2, commission_rate_pct: 100, split_pct: 100, stated_commission: 0.2 }] },
  { label: 'no statement lines at all', statement_lines: [] },
];
function checkP4_forced() {
  const rows = [];
  for (const c of ULP_BOUNDARY_CASES) {
    const output_payload = compute({ tolerance_pct: 1, ...c });
    const allFinite = Number.isFinite(output_payload.total_expected) && Number.isFinite(output_payload.total_stated) && Number.isFinite(output_payload.discrepancy_pct) && output_payload.line_results.every((l) => Number.isFinite(l.expected_commission) && Number.isFinite(l.discrepancy_pct));
    rows.push({ label: c.label, discrepancy_pct: output_payload.discrepancy_pct, has_discrepancy: output_payload.has_discrepancy, finite: allFinite });
  }
  return rows;
}

// ---------- P5: metamorphic — permutation-invariance of total_expected/total_stated under line reorder ----------
function checkP5_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const n = 1 + Math.floor(randRange(rand, 0, 25));
    const statement_lines = Array.from({ length: n }, (_, j) => randomLine(rand, j));
    const shuffled = statement_lines.slice();
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const r1 = compute({ statement_lines, tolerance_pct: 1 });
    const r2 = compute({ statement_lines: shuffled, tolerance_pct: 1 });
    checked++;
    const tol = Math.max(0.02, Math.abs(r1.total_expected) * 1e-6 * n);
    if (Math.abs(r1.total_expected - r2.total_expected) > tol) violations++;
    if (Math.abs(r1.total_stated - r2.total_stated) > tol) violations++;
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
results.properties.push(checkP3_discrepancy_differential());
results.properties.push(checkP5_permutation_invariance());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryMismatch = results.boundary_forced.some((b) => !b.finite);

console.log(JSON.stringify({
  tool_id: 'art-266-reconcile-commission-statement',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);
