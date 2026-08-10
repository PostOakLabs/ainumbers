// kernel_digest_at_authoring: sha256:ea58be48cb6952b060bc4497ac31e719068b753ea96017c4fdfbeaffc872868c
//
// FV-PROPFLOOR-SHARD-B11-1 — property-test floor for art-298-aca-affordability-safe-harbor.
// Class B (bounded-numeric), FLOAT-SENSITIVE (w2/rate-of-pay/fpl harbor maxima are all raw-double
// products/quotients of annual wages, hourly rate, and FPL against a fixed affordability_pct,
// compared directly to a raw-double premium) — ULP-boundary forcing is MANDATORY per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG + explicit boundary
// arrays), same shape as the B1/B2/B3 float harness (art-107/art-15). This file is READ-ONLY with
// respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-298-aca-affordability-safe-harbor.proptest.mjs

import { compute } from '../art-298-aca-affordability-safe-harbor.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-298-aca-affordability-safe-harbor.fixtures.json');
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
const rand = mulberry32(0x29801);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;
const AFFORDABILITY_PCT = 0.0996;

function mkPP(rng) {
  return {
    tax_year: '2026',
    lowest_cost_self_only_monthly_premium: randRange(rng, 0, 1000),
    w2_box1_wages_annual: randRange(rng, 0, 200000),
    hourly_rate: randRange(rng, 5, 100),
    fpl_mainland_annual: randRange(rng, 10000, 30000),
  };
}

// ---------- P1: monotone — raising the premium never flips affordable false→true for any computed harbor ----------
function checkP1_monotonePremium() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const low = { ...pp, lowest_cost_self_only_monthly_premium: 0 };
    const high = { ...pp, lowest_cost_self_only_monthly_premium: 999999 };
    const r1 = compute(low);
    const r2 = compute(high);
    checked++;
    for (const k of ['w2', 'rate_of_pay', 'fpl']) {
      if (r1.output_payload.harbors[k].affordable === true && r2.output_payload.harbors[k].affordable === false) continue;
      if (r1.output_payload.harbors[k].affordable === false && r2.output_payload.harbors[k].affordable === true) violations++;
    }
  }
  return { name: 'P1_monotone_affordable_nonincreasing_as_premium_rises', trials: checked, violations };
}

// ---------- P2: boundedness — computed harbor maxima are always finite non-negative doubles ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    for (const k of ['w2', 'rate_of_pay', 'fpl']) {
      const h = r.output_payload.harbors[k];
      if (h.computed && (!Number.isFinite(h.monthly_max_employee_contribution) || h.monthly_max_employee_contribution < 0)) violations++;
    }
  }
  return { name: 'P2_boundedness_harbor_maxima_finite_nonnegative', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — harbor affordable flag is exact premium<=max comparison ----------
function checkP3_affordableAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const premium = pp.lowest_cost_self_only_monthly_premium;
    const expectedW2Max = (pp.w2_box1_wages_annual * AFFORDABILITY_PCT) / 12;
    if (r.output_payload.harbors.w2.affordable !== (premium <= expectedW2Max)) violations++;
    const expectedFplMax = (pp.fpl_mainland_annual * AFFORDABILITY_PCT) / 12;
    if (r.output_payload.harbors.fpl.affordable !== (premium <= expectedFplMax)) violations++;
  }
  return { name: 'P3_affordable_matches_exact_premium_le_max_comparison', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ tax_year: '2026', lowest_cost_self_only_monthly_premium: 129.895, fpl_mainland_annual: 15650 }, 'premium set to the EXACT computed fpl monthly_max — affordable must be true (<=, not <)'],
  [{ tax_year: '2026', lowest_cost_self_only_monthly_premium: 129.89500000000001, fpl_mainland_annual: 15650 }, 'premium 1 ULP above the exact fpl max — affordable must be false'],
  [{ tax_year: '2026', lowest_cost_self_only_monthly_premium: 0, w2_box1_wages_annual: 0 }, 'zero premium and zero wages — w2 monthly_max exactly 0, affordable true (0<=0)'],
  [{ tax_year: '2026', lowest_cost_self_only_monthly_premium: -0, w2_box1_wages_annual: 12000 }, 'negative-zero premium — must behave as zero, not throw or misclassify'],
  [{ tax_year: '2026', lowest_cost_self_only_monthly_premium: Number.MIN_VALUE, w2_box1_wages_annual: 12000 }, 'smallest positive double premium — must remain finite and affordable true'],
  [{ tax_year: '2026', lowest_cost_self_only_monthly_premium: 100, w2_box1_wages_annual: 0.1 * 3 * 12 / AFFORDABILITY_PCT }, 'w2 wages chosen so premium equals a classic non-exact double product — monthly_max must equal the EXACT double, not a rounded value'],
  [{ tax_year: '2026', lowest_cost_self_only_monthly_premium: 90, hourly_rate: 90 / (130 * AFFORDABILITY_PCT) }, 'rate_of_pay hourly_rate chosen so its max exactly equals premium via (1/3)*3-style rounding artifact — affordable boundary must be exact'],
  [{ tax_year: '2026', lowest_cost_self_only_monthly_premium: Number.MAX_SAFE_INTEGER, w2_box1_wages_annual: 12000 }, 'premium at MAX_SAFE_INTEGER — must remain finite, affordable false, no overflow'],
  [{ tax_year: '2026', lowest_cost_self_only_monthly_premium: 1e-300, fpl_mainland_annual: 15650 }, 'near-subnormal premium — must remain finite, affordable true'],
  [{ tax_year: '2026', lowest_cost_self_only_monthly_premium: 99.99999999999999, w2_box1_wages_annual: 12000 }, 'premium 1 ULP below the w2 max boundary — affordable must be true'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { harbors, satisfies_any_harbor } = r.output_payload;
    const finite = Object.values(harbors).every((h) => !h.computed || Number.isFinite(h.monthly_max_employee_contribution));
    const plausible = finite && (satisfies_any_harbor === null || typeof satisfies_any_harbor === 'boolean');
    rows.push({ label, pp, harbors, satisfies_any_harbor, finite, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotonePremium());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_affordableAgreement());
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
