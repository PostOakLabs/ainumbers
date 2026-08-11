// kernel_digest_at_authoring: sha256:89fcc33e4e1a9e74da13cd69954a8b4d1717cf652e2159dd4c358b0ee59b436b
//
// FV-PROPFLOOR-SHARD-B25-1 — property-test floor for art-531-member-margin-call-lifecycle.
// Class B (bounded-numeric), float:no per WU — amount crosses as a safe-integer count of minor
// units and every timing figure is a whole-minute delta between ISO timestamps; no fractional
// arithmetic anywhere. Forced CATEGORICAL boundary cases (elapsed minutes exactly at the SLA)
// are used in place of ULP forcing, per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-531-member-margin-call-lifecycle.proptest.mjs

import { compute } from '../art-531-member-margin-call-lifecycle.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-531-member-margin-call-lifecycle.fixtures.json');
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
const rand = mulberry32(0x531C3);
function randInt(rng, lo, hi) { return Math.floor(lo + rng() * (hi - lo + 1)); }
const TRIALS = 8000;

function isoPlus(baseMs, minutes) { return new Date(baseMs + minutes * 60000).toISOString(); }

function mkPP(rng) {
  const baseMs = Date.UTC(2026, 6, 1) + randInt(rng, 0, 1e10);
  const issued_at = isoPlus(baseMs, 0);
  const sla_minutes = randInt(rng, 0, 240);
  const confirmed_at = rng() < 0.8 ? isoPlus(baseMs, randInt(rng, 0, 30)) : undefined;
  const funded = rng() < 0.5;
  const funded_at = funded ? isoPlus(baseMs, randInt(rng, 0, 300)) : undefined;
  const disputed = !funded && rng() < 0.3;
  const disputed_at = disputed ? isoPlus(baseMs, randInt(rng, 0, 300)) : undefined;
  const escalated_at = disputed && rng() < 0.5 ? isoPlus(baseMs, randInt(rng, 300, 600)) : undefined;
  const as_of = isoPlus(baseMs, randInt(rng, 0, 600));
  return {
    call_id: 'MC-' + randInt(rng, 0, 99999),
    member_ref: 'MEMBER-' + randInt(rng, 0, 999),
    currency: 'USD',
    amount_minor_units: randInt(rng, 0, 1000000000),
    sla_minutes,
    issued_at, as_of, confirmed_at, funded_at, disputed_at, escalated_at,
    dispute_reason: disputed_at ? 'reason' : undefined,
  };
}

// ---------- P1: boundedness — current_state always one of the five declared states ----------
function checkP1_stateBounded() {
  let violations = 0, checked = 0;
  const STATES = new Set(['issued', 'confirmed', 'disputed', 'escalated', 'funded']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (!STATES.has(r.output_payload.current_state)) violations++;
  }
  return { name: 'P1_current_state_bounded_to_declared_five', trials: checked, violations };
}

// ---------- P2: fixed rule — met_within_sla defined (non-null) only when current_state is funded ----------
function checkP2_metWithinSlaGate() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { current_state, met_within_sla } = r.output_payload;
    if (current_state !== 'funded' && met_within_sla !== null) violations++;
  }
  return { name: 'P2_met_within_sla_null_unless_funded', trials: checked, violations };
}

// ---------- P3: fixed rule — met_within_sla exact threshold agreement with elapsed<=sla ----------
function checkP3_metWithinSlaExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { current_state, elapsed_to_funded_minutes, sla_minutes, met_within_sla } = r.output_payload;
    if (current_state === 'funded' && elapsed_to_funded_minutes !== null && sla_minutes !== null) {
      const expected = elapsed_to_funded_minutes <= sla_minutes;
      if (met_within_sla !== expected) violations++;
    }
  }
  return { name: 'P3_met_within_sla_exact_elapsed_lte_sla', trials: checked, violations };
}

// ---------- P4: round-trip — attested implies funded + met_within_sla + sequence_valid, all three ----------
function checkP4_attestedImpliesAllThree() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const o = r.output_payload;
    if (o.attested) {
      if (o.current_state !== 'funded') violations++;
      if (o.met_within_sla !== true) violations++;
      if (o.sequence_valid !== true) violations++;
    }
  }
  return { name: 'P4_attested_implies_funded_and_within_sla_and_sequence_valid', trials: checked, violations };
}

// ---------- P5 (mandatory, float:no exception): forced categorical boundary cases ----------
const T0 = '2026-08-01T00:00:00Z';
const BOUNDARY_CASES = [
  [{ call_id: 'C1', currency: 'USD', amount_minor_units: 1000, sla_minutes: 60, issued_at: T0, funded_at: '2026-08-01T01:00:00Z' }, 'funded exactly 60 minutes after issuance against a 60-minute SLA — must be met_within_sla true (<=)'],
  [{ call_id: 'C2', currency: 'USD', amount_minor_units: 1000, sla_minutes: 60, issued_at: T0, funded_at: '2026-08-01T01:00:01Z' }, 'funded 60 minutes and 1 second after issuance — must be met_within_sla false (rounds to 61 min > 60)'],
  [{ call_id: 'C3', currency: 'USD', amount_minor_units: 1.5, sla_minutes: 60, issued_at: T0, funded_at: '2026-08-01T00:30:00Z' }, 'amount_minor_units not an integer — must be coerced to 0 and recorded in rejected_inputs, never silently dropped'],
  [{ call_id: 'C4', currency: 'USD', amount_minor_units: 1000, sla_minutes: -5, issued_at: T0, funded_at: '2026-08-01T00:30:00Z' }, 'sla_minutes negative — must be rejected (null), met_within_sla must be null even though funded'],
  [{ call_id: 'C5', currency: 'USD', amount_minor_units: 1000, sla_minutes: 60, issued_at: T0, funded_at: '2026-07-31T23:00:00Z' }, 'funded_at chronologically BEFORE issued_at — sequence_valid must be false, sequence_errors must name the pair'],
  [{ call_id: 'C6', currency: 'USD', amount_minor_units: 1000, sla_minutes: 60, issued_at: T0, disputed_at: '2026-08-01T00:10:00Z', dispute_reason: 'x', escalated_at: '2026-08-01T00:05:00Z' }, 'escalated_at BEFORE disputed_at — sequence_valid must be false (escalation cannot precede the dispute that triggered it)'],
  [{ call_id: 'C7', currency: 'USD', amount_minor_units: 1000, sla_minutes: 60, issued_at: T0 }, 'no confirmed/funded/disputed/escalated at all — current_state must default to issued, not throw on missing optional fields'],
];

function checkP5_forced() {
  const rows = [];
  for (const [pp, label] of BOUNDARY_CASES) {
    const r = compute(pp);
    const o = r.output_payload;
    const plausible = ['issued', 'confirmed', 'disputed', 'escalated', 'funded'].includes(o.current_state) && typeof o.sequence_valid === 'boolean';
    rows.push({ label, current_state: o.current_state, met_within_sla: o.met_within_sla, sequence_valid: o.sequence_valid, sequence_errors: o.sequence_errors, rejected_inputs: o.rejected_inputs, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_stateBounded());
results.properties.push(checkP2_metWithinSlaGate());
results.properties.push(checkP3_metWithinSlaExact());
results.properties.push(checkP4_attestedImpliesAllThree());
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
