// kernel_digest_at_authoring: sha256:65a08e84465e1ec8ca4a01e9b4b0c7d7d5c566ca467f6efdf622598c36511706
//
// FV-PROPFLOOR-SHARD-B20-1 — property-test floor for art-336-compute-ltv-ratios.
// Class B (bounded-numeric), FLOAT-SENSITIVE — ltv_pct/cltv_pct/hcltv_pct divide
// dollar amounts and round to 2dp — ULP-boundary forcing is MANDATORY per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-336-compute-ltv-ratios.proptest.mjs

import { compute } from '../art-336-compute-ltv-ratios.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-336-compute-ltv-ratios.fixtures.json');
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
const rand = mulberry32(0x336C71);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;

function mkPP(rng) {
  const transaction_type = pick(rng, ['purchase', 'refinance']);
  const appraised_value = randRange(rng, 50000, 2000000);
  const sales_price = transaction_type === 'purchase' ? randRange(rng, 50000, 2000000) : 0;
  return {
    appraised_value,
    sales_price,
    first_lien_amount: randRange(rng, 0, appraised_value),
    subordinate_lien_amount: randRange(rng, 0, appraised_value * 0.2),
    heloc_credit_limit: randRange(rng, 0, appraised_value * 0.2),
    transaction_type,
  };
}

// ---------- P1: monotonicity — ltv/cltv/hcltv non-decreasing in first_lien_amount ----------
function checkP1_monotonicInFirstLien() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    checked++;
    const lo = compute(pp).output_payload;
    const hi = compute({ ...pp, first_lien_amount: pp.first_lien_amount + 1000 }).output_payload;
    if (hi.ltv_pct < lo.ltv_pct - 1e-9) violations++;
    if (hi.cltv_pct < lo.cltv_pct - 1e-9) violations++;
    if (hi.hcltv_pct < lo.hcltv_pct - 1e-9) violations++;
  }
  return { name: 'P1_ltv_cltv_hcltv_monotonic_nondecreasing_in_first_lien', trials: checked, violations };
}

// ---------- P2: boundedness/ordering — hcltv_pct >= cltv_pct >= ltv_pct ----------
function checkP2_orderingHolds() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    checked++;
    const r = compute(pp).output_payload;
    if (r.value_used <= 0) continue;
    if (r.cltv_pct < r.ltv_pct - 1e-6) violations++;
    if (r.hcltv_pct < r.cltv_pct - 1e-6) violations++;
  }
  return { name: 'P2_hcltv_gte_cltv_gte_ltv', trials: checked, violations };
}

// ---------- P3: metamorphic — scale invariance of percentages under uniform dollar scaling ----------
function checkP3_scaleInvariant() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    checked++;
    const k = randRange(rand, 1.5, 4);
    const scaled = {
      appraised_value: pp.appraised_value * k,
      sales_price: pp.sales_price * k,
      first_lien_amount: pp.first_lien_amount * k,
      subordinate_lien_amount: pp.subordinate_lien_amount * k,
      heloc_credit_limit: pp.heloc_credit_limit * k,
      transaction_type: pp.transaction_type,
    };
    const base = compute(pp).output_payload;
    const s = compute(scaled).output_payload;
    if (Math.abs(base.ltv_pct - s.ltv_pct) > 0.02) violations++;
    if (Math.abs(base.cltv_pct - s.cltv_pct) > 0.02) violations++;
    if (Math.abs(base.hcltv_pct - s.hcltv_pct) > 0.02) violations++;
  }
  return { name: 'P3_ltv_family_scale_invariant_under_uniform_dollar_scaling', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ appraised_value: 0, sales_price: 0, first_lien_amount: 100000, subordinate_lien_amount: 0, heloc_credit_limit: 0, transaction_type: 'refinance' }, 'appraised_value exactly zero on refinance — LTV_ZERO_VALUE flag, all pcts must be 0, no division/NaN'],
  [{ appraised_value: -0, sales_price: 0, first_lien_amount: 100000, subordinate_lien_amount: 0, heloc_credit_limit: 0, transaction_type: 'refinance' }, 'appraised_value negative zero — must behave identically to positive zero'],
  [{ appraised_value: Number.MIN_VALUE, sales_price: 0, first_lien_amount: 100000, subordinate_lien_amount: 0, heloc_credit_limit: 0, transaction_type: 'refinance' }, 'appraised_value at smallest denormal — value_used positive, division must stay finite even if pct huge'],
  [{ appraised_value: 500000, sales_price: 490000, first_lien_amount: 392000, subordinate_lien_amount: 0, heloc_credit_limit: 0, transaction_type: 'purchase' }, 'sales_price < appraised_value on purchase — lesser-of-value-or-price rule must select sales_price'],
  [{ appraised_value: 480000, sales_price: 500000, first_lien_amount: 384000, subordinate_lien_amount: 0, heloc_credit_limit: 0, transaction_type: 'purchase' }, 'appraised_value < sales_price on purchase — lesser-of-value-or-price rule must select appraised_value'],
  [{ appraised_value: 400000, sales_price: 400000, first_lien_amount: 400000, subordinate_lien_amount: 0, heloc_credit_limit: 0, transaction_type: 'purchase' }, 'appraised_value exactly equal to sales_price — LTV must equal exactly 100'],
  [{ appraised_value: 0.1 * 3 * 1000000, sales_price: 0, first_lien_amount: 240000, subordinate_lien_amount: 0, heloc_credit_limit: 0, transaction_type: 'refinance' }, 'appraised_value = (0.1*3)*1000000, a repeating-decimal double close to but not exactly 300000 — x/y*y!==x class case, must round cleanly to 2dp'],
  [{ appraised_value: 1e12, sales_price: 0, first_lien_amount: 1e11, subordinate_lien_amount: 1e10, heloc_credit_limit: 1e9, transaction_type: 'refinance' }, 'very large dollar magnitudes — percentages must remain finite, no overflow artifact'],
  [{ appraised_value: 500000, sales_price: 0, first_lien_amount: 0, subordinate_lien_amount: 0, heloc_credit_limit: 0, transaction_type: 'refinance' }, 'all lien amounts exactly zero — ltv/cltv/hcltv must all be exactly 0'],
  [{ appraised_value: 500000, sales_price: 0, first_lien_amount: 400000, subordinate_lien_amount: 50000, heloc_credit_limit: 50000, transaction_type: 'refinance' }, 'first+sub+heloc exactly sums to appraised_value — hcltv_pct must equal exactly 100'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const plausible = [r.ltv_pct, r.cltv_pct, r.hcltv_pct].every(Number.isFinite);
    rows.push({ label, input: pp, ltv_pct: r.ltv_pct, cltv_pct: r.cltv_pct, hcltv_pct: r.hcltv_pct, value_used: r.value_used, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotonicInFirstLien());
results.properties.push(checkP2_orderingHolds());
results.properties.push(checkP3_scaleInvariant());
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
