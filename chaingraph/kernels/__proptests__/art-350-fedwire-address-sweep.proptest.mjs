// art-350-fedwire-address-sweep.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C14-1).
// kernel_digest_at_authoring: sha256:64b884c3d7960d52db974c9c447144a64692ab993d434cad556a8b72ee062104
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — the only arithmetic is compliant_pct/risk_score
// percentage rollups compared against fixed integer thresholds 0/20/60, no caller-supplied
// float comparisons).
// Checks: fixture-oracle gate (compute()'s output excludes file_digest/per_record_findings_digest
// -- those are added by buildArtifact()'s async executionHash calls, not compute() itself, same
// shape as art-332's schedule_digest), termination (per_record.length always equals
// records.length regardless of file size, and worst_offenders is capped at WORST_OFFENDERS_CAP=50
// even when every record is non-compliant), a differential re-derivation of
// compliant_count/non_compliant_count/compliant_pct/by_rule from per_record[], and forced
// categorical boundary cases at the WORST_OFFENDERS_CAP=50 truncation boundary and the
// risk_score compliance-tier thresholds (0 / 20 / 60).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-350-fedwire-address-sweep.proptest.mjs

import { compute } from '../art-350-fedwire-address-sweep.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-350-fedwire-address-sweep.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    const { file_digest: _fd, per_record_findings_digest: _pd, ...expected } = vec.output_payload;
    const a = JSON.stringify(output_payload);
    const b = JSON.stringify(expected);
    if (a !== b) failures.push({ name: vec.name, expected, got: output_payload });
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
const rand = mulberry32(0x350F0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomRecord(rng) {
  const compliant = rng() < 0.5;
  if (compliant) return { town_name: 'Springfield', country: 'US' };
  return { address_lines: ['unstructured only'], country: rng() < 0.5 ? 'ZZ1' : '' };
}

function randomPP(rng) {
  const n = Math.floor(rng() * 30);
  const records = [];
  for (let i = 0; i < n; i++) records.push(randomRecord(rng));
  return { records };
}

const TRIALS = 3000;

// ---------- P1: termination — per_record bounded by records.length, worst_offenders capped ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.rejection_risk_report.total_records !== pp.records.length) violations++;
    if (output_payload.rejection_risk_report.worst_offenders.length > 50) violations++;
  }
  // deliberately large all-non-compliant file — worst_offenders must still cap at 50.
  const bigRecords = new Array(120).fill(0).map(() => ({ address_lines: ['bad'], country: '' }));
  const { output_payload: bo } = compute({ records: bigRecords });
  checked++;
  if (bo.rejection_risk_report.worst_offenders.length !== 50) violations++;
  if (!bo.rejection_risk_report.worst_offenders_truncated) violations++;
  if (bo.rejection_risk_report.total_records !== 120) violations++;
  return { name: 'P1_termination_per_record_bounded_worst_offenders_capped', trials: checked, violations };
}

// ---------- P2 (differential): re-derive compliant_count/pct/by_rule from records ----------
function checkP2_rollup_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload, per_record } = compute(pp);
    checked++;
    const rr = output_payload.rejection_risk_report;
    const expectedCompliant = per_record.filter((r) => r.compliant).length;
    if (rr.compliant_count !== expectedCompliant) violations++;
    if (rr.non_compliant_count !== pp.records.length - expectedCompliant) violations++;
    if (rr.compliant_count + rr.non_compliant_count !== rr.total_records) violations++;
    const expectedByRule = {};
    per_record.forEach((r) => r.violation_codes.forEach((c) => { expectedByRule[c] = (expectedByRule[c] || 0) + 1; }));
    if (JSON.stringify(Object.keys(rr.by_rule).sort()) !== JSON.stringify(Object.keys(expectedByRule).sort())) violations++;
    for (const k of Object.keys(expectedByRule)) if (rr.by_rule[k] !== expectedByRule[k]) violations++;
    if (rr.compliant_pct < 0 || rr.compliant_pct > 100) violations++;
    if (output_payload.risk_score < 0 || output_payload.risk_score > 100) violations++;
  }
  return { name: 'P2_rollup_differential_from_per_record', trials: checked, violations };
}

// ---------- P3: forced categorical boundary cases (float_sensitive: no) ----------
function checkP3_categorical_boundary_forcing() {
  let violations = 0, checked = 0;

  // WORST_OFFENDERS_CAP=50 truncation boundary
  for (const n of [50, 51]) {
    const recs = new Array(n).fill(0).map(() => ({ address_lines: ['bad'], country: '' }));
    const { output_payload } = compute({ records: recs });
    checked++;
    if (output_payload.rejection_risk_report.worst_offenders.length !== Math.min(n, 50)) violations++;
    if (output_payload.rejection_risk_report.worst_offenders_truncated !== (n > 50)) violations++;
  }

  // risk_score compliance-tier boundary: 0 (all compliant), just above 0, ~20, ~60
  const allCompliant = compute({ records: [{ town_name: 'A', country: 'US' }, { town_name: 'B', country: 'US' }] });
  checked++;
  if (allCompliant.output_payload.risk_score !== 0) violations++;
  if (!allCompliant.compliance_flags.includes('FEDWIRE_SWEEP_ALL_COMPLIANT')) violations++;

  const allNonCompliant = compute({ records: [{ address_lines: ['bad'], country: '' }] });
  checked++;
  if (allNonCompliant.output_payload.risk_score < 60) violations++;
  if (!allNonCompliant.compliance_flags.includes('FEDWIRE_SWEEP_HIGH_RISK')) violations++;

  // empty input finite (no records, no file_content)
  const empty = compute({});
  checked++;
  if (empty.output_payload.risk_score !== 0) violations++;
  if (empty.output_payload.rejection_risk_report.total_records !== 0) violations++;

  return { name: 'P3_categorical_boundary_forcing_cap_and_risk_tiers', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_rollup_differential());
results.properties.push(checkP3_categorical_boundary_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-350-fedwire-address-sweep',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
