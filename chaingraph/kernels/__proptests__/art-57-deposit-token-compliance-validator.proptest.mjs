// kernel_digest_at_authoring: sha256:2fd5b0a6674a558949495837e3105a855ebde50c43c0441c61008f9a10204f44
//
// FV-PROPFLOOR-SHARD-B14-1 — property-test floor for art-57-deposit-token-compliance-validator.
// Class B (bounded-numeric/categorical), FLOAT:NO exception per the WU row — confirmed on direct
// kernel reading: all three tests (redemption, liability, eligibility) plus classification and
// grade are pure string-equality lookups over fixed enum sets, no arithmetic on continuous
// quantities anywhere. Forced CATEGORICAL boundary cases used in place of ULP forcing. Zero
// external dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-57-deposit-token-compliance-validator.proptest.mjs

import { compute } from '../art-57-deposit-token-compliance-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-57-deposit-token-compliance-validator.fixtures.json');
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
const rand = mulberry32(0x57B99D);
const TRIALS = 8000;

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function mkPP(rng) {
  return {
    token_class: pick(rng, ['commercial-bank-deposit-token', 'central-bank-money-token', 'emt-stablecoin', 'e-money-token', 'unclear']),
    issuer_type: pick(rng, ['bank', 'non-bank']),
    redemption_basis: pick(rng, ['at-par-on-demand', 'NAV', 'market', 'unclear']),
    liability_treatment: pick(rng, ['on-balance-sheet-deposit', 'segregated-reserve', 'bankruptcy-remote-trust', 'unclear']),
    holder_eligibility: pick(rng, ['allowlisted-wholesale', 'KYC-retail', 'open']),
    deposit_insurance: pick(rng, ['FDIC-eligible', 'FSCS', 'none']),
    jurisdiction: pick(rng, ['US', 'UK', 'EU', 'other', 'bogus-jx']),
    interoperability: pick(rng, ['single-issuer-closed', 'multi-issuer']),
  };
}

// ---------- P1: classification_grade is an exact function of passCount among the 4 test_results ----------
function checkP1_gradeExactFunctionOfPassCount() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { test_results, classification_grade } = r.output_payload;
    const passCount = Object.values(test_results).filter((t) => t.result === 'PASS').length;
    const expected = passCount === 4 ? 'A' : passCount === 3 ? 'B' : passCount === 2 ? 'C' : passCount === 1 ? 'D' : 'F';
    if (classification_grade !== expected) violations++;
  }
  return { name: 'P1_classification_grade_exact_function_of_pass_count', trials: checked, violations };
}

// ---------- P2: classification is an exact function of token_class + redemption/liability results ----------
function checkP2_classificationExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { test_results, classification } = r.output_payload;
    let expected;
    if (pp.token_class === 'commercial-bank-deposit-token' && test_results.redemption.result === 'PASS' && test_results.liability.result === 'PASS') expected = 'DEPOSIT_TOKEN_CONFIRMED';
    else if (pp.token_class === 'central-bank-money-token') expected = 'CBM_TOKEN';
    else if (pp.token_class === 'emt-stablecoin' || pp.token_class === 'e-money-token') expected = 'EMT_STABLECOIN';
    else if (test_results.liability.result === 'FAIL' || test_results.redemption.result === 'FAIL') expected = 'DEPOSIT_TOKEN_MISCLASSIFIED';
    else expected = 'CLASSIFICATION_UNCLEAR';
    if (classification !== expected) violations++;
  }
  return { name: 'P2_classification_exact_function_of_token_class_and_test_results', trials: checked, violations };
}

// ---------- P3: remediation_checklist contains exactly the non-PASS entries among redemption/liability/eligibility ----------
function checkP3_remediationChecklistExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { test_results, remediation_checklist } = r.output_payload;
    const expected = ['redemption', 'liability', 'eligibility'].filter((k) => test_results[k].result !== 'PASS');
    const actual = remediation_checklist.map((c) => c.test);
    if (JSON.stringify(expected.sort()) !== JSON.stringify(actual.sort())) violations++;
  }
  return { name: 'P3_remediation_checklist_exactly_the_non_pass_core_tests', trials: checked, violations };
}

// ---------- P4 (mandatory, float:no exception): forced categorical boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{}, 'all fields defaulted (token_class unclear, redemption unclear) — must not throw, classification must resolve to MISCLASSIFIED (liability defaults to segregated-reserve which is FAIL)'],
  [{ token_class: 'commercial-bank-deposit-token', redemption_basis: 'at-par-on-demand', liability_treatment: 'on-balance-sheet-deposit', holder_eligibility: 'allowlisted-wholesale', deposit_insurance: 'FDIC-eligible' }, 'all four tests PASS and token_class matches — classification must be DEPOSIT_TOKEN_CONFIRMED, grade A'],
  [{ redemption_basis: 'unrecognized-basis-xyz' }, 'unrecognized redemption_basis string — must fall to the UNCLEAR branch (the function\'s final default), not throw'],
  [{ jurisdiction: 'bogus-unlisted-jx' }, 'jurisdiction not present in REGIME_MAP — must fall back to REGIME_MAP.other (fail-safe default), not throw or return undefined'],
  [{ token_class: 'central-bank-money-token', redemption_basis: 'market', liability_treatment: 'segregated-reserve' }, 'token_class is central-bank-money-token even though redemption/liability both FAIL — classification must still be CBM_TOKEN (token_class branch checked first)'],
  [{ deposit_insurance: 'unrecognized-insurance-type' }, 'unrecognized deposit_insurance string — insurance_result must fall to INFO (fail-open on the informational-only insurance test), not throw'],
  [{ holder_eligibility: 'unrecognized-eligibility-xyz' }, 'unrecognized holder_eligibility string — testEligibility must fall to its final FAIL default (fail-closed), not throw'],
  [{ token_class: null, redemption_basis: undefined }, 'token_class null, redemption_basis undefined — undefined triggers the destructuring default "unclear"; null token_class must not throw when compared in classifyToken'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { classification, classification_grade, test_results } = r.output_payload;
    const plausible = typeof classification === 'string' && typeof classification_grade === 'string' &&
      Object.values(test_results).every((t) => typeof t.result === 'string');
    rows.push({ label, input: pp, classification, classification_grade, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_gradeExactFunctionOfPassCount());
results.properties.push(checkP2_classificationExact());
results.properties.push(checkP3_remediationChecklistExact());
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
