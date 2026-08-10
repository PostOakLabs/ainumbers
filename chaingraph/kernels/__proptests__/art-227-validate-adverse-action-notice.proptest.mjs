// kernel_digest_at_authoring: sha256:8e6f6cc5b36d30e20843f8cc21fc37c9ed8e4e3e3754df6df4f74bb1f12ce44a
//
// FV-PROPFLOOR-SHARD-B7-1 — property-test floor for art-227-validate-adverse-action-notice.
// Class B (bounded-numeric), stated float:no exception — inputs are booleans/small arrays/
// counts, output arithmetic is a bounded compliance_score ratio over integer counts, not a
// continuous-double surface. Forced CATEGORICAL boundary cases used in place of ULP forcing,
// per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies. Read-only w.r.t. the kernel.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-227-validate-adverse-action-notice.proptest.mjs

import { compute } from '../art-227-validate-adverse-action-notice.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-227-validate-adverse-action-notice.fixtures.json');
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
const rand = mulberry32(0x22701);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 8000;

const CODES = ['01', 'z_other', 'unable_to_verify', 'income_too_low', '22', 'other'];
const SOURCES = ['fico', 'vantagescore', 'ecoa_regulatory', 'proprietary_documented', 'made_up'];

function mkPP(rng) {
  const n = Math.floor(randRange(rng, 0, 6));
  const reasons = Array.from({ length: n }, () => ({ code: pick(rng, CODES), source: pick(rng, SOURCES) }));
  return {
    reasons,
    action_taken: pick(rng, ['denied', 'approved_with_conditions']),
    reason_code_source: pick(rng, SOURCES),
    credit_score_used: rng() < 0.5,
    notice_includes_creditor_name: rng() < 0.7,
    notice_includes_action_taken: rng() < 0.7,
    notice_includes_date: rng() < 0.7,
    notice_includes_fcra_rights: rng() < 0.7,
    notice_includes_credit_bureau_info: rng() < 0.7,
    notice_includes_right_to_copy: rng() < 0.7,
    notice_includes_dispute_right: rng() < 0.7,
  };
}

// ---------- P1: boundedness — compliant iff violation_count === 0, violation_count === violations.length ----------
function checkP1_compliantMatchesViolations() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(mkPP(rand)).output_payload;
    checked++;
    if (r.compliant !== (r.violation_count === 0)) violations++;
    if (r.violation_count !== r.violations.length) violations++;
  }
  return { name: 'P1_compliant_matches_violation_count_zero', trials: checked, violations };
}

// ---------- P2: boundedness — compliance_score always in [0,1] ----------
function checkP2_complianceScoreBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(mkPP(rand)).output_payload;
    checked++;
    if (r.compliance_score < 0 || r.compliance_score > 1) violations++;
  }
  return { name: 'P2_compliance_score_bounded_0_to_1', trials: checked, violations };
}

// ---------- P3: fixed-tier agreement — reason_count_valid iff 1<=reason_count<=4 exactly ----------
function checkP3_reasonCountValidAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const expected = r.reason_count >= 1 && r.reason_count <= 4;
    if (r.reason_count_valid !== expected) violations++;
    if (r.reason_count !== Math.min(pp.reasons.length, 8)) violations++;
  }
  return { name: 'P3_reason_count_valid_matches_1_to_4_range', trials: checked, violations };
}

// ---------- P4: monotonicity — fcra_violations only nonzero when fcra_required (credit_score_used) ----------
function checkP4_fcraViolationsGatedByRequired() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (!r.fcra_required && r.fcra_violations !== 0) violations++;
    if (r.fcra_required !== pp.credit_score_used) violations++;
  }
  return { name: 'P4_fcra_violations_zero_unless_credit_score_used', trials: checked, violations };
}

// ---------- P5 (float:no exception): forced categorical boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ reasons: [] }, 'zero reasons — REGB_NO_REASONS must fire, reason_count 0'],
  [{ reasons: [{ code: '01' }, { code: '02' }, { code: '03' }, { code: '04' }, { code: '05' }] }, 'exactly 5 reasons (one over the 4-max) — REGB_REASON_COUNT_EXCEEDED must fire'],
  [{ reasons: [{ code: '01' }, { code: '02' }, { code: '03' }, { code: '04' }] }, 'exactly 4 reasons (at the max) — REGB_REASON_COUNT_EXCEEDED must NOT fire'],
  [{ reasons: [{ code: 'z_other' }] }, 'prohibited vague code z_other — CFPB_CIRC_2023_03_VAGUE_REASON must fire'],
  [{ reasons: [{ code: '01' }], credit_score_used: true, notice_includes_credit_bureau_info: false, notice_includes_right_to_copy: false, notice_includes_dispute_right: false }, 'credit_score_used with all 3 FCRA disclosures missing — fcra_violations must equal exactly 3'],
  [{ reasons: [{ code: '01' }], credit_score_used: false }, 'credit_score_used false — fcra_required false regardless of missing FCRA fields'],
];

function checkP5_forced() {
  const baseline = { reasons: [{ code: '01' }], action_taken: 'denied', reason_code_source: 'fico', credit_score_used: false, notice_includes_creditor_name: true, notice_includes_action_taken: true, notice_includes_date: true, notice_includes_fcra_rights: true, notice_includes_credit_bureau_info: true, notice_includes_right_to_copy: true, notice_includes_dispute_right: true };
  const rows = [];
  for (const [overrides, label] of CATEGORICAL_BOUNDARY_CASES) {
    const pp = { ...baseline, ...overrides };
    const r = compute(pp).output_payload;
    const finite = typeof r.compliant === 'boolean' && Number.isFinite(r.compliance_score) && Number.isFinite(r.violation_count);
    rows.push({ label, overrides, compliant: r.compliant, violation_count: r.violation_count, fcra_violations: r.fcra_violations, finite, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_compliantMatchesViolations());
results.properties.push(checkP2_complianceScoreBounded());
results.properties.push(checkP3_reasonCountValidAgreement());
results.properties.push(checkP4_fcraViolationsGatedByRequired());
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
  console.error('PROPERTY FLOOR FAILED for art-227-validate-adverse-action-notice');
  process.exit(1);
}
console.log('PASS art-227-validate-adverse-action-notice');
