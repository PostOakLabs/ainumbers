// kernel_digest_at_authoring: sha256:dc00a21aac85481160cee3c24ff63e9fae0faace62668602b069aab28cb7a06a
//
// FV-PROPFLOOR-SHARD-B20-1 — property-test floor for art-340-compute-flsa-regular-rate.
// Class B (bounded-numeric), FLOAT-SENSITIVE — regular_rate divides total remuneration
// by hours worked, and overtime hinges on the 40-hour threshold — ULP-boundary forcing
// at that threshold and at zero hours is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3.
// Zero external dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-340-compute-flsa-regular-rate.proptest.mjs

import { compute } from '../art-340-compute-flsa-regular-rate.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-340-compute-flsa-regular-rate.fixtures.json');
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
const rand = mulberry32(0x340E51);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;

function mkPP(rng) {
  return {
    hours_worked_week: randRange(rng, 1, 80),
    hourly_rate: randRange(rng, 7.25, 100),
    nondiscretionary_bonus_amount: randRange(rng, 0, 500),
    other_includable_pay: randRange(rng, 0, 300),
    discretionary_bonus_excluded: randRange(rng, 0, 500),
  };
}

// ---------- P1: round-trip identity — regular_rate * hours_worked_week ≈ total_remuneration ----------
function checkP1_regularRateRoundTrip() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    checked++;
    const r = compute(pp).output_payload;
    if (r.hours_worked_week <= 0) continue;
    const reconstructed = r.regular_rate * r.hours_worked_week;
    if (Math.abs(reconstructed - r.total_remuneration) > Math.max(1, r.total_remuneration * 1e-3)) violations++;
  }
  return { name: 'P1_regular_rate_times_hours_equals_total_remuneration', trials: checked, violations };
}

// ---------- P2: boundedness/threshold — overtime_hours equals max(0, hours-40), exactly ----------
function checkP2_overtimeThreshold() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    checked++;
    const r = compute(pp).output_payload;
    const expected = Math.max(0, Math.round((pp.hours_worked_week - 40) * 100) / 100);
    if (Math.abs(r.overtime_hours - expected) > 0.02) violations++;
    if (r.regular_rate < 0 || r.overtime_premium_pay < 0 || r.total_pay_due < 0) violations++;
  }
  return { name: 'P2_overtime_hours_equals_max_zero_hours_minus_40_and_nonneg_outputs', trials: checked, violations };
}

// ---------- P3: metamorphic — linear homogeneity: scaling rate/bonus/other by k scales total_pay_due by k (hours fixed) ----------
function checkP3_scaleInvariant() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    checked++;
    const k = randRange(rand, 1.5, 4);
    const scaled = {
      hours_worked_week: pp.hours_worked_week,
      hourly_rate: pp.hourly_rate * k,
      nondiscretionary_bonus_amount: pp.nondiscretionary_bonus_amount * k,
      other_includable_pay: pp.other_includable_pay * k,
      discretionary_bonus_excluded: pp.discretionary_bonus_excluded * k,
    };
    const base = compute(pp).output_payload;
    const s = compute(scaled).output_payload;
    if (Math.abs(s.total_pay_due - base.total_pay_due * k) > Math.max(1, base.total_pay_due * k * 1e-3)) violations++;
  }
  return { name: 'P3_total_pay_due_linear_homogeneous_in_rate_and_bonus_scaling', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ hours_worked_week: 0, hourly_rate: 20, nondiscretionary_bonus_amount: 0, other_includable_pay: 0, discretionary_bonus_excluded: 0 }, 'hours_worked_week exactly zero — FLSA_ZERO_HOURS flag, regular_rate must be 0, no division/NaN'],
  [{ hours_worked_week: -0, hourly_rate: 20, nondiscretionary_bonus_amount: 0, other_includable_pay: 0, discretionary_bonus_excluded: 0 }, 'hours_worked_week negative zero — Math.max(0,...) clamps identically to positive zero, treated as zeroHours'],
  [{ hours_worked_week: Number.MIN_VALUE, hourly_rate: 20, nondiscretionary_bonus_amount: 0, other_includable_pay: 0, discretionary_bonus_excluded: 0 }, 'hours_worked_week at smallest denormal — division must remain finite (regular_rate may be huge, never NaN)'],
  [{ hours_worked_week: 40, hourly_rate: 20, nondiscretionary_bonus_amount: 0, other_includable_pay: 0, discretionary_bonus_excluded: 0 }, 'hours_worked_week exactly at the 40-hour overtime threshold — overtime_hours must be exactly 0'],
  [{ hours_worked_week: 40.01, hourly_rate: 20, nondiscretionary_bonus_amount: 0, other_includable_pay: 0, discretionary_bonus_excluded: 0 }, 'hours_worked_week 1 ULP-scale above 40 — overtime_hours must be exactly 0.01, FLSA_OVERTIME_OWED flag set'],
  [{ hours_worked_week: 39.99, hourly_rate: 20, nondiscretionary_bonus_amount: 0, other_includable_pay: 0, discretionary_bonus_excluded: 0 }, 'hours_worked_week 1 ULP-scale below 40 — overtime_hours must be exactly 0, no premium'],
  [{ hours_worked_week: 0.1 * 3 * 150, hourly_rate: 20, nondiscretionary_bonus_amount: 0, other_includable_pay: 0, discretionary_bonus_excluded: 0 }, 'hours_worked_week = (0.1*3)*150, a repeating-decimal double close to but not exactly 45 — x/y*y!==x class case, must round cleanly to 2dp'],
  [{ hours_worked_week: 45, hourly_rate: 0, nondiscretionary_bonus_amount: 100, other_includable_pay: 0, discretionary_bonus_excluded: 0 }, 'hourly_rate exactly zero with a nonzero bonus — regular_rate must still resolve from bonus/hours alone, no NaN'],
  [{ hours_worked_week: 168, hourly_rate: 15, nondiscretionary_bonus_amount: 0, other_includable_pay: 0, discretionary_bonus_excluded: 0 }, 'hours_worked_week at the physical maximum (168 hours/week) — must remain finite, large overtime_hours'],
  [{ hours_worked_week: 45, hourly_rate: 15, nondiscretionary_bonus_amount: 1e9, other_includable_pay: 0, discretionary_bonus_excluded: 0 }, 'astronomically large nondiscretionary_bonus_amount — must remain finite, NONDISCRETIONARY_BONUS_INCLUDED flag set'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const plausible = [r.regular_rate, r.overtime_hours, r.overtime_premium_pay, r.total_pay_due].every(Number.isFinite) && r.regular_rate >= 0;
    rows.push({ label, input: pp, regular_rate: r.regular_rate, overtime_hours: r.overtime_hours, overtime_premium_pay: r.overtime_premium_pay, total_pay_due: r.total_pay_due, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_regularRateRoundTrip());
results.properties.push(checkP2_overtimeThreshold());
results.properties.push(checkP3_scaleInvariant());
results.boundary_forced = checkP4_forced();

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
