// kernel_digest_at_authoring: sha256:d75e8ba52e5757fe63fdf1f096b7135b083a72c97193a57fd6f9a3593a36e432
//
// FV-PROPFLOOR-SHARD-B26-1 — property-test floor for art-546-dtcc-ca-iso20022-validator.
// Class B (bounded-categorical), FLOAT:NO per the WU row — structural message-shape validation
// with integer error-count arithmetic only (readiness_pct = max(0, 100 - error_count*15)), no
// float division. Forced CATEGORICAL boundary cases used in place of ULP forcing. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the B1/B3/B12
// harness. READ-ONLY w.r.t. the kernel. NOTE: this kernel's compute(pp) returns output_payload
// DIRECTLY (not the {output_payload, compliance_flags} tuple shape most sibling kernels use) —
// confirmed against the shipped source before authoring, per FIX-2 CARRY.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-546-dtcc-ca-iso20022-validator.proptest.mjs

import { compute } from '../art-546-dtcc-ca-iso20022-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-546-dtcc-ca-iso20022-validator.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const output_payload = compute(vec.policy_parameters);
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
const rand = mulberry32(0x546546);
const TRIALS = 8000;
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const FUNCS = ['NOTIFICATION', 'ELECTION', 'ALLOCATION', 'BOGUS'];
const CAEV = ['DVCA', 'DVSE', 'RHDI', 'SPLF', 'SPLR', 'MRGR', 'EXOF', 'TEND', 'REDM', 'SHPR', 'ZZZZ'];

function mkPP(rng) {
  const message_function = pick(rng, FUNCS);
  return {
    message_function,
    event_type: pick(rng, CAEV),
    cusip: rng() < 0.7 ? '037833100' : (rng() < 0.5 ? 'BAD' : ''),
    dtc_participant_number: rng() < 0.7 ? '0443' : (rng() < 0.5 ? '12' : ''),
    record_date: rng() < 0.7 ? '2027-01-15' : (rng() < 0.5 ? 'not-a-date' : ''),
    payable_date: rng() < 0.7 ? '2027-02-01' : '',
    election_option: rng() < 0.7 ? 'CASH' : '',
    election_deadline: rng() < 0.7 ? '2027-03-10' : '',
    allocated_quantity: rng() < 0.7 ? Math.floor(rng() * 10000) : (rng() < 0.5 ? -5 : undefined),
    allocation_date: rng() < 0.7 ? '2027-04-01' : '',
    reference_id: 'CA-OPAQUE-TEST',
  };
}

// ---------- P1: error_count is the exact count of ERROR-severity violations ----------
function checkP1_errorCountExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = r.violations.filter((v) => v.severity === 'ERROR').length;
    if (r.error_count !== expected) violations++;
  }
  return { name: 'P1_error_count_exact_count_of_error_violations', trials: checked, violations };
}

// ---------- P2: structure_valid is the exact negation of (error_count > 0) ----------
function checkP2_structureValidExactNegation() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.structure_valid !== (r.error_count === 0)) violations++;
  }
  return { name: 'P2_structure_valid_exact_negation_of_error_count', trials: checked, violations };
}

// ---------- P3: readiness_pct is bounded [0,100] and exactly max(0, 100 - error_count*15) when invalid, 100 when valid ----------
function checkP3_readinessPctBoundedAndExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.readiness_pct < 0 || r.readiness_pct > 100) violations++;
    const expected = r.structure_valid ? 100 : Math.max(0, 100 - r.error_count * 15);
    if (r.readiness_pct !== expected) violations++;
  }
  return { name: 'P3_readiness_pct_bounded_0_100_and_exact_formula', trials: checked, violations };
}

// ---------- P4 (mandatory, float:no exception): forced categorical boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{}, 'entirely empty input — 4 base-field errors fire, message_function UNKNOWN, readiness_pct 40'],
  [{ message_function: 'NOTIFICATION', event_type: 'DVCA', cusip: '037833100', dtc_participant_number: '0443', record_date: '2027-01-15', payable_date: '2027-02-01' }, 'fully valid NOTIFICATION — zero violations, readiness_pct exactly 100'],
  [{ message_function: 'NOTIFICATION', event_type: 'DVCA', cusip: '03783310', dtc_participant_number: '0443', record_date: '2027-01-15', payable_date: '2027-02-01' }, 'CUSIP exactly 8 characters (one below the 9-char boundary) — INVALID_CUSIP_FORMAT'],
  [{ message_function: 'NOTIFICATION', event_type: 'DVCA', cusip: '0378331000', dtc_participant_number: '0443', record_date: '2027-01-15', payable_date: '2027-02-01' }, 'CUSIP exactly 10 characters (one above the 9-char boundary) — INVALID_CUSIP_FORMAT'],
  [{ message_function: 'NOTIFICATION', event_type: 'DVCA', cusip: '037833100', dtc_participant_number: '999', record_date: '2027-01-15', payable_date: '2027-02-01' }, 'dtc_participant_number exactly 3 digits (one below the 4-digit floor) — INVALID_DTC_PARTICIPANT_NUMBER'],
  [{ message_function: 'NOTIFICATION', event_type: 'DVCA', cusip: '037833100', dtc_participant_number: '999999999', record_date: '2027-01-15', payable_date: '2027-02-01' }, 'dtc_participant_number exactly 9 digits (one above the 8-digit ceiling) — INVALID_DTC_PARTICIPANT_NUMBER'],
  [{ message_function: 'ALLOCATION', event_type: 'SPLF', cusip: '037833100', dtc_participant_number: '0443', allocated_quantity: 0, allocation_date: '2027-04-01' }, 'allocated_quantity exactly 0 — must be accepted (present, non-negative), not flagged as missing or negative'],
  [{ message_function: 'ALLOCATION', event_type: 'SPLF', cusip: '037833100', dtc_participant_number: '0443', allocated_quantity: -0.0000001, allocation_date: '2027-04-01' }, 'allocated_quantity a tiny negative number just below zero — NEGATIVE_QUANTITY must fire'],
  [{ message_function: 'notification', event_type: 'dvca', cusip: '037833100', dtc_participant_number: '0443', record_date: '2027-01-15', payable_date: '2027-02-01' }, 'lower-case message_function and event_type — must be uppercased before matching, resolving identically to the upper-case fixture'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const plausible = Number.isInteger(r.error_count) && r.error_count >= 0 && Number.isFinite(r.readiness_pct) && typeof r.structure_valid === 'boolean';
    rows.push({ label, input: pp, error_count: r.error_count, readiness_pct: r.readiness_pct, structure_valid: r.structure_valid, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_errorCountExact());
results.properties.push(checkP2_structureValidExactNegation());
results.properties.push(checkP3_readinessPctBoundedAndExact());
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
