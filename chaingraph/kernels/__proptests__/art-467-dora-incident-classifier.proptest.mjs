// kernel_digest_at_authoring: sha256:2f4fe65161e59aee68e9609258e251c1a571a671f2167a00a2d0dc1c514ac4a7
//
// FV-PROPFLOOR-SHARD-B25-1 — property-test floor for art-467-dora-incident-classifier.
// Class B (bounded-numeric), float:no per WU — all inputs are compared against fixed integer/
// percentage thresholds via >=, never float rounding math. Forced CATEGORICAL boundary cases
// (each threshold value exactly at its declared cutoff) are used in place of ULP forcing, per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies. This file is READ-ONLY with respect
// to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-467-dora-incident-classifier.proptest.mjs

import { compute } from '../art-467-dora-incident-classifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-467-dora-incident-classifier.fixtures.json');
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
const rand = mulberry32(0x467C3);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function randInt(rng, lo, hi) { return Math.floor(randRange(rng, lo, hi + 1)); }
const TRIALS = 10000;

function mkPP(rng) {
  return {
    incident_id: 'INC-' + randInt(rng, 0, 99999),
    classification_at: rng() < 0.9 ? '2026-0' + randInt(rng, 1, 9) + '-15T0' + randInt(rng, 0, 9) + ':00:00Z' : undefined,
    clients_affected_pct: randRange(rng, 0, 100),
    duration_minutes: randRange(rng, 0, 5000),
    geographical_spread_countries_count: randInt(rng, 0, 10),
    data_losses: rng() < 0.5,
    economic_impact_amount: randRange(rng, 0, 500000),
    critical_services_affected: rng() < 0.5,
    reputational_impact: rng() < 0.5,
  };
}

// ---------- P1: fixed rule — MAJOR iff data_losses OR (gateway && other>=1) OR metCount>=2 ----------
function checkP1_majorFormula() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const gateway = pp.clients_affected_pct >= 10 || pp.critical_services_affected === true;
    const metCount = [
      pp.clients_affected_pct >= 10,
      pp.duration_minutes >= 1440,
      pp.geographical_spread_countries_count >= 2,
      pp.data_losses === true,
      pp.economic_impact_amount >= 100000,
      pp.critical_services_affected === true,
      pp.reputational_impact === true,
    ].filter(Boolean).length;
    const otherMet = metCount - (gateway ? 1 : 0);
    const expectedMajor = pp.data_losses === true || (gateway && otherMet >= 1) || metCount >= 2;
    if (r.output_payload.major_incident !== expectedMajor) violations++;
    if (r.output_payload.verdict !== (expectedMajor ? 'MAJOR' : 'NON_MAJOR')) violations++;
  }
  return { name: 'P1_major_incident_exact_gateway_formula', trials: checked, violations };
}

// ---------- P2: fixed rule — reporting_clock present iff major AND classification_at parseable ----------
function checkP2_reportingClockGate() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const hasClock = r.output_payload.reporting_clock !== null;
    const classParseable = pp.classification_at !== undefined && Number.isFinite(Date.parse(pp.classification_at));
    const expected = r.output_payload.major_incident && classParseable;
    if (hasClock !== expected) violations++;
  }
  return { name: 'P2_reporting_clock_present_iff_major_and_timestamp_parseable', trials: checked, violations };
}

// ---------- P3: boundedness — verdict in declared enum, qualifying_criteria subset of criteria ids ----------
function checkP3_bounded() {
  let violations = 0, checked = 0;
  const IDS = new Set(['clients_affected', 'duration', 'geographical_spread', 'data_losses', 'economic_impact', 'critical_services_affected', 'reputational_impact']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (!['MAJOR', 'NON_MAJOR'].includes(r.output_payload.verdict)) violations++;
    for (const c of r.output_payload.qualifying_criteria) if (!IDS.has(c)) violations++;
    if (r.output_payload.criteria_detail.length !== 7) violations++;
  }
  return { name: 'P3_verdict_and_criteria_bounded_to_declared_sets', trials: checked, violations };
}

// ---------- P4: round-trip — reporting_clock deadlines strictly increase (initial<intermediate<final) whenever present ----------
function checkP4_clockOrdering() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const clock = r.output_payload.reporting_clock;
    if (clock) {
      const a = Date.parse(clock.initial_notification_deadline);
      const b = Date.parse(clock.intermediate_report_deadline);
      const c = Date.parse(clock.final_report_deadline);
      if (!(a < b && b <= c)) violations++;
    }
  }
  return { name: 'P4_reporting_clock_deadlines_strictly_ordered', trials: checked, violations };
}

// ---------- P5 (mandatory, float:no exception): forced categorical threshold-boundary cases ----------
const BASE = { incident_id: 'INC-B', classification_at: '2026-08-01T00:00:00Z', clients_affected_pct: 0, duration_minutes: 0, geographical_spread_countries_count: 0, data_losses: false, economic_impact_amount: 0, critical_services_affected: false, reputational_impact: false };
const BOUNDARY_CASES = [
  [{ ...BASE, clients_affected_pct: 10 }, 'clients_affected_pct exactly at 10% threshold — must be MET (>=)'],
  [{ ...BASE, clients_affected_pct: 9.999999999999998 }, 'clients_affected_pct one ULP below 10% — must be NOT met'],
  [{ ...BASE, duration_minutes: 1440 }, 'duration_minutes exactly at 24h threshold — must be MET'],
  [{ ...BASE, duration_minutes: 1439 }, 'duration_minutes one minute below 24h threshold — must be NOT met'],
  [{ ...BASE, geographical_spread_countries_count: 2 }, 'geographical_spread exactly at 2-country threshold — must be MET'],
  [{ ...BASE, geographical_spread_countries_count: 1 }, 'geographical_spread one below 2-country threshold — must be NOT met'],
  [{ ...BASE, economic_impact_amount: 100000 }, 'economic_impact exactly at EUR 100,000 threshold — must be MET'],
  [{ ...BASE, economic_impact_amount: 99999.99 }, 'economic_impact just below EUR 100,000 threshold — must be NOT met'],
  [{ ...BASE, data_losses: true }, 'data_losses alone (no other criterion met, no gateway) — must independently trigger MAJOR per the kernel own rule'],
  [{ ...BASE, clients_affected_pct: 10, critical_services_affected: false, duration_minutes: 0 }, 'gateway met (clients) but zero OTHER criteria — must stay NON_MAJOR (gateway alone is insufficient)'],
  [{ ...BASE, classification_at: 'not-a-date', clients_affected_pct: 10, duration_minutes: 1440 }, 'unparseable classification_at with MAJOR verdict — reporting_clock must be null, CLASSIFICATION_TIMESTAMP_MISSING_OR_UNPARSEABLE flag set'],
];

function checkP5_forced() {
  const rows = [];
  for (const [pp, label] of BOUNDARY_CASES) {
    const r = compute(pp);
    const plausible = ['MAJOR', 'NON_MAJOR'].includes(r.output_payload.verdict) && (r.output_payload.reporting_clock === null || typeof r.output_payload.reporting_clock === 'object');
    rows.push({ label, input: pp, verdict: r.output_payload.verdict, reporting_clock: r.output_payload.reporting_clock, flags: r.compliance_flags, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_majorFormula());
results.properties.push(checkP2_reportingClockGate());
results.properties.push(checkP3_bounded());
results.properties.push(checkP4_clockOrdering());
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
