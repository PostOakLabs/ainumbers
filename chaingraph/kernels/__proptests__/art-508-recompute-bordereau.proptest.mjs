// art-508-recompute-bordereau.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C25-1).
// kernel_digest_at_authoring: sha256:400131baae5bef4da3dcb65a389b7eae6ef0e310ab7d91747a5a89bb26666102
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (matches the WU row, direct read confirms). `display(minor)` computes
// `Math.trunc(abs / MINOR_SCALE)` — real IEEE-754 division of a safe-integer Number by 100 — and
// `aggregate_utilisation.utilisation_basis_points` computes `Math.trunc(product / aggregate_limit)`
// where `product = consumed * 10000` is guarded by `Number.isSafeInteger(product)` but the division
// itself is still ordinary Number division. ULP-boundary forcing is mandatory here.
// Checks: fixture-oracle gate, termination (currencies bounded by distinct currencies observed in
// rows, one line read exactly once), differential re-derivation of net_recomputed, permutation-
// invariance of rows within a fixed currency (per-currency footing is a commutative sum), and
// ULP-boundary forcing around display()'s safe-integer division boundary and the basis-points
// safe-integer overflow guard.
//
// Run: node chaingraph/kernels/__proptests__/art-508-recompute-bordereau.proptest.mjs

import { compute } from '../art-508-recompute-bordereau.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-508-recompute-bordereau.fixtures.json');
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
const rand = mulberry32(0x50800);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const FIELD_MAPPING = { gross_premium: 'gp', brokerage: 'bk', coverholder_commission: 'cc', ceded: 'cd', currency: 'ccy' };

function randomRow(rng) {
  const dp = (v) => v.toFixed(2);
  return {
    gp: dp(rng() * 10000),
    bk: dp(rng() * 500),
    cc: dp(rng() * 500),
    cd: dp(rng() * 1000),
    ccy: pick(rng, ['EUR', 'USD']),
  };
}

function randomPP(rng) {
  const n = Math.floor(rng() * 8);
  const rows = [];
  for (let i = 0; i < n; i++) rows.push(randomRow(rng));
  return {
    period_label: 'P1', bordereau_class: 'property',
    standard_label: 'lloyds-bdx', standard_version: '1.0',
    default_currency: 'EUR',
    field_mapping: FIELD_MAPPING,
    rows,
  };
}

const TRIALS = 2500;

// ---------- P1: termination — currencies bounded by distinct currency values, each row read exactly once ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const distinctCcy = new Set(pp.rows.map((r) => r.ccy));
    if (output_payload.currencies.length !== distinctCcy.size) violations++;
    const lineSum = output_payload.currencies.reduce((a, c) => a + c.line_count, 0);
    if (lineSum !== pp.rows.length) violations++;
    if (output_payload.line_count !== pp.rows.length) violations++;
  }
  return { name: 'P1_currencies_bounded_by_distinct_currency_values', trials: checked, violations };
}

// ---------- P2 (differential): net_recomputed re-derived ----------
function checkP2_net_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    for (const c of output_payload.currencies) {
      const deductions = c.brokerage_minor_units + c.coverholder_commission_minor_units + c.ceded_minor_units + c.taxes_minor_units;
      const expectedNet = c.gross_premium_minor_units - deductions;
      if (c.net_recomputed_minor_units !== expectedNet) violations++;
    }
  }
  return { name: 'P2_net_recomputed_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — permuting rows within a fixed currency never changes that currency's footing ----------
function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1200; i++) {
    const n = Math.floor(rand() * 6) + 2;
    const rows = [];
    for (let j = 0; j < n; j++) rows.push({ ...randomRow(rand), ccy: 'EUR' }); // fixed currency
    const pp = { period_label: 'P', bordereau_class: 'c', standard_label: 's', standard_version: '1', default_currency: 'EUR', field_mapping: FIELD_MAPPING, rows };
    const shuffled = { ...pp, rows: [...rows].sort(() => rand() - 0.5) };
    const r1 = compute(pp).output_payload;
    const r2 = compute(shuffled).output_payload;
    checked++;
    if (JSON.stringify(r1.currencies) !== JSON.stringify(r2.currencies)) violations++;
  }
  return { name: 'P3_row_order_invariance_within_fixed_currency', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing around display()'s division and the basis-points overflow guard ----------
function checkP4_ulp_boundary_forcing() {
  let violations = 0, checked = 0;
  const MAX_SAFE = Number.MAX_SAFE_INTEGER;

  // large exact-multiple-of-100 gross premium near MAX_SAFE_INTEGER must display with frac '00'
  const nearMax = Math.floor(MAX_SAFE / 100) * 100;
  checked++;
  {
    const bigDecimal = (nearMax / 100).toFixed(2);
    const pp = { period_label: 'P', bordereau_class: 'c', standard_label: 's', standard_version: '1', default_currency: 'EUR', field_mapping: FIELD_MAPPING, rows: [{ gp: bigDecimal, bk: '0.00', cc: '0.00', cd: '0.00', ccy: 'EUR' }] };
    const { output_payload } = compute(pp);
    if (!output_payload.currencies[0].gross_premium_display.endsWith('.00')) violations++;
  }
  // 0, 1, 99, 100, 101 minor units all round-trip exactly through the display string
  for (const dec of ['0.00', '0.01', '0.99', '1.00', '1.01']) {
    checked++;
    const pp = { period_label: 'P', bordereau_class: 'c', standard_label: 's', standard_version: '1', default_currency: 'EUR', field_mapping: FIELD_MAPPING, rows: [{ gp: dec, bk: '0.00', cc: '0.00', cd: '0.00', ccy: 'EUR' }] };
    const { output_payload } = compute(pp);
    const c = output_payload.currencies[0];
    const [whole, frac] = c.gross_premium_display.replace('-', '').split('.');
    const reconstructed = Number(whole) * 100 + Number(frac);
    if (reconstructed !== c.gross_premium_minor_units) violations++;
  }
  // basis-points calc: consumed*10000 pushed toward the safe-integer boundary must not throw and
  // must fall back to null utilisation_basis_points rather than a silently wrong value when unsafe.
  checked++;
  {
    const bigConsumed = Math.floor(MAX_SAFE / 10000) + 1000; // consumed*10000 exceeds MAX_SAFE_INTEGER
    const bigDecimal = (bigConsumed / 100).toFixed(2);
    const pp = {
      period_label: 'P', bordereau_class: 'c', standard_label: 's', standard_version: '1', default_currency: 'EUR',
      field_mapping: FIELD_MAPPING, rows: [{ gp: bigDecimal, bk: '0.00', cc: '0.00', cd: '0.00', ccy: 'EUR' }],
      binding_authority: { aggregate_limit: '1.00', limit_currency: 'EUR', aggregate_basis: 'gross_premium' },
    };
    const { output_payload } = compute(pp);
    if (output_payload.aggregate_utilisation.utilisation_basis_points !== null) violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_display_division_and_basis_points_overflow', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_net_differential());
results.properties.push(checkP3_permutation_invariance());
results.properties.push(checkP4_ulp_boundary_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-508-recompute-bordereau',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
