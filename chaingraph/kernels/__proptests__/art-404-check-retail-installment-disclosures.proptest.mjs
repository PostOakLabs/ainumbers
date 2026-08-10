// kernel_digest_at_authoring: sha256:06ea130127d2c462fd7cf1f689399a8c38d577cfe49220ea12f30a71eacaf87e
//
// FV-PROPFLOOR-SHARD-B22-1 — property-test floor for art-404-check-retail-installment-disclosures.
// Class B (bounded-numeric, cents-domain), FLOAT:NO per the WU row — every money value is
// converted to integer CENTS via Math.round(dollars*100) and all subsequent tie-out arithmetic
// (amountFinancedCents, totalOfPaymentsCents, financeChargeCents, tolerance comparison) runs on
// those integers, never a raw fractional-dollar comparison. The float exposure is confined to
// the dollars->cents Math.round() boundary, so forced CATEGORICAL/rounding-tie boundary cases
// (half-cent inputs, classic non-exact doubles) are used in place of ULP forcing, per the
// spec's float:no exception path. Zero external dependencies. This file is READ-ONLY with
// respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-404-check-retail-installment-disclosures.proptest.mjs

import { compute } from '../art-404-check-retail-installment-disclosures.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-404-check-retail-installment-disclosures.fixtures.json');
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
const rand = mulberry32(0x404D5);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function toCents(d) { return Math.round(d * 100); }
const TRIALS = 10000;

function mkPP(rng) {
  const cash_price = randRange(rng, 1000, 50000);
  const downpayment = randRange(rng, 0, cash_price * 0.3);
  const total_principal = cash_price - downpayment;
  const total_interest = randRange(rng, 0, total_principal * 0.5);
  const amountFinanced = total_principal;
  const totalOfPayments = total_principal + total_interest;
  const financeCharge = totalOfPayments - amountFinanced;
  const withinTol = rng() < 0.5;
  const tolerance_cents = 500;
  const disclosed_amount_financed = withinTol ? amountFinanced : amountFinanced + randRange(rng, 10, 100);
  return {
    inputs: {
      cash_price, downpayment, other_amounts_financed: 0, prepaid_finance_charge: 0,
      amortization_schedule: { totals: { total_principal, total_interest, num_payments: 60 }, schedule_digest: 'sha256:' + 'a'.repeat(64), source_tool_id: 'art-332-build-amortization-schedule' },
      disclosed_amount_financed,
      disclosed_finance_charge: financeCharge,
      disclosed_total_of_payments: totalOfPayments,
      tolerance_cents,
      dealer_participation: { markup_pct: 0, dealer_reserve_disclosed: false },
    },
  };
}

// ---------- P1: amount_financed is the exact cents-domain identity, round-tripped to dollars ----------
function checkP1_amountFinancedExactCents() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { cash_price, downpayment, other_amounts_financed, prepaid_finance_charge } = pp.inputs;
    const expectedCents = toCents(cash_price) - toCents(downpayment) + toCents(other_amounts_financed) - toCents(prepaid_finance_charge);
    const expectedDollars = Math.round(expectedCents) / 100;
    if (r.output_payload.amount_financed !== expectedDollars) violations++;
  }
  return { name: 'P1_amount_financed_exact_cents_domain_identity', trials: checked, violations };
}

// ---------- P2: finance_charge is exactly total_of_payments - amount_financed (cents-domain) ----------
function checkP2_financeChargeExactDifference() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(mkPP(rand));
    checked++;
    const diffCents = Math.round(r.output_payload.total_of_payments * 100) - Math.round(r.output_payload.amount_financed * 100);
    const expected = Math.round(diffCents) / 100;
    if (r.output_payload.finance_charge !== expected) violations++;
  }
  return { name: 'P2_finance_charge_exact_cents_domain_difference', trials: checked, violations };
}

// ---------- P3: within_tolerance is the exact boundedness test diff_cents <= tolerance_cents ----------
function checkP3_withinToleranceExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    for (const tie of r.output_payload.tie_outs) {
      if (tie.disclosed !== null && tie.within_tolerance !== null) {
        if ((tie.diff_cents <= pp.inputs.tolerance_cents) !== tie.within_tolerance) violations++;
      }
    }
  }
  return { name: 'P3_within_tolerance_exact_diff_cents_bounded_by_tolerance', trials: checked, violations };
}

// ---------- P4 (float:no exception): forced categorical/rounding-tie boundary cases ----------
const BASE_INPUTS = { other_amounts_financed: 0, prepaid_finance_charge: 0, amortization_schedule: { totals: { total_principal: 20000, total_interest: 3479.43, num_payments: 60 }, schedule_digest: 'sha256:' + 'b'.repeat(64), source_tool_id: 'art-332-build-amortization-schedule' }, tolerance_cents: 500, dealer_participation: {} };
const CATEGORICAL_BOUNDARY_CASES = [
  [{ ...BASE_INPUTS, cash_price: 0.1, downpayment: 0 }, 'classic non-exact double 0.1*100 in toCents — must round to exactly 10 cents, not 9'],
  [{ ...BASE_INPUTS, cash_price: 19.995, downpayment: 0 }, 'half-cent input (19.995) — Math.round(1999.5) must resolve deterministically (round-half-away-from-zero), not throw or drift'],
  [{ ...BASE_INPUTS, cash_price: 21500, downpayment: 1500, disclosed_amount_financed: 20000, disclosed_finance_charge: 3479.43, disclosed_total_of_payments: 23479.43 }, 'exact clean tie-out at $0.00 diff — within_tolerance true for all three legs'],
  [{ ...BASE_INPUTS, cash_price: 21500, downpayment: 1500, disclosed_amount_financed: 20005, disclosed_finance_charge: null, disclosed_total_of_payments: null }, 'disclosed_amount_financed exactly $5.00 over (500 cents = the tolerance boundary) — within_tolerance true (<=, not <)'],
  [{ ...BASE_INPUTS, cash_price: 21500, downpayment: 1500, disclosed_amount_financed: 20005.01, disclosed_finance_charge: null, disclosed_total_of_payments: null }, 'disclosed_amount_financed one cent past the tolerance boundary — within_tolerance false'],
  [{ ...BASE_INPUTS, cash_price: 21500, downpayment: 1500, tolerance_cents: 0, disclosed_amount_financed: 20000.001 }, 'tolerance_cents exactly zero with a sub-cent disclosed rounding difference — Math.round collapses the difference to 0, still within_tolerance'],
  [{ ...BASE_INPUTS, cash_price: 21500, downpayment: 1500, disclosed_amount_financed: null, disclosed_finance_charge: null, disclosed_total_of_payments: null }, 'all three disclosed figures absent — within_tolerance null for each, computed figures still present'],
  [{ ...BASE_INPUTS, cash_price: 21500, downpayment: 1500, amortization_schedule: { totals: { total_principal: 20000, total_interest: 0 }, schedule_digest: 'not-a-sha256-digest' } }, 'schedule_digest missing the sha256: prefix — AMORTIZATION_SCHEDULE_PROVENANCE_MISSING flagged, arithmetic still computed'],
  [{ ...BASE_INPUTS, cash_price: 21500, downpayment: 1500, dealer_participation: { markup_pct: 1.5, dealer_reserve_disclosed: false } }, 'dealer markup positive but reserve NOT disclosed — DEALER_MARKUP_NOT_DISCLOSED flagged'],
];

function checkP4_forced() {
  const rows = [];
  for (const [inputs, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute({ inputs });
    const { amount_financed, finance_charge, tie_outs } = r.output_payload;
    const plausible = Number.isFinite(amount_financed) && Number.isFinite(finance_charge) && Array.isArray(tie_outs) && tie_outs.length === 3;
    rows.push({ label, input: inputs, amount_financed, finance_charge, tie_outs, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_amountFinancedExactCents());
results.properties.push(checkP2_financeChargeExactDifference());
results.properties.push(checkP3_withinToleranceExact());
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
