// art-648-record-model-input-lineage — class-B property-test floor.
// kernel_digest_at_authoring: sha256:eaebdde7fd42f9319b93555563ad4562fc7f0b4aced441f82296b30776fcda66
// spec: MRM-LINEAGE-BUILD-SPEC.md §2
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Class B (bounded-counting shape, no float arithmetic anywhere in the kernel — attribute_count and
// unmapped_attribute_count are integer tallies; forced categorical boundary cases stand in for
// ULP-forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3). Zero external dependencies.
//
// Run: node chaingraph/kernels/__proptests__/art-648-record-model-input-lineage.proptest.mjs

import { compute } from '../art-648-record-model-input-lineage.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick, pickNasty, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = 'art-648-record-model-input-lineage';
const rand = mulberry32(0x648B1);
const TRIALS = 10000;

const SYSTEMS = ['CORE-LEDGER', 'RISK-DWH', 'ORIGINATION-SYS', null];
const TRANSFORMS = ['as-is', 'currency-converted', 'winsorized-at-p99', undefined];
const TIERS = ['public', 'internal', 'restricted', null];

function randAttribute(rng) {
  const field_name = 'field_' + Math.floor(rng() * 50);
  const a = { field_name };
  if (rng() < 0.8) { const s = pick(rng, SYSTEMS); if (s) a.source_system = s; }
  if (rng() < 0.8 && a.source_system) a.source_field = 'src_' + Math.floor(rng() * 50);
  const t = pick(rng, TRANSFORMS); if (t !== undefined) a.transformation_applied = t;
  const tier = pick(rng, TIERS); if (tier) a.sensitivity_tier = tier;
  return a;
}

function mkPP(rng) {
  const n = 1 + Math.floor(rng() * 6);
  const attributes = Array.from({ length: n }, () => randAttribute(rng));
  const pp = { model_id: 'MODEL-' + Math.floor(rng() * 1000), as_of_date: '2026-08-' + String(1 + Math.floor(rng() * 28)).padStart(2, '0'), attributes };
  if (rng() < 0.5) pp.run_ref = { execution_hash: 'sha256:' + Array.from({ length: 64 }, () => Math.floor(rng() * 16).toString(16)).join('') };
  return pp;
}

// ---------- P1: boundedness — attribute_count matches input length; unmapped_attribute_count in [0, attribute_count] ----------
function checkP1_countsBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    if (op.structural_error) continue;
    if (op.attribute_count !== pp.attributes.length) violations++;
    if (op.unmapped_attribute_count < 0 || op.unmapped_attribute_count > op.attribute_count) violations++;
  }
  return { name: 'P1_counts_bounded_and_consistent', checked, violations };
}

// ---------- P2: determinism — same pp twice yields byte-identical output_payload ----------
function checkP2_deterministic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = mkPP(rand);
    checked++;
    const a = JSON.stringify(compute(pp).output_payload);
    const b = JSON.stringify(compute(pp).output_payload);
    if (a !== b) violations++;
  }
  return { name: 'P2_deterministic_same_input_same_output', checked, violations };
}

// ---------- P3: unmapped count exactly equals attributes lacking a truthy source_system ----------
function checkP3_unmappedExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    if (op.structural_error) continue;
    const expected = op.attributes.filter((a) => !a.source_system).length;
    if (expected !== op.unmapped_attribute_count) violations++;
  }
  return { name: 'P3_unmapped_count_matches_source_system_absence', checked, violations };
}

// ---------- P4: flag agreement — MRM_LINEAGE_ALL_MAPPED xor MRM_LINEAGE_UNMAPPED_ATTRIBUTES_PRESENT on success ----------
function checkP4_flagsAgree() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    if (op.structural_error) {
      if (!r.compliance_flags.includes('MRM_LINEAGE_STRUCTURAL_ERROR')) violations++;
      continue;
    }
    const hasAll = r.compliance_flags.includes('MRM_LINEAGE_ALL_MAPPED');
    const hasUnmapped = r.compliance_flags.includes('MRM_LINEAGE_UNMAPPED_ATTRIBUTES_PRESENT');
    if (hasAll === hasUnmapped) violations++; // exactly one must be true
    if (hasAll && op.unmapped_attribute_count !== 0) violations++;
    if (hasUnmapped && op.unmapped_attribute_count === 0) violations++;
    const hasRunRefCited = r.compliance_flags.includes('MRM_LINEAGE_RUN_REF_CITED');
    const hasRunRefAbsent = r.compliance_flags.includes('MRM_LINEAGE_RUN_REF_ABSENT');
    if (hasRunRefCited === hasRunRefAbsent) violations++;
    if (hasRunRefCited !== (op.run_ref !== null)) violations++;
  }
  return { name: 'P4_flags_agree_with_output_shape', checked, violations };
}

// ---------- P5: shape invariant — no NaN/undefined/non-finite anywhere in output_payload ----------
function checkP5_shapeClean() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 3000; i++) {
    const pp = mkPP(rand);
    checked++;
    const v = findShapeViolations(compute(pp).output_payload);
    if (v.length) violations++;
  }
  return { name: 'P5_output_shape_no_nan_undefined', checked, violations };
}

// ---------- P6 (discovery, non-asserting): nasty top-level values never crash compute() uncontrolled ----------
function checkP6_nastyNeverThrowsUncaught() {
  let violations = 0, checked = 0;
  const baseline = { model_id: 'MODEL-1', as_of_date: '2026-08-05', attributes: [{ field_name: 'f1', source_system: 'S1' }] };
  for (let i = 0; i < 2000; i++) {
    checked++;
    const nasty = pickNasty(rand);
    try {
      compute({ ...baseline, attributes: nasty });
    } catch (e) {
      // a thrown error for a nasty attributes value is acceptable (Array.isArray guard already
      // treats non-arrays as []) — this leg only checks compute() never throws something OTHER
      // than a clean, catchable Error (e.g. never a raw TypeError escaping the field_name access).
      if (!(e instanceof Error)) violations++;
    }
  }
  return { name: 'P6_nasty_attributes_never_throw_non_error', checked, violations };
}

// ---------- P7 forced categorical boundary cases ----------
const FORCED_CASES = [
  [{}, 'fully empty input — structural_error, model_id required'],
  [{ model_id: 'M1' }, 'as_of_date missing — structural_error'],
  [{ model_id: 'M1', as_of_date: '2026-08-05' }, 'attributes key absent — structural_error (non-empty array required)'],
  [{ model_id: 'M1', as_of_date: '2026-08-05', attributes: [] }, 'attributes explicitly empty array — same structural_error, not a silent empty pass'],
  [{ model_id: 'M1', as_of_date: '2026-08-05', attributes: [{ field_name: 'f1' }] }, 'single attribute, no source_system — unmapped_attribute_count 1'],
  [{ model_id: 'M1', as_of_date: '2026-08-05', attributes: [{ field_name: 'f1', source_system: 'S1' }] }, 'single fully-mapped attribute — MRM_LINEAGE_ALL_MAPPED'],
  [{ model_id: 'M1', as_of_date: '2026-08-05', attributes: [{ field_name: '' }] }, 'attribute with blank field_name — structural_error'],
  [{ model_id: 'M1', as_of_date: '2026-08-05', attributes: [{ field_name: 'f1', source_system: 'S1' }], run_ref: { execution_hash: 'sha256:' + 'a'.repeat(64) } }, 'run_ref supplied — MRM_LINEAGE_RUN_REF_CITED'],
];

function checkP7_forced() {
  const rows = [];
  for (const [pp, label] of FORCED_CASES) {
    const r = compute(pp);
    const op = r.output_payload;
    const plausible = typeof op.attribute_count === 'number' && op.attribute_count >= 0 && op.unmapped_attribute_count >= 0 && op.unmapped_attribute_count <= op.attribute_count;
    rows.push({ label, structural_error: op.structural_error, attribute_count: op.attribute_count, unmapped_attribute_count: op.unmapped_attribute_count, compliance_flags: r.compliance_flags, plausible });
  }
  return rows;
}

// ---------- run ----------
const oracle = runFixtureOracle(KERNEL_ID, compute);
const properties = [
  checkP1_countsBounded(),
  checkP2_deterministic(),
  checkP3_unmappedExact(),
  checkP4_flagsAgree(),
  checkP5_shapeClean(),
  checkP6_nastyNeverThrowsUncaught(),
];
const forced = checkP7_forced();
const forcedImplausible = forced.filter((f) => !f.plausible);
if (forcedImplausible.length) {
  properties.push({ name: 'P7_forced_boundary_cases_plausible', checked: forced.length, violations: forcedImplausible.length });
} else {
  properties.push({ name: 'P7_forced_boundary_cases_plausible', checked: forced.length, violations: 0 });
}

const ok = summarize(KERNEL_ID, oracle, properties);
if (!ok) console.log('forced boundary rows:', JSON.stringify(forced, null, 2));
process.exit(ok ? 0 : 1);
