// art-544-slate-report-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C28-1).
// kernel_digest_at_authoring: sha256:c5c25fd2786de8c58de81203d0b98ca4ebf1060401e29d6cd9594067d49c30c1
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (matches the WU row, direct read confirms). lintReport() performs zero
// arithmetic on rate/quantity/collateral_value -- every numeric check is a direct
// Number.isFinite()/>/>= structural comparison against a caller-supplied value with no
// division, multiplication, or rounding anywhere in the file. Dates are parsed via Date.parse
// (a pure function of its string input), never computed. Forced categorical boundary cases are
// used in place of ULP-boundary forcing.
// Checks: fixture-oracle gate, termination (results/violations bounded by pp.reports.length),
// boundedness (reports_valid <= reports_checked), differential re-derivation of
// structurally_valid/missing_fields/type_errors via an independent reimplementation of
// lintReport, permutation-invariance of reports order (violations reordered but the same
// content-set and reports_valid count), and forced categorical boundary cases (quantity===0 vs
// quantity>0, negative collateral_value, security_identifier length 5/6/12/13 boundaries,
// unparseable effective_date, empty reports array).
// Zero external dependencies -- pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-544-slate-report-validator.proptest.mjs

import { compute } from '../art-544-slate-report-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-544-slate-report-validator.fixtures.json');
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
const rand = mulberry32(0x54400028);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const REQUIRED_FIELDS = ['loan_id', 'effective_date', 'rate_type', 'rate', 'collateral_type', 'counterparty_id', 'security_identifier', 'quantity', 'loan_type'];
const RATE_TYPES = ['FLAT', 'REBATE'];
const COLLATERAL_TYPES = ['CASH', 'SECURITIES', 'LETTER_OF_CREDIT'];
const LOAN_TYPES = ['NEW', 'MODIFICATION', 'TERMINATION'];

function randomReport(rng, idx) {
  const rec = {
    loan_id: `LOAN-${idx}`,
    effective_date: rng() < 0.1 ? 'not-a-date' : '2026-08-01',
    rate_type: rng() < 0.85 ? pick(rng, RATE_TYPES) : 'VARIABLE',
    rate: rng() < 0.05 ? NaN : (rng() - 0.3) * 10,
    collateral_type: rng() < 0.85 ? pick(rng, COLLATERAL_TYPES) : 'GOLD',
    collateral_value: rng() < 0.1 ? -Math.floor(rng() * 100) : Math.floor(rng() * 500000),
    counterparty_id: `CPTY-${idx}`,
    security_identifier: rng() < 0.15 ? 'AB' : `SEC${idx}${'X'.repeat(Math.floor(rng() * 8))}`,
    quantity: rng() < 0.1 ? -Math.floor(rng() * 100) : Math.floor(rng() * 100000) + 1,
    loan_type: rng() < 0.85 ? pick(rng, LOAN_TYPES) : 'ROLLOVER',
  };
  if (rng() < 0.1) delete rec.effective_date;
  if (rng() < 0.1) delete rec.security_identifier;
  return rec;
}
function randomPP(rng) {
  const n = Math.floor(rng() * 10);
  return { reports: Array.from({ length: n }, (_, i) => randomReport(rng, i)) };
}

const TRIALS = 3000;

// ---------- P1: termination -- results/violations bounded by reports.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.reports_checked !== pp.reports.length) violations++;
    if (output_payload.violations.length > pp.reports.length) violations++;
  }
  return { name: 'P1_results_bounded_by_reports_length', trials: checked, violations };
}

// ---------- P2: boundedness -- reports_valid <= reports_checked ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.reports_valid > output_payload.reports_checked) violations++;
    if (output_payload.reports_valid + output_payload.violations.length !== output_payload.reports_checked) violations++;
  }
  return { name: 'P2_reports_valid_bounded_by_checked', trials: checked, violations };
}

// ---------- P3 (differential): structurally_valid/missing_fields/type_errors re-derived ----------
function reimplementLint(rec) {
  rec = rec || {};
  const missing_fields = REQUIRED_FIELDS.filter((f) => rec[f] === undefined || rec[f] === null || rec[f] === '');
  const type_errors = [];
  if (rec.rate_type !== undefined && !RATE_TYPES.includes(rec.rate_type)) type_errors.push('rate_type');
  if (rec.collateral_type !== undefined && !COLLATERAL_TYPES.includes(rec.collateral_type)) type_errors.push('collateral_type');
  if (rec.loan_type !== undefined && !LOAN_TYPES.includes(rec.loan_type)) type_errors.push('loan_type');
  if (rec.rate !== undefined && !Number.isFinite(Number(rec.rate))) type_errors.push('rate');
  if (rec.quantity !== undefined && !(Number.isFinite(Number(rec.quantity)) && Number(rec.quantity) > 0)) type_errors.push('quantity');
  if (rec.collateral_value !== undefined && !(Number.isFinite(Number(rec.collateral_value)) && Number(rec.collateral_value) >= 0)) type_errors.push('collateral_value');
  if (rec.effective_date !== undefined && !Number.isFinite(Date.parse(String(rec.effective_date)))) type_errors.push('effective_date');
  if (rec.security_identifier !== undefined) {
    const sid = String(rec.security_identifier);
    if (!(sid.length >= 6 && sid.length <= 12 && /^[A-Za-z0-9]+$/.test(sid))) type_errors.push('security_identifier');
  }
  return { valid: missing_fields.length === 0 && type_errors.length === 0, missingCount: missing_fields.length, errCount: type_errors.length };
}
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    for (let idx = 0; idx < pp.reports.length; idx++) {
      const expected = reimplementLint(pp.reports[idx]);
      const violation = output_payload.violations.find((v) => v.index === idx);
      const actualValid = !violation;
      if (actualValid !== expected.valid) violations++;
      if (violation && (violation.missing_fields.length !== expected.missingCount || violation.type_errors.length !== expected.errCount)) violations++;
    }
  }
  return { name: 'P3_lint_verdict_differential', trials: checked, violations };
}

// ---------- P4: metamorphic -- permutation-invariance of reports order (same content-set) ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1200; i++) {
    const pp = randomPP(rand);
    if (pp.reports.length < 2) continue;
    const shuffled = { reports: [...pp.reports].reverse() };
    const r1 = compute(pp).output_payload;
    const r2v = compute(shuffled).output_payload;
    checked++;
    if (r1.reports_checked !== r2v.reports_checked) violations++;
    if (r1.reports_valid !== r2v.reports_valid) violations++;
    if (r1.violations.length !== r2v.violations.length) violations++;
  }
  return { name: 'P4_reports_order_invariance', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no) ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  const base = { loan_id: 'L', effective_date: '2026-08-01', rate_type: 'FLAT', rate: 1, collateral_type: 'CASH', counterparty_id: 'C', security_identifier: '037833100', loan_type: 'NEW' };
  // quantity === 0 -> invalid (must be positive)
  checked++;
  { const r = compute({ reports: [{ ...base, quantity: 0 }] }).output_payload; if (r.reports_valid !== 0) violations++; }
  // quantity === 1 (just above 0) -> valid
  checked++;
  { const r = compute({ reports: [{ ...base, quantity: 1 }] }).output_payload; if (r.reports_valid !== 1) violations++; }
  // negative collateral_value -> invalid
  checked++;
  { const r = compute({ reports: [{ ...base, quantity: 1, collateral_value: -1 }] }).output_payload; if (r.reports_valid !== 0) violations++; }
  // collateral_value === 0 (boundary, >=0 allowed) -> valid
  checked++;
  { const r = compute({ reports: [{ ...base, quantity: 1, collateral_value: 0 }] }).output_payload; if (r.reports_valid !== 1) violations++; }
  // security_identifier length 5 (below 6 boundary) -> invalid
  checked++;
  { const r = compute({ reports: [{ ...base, quantity: 1, security_identifier: 'ABCDE' }] }).output_payload; if (r.reports_valid !== 0) violations++; }
  // security_identifier length 6 (exact boundary) -> valid
  checked++;
  { const r = compute({ reports: [{ ...base, quantity: 1, security_identifier: 'ABCDEF' }] }).output_payload; if (r.reports_valid !== 1) violations++; }
  // security_identifier length 12 (exact boundary) -> valid
  checked++;
  { const r = compute({ reports: [{ ...base, quantity: 1, security_identifier: 'ABCDEFGHIJKL' }] }).output_payload; if (r.reports_valid !== 1) violations++; }
  // security_identifier length 13 (above boundary) -> invalid
  checked++;
  { const r = compute({ reports: [{ ...base, quantity: 1, security_identifier: 'ABCDEFGHIJKLM' }] }).output_payload; if (r.reports_valid !== 0) violations++; }
  // empty reports array -> finite gate, zero-checked, no throw
  checked++;
  { const r = compute({ reports: [] }).output_payload; if (r.reports_checked !== 0) violations++; }
  return { name: 'P5_forced_categorical_boundaries', trials: checked, violations };
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
  tool_id: 'art-544-slate-report-validator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
