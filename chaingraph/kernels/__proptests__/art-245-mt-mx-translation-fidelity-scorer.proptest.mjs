// kernel_digest_at_authoring: sha256:df068aac811711ab2100e95147d96ce76694c32836ca079e405fbd586fbe351a
//
// FV-PROPFLOOR-SHARD-B28-1 — property-test floor for art-245-mt-mx-translation-fidelity-scorer.
// Class B (bounded-numeric), NOT float-sensitive per the WU row's classification (fidelity_score
// is Math.round(ratio*100) over presence counts, and length checks are exact string .length
// comparisons against fixed integer thresholds — no unrounded float division feeds a comparison).
// Forced CATEGORICAL boundary cases (string length exactly at threshold) used instead of ULP
// forcing, per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
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
const rand = mulberry32(0x245C3);
function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randStr(rng, len) { const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '; let s = ''; for (let i = 0; i < len; i++) s += chars[Math.floor(rng() * chars.length)]; return s; }
const TRIALS = 8000;
const CHRG_KEYS = ['OUR', 'SHA', 'BEN', ''];
const CHRG_VALS = ['DEBT', 'SHAR', 'CRED', 'XXXX', ''];

function mkPP(rng) {
  return {
    mt_f20: rng() < 0.8 ? randStr(rng, randInt(rng, 1, 20)) : '',
    mt_f50: rng() < 0.8 ? randStr(rng, randInt(rng, 1, 40)) : '',
    mt_f59: rng() < 0.8 ? randStr(rng, randInt(rng, 1, 40)) : '',
    mt_f52a: rng() < 0.6 ? randStr(rng, 11) : '',
    mt_f57a: rng() < 0.6 ? randStr(rng, 11) : '',
    mt_f70: rng() < 0.8 ? randStr(rng, randInt(rng, 1, 145)) : '',
    mt_f71a: pick(rng, CHRG_KEYS),
    mx_uetr: rng() < 0.8 ? randStr(rng, 36) : '',
    mx_dbtr_nm: rng() < 0.8 ? randStr(rng, randInt(rng, 1, 145)) : '',
    mx_cdtr_nm: rng() < 0.8 ? randStr(rng, randInt(rng, 1, 145)) : '',
    mx_dbtr_agt: rng() < 0.6 ? randStr(rng, 11) : '',
    mx_cdtr_agt: rng() < 0.6 ? randStr(rng, 11) : '',
    mx_rmt_ustrd: rng() < 0.8 ? randStr(rng, randInt(rng, 1, 145)) : '',
    mx_chrg_br: pick(rng, CHRG_VALS),
  };
}

// ---------- P1: boundedness — fidelity_score always in [0,100], integer ----------
function checkP1_scoreBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const s = r.output_payload.fidelity_score;
    if (!(Number.isInteger(s) && s >= 0 && s <= 100)) violations++;
  }
  return { name: 'P1_fidelity_score_bounded_0_to_100_integer', trials: checked, violations };
}

// ---------- P2: fixed-threshold-tier agreement — fidelity_tier matches score tiers exactly ----------
function checkP2_tierMatchesScore() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { fidelity_score, fidelity_tier } = r.output_payload;
    const expected = fidelity_score >= 90 ? 'HIGH' : fidelity_score >= 70 ? 'MEDIUM' : 'LOW';
    if (fidelity_tier !== expected) violations++;
  }
  return { name: 'P2_fidelity_tier_matches_fixed_score_tiers', trials: checked, violations };
}

// ---------- P3: round-trip — correctly_mapped never exceeds scored_fields length; score is exact ratio*100 rounded ----------
function checkP3_scoreExactRatio() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const scored = r.output_payload.mapping_results.filter((m) => m.mt_present);
    const correct = scored.filter((m) => m.mx_present).length;
    const expected = scored.length > 0 ? Math.round((correct / scored.length) * 100) : 0;
    if (r.output_payload.fidelity_score !== expected) violations++;
  }
  return { name: 'P3_fidelity_score_exact_rounded_ratio', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (length thresholds 140/70/35, empty presence) ----------
const BOUNDARY_CASES = [
  [{ mt_f50: 'A', mx_dbtr_nm: 'X'.repeat(140), mt_f20: '', mt_f59: '', mt_f52a: '', mt_f57a: '', mt_f70: '', mt_f71a: '', mx_uetr: '', mx_cdtr_nm: '', mx_dbtr_agt: '', mx_cdtr_agt: '', mx_rmt_ustrd: '', mx_chrg_br: '' }, 'Dbtr/Nm exactly at 140-char boundary — must NOT be flagged as truncation risk (> is strict)'],
  [{ mt_f50: 'A', mx_dbtr_nm: 'X'.repeat(141), mt_f20: '', mt_f59: '', mt_f52a: '', mt_f57a: '', mt_f70: '', mt_f71a: '', mx_uetr: '', mx_cdtr_nm: '', mx_dbtr_agt: '', mx_cdtr_agt: '', mx_rmt_ustrd: '', mx_chrg_br: '' }, 'Dbtr/Nm 1 char over 140-char boundary — must be flagged as truncation risk'],
  [{ mt_f70: 'A', mx_rmt_ustrd: 'X'.repeat(140), mt_f20: '', mt_f50: '', mt_f59: '', mt_f52a: '', mt_f57a: '', mt_f71a: '', mx_uetr: '', mx_dbtr_nm: '', mx_cdtr_nm: '', mx_dbtr_agt: '', mx_cdtr_agt: '', mx_chrg_br: '' }, 'RmtInf/Ustrd exactly at 140-char boundary — must NOT be flagged truncation'],
  [{ mt_f70: 'A', mx_rmt_ustrd: 'X'.repeat(141), mt_f20: '', mt_f50: '', mt_f59: '', mt_f52a: '', mt_f57a: '', mt_f71a: '', mx_uetr: '', mx_dbtr_nm: '', mx_cdtr_nm: '', mx_dbtr_agt: '', mx_cdtr_agt: '', mx_chrg_br: '' }, 'RmtInf/Ustrd 1 char over 140-char boundary — must be flagged truncation ERROR, non-compliant'],
  [{ mt_f71a: 'OUR', mx_chrg_br: 'DEBT', mt_f20: '', mt_f50: '', mt_f59: '', mt_f52a: '', mt_f57a: '', mt_f70: '', mx_uetr: '', mx_dbtr_nm: '', mx_cdtr_nm: '', mx_dbtr_agt: '', mx_cdtr_agt: '', mx_rmt_ustrd: '' }, 'OUR correctly maps to DEBT — no charge-bearer mismatch issue'],
  [{ mt_f71a: 'OUR', mx_chrg_br: 'SHAR', mt_f20: '', mt_f50: '', mt_f59: '', mt_f52a: '', mt_f57a: '', mt_f70: '', mx_uetr: '', mx_dbtr_nm: '', mx_cdtr_nm: '', mx_dbtr_agt: '', mx_cdtr_agt: '', mx_rmt_ustrd: '' }, 'OUR incorrectly mapped to SHAR — must flag CHARGE_BEARER_MISMATCH ERROR'],
  [{ mt_f71a: 'ZZZ', mx_chrg_br: '', mt_f20: '', mt_f50: '', mt_f59: '', mt_f52a: '', mt_f57a: '', mt_f70: '', mx_uetr: '', mx_dbtr_nm: '', mx_cdtr_nm: '', mx_dbtr_agt: '', mx_cdtr_agt: '', mx_rmt_ustrd: '' }, 'unknown MT charge-bearer code — must flag CHARGE_BEARER_MT_UNKNOWN WARNING, no mismatch'],
  [{ mt_f20: '', mt_f50: '', mt_f59: '', mt_f52a: '', mt_f57a: '', mt_f70: '', mt_f71a: '', mx_uetr: '', mx_dbtr_nm: '', mx_cdtr_nm: '', mx_dbtr_agt: '', mx_cdtr_agt: '', mx_rmt_ustrd: '', mx_chrg_br: '' }, 'all fields absent — no MT fields present, fidelity_score must be exactly 0 (empty-scored-set branch)'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of BOUNDARY_CASES) {
    const r = compute(pp);
    const { fidelity_score, fidelity_tier, truncation_risks } = r.output_payload;
    const plausible = Number.isInteger(fidelity_score) && fidelity_score >= 0 && fidelity_score <= 100 && typeof fidelity_tier === 'string' && Array.isArray(truncation_risks);
    rows.push({ label, input: pp, fidelity_score, fidelity_tier, truncation_risks, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_scoreBounded());
results.properties.push(checkP2_tierMatchesScore());
results.properties.push(checkP3_scoreExactRatio());
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
