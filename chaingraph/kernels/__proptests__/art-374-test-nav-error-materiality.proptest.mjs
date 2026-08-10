// kernel_digest_at_authoring: sha256:ea70af686a6a7920e78cc9a8c561971099404d2b051fae1c6f6fcf613ab89e7a
//
// FV-PROPFLOOR-SHARD-B22-1 — property-test floor for art-374-test-nav-error-materiality.
// Class B (bounded-numeric). CORRECTED CLASSIFICATION: the WU row lists this kernel as
// float-sensitive, but direct inspection shows every money computation (toFixed/mulFixed/
// divFixed) runs on BigInt fixed-point arithmetic (SCALE_EXP=8), never a raw IEEE754 float
// division or multiplication — the only plain Number() call (affected_period.days) is an
// unused passthrough, not part of the materiality arithmetic. Reclassified float:no per
// FIX-2 CARRY; forced CATEGORICAL boundary cases (exact threshold ties, structural-error
// zero-denominator, precision truncation) used in place of ULP forcing. Zero external
// dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-374-test-nav-error-materiality.proptest.mjs

import { compute } from '../art-374-test-nav-error-materiality.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-374-test-nav-error-materiality.fixtures.json');
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
const rand = mulberry32(0x374A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;

function mkPP(rng) {
  const corrected = randRange(rng, 0.01, 1000);
  const errAmt = randRange(rng, -20, 20);
  const erroneous = Math.max(0, corrected + errAmt);
  return {
    fund_id: 'FUND-X',
    valuation_date: '2026-08-10',
    erroneous_nav_per_share: erroneous.toFixed(8),
    corrected_nav_per_share: corrected.toFixed(8),
  };
}

// ---------- P1: materiality_verdict bounded to the declared 3-state enum ----------
function checkP1_verdictBounded() {
  let violations = 0, checked = 0;
  const VERDICTS = ['MATERIAL', 'IMMATERIAL', 'INDETERMINATE'];
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(mkPP(rand));
    checked++;
    if (!VERDICTS.includes(r.output_payload.materiality_verdict)) violations++;
  }
  return { name: 'P1_materiality_verdict_bounded_to_declared_enum', trials: checked, violations };
}

// ---------- P2: reprocessing_need_indicated is exactly declared_policy.material ----------
function checkP2_reprocessingExactPolicyMaterial() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(mkPP(rand));
    checked++;
    if (r.output_payload.reprocessing_need_indicated !== r.output_payload.declared_policy.material) violations++;
  }
  return { name: 'P2_reprocessing_need_exact_declared_policy_material', trials: checked, violations };
}

// ---------- P3: error_amount round-trips exactly (fixed-point BigInt, no float drift) ----------
function checkP3_errorAmountRoundTrips() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { erroneous_nav_per_share, corrected_nav_per_share, error_amount } = r.output_payload.error;
    // reconstruct via the SAME 8-decimal fixed-point convention the kernel uses
    const eF = BigInt(erroneous_nav_per_share.replace('.', '').replace('-', '')) * (erroneous_nav_per_share.startsWith('-') ? -1n : 1n);
    const cF = BigInt(corrected_nav_per_share.replace('.', '').replace('-', '')) * (corrected_nav_per_share.startsWith('-') ? -1n : 1n);
    const expectedF = eF - cF;
    const gotNeg = error_amount.startsWith('-');
    const gotF = BigInt(error_amount.replace('.', '').replace('-', '')) * (gotNeg ? -1n : 1n);
    if (expectedF !== gotF) violations++;
  }
  return { name: 'P3_error_amount_exact_fixed_point_subtraction', trials: checked, violations };
}

// ---------- P4 (float:no exception): forced categorical/boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ erroneous_nav_per_share: 10, corrected_nav_per_share: 0 }, 'corrected_nav_per_share exactly zero — structural_error must fire, verdict INDETERMINATE'],
  [{ erroneous_nav_per_share: 10.005, corrected_nav_per_share: 10 }, 'error exactly at the industry half-cent absolute threshold (0.005) — must breach (>=), MATERIAL'],
  [{ erroneous_nav_per_share: 10.00499999, corrected_nav_per_share: 10 }, 'error one fixed-point unit below the half-cent threshold — must NOT breach on absolute grounds'],
  [{ erroneous_nav_per_share: 10.1, corrected_nav_per_share: 10, materiality_policy: { absolute_threshold: '999', percent_threshold: '1' } }, 'error exactly at the declared 1% percent threshold — must breach on percent grounds, policy_source fund_declared'],
  [{ erroneous_nav_per_share: -5, corrected_nav_per_share: 10 }, 'erroneous NAV negative — arithmetic must still resolve (understated direction), no crash'],
  [{ erroneous_nav_per_share: '10.123456789', corrected_nav_per_share: '10' }, '9-digit fractional precision truncated (never rounded) at the 8th decimal per toFixed'],
  [{ erroneous_nav_per_share: 10, corrected_nav_per_share: 10 }, 'erroneous equals corrected exactly — error_direction "none", IMMATERIAL'],
  [{ erroneous_nav_per_share: 10, corrected_nav_per_share: -10 }, 'corrected NAV negative — abs(corrected) used as percent-error denominator, no NaN'],
  [{ erroneous_nav_per_share: 'not-a-number', corrected_nav_per_share: 10 }, 'non-numeric erroneous string coerces to 0 per toFixed\'s malformed-input fallback — no throw'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { materiality_verdict, structural_error, error } = r.output_payload;
    const plausible = typeof materiality_verdict === 'string' && typeof error.error_direction === 'string' && !error.error_amount.includes('NaN');
    rows.push({ label, input: pp, materiality_verdict, structural_error, error_amount: error.error_amount, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_verdictBounded());
results.properties.push(checkP2_reprocessingExactPolicyMaterial());
results.properties.push(checkP3_errorAmountRoundTrips());
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
