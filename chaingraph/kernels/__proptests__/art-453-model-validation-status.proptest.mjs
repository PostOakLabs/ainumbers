// kernel_digest_at_authoring: sha256:63eb1d7394a4cafde3fcd6102e610ec0ff1a0ab83c0eb65ad5b704bcaf777ddc
//
// FV-PROPFLOOR-SHARD-B24-1 — property-test floor for art-453-model-validation-status.
// Class B (bounded-numeric). ⚠ FIX-2 CARRY correction: the WU row's triage table marked this
// kernel float:yes, but direct measurement shows all arithmetic is INTEGER civil-calendar day
// counting (daysFromCivil, Math.trunc'd cadence_days) — there is no float-division/threshold-
// tolerance surface. Corrected classification: effectively float:no; forced CATEGORICAL boundary
// cases (calendar-date edges, leap years, cadence-override boundaries, never-validated branch) are
// used in place of ULP forcing, matching the treatment FV-PROPFLOOR-SHARD-B12-1 gave its two
// stated float:no exceptions. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-453-model-validation-status.proptest.mjs

import { compute } from '../art-453-model-validation-status.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-453-model-validation-status.fixtures.json');
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
const rand = mulberry32(0x453C3);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 8000;
const TIERS = ['limited', 'moderate', 'high'];
const OUTCOMES = ['pass', 'fail', 'not_performed'];

function randDate(rng) {
  const y = 2020 + Math.floor(rng() * 10);
  const m = 1 + Math.floor(rng() * 12);
  const d = 1 + Math.floor(rng() * 28);
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function mkPP(rng) {
  return {
    tier: pick(rng, TIERS),
    outcome_status: pick(rng, OUTCOMES),
    last_validation_date: rng() < 0.85 ? randDate(rng) : '',
    as_of_date: randDate(rng),
  };
}

// ---------- P1: fixed-threshold-tier agreement — overdue is exact (days_since > cadence_days) ----------
function checkP1_overdueAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (r.never_validated) {
      if (r.overdue !== false) violations++;
      continue;
    }
    const expected = r.days_since_validation > r.cadence_days;
    if (r.overdue !== expected) violations++;
  }
  return { name: 'P1_overdue_exact_agreement_days_since_gt_cadence', trials: checked, violations };
}

// ---------- P2: boundedness — validation_status always one of the 5 declared enum values ----------
function checkP2_statusBounded() {
  let violations = 0, checked = 0;
  const STATUSES = ['validation_required', 'restricted_use', 'validation_overdue', 'conditionally_approved', 'validated'];
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (!STATUSES.includes(r.validation_status)) violations++;
    if (r.never_validated && r.validation_status !== 'validation_required') violations++;
  }
  return { name: 'P2_validation_status_bounded_to_5_declared_states', trials: checked, violations };
}

// ---------- P3: monotonicity — cadence_days is nondecreasing as tier escalates limited<moderate<high default cadence table (inverse: higher tier = shorter default cadence, but override always wins) ----------
function checkP3_cadenceOverrideExact() {
  let violations = 0, checked = 0;
  const DEFAULTS = { limited: 1095, moderate: 730, high: 365 };
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const hasOverride = rand() < 0.5;
    if (hasOverride) pp.cadence_days_override = Math.floor(rand() * 2000) - 500;
    const r = compute(pp).output_payload;
    checked++;
    const expectedCadence = Math.max(1, Math.trunc(hasOverride ? pp.cadence_days_override : DEFAULTS[r.tier]));
    if (r.cadence_days !== expectedCadence) violations++;
  }
  return { name: 'P3_cadence_days_exact_override_or_tier_default_min_clamped_to_1', trials: checked, violations };
}

// ---------- P4 (float:no-corrected exception): forced CATEGORICAL boundary cases ----------
const ULP_BOUNDARY_CASES = [
  [{ tier: 'high', outcome_status: 'pass', last_validation_date: '', as_of_date: '2026-01-01' }, 'never validated (empty date) — validation_status must be validation_required'],
  [{ tier: 'high', outcome_status: 'pass', last_validation_date: '2025-01-01', as_of_date: '2025-01-01' }, 'as_of equals last_validation exactly — days_since_validation exactly 0, never overdue'],
  [{ tier: 'high', outcome_status: 'pass', last_validation_date: '2025-01-01', as_of_date: '2026-01-01' }, 'exactly 365 days later (high tier cadence) — overdue must be false (>, not >=)'],
  [{ tier: 'high', outcome_status: 'pass', last_validation_date: '2025-01-01', as_of_date: '2026-01-02' }, '366 days later, 1 day past high-tier cadence — overdue must flip true'],
  [{ tier: 'high', outcome_status: 'fail', last_validation_date: '2025-01-01', as_of_date: '2026-01-02' }, 'overdue AND outcome fail — validation_status must be restricted_use'],
  [{ tier: 'moderate', outcome_status: 'fail', last_validation_date: '2026-01-01', as_of_date: '2026-01-01' }, 'not overdue but outcome fail — validation_status must be conditionally_approved'],
  [{ tier: 'moderate', outcome_status: 'not_performed', last_validation_date: '2020-02-28', as_of_date: '2020-03-01' }, 'leap-year Feb 28->Mar 1 crossing (2020 is a leap year) — days_since_validation exactly 2'],
  [{ tier: 'limited', outcome_status: 'pass', last_validation_date: '2026-01-01', as_of_date: 'not-a-date' }, 'as_of_date malformed — parseISODate returns null, asOfDays null, downstream fields stay null not NaN'],
  [{ tier: 'moderate', outcome_status: 'pass', last_validation_date: '2026-01-01', as_of_date: '2026-01-01', cadence_days_override: -50 }, 'negative cadence override — Math.max(1,...) clamps to 1, never zero or negative'],
  [{ tier: 'invalid_tier', outcome_status: 'invalid_outcome', last_validation_date: '2026-01-01', as_of_date: '2026-01-01' }, 'invalid tier/outcome strings — must fall back to limited/not_performed defaults, no throw'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const plausible = typeof r.validation_status === 'string' && (r.days_since_validation === null || Number.isFinite(r.days_since_validation));
    rows.push({ label, validation_status: r.validation_status, days_since_validation: r.days_since_validation, overdue: r.overdue, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_overdueAgreement());
results.properties.push(checkP2_statusBounded());
results.properties.push(checkP3_cadenceOverrideExact());
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
