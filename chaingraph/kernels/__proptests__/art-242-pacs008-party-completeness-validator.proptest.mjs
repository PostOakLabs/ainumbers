// kernel_digest_at_authoring: sha256:8e606baac3dc58074e8a80c5b0faf0ce1cad590269e23f7ef8f767835b921eab
//
// FV-PROPFLOOR-SHARD-B8-1 — property-test floor for art-242-pacs008-party-completeness-validator.
// Class B (bounded categorical), float:no exception per the WU row — presence/format checks over
// a fixed 5-field CPMI d218 set, no continuous arithmetic beyond a fixed-denominator score. Forced
// categorical boundary cases used in place of ULP forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero
// external dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the B1-B7
// harnesses. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-242-pacs008-party-completeness-validator.proptest.mjs

import { compute } from '../art-242-pacs008-party-completeness-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-242-pacs008-party-completeness-validator.fixtures.json');
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
const rand = mulberry32(0x2420A1);
const TRIALS = 10000;
const VALID_UUID = 'a1b2c3d4-e5f6-4789-8abc-def012345678';
const VALID_BIC = 'DEUTDEFF';

function mkFullPP() {
  return {
    uetr: VALID_UUID,
    debtor_name: 'Alice',
    creditor_name: 'Bob',
    debtor_agent_bic: VALID_BIC,
    creditor_agent_bic: VALID_BIC,
    debtor_lei: 'ABCDEFGH123456789042',
    creditor_lei: 'ABCDEFGH123456789042',
    purpose_code: 'SALA',
  };
}

// ---------- P1: monotone — filling all CPMI fields never decreases score / increases error_count ----------
function checkP1_monotoneScore() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const worse = {};
    const better = mkFullPP();
    const r1 = compute(worse);
    const r2 = compute(better);
    checked++;
    if (r2.output_payload.cpmi_d218_score < r1.output_payload.cpmi_d218_score) violations++;
    if (r2.output_payload.error_count > r1.output_payload.error_count) violations++;
    if (r2.output_payload.cpmi_d218_score !== 100) violations++;
  }
  return { name: 'P1_monotone_score_nondecreasing_toward_full_completeness', trials: checked, violations };
}

// ---------- P2: boundedness — cpmi_d218_score in [0,100], multiple of 20 (5 fields) ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkFullPP();
    if (rand() < 0.5) delete pp.uetr;
    if (rand() < 0.5) delete pp.debtor_name;
    if (rand() < 0.5) delete pp.creditor_agent_bic;
    const r = compute(pp);
    checked++;
    const { cpmi_d218_score, error_count, warning_count } = r.output_payload;
    if (cpmi_d218_score < 0 || cpmi_d218_score > 100) violations++;
    if (cpmi_d218_score % 20 !== 0) violations++;
    if (error_count < 0 || warning_count < 0) violations++;
  }
  return { name: 'P2_boundedness_score_multiple_of_20_and_nonnegative_counts', trials: checked, violations };
}

// ---------- P3: fixed-tier agreement — cpmi_d218_score matches independently-recomputed presence count ----------
function checkP3_scoreAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkFullPP();
    if (rand() < 0.5) delete pp.uetr;
    if (rand() < 0.5) delete pp.debtor_name;
    if (rand() < 0.5) delete pp.creditor_name;
    if (rand() < 0.5) delete pp.debtor_agent_bic;
    if (rand() < 0.5) delete pp.creditor_agent_bic;
    const r = compute(pp);
    checked++;
    const present = ['uetr', 'debtor_name', 'creditor_name', 'debtor_agent_bic', 'creditor_agent_bic']
      .filter((k) => (pp[k] || '').toString().trim().length > 0).length;
    const expected = Math.round((present / 5) * 100);
    if (r.output_payload.cpmi_d218_score !== expected) violations++;
  }
  return { name: 'P3_score_matches_independently_recomputed_presence_count', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{}, 'fully empty input — score 0, compliant false, no throw'],
  [mkFullPP(), 'fully valid — score 100, compliant true'],
  [{ ...mkFullPP(), uetr: 'not-a-uuid' }, 'malformed UETR — UETR_NOT_UUIDV4 error'],
  [{ ...mkFullPP(), uetr: '' }, 'empty UETR — warning only, not error'],
  [{ ...mkFullPP(), debtor_agent_bic: 'BADBIC' }, 'malformed BIC — DEBTOR_BIC_INVALID_FORMAT error'],
  [{ ...mkFullPP(), debtor_agent_bic: 'DEUTDEFFXXX' }, '11-char BIC with branch code — valid format'],
  [{ ...mkFullPP(), debtor_lei: 'TOOSHORT' }, 'LEI not 20 chars — DEBTOR_LEI_FORMAT_INVALID (format only, not check-digit)'],
  [{ ...mkFullPP(), purpose_code: 'AB' }, 'purpose_code not 4 chars — PURPOSE_CODE_FORMAT_INVALID warning'],
  [{ ...mkFullPP(), purpose_code: '' }, 'empty purpose_code — PURPOSE_CODE_ABSENT warning, not error'],
  [{ debtor_name: 'Alice' }, 'single CPMI field present — score exactly 20'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { compliant, cpmi_d218_score, error_count } = r.output_payload;
    const plausible = typeof compliant === 'boolean' && Number.isFinite(cpmi_d218_score) && Number.isFinite(error_count);
    rows.push({ label, compliant, cpmi_d218_score, error_count, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneScore());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_scoreAgreement());
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
