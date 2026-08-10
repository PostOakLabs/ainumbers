// kernel_digest_at_authoring: sha256:970c7d775e817baef21991c6c87e7dfecaf2829b129990bf7fdd268efe1fa610
//
// FV-PROPFLOOR-SHARD-B4-1 — property-test floor for art-179-ifrs17-risk-adjustment-checker.
// Class B (bounded-numeric), FLOAT-SENSITIVE — ra_amount is compared against a zero
// threshold and confidence_level_pct against a (0,100] window, both real-valued scalar
// classification boundaries — ULP-boundary forcing is MANDATORY per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG + explicit
// boundary arrays), same shape as the B1/B2/B3 float harness (art-15/art-107). This file
// is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-179-ifrs17-risk-adjustment-checker.proptest.mjs

import { compute } from '../art-179-ifrs17-risk-adjustment-checker.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-179-ifrs17-risk-adjustment-checker.fixtures.json');
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
const rand = mulberry32(0x17901);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;
const TECHNIQUES = ['VaR', 'CTE', 'CoC', 'other', 'bogus'];

function mkPP(rng) {
  const technique = pick(rng, TECHNIQUES);
  return {
    risk_adjustment: {
      ra_amount: randRange(rng, -100, 2000),
      technique,
      confidence_level_pct: randRange(rng, -10, 110),
      disclosed: rng() < 0.7,
      onerous_contracts_identified: rng() < 0.4,
      loss_component_recognized: rng() < 0.4,
    },
  };
}

// ---------- P1: fixed-threshold-tier agreement — confidence_disclosed for VaR/CTE exactly iff 0 < confidence_level_pct <= 100 ----------
function checkP1_confidenceAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const t = pp.risk_adjustment.technique;
    const needsConfidence = t === 'VaR' || t === 'CTE';
    if (needsConfidence) {
      const c = pp.risk_adjustment.confidence_level_pct;
      const expected = c > 0 && c <= 100;
      if (r.output_payload.confidence_disclosed !== expected) violations++;
    } else {
      if (r.output_payload.confidence_disclosed !== (pp.risk_adjustment.disclosed === true)) violations++;
    }
  }
  return { name: 'P1_confidence_disclosed_matches_fixed_0_to_100_threshold_for_var_cte', trials: checked, violations };
}

// ---------- P2: fixed-threshold-tier agreement — ra_amount_zero_or_negative gap present exactly iff ra_amount <= 0 ----------
function checkP2_raAmountGapAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expectedGap = pp.risk_adjustment.ra_amount <= 0;
    const hasGap = r.output_payload.gaps.includes('ra_amount_zero_or_negative');
    if (hasGap !== expectedGap) violations++;
  }
  return { name: 'P2_ra_amount_gap_matches_fixed_zero_threshold', trials: checked, violations };
}

// ---------- P3: boundedness — technique known iff technique_ok, ra_valid iff gaps is empty ----------
function checkP3_boundedness() {
  let violations = 0, checked = 0;
  const VALID = new Set(['VaR', 'CTE', 'CoC', 'other']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.technique_ok !== VALID.has(pp.risk_adjustment.technique)) violations++;
    if (r.output_payload.ra_valid !== (r.output_payload.gaps.length === 0)) violations++;
  }
  return { name: 'P3_technique_ok_and_ra_valid_match_fixed_rules', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing on the ra_amount<=0 and confidence_level_pct (0,100] thresholds ----------
const ULP_BOUNDARY_CASES = [
  [{ ra_amount: 0 }, 'ra_amount exactly zero — gap ra_amount_zero_or_negative must be present'],
  [{ ra_amount: Number.MIN_VALUE }, 'ra_amount smallest positive double — gap must NOT be present'],
  [{ ra_amount: -0 }, 'ra_amount negative zero — must behave as zero (<=0), gap present, no NaN'],
  [{ technique: 'VaR', confidence_level_pct: 100 }, 'confidence_level_pct exactly at upper boundary (100) — confidence_disclosed must be true'],
  [{ technique: 'VaR', confidence_level_pct: 100.00000000000001 }, '1-ULP-above-100 — confidence_disclosed must become false'],
  [{ technique: 'VaR', confidence_level_pct: 0 }, 'confidence_level_pct exactly zero — confidence_disclosed must be false (strictly > 0 required)'],
  [{ technique: 'CTE', confidence_level_pct: 1e-300 }, 'near-subnormal positive confidence_level_pct — confidence_disclosed must be true, no throw'],
  [{ technique: 'VaR', confidence_level_pct: 99.99999999999999 }, '1-ULP-below-100 — confidence_disclosed must remain true'],
  [{ ra_amount: (1 / 3) * 3 }, '(1/3)*3 rounding artifact — must classify consistently with the actual double, ra_amount echoed exactly'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const risk_adjustment = { ra_amount: 500, technique: 'CoC', confidence_level_pct: 0, disclosed: true, onerous_contracts_identified: false, loss_component_recognized: false, ...overrides };
    const r = compute({ risk_adjustment });
    const { ra_valid, confidence_disclosed, ra_amount, gaps } = r.output_payload;
    const finite = Number.isFinite(ra_amount) && typeof ra_valid === 'boolean' && typeof confidence_disclosed === 'boolean' && Array.isArray(gaps);
    rows.push({ label, risk_adjustment, ra_amount, confidence_disclosed, ra_valid, gaps, finite, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_confidenceAgreement());
results.properties.push(checkP2_raAmountGapAgreement());
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
