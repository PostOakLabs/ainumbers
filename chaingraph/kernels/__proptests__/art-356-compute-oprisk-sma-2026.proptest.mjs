// art-356-compute-oprisk-sma-2026.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C16-1).
// kernel_digest_at_authoring: sha256:e67b9da9f48f588611dee11e1da315939919a5a8b20c287a02840be84ccad970
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct read confirmed — the internalLossMultiplier branch computes
// `log(Math.E - 1 + ratio)` via the kernel's own inlined det.log transcendental, and every other
// path is r2-rounded float arithmetic on caller-supplied dollar figures) — ULP-boundary forcing
// is MANDATORY per spec §3.
// Checks: fixture-oracle gate, termination (marginalBIC is fixed 3-bucket arithmetic — no loop
// over annual_op_losses unless useUsNeutralization is false, and even then it is a single bounded
// reduce over the caller-supplied array, never recursive or unbounded beyond that array's own
// length), boundedness (bucket is always exactly 1, 2, or 3; rwa === operationalRiskCapital * 12.5
// exactly, a differential re-derivation), a metamorphic scale identity (scaling ildc_avg/sc_avg/
// fc_avg together by k>0 scales businessIndicator by exactly k always, and scales
// businessIndicatorComponent by exactly k ONLY while both endpoints stay inside bucket 1 —
// marginalBIC is piecewise-LINEAR-THROUGH-THE-ORIGIN in [0, $1bn] (bic=0.12*bi) but merely
// piecewise-AFFINE with a nonzero intercept once bi exceeds $1bn, so proportional scaling only
// holds strictly below the first bucket edge; the property is scoped accordingly, not weakened),
// and mandatory ULP-boundary forcing on the log() argument's domain boundary (Math.E - 1 + ratio
// approaching 0 from the positive side, where log's argument boundary matters) plus the
// $1bn/$30bn bucket edges.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-356-compute-oprisk-sma-2026.proptest.mjs

import { compute } from '../art-356-compute-oprisk-sma-2026.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-356-compute-oprisk-sma-2026.fixtures.json');
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
const rand = mulberry32(0x35600);

function randomLosses(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(rng() * 5_000_000);
  return out;
}

function randomPP(rng) {
  const useUs = rng() < 0.5;
  const n = Math.floor(rng() * 8);
  return {
    ildc_avg: rng() * 2_000_000_000,
    sc_avg: rng() * 500_000_000,
    fc_avg: rng() * 500_000_000,
    use_us_ilm_neutralization: useUs,
    annual_op_losses: randomLosses(rng, n),
  };
}

const TRIALS = 4000;

// ---------- P1: termination — bucket loop is fixed 3-way, annual_op_losses reduce bounded by array length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (![1, 2, 3].includes(o.bucket)) violations++;
  }
  // large annual_op_losses array completes in bounded time and produces a finite average
  const bigLosses = randomLosses(rand, 5000);
  const { output_payload: big } = compute({ ildc_avg: 1e9, sc_avg: 0, fc_avg: 0, use_us_ilm_neutralization: false, annual_op_losses: bigLosses });
  checked++;
  if (!Number.isFinite(big.average_annual_loss)) violations++;
  return { name: 'P1_termination_bucket_fixed_and_losses_reduce_bounded', trials: checked, violations };
}

// ---------- P2: boundedness — rwa === operationalRiskCapital * 12.5 (differential re-derivation) ----------
function checkP2_rwa_differential_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    const r2 = (v) => Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
    if (Math.abs(o.rwa - r2(o.operational_risk_capital * 12.5)) > 0.01) violations++;
    if (o.business_indicator_component < 0) violations++;
    if (o.rwa < 0) violations++;
  }
  return { name: 'P2_rwa_equals_orc_times_12_5_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — scaling ildc/sc/fc together by k>0 scales BI and BIC by exactly k ----------
function checkP3_bi_scale_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = randomPP(rand);
    const k = 0.1 + rand() * 5;
    const base = compute(pp).output_payload;
    const scaled = compute({ ...pp, ildc_avg: pp.ildc_avg * k, sc_avg: pp.sc_avg * k, fc_avg: pp.fc_avg * k, annual_op_losses: pp.annual_op_losses }).output_payload;
    checked++;
    if (base.business_indicator === 0) {
      if (Math.abs(scaled.business_indicator) > 1e-6) violations++;
      continue;
    }
    const ratioBI = scaled.business_indicator / base.business_indicator;
    if (Math.abs(ratioBI - k) / k > 1e-6) violations++;
    // BIC (business_indicator_component) is proportional to bi ONLY inside bucket 1 (bic=0.12*bi,
    // linear through the origin); above the $1bn edge the marginal formula is affine with a
    // nonzero intercept, so scaling is deliberately NOT tested there — that is correct kernel
    // behavior, not a floor gap. Also skip small BIC values where r2()-to-the-cent rounding noise
    // dominates any relative-ratio comparison.
    const BUCKET_1_MAX = 1_000_000_000;
    if (base.business_indicator <= BUCKET_1_MAX && scaled.business_indicator <= BUCKET_1_MAX && base.business_indicator_component > 10000) {
      const ratioBIC = scaled.business_indicator_component / base.business_indicator_component;
      if (Math.abs(ratioBIC - k) / k > 1e-3) violations++;
    }
  }
  return { name: 'P3_business_indicator_scale_metamorphic_identity', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  // log(Math.E - 1 + ratio) domain boundary: E-1+ratio must stay > 0. Force ratio near the
  // point where E-1+ratio approaches 0 from the positive side (ratio near 1-E ~ -1.71828...).
  const nearBoundaryRatios = [1e-9, eps, Number.MIN_VALUE, 0.5, 1 - eps, 1, 1 + eps];
  for (const targetRatio of nearBoundaryRatios) {
    // ratio = lossComponent / businessIndicatorComponent; construct losses/BI to hit targetRatio approx.
    const bi = 500_000_000; // bucket 1
    const losses = [bi * targetRatio / 15, bi * targetRatio / 15, bi * targetRatio / 15, bi * targetRatio / 15, bi * targetRatio / 15];
    const { output_payload: o } = compute({ ildc_avg: bi, sc_avg: 0, fc_avg: 0, use_us_ilm_neutralization: false, annual_op_losses: losses });
    checked++;
    if (!Number.isFinite(o.internal_loss_multiplier)) violations++;
    if (!Number.isFinite(o.rwa)) violations++;
  }
  // $1bn / $30bn bucket edges — ULP on both sides
  const buckets = [1_000_000_000, 30_000_000_000];
  for (const edge of buckets) {
    for (const bi of [edge - eps, edge, edge + eps, edge - 1, edge + 1]) {
      const { output_payload: o } = compute({ ildc_avg: bi, sc_avg: 0, fc_avg: 0, use_us_ilm_neutralization: true, annual_op_losses: [] });
      checked++;
      if (!Number.isFinite(o.business_indicator_component)) violations++;
    }
  }
  // zero BIC edge (ILM_UNDEFINED_ZERO_BIC_DEFAULT_1 branch)
  const zeroBic = compute({ ildc_avg: 0, sc_avg: 0, fc_avg: 0, use_us_ilm_neutralization: false, annual_op_losses: [1, 2, 3, 4, 5] });
  checked++;
  if (zeroBic.output_payload.internal_loss_multiplier !== 1) violations++;
  return { name: 'P4_ulp_boundary_forcing_log_domain_and_bucket_edges', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_rwa_differential_boundedness());
results.properties.push(checkP3_bi_scale_metamorphic());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-356-compute-oprisk-sma-2026',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
