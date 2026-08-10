// kernel_digest_at_authoring: sha256:6764ffb26c2786330c5c9ec5912f6c5c37ae6e0e6b3c69efa0576e0cdb1a269f
//
// FV-PROPFLOOR-SHARD-B16-1 — property-test floor for art-75-eugb-factsheet-validator.
// Class B, float:NO per the WU row — VERIFIED against the kernel source, not inherited: the
// only floating-point division in compute() is proceeds_aligned_pct
// (aligned_proceeds/total_proceeds*100), which is immediately toFixed(2)-rounded and then
// compared against the fixed PROCEEDS_THRESHOLD=100.0 constant; every downstream field
// (conformance_score, conformance_grade, label_ready) is integer/boolean arithmetic over
// fixed tiers with no further float propagation. This is the same "threshold operates on an
// already-rounded value" shape B12 documented for art-316's categorical exception, so the WU's
// float:no classification is CONFIRMED, not overridden — but because a real division still
// feeds the 100%-threshold comparison, this file forces boundary cases at that threshold as a
// categorical safeguard (belt-and-suspenders) rather than skipping it outright.
// Zero external dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-75-eugb-factsheet-validator.proptest.mjs

import { compute } from '../art-75-eugb-factsheet-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-75-eugb-factsheet-validator.fixtures.json');
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
const rand = mulberry32(0x75C7);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;

const SECTIONS = [
  'issuer_name_and_description', 'bond_name_and_isin', 'use_of_proceeds', 'environmental_objective',
  'eligible_green_assets', 'taxonomy_alignment_evidence', 'external_review_information', 'reporting_commitments',
];
const STATUSES = ['complete', 'partial', 'missing'];

function mkPP(rng) {
  const factsheet = SECTIONS.map((section) => ({ section, status: pick(rng, STATUSES) }));
  const n = 1 + Math.floor(rng() * 4);
  const use_of_proceeds = Array.from({ length: n }, (_, i) => ({
    activity_nace: `N${i}`,
    amount: randRange(rng, 0, 10000),
    alignment_verdict: rng() < 0.5 ? 'ALIGNED — ...' : 'ELIGIBLE_NOT_ALIGNED — ...',
  }));
  return {
    factsheet,
    use_of_proceeds,
    allocation_report: pick(rng, ['complete', 'partial', 'missing']),
    external_reviewer: pick(rng, ['appointed', 'pending', 'none']),
  };
}

// ---------- P1: fixed-threshold-tier agreement — proceeds_threshold_met exactly matches the 100% boundary ----------
function checkP1_proceedsThresholdExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { proceeds_aligned_pct, proceeds_threshold_met } = r.output_payload;
    if (proceeds_threshold_met !== (proceeds_aligned_pct >= 100)) violations++;
  }
  return { name: 'P1_proceeds_threshold_met_exact_100_pct_boundary', trials: checked, violations };
}

// ---------- P2: round-trip identity — label_ready is the exact logical AND of its four gates ----------
function checkP2_labelReadyLogicalAnd() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { annex_i_complete, proceeds_threshold_met, annex_ii_status, external_reviewer_status, label_ready } = r.output_payload;
    const expected = annex_i_complete && proceeds_threshold_met && annex_ii_status === 'complete' && external_reviewer_status === 'appointed';
    if (label_ready !== expected) violations++;
  }
  return { name: 'P2_label_ready_exact_logical_and_of_four_gates', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — conformance_grade matches the exact score-tier table ----------
function checkP3_gradeMatchesScoreTier() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { conformance_score, conformance_grade } = r.output_payload;
    const expected = conformance_score >= 85 ? 'A' : conformance_score >= 70 ? 'B' : conformance_score >= 55 ? 'C' : conformance_score >= 40 ? 'D' : 'F';
    if (conformance_grade !== expected) violations++;
    if (conformance_score < 0 || conformance_score > 100) violations++;
  }
  return { name: 'P3_conformance_grade_exact_score_tier_and_score_bounded_0_100', trials: checked, violations };
}

// ---------- P4 (float:no exception): forced CATEGORICAL boundary cases, incl. the proceeds-100% divide ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ use_of_proceeds: [{ amount: 100, alignment_verdict: 'ALIGNED' }] }, 'single use-of-proceeds entry, fully aligned — proceeds_aligned_pct must be exactly 100 (division 100/100*100), proceeds_threshold_met true'],
  [{ use_of_proceeds: [{ amount: 100, alignment_verdict: 'ELIGIBLE_NOT_ALIGNED' }] }, 'single entry, alignment_verdict does NOT start with "ALIGNED" — proceeds_aligned_pct must be exactly 0, not a partial match on the shared "ALIGNED" substring'],
  [{ use_of_proceeds: [{ amount: (1 / 3) * 3, alignment_verdict: 'ALIGNED' }] }, 'amount = (1/3)*3, x/y*y!==x style — since aligned_proceeds and total_proceeds both sum the identical value, proceeds_aligned_pct must still resolve to exactly 100, division noise must not push it a hair under the threshold'],
  [{ use_of_proceeds: [] }, 'empty use_of_proceeds — proceeds_aligned_pct must be exactly 0 (total_proceeds=0 ternary branch), never NaN from 0/0'],
  [{ use_of_proceeds: [{ amount: 0, alignment_verdict: 'ALIGNED' }] }, 'single entry with amount exactly zero — total_proceeds is 0, must take the 0/0 ternary branch, proceeds_aligned_pct exactly 0'],
  [{ use_of_proceeds: [{ amount: -0, alignment_verdict: 'ALIGNED' }] }, 'amount negative zero — must behave as zero, no NaN'],
  [{ use_of_proceeds: [{ amount: 8500, alignment_verdict: 'ALIGNED' }, { amount: 1500, alignment_verdict: 'ELIGIBLE_NOT_ALIGNED' }] }, 'proceeds_aligned_pct exactly 85% — must classify not proceeds_threshold_met (85<100) but conformance_score must credit the ">=85" partial-proceeds tier (20 points), never the full 40'],
  [{ factsheet: SECTIONS.map((s, i) => ({ section: s, status: i === 0 ? 'partial' : 'complete' })) }, 'exactly one Annex I section "partial" (not "missing" or "complete") — annex_i_gaps must include it, annex_i_complete false, conformance_score must credit the "gaps<=2" partial-Annex-I tier (15 points)'],
  [{ factsheet: SECTIONS.map((s) => ({ section: s, status: 'complete' })), use_of_proceeds: [{ amount: 100, alignment_verdict: 'ALIGNED' }], allocation_report: 'complete', external_reviewer: 'appointed' }, 'every gate exactly satisfied — conformance_score must be exactly 100, conformance_grade exactly "A", label_ready true'],
  [{ external_reviewer: 'pending' }, 'external_reviewer exactly "pending" (not "appointed" or "none") — reviewer_ready false, but conformance_score must still credit the pending partial tier (5 points), distinct from the none tier (0 points)'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { proceeds_aligned_pct, conformance_score, conformance_grade, label_ready } = r.output_payload;
    const plausible = Number.isFinite(proceeds_aligned_pct) && Number.isFinite(conformance_score)
      && typeof conformance_grade === 'string' && typeof label_ready === 'boolean';
    rows.push({ label, input: pp, proceeds_aligned_pct, conformance_score, conformance_grade, label_ready, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_proceedsThresholdExact());
results.properties.push(checkP2_labelReadyLogicalAnd());
results.properties.push(checkP3_gradeMatchesScoreTier());
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
