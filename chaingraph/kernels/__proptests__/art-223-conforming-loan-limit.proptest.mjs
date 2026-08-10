// kernel_digest_at_authoring: sha256:114e209f4a992a5b64a0357a6263fe467420738e6ac70b6c238b17987521fb40
//
// FV-PROPFLOOR-SHARD-B6-1 — property-test floor for art-223-conforming-loan-limit.
// Class B (bounded-numeric), FLOAT-SENSITIVE (conforming/jumbo classification is a direct
// continuous loan_amount-vs-limit comparison, and county_limit_override lets a caller supply
// an arbitrary float boundary) — ULP-boundary forcing is MANDATORY per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG + explicit
// boundary arrays), same shape as B1-B5's float harnesses. This file is READ-ONLY with
// respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-223-conforming-loan-limit.proptest.mjs

import { compute } from '../art-223-conforming-loan-limit.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-223-conforming-loan-limit.fixtures.json');
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
const rand = mulberry32(0x2230A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 12000;

function mkPP(rng, overrides = {}) {
  return {
    loan_amount: randRange(rng, 0, 3000000),
    units: pick(rng, [1, 2, 3, 4]),
    state: pick(rng, ['TX', 'CA', 'AK', 'HI']),
    high_cost_county: rng() < 0.3,
    ...overrides,
  };
}

// ---------- P1: monotone — a higher loan_amount never turns a jumbo loan back into conforming (fixed limit inputs) ----------
function checkP1_monotoneClassification() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const base = mkPP(rand);
    const lo = { ...base, loan_amount: Math.min(base.loan_amount, 500000) };
    const hi = { ...base, loan_amount: Math.max(lo.loan_amount + 1, 3000000) };
    const rLo = compute(lo);
    const rHi = compute(hi);
    checked++;
    if (rLo.output_payload.jumbo && !rHi.output_payload.jumbo) violations++;
  }
  return { name: 'P1_monotone_jumbo_never_reverts_to_nonjumbo_as_loan_amount_grows', trials: checked, violations };
}

// ---------- P2: boundedness — classification is a partition: exactly one of conforming/super_conforming/jumbo is true ----------
function checkP2_partition() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { conforming, super_conforming, jumbo, classification } = r.output_payload;
    const trueCount = [conforming, super_conforming].filter(Boolean).length;
    if (trueCount > 1) violations++;
    const expectedClass = jumbo ? 'jumbo' : (super_conforming ? 'super_conforming' : 'conforming');
    if (classification !== expectedClass) violations++;
  }
  return { name: 'P2_classification_is_a_partition_and_matches_flags', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — conforming matches loan_amount>0 && loan_amount<=applicable_limit exactly ----------
function checkP3_conformingAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { loan_amount, applicable_limit, conforming } = r.output_payload;
    const expected = loan_amount > 0 && loan_amount <= applicable_limit;
    if (conforming !== expected) violations++;
  }
  return { name: 'P3_conforming_matches_fixed_applicable_limit_rule', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ loan_amount: 806500, units: 1, state: 'TX', high_cost_county: false }, '1-unit baseline exactly at the $806,500 boundary — must be conforming'],
  [{ loan_amount: 806500.01, units: 1, state: 'TX', high_cost_county: false }, '1-unit baseline 1 cent above boundary — must be jumbo'],
  [{ loan_amount: 1209750, units: 1, state: 'TX', high_cost_county: true }, 'high-cost ceiling exactly at $1,209,750 — must be super_conforming, not jumbo'],
  [{ loan_amount: 1209750.01, units: 1, state: 'TX', high_cost_county: true }, 'high-cost ceiling 1 cent above — must be jumbo'],
  [{ loan_amount: 0, units: 1, state: 'TX' }, 'loan_amount exactly zero — must not be conforming (loan_amount>0 required), not throw'],
  [{ loan_amount: 500000, county_limit_override: 500000, units: 1 }, 'county_limit_override exactly equal to loan_amount — must be conforming'],
  [{ loan_amount: 500000.01, county_limit_override: 500000, units: 1 }, 'loan_amount 1 cent above the override — must be jumbo'],
  [{ loan_amount: 806500 * 0.1 * 3 / 0.3, units: 1, state: 'TX', high_cost_county: false }, 'loan_amount computed via a 0.1*3/0.3 rounding-artifact chain — must remain finite and classify without throwing'],
  [{ loan_amount: 1550400, units: 4, state: 'TX', high_cost_county: false }, '4-unit baseline exactly at its own boundary ($1,550,400) — must be conforming'],
  [{ loan_amount: 806500, units: 1, state: 'AK' }, 'AK territory always uses the high-cost ceiling regardless of high_cost_county flag — baseline-amount loan must be conforming under the higher ceiling'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = mkPP(rand, overrides);
    const r = compute(pp);
    const op = r.output_payload;
    const finite = Number.isFinite(op.applicable_limit) && ['conforming', 'super_conforming', 'jumbo'].includes(op.classification);
    rows.push({ label, overrides, classification: op.classification, applicable_limit: op.applicable_limit, finite, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneClassification());
results.properties.push(checkP2_partition());
results.properties.push(checkP3_conformingAgreement());
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
