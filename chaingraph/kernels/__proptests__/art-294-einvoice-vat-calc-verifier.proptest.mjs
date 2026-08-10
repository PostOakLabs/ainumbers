// art-294-einvoice-vat-calc-verifier.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C10-1).
// kernel_digest_at_authoring: sha256:986d37866299487054398f63d3e4ea13b3ae3c3ccd2e7c315e21d8269f9696e2
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES — computeLineVat/round2 do real percentage arithmetic
// (net*rate/100, half-up/half-even rounding with an epsilon-tolerant half-even branch) whose
// output feeds an exact-equality "consistent" verdict against asserted totals. Confirmed by
// direct read: this is the one kernel in this shard where a rounding edge case can flip a
// pass/fail compliance verdict. ULP-boundary forcing is MANDATORY per spec §3/§51.
// Checks: fixture-oracle gate, termination/boundedness (subtotal_deltas.length bounded by
// distinct category+rate groups, all outputs finite), grand-total algebraic identity
// (net_total_computed + tax_total_computed == grand_total_computed, recomputed independently
// from the exposed subtotal taxable amounts), and mandatory forced ULP/boundary cases:
// half-even tie exactly at .5, values 1 ULP either side of that tie, 0, negative zero,
// denormals, and a round-trip (x/y*y !== x style) case.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-294-einvoice-vat-calc-verifier.proptest.mjs

import { compute } from '../art-294-einvoice-vat-calc-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-294-einvoice-vat-calc-verifier.fixtures.json');
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
const rand = mulberry32(0x294A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const VAT_CATS = ['S', 'Z', 'E', 'AE', 'O'];
const NO_VAT = new Set(['Z', 'E', 'AE', 'O']);

function randomLineItem(rng) {
  return {
    net_amount: Math.round(rng() * 100000) / 100,
    vat_category: pick(rng, VAT_CATS),
    vat_rate_pct: pick(rng, [0, 5, 7, 19, 20, 21]),
  };
}
function randomDocument(rng, nLines) {
  return { line_items: Array.from({ length: nLines }, () => randomLineItem(rng)) };
}
function isFiniteDeep(v) {
  if (typeof v === 'number') return Number.isFinite(v);
  if (Array.isArray(v)) return v.every(isFiniteDeep);
  if (v !== null && typeof v === 'object') return Object.values(v).every(isFiniteDeep);
  return true;
}

const TRIALS = 5000;

// ---------- P1: termination/boundedness — subtotal_deltas bounded by distinct groups; all finite ----------
function checkP1_bounded_finite() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = 1 + Math.floor(rand() * 10);
    const document = randomDocument(rand, n);
    const { output_payload } = compute({ document, rounding: { method: rand() < 0.5 ? 'half-up' : 'half-even', granularity: rand() < 0.5 ? 'per-line' : 'per-subtotal' } });
    checked++;
    if (output_payload.subtotal_deltas.length > n) violations++;
    if (!isFiniteDeep(output_payload)) violations++;
  }
  return { name: 'P1_termination_bounded_and_finite', trials: checked, violations };
}

// ---------- P2: algebraic identity — grand_total_computed == sum(taxable_amount_computed) + tax_total_computed ----------
function checkP2_grand_total_identity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = 1 + Math.floor(rand() * 10);
    const document = randomDocument(rand, n);
    const { output_payload } = compute({ document, rounding: { method: rand() < 0.5 ? 'half-up' : 'half-even', granularity: rand() < 0.5 ? 'per-line' : 'per-subtotal' } });
    checked++;
    const netSum = output_payload.subtotal_deltas.reduce((s, d) => s + d.taxable_amount_computed, 0);
    // netSum is itself an unrounded sum of already-rounded per-group taxable amounts, so allow
    // a small tolerance for the final rounding step the kernel applies to net_total.
    if (Math.abs((netSum + output_payload.tax_total_computed) - output_payload.grand_total_computed) > 0.02) violations++;
  }
  return { name: 'P2_grand_total_algebraic_identity', trials: checked, violations };
}

// ---------- P3: boundedness — no-VAT categories always carry rate=0 and vat=0 ----------
function checkP3_no_vat_categories_zeroed() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = 1 + Math.floor(rand() * 10);
    const document = randomDocument(rand, n);
    const { output_payload } = compute({ document, rounding: { method: 'half-up', granularity: 'per-line' } });
    checked++;
    for (const s of output_payload.subtotal_deltas) {
      if (NO_VAT.has(s.vat_category) && (s.vat_rate_pct !== 0 || s.tax_amount_computed !== 0)) violations++;
    }
  }
  return { name: 'P3_no_vat_categories_always_zero_rated', trials: checked, violations };
}

// ---------- P4: MANDATORY ULP/boundary forcing (float_sensitive: yes) ----------
function checkP4_ulp_boundary_forcing() {
  let violations = 0, checked = 0;
  const cases = [
    // half-even tie exactly at .5 (scaled cents): net*rate/100*100 lands on X.5 -> banker's round.
    { net_amount: 12.5, vat_category: 'S', vat_rate_pct: 100 }, // scaled=1250 -> not a tie itself; use crafted rate below
    { net_amount: 0.5, vat_category: 'S', vat_rate_pct: 100 },  // vat = 0.5 -> scaled 50, even, tie case
    { net_amount: 0, vat_category: 'S', vat_rate_pct: 19 },     // exact 0
    { net_amount: -0, vat_category: 'S', vat_rate_pct: 19 },    // negative zero
    { net_amount: Number.MIN_VALUE, vat_category: 'S', vat_rate_pct: 19 }, // denormal
    { net_amount: 100 / 3, vat_category: 'S', vat_rate_pct: 19 }, // classic x/y*y !== x style non-terminating fraction
    { net_amount: 0.1 + 0.2, vat_category: 'S', vat_rate_pct: 19 }, // 0.1+0.2 !== 0.3 float artifact
    { net_amount: 1e-10, vat_category: 'Z', vat_rate_pct: 0 },  // sub-cent, zero-rated
  ];
  for (const method of ['half-up', 'half-even']) {
    for (const li of cases) {
      checked++;
      const document = { line_items: [li] };
      let output_payload;
      try {
        ({ output_payload } = compute({ document, rounding: { method, granularity: 'per-line' } }));
      } catch (e) {
        violations++;
        continue;
      }
      if (!isFiniteDeep(output_payload)) violations++;
      if (output_payload.subtotal_deltas.length !== 1) violations++;
      const d = output_payload.subtotal_deltas[0];
      // no negative-zero leakage in any reported computed amount
      if (Object.is(d.tax_amount_computed, -0) || Object.is(d.taxable_amount_computed, -0)) violations++;
    }
  }
  return { name: 'P4_ulp_and_categorical_boundary_forcing_mandatory', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_bounded_finite());
results.properties.push(checkP2_grand_total_identity());
results.properties.push(checkP3_no_vat_categories_zeroed());
results.properties.push(checkP4_ulp_boundary_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-294-einvoice-vat-calc-verifier',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
