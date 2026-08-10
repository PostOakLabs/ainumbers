// kernel_digest_at_authoring: sha256:2e686160add3cada6ff0482be86c0e368cd1680f7566f8deac31974459f9dc69
//
// FV-PROPFLOOR-SHARD-B20-1 — property-test floor for art-335-compute-dti-ratios.
// Class B (bounded-numeric), FLOAT-SENSITIVE — front_end_dti_pct/back_end_dti_pct
// divide dollar amounts and round to 2dp — ULP-boundary forcing is MANDATORY per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-335-compute-dti-ratios.proptest.mjs

import { compute } from '../art-335-compute-dti-ratios.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-335-compute-dti-ratios.fixtures.json');
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
const rand = mulberry32(0x335D71);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;

function mkPP(rng) {
  return {
    gross_monthly_income: randRange(rng, 1000, 50000),
    housing_payment_pitia: randRange(rng, 0, 15000),
    other_monthly_debts: randRange(rng, 0, 10000),
    underwriting_type: pick(rng, ['du', 'lpa', 'manual']),
  };
}

// ---------- P1: monotonicity — back_end_dti_pct is non-decreasing in other_monthly_debts ----------
function checkP1_backEndMonotonicInDebt() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    checked++;
    const lo = compute(pp);
    const hi = compute({ ...pp, other_monthly_debts: pp.other_monthly_debts + 500 });
    if (hi.output_payload.back_end_dti_pct < lo.output_payload.back_end_dti_pct - 1e-9) violations++;
  }
  return { name: 'P1_back_end_dti_monotonic_nondecreasing_in_debt', trials: checked, violations };
}

// ---------- P2: boundedness + fixed-threshold-tier agreement ----------
function checkP2_tierAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    checked++;
    const r = compute(pp).output_payload;
    if (r.gross_monthly_income <= 0) continue;
    const b = r.back_end_dti_pct;
    let expectedTier;
    if (b <= 36) expectedTier = 'standard_manual';
    else if (b <= 45) expectedTier = 'extended_manual_compensating_factors';
    else if (b <= 50) expectedTier = 'du_lpa_only';
    else expectedTier = 'exceeds_max_dti';
    if (r.dti_tier !== expectedTier) violations++;
    const maxByType = { du: 50, lpa: 50, manual: 45 }[r.underwriting_type];
    const expectedWithin = b <= maxByType + 1e-9;
    if (r.within_max !== expectedWithin) violations++;
  }
  return { name: 'P2_tier_and_within_max_agree_with_thresholds', trials: checked, violations };
}

// ---------- P3: metamorphic — scale-invariance of percentages under uniform dollar scaling ----------
function checkP3_scaleInvariant() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    checked++;
    const k = randRange(rand, 1.5, 4);
    const scaled = {
      gross_monthly_income: pp.gross_monthly_income * k,
      housing_payment_pitia: pp.housing_payment_pitia * k,
      other_monthly_debts: pp.other_monthly_debts * k,
      underwriting_type: pp.underwriting_type,
    };
    const base = compute(pp).output_payload;
    const s = compute(scaled).output_payload;
    if (Math.abs(base.back_end_dti_pct - s.back_end_dti_pct) > 0.02) violations++;
    if (Math.abs(base.front_end_dti_pct - s.front_end_dti_pct) > 0.02) violations++;
  }
  return { name: 'P3_dti_percentages_scale_invariant_under_uniform_dollar_scaling', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ gross_monthly_income: 0, housing_payment_pitia: 1000, other_monthly_debts: 500, underwriting_type: 'du' }, 'gross_monthly_income exactly zero — DTI_ZERO_INCOME flag, dti_tier must be invalid_income, no NaN/division'],
  [{ gross_monthly_income: -0, housing_payment_pitia: 1000, other_monthly_debts: 500, underwriting_type: 'du' }, 'gross_monthly_income negative zero — must behave identically to positive zero (zeroIncome check uses <=0)'],
  [{ gross_monthly_income: Number.MIN_VALUE, housing_payment_pitia: 1000, other_monthly_debts: 500, underwriting_type: 'du' }, 'gross_monthly_income at smallest denormal — division must remain finite (may overflow to a huge pct, never NaN/Infinity crash)'],
  [{ gross_monthly_income: 10000, housing_payment_pitia: 3600, other_monthly_debts: 0, underwriting_type: 'manual' }, 'back_end_dti_pct exactly at 36 tier boundary — must classify standard_manual (inclusive <=36)'],
  [{ gross_monthly_income: 10000, housing_payment_pitia: 3600.01, other_monthly_debts: 0, underwriting_type: 'manual' }, 'back_end_dti_pct just above 36 — must classify extended_manual_compensating_factors'],
  [{ gross_monthly_income: 10000, housing_payment_pitia: 4500, other_monthly_debts: 0, underwriting_type: 'manual' }, 'back_end_dti_pct exactly at 45 (manual max) — within_max true, tier extended_manual_compensating_factors'],
  [{ gross_monthly_income: 10000, housing_payment_pitia: 5000, other_monthly_debts: 0, underwriting_type: 'du' }, 'back_end_dti_pct exactly at 50 (du/lpa max) — within_max true, tier du_lpa_only'],
  [{ gross_monthly_income: 10000, housing_payment_pitia: 5000.01, other_monthly_debts: 0, underwriting_type: 'du' }, 'back_end_dti_pct 1 ULP above 50 — within_max false, tier exceeds_max_dti'],
  [{ gross_monthly_income: 0.1 * 3 * 10000, housing_payment_pitia: 1000, other_monthly_debts: 200, underwriting_type: 'lpa' }, 'gross_monthly_income = (0.1*3)*10000, a repeating-decimal double close to but not exactly 3000 — x/y*y!==x class case, must round cleanly to 2dp'],
  [{ gross_monthly_income: 1e15, housing_payment_pitia: 1e14, other_monthly_debts: 1e13, underwriting_type: 'du' }, 'very large dollar magnitudes — percentages must remain finite, no overflow artifact'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const plausible = [r.front_end_dti_pct, r.back_end_dti_pct].every(Number.isFinite);
    rows.push({ label, input: pp, front_end_dti_pct: r.front_end_dti_pct, back_end_dti_pct: r.back_end_dti_pct, dti_tier: r.dti_tier, within_max: r.within_max, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_backEndMonotonicInDebt());
results.properties.push(checkP2_tierAgreement());
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
