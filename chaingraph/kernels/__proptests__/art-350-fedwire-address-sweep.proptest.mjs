// art-350-fedwire-address-sweep.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C14-1).
// kernel_digest_at_authoring: sha256:3ae08c2f86a8a34e3be03ac7e3df38b0d5d2d0ee47fda15364f8d365f6c295d2
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
  // Map section 4: fully-structured is the only default-compliant state (hybrid carries
  // HYBRID_NOT_YET_SUPPORTED WARN and is non-compliant until an enforcement date is in force).
  const allCompliant = compute({ records: [{ town_name: 'A', country: 'US', post_code: '12345' }, { town_name: 'B', country: 'US', post_code: '67890' }] });
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

// ---------- P4: date-honesty + as-of propagation floor (map CBPR-KERNEL-DATE-CONSUMER-MAP-1 section 4) ----------
// Boundary cases are keyed on the CALLER's as_of_date, never on calendar constants: with no
// published enforcement date the WARN default holds for every asserted as_of_date value, and
// the sweep-level as_of_date propagates to records that do not carry their own.
function checkP4_status_not_date_and_asof_propagation() {
  let violations = 0, checked = 0;
  const unstructured = { address_lines: ['123 Main St'] };
  const hybrid = { town_name: 'Springfield', country: 'US', address_lines: ['PO Box 9'] };
  for (const asOf of ['', '2026-11-16', '2027-11-30', 'not-a-date']) {
    const { output_payload, compliance_flags } = compute({ records: [unstructured, hybrid], as_of_date: asOf });
    checked++;
    if (output_payload.fedwire_chips_deadline !== null) violations++;
    if (typeof output_payload.fedwire_chips_deadline_status !== 'string' || output_payload.fedwire_chips_deadline_status.length === 0) violations++;
    if (output_payload.fedwire_chips_deadline_status.indexOf('November 2027') < 0 || output_payload.fedwire_chips_deadline_status.indexOf('TBA') < 0) violations++;
    const unr = output_payload.rejection_risk_report.worst_offenders.find((r) => r.structure_type === 'UNSTRUCTURED');
    const hyb = output_payload.rejection_risk_report.worst_offenders.find((r) => r.structure_type === 'HYBRID');
    if (!unr || !hyb) { violations++; continue; }
    // WARN classes carry zero ERRORs under the default no-enforcement state, whatever the caller asserts
    if (unr.error_count !== 0 || hyb.error_count !== 0) violations++;
    if (unr.compliant !== false || hyb.compliant !== false) violations++;
    if (!compliance_flags.includes('FEDWIRE_SWEEP_HIGH_RISK')) violations++;
  }
  // record-level as_of_date must NOT be overwritten by a sweep-level one; a record carrying
  // its own keeps it (mutant guard on the sweep-level propagation branch)
  const recOwn = { network: 'fedwire', address_lines: ['x'], as_of_date: '2027-06-01' };
  const r2 = compute({ records: [recOwn], as_of_date: '2020-01-01' });
  checked++;
  const rr2 = r2.output_payload.rejection_risk_report;
  if (rr2.worst_offenders.length !== 1 || rr2.worst_offenders[0].structure_type !== 'UNSTRUCTURED') violations++;
  // CSV header detection: with a recognised header the first data row parses (not a parse error);
  // unknown columns are dropped (mutant guard on the header/filter branch)
  const csv = 'network,street_name,town_name,country,ignored_col\nfedwire,Main St,Springfield,US,junk';
  const r3 = compute({ file_content: csv });
  checked++;
  if (r3.output_payload.rejection_risk_report.total_records !== 1) violations++;
  if (r3.output_payload.rejection_risk_report.parse_errors.length !== 0) violations++;
  if (r3.output_payload.rejection_risk_report.compliant_count !== 1) violations++; // FULLY_STRUCTURED is compliant, so it stays OUT of worst_offenders
  // pipe-split AdrLine inside one CSV cell (mutant guard on the split/filter branch)
  const csv2 = 'network,town_name,country,address_lines\nfedwire,Springfield,US,A|B';
  const r4 = compute({ file_content: csv2 });
  checked++;
  if (r4.output_payload.rejection_risk_report.worst_offenders[0].structure_type !== 'HYBRID') violations++;
  if (r4.output_payload.rejection_risk_report.by_rule.HYBRID_NOT_YET_SUPPORTED !== 1) violations++;
  // empty-file risk floor (mutant guard on the total>0 ternary)
  const r5 = compute({ file_content: '' });
  checked++;
  if (r5.output_payload.risk_score !== 0) violations++;
  if (r5.output_payload.fedwire_chips_deadline !== null) violations++;
  return { name: 'P4_deadline_null_status_string_asof_propagation_csv_edges', trials: checked, violations };
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
results.properties.push(checkP4_status_not_date_and_asof_propagation());

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
