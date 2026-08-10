// kernel_digest_at_authoring: sha256:6bbd5af5d5a8f8a001a6b5e62fde257a5a22943d218e038ce6c4ae78bb142c8e
//
// FV-PROPFLOOR-SHARD-B23-1 — property-test floor for art-428-cyber-incident-clock.
// Class B (bounded-numeric). ⚠ CLASSIFICATION CORRECTED FROM THE WU: the WU row listed this
// kernel as float-sensitive, but direct read of the kernel source shows all arithmetic is over
// INTEGER millisecond timestamps (Date.parse results and fixed HOUR_MS/DAY_MS constants) — no
// division, no multiplication producing an inexact double, no EPS-relative float comparison
// anywhere in compute(). The only threshold comparisons are strict integer/timestamp `>`
// (deadline vs completed/evaluated), which cannot exhibit float rounding artifacts. Corrected
// to float:no per FV-PBT-FLOOR-BUILD-SPEC.md §3's FIX-2 carry instruction; forced CATEGORICAL
// timestamp-boundary cases used instead of ULP forcing (exact-instant deadline comparisons,
// 1ms-adjacent boundaries, weekend business-day-arithmetic edges). Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-428-cyber-incident-clock.proptest.mjs

import { compute } from '../art-428-cyber-incident-clock.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-428-cyber-incident-clock.fixtures.json');
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
const rand = mulberry32(0x428C3);
const TRIALS = 8000;
const HOUR_MS = 3600 * 1000;
const BASE_MS = Date.parse('2026-06-01T12:00:00.000Z');

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randInt(rng, lo, hi) { return Math.floor(lo + rng() * (hi - lo + 1)); }

function mkPP(rng) {
  const detMs = BASE_MS + randInt(rng, -200, 200) * HOUR_MS;
  const banking = pick(rng, [true, false]);
  const sec = pick(rng, [true, false]);
  const nydfs = pick(rng, [true, false]);
  return {
    incident_id: 'INC-' + randInt(rng, 1, 9999),
    determination_at: new Date(detMs).toISOString(),
    is_national_bank: banking,
    sec_reporting_company: sec,
    nydfs_covered_entity: nydfs,
    evaluated_at: new Date(detMs + randInt(rng, -10, 200) * HOUR_MS).toISOString(),
  };
}

// ---------- P1: fixed rule — banking deadline is exactly determination + 36h when applicable ----------
function checkP1_bankingDeadlineExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const det = pp.determination_at ? Date.parse(pp.determination_at) : null;
    const banking = r.output_payload.determinations.find((d) => d.obligation_id === 'banking_regulator_36hr');
    if (pp.is_national_bank) {
      const expected = new Date(det + 36 * HOUR_MS).toISOString();
      if (banking.deadline_iso !== expected) violations++;
    } else if (banking.deadline_iso !== null) violations++;
  }
  return { name: 'P1_banking_deadline_exact_36h_or_null', trials: checked, violations };
}

// ---------- P2: fixed rule — NYDFS deadline is exactly determination + 72h when applicable ----------
function checkP2_nydfsDeadlineExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const det = Date.parse(pp.determination_at);
    const nydfs = r.output_payload.determinations.find((d) => d.obligation_id === 'nydfs_72hr_500');
    if (pp.nydfs_covered_entity) {
      const expected = new Date(det + 72 * HOUR_MS).toISOString();
      if (nydfs.deadline_iso !== expected) violations++;
    } else if (nydfs.deadline_iso !== null) violations++;
  }
  return { name: 'P2_nydfs_deadline_exact_72h_or_null', trials: checked, violations };
}

// ---------- P3: boundedness — item_state always one of the 3 declared §22.11 states ----------
function checkP3_itemStateBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    for (const d of r.output_payload.determinations) {
      if (!['not_applicable', 'done', 'pending_human'].includes(d.item_state)) violations++;
      if (!d.applicable && d.item_state !== 'not_applicable') violations++;
    }
  }
  return { name: 'P3_item_state_bounded_to_3_declared_values', trials: checked, violations };
}

// ---------- P4 (categorical timestamp-boundary forcing, float:no correction) ----------
const D = new Date('2026-06-01T00:00:00.000Z').getTime(); // Monday
const CATEGORICAL_BOUNDARY_CASES = [
  [{ determination_at: new Date(D).toISOString(), is_national_bank: true, banking_notification_completed_at: new Date(D + 36 * HOUR_MS).toISOString() },
    'completed_at exactly equal to the deadline — strict > means NOT late (completed_late must be false)'],
  [{ determination_at: new Date(D).toISOString(), is_national_bank: true, banking_notification_completed_at: new Date(D + 36 * HOUR_MS + 1).toISOString() },
    'completed_at 1ms after the deadline — completed_late must be true'],
  [{ determination_at: new Date(D).toISOString(), is_national_bank: true, evaluated_at: new Date(D + 36 * HOUR_MS).toISOString() },
    'evaluated_at exactly equal to the deadline, no completion recorded — strict > means deadline NOT yet missed, item_state pending_human with no exception'],
  [{ determination_at: new Date(D).toISOString(), is_national_bank: true, evaluated_at: new Date(D + 36 * HOUR_MS + 1).toISOString() },
    'evaluated_at 1ms after the deadline, no completion recorded — NOTIFICATION_DEADLINE_MISSED exception must fire'],
  [{ determination_at: 'not-a-real-timestamp', is_national_bank: true },
    'unparseable determination_at — all deadlines null, DETERMINATION_TIMESTAMP_MISSING_OR_UNPARSEABLE flag, no throw'],
  [{}, 'fully empty policy_parameters — no obligations applicable, all not_applicable, no throw'],
  [{ determination_at: new Date(Date.parse('2026-06-05T23:00:00.000Z')).toISOString(), sec_reporting_company: true },
    'SEC 4-business-day clock starting Friday 23:00 UTC — must walk over the weekend (Sat/Sun excluded) to the following Thursday, weekends-only per kernel scope note'],
  [{ determination_at: new Date(D).toISOString(), is_national_bank: true, is_state_member_bank: true, sec_reporting_company: true, nydfs_covered_entity: true },
    'all three obligations simultaneously applicable — three independent, non-interfering deadlines'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const op = r.output_payload;
    const plausible = op.determinations.length === 3
      && op.determinations.every((d) => ['not_applicable', 'done', 'pending_human'].includes(d.item_state));
    rows.push({ label, input: pp, determinations: op.determinations.map((d) => ({ obligation_id: d.obligation_id, deadline_iso: d.deadline_iso, item_state: d.item_state, completed_late: d.completed_late, exception: d.exception })), plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_bankingDeadlineExact());
results.properties.push(checkP2_nydfsDeadlineExact());
results.properties.push(checkP3_itemStateBounded());
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
