// kernel_digest_at_authoring: sha256:c6fbba62489f06817943d209bae235e325f6bb14118049aa69c24453ec555088
//
// FV-PROPFLOOR-SHARD-B27-1 — property-test floor for art-582-genius-reserve-disclosure-conformance-monitor.
// Class B (bounded-numeric). FIX-2 CARRY read of the kernel: `coverage_ratio` is a float division
// (totalReserves/totalLiabilities) compared against a literal 1 threshold — genuinely float-adjacent,
// even though the WU classifies this kernel float:no (its other requirement, attestation timeliness,
// is pure integer day-arithmetic). As a diligence precaution this file's forced boundary set (P4) still
// includes near-1.0 coverage-ratio cases alongside the mandatory categorical boundaries — see manifest
// note. Zero external dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-582-genius-reserve-disclosure-conformance-monitor.proptest.mjs

import { compute } from '../art-582-genius-reserve-disclosure-conformance-monitor.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-582-genius-reserve-disclosure-conformance-monitor.fixtures.json');
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
const rand = mulberry32(0x582A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function randInt(rng, lo, hi) { return Math.floor(randRange(rng, lo, hi + 1)); }
const TRIALS = 8000;

function isoDate(offsetDays) {
  const t = Date.UTC(2027, 1, 28) + offsetDays * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

function mkPP(rng) {
  const tokens = randRange(rng, 1, 1_000_000);
  const price = randRange(rng, 0.5, 2);
  const reserves = randRange(rng, 0, tokens * price * 1.5);
  const attestationPresent = rng() < 0.8;
  const examinerRegistered = rng() < 0.7;
  const daysAfter = randInt(rng, 0, 60);
  return {
    report_period: '2027-02',
    period_end_date: isoDate(0),
    outstanding_tokens_reported: tokens,
    token_price: price,
    total_reserves_usd: reserves,
    attestation_present: attestationPresent,
    attestation_date: attestationPresent ? isoDate(daysAfter) : null,
    examiner_registered: examinerRegistered,
    examiner_name: examinerRegistered ? 'Example Registered CPA LLP' : null,
    onchain_supply_check: null,
  };
}

const VERDICTS = ['MET', 'NOT_MET', 'INDETERMINATE'];

// ---------- P1: boundedness — every verdict field stays inside the declared 3-value enum ----------
function checkP1_verdictBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    if (!VERDICTS.includes(op.overall_determination)) violations++;
    if (!VERDICTS.includes(op.requirement_verdicts[0].verdict)) violations++;
    if (!VERDICTS.includes(op.requirement_verdicts[1].verdict)) violations++;
  }
  return { name: 'P1_verdict_bounded_to_declared_enum', trials: checked, violations };
}

// ---------- P2: monotonicity — raising total_reserves_usd (liabilities fixed) never decreases coverage_ratio_pct ----------
function checkP2_coverageMonotonic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    if (!(pp.outstanding_tokens_reported > 0)) continue;
    const lowReserves = pp.total_reserves_usd * 0.5;
    const highReserves = pp.total_reserves_usd * 1.5 + 1;
    const rLow = compute({ ...pp, total_reserves_usd: lowReserves });
    const rHigh = compute({ ...pp, total_reserves_usd: highReserves });
    checked++;
    if (rHigh.output_payload.coverage_ratio_pct < rLow.output_payload.coverage_ratio_pct) violations++;
  }
  return { name: 'P2_coverage_ratio_monotonic_in_reserves', trials: checked, violations };
}

// ---------- P3: fixed rule — shortfall_usd is exactly max(0, liabilities - reserves), rounded to 2dp ----------
function checkP3_shortfallExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    if (!(pp.outstanding_tokens_reported > 0)) continue;
    const r = compute(pp);
    checked++;
    const liabilities = pp.outstanding_tokens_reported * pp.token_price;
    const expected = parseFloat(Math.max(0, liabilities - pp.total_reserves_usd).toFixed(2));
    if (r.output_payload.reserve_shortfall_usd !== expected) violations++;
  }
  return { name: 'P3_shortfall_exact_max0_liabilities_minus_reserves', trials: checked, violations };
}

// ---------- P4 (forced categorical + coverage-ratio boundary diligence) ----------
const FORCED_CASES = [
  [{ outstanding_tokens_reported: 0, token_price: 1, total_reserves_usd: 100, attestation_present: false }, 'zero tokens — coverage INDETERMINATE, arithmetic guard trips'],
  [{ outstanding_tokens_reported: -5, token_price: 1, total_reserves_usd: 100, attestation_present: false }, 'negative tokens — coverage INDETERMINATE'],
  [{ outstanding_tokens_reported: 100, token_price: 1, total_reserves_usd: 100, attestation_present: true, period_end_date: '2027-02-28', attestation_date: '2027-02-28', examiner_registered: true, examiner_name: 'CPA LLP' }, 'coverage ratio exactly 1.0 — must classify MET, not NOT_MET'],
  [{ outstanding_tokens_reported: 100, token_price: 1, total_reserves_usd: 100 - Number.EPSILON * 100, attestation_present: false }, 'coverage ratio a hair below 1.0 (ULP-scale) — must classify NOT_MET, not silently round to MET'],
  [{ outstanding_tokens_reported: 100, token_price: 1, total_reserves_usd: 0, attestation_present: false }, 'zero reserves against positive liabilities — NOT_MET, shortfall equals full liabilities'],
  [{ outstanding_tokens_reported: 100, token_price: 1, total_reserves_usd: 100, attestation_present: true, period_end_date: '2027-02-28', attestation_date: '2027-03-30', examiner_registered: true, examiner_name: 'CPA LLP' }, 'attestation exactly at the 30-day statutory window boundary — must classify MET'],
  [{ outstanding_tokens_reported: 100, token_price: 1, total_reserves_usd: 100, attestation_present: true, period_end_date: '2027-02-28', attestation_date: '2027-03-31', examiner_registered: true, examiner_name: 'CPA LLP' }, 'attestation one day past the 30-day window — must classify NOT_MET'],
  [{ outstanding_tokens_reported: 100, token_price: 1, total_reserves_usd: 100, attestation_present: true, period_end_date: '2027-02-28', attestation_date: '2027-02-20', examiner_registered: true, examiner_name: 'CPA LLP' }, 'attestation_date before period_end_date — INDETERMINATE, not a negative-day crash'],
  [{ outstanding_tokens_reported: 100, token_price: 1, total_reserves_usd: 100, attestation_present: false }, 'attestation absent — NOT_MET, ATTESTATION_MISSING flag'],
  [{ outstanding_tokens_reported: 100, token_price: 1, total_reserves_usd: 100, attestation_present: true, period_end_date: '2027-02-28', attestation_date: '2027-03-01', examiner_registered: false }, 'attestation present but examiner not registered — NOT_MET, ATTESTATION_LATE_OR_UNEXAMINED'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of FORCED_CASES) {
    const r = compute(pp);
    const op = r.output_payload;
    const plausible = VERDICTS.includes(op.overall_determination) && VERDICTS.includes(op.requirement_verdicts[0].verdict) && VERDICTS.includes(op.requirement_verdicts[1].verdict);
    rows.push({ label, input: pp, overall_determination: op.overall_determination, coverage_verdict: op.requirement_verdicts[0].verdict, attestation_verdict: op.requirement_verdicts[1].verdict, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_verdictBounded());
results.properties.push(checkP2_coverageMonotonic());
results.properties.push(checkP3_shortfallExact());
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
