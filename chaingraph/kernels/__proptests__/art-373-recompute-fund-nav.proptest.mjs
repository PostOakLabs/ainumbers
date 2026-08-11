// art-373-recompute-fund-nav.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C17-1).
// kernel_digest_at_authoring: sha256:3814c169b6e2757ca9d93f31022a7c6234d75676d9a66c7d253f672a4a4ae8ac
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES -- re-confirmed by direct read: the arithmetic path itself is BigInt
// fixed-point (SCALE_EXP=8) with no float multiplication, BUT the caller supplies quantity/
// price/rate as JS number-or-string, and `toFixed()` parses via `String(value)` -- a JS number
// at IEEE-754 boundary magnitudes (denormals, values that serialize to scientific notation
// like 1e21 or 5e-324) hits `String()`'s exponential-notation output, which the kernel's decimal
// regex `/^[0-9]*\.?[0-9]*$/` REJECTS and silently coerces to "0". This is a real caller-input
// boundary behavior of the fixed-point parse stage, not the accumulation path -- it is exactly
// what ULP-boundary forcing must probe for a kernel that claims float-free arithmetic (P4).
// Checks: fixture-oracle gate, termination (unbounded holdings/accruals/liabilities arrays --
// bound is array length), boundedness (structural_error set + nav_per_share null when
// shares_outstanding<=0, kernel never throws), metamorphic (holdings-array permutation
// invariance of total_assets/net_assets/nav_per_share -- BigInt sums are exactly
// order-independent), ULP-boundary forcing on quantity/price at IEEE-754 boundary magnitudes.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-373-recompute-fund-nav.proptest.mjs

import { compute } from '../art-373-recompute-fund-nav.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-373-recompute-fund-nav.fixtures.json');
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
const rand = mulberry32(0x373D0);

function randomHolding(rng, tag) {
  return { security_id: tag, quantity: Math.round(rng() * 5000), price: Math.round(rng() * 10000) / 100, currency: 'USD', fx_rate_to_base: 1 };
}

function randomPP(rng, n) {
  const holdings = [];
  for (let i = 0; i < n; i++) holdings.push(randomHolding(rng, `SEC-${i}`));
  return {
    fund_id: 'F1', base_currency: 'USD', holdings, accruals: { income: [], expense: [] }, liabilities: [],
    shares_outstanding: 1000 + Math.round(rng() * 50000),
    rounding: { decimal_places: 2, mode: 'half_up' },
  };
}

const TRIALS = 2000;

// ---------- P1: termination — unbounded holdings/accruals/liabilities arrays, bound is array length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  const sizes = [0, 1, 5, 50, 300];
  for (const n of sizes) {
    const pp = randomPP(rand, n);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.components.holdings.length !== n) violations++;
  }
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 30);
    const pp = randomPP(rand, n);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.components.holdings.length !== n) violations++;
  }
  return { name: 'P1_termination_array_length_bound', trials: checked, violations };
}

// ---------- P2: boundedness — structural error path never throws, nav_per_share well-formed or null ----------
function checkP2_structural_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand, 1 + Math.floor(rand() * 8));
    if (rand() < 0.3) pp.shares_outstanding = rand() < 0.5 ? 0 : -Math.round(rand() * 1000);
    const { output_payload } = compute(pp);
    checked++;
    if (pp.shares_outstanding <= 0) {
      if (output_payload.structural_error === null) violations++;
      if (output_payload.nav_per_share !== null) violations++;
    } else {
      if (output_payload.structural_error !== null) violations++;
      if (typeof output_payload.nav_per_share !== 'string') violations++;
    }
  }
  return { name: 'P2_structural_error_boundedness_never_throws', trials: checked, violations };
}

// ---------- P3: metamorphic — holdings-array permutation invariance (BigInt sums, exact) ----------
function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS / 2; i++) {
    const n = 2 + Math.floor(rand() * 10);
    const pp = randomPP(rand, n);
    const shuffled = { ...pp, holdings: [...pp.holdings].reverse() };
    const a = compute(pp).output_payload;
    const b = compute(shuffled).output_payload;
    checked++;
    if (a.components.total_assets !== b.components.total_assets) violations++;
    if (a.components.net_assets !== b.components.net_assets) violations++;
    if (a.nav_per_share !== b.nav_per_share) violations++;
  }
  return { name: 'P3_permutation_invariance_of_totals', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) — quantity/price at IEEE-754 boundary magnitudes ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  const boundaryValues = [0, -0, eps, Number.MIN_VALUE, 1e21, 1000];
  for (const price of boundaryValues) {
    const pp = {
      base_currency: 'USD',
      holdings: [{ security_id: 'S1', quantity: 100, price, currency: 'USD', fx_rate_to_base: 1 }],
      liabilities: [], shares_outstanding: 1000, rounding: { decimal_places: 2, mode: 'half_up' },
    };
    const { output_payload } = compute(pp);
    checked++;
    // kernel must never throw and must always emit a finite decimal string, even when the
    // scientific-notation parse fallback silently coerces a boundary value to "0".
    if (typeof output_payload.components.holdings[0].price !== 'string') violations++;
    if (!Number.isFinite(Number(output_payload.components.holdings[0].price))) violations++;
    if (output_payload.structural_error !== null) violations++;
  }
  // quantity at boundary magnitudes, price held at a normal reference value
  for (const quantity of boundaryValues) {
    const pp = {
      base_currency: 'USD',
      holdings: [{ security_id: 'S1', quantity, price: 10, currency: 'USD', fx_rate_to_base: 1 }],
      liabilities: [], shares_outstanding: 1000, rounding: { decimal_places: 2, mode: 'half_up' },
    };
    const { output_payload } = compute(pp);
    checked++;
    if (!Number.isFinite(Number(output_payload.components.holdings[0].quantity))) violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_quantity_price_ieee754_boundaries', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_structural_boundedness());
results.properties.push(checkP3_permutation_invariance());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-373-recompute-fund-nav',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
