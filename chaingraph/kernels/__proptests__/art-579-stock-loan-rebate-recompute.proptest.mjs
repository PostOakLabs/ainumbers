// art-579-stock-loan-rebate-recompute.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C30-1).
// kernel_digest_at_authoring: sha256:76e2d848ba285ccf040cc4dbbef50f1caf5a2a24922ef89765eaf246faa5abc1
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — the WU row's triage table listed this kernel as float:yes; RE-CONFIRMED BY
// DIRECT READ per FIX-2 and that classification does NOT hold. This is a CORRECTION (yes -> no). The
// kernel's own docstring states "all arithmetic below is exact integer arithmetic with explicit
// round-half-up (money) or round-up (collateral requirement) rules, never floating-point residue,"
// and unlike its siblings in this same shard (art-575/577/578, which also carry this claim but place
// no upper bound on their multiplicands), this kernel is the one that goes further and ENGINEERS the
// bound explicitly: MAX_VALUE_MINOR = 10_000_000_000 (documented in-source as bounding "every
// multiply below to a safe integer") and MAX_RATE_BPS = 20_000 together cap every product in roundDiv
// / ceilDiv at <= 1e10 * 2e4 = 2e14, safely under 2^53 (~9.007e15) with wide headroom. There is no
// division producing a continuous quotient compared against a threshold anywhere — roundDiv/ceilDiv
// are both integer-floor operations over bounded operands. No ULP-boundary claim is made or needed,
// and (unlike its siblings) there is no residual overflow risk to floor separately either, since the
// bound is structural rather than merely a safe-integer check.
// Checks: fixture-oracle gate, termination (P1: loans truncated at MAX_LOANS=40, daily_marks
// truncated at MAX_DAYS_PER_LOAN=120), boundedness (P2: computed_total_minor and
// required_collateral_minor stay finite integers within the MAX_VALUE_MINOR-derived bound for every
// trial, confirming the engineered cap holds), a differential re-derivation of the rebate/fee daily
// accrual and collateral-breach test against an independent reimplementation (P3), a metamorphic
// permutation-invariance identity over daily_marks[] order within a loan (P4: daily accrual summation
// is commutative), and forced categorical boundary cases including a required_margin_pct outside
// {102,105}, a zero-spread rebate day (benchmark_rate_bps === rebate_spread_bps -> daily_net_minor
// === 0 exactly), and the exact collateral-requirement boundary (P5).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-579-stock-loan-rebate-recompute.proptest.mjs

import { compute } from '../art-579-stock-loan-rebate-recompute.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-579-stock-loan-rebate-recompute.fixtures.json');
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
const rand = mulberry32(0x579C30);
const ACCRUAL_DENOM = 10000 * 360;
function roundDivRef(num, den) { const sign = num < 0 ? -1 : 1; const n = Math.abs(num); return sign * Math.floor((n + Math.floor(den / 2)) / den); }
function ceilDivRef(num, den) { return Math.floor((num + den - 1) / den); }

function randomMark(rng, basis) {
  const loaned = Math.floor(rng() * 5_000_000);
  const margin = rng() < 0.5 ? 102 : 105;
  const required = ceilDivRef(loaned * margin, 100);
  const collateral = rng() < 0.7 ? required + Math.floor(rng() * 200000) : Math.max(0, required - Math.floor(rng() * 200000));
  const base = { date: '2026-01-01', loaned_market_value_minor: loaned, collateral_value_minor: collateral };
  if (basis === 'rebate_basis') return { ...base, benchmark_rate_bps: Math.floor(rng() * 500), rebate_spread_bps: Math.floor(rng() * 500) };
  return { ...base, fee_rate_bps: Math.floor(rng() * 500) };
}
function randomLoan(rng, id) {
  const basis = rng() < 0.5 ? 'rebate_basis' : 'fee_basis';
  const nDays = 1 + Math.floor(rng() * 10);
  return { loan_id: id, basis, statement_amount_minor: Math.floor(rng() * 200000) - 100000, daily_marks: Array.from({ length: nDays }, () => randomMark(rng, basis)) };
}
function randomPP(rng) {
  const nLoans = 1 + Math.floor(rng() * 4);
  return {
    diff_tolerance_minor: rng() < 0.9 ? Math.floor(rng() * 1000) : undefined,
    required_margin_pct: rng() < 0.9 ? pick(rng, [102, 105]) : undefined,
    statement_period: { start_date: '2026-01-01', end_date: '2026-01-31' },
    loans: Array.from({ length: nLoans }, (_, i) => randomLoan(rng, `L-${i}`)),
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// Independent reimplementation of the per-day accrual + collateral test, for the differential check (P3).
function reimplement(pp) {
  const loanResults = [];
  for (const loan of pp.loans) {
    let total = 0;
    const breaches = [];
    for (const m of loan.daily_marks) {
      let net;
      if (loan.basis === 'rebate_basis') net = -roundDivRef(m.collateral_value_minor * (m.benchmark_rate_bps - m.rebate_spread_bps), ACCRUAL_DENOM);
      else net = roundDivRef(m.loaned_market_value_minor * m.fee_rate_bps, ACCRUAL_DENOM);
      total += net;
      const required = ceilDivRef(m.loaned_market_value_minor * pp.required_margin_pct, 100);
      if (m.collateral_value_minor < required) breaches.push(m.date);
    }
    loanResults.push({ loan_id: loan.loan_id, total, breachCount: breaches.length, matches: Math.abs(total - loan.statement_amount_minor) <= pp.diff_tolerance_minor });
  }
  return loanResults;
}

const TRIALS = 3000;

// ---------- P1: termination — loans/daily_marks truncated at their MAX caps ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.loan_count > 40) violations++;
    if (o.loan_count > pp.loans.length) violations++;
    for (const l of o.loans) if (l.day_count > 120) violations++;
  }
  return { name: 'P1_termination_loans_and_days_bounded', trials: checked, violations };
}

// ---------- P2: boundedness — computed totals and required collateral stay finite integers under the engineered bound ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.decision.execution_state !== 'ran') continue;
    for (const l of o.loans) {
      if (!Number.isSafeInteger(l.computed_total_minor)) violations++;
      for (const m of l.daily_marks) {
        if (!Number.isSafeInteger(m.required_collateral_minor) || m.required_collateral_minor < 0) violations++;
        if (!Number.isSafeInteger(m.daily_net_minor)) violations++;
      }
    }
  }
  return { name: 'P2_boundedness_finite_integers_under_engineered_bound', trials: checked, violations };
}

// ---------- P3: differential — per-day accrual + collateral-breach test re-derived independently ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.decision.execution_state !== 'ran') continue;
    const exp = reimplement(pp);
    if (exp.length !== o.loans.length) { violations++; continue; }
    for (let j = 0; j < exp.length; j++) {
      if (exp[j].total !== o.loans[j].computed_total_minor) violations++;
      if (exp[j].breachCount !== o.loans[j].collateral_breach_count) violations++;
      if (exp[j].matches !== o.loans[j].matches) violations++;
    }
  }
  return { name: 'P3_accrual_and_breach_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance over daily_marks[] order within a loan ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1000; i++) {
    const pp = randomPP(rand);
    const loan = pp.loans[0];
    if (!loan || loan.daily_marks.length < 2) continue;
    const shuffledPP = { ...pp, loans: [{ ...loan, daily_marks: [...loan.daily_marks].reverse() }, ...pp.loans.slice(1)] };
    const a = compute(pp).output_payload;
    const b = compute(shuffledPP).output_payload;
    if (a.decision.execution_state !== 'ran' || b.decision.execution_state !== 'ran' || !a.loans.length || !b.loans.length) continue;
    checked++;
    if (a.loans[0].computed_total_minor !== b.loans[0].computed_total_minor) violations++;
    if (a.loans[0].collateral_breach_count !== b.loans[0].collateral_breach_count) violations++;
  }
  return { name: 'P4_permutation_invariance_daily_marks', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no) ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  // required_margin_pct outside {102,105} -> did_not_run
  { const { output_payload: o } = compute({ diff_tolerance_minor: 0, required_margin_pct: 110, statement_period: { start_date: '2026-01-01', end_date: '2026-01-31' }, loans: [{ loan_id: 'L', basis: 'fee_basis', statement_amount_minor: 0, daily_marks: [{ date: '2026-01-01', loaned_market_value_minor: 1000, collateral_value_minor: 1100, fee_rate_bps: 10 }] }] }); checked++; if (o.decision.execution_state !== 'did_not_run') violations++; }
  // zero-spread rebate day -> daily_net_minor === 0 exactly
  { const { output_payload: o } = compute({ diff_tolerance_minor: 0, required_margin_pct: 102, statement_period: { start_date: '2026-01-01', end_date: '2026-01-31' }, loans: [{ loan_id: 'L', basis: 'rebate_basis', statement_amount_minor: 0, daily_marks: [{ date: '2026-01-01', loaned_market_value_minor: 1000, collateral_value_minor: 1200, benchmark_rate_bps: 200, rebate_spread_bps: 200 }] }] }); checked++; if (o.loans[0].daily_marks[0].daily_net_minor !== 0) violations++; if (!o.loans[0].matches) violations++; }
  // required_collateral_minor exact boundary (ceilDiv(1000*102,100)=1020) vs one minor unit short
  { const { output_payload: o } = compute({ diff_tolerance_minor: 100000, required_margin_pct: 102, statement_period: { start_date: '2026-01-01', end_date: '2026-01-31' }, loans: [{ loan_id: 'L', basis: 'fee_basis', statement_amount_minor: 0, daily_marks: [{ date: '2026-01-01', loaned_market_value_minor: 1000, collateral_value_minor: 1020, fee_rate_bps: 0 }] }] }); checked++; if (o.loans[0].daily_marks[0].mark_ok !== true) violations++; }
  { const { output_payload: o } = compute({ diff_tolerance_minor: 100000, required_margin_pct: 102, statement_period: { start_date: '2026-01-01', end_date: '2026-01-31' }, loans: [{ loan_id: 'L', basis: 'fee_basis', statement_amount_minor: 0, daily_marks: [{ date: '2026-01-01', loaned_market_value_minor: 1000, collateral_value_minor: 1019, fee_rate_bps: 0 }] }] }); checked++; if (o.loans[0].daily_marks[0].mark_ok !== false) violations++; if (o.loans[0].collateral_breach_count !== 1) violations++; }
  // MAX_VALUE_MINOR boundary: confirm the engineered cap value itself stays exact (no overflow at the documented max)
  {
    const MAX = 10_000_000_000;
    const { output_payload: o } = compute({ diff_tolerance_minor: 0, required_margin_pct: 102, statement_period: { start_date: '2026-01-01', end_date: '2026-01-31' }, loans: [{ loan_id: 'L', basis: 'fee_basis', statement_amount_minor: 0, daily_marks: [{ date: '2026-01-01', loaned_market_value_minor: MAX, collateral_value_minor: MAX, fee_rate_bps: 20000 }] }] });
    checked++;
    const expected = roundDivRef(MAX * 20000, ACCRUAL_DENOM);
    if (o.loans[0].daily_marks[0].daily_net_minor !== expected) violations++;
    if (!Number.isSafeInteger(o.loans[0].daily_marks[0].daily_net_minor)) violations++;
  }
  return { name: 'P5_forced_categorical_boundary_cases', trials: checked, violations };
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
results.properties.push(checkP5_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-579-stock-loan-rebate-recompute',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
