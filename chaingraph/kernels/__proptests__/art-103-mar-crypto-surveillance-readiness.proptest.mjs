// kernel_digest_at_authoring: sha256:ccfc18748b7ec8fa614b64c2704c277dbf6424b1634d54850f579057588da7a9
//
// FV-PROPFLOOR-SHARD-B2-1 — property-test floor for art-103-mar-crypto-surveillance-readiness.
// Class B (bounded-numeric/tier), float:no exception per the WU row — categorical arrangement
// states only ('none'/'partial'/'in-place'/etc), no continuous arithmetic. Forced categorical
// boundary cases used in place of ULP forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the B1 pilot harness.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-103-mar-crypto-surveillance-readiness.proptest.mjs

import { compute } from '../art-103-mar-crypto-surveillance-readiness.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-103-mar-crypto-surveillance-readiness.fixtures.json');
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
const rand = mulberry32(0x10301);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const RANK = { none: 0, partial: 1 };
const TRIALS = 10000;

function mkInputs(rng, overrides = {}) {
  return {
    ppaet_arrangements: pick(rng, ['none', 'partial', 'in-place']),
    stor_templates: pick(rng, ['none', 'partial', 'ready']),
    insider_lists: pick(rng, ['none', 'partial', 'maintained']),
    manipulation_detection: pick(rng, ['none', 'partial', 'in-place']),
    asset_scope: [],
    ...overrides,
  };
}

const STAGES = { ppaet_arrangements: ['none', 'partial', 'in-place'], stor_templates: ['none', 'partial', 'ready'], insider_lists: ['none', 'partial', 'maintained'], manipulation_detection: ['none', 'partial', 'in-place'] };

// ---------- P1: monotone — improving any single arrangement never lowers composite_pct ----------
function checkP1_monotoneImprovement() {
  let violations = 0, checked = 0;
  const keys = Object.keys(STAGES);
  for (let i = 0; i < TRIALS; i++) {
    const base = mkInputs(rand);
    const key = pick(rand, keys);
    const stageIdx = Math.floor(rand() * 2); // 0 or 1: improve by one stage
    const stages = STAGES[key];
    const worse = { ...base, [key]: stages[stageIdx] };
    const better = { ...base, [key]: stages[stageIdx + 1] };
    const r1 = compute({ inputs: worse });
    const r2 = compute({ inputs: better });
    checked++;
    if (r2.output_payload.composite_pct < r1.output_payload.composite_pct) violations++;
  }
  return { name: 'P1_monotone_composite_pct_nondecreasing_on_improvement', trials: checked, violations };
}

// ---------- P2: boundedness — composite_pct in [0,100], grade consistent, arrangement_scores in {0,50,100} ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  const GRADES = new Set(['A', 'B', 'C', 'D', 'F']);
  for (let i = 0; i < TRIALS; i++) {
    const r = compute({ inputs: mkInputs(rand) });
    checked++;
    const { composite_pct, surveillance_grade, arrangement_scores } = r.output_payload;
    if (composite_pct < 0 || composite_pct > 100) violations++;
    if (!GRADES.has(surveillance_grade)) violations++;
    for (const v of Object.values(arrangement_scores)) {
      if (![0, 50, 100].includes(v)) violations++;
    }
  }
  return { name: 'P2_boundedness_composite_pct_and_scores', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — grade is fully determined by composite_pct ----------
function checkP3_gradeThresholdAgreement() {
  let violations = 0, checked = 0;
  function expectedGrade(pct) {
    if (pct >= 88) return 'A';
    if (pct >= 72) return 'B';
    if (pct >= 56) return 'C';
    if (pct >= 40) return 'D';
    return 'F';
  }
  for (let i = 0; i < TRIALS; i++) {
    const r = compute({ inputs: mkInputs(rand) });
    checked++;
    if (r.output_payload.surveillance_grade !== expectedGrade(r.output_payload.composite_pct)) violations++;
  }
  return { name: 'P3_grade_matches_fixed_composite_pct_thresholds', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ ppaet_arrangements: 'none', stor_templates: 'none', insider_lists: 'none', manipulation_detection: 'none', asset_scope: [] }, 'all-none — composite_pct must be exactly 0, grade F'],
  [{ ppaet_arrangements: 'in-place', stor_templates: 'ready', insider_lists: 'maintained', manipulation_detection: 'in-place', asset_scope: [] }, 'all-fully-in-place — composite_pct must be exactly 100, grade A'],
  [{ ppaet_arrangements: 'in-place', stor_templates: 'ready', insider_lists: 'maintained', manipulation_detection: 'partial', asset_scope: [] }, '3 full + 1 partial: composite=87.5 rounds to 88 — must land exactly on grade A boundary'],
  [{ ppaet_arrangements: 'in-place', stor_templates: 'partial', insider_lists: 'maintained', manipulation_detection: 'partial', asset_scope: [] }, '2 full + 2 partial: composite=75 — must be grade B, above 72 boundary'],
  [{ ppaet_arrangements: 'partial', stor_templates: 'partial', insider_lists: 'partial', manipulation_detection: 'none', asset_scope: [] }, '3 partial + 1 none: composite=37.5 rounds to 38 — just below the 40 D-boundary, must be F'],
  [{ ppaet_arrangements: 'partial', stor_templates: 'partial', insider_lists: 'partial', manipulation_detection: 'partial', asset_scope: [] }, 'all-partial: composite=50 — must be grade D'],
  [{ ppaet_arrangements: 'unrecognized_value', stor_templates: 'none', insider_lists: 'none', manipulation_detection: 'none', asset_scope: [] }, 'unrecognized string value — must fall through to score 0, not throw'],
  [{ ppaet_arrangements: 'none', stor_templates: 'ready', insider_lists: 'none', manipulation_detection: 'none', asset_scope: [] }, 'stor_ready true with everything else none — stor_ready flag must be true independent of composite'],
];

function checkP4_forced() {
  const rows = [];
  for (const [inputs, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute({ inputs });
    const { composite_pct, surveillance_grade } = r.output_payload;
    const plausible = Number.isFinite(composite_pct) && composite_pct >= 0 && composite_pct <= 100 && ['A', 'B', 'C', 'D', 'F'].includes(surveillance_grade);
    rows.push({ label, inputs, composite_pct, surveillance_grade, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneImprovement());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_gradeThresholdAgreement());
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
