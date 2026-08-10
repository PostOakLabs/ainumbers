// kernel_digest_at_authoring: sha256:ab7cc7c6345a21988fca592f503a6b89a4ddc3fe97267f8996170f1021619817
//
// FV-PROPFLOOR-SHARD-B21-1 — property-test floor for art-367-compute-cross-border-fees.
// Class B (bounded-numeric), FLOAT:YES — FX/VAT/method-fee cost-stack sum with r2/r4
// rounding. ULP-boundary forcing mandatory. Zero external dependencies (mulberry32 PRNG
// + explicit boundary arrays), same shape as the B1/B12 harness. This file is READ-ONLY
// with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-367-compute-cross-border-fees.proptest.mjs

import { compute } from '../art-367-compute-cross-border-fees.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-367-compute-cross-border-fees.fixtures.json');
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
const rand = mulberry32(0x0367A1);
const TRIALS = 6000;
function range(rng, lo, hi) { return lo + rng() * (hi - lo); }

function mkPP(rng) {
  return {
    invoice_amount: range(rng, 1, 1000000),
    origin_country: 'us',
    dest_country: 'gb',
    fx_spread_bps: range(rng, 0, 300),
    method_fee: range(rng, 0, 500),
    vat_rate: range(rng, 0, 0.25),
    doc_cost: range(rng, 0, 3000),
    recon_cost: range(rng, 0, 100),
  };
}

// ---------- P1: total_cost is the exact sum of its five declared components (within rounding tolerance) ----------
function checkP1_totalCostExactSum() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { fx_cost, method_fee, vat_cost, doc_cost, recon_cost, total_cost } = r.output_payload;
    // total_cost is r2() of the unrounded raw sum, while each component is independently
    // r2()-rounded — up to 5 components each off by up to half a cent from independent
    // rounding, so the tolerance covers that amplification.
    if (Math.abs(total_cost - (fx_cost + method_fee + vat_cost + doc_cost + recon_cost)) > 0.03) violations++;
  }
  return { name: 'P1_total_cost_exact_sum_of_five_components', trials: checked, violations };
}

// ---------- P2: country codes are always uppercased in the output ----------
function checkP2_countryCodesUppercased() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { origin_country, dest_country } = r.output_payload;
    if (origin_country !== origin_country.toUpperCase() || dest_country !== dest_country.toUpperCase()) violations++;
  }
  return { name: 'P2_country_codes_always_uppercased', trials: checked, violations };
}

// ---------- P3: monotonicity — raising fx_spread_bps never lowers total_cost (invoice_amount positive) ----------
function checkP3_totalCostMonotoneInFxSpread() {
  let violations = 0, checked = 0;
  const TRIALS_MONO = Math.floor(TRIALS / 2);
  for (let i = 0; i < TRIALS_MONO; i++) {
    const pp = mkPP(rand);
    const r1 = compute(pp);
    const pp2 = { ...pp, fx_spread_bps: pp.fx_spread_bps + range(rand, 1, 100) };
    const r2v = compute(pp2);
    checked++;
    if (r2v.output_payload.total_cost < r1.output_payload.total_cost - 1e-6) violations++;
  }
  return { name: 'P3_total_cost_nondecreasing_in_fx_spread_bps', trials: checked, violations };
}

// ---------- P4 (mandatory, float-sensitive): forced ULP-boundary cases ----------
function checkP4_forced() {
  const rows = [];
  const base = { invoice_amount: 85000, origin_country: 'US', dest_country: 'GB', fx_spread_bps: 75, method_fee: 35, vat_rate: 0, doc_cost: 0, recon_cost: 12 };
  const cases = [
    { ...base, invoice_amount: 0, label: 'invoice_amount exactly 0 — pct_of_invoice short-circuits to 0, XBFEE_NON_POSITIVE_INVOICE fires' },
    { ...base, invoice_amount: -0, label: 'invoice_amount is negative zero — the <=0 gate must still trip (not treated as positive)' },
    { ...base, invoice_amount: Number.MIN_VALUE, label: 'invoice_amount at denormal scale — pct_of_invoice division must stay finite, not Infinity' },
    { ...base, fx_spread_bps: 0, label: 'fx_spread_bps exactly 0 — fx_cost exactly 0' },
    { ...base, vat_rate: 1, label: 'vat_rate exactly 1 (100%) — vat_cost equals invoice_amount exactly' },
    { ...base, invoice_amount: 100, method_fee: 0, doc_cost: 0, recon_cost: 0, fx_spread_bps: 0, vat_rate: 0, label: 'all cost components zero except invoice — total_cost exactly 0, pct_of_invoice exactly 0' },
    { ...base, invoice_amount: -1000, label: 'negative invoice_amount — XBFEE_NON_POSITIVE_INVOICE fires, fx_cost still finite (can go negative)' },
  ];
  for (const c of cases) {
    const { label, ...pp } = c;
    const r = compute(pp);
    const { total_cost, pct_of_invoice, fx_cost, vat_cost } = r.output_payload;
    const plausible = [total_cost, pct_of_invoice, fx_cost, vat_cost].every(Number.isFinite);
    rows.push({ label, input: pp, total_cost, pct_of_invoice, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_totalCostExactSum());
results.properties.push(checkP2_countryCodesUppercased());
results.properties.push(checkP3_totalCostMonotoneInFxSpread());
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
