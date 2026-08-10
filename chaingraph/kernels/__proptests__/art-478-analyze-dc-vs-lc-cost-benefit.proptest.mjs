// kernel_digest_at_authoring: sha256:399294433cf13af7c9c72820fff550fb25f97a09c279902523b938e2a657ff0e
//
// FV-PROPFLOOR-SHARD-B25-1 — property-test floor for art-478-analyze-dc-vs-lc-cost-benefit.
// Class B (bounded-numeric), FLOAT-SENSITIVE (fee/break-even math is raw unrounded float
// arithmetic: quarters, percentage-of-invoice products, a division-based break-even probability)
// — ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-478-analyze-dc-vs-lc-cost-benefit.proptest.mjs

import { compute } from '../art-478-analyze-dc-vs-lc-cost-benefit.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-478-analyze-dc-vs-lc-cost-benefit.fixtures.json');
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
const rand = mulberry32(0x478C3);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 12000;

function mkPP(rng) {
  return {
    invoiceValueUSD: randRange(rng, 1000, 5000000),
    sellerCountryRisk: pick(rng, ['low', 'medium', 'high']),
    buyerCountryRisk: pick(rng, ['low', 'medium', 'high']),
    buyerRelationship: pick(rng, ['new', 'lt2', 'gte2']),
    paymentTermDays: randRange(rng, 0, 365),
    goodsStatus: pick(rng, ['shipped', 'manufacture']),
    lcType: pick(rng, ['sight', 'usance', 'confirmed_sight', 'confirmed_usance']),
    lcIssuancePctPerQuarter: randRange(rng, 0, 1),
    lcAdvisingFeeUSD: randRange(rng, 0, 1000),
    lcConfirmationPctPerQuarter: randRange(rng, 0, 1),
    lcNegotiationPct: randRange(rng, 0, 1),
    lcAmendmentFeeUSD: randRange(rng, 0, 500),
    lcExpectedAmendments: Math.floor(randRange(rng, 0, 5)),
    dcType: pick(rng, ['dp', 'da']),
    dcCollectingCommissionPct: randRange(rng, 0, 1),
    dcRemittingFeeUSD: randRange(rng, 0, 500),
    dcProtestFeeUSD: randRange(rng, 0, 2000),
    dcNonPaymentProbabilityPct: randRange(rng, 0, 100),
  };
}

// ---------- P1: boundedness — lcProtectionScore always in [0, 100] ----------
function checkP1_scoreBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const s = r.output_payload.lcProtectionScore;
    if (!(s >= 0 && s <= 100)) violations++;
  }
  return { name: 'P1_lc_protection_score_bounded_0_to_100', trials: checked, violations };
}

// ---------- P2: round-trip identity — lcRiskAdjCostUSD always exactly equals lcTotalFeesUSD ----------
function checkP2_lcRiskAdjIdentity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.lcRiskAdjCostUSD !== r.output_payload.lcTotalFeesUSD) violations++;
  }
  return { name: 'P2_lc_risk_adj_cost_exact_identity_with_lc_total_fees', trials: checked, violations };
}

// ---------- P3: fixed rule — recommendation matches the disjunctive formula exactly ----------
function checkP3_recommendationFormula() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { buyerCountryRisk: buyerR, buyerRelationship: buyerRel, goodsStatus: goodsSt, dcNonPaymentProbabilityPct: dcNonPayPct } = pp;
    const expectedLc = (buyerR === 'high' || buyerR === 'medium' || buyerRel === 'new' || buyerRel === 'lt2' || goodsSt === 'manufacture' || dcNonPayPct >= r.output_payload.breakEvenProbabilityPct);
    const expected = expectedLc ? 'LC' : 'DC';
    if (r.output_payload.recommendation !== expected) violations++;
    if (!['LC', 'DC'].includes(r.output_payload.recommendation)) violations++;
  }
  return { name: 'P3_recommendation_matches_disjunctive_formula', trials: checked, violations };
}

// ---------- P4: boundedness — dcRiskExposureUSD and breakEvenProbabilityPct never negative ----------
function checkP4_nonNegativeDerived() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.dcRiskExposureUSD < 0) violations++;
    if (r.output_payload.breakEvenProbabilityPct < 0) violations++;
  }
  return { name: 'P4_risk_exposure_and_break_even_never_negative', trials: checked, violations };
}

// ---------- P5 (mandatory): ULP-boundary forcing ----------
const BASE = { invoiceValueUSD: 500000, sellerCountryRisk: 'medium', buyerCountryRisk: 'medium', buyerRelationship: 'gte2', paymentTermDays: 60, goodsStatus: 'shipped', lcType: 'sight', lcIssuancePctPerQuarter: 0.125, lcAdvisingFeeUSD: 100, lcConfirmationPctPerQuarter: 0, lcNegotiationPct: 0, lcAmendmentFeeUSD: 75, lcExpectedAmendments: 1, dcType: 'dp', dcCollectingCommissionPct: 0.15, dcRemittingFeeUSD: 65, dcProtestFeeUSD: 1000, dcNonPaymentProbabilityPct: 5 };
const ULP_BOUNDARY_CASES = [
  [{ ...BASE, paymentTermDays: 90 }, 'paymentTermDays exactly at the 90-day quarter boundary (Math.ceil(90/90)=1) — quarters must be exactly 1, not 2'],
  [{ ...BASE, paymentTermDays: 90 + Number.EPSILON }, 'paymentTermDays one ULP past 90 — Math.ceil must push quarters to 2'],
  [{ ...BASE, paymentTermDays: 0 }, 'paymentTermDays exactly zero — quarters floors to Math.max(1,...) = 1, must not be 0 or NaN'],
  [{ ...BASE, dcProtestFeeUSD: 0, invoiceValueUSD: 0 }, 'beDenominator = dcProtest + invoice*(1-0.6) = 0 — break-even must resolve to 0 via the explicit guard, not divide-by-zero NaN/Infinity'],
  [{ ...BASE, dcNonPaymentProbabilityPct: 0, dcProtestFeeUSD: 0, invoiceValueUSD: 0 }, 'all break-even inputs zero simultaneously — must remain finite 0, no NaN propagation into recommendation'],
  [{ ...BASE, buyerCountryRisk: 'low', buyerRelationship: 'gte2', goodsStatus: 'shipped', dcNonPaymentProbabilityPct: 0 }, 'break-even probability computed exactly equal to dcNonPaymentProbabilityPct — boundary is >= so LC must be recommended at exact equality'],
  [{ ...BASE, invoiceValueUSD: Number.MAX_SAFE_INTEGER }, 'invoiceValueUSD at MAX_SAFE_INTEGER — all fee products must remain finite, no overflow to Infinity'],
  [{ ...BASE, lcIssuancePctPerQuarter: 1 / 3, lcConfirmationPctPerQuarter: 1 / 3 }, 'x/y*y!==x style non-exact-double fee percentages — lcTotalFeesUSD must be the exact double product the kernel computes, finite'],
  [{ ...BASE, invoiceValueUSD: -0 }, 'invoiceValueUSD negative zero — must behave as zero, no NaN in any downstream fee'],
  [{ ...BASE, dcNonPaymentProbabilityPct: Number.MIN_VALUE }, 'dcNonPaymentProbabilityPct smallest positive double — dcRiskExposureUSD must remain finite, non-negative'],
];

function checkP5_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const o = r.output_payload;
    const plausible = ['lcTotalFeesUSD', 'dcTotalFeesUSD', 'dcRiskExposureUSD', 'lcRiskAdjCostUSD', 'dcRiskAdjCostUSD', 'lcProtectionScore', 'breakEvenProbabilityPct'].every((k) => Number.isFinite(o[k]))
      && ['LC', 'DC'].includes(o.recommendation);
    rows.push({ label, input: pp, recommendation: o.recommendation, breakEvenProbabilityPct: o.breakEvenProbabilityPct, lcTotalFeesUSD: o.lcTotalFeesUSD, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_scoreBounded());
results.properties.push(checkP2_lcRiskAdjIdentity());
results.properties.push(checkP3_recommendationFormula());
results.properties.push(checkP4_nonNegativeDerived());
results.boundary_forced = checkP5_forced();

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
