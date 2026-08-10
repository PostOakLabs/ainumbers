// kernel_digest_at_authoring: sha256:ce05086143112505799d31fe336994900733702f77a3c4bce586b1cfe73b5682
//
// FV-PROPFLOOR-SHARD-B8-1 — property-test floor for art-246-lei-payment-binding-linter.
// Class B (bounded categorical), float:no exception per the WU row — ISO 7064 Mod 97-10 check-digit
// arithmetic is exact integer modular arithmetic, not floating point; Wolfsberg scoring is a fixed
// integer-weight sum. Forced categorical boundary cases used in place of ULP forcing per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG + explicit boundary
// arrays), same shape as the B1-B7 harnesses. This file is READ-ONLY with respect to the kernel it
// imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-246-lei-payment-binding-linter.proptest.mjs

import { compute } from '../art-246-lei-payment-binding-linter.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-246-lei-payment-binding-linter.fixtures.json');
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
const rand = mulberry32(0x2460A1);
const TRIALS = 10000;
const VALID_LEI = 'ABCDEFGH123456789042'; // mod-97 verified valid (remainder 1) — see WU authoring note

function mkFullPP() {
  return {
    originator_lei: VALID_LEI,
    beneficiary_lei: VALID_LEI,
    originator_name: 'Alice Corp',
    originator_account: 'ACC001',
    beneficiary_name: 'Bob Corp',
    beneficiary_account: 'ACC002',
  };
}

// ---------- P1: monotone — filling all Wolfsberg fields (with valid LEIs) never decreases score / increases error_count ----------
function checkP1_monotoneScore() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const worse = {};
    const better = mkFullPP();
    const r1 = compute(worse);
    const r2 = compute(better);
    checked++;
    if (r2.output_payload.wolfsberg_transparency_score < r1.output_payload.wolfsberg_transparency_score) violations++;
    if (r2.output_payload.error_count > r1.output_payload.error_count) violations++;
    if (r2.output_payload.wolfsberg_transparency_score !== 100) violations++;
    if (r2.output_payload.lei_valid !== true) violations++;
  }
  return { name: 'P1_monotone_score_nondecreasing_toward_full_transparency', trials: checked, violations };
}

// ---------- P2: boundedness — wolfsberg_transparency_score in [0,100], tier from known set ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  const KNOWN_TIERS = new Set(['HIGH', 'MEDIUM', 'LOW']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkFullPP();
    if (rand() < 0.5) delete pp.originator_name;
    if (rand() < 0.5) delete pp.beneficiary_account;
    if (rand() < 0.5) pp.originator_lei = 'NOTVALID000000000042';
    const r = compute(pp);
    checked++;
    const { wolfsberg_transparency_score, wolfsberg_transparency_tier, error_count } = r.output_payload;
    if (wolfsberg_transparency_score < 0 || wolfsberg_transparency_score > 100) violations++;
    if (!KNOWN_TIERS.has(wolfsberg_transparency_tier)) violations++;
    if (error_count < 0) violations++;
  }
  return { name: 'P2_boundedness_wolfsberg_score_and_tier_from_known_set', trials: checked, violations };
}

// ---------- P3: fixed-tier agreement — wolfsberg_transparency_tier matches independently-recomputed score bands ----------
function checkP3_tierAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkFullPP();
    if (rand() < 0.5) delete pp.originator_name;
    if (rand() < 0.5) delete pp.beneficiary_lei;
    if (rand() < 0.5) delete pp.originator_account;
    const r = compute(pp);
    checked++;
    const { wolfsberg_transparency_score, wolfsberg_transparency_tier } = r.output_payload;
    const expected_tier = wolfsberg_transparency_score >= 80 ? 'HIGH' : wolfsberg_transparency_score >= 50 ? 'MEDIUM' : 'LOW';
    if (wolfsberg_transparency_tier !== expected_tier) violations++;
  }
  return { name: 'P3_wolfsberg_tier_matches_fixed_score_bands', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — mod-97 is exact integer arithmetic) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{}, 'fully empty input — score 0, LOW tier, no throw'],
  [mkFullPP(), 'fully valid mod-97 LEIs and all Wolfsberg fields — score 100, HIGH tier, lei_valid true'],
  [{ originator_lei: 'TOOSHORT' }, 'LEI not 20 chars — ORIGINATOR_LEI_INVALID, format error'],
  [{ originator_lei: 'ZZZZZZZZ123456789042' }, 'LEI 20 alnum chars but wrong mod-97 check digits — ORIGINATOR_LEI_INVALID, check-digit error'],
  [{ originator_lei: VALID_LEI.toLowerCase() }, 'valid LEI in lowercase — must uppercase and validate correctly'],
  [{ beneficiary_lei: '' }, 'empty beneficiary_lei — not an error (LEI optional), lei_valid unaffected'],
  [{ originator_name: 'x'.repeat(500) }, 'very long originator_name — must not throw, counted present'],
  [{ ...mkFullPP(), originator_lei: 'BADCHECKDIGITS000042' }, 'invalid check digits on otherwise-valid-format LEI — error, score excludes nothing (LEI presence still counted for weight, only lei_valid flips)'],
  [{ originator_name: 'Alice', originator_account: 'A1', originator_lei: VALID_LEI }, 'only originator side complete — score exactly 55 (half of 110)'],
  [{}, 'repeat empty-input check for determinism — no throw'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { lei_valid, wolfsberg_transparency_score, wolfsberg_transparency_tier } = r.output_payload;
    const plausible = typeof lei_valid === 'boolean' && Number.isFinite(wolfsberg_transparency_score) && typeof wolfsberg_transparency_tier === 'string';
    rows.push({ label, lei_valid, wolfsberg_transparency_score, wolfsberg_transparency_tier, plausible });
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
results.properties.push(checkP3_tierAgreement());
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
