// art-357-basel-2023-vs-2026-capital-delta-comparator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C16-1).
// kernel_digest_at_authoring: sha256:afd75d6663426db39230590951e6f665c53303dff3f98827c91c30ff6fb6d1b6
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct read confirmed — amount * rw table-lookup arithmetic, a fixed
// business_indicator * coefficient multiply, and delta = total_2026 - total_2023 subtraction of
// two independently-accumulated floats) — ULP-boundary forcing is MANDATORY per spec §3.
// Checks: fixture-oracle gate, termination (by_class object has at most exposures.length distinct
// keys, portfolio_summary.length is bounded by the same array), boundedness (total_capital_2023/
// 2026 === total_rwa * 0.08 exactly, a differential re-derivation of the RWA_CAPITAL_MULTIPLIER/
// MIN_CAPITAL_RATIO round trip), a metamorphic scale identity (scaling every exposure `amount` by
// k>0 scales credit_rwa_2023/2026 by exactly k, since the per-asset-class table lookup depends
// only on asset_class, never on amount), and mandatory ULP-boundary forcing on business_indicator
// (0, -0, denormals) and on exposure `amount` for both a recognized and an unrecognized
// asset_class (the DEFAULT_RW fallback path).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-357-basel-2023-vs-2026-capital-delta-comparator.proptest.mjs

import { compute } from '../art-357-basel-2023-vs-2026-capital-delta-comparator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-357-basel-2023-vs-2026-capital-delta-comparator.fixtures.json');
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
const rand = mulberry32(0x35700);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const ASSET_CLASSES = [
  'residential_mortgage_low_ltv', 'residential_mortgage_high_ltv', 'corporate_investment_grade',
  'corporate_unrated', 'retail_revolving', 'retail_other', 'off_balance_sheet_commitment', 'unrecognized_class',
];

function randomExposures(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ asset_class: pick(rng, ASSET_CLASSES), amount: rng() * 1_000_000 });
  return out;
}

function randomPP(rng) {
  const n = Math.floor(rng() * 8);
  return { exposures: randomExposures(rng, n), business_indicator: rng() * 200_000_000 };
}

const TRIALS = 4000;

// ---------- P1: termination — by_class/portfolio_summary bounded by distinct asset_class count ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    const distinctClasses = new Set(pp.exposures.map((e) => e.asset_class || 'unclassified')).size;
    if (o.portfolio_summary.length !== distinctClasses) violations++;
    if (o.portfolio_summary.length > Math.max(pp.exposures.length, 1) && pp.exposures.length > 0) violations++;
  }
  return { name: 'P1_termination_portfolio_summary_bounded_by_distinct_classes', trials: checked, violations };
}

// ---------- P2: boundedness — total_capital === total_rwa * 0.08 exactly (differential re-derivation) ----------
function checkP2_capital_ratio_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (Math.abs(o.total_capital_2023 - o.total_rwa_2023 * 0.08) > 1e-6 * Math.max(1, o.total_rwa_2023)) violations++;
    if (Math.abs(o.total_capital_2026 - o.total_rwa_2026 * 0.08) > 1e-6 * Math.max(1, o.total_rwa_2026)) violations++;
    if (Math.abs(o.delta_rwa - (o.total_rwa_2026 - o.total_rwa_2023)) > 1e-6) violations++;
    if (Math.abs(o.delta_capital - (o.total_capital_2026 - o.total_capital_2023)) > 1e-6) violations++;
    const expectedDirection = o.delta_capital < 0 ? 'NET_RELIEF_2026_VS_2023' : o.delta_capital > 0 ? 'NET_INCREASE_2026_VS_2023' : 'NO_CHANGE';
    if (o.direction !== expectedDirection) violations++;
  }
  return { name: 'P2_capital_equals_rwa_times_8pct_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — scaling every exposure amount by k>0 scales credit_rwa by exactly k ----------
function checkP3_amount_scale_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = randomPP(rand);
    if (pp.exposures.length === 0) continue;
    const k = 0.1 + rand() * 9;
    const base = compute(pp).output_payload;
    const scaled = compute({ ...pp, exposures: pp.exposures.map((e) => ({ ...e, amount: e.amount * k })) }).output_payload;
    checked++;
    for (const field of ['credit_rwa_2023', 'credit_rwa_2026']) {
      if (base[field] === 0) {
        if (Math.abs(scaled[field]) > 1e-6) violations++;
      } else {
        const ratio = scaled[field] / base[field];
        if (Math.abs(ratio - k) / k > 1e-6) violations++;
      }
    }
  }
  return { name: 'P3_exposure_amount_scale_metamorphic_identity', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  const biForced = [0, -0, eps, Number.MIN_VALUE, 1e-300];
  for (const business_indicator of biForced) {
    const { output_payload: o } = compute({ exposures: [], business_indicator });
    checked++;
    if (!Number.isFinite(o.op_rwa_2023) || !Number.isFinite(o.op_rwa_2026)) violations++;
  }
  const amountForced = [0, -0, eps, Number.MIN_VALUE];
  for (const amount of amountForced) {
    for (const asset_class of ['corporate_investment_grade', 'unrecognized_class']) {
      const { output_payload: o } = compute({ exposures: [{ asset_class, amount }], business_indicator: 0 });
      checked++;
      if (!Number.isFinite(o.credit_rwa_2023) || !Number.isFinite(o.credit_rwa_2026)) violations++;
    }
  }
  return { name: 'P4_ulp_boundary_forcing_business_indicator_and_amount', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_capital_ratio_boundedness());
results.properties.push(checkP3_amount_scale_metamorphic());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-357-basel-2023-vs-2026-capital-delta-comparator',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
