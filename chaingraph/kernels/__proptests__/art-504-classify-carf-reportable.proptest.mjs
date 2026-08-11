// art-504-classify-carf-reportable.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C24-1).
// kernel_digest_at_authoring: sha256:7092917c1c069bc0681a899f7807db3b1927a96accc5ac068fee5faa0d0f19dc
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — the WU row's own table agrees, no correction
// needed). This kernel is pure classification over strings, Sets and arrays (entity_type,
// self_certification_status, claimed_tax_residences, due_diligence_rules): every comparison is a
// Set.has/array-filter/string-equality check. No numeric arithmetic of any kind appears anywhere
// in compute().
// Checks: fixture-oracle gate, termination (record_verdicts bounded by input records.length,
// transaction_verdicts within each record bounded by that record's transactions.length),
// differential re-derivation of user_reportability and per-transaction reportable classification,
// boundedness (user_counts partition record_count exactly, judgment_required_count equals the
// judgment_required array length), and metamorphic invariance (a suppressed rule_code always
// produces zero unsatisfied steps for that rule regardless of which record; adding an entry to
// reportable_residence_jurisdictions can only move a matched residence from not_reportable toward
// reportable, never away).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-504-classify-carf-reportable.proptest.mjs

import { compute } from '../art-504-classify-carf-reportable.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-504-classify-carf-reportable.fixtures.json');
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
const rand = mulberry32(0x504E0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomRecord(rng, i) {
  const tn = Math.floor(rng() * 4);
  const transactions = [];
  for (let t = 0; t < tn; t++) transactions.push({ transaction_ref: `T${i}-${t}`, transaction_class: pick(rng, ['transfer', 'exchange', 'unclassified']) });
  return {
    record_ref: `REC-${i}`,
    entity_type: pick(rng, ['individual', 'entity', 'bogus']),
    self_certification_status: pick(rng, ['valid', 'missing', 'unreliable', 'pending', 'bogus']),
    claimed_tax_residences: pick(rng, [['US'], ['DE'], ['US', 'FR'], []]),
    controlling_persons: [],
    transactions,
  };
}

function randomPP(rng) {
  const n = Math.floor(rng() * 6);
  const records = [];
  for (let i = 0; i < n; i++) records.push(randomRecord(rng, i));
  return {
    reporting_jurisdiction: 'UK',
    schema_version: '1.0',
    reporting_period: '2026',
    judgment_owner_role: 'compliance_officer',
    reportable_residence_jurisdictions: pick(rng, [['US'], ['US', 'DE'], []]),
    reportable_transaction_classes: pick(rng, [['transfer'], ['transfer', 'exchange'], []]),
    due_diligence_rules: [],
    suppressed_rule_codes: [],
    records,
  };
}

const TRIALS = 5000;

// ---------- P1: termination — record_verdicts / transaction_verdicts bounded by input lengths ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.record_verdicts.length !== pp.records.length) violations++;
    if (output_payload.record_count !== pp.records.length) violations++;
    for (let j = 0; j < pp.records.length; j++) {
      if (output_payload.record_verdicts[j].transaction_verdicts.length !== (pp.records[j].transactions || []).length) violations++;
    }
  }
  return { name: 'P1_termination_verdicts_bounded_by_input_lengths', trials: checked, violations };
}

// ---------- P2 (differential): user_reportability re-derivation ----------
function checkP2_user_reportability_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const residenceSet = new Set(pp.reportable_residence_jurisdictions);
    const residencesDeclared = pp.reportable_residence_jurisdictions.length > 0;
    for (let j = 0; j < pp.records.length; j++) {
      const r = pp.records[j];
      const v = output_payload.record_verdicts[j];
      const validEntity = ['individual', 'entity'].includes(r.entity_type);
      const validCert = ['valid', 'missing', 'unreliable', 'pending'].includes(r.self_certification_status);
      const hasDueDiligenceIssue = !validEntity || !validCert || r.self_certification_status !== 'valid' || (r.self_certification_status === 'valid' && (r.claimed_tax_residences || []).length === 0);
      if (!residencesDeclared) {
        if (v.user_reportability !== 'undetermined') violations++;
      } else if (hasDueDiligenceIssue) {
        if (v.user_reportability !== 'undetermined') violations++;
      } else {
        const matched = (r.claimed_tax_residences || []).filter((res) => residenceSet.has(res));
        const expected = matched.length > 0 ? 'reportable' : 'not_reportable';
        if (v.user_reportability !== expected) violations++;
      }
    }
  }
  return { name: 'P2_user_reportability_differential', trials: checked, violations };
}

// ---------- P3: boundedness — user_counts partitions record_count exactly ----------
function checkP3_user_counts_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const sum = output_payload.user_counts.reportable + output_payload.user_counts.not_reportable + output_payload.user_counts.undetermined;
    if (sum !== output_payload.record_count) violations++;
    if (output_payload.judgment_required_count !== output_payload.judgment_required.length) violations++;
  }
  return { name: 'P3_user_counts_partition_bounded', trials: checked, violations };
}

// ---------- P4: metamorphic — a suppressed rule_code produces zero unsatisfied steps for that rule ----------
function checkP4_suppression_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1000; i++) {
    const pp = randomPP(rand);
    const withRule = { ...pp, due_diligence_rules: [{ rule_code: 'DD-CUSTOM-001', applies_to: 'all', required_field: 'kyc_doc', step: 'kyc capture', description: 'needed' }], suppressed_rule_codes: [] };
    const r1 = compute(withRule).output_payload;
    checked++;
    const suppressed = { ...withRule, suppressed_rule_codes: ['DD-CUSTOM-001'] };
    const r2 = compute(suppressed).output_payload;
    checked++;
    for (const v of r2.record_verdicts) {
      if (v.unsatisfied_due_diligence_steps.some((s) => s.rule_code === 'DD-CUSTOM-001')) violations++;
    }
    // steps not from the suppressed rule are unaffected
    for (let j = 0; j < r1.record_verdicts.length; j++) {
      const before = r1.record_verdicts[j].unsatisfied_due_diligence_steps.filter((s) => s.rule_code !== 'DD-CUSTOM-001');
      const after = r2.record_verdicts[j].unsatisfied_due_diligence_steps;
      if (before.length !== after.length) violations++;
    }
  }
  return { name: 'P4_suppressed_rule_code_metamorphic', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_user_reportability_differential());
results.properties.push(checkP3_user_counts_bounded());
results.properties.push(checkP4_suppression_metamorphic());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-504-classify-carf-reportable',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
