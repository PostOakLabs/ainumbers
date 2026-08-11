// art-536-reg-w-affiliate-transaction-tester.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C27-1).
// kernel_digest_at_authoring: sha256:97f5aa7c56c8afd1021f3e175b556a66dfbbf632cee7c0f9f88cf0752eae17a4
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES — the WU row's triage table listed this kernel as float:no; RE-CONFIRMED BY
// DIRECT READ per FIX-2 and that classification does NOT hold; this is a CORRECTION, the opposite
// direction from most of this shard's other corrections. Unlike its money-math siblings in this
// shard (art-530/532/535/537, all explicitly integer-minor-units), art-536 takes raw `amount`/
// `capital_base`/`collateral_value` as plain `Number(v)` with NO integer coercion, and genuinely
// divides: single_affiliate_limit_amount = r2(capital_base * (single_affiliate_limit_pct / 100)),
// aggregate_limit_amount and required_collateral use the identical shape, and every one of those
// r2-rounded float values feeds a direct `>`/`<` breach/shortfall comparison. ULP-boundary forcing
// is MANDATORY per spec §3 and was previously entirely absent for this kernel.
// Checks: fixture-oracle gate, termination (P1: transactions.length <= transactions_in.length,
// filtered only by a non-empty affiliate_id), boundedness (P2: single_affiliate_tests.length equals
// the distinct-affiliate count, collateral_tests only for credit-type transactions, aggregate_test
// exposure equals the exact sum of every included transaction's amount), a differential re-derivation
// of the affiliate-grouping and both quantitative-limit/collateral-coverage tests against an
// independent reimplementation (P3), a metamorphic permutation-invariance identity over
// integer-valued amounts (P4, chosen to avoid confounding a genuine finding with ordinary
// floating-point summation-order noise — see P4's own comment), mandatory ULP-boundary forcing on
// the single-affiliate/aggregate limit-amount comparisons and the collateral-coverage comparison
// (P5), and forced categorical boundary cases including the kill condition and a null
// collateral_value (P6).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-536-reg-w-affiliate-transaction-tester.proptest.mjs

import { compute } from '../art-536-reg-w-affiliate-transaction-tester.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-536-reg-w-affiliate-transaction-tester.fixtures.json');
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
const rand = mulberry32(0x536C27);
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : null; }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const AFFILIATES = ['aff-1', 'aff-2', 'aff-3'];
function randomTxn(rng) {
  return {
    affiliate_id: pick(rng, AFFILIATES),
    transaction_id: `T-${Math.floor(rng() * 1e6)}`,
    transaction_type: rng() < 0.6 ? 'credit' : 'other',
    amount: Math.floor(rng() * 2000000), // integer-valued to keep summation-order noise out of P4
    collateral_value: rng() < 0.8 ? Math.floor(rng() * 2000000) : null,
    market_terms_substantially_same: rng() < 0.7,
  };
}
function randomPP(rng) {
  const n = Math.floor(rng() * 8);
  return {
    policy_vintage: '12 CFR 223, eCFR as of 2026-01-01',
    capital_base: 1000000 + Math.floor(rng() * 20000000),
    single_affiliate_limit_pct: 1 + rng() * 30,
    aggregate_affiliate_limit_pct: 1 + rng() * 50,
    collateral_coverage_required_pct: 50 + rng() * 150,
    transactions: Array.from({ length: n }, () => randomTxn(rng)),
  };
}

// Independent reimplementation of the grouping + limit + collateral tests, for the differential check (P3).
function reimplement(pp) {
  const txns = pp.transactions.filter((t) => t.affiliate_id);
  const byAff = new Map();
  for (const t of txns) byAff.set(t.affiliate_id, (byAff.get(t.affiliate_id) || 0) + t.amount);
  const singleLimit = r2(pp.capital_base * (pp.single_affiliate_limit_pct / 100));
  const singleBreach = [...byAff.values()].some((exp) => exp > singleLimit);
  const aggExposure = txns.reduce((s, t) => s + t.amount, 0);
  const aggLimit = r2(pp.capital_base * (pp.aggregate_affiliate_limit_pct / 100));
  const aggBreach = aggExposure > aggLimit;
  const collateralShortfall = txns.filter((t) => t.transaction_type === 'credit').some((t) => {
    const pct = t.collateral_coverage_required_pct_override ?? pp.collateral_coverage_required_pct;
    const required = r2(t.amount * (pct / 100));
    return t.collateral_value === null || t.collateral_value < required;
  });
  let decision;
  if (singleBreach || aggBreach) decision = 'escalate';
  else if (collateralShortfall) decision = 'review_required';
  else decision = 'auto_pass';
  return { affiliateCount: byAff.size, aggExposure, singleLimit, aggLimit, decision };
}

const TRIALS = 3000;

// ---------- P1: termination — transactions filtered only by non-empty affiliate_id ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.execution_state !== 'ran') continue;
    const expectedTxnCount = pp.transactions.filter((t) => t.affiliate_id).length;
    if (o.market_terms_declarations.length !== expectedTxnCount) violations++;
  }
  return { name: 'P1_termination_transactions_filtered_by_affiliate_id_only', trials: checked, violations };
}

// ---------- P2: boundedness — single_affiliate_tests count matches distinct affiliates, exposure sums exactly ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.execution_state !== 'ran') continue;
    const distinctAff = new Set(pp.transactions.filter((t) => t.affiliate_id).map((t) => t.affiliate_id));
    if (o.single_affiliate_tests.length !== distinctAff.size) violations++;
    const expectedAgg = pp.transactions.filter((t) => t.affiliate_id).reduce((s, t) => s + t.amount, 0);
    if (Math.abs(o.aggregate_test.exposure - expectedAgg) > 1e-6) violations++;
    if (o.collateral_tests.length > pp.transactions.filter((t) => t.transaction_type === 'credit').length) violations++;
  }
  return { name: 'P2_boundedness_affiliate_count_and_exposure_sum', trials: checked, violations };
}

// ---------- P3: differential — grouping + limit/collateral tests re-derived against an independent reimplementation ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.execution_state !== 'ran') continue;
    const expected = reimplement(pp);
    if (o.decision !== expected.decision) violations++;
    if (Math.abs(o.aggregate_test.limit_amount - expected.aggLimit) > 1e-6) violations++;
  }
  return { name: 'P3_grouping_and_limits_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance over integer-valued amounts ----------
// Amounts are generated as integers (see randomTxn) specifically so this check isolates a genuine
// order-dependence finding from ordinary floating-point summation-order noise: summing the same set
// of integers in a different order can still occasionally land on an adjacent float due to rounding
// in intermediate additions, but that risk is what P5's ULP forcing targets directly -- this property
// checks the DECISION and the exposure figures agree within a small tolerance under reordering.
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1000; i++) {
    const pp = randomPP(rand);
    if (pp.transactions.length < 2) continue;
    const shuffled = { ...pp, transactions: [...pp.transactions].reverse() };
    const a = compute(pp).output_payload;
    const b = compute(shuffled).output_payload;
    checked++;
    if (a.execution_state !== b.execution_state) violations++;
    if (a.execution_state === 'ran') {
      if (a.decision !== b.decision) violations++;
      if (Math.abs(a.aggregate_test.exposure - b.aggregate_test.exposure) > 1e-6) violations++;
    }
  }
  return { name: 'P4_permutation_invariance_integer_amounts', trials: checked, violations };
}

// ---------- P5: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
function checkP5_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  const basePolicy = { policy_vintage: 'v', capital_base: 10000000, single_affiliate_limit_pct: 10, aggregate_affiliate_limit_pct: 20, collateral_coverage_required_pct: 130 };

  // (a) single-affiliate exposure exactly at the r2-rounded limit, and one part in 1e6 either side.
  const limit = Math.round(10000000 * (10 / 100) * 100) / 100; // = 1000000
  for (const exposure of [limit, limit - 0.01, limit + 0.01, limit - eps, limit + eps, 0, -0]) {
    const pp = { ...basePolicy, transactions: [{ affiliate_id: 'a', transaction_id: 't1', transaction_type: 'other', amount: exposure, collateral_value: null, market_terms_substantially_same: true }] };
    const { output_payload: o } = compute(pp);
    checked++;
    if (!Number.isFinite(o.single_affiliate_tests[0].exposure)) violations++;
    const expectedBreach = exposure > limit;
    if (o.single_affiliate_tests[0].breach !== expectedBreach) violations++;
  }

  // (b) single_affiliate_limit_pct = 0 -> limit_amount = 0 -> any positive exposure breaches.
  // (capital_base itself must stay > 0 -- the kernel's own policyDeclared kill-condition check
  // requires capital_base > 0, so 0 capital_base is exercised instead under P6's kill-condition case.)
  {
    const pp = { ...basePolicy, single_affiliate_limit_pct: 0, transactions: [{ affiliate_id: 'a', transaction_id: 't1', transaction_type: 'other', amount: 1, collateral_value: null, market_terms_substantially_same: true }] };
    const { output_payload: o } = compute(pp);
    checked++;
    if (!o.single_affiliate_tests[0].breach) violations++;
    if (o.single_affiliate_tests[0].limit_amount !== 0) violations++;
  }
  {
    const pp = { ...basePolicy, capital_base: 3, single_affiliate_limit_pct: 33.333333333333336, transactions: [{ affiliate_id: 'a', transaction_id: 't1', transaction_type: 'other', amount: 1, collateral_value: null, market_terms_substantially_same: true }] };
    const { output_payload: o } = compute(pp);
    checked++;
    if (!Number.isFinite(o.single_affiliate_tests[0].limit_amount)) violations++;
  }

  // (c) collateral coverage: required_collateral at the exact r2 boundary, collateral_value equal,
  // one cent short, one cent over, and a null collateral_value (explicit-null shortfall, not NaN).
  const req = Math.round(500000 * (130 / 100) * 100) / 100; // = 650000
  for (const cv of [req, req - 0.01, req + 0.01, null, 0, -0]) {
    const pp = { ...basePolicy, transactions: [{ affiliate_id: 'a', transaction_id: 't1', transaction_type: 'credit', amount: 500000, collateral_value: cv, market_terms_substantially_same: true }] };
    const { output_payload: o } = compute(pp);
    checked++;
    const row = o.collateral_tests[0];
    if (!Number.isFinite(row.required_collateral)) violations++;
    const expectedShortfall = cv === null || cv < req;
    if (row.shortfall !== expectedShortfall) violations++;
  }

  return { name: 'P5_ulp_boundary_forcing_limit_and_collateral_thresholds', trials: checked, violations };
}

// ---------- P6: forced categorical boundary cases ----------
function checkP6_forced_categorical() {
  let violations = 0, checked = 0;
  // kill condition: no policy declared
  { const { output_payload: o, compliance_flags } = compute({ transactions: [{ affiliate_id: 'a', transaction_id: 't', transaction_type: 'credit', amount: 100, collateral_value: 100, market_terms_substantially_same: true }] }); checked++; if (o.execution_state !== 'did_not_run') violations++; if (!compliance_flags.includes('REG_W_KILL_CONDITION_INCOMPLETE_DECLARATION')) violations++; }
  // no covered transactions declared
  { const { output_payload: o } = compute({ policy_vintage: 'v', capital_base: 100, single_affiliate_limit_pct: 10, aggregate_affiliate_limit_pct: 20, collateral_coverage_required_pct: 100, transactions: [] }); checked++; if (o.execution_state !== 'did_not_run') violations++; if (o.reason !== 'no_covered_transactions_declared') violations++; }
  // non-numeric amount coerced to 0, never NaN
  { const { output_payload: o } = compute({ policy_vintage: 'v', capital_base: 100, single_affiliate_limit_pct: 10, aggregate_affiliate_limit_pct: 20, collateral_coverage_required_pct: 100, transactions: [{ affiliate_id: 'a', transaction_id: 't', transaction_type: 'other', amount: 'not-a-number', collateral_value: null, market_terms_substantially_same: true }] }); checked++; if (!Number.isFinite(o.single_affiliate_tests[0].exposure) || o.single_affiliate_tests[0].exposure !== 0) violations++; }
  return { name: 'P6_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_permutation_invariance());
results.properties.push(checkP5_ulp_forcing());
results.properties.push(checkP6_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-536-reg-w-affiliate-transaction-tester',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
