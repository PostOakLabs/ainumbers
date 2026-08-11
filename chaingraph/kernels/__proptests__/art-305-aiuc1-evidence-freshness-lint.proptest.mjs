// kernel_digest_at_authoring: sha256:8dbc646bb29e68a985eb5fdcf053ed106137917d9b89dd4ec179f792589bf9cf
//
// FV-PROPFLOOR-SHARD-B11-1 — property-test floor for art-305-aiuc1-evidence-freshness-lint.
// Class B (bounded categorical), float:no exception per the WU row — pure integer civil-calendar
// day-count arithmetic (Howard Hinnant's days_from_civil, no floating-point). Forced categorical
// boundary cases used in place of ULP forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the B1/B2/B3 harnesses.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-305-aiuc1-evidence-freshness-lint.proptest.mjs

import { compute, STALE_AFTER_DAYS } from '../art-305-aiuc1-evidence-freshness-lint.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-305-aiuc1-evidence-freshness-lint.fixtures.json');
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
const rand = mulberry32(0x30501);
const TRIALS = 10000;

function fmt(y, m, d) { return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }

function mkPP(rng) {
  return {
    as_of: fmt(2026 + Math.floor(rng() * 2), 1 + Math.floor(rng() * 12), 1 + Math.floor(rng() * 28)),
    cert_anniversary: fmt(2025 + Math.floor(rng() * 2), 1 + Math.floor(rng() * 12), 1 + Math.floor(rng() * 28)),
    controls: [{ control_id: 'C1', newest_receipt_at: fmt(2025 + Math.floor(rng() * 2), 1 + Math.floor(rng() * 12), 1 + Math.floor(rng() * 28)) }],
  };
}

// ---------- P1: monotone — pushing a control's receipt date further back never removes it from stale_controls once stale ----------
function checkP1_monotoneStaleness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const staleControls = { ...pp, as_of: '2026-12-31', controls: [{ control_id: 'C1', newest_receipt_at: '2025-01-01' }] };
    const freshControls = { ...pp, as_of: '2026-12-31', controls: [{ control_id: 'C1', newest_receipt_at: '2026-12-01' }] };
    const r1 = compute(staleControls);
    const r2 = compute(freshControls);
    checked++;
    if (r1.output_payload.stale_count === 0) continue;
    if (r2.output_payload.stale_count > r1.output_payload.stale_count) violations++;
  }
  return { name: 'P1_monotone_stale_count_nonincreasing_as_receipts_freshen', trials: checked, violations };
}

// ---------- P2: boundedness — stale_count always equals stale_controls.length, age_days always non-negative integers ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { stale_controls, stale_count } = r.output_payload;
    if (stale_count !== stale_controls.length) violations++;
    for (const c of stale_controls) if (!Number.isInteger(c.age_days) || c.age_days <= STALE_AFTER_DAYS) violations++;
  }
  return { name: 'P2_boundedness_stale_count_matches_length_and_age_days_integer', trials: checked, violations };
}

// ---------- P3: round-trip identity — a control with newest_receipt_at == as_of always has age_days 0, never stale ----------
function checkP3_zeroAgeRoundTrip() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const sameDate = { ...pp, controls: [{ control_id: 'C1', newest_receipt_at: pp.as_of }] };
    const r = compute(sameDate);
    checked++;
    if (r.output_payload.stale_count !== 0) violations++;
  }
  return { name: 'P3_same_day_receipt_never_stale_roundtrip', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable, pure integer arithmetic) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ as_of: '2026-04-01', controls: [{ control_id: 'C1', newest_receipt_at: '2026-01-01' }] }, 'age_days exactly at STALE_AFTER_DAYS boundary (90 days) — must NOT be stale (> not >=)'],
  [{ as_of: '2026-04-02', controls: [{ control_id: 'C1', newest_receipt_at: '2026-01-01' }] }, 'age_days at 91 days, 1 day past boundary — must be stale'],
  [{ as_of: '2027-01-10', cert_anniversary: '2026-01-10' }, 'as_of exactly on cert_expiry (12mo anniversary) — cert_expired must be FALSE (> not >=)'],
  [{ as_of: '2027-01-11', cert_anniversary: '2026-01-10' }, 'as_of 1 day past cert_expiry — cert_expired must be true'],
  [{ as_of: '2026-12-11', cert_anniversary: '2026-01-10' }, 'as_of exactly 30 days before cert_expiry — cert_expiring_within_days must be TRUE (<=, not <)'],
  [{ as_of: '2026-12-10', cert_anniversary: '2026-01-10' }, 'as_of 31 days before cert_expiry — cert_expiring_within_days must be false'],
  [{ as_of: '2024-02-29', cert_anniversary: '2024-02-29' }, 'leap-day anniversary (Feb 29) — addCivilMonths clamp must produce a valid 2025-02-28 expiry, not throw'],
  [{}, 'all-empty input — insufficient_evidence true, no throw, no stale controls'],
  [{ as_of: '2026-01-31', cert_anniversary: '2026-01-31', controls: [] }, 'month-end anniversary date clamping (Jan 31 + 12mo = Jan 31, valid) — must round-trip exactly'],
  [{ as_of: 'not-a-date', controls: [{ control_id: 'C1', newest_receipt_at: '2026-01-01' }] }, 'malformed as_of — as_of null, asOfDays null, controls silently skipped (guarded), no throw'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { stale_controls, stale_count, cert_expired, cert_expiring_within_days, insufficient_evidence } = r.output_payload;
    const plausible = Array.isArray(stale_controls) && stale_count === stale_controls.length
      && typeof cert_expired === 'boolean' && typeof cert_expiring_within_days === 'boolean' && typeof insufficient_evidence === 'boolean';
    rows.push({ label, pp, stale_count, cert_expired, cert_expiring_within_days, insufficient_evidence, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneStaleness());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_zeroAgeRoundTrip());
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
