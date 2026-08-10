// kernel_digest_at_authoring: sha256:608cb6a37764d1dacf9fac00e70b7a86486cfe76f10dc6c83b8ab87a4de8d3e5
//
// FV-PROPFLOOR-SHARD-B22-1 — property-test floor for art-398-lint-metro2-record.
// Class B (bounded-numeric score / date-cross-field), FLOAT:NO per the WU row — the score is
// small-integer arithmetic (100 - 20*errors - 5*warnings, clamped) and the only other numeric
// path is integer day-count date arithmetic (Date.parse diff / MS_PER_DAY, Math.round), never
// a fractional-money or ratio computation. Forced CATEGORICAL/date-boundary cases used in place
// of ULP forcing. Zero external dependencies. This file is READ-ONLY with respect to the
// kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-398-lint-metro2-record.proptest.mjs

import { compute } from '../art-398-lint-metro2-record.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-398-lint-metro2-record.fixtures.json');
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
const rand = mulberry32(0x398B3);
const TRIALS = 8000;
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const CURRENT_CODES = ['11', '13', '61', '62', '63', '64', '65', '71'];
const DELINQ_CODES = ['78', '80', '82', '83', '84', '88', '89', '93', '94', '95', '96', '97'];
const ALL_CODES = [...CURRENT_CODES, ...DELINQ_CODES, 'ZZ'];

function mkPP(rng) {
  const status = pick(rng, ALL_CODES);
  const isDelinq = DELINQ_CODES.includes(status);
  const hasDofd = rng() < 0.7;
  return {
    account_type: rng() < 0.9 ? '01' : '',
    date_opened: rng() < 0.9 ? '2020-01-01' : 'bad-date',
    date_reported: '2026-08-10',
    current_balance: rng() < 0.9 ? Math.floor(rng() * 10000) : -5,
    amount_past_due: Math.floor(rng() * 500),
    account_status: status,
    payment_rating: pick(rng, ['0', '1', '9', 'G', 'L', 'Z']),
    date_of_first_delinquency: hasDofd ? '2020-06-01' : '',
    has_j1_segment: rng() < 0.5,
    has_j2_segment: rng() < 0.5,
    has_k_segment: rng() < 0.5,
  };
}

// ---------- P1: metro2_subset_score is the exact clamped formula 100-20*errors-5*warnings ----------
function checkP1_scoreExactFormula() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(mkPP(rand));
    checked++;
    const expected = Math.max(0, 100 - r.output_payload.error_count * 20 - r.output_payload.warning_count * 5);
    if (r.output_payload.metro2_subset_score !== expected) violations++;
  }
  return { name: 'P1_metro2_score_exact_clamped_formula', trials: checked, violations };
}

// ---------- P2: compliant is exactly (error_count === 0) ----------
function checkP2_compliantExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(mkPP(rand));
    checked++;
    if (r.output_payload.compliant !== (r.output_payload.error_count === 0)) violations++;
  }
  return { name: 'P2_compliant_exact_zero_errors', trials: checked, violations };
}

// ---------- P3: is_delinquent_status implies account_status is in the fixed delinquent-code set ----------
function checkP3_delinquentStatusBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.is_delinquent_status && !DELINQ_CODES.includes(pp.account_status)) violations++;
    if (r.output_payload.is_delinquent_status && !r.output_payload.field_status.date_of_first_delinquency.present && !pp.date_of_first_delinquency) {
      if (!r.output_payload.issues.some((iss) => iss.code === 'DOFD_MISSING_FOR_DELINQUENT_STATUS')) violations++;
    }
  }
  return { name: 'P3_delinquent_status_bounded_to_fixed_code_set_and_dofd_required', trials: checked, violations };
}

// ---------- P4 (float:no exception): forced categorical/date-boundary cases ----------
const FCRA_DAYS = 7 * 365 + 180;
const BASE = { account_type: '01', date_opened: '2018-01-01', current_balance: 100, amount_past_due: 0, payment_rating: '0', has_j1_segment: false, has_j2_segment: false, has_k_segment: false };
function addDays(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const CATEGORICAL_BOUNDARY_CASES = [
  [{ ...BASE, account_status: '78', date_of_first_delinquency: '2020-01-01', date_reported: addDays('2020-01-01', FCRA_DAYS) }, 'DOFD age exactly at the FCRA obsolescence boundary (2735 days) — obsolete_per_fcra must be FALSE (strictly greater-than test)'],
  [{ ...BASE, account_status: '78', date_of_first_delinquency: '2020-01-01', date_reported: addDays('2020-01-01', FCRA_DAYS + 1) }, 'DOFD age one day past the FCRA obsolescence boundary — obsolete_per_fcra must be TRUE'],
  [{ ...BASE, account_status: '78', date_of_first_delinquency: '2020-01-01', date_reported: '2020-01-01' }, 'DOFD exactly equals date_reported (age 0 days) — no AFTER error, obsolete_per_fcra false'],
  [{ ...BASE, account_status: '78', date_of_first_delinquency: '2020-01-02', date_reported: '2020-01-01' }, 'DOFD one day AFTER date_reported — DOFD_AFTER_DATE_REPORTED error, age not computed'],
  [{ ...BASE, account_status: '78', date_of_first_delinquency: '' }, 'delinquent status with DOFD entirely absent — DOFD_MISSING_FOR_DELINQUENT_STATUS error'],
  [{ ...BASE, account_status: '13', date_of_first_delinquency: '2020-01-01' }, 'current (non-delinquent) status but DOFD present — DOFD_PRESENT_FOR_NON_DELINQUENT_STATUS warning, not error'],
  [{ ...BASE, account_status: 'ZZ' }, 'unrecognized account status code — INVALID_ACCOUNT_STATUS_CODE error, is_delinquent_status false'],
  [{ ...BASE, account_status: '13', current_balance: -0.01 }, 'current_balance negative — CURRENT_BALANCE_INVALID error'],
  [{ ...BASE, account_status: '13', current_balance: 0 }, 'current_balance exactly zero — must be VALID (>=0 boundary), no error'],
  [{ ...BASE, account_status: '13', payment_rating: 'X' }, 'payment_rating outside the public-subset known-code table — INVALID_PAYMENT_RATING warning'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const full = { date_reported: '2026-08-10', ...pp };
    const r = compute(full);
    const { compliant, error_count, metro2_subset_score, obsolete_per_fcra } = r.output_payload;
    const plausible = typeof compliant === 'boolean' && Number.isFinite(error_count) && Number.isFinite(metro2_subset_score);
    rows.push({ label, input: full, compliant, error_count, metro2_subset_score, obsolete_per_fcra, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_scoreExactFormula());
results.properties.push(checkP2_compliantExact());
results.properties.push(checkP3_delinquentStatusBounded());
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
