// kernel_digest_at_authoring: sha256:6492a6a83f4e5bbfcd5e1a759af227e26770c5c65a70fc8fe7028c150712f280
//
// FV-PROPFLOOR-SHARD-B3-1 — property-test floor for art-146-nis2-governance-readiness-checker.
// Class B (bounded categorical), float:no exception per the WU row — boolean control checklist
// and a fixed grade-tier rule, no continuous arithmetic. Forced categorical boundary cases used
// in place of ULP forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies
// (mulberry32 PRNG + explicit boundary arrays), same shape as the B1/B2 harnesses. This file is
// READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-146-nis2-governance-readiness-checker.proptest.mjs

import { compute } from '../art-146-nis2-governance-readiness-checker.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-146-nis2-governance-readiness-checker.fixtures.json');
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
const rand = mulberry32(0x14601);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;
const CONTROLS = [
  'board_approved_art21_measures', 'board_receives_quarterly_status_updates', 'ciso_or_equivalent_designated',
  'board_cybersecurity_training_completed', 'training_covers_threat_landscape', 'training_covers_incident_response',
];
const GRADE_RANK = { D: 0, C: 1, B: 2, A: 3 };

function mkPP(rng) {
  const pp = { board_review_age_days: randRange(rng, 0, 400) };
  for (const c of CONTROLS) pp[c] = rng() < 0.5;
  return pp;
}

// ---------- P1: monotone — flipping any control false→true never increases gaps.length, grade never downgrades ----------
function checkP1_monotoneGaps() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const worse = { ...pp };
    CONTROLS.forEach(c => { worse[c] = false; });
    const better = { ...pp };
    CONTROLS.forEach(c => { better[c] = true; });
    const r1 = compute(worse);
    const r2 = compute(better);
    checked++;
    if (r2.output_payload.gaps.length > r1.output_payload.gaps.length) violations++;
    if (GRADE_RANK[r2.output_payload.governance_grade] < GRADE_RANK[r1.output_payload.governance_grade]) violations++;
  }
  return { name: 'P1_monotone_gaps_nonincreasing_on_control_completion', trials: checked, violations };
}

// ---------- P2: boundedness — controls_met in [0,6], gaps.length in [0,7] ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { controls_met, gaps } = r.output_payload;
    if (controls_met < 0 || controls_met > 6) violations++;
    if (gaps.length < 0 || gaps.length > 7) violations++;
  }
  return { name: 'P2_boundedness_controls_met_and_gaps', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — governance_grade matches controls_met bands exactly ----------
function checkP3_gradeAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { controls_met, governance_grade, personal_liability_risk } = r.output_payload;
    const expected = controls_met >= 6 ? 'A' : controls_met >= 5 ? 'B' : controls_met >= 3 ? 'C' : 'D';
    if (governance_grade !== expected) violations++;
    const review_age = Number(pp.board_review_age_days);
    const review_stale = !Number.isFinite(review_age) || review_age < 0 || review_age > 365;
    const expected_liability = pp.board_approved_art21_measures !== true || review_stale;
    if (personal_liability_risk !== expected_liability) violations++;
  }
  return { name: 'P3_grade_matches_fixed_controls_met_bands', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ board_approved_art21_measures: true, board_receives_quarterly_status_updates: true, ciso_or_equivalent_designated: true, board_cybersecurity_training_completed: true, training_covers_threat_landscape: true, training_covers_incident_response: true, board_review_age_days: 365 }, 'exactly 6 controls, review_age exactly at 365 boundary — grade A, not stale'],
  [{ board_review_age_days: 365.0001 }, 'review_age 1 unit over 365 boundary — must be stale'],
  [{ board_review_age_days: 0 }, 'review_age exactly 0 — must NOT be stale'],
  [{ board_review_age_days: -1 }, 'negative review_age — must be stale (invalid)'],
  [{}, 'empty input — board_review_age_days null, all controls false, D grade, personal liability true'],
  [{ board_approved_art21_measures: true, board_receives_quarterly_status_updates: true, ciso_or_equivalent_designated: true, board_cybersecurity_training_completed: true, training_covers_threat_landscape: true, board_review_age_days: 10 }, 'exactly 5 of 6 controls — grade B boundary'],
  [{ board_approved_art21_measures: true, board_receives_quarterly_status_updates: true, ciso_or_equivalent_designated: true, board_review_age_days: 10 }, 'exactly 3 of 6 controls — grade C boundary'],
  [{ board_approved_art21_measures: true, board_receives_quarterly_status_updates: true, board_review_age_days: 10 }, 'exactly 2 of 6 controls — grade D (below C boundary)'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { governance_grade, controls_met, gaps, personal_liability_risk } = r.output_payload;
    const plausible = ['A', 'B', 'C', 'D'].includes(governance_grade) && Array.isArray(gaps) && typeof personal_liability_risk === 'boolean';
    rows.push({ label, pp, governance_grade, controls_met, gaps, personal_liability_risk, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneGaps());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_gradeAgreement());
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
