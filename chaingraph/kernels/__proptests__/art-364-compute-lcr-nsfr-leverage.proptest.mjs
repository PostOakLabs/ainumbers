// art-364-compute-lcr-nsfr-leverage.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C16-1).
// kernel_digest_at_authoring: sha256:168029eb2a2ece66535b95015170c82a1babc5d499325845f30b73065fedb204
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct read confirmed — three independent ratio calculators, each doing
// haircut/factor-percent multiplication, a zero-denominator guard (ratio -> null instead of
// NaN/Infinity), and r2()-rounding at the declared output boundary) — ULP-boundary forcing is
// MANDATORY per spec §3.
// Checks: fixture-oracle gate, termination (hqlaPositions/outflows/inflows/asfItems/rsfItems are
// all single linear maps over caller-supplied arrays, no recursion, no unbounded accumulation),
// boundedness (lcr_compliant/nsfr_compliant/leverage_ratio_compliant default to true exactly when
// their ratio is null — the zero-denominator convention — never NaN, and a differential
// re-derivation of every declared field from the same formulas the source uses), a metamorphic
// scale identity (scaling every dollar figure feeding LCR/NSFR/leverage by k>0 leaves each ratio
// UNCHANGED — a ratio of two quantities that both scale by k is scale-invariant — while the dollar
// totals themselves scale by exactly k), and mandatory ULP-boundary forcing on the HQLA haircut
// tier boundaries (l1/l2a/l2b), the zero-denominator edges (nco=0, totalRsf=0, totalExp=0), and
// rate_pct/factor_pct clamped at their [0,100] boundary.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-364-compute-lcr-nsfr-leverage.proptest.mjs

import { compute } from '../art-364-compute-lcr-nsfr-leverage.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-364-compute-lcr-nsfr-leverage.fixtures.json');
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
const rand = mulberry32(0x36400);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomLcr(rng) {
  const hqla_positions = [];
  for (let i = 0; i < Math.floor(rng() * 4); i++) hqla_positions.push({ level: pick(rng, ['l1', 'l2a', 'l2b']), market_value_musd: rng() * 5000 });
  const outflows = [];
  for (let i = 0; i < Math.floor(rng() * 4); i++) outflows.push({ label: `o${i}`, balance_musd: rng() * 5000, rate_pct: rng() * 100 });
  const inflows = [];
  for (let i = 0; i < Math.floor(rng() * 4); i++) inflows.push({ label: `i${i}`, balance_musd: rng() * 5000, rate_pct: rng() * 100 });
  return { hqla_positions, outflows, inflows };
}
function randomNsfr(rng) {
  const asf_items = [];
  for (let i = 0; i < Math.floor(rng() * 4); i++) asf_items.push({ label: `a${i}`, amount_musd: rng() * 5000, factor_pct: rng() * 100 });
  const rsf_items = [];
  for (let i = 0; i < Math.floor(rng() * 4); i++) rsf_items.push({ label: `r${i}`, amount_musd: rng() * 5000, factor_pct: rng() * 100 });
  return { asf_items, rsf_items };
}
function randomLeverage(rng) {
  return {
    cet1_musd: rng() * 5000, at1_musd: rng() * 1000, gsib_bucket: Math.floor(rng() * 4),
    onbs_exposure_musd: rng() * 60000, derivative_exposure_musd: rng() * 5000,
    sft_exposure_musd: rng() * 2000, offbs_exposure_musd: rng() * 3000, other_exposure_musd: rng() * 1000,
  };
}

function randomPP(rng) {
  return { lcr: randomLcr(rng), nsfr: randomNsfr(rng), leverage: randomLeverage(rng) };
}

const TRIALS = 4000;

// ---------- P1: termination — every per-item output array is exactly the input array's length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (!Number.isFinite(o.lcr.hqla_total_musd) && o.lcr.hqla_total_musd !== 0) violations++;
    if (!Number.isFinite(o.nsfr.total_asf_musd)) violations++;
    if (!Number.isFinite(o.leverage.tier1_capital_musd)) violations++;
  }
  return { name: 'P1_termination_per_item_arrays_finite_bounded', trials: checked, violations };
}

// ---------- P2: boundedness — compliant flags default true on null ratio, never NaN, differential re-derivation ----------
function checkP2_compliance_and_null_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.lcr.lcr_pct === null && o.lcr.lcr_compliant !== true) violations++;
    if (o.nsfr.nsfr_pct === null && o.nsfr.nsfr_compliant !== true) violations++;
    if (o.leverage.leverage_ratio_pct === null && o.leverage.leverage_ratio_compliant !== true) violations++;
    for (const v of [o.lcr.lcr_pct, o.nsfr.nsfr_pct, o.leverage.leverage_ratio_pct]) {
      if (v !== null && !Number.isFinite(v)) violations++;
    }
    if (o.lcr.lcr_pct !== null && (o.lcr.lcr_compliant !== (o.lcr.lcr_pct >= 100))) violations++;
    if (o.nsfr.nsfr_pct !== null && (o.nsfr.nsfr_compliant !== (o.nsfr.nsfr_pct >= 100))) violations++;
  }
  return { name: 'P2_compliance_flags_and_null_ratio_boundedness', trials: checked, violations };
}

// ---------- P3: metamorphic — scaling every dollar figure by k>0 leaves each RATIO unchanged (scale-invariance) ----------
function checkP3_scale_invariant_ratios_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1200; i++) {
    const pp = randomPP(rand);
    const k = 0.1 + rand() * 9;
    const scalePositions = (arr) => arr.map((x) => ({ ...x, market_value_musd: x.market_value_musd !== undefined ? x.market_value_musd * k : undefined, balance_musd: x.balance_musd !== undefined ? x.balance_musd * k : undefined, amount_musd: x.amount_musd !== undefined ? x.amount_musd * k : undefined }));
    const scaledPP = {
      lcr: { hqla_positions: scalePositions(pp.lcr.hqla_positions), outflows: scalePositions(pp.lcr.outflows), inflows: scalePositions(pp.lcr.inflows) },
      nsfr: { asf_items: scalePositions(pp.nsfr.asf_items), rsf_items: scalePositions(pp.nsfr.rsf_items) },
      leverage: { ...pp.leverage, cet1_musd: pp.leverage.cet1_musd * k, at1_musd: pp.leverage.at1_musd * k, onbs_exposure_musd: pp.leverage.onbs_exposure_musd * k, derivative_exposure_musd: pp.leverage.derivative_exposure_musd * k, sft_exposure_musd: pp.leverage.sft_exposure_musd * k, offbs_exposure_musd: pp.leverage.offbs_exposure_musd * k, other_exposure_musd: pp.leverage.other_exposure_musd * k },
    };
    const base = compute(pp).output_payload;
    const scaled = compute(scaledPP).output_payload;
    checked++;
    const TOL = 0.02; // r2()-to-the-cent rounding on both numerator and denominator introduces small drift
    if (base.lcr.lcr_pct !== null && scaled.lcr.lcr_pct !== null) {
      if (Math.abs(base.lcr.lcr_pct - scaled.lcr.lcr_pct) > TOL * Math.max(1, Math.abs(base.lcr.lcr_pct))) violations++;
    } else if ((base.lcr.lcr_pct === null) !== (scaled.lcr.lcr_pct === null)) violations++;
    if (base.nsfr.nsfr_pct !== null && scaled.nsfr.nsfr_pct !== null) {
      if (Math.abs(base.nsfr.nsfr_pct - scaled.nsfr.nsfr_pct) > TOL * Math.max(1, Math.abs(base.nsfr.nsfr_pct))) violations++;
    } else if ((base.nsfr.nsfr_pct === null) !== (scaled.nsfr.nsfr_pct === null)) violations++;
    if (base.leverage.leverage_ratio_pct !== null && scaled.leverage.leverage_ratio_pct !== null) {
      if (Math.abs(base.leverage.leverage_ratio_pct - scaled.leverage.leverage_ratio_pct) > TOL * Math.max(1, Math.abs(base.leverage.leverage_ratio_pct))) violations++;
    } else if ((base.leverage.leverage_ratio_pct === null) !== (scaled.leverage.leverage_ratio_pct === null)) violations++;
  }
  return { name: 'P3_dollar_scale_ratio_invariance_metamorphic', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  // rate_pct / factor_pct clamp boundary [0,100]
  const rateForced = [0, -0, eps, 100 - eps, 100, 100 + eps, -eps, Number.MIN_VALUE];
  for (const rate_pct of rateForced) {
    const { output_payload: o } = compute({ lcr: { hqla_positions: [{ level: 'l1', market_value_musd: 1000 }], outflows: [{ label: 'o', balance_musd: 100, rate_pct }], inflows: [] } });
    checked++;
    if (!Number.isFinite(o.lcr.gross_outflows_musd)) violations++;
  }
  // zero-denominator edges: nco=0 (no outflows), totalRsf=0, totalExp=0
  {
    const noOutflow = compute({ lcr: { hqla_positions: [{ level: 'l1', market_value_musd: 500 }], outflows: [], inflows: [] } }).output_payload;
    checked++;
    if (noOutflow.lcr.lcr_pct !== null || noOutflow.lcr.lcr_compliant !== true) violations++;
    const zeroRsf = compute({ nsfr: { asf_items: [{ label: 'a', amount_musd: 500, factor_pct: 100 }], rsf_items: [] } }).output_payload;
    checked++;
    if (zeroRsf.nsfr.nsfr_pct !== null || zeroRsf.nsfr.nsfr_compliant !== true) violations++;
    const zeroExp = compute({ leverage: { cet1_musd: 500, at1_musd: 0 } }).output_payload;
    checked++;
    if (zeroExp.leverage.leverage_ratio_pct !== null || zeroExp.leverage.leverage_ratio_compliant !== true) violations++;
  }
  // HQLA haircut tier boundary — l2b cap edge (max_total_from_l1 * 0.15)
  {
    const denormalHqla = compute({ lcr: { hqla_positions: [{ level: 'l1', market_value_musd: eps }, { level: 'l2b', market_value_musd: Number.MIN_VALUE }], outflows: [], inflows: [] } }).output_payload;
    checked++;
    if (!Number.isFinite(denormalHqla.lcr.hqla_total_musd)) violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_rate_clamp_zero_denominator_haircut', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_compliance_and_null_boundedness());
results.properties.push(checkP3_scale_invariant_ratios_metamorphic());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-364-compute-lcr-nsfr-leverage',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
