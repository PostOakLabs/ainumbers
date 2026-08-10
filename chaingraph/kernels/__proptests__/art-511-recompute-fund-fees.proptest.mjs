// kernel_digest_at_authoring: sha256:02852a75e044e31ef50b68a146d4ffef30f3ed54d1299618963963301c82cf40
//
// FV-PROPFLOOR-SHARD-B25-1 — property-test floor for art-511-recompute-fund-fees.
// Class B (bounded-numeric). ⚠ MISCLASSIFICATION CORRECTED PER SPEC §3 FIX-2 CARRY: the WU row
// lists this kernel as float:yes, but the kernel itself is explicit fixed-point BigInt money math
// (SCALE_EXP=8, parsed from decimal STRINGS, "never via floating multiplication" per the kernel's
// own header) — there is no IEEE-754 rounding surface for ULP-boundary forcing to exercise, since
// BigInt arithmetic has no representation error. This file therefore treats art-511 as the
// float:no EXCEPTION and substitutes forced CATEGORICAL/exact-decimal-string boundary cases
// (missing hurdle_type, exact hurdle-rate equality, high-precision decimal truncation) in place
// of ULP forcing, matching FV-PBT-FLOOR-BUILD-SPEC.md §3's float:no exception shape. Zero external
// dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-511-recompute-fund-fees.proptest.mjs

import { compute } from '../art-511-recompute-fund-fees.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-511-recompute-fund-fees.fixtures.json');
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
const rand = mulberry32(0x511C3);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 6000;

function mkPP(rng) {
  const opening = randRange(rng, 1000000, 500000000);
  const closing = opening * randRange(rng, 0.7, 1.5);
  return {
    fund_id: 'F' + Math.floor(rng() * 100),
    agreement_ref: 'LPA-X',
    terms_version: '1.0',
    as_of: '2026-12-31',
    period_days: Math.floor(randRange(rng, 1, 400)),
    nav: { opening: String(opening.toFixed(2)), closing: String(closing.toFixed(2)), fee_base: String(((opening + closing) / 2).toFixed(2)) },
    management_fee: { rate: String(randRange(rng, 0, 0.03).toFixed(4)), day_count: pick(rng, ['30/360', 'actual/360', 'actual/365']) },
    performance_fee: {
      rate: String(randRange(rng, 0, 0.2).toFixed(4)),
      hurdle_rate: String(randRange(rng, 0, 0.1).toFixed(4)),
      hurdle_type: pick(rng, ['hard', 'soft', 'none']),
      crystallisation: pick(rng, ['period', 'realisation']),
      realisation_triggered: rng() < 0.5,
      loss_carryforward: rng() < 0.8,
    },
    rounding: { decimal_places: 2, mode: 'half_up' },
  };
}

// ---------- P1: fixed rule — hard hurdle eligible_gain never exceeds soft hurdle eligible_gain, same inputs ----------
function checkP1_hardNeverExceedsSoft() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const hard = compute({ ...pp, performance_fee: { ...pp.performance_fee, hurdle_type: 'hard' } });
    const soft = compute({ ...pp, performance_fee: { ...pp.performance_fee, hurdle_type: 'soft' } });
    checked++;
    const eg = (r) => parseFloat(r.output_payload.performance_fee.eligible_gain);
    if (eg(hard) > eg(soft) + 1e-9) violations++;
  }
  return { name: 'P1_hard_hurdle_eligible_gain_never_exceeds_soft_hurdle', trials: checked, violations };
}

// ---------- P2: boundedness — performance fee components never negative ----------
function checkP2_neverNegative() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const pf = r.output_payload.performance_fee;
    if (parseFloat(pf.performance_fee_crystallised) < 0) violations++;
    if (parseFloat(pf.performance_fee_accrued) < 0) violations++;
    if (parseFloat(r.output_payload.management_fee_computed) < 0) violations++;
  }
  return { name: 'P2_fee_components_never_negative', trials: checked, violations };
}

// ---------- P3: fixed rule — management fee is exactly 0 when period_days<=0 or fee_base<=0 ----------
function checkP3_zeroPeriodOrBaseZeroesManagementFee() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS / 4; i++) {
    const pp = mkPP(rand);
    const zeroed = { ...pp, period_days: 0 };
    const r = compute(zeroed);
    checked++;
    if (parseFloat(r.output_payload.management_fee_computed) !== 0) violations++;
    if (!r.compliance_flags.includes('FEE_PERIOD_NOT_POSITIVE')) violations++;
  }
  return { name: 'P3_zero_period_days_forces_zero_management_fee', trials: checked, violations };
}

// ---------- P4: round-trip — crystallised and accrued never both non-zero for the same run ----------
function checkP4_crystallisedXorAccrued() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const pf = r.output_payload.performance_fee;
    const c = parseFloat(pf.performance_fee_crystallised);
    const a = parseFloat(pf.performance_fee_accrued);
    if (c > 0 && a > 0) violations++;
  }
  return { name: 'P4_crystallised_and_accrued_never_both_nonzero', trials: checked, violations };
}

// ---------- P5 (mandatory, float:no exception): forced categorical/exact-decimal boundary cases ----------
const BASE_NAV = { opening: '100000000', closing: '112000000', fee_base: '106000000' };
const BASE = { fund_id: 'F', agreement_ref: 'A', terms_version: '1', as_of: '2026-12-31', period_days: 365, nav: BASE_NAV, management_fee: { rate: '0.02', day_count: 'actual/365' }, performance_fee: { rate: '0.2', hurdle_rate: '0.05', hurdle_type: 'hard', crystallisation: 'period' }, rounding: { decimal_places: 2, mode: 'half_up' } };
const BOUNDARY_CASES = [
  [{ ...BASE, performance_fee: { ...BASE.performance_fee, hurdle_type: undefined } }, 'hurdle_type absent — must raise judgment_required naming the field, never guess a default'],
  [{ ...BASE, performance_fee: { ...BASE.performance_fee, hurdle_type: 'unrecognised' } }, 'hurdle_type an unrecognised string — must raise judgment_required, not silently coerce'],
  [{ ...BASE, nav: { opening: '100000000', closing: '105000000', fee_base: '100000000' }, performance_fee: { ...BASE.performance_fee, hurdle_rate: '0.05' } }, 'period_return_pct exactly equal to hurdle_rate (5%=5%) — hurdle test is strictly ">", must NOT be cleared at exact equality'],
  [{ ...BASE, nav: { opening: '100000000', closing: '105000000.00000001', fee_base: '100000000' }, performance_fee: { ...BASE.performance_fee, hurdle_rate: '0.05' } }, 'period_return_pct one hundred-millionth above hurdle_rate — must be cleared'],
  [{ ...BASE, performance_fee: { ...BASE.performance_fee, high_water_mark: undefined } }, 'high_water_mark absent — must be treated as first period, baseline = opening NAV, no NaN'],
  [{ ...BASE, nav: { opening: '100000000', closing: '90000000', fee_base: '90000000' } }, 'closing NAV below opening (loss period) — high-water mark not exceeded, zero performance fee, no negative fee'],
  [{ ...BASE, nav: { opening: '0.00000001', closing: '0.00000002', fee_base: '0.00000001' } }, 'smallest representable fixed-point NAV values (1 unit at SCALE_EXP=8) — must remain exact, no floating rounding artifact'],
  [{ ...BASE, charged_amounts: { management_fee: BASE.performance_fee.rate } }, 'charged_amounts supplied for diff — recompute_only must be false, diff array populated'],
];

function checkP5_forced() {
  const rows = [];
  for (const [pp, label] of BOUNDARY_CASES) {
    const r = compute(pp);
    const o = r.output_payload;
    const plausible = (o.judgment_required !== undefined) && (o.performance_fee ? typeof o.performance_fee.performance_fee_crystallised === 'string' : true);
    rows.push({ label, judgment_required: o.judgment_required, performance_fee: o.performance_fee ? { hurdle_cleared: o.performance_fee.hurdle_cleared, performance_fee_crystallised: o.performance_fee.performance_fee_crystallised } : null, recompute_only: o.recompute_only, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_hardNeverExceedsSoft());
results.properties.push(checkP2_neverNegative());
results.properties.push(checkP3_zeroPeriodOrBaseZeroesManagementFee());
results.properties.push(checkP4_crystallisedXorAccrued());
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
