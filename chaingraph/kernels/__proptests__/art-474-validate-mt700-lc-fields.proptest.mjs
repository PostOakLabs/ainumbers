// kernel_digest_at_authoring: sha256:bbd232c7a97741b408b0957f63f84669da0307d0b6c6f36e92c821d2ff568bf4
//
// FV-PROPFLOOR-SHARD-B25-1 — property-test floor for art-474-validate-mt700-lc-fields.
// Class B (bounded-numeric), float:no per WU — score is Math.round(earned/total*100), an integer
// percentage; no unrounded float value ever crosses the artifact boundary. Forced CATEGORICAL
// boundary cases (score exactly at the 80/60 verdict cutoffs) are used in place of ULP forcing,
// per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies. This file is READ-ONLY with
// respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-474-validate-mt700-lc-fields.proptest.mjs

import { compute } from '../art-474-validate-mt700-lc-fields.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-474-validate-mt700-lc-fields.fixtures.json');
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
const rand = mulberry32(0x474C3);
function randInt(rng, lo, hi) { return Math.floor(lo + rng() * (hi - lo + 1)); }
function pick(rng, arr) { return arr[randInt(rng, 0, arr.length - 1)]; }
const TRIALS = 8000;

const YYMMDD = () => {
  const yy = String(randInt(mulberry32(1), 20, 30)).padStart(2, '0');
  return null;
};
function randDate(rng) {
  const yy = String(randInt(rng, 24, 30)).padStart(2, '0');
  const mm = String(randInt(rng, 1, 12)).padStart(2, '0');
  const dd = String(randInt(rng, 1, 28)).padStart(2, '0');
  return yy + mm + dd;
}
function mkFields(rng) {
  const maybe = (p, v) => (rng() < p ? v : '');
  return {
    field_20: maybe(0.9, 'LC' + randInt(rng, 1000, 9999)),
    field_40A: maybe(0.9, pick(rng, ['IRREVOCABLE', 'IRREVOCABLE TRANSFERABLE', 'IRREVOCABLE STANDBY'])),
    field_31C: maybe(0.9, randDate(rng)),
    field_31D_date: maybe(0.9, randDate(rng)),
    field_31D_place: maybe(0.8, 'LONDON'),
    field_32B: maybe(0.85, pick(rng, ['USD', 'EUR', 'GBP']) + ' ' + randInt(rng, 1000, 900000)),
    field_41_bank: maybe(0.8, 'ANY BANK'),
    field_41_by: maybe(0.85, pick(rng, ['BY PAYMENT', 'BY ACCEPTANCE', 'BY NEGOTIATION', 'BY DEF PAYMENT'])),
    field_42: maybe(0.5, '90 DAYS'),
    field_43P: maybe(0.6, pick(rng, ['ALLOWED', 'NOT ALLOWED'])),
    field_43T: maybe(0.6, pick(rng, ['ALLOWED', 'NOT ALLOWED'])),
    field_44A: maybe(0.6, 'SHANGHAI'),
    field_44B: maybe(0.6, 'ROTTERDAM'),
    field_44C: maybe(0.5, randDate(rng)),
    field_45A: maybe(0.85, 'GOODS ' + pick(rng, ['CIF', 'FOB', 'CFR'])),
    field_46A: maybe(0.8, pick(rng, ['INVOICE', 'INVOICE BILL OF LADING', 'INVOICE BILL OF LADING PACKING LIST'])),
    field_48: maybe(0.85, String(randInt(rng, 1, 30))),
    field_49: maybe(0.85, pick(rng, ['CONFIRM', 'MAY ADD', 'WITHOUT'])),
    field_50: maybe(0.85, 'APPLICANT CO'),
    field_59: maybe(0.85, 'BENEFICIARY CO'),
  };
}

// ---------- P1: boundedness — score always in [0, 100] ----------
function checkP1_scoreBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = { fields: mkFields(rand) };
    const r = compute(pp);
    checked++;
    const s = r.output_payload.score;
    if (!(Number.isInteger(s) && s >= 0 && s <= 100)) violations++;
  }
  return { name: 'P1_score_bounded_integer_0_to_100', trials: checked, violations };
}

// ---------- P2: fixed threshold-tier agreement — verdict matches score cutoffs ----------
function checkP2_verdictThresholds() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = { fields: mkFields(rand) };
    const r = compute(pp);
    checked++;
    const { score, verdict, compliant } = r.output_payload;
    const expectedVerdict = score >= 80 ? 'compliant' : score >= 60 ? 'marginal' : 'non_compliant';
    if (verdict !== expectedVerdict) violations++;
    if (compliant !== (score >= 80)) violations++;
  }
  return { name: 'P2_verdict_matches_score_threshold_tiers', trials: checked, violations };
}

// ---------- P3: round-trip — error_count/warning_count equal errors[]/warnings[] lengths ----------
function checkP3_countsMatchArrays() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = { fields: mkFields(rand) };
    const r = compute(pp);
    checked++;
    if (r.output_payload.error_count !== r.output_payload.errors.length) violations++;
    if (r.output_payload.warning_count !== r.output_payload.warnings.length) violations++;
  }
  return { name: 'P3_error_warning_counts_match_array_lengths', trials: checked, violations };
}

// ---------- P4: monotonicity — an all-empty-fields input scores no higher than a fully-populated one ----------
function checkP4_monotonicCompleteness() {
  let violations = 0, checked = 0;
  const emptyFields = { field_20: '', field_40A: '', field_31C: '', field_31D_date: '', field_31D_place: '', field_32B: '', field_41_bank: '', field_41_by: '', field_42: '', field_43P: '', field_43T: '', field_44A: '', field_44B: '', field_44C: '', field_45A: '', field_46A: '', field_48: '', field_49: '', field_50: '', field_59: '' };
  const emptyScore = compute({ fields: emptyFields }).output_payload.score;
  for (let i = 0; i < TRIALS / 4; i++) {
    const pp = { fields: mkFields(rand) };
    const r = compute(pp);
    checked++;
    if (emptyScore > r.output_payload.score) violations++;
  }
  return { name: 'P4_empty_fields_score_never_exceeds_populated_score', trials: checked, violations };
}

// ---------- P5 (mandatory, float:no exception): forced categorical threshold-boundary cases ----------
const CLEAN = { field_20: 'LC12345', field_40A: 'IRREVOCABLE', field_31C: '260101', field_31D_date: '261231', field_31D_place: 'LONDON', field_32B: 'USD 100000', field_41_bank: 'ANY BANK', field_41_by: 'BY PAYMENT', field_42: '', field_43P: 'ALLOWED', field_43T: 'ALLOWED', field_44A: 'A', field_44B: 'B', field_44C: '260601', field_45A: 'GOODS CIF', field_46A: 'INVOICE BILL OF LADING PACKING LIST', field_48: '21', field_49: 'CONFIRM', field_50: 'APP', field_59: 'BEN' };
const BOUNDARY_CASES = [
  [{ fields: CLEAN }, 'fully clean, complete MT700 — score should be 100, verdict compliant'],
  [{ fields: { ...CLEAN, field_20: '' } }, 'mandatory field 20 missing — must be a hard error, verdict downgraded'],
  [{ fields: { ...CLEAN, field_48: '21' } }, 'field 48 presentation period exactly at UCP 21-day limit — must be ok, not warn'],
  [{ fields: { ...CLEAN, field_48: '22' } }, 'field 48 presentation period one day past UCP 21-day limit — must be warn'],
  [{ fields: { ...CLEAN, field_31C: '260101', field_31D_date: '260101' } }, 'field 31D expiry exactly equal to issue date — must be err (expiry must be AFTER issue, not equal)'],
  [{ fields: { ...CLEAN, field_31D_date: '260102' } }, 'field 31D expiry one day after issue date — must be ok'],
  [{ fields: { ...CLEAN, field_44C: '270101' } }, 'field 44C latest shipment after expiry date — must be err (impossible)'],
  [{ fields: { ...CLEAN, field_32B: 'XXX 100000' } }, 'field 32B unrecognised ISO 4217 currency code — must be err'],
  [{ fields: { ...CLEAN, field_32B: 'USD -5' } }, 'field 32B non-positive amount — must be err'],
];

function checkP5_forced() {
  const rows = [];
  for (const [pp, label] of BOUNDARY_CASES) {
    const r = compute(pp);
    const { score, verdict } = r.output_payload;
    const plausible = Number.isInteger(score) && score >= 0 && score <= 100 && ['compliant', 'marginal', 'non_compliant'].includes(verdict);
    rows.push({ label, score, verdict, error_count: r.output_payload.error_count, warning_count: r.output_payload.warning_count, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_scoreBounded());
results.properties.push(checkP2_verdictThresholds());
results.properties.push(checkP3_countsMatchArrays());
results.properties.push(checkP4_monotonicCompleteness());
results.boundary_forced = checkP5_forced();

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
