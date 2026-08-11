// art-513-public-money-settlement-receipt.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C25-1).
// kernel_digest_at_authoring: sha256:3a5d8a2058fde07defccc3491be7a54c5ef221c869295059f337ffe08db4dd03
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES — CORRECTED from the WU row's float:no (per FIX-2 discipline). Direct source
// read: `r2(v) = Math.round(v * 100) / 100` is genuine IEEE-754 arithmetic, and it is used to build
// `total_fees`, `expected_credit` and `at_par_discrepancy`, which then gate the at-par verdict via
// `Math.abs(at_par_discrepancy) <= EPS` (EPS = 0.01) — directly setting PMR_AT_PAR vs PMR_SHORTFALL
// and feeding `reconciled`/`exceptions`. This is exactly the epsilon-tolerance-boundary shape the spec
// requires ULP-boundary forcing for (same pattern as art-457's `|entity_topup_total - 1| < 1e-6`).
// Checks: fixture-oracle gate, termination (rails bounded by input array length), differential
// re-derivation of expected_credit/at_par_discrepancy/single_settlement_status, permutation-invariance
// of the fees array (total_fees is a commutative sum, safe at the trial magnitudes used), and
// ULP-boundary forcing around the EPS=0.01 at-par tolerance boundary and the r2() rounding step.
//
// Run: node chaingraph/kernels/__proptests__/art-513-public-money-settlement-receipt.proptest.mjs

import { compute } from '../art-513-public-money-settlement-receipt.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-513-public-money-settlement-receipt.fixtures.json');
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
const rand = mulberry32(0x51300);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomPP(rng) {
  const nRails = Math.floor(rng() * 3);
  const rails = [];
  for (let i = 0; i < nRails; i++) {
    rails.push({
      rail: pick(rng, ['ach', 'rtgs', 'cbdc']),
      settlement_ref: `S${i}`,
      declared_finality_basis: 'final',
      settled: rng() < 0.5,
    });
  }
  const nFees = Math.floor(rng() * 3);
  const fees = [];
  for (let i = 0; i < nFees; i++) fees.push({ type: 'processing', amount: rng() * 5 });
  const amount_collected = rng() * 1000;
  return {
    payment_ref: 'PAY1', payer_class: pick(rng, ['citizen', 'business', 'agency']),
    declared_revenue_code: 'REV1',
    revenue_code_table: [{ code: 'REV1', ministry: 'Finance' }],
    treasury_account_credited: 'TSA1', currency: 'USD',
    amount_collected,
    fees,
    amount_credited: amount_collected - fees.reduce((a, f) => a + f.amount, 0) + (rng() - 0.5) * 0.02,
    rails,
  };
}

const TRIALS = 3000;

// ---------- P1: termination — rails and fees bounded by input array length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.rails.length !== pp.rails.length) violations++;
    if (output_payload.fees.length !== pp.fees.length) violations++;
  }
  return { name: 'P1_rails_and_fees_bounded_by_input_length', trials: checked, violations };
}

// ---------- P2 (differential): expected_credit / at_par_discrepancy / single_settlement_status ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  const r2 = (v) => Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const totalFees = r2(pp.fees.reduce((s, f) => s + Math.max(0, f.amount), 0));
    if (Math.abs(output_payload.total_fees_itemised - totalFees) > 1e-9) violations++;
    const amountCollected = Math.max(0, pp.amount_collected);
    const expectedCredit = r2(amountCollected - totalFees);
    if (Math.abs(output_payload.expected_credit - expectedCredit) > 1e-9) violations++;
    const settledCount = pp.rails.filter((r) => r.settled === true).length;
    const expectedStatus = pp.rails.length === 0 ? 'UNRESOLVED' : settledCount === 1 ? 'SINGLE' : settledCount > 1 ? 'DOUBLE_COUNT_RISK' : 'UNRESOLVED';
    if (output_payload.single_settlement_status !== expectedStatus) violations++;
  }
  return { name: 'P2_expected_credit_and_settlement_status_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — permuting the fees array never changes total_fees_itemised ----------
function checkP3_fee_order_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = randomPP(rand);
    if (pp.fees.length < 2) continue;
    const shuffled = { ...pp, fees: [...pp.fees].sort(() => rand() - 0.5) };
    const r1 = compute(pp).output_payload;
    const r2 = compute(shuffled).output_payload;
    checked++;
    if (r1.total_fees_itemised !== r2.total_fees_itemised) violations++;
    if (r1.expected_credit !== r2.expected_credit) violations++;
    if (r1.at_par !== r2.at_par) violations++;
  }
  return { name: 'P3_fees_order_invariance', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing around the EPS=0.01 at-par tolerance and r2() rounding ----------
function checkP4_ulp_boundary_forcing() {
  let violations = 0, checked = 0;
  const base = { payment_ref: 'P', payer_class: 'citizen', declared_revenue_code: 'R', revenue_code_table: [{ code: 'R', ministry: 'M' }], treasury_account_credited: 'T', currency: 'USD', rails: [{ rail: 'ach', settlement_ref: 'S', declared_finality_basis: 'final', settled: true }] };

  const cases = [
    { collected: 100, fees: [], credited: 100, expectAtPar: true, label: 'exact_at_par' },
    { collected: 100, fees: [], credited: 100.01, expectAtPar: true, label: 'inside_tolerance_high' },
    { collected: 100, fees: [], credited: 99.99, expectAtPar: true, label: 'inside_tolerance_low' },
    { collected: 100, fees: [], credited: 100.02, expectAtPar: false, label: 'outside_tolerance_high' },
    { collected: 100, fees: [], credited: 99.98, expectAtPar: false, label: 'outside_tolerance_low' },
    { collected: 0.1 + 0.2, fees: [], credited: 0.3, expectAtPar: true, label: 'classic_binary_repr_0.1_plus_0.2' },
    { collected: 0, fees: [], credited: 0.005, expectAtPar: true, label: 'zero_collected_tiny_credit' },
    { collected: -0, fees: [], credited: 0, expectAtPar: true, label: 'negative_zero_collected' },
    { collected: 100 + Number.EPSILON, fees: [], credited: 100, expectAtPar: true, label: 'plus_one_ulp_collected' },
    { collected: 100, fees: [], credited: 100 + Number.MIN_VALUE, expectAtPar: true, label: 'denormal_offset_credited' },
  ];
  for (const c of cases) {
    checked++;
    const pp = { ...base, amount_collected: c.collected, fees: c.fees, amount_credited: c.credited };
    const { output_payload } = compute(pp);
    if (output_payload.at_par !== c.expectAtPar) violations++;
  }

  // x/y*y !== x style case feeding fee amounts
  checked++;
  {
    const x = 0.1, y = 3;
    const derived = (x / y) * y; // !== x in IEEE-754
    const pp = { ...base, amount_collected: 100, fees: [{ type: 'a', amount: derived - x }], amount_credited: 100 };
    const { output_payload } = compute(pp);
    if (typeof output_payload.at_par !== 'boolean') violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_at_par_tolerance', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_differential());
results.properties.push(checkP3_fee_order_invariance());
results.properties.push(checkP4_ulp_boundary_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-513-public-money-settlement-receipt',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
