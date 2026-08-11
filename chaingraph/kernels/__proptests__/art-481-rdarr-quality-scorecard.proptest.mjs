// art-481-rdarr-quality-scorecard.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C23-1).
// kernel_digest_at_authoring: sha256:bb595b3096e163a13b9265cd83ed691343605e21a5fcb974aa04fdc9292c38ba
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES, direct read confirmed — the kernel's own header claims "pure integer
// arithmetic throughout... no floats accumulate", which is true INSIDE pct2()'s scaled-basis-point
// truncation, but the FINAL decision (`valuePctNum >= thresholdPct` / `<=`) compares a Number
// parsed back from a fixed-2-decimal string against a caller-supplied threshold that can be any
// float — a genuine floating-point boundary comparison, not integer. ULP-boundary forcing is
// therefore mandatory per spec §3.
// Checks: fixture-oracle gate, termination (metric record_count bounded by extract.length),
// differential re-derivation of all 5 metric counts from raw extract records, boundedness
// (pass+breach+missing_threshold === 5, record_count<=total), ULP-boundary forcing on the
// threshold comparison (0, -0, denormals, ±1 ULP, NaN/Infinity threshold handling, exact-tie
// boundary), and metamorphic permutation-invariance of extract order (counts are per-record,
// order-independent by construction, so equality is EXACT, not tolerance-bounded).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-481-rdarr-quality-scorecard.proptest.mjs

import { compute } from '../art-481-rdarr-quality-scorecard.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-481-rdarr-quality-scorecard.fixtures.json');
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
const rand = mulberry32(0x481C23);

const MANDATORY_ATTRS = ['exposure_class', 'currency'];
const NODE_IDS = ['RETAIL', 'CORP', 'SOV'];

function randomExtract(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const complete = rng() < 0.6;
    const attrs = complete ? { exposure_class: 'RETAIL', currency: 'USD' } : (rng() < 0.5 ? {} : { exposure_class: 'RETAIL' });
    out.push({
      record_id: `r${i}`,
      node_id: rng() < 0.8 ? NODE_IDS[Math.floor(rng() * NODE_IDS.length)] : 'UNKNOWN',
      as_of_date: rng() < 0.7 ? '2026-06-15' : '2026-07-15',
      reconciled: rng() < 0.5,
      manual_adjustment: rng() < 0.2,
      attributes: attrs,
    });
  }
  return out;
}

function randomPP(rng) {
  const n = Math.floor(rng() * 12);
  return {
    guide_version: 'ECB Guide on effective risk data aggregation and risk reporting, 3 May 2024',
    cutoff_date: '2026-06-30',
    mandatory_attributes: MANDATORY_ATTRS,
    hierarchy_node_ids: NODE_IDS,
    thresholds: {
      completeness_pct: 50, referential_integrity_pct: 50, timeliness_pct: 50,
      reconciliation_coverage_pct: 50, manual_adjustment_ratio_pct: 50,
    },
    extract: randomExtract(rng, n),
  };
}

// Independent reference re-derivation of the 5 raw counts from the extract.
function referenceCounts(pp) {
  let completeCount = 0, referentiallyIntactCount = 0, timelyCount = 0, reconciledCount = 0, manualAdjustmentCount = 0;
  const hierSet = new Set(pp.hierarchy_node_ids);
  for (const r of pp.extract) {
    const attrs = r.attributes ?? {};
    const missing = pp.mandatory_attributes.filter((k) => !(attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== ''));
    if (missing.length === 0) completeCount++;
    if (r.node_id != null && hierSet.has(r.node_id)) referentiallyIntactCount++;
    if (pp.cutoff_date != null && typeof r.as_of_date === 'string' && r.as_of_date <= pp.cutoff_date) timelyCount++;
    if (r.reconciled === true) reconciledCount++;
    if (r.manual_adjustment === true) manualAdjustmentCount++;
  }
  return { completeCount, referentiallyIntactCount, timelyCount, reconciledCount, manualAdjustmentCount };
}

const TRIALS = 6000;

// ---------- P1: termination — every metric's record_count bounded by total_records ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.total_records !== pp.extract.length) violations++;
    for (const m of output_payload.metrics) {
      if (m.record_count > output_payload.total_records || m.record_count < 0) violations++;
    }
  }
  return { name: 'P1_termination_record_count_bounded_by_total', trials: checked, violations };
}

// ---------- P2 (differential): all 5 metric counts re-derived independently ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const ref = referenceCounts(pp);
    const byKey = Object.fromEntries(output_payload.metrics.map((m) => [m.metric, m.record_count]));
    if (byKey.completeness_pct !== ref.completeCount) violations++;
    if (byKey.referential_integrity_pct !== ref.referentiallyIntactCount) violations++;
    if (byKey.timeliness_pct !== ref.timelyCount) violations++;
    if (byKey.reconciliation_coverage_pct !== ref.reconciledCount) violations++;
    if (byKey.manual_adjustment_ratio_pct !== ref.manualAdjustmentCount) violations++;
  }
  return { name: 'P2_metric_counts_differential', trials: checked, violations };
}

// ---------- P3: boundedness — status partition exhausts metrics, overall_status derivable ----------
function checkP3_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const sc = output_payload.scorecard;
    if (sc.pass_count + sc.breach_count + sc.missing_threshold_count !== output_payload.metrics.length) violations++;
    if (output_payload.metrics.length !== 5) violations++;
    const expectedStatus = sc.missing_threshold_count > 0 ? 'incomplete_policy' : (sc.breach_count > 0 ? 'breach' : 'pass');
    if (sc.overall_status !== expectedStatus) violations++;
  }
  return { name: 'P3_status_partition_and_overall_status_boundedness', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
// Fixed extract: total=3, completeCount=1 -> pct2(1,3) = "33.33" (min comparator metric).
// manual_adjustment: 0 of 3 -> pct2(0,3) = "0.00" (max comparator metric).
function checkP4_ulp_forcing() {
  const extract = [
    { record_id: 'a', node_id: 'RETAIL', as_of_date: '2026-06-01', reconciled: false, manual_adjustment: false, attributes: { exposure_class: 'RETAIL', currency: 'USD' } },
    { record_id: 'b', node_id: 'RETAIL', as_of_date: '2026-06-01', reconciled: false, manual_adjustment: false, attributes: {} },
    { record_id: 'c', node_id: 'RETAIL', as_of_date: '2026-06-01', reconciled: false, manual_adjustment: false, attributes: {} },
  ];
  const eps = Number.EPSILON;
  const forcedMin = [33.33, 33.33 + eps * 100, 33.33 - eps * 100, 0, -0, Number.MIN_VALUE, -Number.MIN_VALUE, 100, NaN, Infinity, -Infinity];
  const forcedMax = [0, -0, Number.MIN_VALUE, -Number.MIN_VALUE, eps, -eps, NaN, Infinity];
  let violations = 0, checked = 0;
  const rows = [];
  for (const th of forcedMin) {
    const pp = { guide_version: 'g', cutoff_date: null, mandatory_attributes: ['exposure_class', 'currency'], hierarchy_node_ids: [], thresholds: { completeness_pct: th }, extract };
    const { output_payload } = compute(pp);
    checked++;
    const m = output_payload.metrics.find((x) => x.metric === 'completeness_pct');
    const finite = Number.isFinite(th);
    const expected = !finite ? 'threshold_missing' : (33.33 >= th ? 'pass' : 'breach');
    if (m.status !== expected) violations++;
    rows.push({ threshold: th, status: m.status, expected });
  }
  for (const th of forcedMax) {
    const pp = { guide_version: 'g', cutoff_date: null, mandatory_attributes: ['exposure_class', 'currency'], hierarchy_node_ids: [], thresholds: { manual_adjustment_ratio_pct: th }, extract };
    const { output_payload } = compute(pp);
    checked++;
    const m = output_payload.metrics.find((x) => x.metric === 'manual_adjustment_ratio_pct');
    const finite = Number.isFinite(th);
    const expected = !finite ? 'threshold_missing' : (0 <= th ? 'pass' : 'breach');
    if (m.status !== expected) violations++;
    rows.push({ threshold: th, status: m.status, expected });
  }
  results.ulp_forced_rows = rows;
  return { name: 'P4_ulp_boundary_forcing_float_sensitive', trials: checked, violations };
}

// ---------- P5: metamorphic — exact permutation-invariance of extract order ----------
function checkP5_permutation_exact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 3000; i++) {
    const pp = randomPP(rand);
    const shuffled = [...pp.extract];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const r1 = compute(pp).output_payload;
    const r2 = compute({ ...pp, extract: shuffled }).output_payload;
    checked++;
    if (JSON.stringify(r1.scorecard) !== JSON.stringify(r2.scorecard)) violations++;
    if (JSON.stringify(r1.metrics.map((m) => m.record_count)) !== JSON.stringify(r2.metrics.map((m) => m.record_count))) violations++;
  }
  return { name: 'P5_permutation_invariance_exact', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_differential());
results.properties.push(checkP3_boundedness());
results.properties.push(checkP4_ulp_forcing());
results.properties.push(checkP5_permutation_exact());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-481-rdarr-quality-scorecard',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
