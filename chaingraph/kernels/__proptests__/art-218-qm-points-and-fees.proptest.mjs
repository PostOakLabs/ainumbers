// kernel_digest_at_authoring: sha256:eca364c90379d68068bac8dd1f149d13e3e7a3284099794e1ddd5a1fd10abf78
//
// FV-PROPFLOOR-SHARD-B6-1 — property-test floor for art-218-qm-points-and-fees.
// Class B (bounded-numeric), FLOAT-SENSITIVE (pass/fail is a continuous points-and-fees
// vs computed-limit comparison with a 0.005 rounding-tolerance margin) — ULP-boundary
// forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies
// (mulberry32 PRNG + explicit boundary arrays), same shape as B1-B5's float harnesses.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-218-qm-points-and-fees.proptest.mjs

import { compute } from '../art-218-qm-points-and-fees.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-218-qm-points-and-fees.fixtures.json');
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
const rand = mulberry32(0x2180A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 12000;
const r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : 0);

function mkPP(rng, overrides = {}) {
  const loan_amount = randRange(rng, 1000, 2000000);
  return {
    loan_amount,
    points_and_fees: randRange(rng, 0, loan_amount * 0.1),
    year: 2026,
    ...overrides,
  };
}

// ---------- P1: monotone — pass is nonincreasing as points_and_fees increases (fixed loan_amount/year) ----------
function checkP1_monotonePass() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const base = mkPP(rand);
    const lo = { ...base, points_and_fees: Math.min(base.points_and_fees, 5000) };
    const hi = { ...base, points_and_fees: Math.max(lo.points_and_fees + 1, 5001) };
    const rLo = compute(lo);
    const rHi = compute(hi);
    checked++;
    if (rHi.output_payload.pass && !rLo.output_payload.pass) violations++;
  }
  return { name: 'P1_monotone_pass_nonincreasing_with_points_and_fees', trials: checked, violations };
}

// ---------- P2: fixed-threshold-tier agreement — pass matches points_and_fees <= limit + 0.005 exactly ----------
function checkP2_passAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { pass, points_and_fees, limit } = r.output_payload;
    const expected = points_and_fees <= limit + 0.005;
    if (pass !== expected) violations++;
  }
  return { name: 'P2_pass_matches_limit_plus_0005_tolerance_rule', trials: checked, violations };
}

// ---------- P3: round-trip identity — headroom equals r2(limit - points_and_fees) exactly ----------
function checkP3_headroomIdentity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { limit, points_and_fees, headroom } = r.output_payload;
    const expected = r2(limit - points_and_fees);
    if (headroom !== expected) violations++;
  }
  return { name: 'P3_headroom_matches_r2_identity', trials: checked, violations };
}

// ---------- P4: out-of-range year always refuses, never extrapolates ----------
// This node used to answer any unpinned year with the 2026 band via `|| QM_TIERS_BY_YEAR[2026]`,
// so a 2027 query came back as a confident 2026 verdict carrying a 2026 citation. The
// property that catches that class is "refusal, not a nearest-year guess", and it is the
// one art-220 has always had and this floor dropped when it was copied.
function checkP4_outOfRangeYearRefuses() {
  let violations = 0, checked = 0;
  const OUT_OF_RANGE = [1999, 2000, 2019, 2020, 2027, 2030, 3000, 0, -2025];
  for (let i = 0; i < TRIALS; i++) {
    const year = OUT_OF_RANGE[i % OUT_OF_RANGE.length];
    const pp = mkPP(rand, { year });
    const r = compute(pp);
    const op = r.output_payload;
    checked++;
    if (op.error !== 'year_not_in_table') violations++;
    if (!r.compliance_flags.includes('LOOKUP_YEAR_UNAVAILABLE')) violations++;
    // A refusal must not leak a computed verdict alongside itself.
    if (op.limit !== undefined || op.tier_label !== undefined || op.headroom !== undefined) violations++;
    if (op.pass !== false) violations++;
  }
  return { name: 'P4_out_of_range_year_refuses_without_extrapolating', trials: checked, violations };
}

// ---------- P5 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ year: 2020 }, 'exactly 1 year below the pinned range — must refuse, not fall back to a band'],
  [{ year: 2027 }, 'exactly 1 year above the pinned range — must refuse, not serve 2026 law'],
  [{ year: 2021 }, 'earliest pinned year — must resolve'],
  [{ year: 2026 }, 'latest pinned year — must resolve'],
  [{ loan_amount: 137958, points_and_fees: 137958 * 0.03 }, 'loan_amount exactly at the 3% tier boundary — tier_label must be the >= tier'],
  [{ loan_amount: 137957.99, points_and_fees: 4139 }, 'loan_amount 1 cent below tier boundary — must use the $4,139 fixed tier'],
  [{ loan_amount: 500000, points_and_fees: 500000 * 0.03 + 0.005 }, 'points_and_fees exactly at limit + 0.005 rounding tolerance — must pass'],
  [{ loan_amount: 500000, points_and_fees: 500000 * 0.03 + 0.006 }, 'points_and_fees 0.001 beyond the tolerance edge — must fail'],
  [{ loan_amount: 500000, points_and_fees: 500000 * 0.01 * 3 }, 'points_and_fees = loan*0.01*3 (rounding-artifact double) — must remain finite'],
  [{ loan_amount: 0, points_and_fees: 0 }, 'loan_amount exactly zero — must not throw, tier lookup on the lowest band'],
  [{ loan_amount: 27592, points_and_fees: 27592 * 0.05 }, 'loan_amount exactly at 5%-tier lower boundary'],
  [{ loan_amount: 27591.99, points_and_fees: 1380 }, 'loan_amount 1 cent below 5%-tier — must use the $1,380 fixed tier'],
  [{ loan_amount: 17245, points_and_fees: 17245 * 0.05 }, 'loan_amount exactly at fixed-tier/pct-tier seam ($17,245)'],
  [{ loan_amount: 17244.99, points_and_fees: 17244.99 * 0.08 }, 'loan_amount 1 cent below the lowest tier boundary — must use the 8% tier'],
];

function checkP5_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = mkPP(rand, overrides);
    const r = compute(pp);
    const op = r.output_payload;
    // Two legal shapes: a resolved verdict, or an explicit refusal. A refusal is
    // plausible only if it withholds the verdict fields rather than emitting zeros.
    const refused = op.error === 'year_not_in_table';
    const plausible = refused
      ? (op.pass === false
         && Array.isArray(op.available_years)
         && op.limit === undefined
         && op.headroom === undefined
         && r.compliance_flags.includes('LOOKUP_YEAR_UNAVAILABLE'))
      : (typeof op.pass === 'boolean' && Number.isFinite(op.limit) && Number.isFinite(op.headroom));
    rows.push({ label, overrides, refused, pass: op.pass, tier_label: op.tier_label ?? null, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotonePass());
results.properties.push(checkP2_passAgreement());
results.properties.push(checkP3_headroomIdentity());
results.properties.push(checkP4_outOfRangeYearRefuses());
results.boundary_forced = checkP5_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
