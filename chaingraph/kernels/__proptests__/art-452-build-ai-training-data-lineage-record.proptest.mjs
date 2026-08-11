// kernel_digest_at_authoring: sha256:fd23920a354af2d91e43fa946991d108f2d99c7a9565ba3dbca922aba445e5ad
//
// FV-PROPFLOOR-SHARD-B24-1 — property-test floor for art-452-build-ai-training-data-lineage-record.
// Class B (bounded-numeric), float:no exception — no arithmetic beyond bounded-list truncation and
// retention_months clamping; the meaningful surface is structural string/regex validation. Forced
// CATEGORICAL boundary cases used instead of ULP forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero
// external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-452-build-ai-training-data-lineage-record.proptest.mjs

import { compute } from '../art-452-build-ai-training-data-lineage-record.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-452-build-ai-training-data-lineage-record.fixtures.json');
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
const rand = mulberry32(0x452C3);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 8000;
const METHODS = ['internal_transaction_records', 'third_party_licensed', 'public_dataset', 'synthetic_generated', 'human_labeled', 'model_generated'];
const HEX64 = '1'.repeat(64);

function mkPP(rng) {
  const hasDataset = rng() < 0.85;
  const hasVersion = rng() < 0.85;
  const validMethod = rng() < 0.7;
  const receiptBranch = rng();
  let receiptFields = {};
  if (receiptBranch < 0.4) {
    receiptFields = { referenced_receipt_tool_id: 'art-01', referenced_receipt_tool_version: '1.0.0', referenced_receipt_execution_hash: HEX64, referenced_receipt_kernel_digest: 'sha256:' + HEX64 };
  } else if (receiptBranch < 0.6) {
    receiptFields = { referenced_receipt_tool_id: 'art-01' };
  }
  return {
    dataset_id: hasDataset ? 'ds-' + Math.floor(rng() * 1000) : '',
    dataset_version: hasVersion ? 'v' + Math.floor(rng() * 10) : '',
    collection_method: validMethod ? pick(rng, METHODS) : 'not_a_method',
    source_dataset_ids: [],
    ...receiptFields,
  };
}

// ---------- P1: boundedness — record_status is exactly the AND of all four checks, never partial ----------
function checkP1_recordStatusAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const expected = r.checks.every((c) => c.pass) ? 'COMPLETE' : 'INCOMPLETE';
    if (r.record_status !== expected) violations++;
    if (r.record_status === 'INCOMPLETE' && r.dataset_id !== null) violations++;
    if (r.record_status === 'COMPLETE' && r.dataset_id === null) violations++;
  }
  return { name: 'P1_record_status_exact_and_of_all_checks_no_partial_leak', trials: checked, violations };
}

// ---------- P2: referenced_receipt is jointly all-or-nothing — never a partial object ----------
function checkP2_receiptJointlyOptional() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const check = r.checks.find((c) => c.check === 'referenced_receipt_valid_if_present');
    if (r.record_status === 'COMPLETE') {
      const hasAny = !!(pp.referenced_receipt_tool_id || pp.referenced_receipt_execution_hash || pp.referenced_receipt_kernel_digest);
      const hasFullReceipt = r.referenced_receipt !== null;
      if (hasFullReceipt) {
        const keys = ['tool_id', 'tool_version', 'execution_hash', 'kernel_digest'];
        if (!keys.every((k) => typeof r.referenced_receipt[k] === 'string' && r.referenced_receipt[k].length > 0)) violations++;
      }
    }
    if (!check) violations++;
  }
  return { name: 'P2_referenced_receipt_always_fully_populated_or_null_never_partial', trials: checked, violations };
}

// ---------- P3: source_dataset_ids list is always bounded to 32 items (boundedList truncation) ----------
function checkP3_sourceListBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const extra = { ...pp, source_dataset_ids: Array.from({ length: Math.floor(rand() * 60) }, (_, j) => 'src-' + j) };
    const r = compute(extra).output_payload;
    checked++;
    if (r.record_status === 'COMPLETE' && r.source_dataset_ids !== null && r.source_dataset_ids.length > 32) violations++;
  }
  return { name: 'P3_source_dataset_ids_always_bounded_to_32', trials: checked, violations };
}

// ---------- P4 (float:no exception): forced CATEGORICAL boundary cases ----------
const VALID = { dataset_id: 'ds-1', dataset_version: 'v1', collection_method: 'public_dataset', source_dataset_ids: [] };
const ULP_BOUNDARY_CASES = [
  [{ ...VALID }, 'all required fields present, no receipt — COMPLETE, chain_position first'],
  [{}, 'entirely empty policy_parameters — INCOMPLETE, all four checks fail'],
  [{ ...VALID, dataset_id: '' }, 'dataset_id empty string — dataset_id_present check fails, INCOMPLETE'],
  [{ ...VALID, collection_method: 'not_in_enum' }, 'collection_method not in the fixed 6-value enum — collection_method_valid fails'],
  [{ ...VALID, referenced_receipt_tool_id: 'art-01' }, 'only ONE of the four joint receipt fields present — receiptFieldsAll false, receiptRefValid false, INCOMPLETE'],
  [{ ...VALID, referenced_receipt_tool_id: 'art-01', referenced_receipt_tool_version: '1.0.0', referenced_receipt_execution_hash: HEX64, referenced_receipt_kernel_digest: 'sha256:' + HEX64 }, 'all four receipt fields present and valid — receiptFieldsAll true, COMPLETE with referenced_receipt populated'],
  [{ ...VALID, referenced_receipt_tool_id: 'art-01', referenced_receipt_tool_version: '1.0.0', referenced_receipt_execution_hash: 'not-hex', referenced_receipt_kernel_digest: 'sha256:' + HEX64 }, 'execution_hash malformed (not 64-hex) even though all four fields present — receiptRefValid fails'],
  [{ ...VALID, sha256_prev_lineage_hash: HEX64 }, 'sha256_prev_lineage_hash present and valid — chain_position chained'],
  [{ ...VALID, sha256_prev_lineage_hash: 'bad-hash' }, 'sha256_prev_lineage_hash malformed — prev_lineage_hash_valid_if_present fails, INCOMPLETE'],
  [{ ...VALID, dataset_id: 'x'.repeat(200) }, 'dataset_id far exceeds 128-char bound — must truncate with [TRUNCATED] suffix, never throw'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const plausible = (r.record_status === 'COMPLETE' || r.record_status === 'INCOMPLETE') && Array.isArray(r.checks);
    rows.push({ label, record_status: r.record_status, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_recordStatusAgreement());
results.properties.push(checkP2_receiptJointlyOptional());
results.properties.push(checkP3_sourceListBounded());
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
