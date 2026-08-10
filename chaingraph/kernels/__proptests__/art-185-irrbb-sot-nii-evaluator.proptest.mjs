// kernel_digest_at_authoring: sha256:2d05e7c0659fd1f50c44dfda82c85033da1c389295bdad27c99998a4077f98cc
//
// FV-PROPFLOOR-SHARD-B5-1 — property-test floor for art-185-irrbb-sot-nii-evaluator.
// Class B (bounded supervisory-outlier evaluator, caller-supplied threshold). float-sensitive:
// yes -- the pct-of-projected-NII comparison against a caller-supplied threshold is a raw-division
// threshold. ULP-boundary forcing is mandatory per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the B1/B2/B3 harnesses.
// Read-only w.r.t. the kernel.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-185-irrbb-sot-nii-evaluator.proptest.mjs

import { compute } from '../art-185-irrbb-sot-nii-evaluator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-185-irrbb-sot-nii-evaluator.fixtures.json');
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
const rand = mulberry32(0x18501);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

const TRIALS = 8000;

function mkPP(rng) {
  return {
    nii_shock: {
      delta_nii_parallel_up: randRange(rng, -1000, 1000),
      delta_nii_parallel_down: randRange(rng, -1000, 1000),
    },
    baseline: {
      projected_nii: rng() < 0.05 ? 0 : randRange(rng, 1, 5000),
      sot_nii_threshold_pct: rng() < 0.1 ? 0 : randRange(rng, 1, 30),
    },
  };
}

// ---------- P1: threshold agreement -- nii_outlier and pct match the raw formula exactly ----------
function checkP1_thresholdAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const expWorst = Math.min(pp.nii_shock.delta_nii_parallel_up, pp.nii_shock.delta_nii_parallel_down);
    const declineAbs = Math.abs(Math.min(0, expWorst));
    const expPct = pp.baseline.projected_nii > 0 ? Math.round((declineAbs / pp.baseline.projected_nii) * 10000) / 100 : 0;
    const expThresholdSet = pp.baseline.sot_nii_threshold_pct > 0;
    const expOutlier = expThresholdSet && expPct > pp.baseline.sot_nii_threshold_pct;
    if (r.worst_delta_nii !== expWorst) violations++;
    if (r.delta_nii_pct_of_nii !== expPct) violations++;
    if (r.threshold_set !== expThresholdSet) violations++;
    if (r.nii_outlier !== expOutlier) violations++;
  }
  return { name: 'P1_nii_outlier_matches_raw_threshold_formula', trials: checked, violations };
}

// ---------- P2: boundedness -- pct non-negative; threshold echoed unchanged ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (r.delta_nii_pct_of_nii < 0) violations++;
    if (r.sot_nii_threshold_pct !== pp.baseline.sot_nii_threshold_pct) violations++;
    if (r.projected_nii !== pp.baseline.projected_nii) violations++;
  }
  return { name: 'P2_boundedness_pct_nonneg_and_echoed_fields', trials: checked, violations };
}

// ---------- P3: monotone -- a larger NII decline (holding baseline fixed) never decreases delta_nii_pct_of_nii ----------
function checkP3_monotone() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const worse = {
      nii_shock: {
        delta_nii_parallel_up: pp.nii_shock.delta_nii_parallel_up - 500,
        delta_nii_parallel_down: pp.nii_shock.delta_nii_parallel_down - 500,
      },
      baseline: pp.baseline,
    };
    const r1 = compute(pp).output_payload;
    const r2 = compute(worse).output_payload;
    checked++;
    if (r2.delta_nii_pct_of_nii < r1.delta_nii_pct_of_nii) violations++;
  }
  return { name: 'P3_monotone_pct_nondecreasing_with_larger_decline', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (float_sensitive: yes) ----------
const ULP_BOUNDARY_CASES = [
  [{ nii_shock: { delta_nii_parallel_up: 0, delta_nii_parallel_down: -100 }, baseline: { projected_nii: 1000, sot_nii_threshold_pct: 10 } }, 'pct exactly 10% -- must NOT be outlier (> is strict)'],
  [{ nii_shock: { delta_nii_parallel_up: 0, delta_nii_parallel_down: -100.00000000000001 }, baseline: { projected_nii: 1000, sot_nii_threshold_pct: 10 } }, 'pct 1 ULP above threshold -- must be outlier'],
  [{ nii_shock: { delta_nii_parallel_up: 0, delta_nii_parallel_down: 0 }, baseline: { projected_nii: 1000, sot_nii_threshold_pct: 10 } }, 'no decline -- decline_abs 0, never outlier'],
  [{ nii_shock: { delta_nii_parallel_up: 0, delta_nii_parallel_down: -500 }, baseline: { projected_nii: 0, sot_nii_threshold_pct: 10 } }, 'zero projected_nii -- guarded division, pct 0'],
  [{ nii_shock: { delta_nii_parallel_up: 0, delta_nii_parallel_down: -500 }, baseline: { projected_nii: 1000, sot_nii_threshold_pct: 0 } }, 'threshold_pct exactly 0 -- threshold_set false, never outlier regardless of decline'],
  [{ nii_shock: { delta_nii_parallel_up: -0, delta_nii_parallel_down: -0 }, baseline: { projected_nii: 1000, sot_nii_threshold_pct: 10 } }, 'negative-zero deltas -- must behave as zero'],
  [{ nii_shock: { delta_nii_parallel_up: 0, delta_nii_parallel_down: -Number.MIN_VALUE }, baseline: { projected_nii: 1000, sot_nii_threshold_pct: 10 } }, 'denormal decline -- must stay finite'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const finite = Number.isFinite(r.delta_nii_pct_of_nii) && Number.isFinite(r.worst_delta_nii) && Number.isFinite(r.projected_nii);
    rows.push({ label, pp, delta_nii_pct_of_nii: r.delta_nii_pct_of_nii, nii_outlier: r.nii_outlier, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_thresholdAgreement());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_monotone());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  tool_id: 'art-185-irrbb-sot-nii-evaluator',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
