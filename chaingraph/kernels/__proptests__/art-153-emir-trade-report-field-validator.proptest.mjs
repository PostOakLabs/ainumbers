// kernel_digest_at_authoring: sha256:b3a2970b68c72ff427673d0a3b075bf03c85055a724acf7605b9358b55973c22
//
// FV-PROPFLOOR-SHARD-B3-1 — property-test floor for art-153-emir-trade-report-field-validator.
// Class B (bounded categorical), float:no exception per the WU row — regex/set-membership field
// checks only, no continuous arithmetic. Forced categorical boundary cases used in place of ULP
// forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG +
// explicit boundary arrays), same shape as the B1/B2 harnesses. This file is READ-ONLY with
// respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-153-emir-trade-report-field-validator.proptest.mjs

import { compute } from '../art-153-emir-trade-report-field-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-153-emir-trade-report-field-validator.fixtures.json');
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
const rand = mulberry32(0x15301);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;
const GOOD_LEI = 'MAES062Z21O4RZ2U7M96';
const GOOD_LEI2 = '7LTWFZYICNSX8D621K86';

function mkReport(rng) {
  const report = {};
  if (rng() < 0.6) report.action_type = pick(rng, ['New', 'Modify', 'Correct', 'bogus']);
  if (rng() < 0.6) report.reporting_counterparty_lei = pick(rng, [GOOD_LEI, 'BADLEI']);
  if (rng() < 0.6) report.other_counterparty_lei = pick(rng, [GOOD_LEI2, 'BADLEI']);
  if (rng() < 0.6) report.uti = 'UTI-EXAMPLE-001';
  if (rng() < 0.6) report.upi = 'DJMM0VX7HY4A';
  if (rng() < 0.6) report.notional = 1000000;
  if (rng() < 0.6) report.notional_currency = pick(rng, ['EUR', 'usd', 'EURO']);
  if (rng() < 0.6) report.effective_date = pick(rng, ['2024-04-29', '04/29/2024']);
  if (rng() < 0.6) report.asset_class = pick(rng, ['IR', 'CR', 'XX']);
  return { report };
}

const FULL_VALID = {
  action_type: 'New', reporting_counterparty_lei: GOOD_LEI, other_counterparty_lei: GOOD_LEI2,
  uti: 'UTI-EXAMPLE-001', upi: 'DJMM0VX7HY4A', notional: 1000000, notional_currency: 'EUR',
  effective_date: '2024-04-29', asset_class: 'IR',
};

// ---------- P1: monotone — fixing any field to a valid value never increases missing_fields.length ----------
function checkP1_monotoneMissing() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkReport(rand);
    const r1 = compute(pp);
    const r2 = compute({ report: FULL_VALID });
    checked++;
    if (r2.output_payload.missing_fields.length > r1.output_payload.missing_fields.length) violations++;
    if (r1.output_payload.report_valid && !r2.output_payload.report_valid) violations++;
  }
  return { name: 'P1_monotone_missing_fields_nonincreasing_toward_full_valid_report', trials: checked, violations };
}

// ---------- P2: boundedness — missing_fields subset of the 9 named checks, field_count_checked fixed at 9 ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  const KNOWN = new Set(['action_type', 'reporting_cpty_lei', 'other_cpty_lei', 'uti', 'upi', 'notional', 'currency', 'effective_date', 'asset_class']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkReport(rand);
    const r = compute(pp);
    checked++;
    const { missing_fields, field_count_checked } = r.output_payload;
    if (field_count_checked !== 9) violations++;
    for (const f of missing_fields) if (!KNOWN.has(f)) violations++;
  }
  return { name: 'P2_boundedness_missing_fields_from_known_set_count_fixed_9', trials: checked, violations };
}

// ---------- P3: categorical threshold agreement — report_valid iff missing_fields is empty ----------
function checkP3_reportValidAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkReport(rand);
    const r = compute(pp);
    checked++;
    const { report_valid, missing_fields } = r.output_payload;
    if (report_valid !== (missing_fields.length === 0)) violations++;
  }
  return { name: 'P3_report_valid_equals_missing_fields_empty', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ report: { ...FULL_VALID, reporting_counterparty_lei: GOOD_LEI.slice(0, 19) } }, '19-char LEI (1 short of the 20-char LEI shape) — reporting_cpty_lei must be false'],
  [{ report: { ...FULL_VALID, reporting_counterparty_lei: GOOD_LEI + '1' } }, '21-char LEI (1 over) — reporting_cpty_lei must be false'],
  [{ report: { ...FULL_VALID, notional_currency: 'EU' } }, '2-letter currency code — currency check must be false'],
  [{ report: { ...FULL_VALID, notional_currency: 'EURO' } }, '4-letter currency code — currency check must be false'],
  [{ report: { ...FULL_VALID, effective_date: '2024-4-29' } }, 'date missing zero-pad — effective_date check must be false'],
  [{ report: { ...FULL_VALID, action_type: 'Unwind' } }, 'unrecognized action_type string — action_type check must be false, not throw'],
  [{ report: { ...FULL_VALID, asset_class: 'XX' } }, 'unrecognized asset_class string — asset_class check must be false'],
  [{ report: { ...FULL_VALID, notional: -1 } }, 'negative notional — notional check must be false, NOTIONAL_NON_FINITE_OR_MISSING flag set'],
  [{ report: { ...FULL_VALID, notional: 0 } }, 'notional exactly zero — notional check must be true (>=0)'],
  [{ report: {} }, 'entirely empty report — all 9 fields missing, report_valid false'],
  [{}, 'entirely empty policy_parameters — must default cleanly, not throw'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { report_valid, missing_fields, field_count_checked } = r.output_payload;
    const plausible = typeof report_valid === 'boolean' && Array.isArray(missing_fields) && field_count_checked === 9;
    rows.push({ label, pp, report_valid, missing_fields, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneMissing());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_reportValidAgreement());
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
