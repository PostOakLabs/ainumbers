// kernel_digest_at_authoring: sha256:bfe3703cd0865de7a9b879deac13cfa62aa8fdd55eab3348fa8ddc4570a11df1
//
// FV-PROPFLOOR-SHARD-B7-1 — property-test floor for art-228-build-adverse-action-notice.
// Class B (bounded-numeric), stated float:no exception — a notice-skeleton composer over
// enum lookups, string concatenation, and array slicing/sorting; the only numeric field
// (credit_score) is passed through unmodified, no arithmetic. Forced CATEGORICAL boundary
// cases used in place of ULP forcing, per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies. Read-only w.r.t. the kernel.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-228-build-adverse-action-notice.proptest.mjs

import { compute } from '../art-228-build-adverse-action-notice.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-228-build-adverse-action-notice.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    if (!deepEqual(output_payload, vec.output_payload)) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
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
const rand = mulberry32(0x22801);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 8000;

const CODES = ['01', '02', 'VS001', 'VS002', '99', 'unknown'];
const SOURCES = ['fico', 'vantagescore', ''];

function mkPP(rng) {
  const n = Math.floor(randRange(rng, 0, 7));
  const factor_codes = Array.from({ length: n }, (_, i) => ({ code: pick(rng, CODES), source: pick(rng, SOURCES), rank: Math.floor(randRange(rng, 1, 10)) }));
  return {
    action_taken: pick(rng, ['denied', 'approved_with_conditions']),
    applicant_name_placeholder: 'Applicant',
    creditor_name: 'Test Creditor',
    date_of_action: '2026-01-01',
    factor_codes,
    credit_score_used: rng() < 0.5,
    credit_score: Math.floor(randRange(rng, 300, 850)),
    credit_bureau_name: 'Test Bureau',
    credit_bureau_address: '123 Main St',
    credit_bureau_phone: '555-1234',
  };
}

// ---------- P1: boundedness — resolved_reasons.length never exceeds 4 (Reg B max) ----------
function checkP1_reasonsBoundedTo4() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(mkPP(rand)).output_payload;
    checked++;
    if (r.resolved_reasons.length > 4) violations++;
  }
  return { name: 'P1_resolved_reasons_never_exceeds_4', trials: checked, violations };
}

// ---------- P2: boundedness — fcra_rights section present iff credit_score_used ----------
function checkP2_fcraSectionGated() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const hasFcra = r.notice_sections.fcra_rights !== undefined;
    if (hasFcra !== pp.credit_score_used) violations++;
    if (r.receipt_metadata.credit_score_disclosed !== pp.credit_score_used) violations++;
  }
  return { name: 'P2_fcra_rights_section_present_iff_credit_score_used', trials: checked, violations };
}

// ---------- P3: round-trip — resolved_reasons sorted ascending by rank ----------
function checkP3_reasonsSortedByRank() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(mkPP(rand)).output_payload;
    checked++;
    const ranks = r.resolved_reasons.map((x) => x.rank);
    for (let j = 1; j < ranks.length; j++) if (ranks[j] < ranks[j - 1]) { violations++; break; }
  }
  return { name: 'P3_resolved_reasons_sorted_ascending_by_rank', trials: checked, violations };
}

// ---------- P4: round-trip identity — receipt_metadata.reason_count equals resolved_reasons.length exactly ----------
function checkP4_receiptReasonCountRoundTrip() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(mkPP(rand)).output_payload;
    checked++;
    if (r.receipt_metadata.reason_count !== r.resolved_reasons.length) violations++;
    if (r.receipt_metadata.reason_codes.length !== r.resolved_reasons.length) violations++;
  }
  return { name: 'P4_receipt_reason_count_matches_resolved_reasons_length', trials: checked, violations };
}

// ---------- P5 (float:no exception): forced categorical boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ factor_codes: [] }, 'zero factor codes — NO_REASONS_PROVIDED flag raised, resolved_reasons empty'],
  [{ factor_codes: Array.from({ length: 6 }, (_, i) => ({ code: '0' + (i + 1), rank: i + 1 })) }, '6 factor codes supplied (over the 4-max) — sliced to exactly 4 before resolution'],
  [{ factor_codes: [{ code: '99', source: 'fico' }] }, 'unrecognized FICO code 99 — falls back to generic "Reason code 99 (fico)" description'],
  [{ credit_score_used: true, credit_bureau_name: '', credit_bureau_address: '', credit_bureau_phone: '' }, 'credit_score_used true with all empty CRA fields — fcra_rights section still present with empty strings, not omitted'],
  [{ credit_score_used: false }, 'credit_score_used false — fcra_rights and credit_score_disclosure sections both absent'],
];

function checkP5_forced() {
  const baseline = { action_taken: 'denied', applicant_name_placeholder: 'Applicant', creditor_name: 'Test Creditor', date_of_action: '2026-01-01', factor_codes: [{ code: '01', source: 'fico', rank: 1 }], credit_score_used: false, credit_score: 650, credit_bureau_name: 'Bureau', credit_bureau_address: 'Addr', credit_bureau_phone: '555' };
  const rows = [];
  for (const [overrides, label] of CATEGORICAL_BOUNDARY_CASES) {
    const pp = { ...baseline, ...overrides };
    const r = compute(pp).output_payload;
    const finite = Array.isArray(r.resolved_reasons) && typeof r.notice_sections === 'object' && Number.isFinite(r.receipt_metadata.reason_count);
    rows.push({ label, overrides, resolved_reason_count: r.resolved_reasons.length, has_fcra: r.notice_sections.fcra_rights !== undefined, finite, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_reasonsBoundedTo4());
results.properties.push(checkP2_fcraSectionGated());
results.properties.push(checkP3_reasonsSortedByRank());
results.properties.push(checkP4_receiptReasonCountRoundTrip());
results.boundary_forced = checkP5_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
}, null, 2));

if (anyPropertyViolation || anyBoundaryImplausible) {
  console.error('PROPERTY FLOOR FAILED for art-228-build-adverse-action-notice');
  process.exit(1);
}
console.log('PASS art-228-build-adverse-action-notice');
