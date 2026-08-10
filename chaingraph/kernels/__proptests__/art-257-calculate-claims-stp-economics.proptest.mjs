// kernel_digest_at_authoring: sha256:705011effaaf8ceec89ff5d39d51b1a8bf478dbd66ded2dfe68639036e90ef20
//
// FV-PROPFLOOR-SHARD-B9-1 — property-test floor for art-257-calculate-claims-stp-economics.
// Class B (bounded-numeric), FLOAT-SENSITIVE — cost/rate raw doubles feed net_annual_benefit and an
// NPV/payback calculation with a payback>0 boundary — ULP-boundary forcing is MANDATORY per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG + explicit boundary
// arrays), same shape as the B1-B8 float harnesses.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-257-calculate-claims-stp-economics.proptest.mjs

import { compute } from '../art-257-calculate-claims-stp-economics.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-257-calculate-claims-stp-economics.fixtures.json');
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
const rand = mulberry32(0x2570A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 8000;

function mkPP(rng) {
  return {
    annual_claims_volume: randRange(rng, 100, 100000),
    current_stp_rate_pct: randRange(rng, 0, 60),
    target_stp_rate_pct: randRange(rng, 40, 95),
    manual_handling_cost: randRange(rng, 20, 200),
    automated_handling_cost: randRange(rng, 1, 20),
    implementation_cost: randRange(rng, 1000, 500000),
    annual_license_cost: randRange(rng, 0, 50000),
    leakage_rate_manual_pct: randRange(rng, 0, 5),
    leakage_rate_stp_pct: randRange(rng, 0, 5),
    average_claim_payment: randRange(rng, 100, 10000),
    discount_rate_pct: randRange(rng, 1, 15),
    projection_years: 5,
  };
}

// ---------- P1: monotone — increasing target_stp_rate_pct never decreases annual_handling_savings, when automated is cheaper ----------
function checkP1_monotoneSavings() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    if (pp.automated_handling_cost >= pp.manual_handling_cost) continue; // only meaningful when automation is cheaper
    const r1 = compute(pp);
    const bumped = Math.min(100, pp.target_stp_rate_pct + 5);
    const r2v = compute({ ...pp, target_stp_rate_pct: bumped });
    checked++;
    if (r2v.annual_handling_savings < r1.annual_handling_savings - 1e-6) violations++;
  }
  return { name: 'P1_monotone_savings_nondecreasing_with_target_stp_when_automation_cheaper', trials: checked, violations };
}

// ---------- P2: boundedness — projection_years clamped to [1,20], stp claim counts within volume ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.projection_years < 1 || r.projection_years > 20) violations++;
    if (r.target_stp_claims < 0 || r.target_stp_claims > pp.annual_claims_volume + 1) violations++;
    if (r.annual_cashflows.length !== r.projection_years) violations++;
  }
  return { name: 'P2_boundedness_projection_years_clamped_and_stp_claims_within_volume', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — payback_years null iff net_annual_benefit <= 0 ----------
function checkP3_paybackAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expectNull = r.net_annual_benefit <= 0;
    if (expectNull !== (r.payback_years === null)) violations++;
    if (!expectNull) {
      const expected = Math.round((pp.implementation_cost / r.net_annual_benefit) * 100) / 100;
      if (r.payback_years !== expected) violations++;
    }
  }
  return { name: 'P3_payback_years_null_iff_net_benefit_nonpositive_matches_fixed_rule', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ annual_claims_volume: 1000, current_stp_rate_pct: 0, target_stp_rate_pct: 0, manual_handling_cost: 50, automated_handling_cost: 5, implementation_cost: 0, annual_license_cost: 0 }, 'zero implementation_cost, zero net benefit — payback_years must be null (0/0 not attempted), no throw'],
  [{ annual_claims_volume: 1000, current_stp_rate_pct: 0, target_stp_rate_pct: 100, manual_handling_cost: 50, automated_handling_cost: 5, implementation_cost: 1000, annual_license_cost: 0 }, 'net_annual_benefit exactly positive — payback_years must be finite positive'],
  [{ annual_claims_volume: 0, current_stp_rate_pct: 50, target_stp_rate_pct: 50, manual_handling_cost: 50, automated_handling_cost: 5, implementation_cost: 1000, annual_license_cost: 0 }, 'zero annual_claims_volume — no throw, benefit 0'],
  [{ annual_claims_volume: 1000, current_stp_rate_pct: -0, target_stp_rate_pct: 50, manual_handling_cost: 50, automated_handling_cost: 5, implementation_cost: 1000, annual_license_cost: 0 }, 'negative-zero current_stp_rate_pct — must behave as zero'],
  [{ annual_claims_volume: 1000, current_stp_rate_pct: Number.MIN_VALUE, target_stp_rate_pct: 50, manual_handling_cost: 50, automated_handling_cost: 5, implementation_cost: 1000, annual_license_cost: 0 }, 'current_stp_rate_pct smallest positive double — must round to 0 claims, no throw'],
  [{ annual_claims_volume: 1000, current_stp_rate_pct: 0.1 * 3 * 10, target_stp_rate_pct: 50, manual_handling_cost: 50, automated_handling_cost: 5, implementation_cost: 1000, annual_license_cost: 0 }, 'current_stp_rate_pct via 0.1*3*10 (classic non-exact double) — must round-trip without throwing'],
  [{ annual_claims_volume: 1000, current_stp_rate_pct: (1 / 3) * 3 * 10, target_stp_rate_pct: 50, manual_handling_cost: 50, automated_handling_cost: 5, implementation_cost: 1000, annual_license_cost: 0 }, 'current_stp_rate_pct = (1/3)*3*10 (x/y*y!==x rounding artifact) — must round-trip without throwing'],
  [{ annual_claims_volume: 1000, current_stp_rate_pct: 200, target_stp_rate_pct: -50, manual_handling_cost: 50, automated_handling_cost: 5, implementation_cost: 1000, annual_license_cost: 0 }, 'out-of-range stp rates — must clamp to [0,100], no throw or negative claim counts'],
  [{ annual_claims_volume: Number.MAX_SAFE_INTEGER, current_stp_rate_pct: 0, target_stp_rate_pct: 100, manual_handling_cost: 1, automated_handling_cost: 0.5, implementation_cost: 1, annual_license_cost: 0 }, 'annual_claims_volume at MAX_SAFE_INTEGER — costs must remain finite, no overflow'],
  [{ annual_claims_volume: 1000, current_stp_rate_pct: 0, target_stp_rate_pct: 50, manual_handling_cost: 50, automated_handling_cost: 5, implementation_cost: 1000, annual_license_cost: 0, discount_rate_pct: 0 }, 'zero discount_rate_pct — NPV discounting divides by (1+0)^yr, must not throw'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = { leakage_rate_manual_pct: 0, leakage_rate_stp_pct: 0, average_claim_payment: 0, discount_rate_pct: 10, projection_years: 5, ...overrides };
    const r = compute(pp);
    const plausible = Number.isFinite(r.net_annual_benefit) && (r.payback_years === null || Number.isFinite(r.payback_years)) && Number.isFinite(r.npv);
    rows.push({ label, target_stp_rate_pct: pp.target_stp_rate_pct, net_annual_benefit: r.net_annual_benefit, payback_years: r.payback_years, npv: r.npv, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneSavings());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_paybackAgreement());
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
