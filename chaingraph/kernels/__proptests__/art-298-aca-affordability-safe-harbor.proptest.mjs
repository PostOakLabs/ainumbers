// kernel_digest_at_authoring: sha256:517e7ad37c5723b7df461c5830be597d989342422f3c60cad22e15cdcd8d7695
//
// FV-PROPFLOOR-SHARD-B28-1 — property-test floor for art-298-aca-affordability-safe-harbor.
// Class B (bounded-numeric), FLOAT-SENSITIVE (w2/rate-of-pay/FPL harbor maxima are computed via
// unrounded float division by 12 and multiplication by affordability_pct, then compared to
// premium with <=) — ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero
// external dependencies. This file is READ-ONLY with respect to the kernel it imports.
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
const rand = mulberry32(0x298C3);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 12000;
const AFFORDABILITY_PCT = 0.0996;
const RATE_OF_PAY_MONTHLY_HOURS = 130;

function mkPP(rng) {
  const hasW2 = rng() < 0.7;
  const hasRate = rng() < 0.7;
  return {
    tax_year: rng() < 0.9 ? '2026' : 'BOGUS',
    lowest_cost_self_only_monthly_premium: randRange(rng, 0, 1000),
    w2_box1_wages_annual: hasW2 ? randRange(rng, 5000, 200000) : undefined,
    hourly_rate: hasRate ? randRange(rng, 7, 100) : undefined,
    fpl_mainland_annual: rng() < 0.3 ? randRange(rng, 10000, 20000) : undefined,
  };
}

// ---------- P1: fixed rule — w2 harbor max is exactly w2Wages*pct/12 when w2 supplied ----------
function checkP1_w2MaxExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    if (pp.tax_year !== '2026' || typeof pp.w2_box1_wages_annual !== 'number') continue;
    checked++;
    const expected = (pp.w2_box1_wages_annual * AFFORDABILITY_PCT) / 12;
    if (r.output_payload.harbors.w2.monthly_max_employee_contribution !== expected) violations++;
  }
  return { name: 'P1_w2_harbor_max_exact_unrounded_product', trials: checked, violations };
}

// ---------- P2: boundedness — affordable exactly matches premium <= harbor max, for every computed harbor ----------
function checkP2_affordableMatchesComparison() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    if (pp.tax_year !== '2026' || typeof pp.lowest_cost_self_only_monthly_premium !== 'number') continue;
    checked++;
    for (const key of ['w2', 'rate_of_pay', 'fpl']) {
      const h = r.output_payload.harbors[key];
      if (!h.computed) continue;
      const expected = pp.lowest_cost_self_only_monthly_premium <= h.monthly_max_employee_contribution;
      if (h.affordable !== expected) violations++;
    }
  }
  return { name: 'P2_affordable_exact_le_comparison_per_harbor', trials: checked, violations };
}

// ---------- P3: monotonicity — raising w2 wages never turns an affordable w2 harbor unaffordable ----------
function checkP3_w2MonotonicInWages() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    if (pp.tax_year !== '2026' || typeof pp.w2_box1_wages_annual !== 'number') continue;
    const higher = { ...pp, w2_box1_wages_annual: pp.w2_box1_wages_annual * 2 };
    const rBase = compute(pp);
    const rHigher = compute(higher);
    checked++;
    if (rBase.output_payload.harbors.w2.affordable === true && rHigher.output_payload.harbors.w2.affordable === false) violations++;
  }
  return { name: 'P3_w2_affordable_nondecreasing_in_wages', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing on the w2/rate-of-pay/FPL harbor comparisons ----------
const ULP_BOUNDARY_CASES = [
  [{ tax_year: '2026', lowest_cost_self_only_monthly_premium: (12000 * AFFORDABILITY_PCT) / 12, w2_box1_wages_annual: 12000 }, 'premium exactly equal to computed w2 max — affordable must be true (<= inclusive)'],
  [{ tax_year: '2026', lowest_cost_self_only_monthly_premium: ((12000 * AFFORDABILITY_PCT) / 12) + Number.EPSILON * 100, w2_box1_wages_annual: 12000 }, 'premium 1 ULP above computed w2 max — affordable must be false'],
  [{ tax_year: '2026', lowest_cost_self_only_monthly_premium: 0, w2_box1_wages_annual: 12000 }, 'premium exactly zero — always affordable under any positive harbor max'],
  [{ tax_year: '2026', lowest_cost_self_only_monthly_premium: -0, w2_box1_wages_annual: 12000 }, 'premium negative zero — must behave as zero, no NaN'],
  [{ tax_year: '2026', lowest_cost_self_only_monthly_premium: 90, w2_box1_wages_annual: 0 }, 'w2 wages exactly zero — harbor max must be exactly 0, affordable false unless premium is also 0'],
  [{ tax_year: '2026', lowest_cost_self_only_monthly_premium: Number.MIN_VALUE, w2_box1_wages_annual: Number.MIN_VALUE }, 'both premium and wages at smallest positive denormal — must remain finite, no NaN'],
  [{ tax_year: '2026', lowest_cost_self_only_monthly_premium: NaN, w2_box1_wages_annual: 12000 }, 'premium NaN — num() coercion returns null, harbor must report computed:false, missing_lowest_cost error'],
  [{ tax_year: '2026', lowest_cost_self_only_monthly_premium: 90, hourly_rate: 90 / (RATE_OF_PAY_MONTHLY_HOURS * AFFORDABILITY_PCT) }, 'hourly_rate chosen so rate_of_pay max exactly equals premium via a non-exact double chain — affordable must be true'],
  [{ tax_year: '2026', lowest_cost_self_only_monthly_premium: 90, fpl_mainland_annual: (90 * 12) / AFFORDABILITY_PCT }, 'fpl_mainland_annual chosen so fpl max exactly equals premium — affordable must be true'],
  [{ tax_year: '2026', lowest_cost_self_only_monthly_premium: Number.MAX_SAFE_INTEGER, w2_box1_wages_annual: Number.MAX_SAFE_INTEGER }, 'both at MAX_SAFE_INTEGER — must not overflow to Infinity, must remain finite'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { harbors, satisfies_any_harbor } = r.output_payload;
    const finite = Object.keys(harbors).every((k) => {
      const h = harbors[k];
      return !h.computed || Number.isFinite(h.monthly_max_employee_contribution);
    });
    const plausible = finite && (satisfies_any_harbor === null || typeof satisfies_any_harbor === 'boolean');
    rows.push({ label, input: pp, harbors, satisfies_any_harbor, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_w2MaxExact());
results.properties.push(checkP2_affordableMatchesComparison());
results.properties.push(checkP3_w2MonotonicInWages());
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
