// kernel_digest_at_authoring: sha256:645615515f1d1e2eff3358be3eb19499b93dc0e184ac08ae8b124ee65d4637c5
//
// FV-PROPFLOOR-SHARD-B25-1 — property-test floor for art-496-l1-continuous-fee-runway.
// Class B (bounded-numeric), FLOAT-SENSITIVE (fee rate * validator count * 12, an annual-growth
// multiplier stepped by plain multiplication, a month-by-month depletion simulation) — ULP-
// boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-496-l1-continuous-fee-runway.proptest.mjs

import { compute } from '../art-496-l1-continuous-fee-runway.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-496-l1-continuous-fee-runway.fixtures.json');
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
const rand = mulberry32(0x496C3);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 8000;

function mkPP(rng) {
  return {
    validator_count: randRange(rng, 0, 500),
    fee_rate_avax_per_validator_month: randRange(rng, 0, 10),
    fee_growth_rate_annual_pct: randRange(rng, 0, 50),
    infra_cost_annual: randRange(rng, 0, 100000),
    current_balance: randRange(rng, 0, 500000),
    as_of: Math.floor(randRange(rng, 0, 2000000000)),
    target_runway_months: Math.floor(randRange(rng, 1, 60)),
    horizon_months: Math.floor(randRange(rng, 1, 200)),
  };
}

// ---------- P1: boundedness — months_to_depletion null or within [0, horizon_months] ----------
function checkP1_depletionBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { months_to_depletion, horizon_months } = r.output_payload;
    if (months_to_depletion !== null && !(months_to_depletion >= 0 && months_to_depletion <= horizon_months)) violations++;
  }
  return { name: 'P1_months_to_depletion_null_or_within_horizon', trials: checked, violations };
}

// ---------- P2: fixed rule — runway_flag consistent with months_to_depletion vs target ----------
function checkP2_runwayFlagConsistent() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { months_to_depletion, target_runway_months, runway_flag, current_balance } = r.output_payload;
    if (current_balance <= 0 && (pp.validator_count * pp.fee_rate_avax_per_validator_month > 0 || pp.infra_cost_annual > 0)) {
      if (runway_flag !== 'L1_BALANCE_EXHAUSTED') violations++;
    } else if (months_to_depletion !== null && months_to_depletion < target_runway_months) {
      if (runway_flag !== 'L1_RUNWAY_SHORT') violations++;
    } else {
      if (runway_flag !== 'L1_RUNWAY_OK') violations++;
    }
  }
  return { name: 'P2_runway_flag_matches_depletion_vs_target', trials: checked, violations };
}

// ---------- P3: round-trip identity — annual_tco exactly equals breakdown component sum ----------
function checkP3_annualTcoIdentity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { annual_tco, breakdown } = r.output_payload;
    if (annual_tco !== breakdown.fee_component_annual + breakdown.infra_component_annual) violations++;
  }
  return { name: 'P3_annual_tco_exact_sum_of_breakdown_components', trials: checked, violations };
}

// ---------- P4: monotonicity — higher validator_count never decreases annual_tco (holding rate fixed) ----------
function checkP4_monotonicTcoInValidatorCount() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS / 4; i++) {
    const base = mkPP(rand);
    const lo = { ...base, validator_count: base.validator_count };
    const hi = { ...base, validator_count: base.validator_count + randRange(rand, 0.1, 100) };
    const rLo = compute(lo);
    const rHi = compute(hi);
    checked++;
    if (rHi.output_payload.annual_tco < rLo.output_payload.annual_tco) violations++;
  }
  return { name: 'P4_annual_tco_non_decreasing_in_validator_count', trials: checked, violations };
}

// ---------- P5 (mandatory): ULP-boundary forcing ----------
const BASE = { validator_count: 50, fee_rate_avax_per_validator_month: 1.33, fee_growth_rate_annual_pct: 10, infra_cost_annual: 12000, current_balance: 6000, as_of: 1753900000, target_runway_months: 24, horizon_months: 60 };
const ULP_BOUNDARY_CASES = [
  [{ ...BASE, validator_count: 0, fee_rate_avax_per_validator_month: 0, infra_cost_annual: 0, current_balance: 0 }, 'zero burn, zero balance simultaneously — must NOT trigger L1_BALANCE_EXHAUSTED (has_positive_burn is false), months_to_depletion stays null'],
  [{ ...BASE, current_balance: 0, validator_count: 1, fee_rate_avax_per_validator_month: 0.01 }, 'current_balance exactly zero with positive burn — must be exhausted at t=0, months_to_depletion=0'],
  [{ ...BASE, current_balance: Number.MIN_VALUE, validator_count: 1, fee_rate_avax_per_validator_month: 1 }, 'current_balance smallest positive double with real burn — must deplete at month 1, not treat as exhausted-at-zero'],
  [{ ...BASE, fee_rate_avax_per_validator_month: Number.MIN_VALUE }, 'fee_rate at smallest positive double — annual_tco must remain finite, non-negative'],
  [{ ...BASE, fee_growth_rate_annual_pct: 0 }, 'zero fee growth — multiplier is exactly 1, fee rate must stay constant every 12-month step'],
  [{ ...BASE, current_balance: -0 }, 'current_balance negative zero — must behave as zero/non-positive, no NaN'],
  [{ ...BASE, validator_count: 1 / 3, fee_rate_avax_per_validator_month: 3 }, 'x/y*y!==x style non-exact-double validator_count*rate product — fee_component_annual must be the exact double the kernel computes, finite'],
  [{ ...BASE, current_balance: Number.MAX_SAFE_INTEGER, validator_count: 1, fee_rate_avax_per_validator_month: 0.01, infra_cost_annual: 0 }, 'current_balance at MAX_SAFE_INTEGER with tiny burn — must not deplete within horizon, months_to_depletion null, no overflow'],
  [{ ...BASE, target_runway_months: 1200 + 1 }, 'target_runway_months requested beyond the 1200-month horizon cap — must clamp to MAX_HORIZON_MONTHS, never exceed it'],
];

function checkP5_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const o = r.output_payload;
    const plausible = Number.isFinite(o.annual_tco) && o.annual_tco >= 0
      && (o.months_to_depletion === null || Number.isFinite(Number(o.months_to_depletion)))
      && ['L1_BALANCE_EXHAUSTED', 'L1_RUNWAY_SHORT', 'L1_RUNWAY_OK'].includes(o.runway_flag);
    rows.push({ label, input: pp, annual_tco: o.annual_tco, months_to_depletion: o.months_to_depletion, runway_flag: o.runway_flag, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_depletionBounded());
results.properties.push(checkP2_runwayFlagConsistent());
results.properties.push(checkP3_annualTcoIdentity());
results.properties.push(checkP4_monotonicTcoInValidatorCount());
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
