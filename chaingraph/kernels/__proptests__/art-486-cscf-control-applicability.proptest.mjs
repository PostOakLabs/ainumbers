// art-486-cscf-control-applicability.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C23-1).
// kernel_digest_at_authoring: sha256:e61f7e68aeceece5e32ce4f26e110cac1da3e8f1a8d79d74304674e7de0c8484
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO, direct read confirmed — the kernel's own header states "no floats beyond
// a single round(pct,2)". The one float division (`mandatory_coverage_pct` /
// `advisory_coverage_pct`) FEEDS NO BRANCHING DECISION anywhere in compute(): `overall_status`
// is derived solely from `mandatoryGapCount`, an integer count from `gapList.filter(...).length`.
// The reported percentage is a display value only, so no threshold comparison hinges on its
// precision. Forced CATEGORICAL boundary cases used per spec §3's float:no row.
// Checks: fixture-oracle gate, termination (gap_list.length bounded by control_matrix length),
// differential re-derivation of mandatory/advisory totals and coverage_pct, boundedness (pct in
// [0,100], overall_status matches mandatoryGapCount exactly), forced categorical cases (missing
// required fields throw, invalid tier throws, na_reason required, 0-applicable defaults to
// 100%), and metamorphic permutation-invariance of control_matrix order (the kernel sorts
// internally by control_number, so final counts/status are exactly order-independent).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-486-cscf-control-applicability.proptest.mjs

import { compute } from '../art-486-cscf-control-applicability.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-486-cscf-control-applicability.fixtures.json');
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
const rand = mulberry32(0x486C23);

// control_number is unique per entry by construction (`i`) — a real CSCF control matrix never
// repeats a control_number, and a duplicate would make gap_list order ambiguous for reasons
// that are a test-generator artifact, not a kernel property to assert (measured during
// authoring: shuffling duplicate-control_number inputs legitimately permutes their relative
// tie-break order, since Array.sort is stable but "original order" itself changed).
function randomMatrix(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      control_number: String(1 + i).padStart(2, '0') + '.' + Math.floor(rng() * 5),
      tier: rng() < 0.6 ? 'mandatory' : 'advisory',
      applicable_architecture_types: rng() < 0.7 ? ['A1'] : ['A2'],
      evidence_ref: `SWIFT-CSCF-${i}`,
    });
  }
  return out;
}

function randomPP(rng) {
  const n = 1 + Math.floor(rng() * 10);
  const matrix = randomMatrix(rng, n);
  const status = {};
  for (const c of matrix) {
    const isNa = rng() < 0.15;
    status[c.control_number] = isNa
      ? { not_applicable: true, na_reason: 'stood down' }
      : { implemented: rng() < 0.6, evidence_provided: rng() < 0.8 };
  }
  return {
    architecture_type: 'A1',
    cscf_version: '2026',
    component_inventory: ['swift_alliance_access'],
    control_matrix: matrix,
    implementation_status: status,
  };
}

const TRIALS = 5000;

// ---------- P1: termination — gap_list.length bounded by control_matrix length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.gap_list.length > pp.control_matrix.length) violations++;
    if (output_payload.applicable_mandatory_count + output_payload.applicable_advisory_count > pp.control_matrix.length) violations++;
  }
  return { name: 'P1_termination_gap_list_bounded', trials: checked, violations };
}

// ---------- P2 (differential): mandatory/advisory totals + coverage_pct re-derivation ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    let mTotal = 0, mImpl = 0, mNa = 0, aTotal = 0, aImpl = 0, aNa = 0;
    for (const c of pp.control_matrix) {
      if (!c.applicable_architecture_types.includes(pp.architecture_type)) continue;
      const st = pp.implementation_status[c.control_number] || {};
      if (st.not_applicable === true) {
        if (c.tier === 'mandatory') { mTotal++; mNa++; } else { aTotal++; aNa++; }
        continue;
      }
      if (c.tier === 'mandatory') { mTotal++; if (st.implemented === true) mImpl++; }
      else { aTotal++; if (st.implemented === true) aImpl++; }
    }
    if (output_payload.applicable_mandatory_count !== mTotal) violations++;
    if (output_payload.applicable_advisory_count !== aTotal) violations++;
    const mApplicable = mTotal - mNa, aApplicable = aTotal - aNa;
    const expectedMPct = mApplicable > 0 ? Math.round((mImpl / mApplicable) * 100 * 100) / 100 : 100;
    const expectedAPct = aApplicable > 0 ? Math.round((aImpl / aApplicable) * 100 * 100) / 100 : 100;
    if (output_payload.mandatory_coverage_pct !== expectedMPct) violations++;
    if (output_payload.advisory_coverage_pct !== expectedAPct) violations++;
  }
  return { name: 'P2_coverage_pct_differential', trials: checked, violations };
}

// ---------- P3: boundedness — pct in [0,100], overall_status matches mandatoryGapCount ----------
function checkP3_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.mandatory_coverage_pct < 0 || output_payload.mandatory_coverage_pct > 100) violations++;
    if (output_payload.advisory_coverage_pct < 0 || output_payload.advisory_coverage_pct > 100) violations++;
    const mandatoryGapCount = output_payload.gap_list.filter((g) => g.tier === 'mandatory').length;
    const expectedStatus = mandatoryGapCount === 0 ? 'compliant' : 'gaps_present';
    if (output_payload.overall_status !== expectedStatus) violations++;
  }
  return { name: 'P3_pct_range_and_status_boundedness', trials: checked, violations };
}

// ---------- P4 (float:no exception): forced categorical boundary cases ----------
function checkP4_forced() {
  const rows = [];
  const cases = [
    { label: 'missing architecture_type throws', pp: { cscf_version: 'v', control_matrix: [{ control_number: '1.1', tier: 'mandatory', applicable_architecture_types: ['A1'] }] }, expectThrow: true },
    { label: 'empty control_matrix throws', pp: { architecture_type: 'A1', cscf_version: 'v', control_matrix: [] }, expectThrow: true },
    { label: 'invalid tier throws', pp: { architecture_type: 'A1', cscf_version: 'v', control_matrix: [{ control_number: '1.1', tier: 'bogus', applicable_architecture_types: ['A1'] }] }, expectThrow: true },
    { label: 'not_applicable without na_reason throws', pp: { architecture_type: 'A1', cscf_version: 'v', control_matrix: [{ control_number: '1.1', tier: 'mandatory', applicable_architecture_types: ['A1'] }], implementation_status: { '1.1': { not_applicable: true } } }, expectThrow: true },
    { label: '0 applicable controls -> coverage defaults to 100', pp: { architecture_type: 'A1', cscf_version: 'v', control_matrix: [{ control_number: '1.1', tier: 'mandatory', applicable_architecture_types: ['A2'] }] }, expectThrow: false, expect: (o) => o.mandatory_coverage_pct === 100 && o.overall_status === 'compliant' },
    { label: 'ALL entries not_applicable -> 0 applicable, 100% default, compliant', pp: { architecture_type: 'A1', cscf_version: 'v', control_matrix: [{ control_number: '1.1', tier: 'mandatory', applicable_architecture_types: ['A1'] }], implementation_status: { '1.1': { not_applicable: true, na_reason: 'n/a' } } }, expectThrow: false, expect: (o) => o.mandatory_coverage_pct === 100 && o.overall_status === 'compliant' },
    { label: 'unsorted input control_matrix produces sorted-by-control_number gap_list', pp: { architecture_type: 'A1', cscf_version: 'v', control_matrix: [{ control_number: '2.1', tier: 'mandatory', applicable_architecture_types: ['A1'] }, { control_number: '1.1', tier: 'mandatory', applicable_architecture_types: ['A1'] }] }, expectThrow: false, expect: (o) => o.gap_list[0].control_number === '1.1' && o.gap_list[1].control_number === '2.1' },
  ];
  for (const c of cases) {
    let threw = false, o;
    try { o = compute(c.pp).output_payload; } catch (e) { threw = true; }
    const plausible = c.expectThrow ? threw : (!threw && c.expect(o));
    rows.push({ label: c.label, threw, plausible });
  }
  return rows;
}

// ---------- P5: metamorphic — exact permutation-invariance of control_matrix order ----------
function checkP5_permutation_exact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 3000; i++) {
    const pp = randomPP(rand);
    const shuffled = [...pp.control_matrix];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const r1 = compute(pp).output_payload;
    const r2 = compute({ ...pp, control_matrix: shuffled }).output_payload;
    checked++;
    if (r1.mandatory_coverage_pct !== r2.mandatory_coverage_pct) violations++;
    if (r1.advisory_coverage_pct !== r2.advisory_coverage_pct) violations++;
    if (r1.overall_status !== r2.overall_status) violations++;
    if (JSON.stringify(r1.gap_list) !== JSON.stringify(r2.gap_list)) violations++;
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
results.boundary_forced = checkP4_forced();
results.properties.push(checkP5_permutation_exact());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  tool_id: 'art-486-cscf-control-applicability',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
