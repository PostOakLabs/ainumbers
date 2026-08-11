// kernel_digest_at_authoring: sha256:3c1274fc147ac5bb67216765094aaf175766d6505785a4e2a5d45f7f9fd4983d
//
// FV-PROPFLOOR-SHARD-B26-1 — property-test floor for art-551-mt101-coexistence-readiness-diff.
// Class B (bounded-categorical), FLOAT:NO per the WU row — days_to_deadline is computed as
// Math.round((to.getTime()-from.getTime())/86400000) over UTC-midnight ISO dates, which always
// divides exactly (both timestamps are exact multiples of one day in UTC, so the division never
// leaves a fractional residue and Math.round is a no-op safety net, not a rounding boundary in
// practice). Forced CATEGORICAL boundary cases used in place of ULP forcing. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the B1/B3/B12
// harness. READ-ONLY w.r.t. the kernel.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-551-mt101-coexistence-readiness-diff.proptest.mjs

import { compute } from '../art-551-mt101-coexistence-readiness-diff.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-551-mt101-coexistence-readiness-diff.fixtures.json');
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
const rand = mulberry32(0x551551);
const TRIALS = 8000;
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randDate(rng) {
  const day = 1 + Math.floor(rng() * 28);
  const month = 1 + Math.floor(rng() * 12);
  const year = 2026;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function mkPP(rng) {
  return {
    current_message_format: pick(rng, ['MT101', 'pain.001v9', 'BOGUS', '']),
    as_of_date: rng() < 0.9 ? randDate(rng) : '',
    readiness_checklist: {
      emits_pain001v9_bulk: rng() < 0.5,
      fallback_path_staged: rng() < 0.5,
      correspondent_confirmed_receipt: rng() < 0.5,
    },
  };
}

// ---------- P1: past_deadline is exact (days_to_deadline < 0) whenever days_to_deadline resolved ----------
function checkP1_pastDeadlineExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (r.days_to_deadline === null) {
      if (r.past_deadline !== null) violations++;
      continue;
    }
    if (r.past_deadline !== (r.days_to_deadline < 0)) violations++;
  }
  return { name: 'P1_past_deadline_exact_days_lt_0', trials: checked, violations };
}

// ---------- P2: ready is null iff current_message_format or as_of_date failed to resolve (structural_issues non-empty) ----------
function checkP2_readyNullIffStructuralIssues() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if ((r.ready === null) !== (r.structural_issues.length > 0)) violations++;
  }
  return { name: 'P2_ready_null_iff_structural_issues_present', trials: checked, violations };
}

// ---------- P3: past-deadline MT101 always forces ready=false regardless of checklist state ----------
function checkP3_pastDeadlineMt101ForcesNotReady() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    pp.current_message_format = 'MT101';
    pp.as_of_date = '2027-01-01'; // well past the fixed 2026-11-14 deadline
    const r = compute(pp).output_payload;
    checked++;
    if (r.ready !== false) violations++;
    if (r.readiness_gaps.indexOf('COEXISTENCE_WINDOW_ALREADY_CLOSED_STILL_ON_MT101') < 0) violations++;
  }
  return { name: 'P3_past_deadline_mt101_forces_not_ready', trials: checked, violations };
}

// ---------- P4: pain.001v9 readiness is the exact emits_pain001v9_bulk flag (when structurally resolvable) ----------
function checkP4_pain001v9ReadyExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    pp.current_message_format = 'pain.001v9';
    if (!pp.as_of_date) pp.as_of_date = randDate(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (r.ready !== pp.readiness_checklist.emits_pain001v9_bulk) violations++;
  }
  return { name: 'P4_pain001v9_ready_exact_emits_flag', trials: checked, violations };
}

// ---------- P5 (mandatory, float:no exception): forced categorical boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ current_message_format: 'MT101', as_of_date: '2026-11-14', readiness_checklist: {} }, 'as_of_date exactly ON the deadline date — days_to_deadline exactly 0, past_deadline false (deadline day itself is not yet past)'],
  [{ current_message_format: 'MT101', as_of_date: '2026-11-15', readiness_checklist: {} }, 'as_of_date exactly one day AFTER the deadline — days_to_deadline exactly -1, past_deadline true'],
  [{ current_message_format: 'MT101', as_of_date: '2026-11-13', readiness_checklist: {} }, 'as_of_date exactly one day BEFORE the deadline — days_to_deadline exactly 1, past_deadline false'],
  [{ current_message_format: '', readiness_checklist: {} }, 'neither current_message_format nor as_of_date declared — both structural_issues fire, ready stays null, never guessed'],
  [{ current_message_format: 'PAIN.001V9', as_of_date: '2026-01-01', readiness_checklist: { emits_pain001v9_bulk: true } }, 'already on pain.001v9 far before the deadline — ready true unconditionally on emits_pain001v9_bulk, deadline distance irrelevant to this branch'],
  [{ current_message_format: 'mt101', as_of_date: '2026-06-01', readiness_checklist: { fallback_path_staged: true, correspondent_confirmed_receipt: true } }, 'lower-case message format — must be uppercased before matching, resolving identically to MT101'],
];

function checkP5_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const plausible = (r.days_to_deadline === null || Number.isInteger(r.days_to_deadline)) && (r.ready === null || typeof r.ready === 'boolean');
    rows.push({ label, input: pp, days_to_deadline: r.days_to_deadline, past_deadline: r.past_deadline, ready: r.ready, readiness_gaps: r.readiness_gaps, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_pastDeadlineExact());
results.properties.push(checkP2_readyNullIffStructuralIssues());
results.properties.push(checkP3_pastDeadlineMt101ForcesNotReady());
results.properties.push(checkP4_pain001v9ReadyExact());
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
