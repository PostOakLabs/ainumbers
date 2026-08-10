// kernel_digest_at_authoring: sha256:722f77361c37a5635fe5deb2077fcc3faccb5ec84a872dc0cdbfebc3027e0037
//
// FV-PROPFLOOR-SHARD-B4-1 — property-test floor for art-177-ifrs17-measurement-model-classifier.
// Class B (bounded-numeric), FLOAT-SENSITIVE — coverage_period_months is coerced via a
// Number() helper and compared against a fixed <=12 threshold, a scalar real-valued
// classification boundary — ULP-boundary forcing is MANDATORY per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG + explicit
// boundary arrays), same shape as the B1/B2/B3 float harness (art-15/art-107). This file
// is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-177-ifrs17-measurement-model-classifier.proptest.mjs

import { compute } from '../art-177-ifrs17-measurement-model-classifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-177-ifrs17-measurement-model-classifier.fixtures.json');
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
const rand = mulberry32(0x17701);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;

function mkPP(rng) {
  return {
    contract: {
      coverage_period_months: randRange(rng, -5, 60),
      direct_participating_features: rng() < 0.5,
      is_reinsurance: rng() < 0.5,
      premium_allocation_approach_election: rng() < 0.3,
      vfa_election: rng() < 0.3,
    },
  };
}

// ---------- P1: round-trip identity — finite coverage_period_months passes through to output unchanged ----------
function checkP1_coverageRoundTrip() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.coverage_period_months !== pp.contract.coverage_period_months) violations++;
  }
  return { name: 'P1_coverage_period_months_roundtrip_exact_for_finite_input', trials: checked, violations };
}

// ---------- P2: fixed-threshold-tier agreement — paa_eligible exactly iff 0 < coverage_months <= 12 ----------
function checkP2_paaEligibleAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const c = pp.contract.coverage_period_months;
    const expected = c > 0 && c <= 12;
    if (r.output_payload.paa_eligible !== expected) violations++;
  }
  return { name: 'P2_paa_eligible_matches_fixed_0_to_12_month_threshold', trials: checked, violations };
}

// ---------- P3: boundedness — measurement_model always one of the 3 known models, eligible_models always contains GMM ----------
function checkP3_boundedness() {
  let violations = 0, checked = 0;
  const KNOWN = new Set(['PAA', 'VFA', 'GMM']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (!KNOWN.has(r.output_payload.measurement_model)) violations++;
    if (!r.output_payload.eligible_models.includes('GMM')) violations++;
    if (!r.output_payload.eligible_models.includes(r.output_payload.measurement_model)) violations++;
  }
  return { name: 'P3_boundedness_model_in_known_set_and_eligible_contains_gmm_and_chosen', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing on the coverage_period_months <=12 threshold ----------
const ULP_BOUNDARY_CASES = [
  [{ coverage_period_months: 12 }, 'exactly at PAA threshold (12) — paa_eligible must be true'],
  [{ coverage_period_months: 12.000000000000002 }, '1-ULP-above-12 (double past exact 12) — paa_eligible must be false'],
  [{ coverage_period_months: 11.999999999999998 }, '1-ULP-below-12 — paa_eligible must remain true'],
  [{ coverage_period_months: 0 }, 'coverage_period_months exactly zero — paa_eligible must be false (strictly > 0 required)'],
  [{ coverage_period_months: -0 }, 'coverage_period_months negative zero — must behave as zero, paa_eligible false, no NaN'],
  [{ coverage_period_months: Number.MIN_VALUE }, 'smallest positive double — paa_eligible must be true (still > 0 and <= 12)'],
  [{ coverage_period_months: 1e-300 }, 'near-subnormal positive — paa_eligible must be true, no throw'],
  [{ coverage_period_months: 4 * 3 }, '4*3 exact double (12) — paa_eligible must be true, canonical multiplication artifact check'],
  [{ coverage_period_months: (0.1 * 3 + 11.7) }, '0.1*3+11.7 rounding artifact near 12 — must classify consistently with the actual double value, no throw'],
  [{ coverage_period_months: Number.MAX_SAFE_INTEGER }, 'coverage_period_months at MAX_SAFE_INTEGER — paa_eligible must be false, no overflow/NaN'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = { contract: { direct_participating_features: false, is_reinsurance: false, ...overrides } };
    const r = compute(pp);
    const { measurement_model, paa_eligible, coverage_period_months } = r.output_payload;
    const finite = Number.isFinite(coverage_period_months) && typeof measurement_model === 'string' && !measurement_model.includes('NaN');
    rows.push({ label, coverage_period_months: pp.contract.coverage_period_months, measurement_model, paa_eligible, finite, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_coverageRoundTrip());
results.properties.push(checkP2_paaEligibleAgreement());
results.properties.push(checkP3_boundedness());
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
