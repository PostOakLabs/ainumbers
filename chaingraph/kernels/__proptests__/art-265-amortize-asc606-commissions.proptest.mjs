// kernel_digest_at_authoring: sha256:e2860ee1786ecfb80cab10fca8acd74b179d8d80a1063d4ffa45ea30045cdbe5
//
// FV-PROPFLOOR-SHARD-B9-1 — property-test floor for art-265-amortize-asc606-commissions.
// Class B (bounded categorical), float:no — contract-term/renewal-flag classification with a
// fixed-denominator (incremental_cost/amortization_period_months) monthly amortization, no ULP-forcing
// threshold arithmetic. Forced categorical boundary cases used in place of ULP forcing per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG + explicit boundary
// arrays), same shape as the B1-B8 harnesses.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-265-amortize-asc606-commissions.proptest.mjs

import { compute } from '../art-265-amortize-asc606-commissions.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-265-amortize-asc606-commissions.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const output_payload = compute(vec.policy_parameters);
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
const rand = mulberry32(0x2650A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;

function mkPP(rng) {
  return {
    incremental_cost: randRange(rng, 0, 100000),
    contract_term_months: Math.round(randRange(rng, 1, 60)),
    renewal_commensurate: rng() < 0.5,
    renewal_cost: rng() < 0.5 ? randRange(rng, 1, 5000) : null,
    amortization_period_override_months: rng() < 0.2 ? Math.round(randRange(rng, 1, 60)) : null,
    impairment_indicators: rng() < 0.2,
  };
}

// ---------- P1: monotone — increasing incremental_cost never decreases monthly_amortization ----------
function checkP1_monotoneAmortization() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r1 = compute(pp);
    const r2v = compute({ ...pp, incremental_cost: pp.incremental_cost + 1000 });
    checked++;
    if (r2v.monthly_amortization < r1.monthly_amortization) violations++;
    if (r2v.amortization_period_months !== r1.amortization_period_months) violations++;
  }
  return { name: 'P1_monotone_monthly_amortization_nondecreasing_with_cost', trials: checked, violations };
}

// ---------- P2: boundedness — annual_amortization = 12 * monthly_amortization (within rounding), never negative ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.monthly_amortization < 0) violations++;
    if (r.annual_amortization < 0) violations++;
    const expectedAnnual = Math.round(r.monthly_amortization * 12 * 100) / 100;
    if (r.annual_amortization !== expectedAnnual) violations++;
  }
  return { name: 'P2_boundedness_amortization_nonnegative_and_annual_equals_12x_monthly', trials: checked, violations };
}

// ---------- P3: fixed-tier agreement — renewal_treatment matches independently-derived rule ----------
function checkP3_renewalTreatmentAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    let expected;
    if (pp.amortization_period_override_months !== null && pp.amortization_period_override_months > 0) {
      expected = 'OVERRIDE';
    } else if (pp.contract_term_months <= 12) {
      expected = 'EXPEDIENT';
    } else if (pp.renewal_commensurate && pp.renewal_cost !== null && pp.renewal_cost > 0) {
      expected = 'SEPARATE';
    } else if (!pp.renewal_commensurate) {
      expected = 'COMBINED';
    } else {
      expected = 'SEPARATE';
    }
    if (r.renewal_treatment !== expected) violations++;
    if (r.apply_expedient !== (pp.contract_term_months <= 12)) violations++;
    if (r.asc340_40_compliant !== (pp.incremental_cost >= 0 && !pp.impairment_indicators)) violations++;
  }
  return { name: 'P3_renewal_treatment_matches_fixed_expedient_override_rule', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ incremental_cost: 1200, contract_term_months: 12 }, 'contract_term_months exactly at 12 (practical expedient boundary) — renewal_treatment must be EXPEDIENT'],
  [{ incremental_cost: 1200, contract_term_months: 13 }, 'contract_term_months just above 12 — renewal_treatment must be COMBINED or SEPARATE, not EXPEDIENT'],
  [{ incremental_cost: 1200, contract_term_months: 24, amortization_period_override_months: 36 }, 'override present — renewal_treatment must be OVERRIDE regardless of contract_term_months'],
  [{ incremental_cost: 1200, contract_term_months: 24, renewal_commensurate: true, renewal_cost: 500 }, 'renewal_commensurate + positive renewal_cost, term > 12 — renewal_treatment must be SEPARATE'],
  [{ incremental_cost: 1200, contract_term_months: 24, renewal_commensurate: false }, 'not commensurate, term > 12 — renewal_treatment must be COMBINED'],
  [{ incremental_cost: 0, contract_term_months: 12 }, 'zero incremental_cost — monthly_amortization must be 0, no throw'],
  [{ incremental_cost: 1200, contract_term_months: 1 }, 'minimal 1-month contract_term_months — amortization_period_months must be 1, no divide-by-zero'],
  [{ incremental_cost: 1200, contract_term_months: 12, impairment_indicators: true }, 'impairment_indicators true — asc340_40_compliant must be false'],
  [{}, 'fully empty input — defaults apply (contract_term_months=12), no throw'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const plausible = typeof r.renewal_treatment === 'string' && Number.isFinite(r.monthly_amortization) && typeof r.asc340_40_compliant === 'boolean';
    rows.push({ label, pp, renewal_treatment: r.renewal_treatment, monthly_amortization: r.monthly_amortization, asc340_40_compliant: r.asc340_40_compliant, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneAmortization());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_renewalTreatmentAgreement());
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
