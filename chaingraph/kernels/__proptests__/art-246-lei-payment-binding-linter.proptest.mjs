// kernel_digest_at_authoring: sha256:3eb46ada4f435f3207e14efe0cd5349dd78613e1b50bbe42bb85cd95e2cd3c05
//
// FV-PROPFLOOR-SHARD-B28-1 — property-test floor for art-246-lei-payment-binding-linter.
// Class B (bounded-numeric), NOT float-sensitive per the WU row's classification (LEI check-digit
// is integer mod-97 arithmetic per ISO 7064; Wolfsberg score is Math.round(weight-ratio*100) over
// fixed integer weights — no unrounded float division feeds a comparison). Forced CATEGORICAL
// boundary cases (weight-sum boundaries, mod-97 remainder edge, exact-length boundary) used instead
// of ULP forcing, per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
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
const rand = mulberry32(0x246C3);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randStr(rng, len, alphabet) { let s = ''; for (let i = 0; i < len; i++) s += alphabet[Math.floor(rng() * alphabet.length)]; return s; }
const TRIALS = 8000;
const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// Known-valid LEI (mod-97 remainder 1) reused from the kernel's own fixtures for "valid" trials.
const VALID_LEI = '00000000000000000001';

function mkLei(rng) {
  const r = rng();
  if (r < 0.3) return '';
  if (r < 0.55) return VALID_LEI;
  if (r < 0.8) return randStr(rng, 20, ALNUM); // random 20-char, almost certainly invalid check digit
  return randStr(rng, Math.floor(rng() * 30), ALNUM); // wrong length
}

function mkPP(rng) {
  return {
    originator_lei: mkLei(rng),
    beneficiary_lei: mkLei(rng),
    originator_name: rng() < 0.7 ? randStr(rng, 10, ALNUM) : '',
    originator_account: rng() < 0.7 ? randStr(rng, 15, ALNUM) : '',
    beneficiary_name: rng() < 0.7 ? randStr(rng, 10, ALNUM) : '',
    beneficiary_account: rng() < 0.7 ? randStr(rng, 15, ALNUM) : '',
  };
}

// ---------- P1: boundedness — wolfsberg_transparency_score always in [0,100], integer ----------
function checkP1_scoreBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const s = r.output_payload.wolfsberg_transparency_score;
    if (!(Number.isInteger(s) && s >= 0 && s <= 100)) violations++;
  }
  return { name: 'P1_wolfsberg_score_bounded_0_to_100_integer', trials: checked, violations };
}

// ---------- P2: fixed-threshold-tier agreement — tier matches score thresholds exactly ----------
function checkP2_tierMatchesScore() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { wolfsberg_transparency_score, wolfsberg_transparency_tier } = r.output_payload;
    const expected = wolfsberg_transparency_score >= 80 ? 'HIGH' : wolfsberg_transparency_score >= 50 ? 'MEDIUM' : 'LOW';
    if (wolfsberg_transparency_tier !== expected) violations++;
  }
  return { name: 'P2_tier_matches_fixed_score_thresholds', trials: checked, violations };
}

// ---------- P3: monotonicity — more present fields never decreases the score ----------
function checkP3_scoreMonotonicInPresence() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const base = mkPP(rand);
    const augmented = { ...base, originator_name: base.originator_name || 'X' };
    const rBase = compute(base);
    const rAug = compute(augmented);
    checked++;
    if (rAug.output_payload.wolfsberg_transparency_score < rBase.output_payload.wolfsberg_transparency_score) violations++;
  }
  return { name: 'P3_score_nondecreasing_when_adding_a_present_field', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (mod-97 edges, weight-sum boundaries) ----------
const BOUNDARY_CASES = [
  [{ originator_lei: VALID_LEI, beneficiary_lei: '', originator_name: '', originator_account: '', beneficiary_name: '', beneficiary_account: '' }, 'valid mod-97 LEI (remainder exactly 1) — must be valid:true, no LEI issue'],
  [{ originator_lei: '00000000000000000002', beneficiary_lei: '', originator_name: '', originator_account: '', beneficiary_name: '', beneficiary_account: '' }, 'LEI whose mod-97 remainder is 2, not 1 — must be valid:false, ORIGINATOR_LEI_INVALID'],
  [{ originator_lei: 'AAAAAAAAAAAAAAAAAAAA', beneficiary_lei: '', originator_name: '', originator_account: '', beneficiary_name: '', beneficiary_account: '' }, '20 uppercase A chars — well-formed length/charset, exercises full charToDigits A=10 path'],
  [{ originator_lei: randStr(rand, 19, ALNUM), beneficiary_lei: '', originator_name: '', originator_account: '', beneficiary_name: '', beneficiary_account: '' }, '19-char LEI, 1 short of the 20-char format boundary — must be valid:false, format error'],
  [{ originator_lei: '', beneficiary_lei: '', originator_name: '', originator_account: '', beneficiary_name: '', beneficiary_account: '' }, 'no fields present at all — score must be exactly 0, tier LOW'],
  [{ originator_lei: VALID_LEI, beneficiary_lei: VALID_LEI, originator_name: 'A', originator_account: 'A', beneficiary_name: 'A', beneficiary_account: 'A' }, 'all 6 fields present — score must be exactly 100, tier HIGH'],
  [{ originator_lei: VALID_LEI, beneficiary_lei: VALID_LEI, originator_name: '', originator_account: '', beneficiary_name: '', beneficiary_account: '' }, 'only both LEIs present (40 of 110 weight) — score must be exactly round(40/110*100)=36, tier LOW'],
  [{ originator_lei: VALID_LEI, beneficiary_lei: VALID_LEI, originator_name: 'A', originator_account: '', beneficiary_name: 'A', beneficiary_account: '' }, 'LEIs + both names present (80 of 110 weight) — score must be exactly round(80/110*100)=73, tier MEDIUM'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of BOUNDARY_CASES) {
    const r = compute(pp);
    const { wolfsberg_transparency_score, wolfsberg_transparency_tier, lei_results } = r.output_payload;
    const plausible = Number.isInteger(wolfsberg_transparency_score) && wolfsberg_transparency_score >= 0 && wolfsberg_transparency_score <= 100 && typeof wolfsberg_transparency_tier === 'string' && !!lei_results;
    rows.push({ label, input: pp, wolfsberg_transparency_score, wolfsberg_transparency_tier, plausible });
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
results.properties.push(checkP3_scoreMonotonicInPresence());
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
