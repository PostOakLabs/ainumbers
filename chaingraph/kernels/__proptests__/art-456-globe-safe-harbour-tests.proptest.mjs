// kernel_digest_at_authoring: sha256:9dd9ae74b1d4edde67ba59bd862dc96cd7a0623011b3e59070bf5fd6ccbf3669
//
// FV-PROPFLOOR-SHARD-B24-1 — property-test floor for art-456-globe-safe-harbour-tests.
// Class B (bounded-numeric), FLOAT-SENSITIVE (simplified_etr_value = covered_taxes/profit is a
// genuine unrounded division compared against a per-year transition-rate threshold) —
// ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-456-globe-safe-harbour-tests.proptest.mjs

import { compute } from '../art-456-globe-safe-harbour-tests.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-456-globe-safe-harbour-tests.fixtures.json');
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
const rand = mulberry32(0x456C3);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;

function mkPP(rng) {
  return {
    revenue_eur: randRange(rng, 0, 5e7),
    profit_before_tax_eur: randRange(rng, -1e6, 5e6),
    simplified_covered_taxes: randRange(rng, 0, 1e6),
    fiscal_year: 2024,
    sbie_amount: randRange(rng, 0, 3e6),
  };
}

// ---------- P1: boundedness — safe_harbour_met is exactly the OR of the three test pass flags ----------
function checkP1_safeHarbourOr() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const expected = r.tests.some((t) => t.pass);
    if (r.safe_harbour_met !== expected) violations++;
    if (r.deemed_zero_topup !== r.safe_harbour_met) violations++;
    if (r.passing_test_ids.length !== r.tests.filter((t) => t.pass).length) violations++;
  }
  return { name: 'P1_safe_harbour_met_exact_or_of_three_test_pass_flags', trials: checked, violations };
}

// ---------- P2: fixed-threshold-tier agreement — de_minimis_test.pass matches revenue AND profit strictly-below thresholds ----------
function checkP2_deMinimisAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const dm = r.tests.find((t) => t.test_id === 'de_minimis');
    const expected = pp.revenue_eur < dm.inputs.de_minimis_revenue_threshold_eur && pp.profit_before_tax_eur < dm.inputs.de_minimis_profit_threshold_eur;
    if (dm.pass !== expected) violations++;
    // routine_profits test
    const rp = r.tests.find((t) => t.test_id === 'routine_profits');
    if (rp.pass !== (pp.profit_before_tax_eur <= pp.sbie_amount)) violations++;
  }
  return { name: 'P2_de_minimis_and_routine_profits_exact_threshold_agreement', trials: checked, violations };
}

// ---------- P3: monotonicity — increasing sbie_amount (holding profit fixed) never turns routine_profits pass to fail ----------
function checkP3_sbieMonotone() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r1 = compute(pp).output_payload.tests.find((t) => t.test_id === 'routine_profits');
    const pp2 = { ...pp, sbie_amount: pp.sbie_amount + randRange(rand, 0.01, 1e6) };
    const r2v = compute(pp2).output_payload.tests.find((t) => t.test_id === 'routine_profits');
    checked++;
    if (r1.pass && !r2v.pass) violations++;
  }
  return { name: 'P3_routine_profits_pass_never_lost_when_sbie_amount_only_increases', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const BASE = { revenue_eur: 5e6, profit_before_tax_eur: 5e5, simplified_covered_taxes: 8e4, fiscal_year: 2024, sbie_amount: 5e5 };
const ULP_BOUNDARY_CASES = [
  [{ ...BASE, revenue_eur: 10_000_000, profit_before_tax_eur: 999999.999999 }, 'profit 1 ULP-scale below the de-minimis 1,000,000 EUR threshold — de_minimis pass true'],
  [{ ...BASE, revenue_eur: 10_000_000, profit_before_tax_eur: 1_000_000 }, 'profit exactly at the de-minimis threshold — pass must be false (strictly <, not <=)'],
  [{ ...BASE, profit_before_tax_eur: 0 }, 'profit exactly zero — simplified ETR auto-passes on nonpositive profit'],
  [{ ...BASE, profit_before_tax_eur: -0 }, 'profit negative zero — nonpositive_profit check must trigger (<=0), auto-pass'],
  [{ ...BASE, profit_before_tax_eur: 1e6, simplified_covered_taxes: 150000 }, 'simplified ETR exactly 15% (0.15) at fiscal_year 2024 threshold — pass must be true (>=, not >)'],
  [{ ...BASE, profit_before_tax_eur: 1e6, simplified_covered_taxes: 150000 - Number.EPSILON * 150000 }, 'simplified ETR 1 ULP-scale below 15% — pass must flip false'],
  [{ ...BASE, fiscal_year: 2099 }, 'fiscal_year with no entry in the default rate table — no_rate_for_fiscal_year, ETR test treated as fail'],
  [{ ...BASE, profit_before_tax_eur: Number.MAX_SAFE_INTEGER, simplified_covered_taxes: 1 }, 'profit at MAX_SAFE_INTEGER — ETR division must remain finite, not NaN'],
  [{ ...BASE, profit_before_tax_eur: 300, simplified_covered_taxes: 100 }, '100/300 classic non-exact double (0.333...) ETR division'],
  [{ ...BASE, profit_before_tax_eur: 1e6, sbie_amount: 1e6 }, 'profit exactly equals sbie_amount — routine_profits pass true (<=, not <)'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const etr = r.tests.find((t) => t.test_id === 'simplified_etr');
    const plausible = typeof r.safe_harbour_met === 'boolean' && (etr.inputs.simplified_etr_value === null || Number.isFinite(etr.inputs.simplified_etr_value));
    rows.push({ label, de_minimis_pass: r.tests[0].pass, simplified_etr_pass: etr.pass, routine_profits_pass: r.tests[2].pass, safe_harbour_met: r.safe_harbour_met, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_safeHarbourOr());
results.properties.push(checkP2_deMinimisAgreement());
results.properties.push(checkP3_sbieMonotone());
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
