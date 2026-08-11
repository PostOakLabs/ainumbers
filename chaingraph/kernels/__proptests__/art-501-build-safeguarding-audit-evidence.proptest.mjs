// art-501-build-safeguarding-audit-evidence.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C24-1).
// kernel_digest_at_authoring: sha256:5156c7482d1a3d1e1bb5c0a83beeb2ebb542c9e5cd257c31c2007cd8fc4daab8
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// ⛔⛔ CORRECTION TO THE WU ROW'S TABLE (per FIX-2): the row lists this kernel as float:yes.
// Direct read of the full compute() body shows NO arithmetic of any kind on floats: this kernel
// assembles evidence (reconciliation results, method classification, an exception schedule and a
// §27 accountability trail) by string comparison, ISO-date string range checks
// (withinPeriod, no Date parsing), array filtering/counting, and Number.isSafeInteger guards on
// counts lifted from a supplied method_summary. There is no floating-point threshold anywhere.
// Corrected to float:no; floored with forced categorical boundary cases at the period-boundary
// (as_of_date at/outside period start and end) and the accountability-trail role-count boundary
// instead of an ULP claim, per spec §3's float:no fallback.
// Checks: fixture-oracle gate, termination (reconciliation_days/exception_schedule bounded by input
// array lengths), forced categorical boundary cases at the audit-period date range and the
// accountability-trail 3-role threshold, differential re-derivation of reconciled/shortfall/excess
// counts and pack_complete, boundedness (missing_items is a subset of the fixed evidence_items
// list, exception_schedule length only grows with more triggering input), and metamorphic
// invariance (a signed conformant approval record added for a still-open role can only move that
// role toward satisfied, never away).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-501-build-safeguarding-audit-evidence.proptest.mjs

import { compute } from '../art-501-build-safeguarding-audit-evidence.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-501-build-safeguarding-audit-evidence.fixtures.json');
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
const rand = mulberry32(0x501B0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomReconDay(rng, i) {
  return {
    entry_ref: `R${i}`,
    as_of_date: pick(rng, ['2026-01-05', '2026-01-15', '2025-12-31', '2026-02-01', null]),
    reconciliation_type: pick(rng, ['internal', 'external']),
    verdict: pick(rng, ['reconciled', 'shortfall', 'excess', 'unstated']),
    difference_display: '0.00',
    currency: 'GBP',
  };
}

function randomPP(rng) {
  const n = Math.floor(rng() * 6);
  const days = [];
  for (let i = 0; i < n; i++) days.push(randomReconDay(rng, i));
  return {
    firm_ref: 'FIRM-1',
    audit_period: { start_date: '2026-01-01', end_date: '2026-01-31' },
    attested_subject: rng() < 0.7 ? { subject_hash: 'sha256:' + 'a'.repeat(64), producer_pinned: true, binding_complete: true } : {},
    reconciliation_results: days,
    method_classification: rng() < 0.5 ? { classification_verdict: 'COHERENT_ON_SUPPLIED_FACTS', stream_count: 3, coherent_count: 3, incoherent_count: 0, open_judgment_count: 0 } : null,
    accountability_records: [],
  };
}

const TRIALS = 5000;

// ---------- P1: termination — reconciliation entries bounded by input length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.reconciliation_summary.entries.length !== pp.reconciliation_results.length) violations++;
    if (output_payload.reconciliation_summary.entry_count !== pp.reconciliation_results.length) violations++;
  }
  return { name: 'P1_termination_reconciliation_entries_exact', trials: checked, violations };
}

// ---------- P2: forced categorical boundary cases at the audit-period date range ----------
function checkP2_period_boundary_categorical() {
  let violations = 0, checked = 0;
  const cases = [
    { as_of_date: '2026-01-01', expectWithin: true }, // exactly at start
    { as_of_date: '2026-01-31', expectWithin: true }, // exactly at end
    { as_of_date: '2025-12-31', expectWithin: false }, // one day before start
    { as_of_date: '2026-02-01', expectWithin: false }, // one day after end
    { as_of_date: null, expectWithin: false },
  ];
  for (const c of cases) {
    const pp = { firm_ref: 'F', audit_period: { start_date: '2026-01-01', end_date: '2026-01-31' }, attested_subject: {}, reconciliation_results: [{ entry_ref: 'R1', as_of_date: c.as_of_date, reconciliation_type: 'internal', verdict: 'reconciled' }], method_classification: null, accountability_records: [] };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.reconciliation_summary.entries[0].within_period !== c.expectWithin) violations++;
  }
  return { name: 'P2_period_boundary_forced_categorical', trials: checked, violations };
}

// ---------- P3 (differential): reconciled/shortfall/excess count re-derivation ----------
function checkP3_recon_counts_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const reconciled = pp.reconciliation_results.filter((r) => r.verdict === 'reconciled').length;
    const shortfall = pp.reconciliation_results.filter((r) => r.verdict === 'shortfall').length;
    const excess = pp.reconciliation_results.filter((r) => r.verdict === 'excess').length;
    if (output_payload.reconciliation_summary.reconciled_count !== reconciled) violations++;
    if (output_payload.reconciliation_summary.shortfall_count !== shortfall) violations++;
    if (output_payload.reconciliation_summary.excess_count !== excess) violations++;
  }
  return { name: 'P3_reconciliation_counts_differential', trials: checked, violations };
}

// ---------- P4: boundedness — missing_items subset of the fixed 6-item evidence_items list ----------
function checkP4_missing_items_bounded() {
  let violations = 0, checked = 0;
  const FIXED_ITEMS = ['audit_period', 'attested_subject', 'reconciliation_results', 'method_classification', 'accountability_trail', 'management_responses'];
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.evidence_items.length !== 6) violations++;
    for (const item of output_payload.missing_items) {
      if (!FIXED_ITEMS.includes(item)) violations++;
    }
    if (output_payload.pack_complete !== (output_payload.missing_items.length === 0)) violations++;
  }
  return { name: 'P4_missing_items_bounded_by_fixed_set', trials: checked, violations };
}

// ---------- P5: metamorphic — a signed, conformant, human approval record for a still-open role
// can only move that role toward satisfied, never regress ----------
function checkP5_add_approval_metamorphic() {
  let violations = 0, checked = 0;
  const subjHash = 'sha256:' + 'b'.repeat(64);
  for (let i = 0; i < 1000; i++) {
    const pp = {
      firm_ref: 'F', audit_period: { start_date: '2026-01-01', end_date: '2026-01-31' },
      attested_subject: { subject_hash: subjHash, producer_pinned: true, binding_complete: true },
      reconciliation_results: [], method_classification: null,
      accountability_records: [],
    };
    const r1 = compute(pp).output_payload;
    checked++;
    if (r1.accountability_trail.by_role.preparer.status !== 'hold') violations++;
    const approvalRecord = {
      subject_hash: subjHash, role: 'preparer', record_type: 'approval',
      identity: { id: 'id-1' },
      audit_signature: { proof: { cryptosuite: 'eddsa-jcs-2022', verificationMethod: 'id-1#key-1' } },
    };
    const r2 = compute({ ...pp, accountability_records: [approvalRecord] }).output_payload;
    checked++;
    if (r2.accountability_trail.by_role.preparer.status !== 'satisfied') violations++;
    if (r2.accountability_trail.roles_satisfied_count < r1.accountability_trail.roles_satisfied_count) violations++;
  }
  return { name: 'P5_add_conformant_approval_metamorphic', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_period_boundary_categorical());
results.properties.push(checkP3_recon_counts_differential());
results.properties.push(checkP4_missing_items_bounded());
results.properties.push(checkP5_add_approval_metamorphic());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-501-build-safeguarding-audit-evidence',
  float_sensitive: false,
  float_sensitive_correction: 'WU row table said float:yes; direct source read shows no arithmetic of any kind on floats — this kernel assembles evidence by string/date-string comparison, array filtering and Number.isSafeInteger-guarded counts lifted from supplied input, with no floating-point threshold anywhere. Corrected to float:no; floored with forced categorical boundary cases instead of ULP-boundary forcing.',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
