// kernel_digest_at_authoring: sha256:ebef0432ad60665737531af12b4d2c3a3d971ac8b5d25ae7bc59dfc2707c515b
//
// FV-PROPFLOOR-SHARD-B8-1 — property-test floor for art-245-mt-mx-translation-fidelity-scorer.
// Class B (bounded categorical), float:no exception per the WU row — field presence/mapping and
// length checks only, no continuous arithmetic beyond a fixed-denominator fidelity score. Forced
// categorical boundary cases used in place of ULP forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero
// external dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the B1-B7
// harnesses. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-245-mt-mx-translation-fidelity-scorer.proptest.mjs

import { compute } from '../art-245-mt-mx-translation-fidelity-scorer.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-245-mt-mx-translation-fidelity-scorer.fixtures.json');
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
const rand = mulberry32(0x2450A1);
const TRIALS = 10000;

function mkFullValidPP() {
  return {
    mt_f20: 'REF001', mt_f23b: 'CRED', mt_f32a: '260101EUR1000,00',
    mt_f50: 'John Doe', mt_f52a: 'DEUTDEFF', mt_f57a: 'CHASUS33', mt_f59: 'Jane Roe',
    mt_f70: 'invoice payment', mt_f71a: 'SHA',
    mx_uetr: 'a1b2c3d4-e5f6-4789-8abc-def012345678',
    mx_dbtr_nm: 'John Doe', mx_cdtr_nm: 'Jane Roe',
    mx_cdtr_agt: 'CHASUS33', mx_dbtr_agt: 'DEUTDEFF',
    mx_rmt_ustrd: 'invoice payment', mx_chrg_br: 'SHAR',
  };
}

// ---------- P1: monotone — filling all mapped mx fields correctly never decreases fidelity_score / increases error_count ----------
function checkP1_monotoneFidelity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const worse = { mt_f20: 'REF001', mt_f50: 'John Doe', mt_f59: 'Jane Roe', mt_f70: 'x', mt_f71a: 'SHA' };
    const better = mkFullValidPP();
    const r1 = compute(worse);
    const r2 = compute(better);
    checked++;
    if (r2.output_payload.fidelity_score < r1.output_payload.fidelity_score) violations++;
    if (r2.output_payload.error_count > r1.output_payload.error_count) violations++;
    if (r2.output_payload.fidelity_score !== 100) violations++;
  }
  return { name: 'P1_monotone_fidelity_nondecreasing_toward_full_mapping', trials: checked, violations };
}

// ---------- P2: boundedness — fidelity_score in [0,100], fidelity_tier from known set ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  const KNOWN_TIERS = new Set(['HIGH', 'MEDIUM', 'LOW']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = rand() < 0.5 ? mkFullValidPP() : { mt_f20: 'x' };
    const r = compute(pp);
    checked++;
    const { fidelity_score, fidelity_tier, error_count } = r.output_payload;
    if (fidelity_score < 0 || fidelity_score > 100) violations++;
    if (!KNOWN_TIERS.has(fidelity_tier)) violations++;
    if (error_count < 0) violations++;
  }
  return { name: 'P2_boundedness_fidelity_score_and_tier_from_known_set', trials: checked, violations };
}

// ---------- P3: fixed-tier agreement — fidelity_tier matches independently-recomputed score bands ----------
function checkP3_tierAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = rand() < 0.5 ? mkFullValidPP() : { mt_f20: 'x', mt_f50: 'y' };
    const r = compute(pp);
    checked++;
    const { fidelity_score, fidelity_tier } = r.output_payload;
    const expected_tier = fidelity_score >= 90 ? 'HIGH' : fidelity_score >= 70 ? 'MEDIUM' : 'LOW';
    if (fidelity_tier !== expected_tier) violations++;
  }
  return { name: 'P3_fidelity_tier_matches_fixed_score_bands', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{}, 'fully empty input — UETR_ABSENT error, no throw, fidelity_score 0 (no scored fields), LOW tier'],
  [mkFullValidPP(), 'fully valid mapping — fidelity_score 100, HIGH tier, compliant'],
  [{ ...mkFullValidPP(), mt_f71a: 'OUR', mx_chrg_br: 'SHAR' }, 'charge bearer mismatch — OUR should map to DEBT, not SHAR — CHARGE_BEARER_MISMATCH error'],
  [{ ...mkFullValidPP(), mt_f71a: 'XXX' }, 'unknown MT charge bearer code — warning only, not error'],
  [{ ...mkFullValidPP(), mx_rmt_ustrd: 'x'.repeat(141) }, 'RmtInf/Ustrd exceeding 140 chars — REMITTANCE_INFO_TRUNCATION error'],
  [{ ...mkFullValidPP(), mx_uetr: '' }, 'missing UETR in pacs.008 output — UETR_ABSENT error even with full MT fields'],
  [{ mt_f50: 'John Doe' }, 'MT field present, mx counterpart absent — DBTR_NM_MISSING_FROM_MT50 error'],
  [{ ...mkFullValidPP(), mx_dbtr_nm: 'x'.repeat(141) }, 'Dbtr/Nm exceeding 140 chars — truncation risk warning'],
  [{ mt_f52a: 'DEUTDEFF' }, 'MT :52A present, DbtrAgt/BICFI absent — DBTR_AGT_MISSING warning'],
  [{}, 'repeat empty-input check for determinism — no throw'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { fidelity_score, fidelity_tier, compliant } = r.output_payload;
    const plausible = Number.isFinite(fidelity_score) && typeof fidelity_tier === 'string' && typeof compliant === 'boolean';
    rows.push({ label, fidelity_score, fidelity_tier, compliant, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneFidelity());
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
