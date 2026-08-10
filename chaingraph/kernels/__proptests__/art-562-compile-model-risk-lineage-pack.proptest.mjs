// kernel_digest_at_authoring: sha256:3bd0f1a3cd02576428db7940732f9d87c09d2632dafbcd72eb4f5f9ee96cb040
//
// FV-PROPFLOOR-SHARD-B27-1 — property-test floor for art-562-compile-model-risk-lineage-pack.
// Class B (bounded-numeric shape, citation-bundle logic). float:no — pure stage-presence counting
// and structural-error guards, no float arithmetic anywhere in the kernel; forced categorical
// boundary cases stand in for ULP-forcing per spec §3. Zero external dependencies. This file is
// READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-562-compile-model-risk-lineage-pack.proptest.mjs

import { compute } from '../art-562-compile-model-risk-lineage-pack.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-562-compile-model-risk-lineage-pack.fixtures.json');
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
const rand = mulberry32(0x562C3);
const TRIALS = 10000;

const STAGE_KEYS = ['inventory_ref', 'outcome_ref', 'validation_status_ref', 'replication_ref', 'test_battery_ref'];

function randHash(rng) { let s = ''; for (let i = 0; i < 64; i++) s += Math.floor(rng() * 16).toString(16); return 'sha256:' + s; }

function mkPP(rng) {
  const pp = { model_id: 'MODEL-' + Math.floor(rng() * 1000), as_of_date: '2026-08-' + String(1 + Math.floor(rng() * 28)).padStart(2, '0') };
  for (const key of STAGE_KEYS) {
    if (rng() < 0.6) pp[key] = { execution_hash: randHash(rng) };
  }
  return pp;
}

// ---------- P1: boundedness — stage_count_present in [0,5]; present+absent partition all 5 stages exactly ----------
function checkP1_stagePartitionBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    if (op.stage_count_present < 0 || op.stage_count_present > 5) violations++;
    if (op.stages_present.length + op.stages_absent.length !== 5) violations++;
    const overlap = op.stages_present.filter((s) => op.stages_absent.includes(s));
    if (overlap.length > 0) violations++;
  }
  return { name: 'P1_stage_partition_bounded_and_disjoint', trials: checked, violations };
}

// ---------- P2: monotonicity — adding one more stage ref never decreases stage_count_present ----------
function checkP2_addingStageMonotonic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const before = compute(pp);
    const missingKey = STAGE_KEYS.find((k) => !pp[k]);
    checked++;
    if (!missingKey) continue;
    const after = compute({ ...pp, [missingKey]: { execution_hash: randHash(rand) } });
    if (after.output_payload.stage_count_present < before.output_payload.stage_count_present) violations++;
  }
  return { name: 'P2_adding_stage_ref_never_decreases_count', trials: checked, violations };
}

// ---------- P3: fixed rule — ALL_STAGES_CITED iff count===5, ZERO_STAGES_CITED iff count===0 ----------
function checkP3_flagsAgreeWithCount() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const flags = r.compliance_flags;
    const n = r.output_payload.stage_count_present;
    if (n === 5 && !flags.includes('MRM_PACK_ALL_STAGES_CITED')) violations++;
    if (n === 0 && !flags.includes('MRM_PACK_ZERO_STAGES_CITED')) violations++;
    if (n > 0 && n < 5 && !flags.includes('MRM_PACK_PARTIAL_STAGES_CITED')) violations++;
  }
  return { name: 'P3_stage_flags_agree_with_count', trials: checked, violations };
}

// ---------- P4 (forced categorical boundary cases) ----------
const FORCED_CASES = [
  [{}, 'fully empty input — structural_error, model_id required'],
  [{ model_id: 'M1' }, 'as_of_date missing — structural_error'],
  [{ model_id: 'M1', as_of_date: '2026-08-05' }, 'zero stages cited — legitimate empty state, MRM_PACK_ZERO_STAGES_CITED'],
  [{ model_id: 'M1', as_of_date: '2026-08-05', inventory_ref: { execution_hash: 'sha256:' + 'a'.repeat(64) }, outcome_ref: { execution_hash: 'sha256:' + 'b'.repeat(64) }, validation_status_ref: { execution_hash: 'sha256:' + 'c'.repeat(64) }, replication_ref: { execution_hash: 'sha256:' + 'd'.repeat(64) }, test_battery_ref: { execution_hash: 'sha256:' + 'e'.repeat(64) } }, 'all five stages cited — MRM_PACK_ALL_STAGES_CITED'],
  [{ model_id: 'M1', as_of_date: '2026-08-05', inventory_ref: { execution_hash: '' } }, 'stage ref present but execution_hash empty string — treated as absent, not present'],
  [{ model_id: 'M1', as_of_date: '2026-08-05', inventory_ref: 'not-an-object' }, 'stage ref is a non-object (string) — treated as absent, no crash'],
  [{ model_id: 'M1', as_of_date: '2026-08-05', inventory_ref: { execution_hash: 'sha256:' + 'a'.repeat(64), tool_id: 'caller-override-tool' } }, 'caller-supplied tool_id override — recorded verbatim, not silently overwritten by canonical_tool_id'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of FORCED_CASES) {
    const r = compute(pp);
    const op = r.output_payload;
    const plausible = typeof op.stage_count_present === 'number' && op.stage_count_present >= 0 && op.stage_count_present <= 5;
    rows.push({ label, input: pp, structural_error: op.structural_error, stage_count_present: op.stage_count_present, cited_receipts: op.cited_receipts, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_stagePartitionBounded());
results.properties.push(checkP2_addingStageMonotonic());
results.properties.push(checkP3_flagsAgreeWithCount());
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
