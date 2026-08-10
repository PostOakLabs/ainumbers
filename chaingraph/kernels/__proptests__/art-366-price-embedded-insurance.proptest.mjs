// kernel_digest_at_authoring: sha256:922020678b293aa6eb63c4a37bcb255584dbba538057ff12e804602c901705fe
//
// FV-PROPFLOOR-SHARD-B21-1 — property-test floor for art-366-price-embedded-insurance.
// Class B (bounded-numeric), FLOAT:YES — premium/GWP/NWP/loss/expense multiplicative
// chain with r2 rounding. ULP-boundary forcing mandatory. Zero external dependencies
// (mulberry32 PRNG + explicit boundary arrays), same shape as the B1/B12 harness. This
// file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-366-price-embedded-insurance.proptest.mjs

import { compute } from '../art-366-price-embedded-insurance.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-366-price-embedded-insurance.fixtures.json');
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
const rand = mulberry32(0x0366A1);
const TRIALS = 6000;
function range(rng, lo, hi) { return lo + rng() * (hi - lo); }

function mkPP(rng) {
  return {
    item_value: range(rng, 1, 5000),
    premium_pct: range(rng, 0, 20),
    attach_rate_pct: range(rng, 0, 100),
    monthly_tx: range(rng, 0, 200000),
    loss_ratio_pct: range(rng, 0, 150),
    commission_pct: range(rng, 0, 60),
    opex_pct: range(rng, 0, 40),
    reins_pct: range(rng, 0, 100),
  };
}

// ---------- P1: annual_gwp is exactly 12x monthly_gwp (within tolerance) ----------
function checkP1_annualIsTwelveXMonthly() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    // annual_gwp and monthly_gwp are each independently r2()-rounded from the unrounded raw
    // value, not one derived from the other's rounded output — tolerance covers the up-to-
    // 12x amplification of two independent 2-decimal roundings.
    if (Math.abs(r.output_payload.annual_gwp - r.output_payload.monthly_gwp * 12) > 0.07) violations++;
  }
  return { name: 'P1_annual_gwp_exactly_12x_monthly_gwp', trials: checked, violations };
}

// ---------- P2: net_written_premium never exceeds annual_gwp (reinsurance only cedes, never adds) ----------
function checkP2_nwpBoundedByGwp() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.net_written_premium > r.output_payload.annual_gwp + 0.01) violations++;
  }
  return { name: 'P2_net_written_premium_never_exceeds_annual_gwp', trials: checked, violations };
}

// ---------- P3: combined_ratio_pct is the exact sum of loss/commission/opex pct (simplified per source tool) ----------
function checkP3_combinedRatioExactSum() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = Math.round((pp.loss_ratio_pct + pp.commission_pct + pp.opex_pct) * 100) / 100;
    if (Math.abs(r.output_payload.combined_ratio_pct - expected) > 0.02) violations++;
  }
  return { name: 'P3_combined_ratio_pct_exact_sum_of_component_pcts', trials: checked, violations };
}

// ---------- P4: EMBI_UNDERWRITING_LOSS flag present iff underwriting_profit < 0 ----------
function checkP4_lossFlagMatchesNegativeProfit() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const hasFlag = r.compliance_flags.includes('EMBI_UNDERWRITING_LOSS');
    if (hasFlag !== (r.output_payload.underwriting_profit < 0)) violations++;
  }
  return { name: 'P4_underwriting_loss_flag_matches_negative_profit', trials: checked, violations };
}

// ---------- P5 (mandatory, float-sensitive): forced ULP-boundary cases ----------
function checkP5_forced() {
  const rows = [];
  const base = { item_value: 350, premium_pct: 3.5, attach_rate_pct: 12, monthly_tx: 50000, loss_ratio_pct: 55, commission_pct: 25, opex_pct: 12, reins_pct: 30 };
  const cases = [
    { item_value: 0, premium_pct: 0, attach_rate_pct: 0, monthly_tx: 0, loss_ratio_pct: 0, commission_pct: 0, opex_pct: 0, reins_pct: 0, label: 'all-zero input — nwp exactly 0, breakeven_loss_ratio_pct short-circuits to 0 not NaN' },
    { ...base, reins_pct: 100, label: 'reins_pct exactly 100 — nwp exactly 0 despite positive gwp, breakeven must short-circuit' },
    { ...base, reins_pct: Number.MIN_VALUE, label: 'reins_pct at denormal scale — reinsurance factor stays effectively 1, nwp stays finite' },
    { ...base, item_value: -10, label: 'negative item_value — EMBI_NEGATIVE_INPUT flag fires, output still finite' },
    { ...base, item_value: -0, label: 'item_value is negative zero — negative-input guard (<0) must NOT trip on -0' },
    { ...base, item_value: Number.MIN_VALUE, monthly_tx: Number.MIN_VALUE, label: 'item_value and monthly_tx both at denormal scale — product underflow must stay finite, not NaN' },
    { ...base, loss_ratio_pct: 0, commission_pct: 0, opex_pct: 0, label: 'all cost ratios exactly 0 — breakeven_loss_ratio_pct exactly 100' },
  ];
  for (const c of cases) {
    const { label, ...pp } = c;
    const r = compute(pp);
    const { net_written_premium, breakeven_loss_ratio_pct, underwriting_profit, combined_ratio_pct } = r.output_payload;
    const plausible = [net_written_premium, breakeven_loss_ratio_pct, underwriting_profit, combined_ratio_pct].every(Number.isFinite);
    rows.push({ label, input: pp, net_written_premium, breakeven_loss_ratio_pct, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_annualIsTwelveXMonthly());
results.properties.push(checkP2_nwpBoundedByGwp());
results.properties.push(checkP3_combinedRatioExactSum());
results.properties.push(checkP4_lossFlagMatchesNegativeProfit());
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
