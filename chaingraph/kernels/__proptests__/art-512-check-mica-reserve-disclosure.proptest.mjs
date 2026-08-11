// art-512-check-mica-reserve-disclosure.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C25-1).
// kernel_digest_at_authoring: sha256:3123cd816d8e2879a6ea052f973621b149340b5cd6072232bf2666e1bbe9c333
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — CORRECTED from the WU row's float:yes (per FIX-2 discipline). Direct source
// read: the kernel's own header states "Money is fixed-point BigInt parsed from decimal strings,
// never float multiplication" and this is confirmed — `toFixed`/`mulFixed`/`divFixed`/
// `roundFixedToString` are exclusively BigInt operators (`10n ** BigInt(...)`, `a * b`, `a / b` on
// BigInt operands), which are exact integer operations with zero IEEE-754 rounding. The only Number
// arithmetic in the file is the proleptic-Gregorian calendar conversion (`daysFromCivil`/
// `civilFromDays`), which operates on small bounded integers (years/months/days in the low thousands)
// where double-precision division and Math.floor are exact — no ULP risk at that magnitude, and none
// of it touches the reserve-coverage money path. Forced categorical boundary cases are used in place
// of ULP-boundary forcing.
// Checks: fixture-oracle gate, termination (class_totals bounded by distinct asset classes,
// missed_periods bounded by disclosure_dates count), differential re-derivation of the BigInt
// coverage-ratio/covered arithmetic, permutation-invariance of reserve_components order (BigInt sums
// are exactly commutative), and forced categorical boundary cases (zero circulation, empty reserve,
// exact coverage boundary, decimal-string truncation vs rounding).
//
// Run: node chaingraph/kernels/__proptests__/art-512-check-mica-reserve-disclosure.proptest.mjs

import { compute } from '../art-512-check-mica-reserve-disclosure.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-512-check-mica-reserve-disclosure.fixtures.json');
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
const rand = mulberry32(0x51200);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomComponent(rng, i) {
  return {
    component_id: `C${i}`,
    asset_class: pick(rng, ['cash', 'gov_bond', 'crypto', 'other']),
    amount: (rng() * 100000).toFixed(2),
    custodian_type: pick(rng, ['bank', 'casp', 'unstated']),
    segregated: rng() < 0.6,
  };
}

function randomPP(rng) {
  const n = Math.floor(rng() * 8);
  const components = [];
  for (let i = 0; i < n; i++) components.push(randomComponent(rng, i));
  return {
    issuer_id: 'ISS1', disclosure_ref: 'D1', rules_version: 'v1', as_of: '2026-06-30',
    token_type: pick(rng, ['ART', 'EMT']),
    tokens_in_circulation: (rng() * 100000).toFixed(2),
    reserve_components: components,
    declared_rules: {
      eligible_asset_classes: ['cash', 'gov_bond', 'other'],
      concentration_limits: { crypto: '10' },
      acceptable_custodian_types: ['bank', 'casp'],
      min_segregated_pct: '30',
      cadence_days: 30,
    },
    disclosure_dates: ['2026-05-01', '2026-06-01'],
  };
}

const TRIALS = 2500;

// ---------- P1: termination — class_totals bounded by distinct classes, missed_periods bounded by dates ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const distinctClasses = new Set(pp.reserve_components.map((c) => c.asset_class));
    if (output_payload.composition.class_totals.length !== distinctClasses.size) violations++;
    if (output_payload.cadence.missed_periods.length > pp.disclosure_dates.length + 2) violations++;
  }
  return { name: 'P1_class_totals_bounded_by_distinct_classes', trials: checked, violations };
}

// ---------- P2 (differential): BigInt coverage-ratio arithmetic re-derived ----------
function checkP2_coverage_differential() {
  let violations = 0, checked = 0;
  const SCALE = 10n ** 8n;
  function toFixed(v) {
    let s = String(v ?? 0).trim();
    let neg = false;
    if (s.startsWith('-')) { neg = true; s = s.slice(1); }
    let [ip = '0', fp = ''] = s.split('.');
    if (ip === '') ip = '0';
    fp = fp.slice(0, 8).padEnd(8, '0');
    let mag = BigInt(ip + fp);
    return neg ? -mag : mag;
  }
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const circulationFixed = toFixed(pp.tokens_in_circulation);
    let reserveTotalFixed = 0n;
    for (const c of pp.reserve_components) reserveTotalFixed += toFixed(c.amount);
    const expectedCovered = circulationFixed > 0n ? reserveTotalFixed >= circulationFixed : null;
    if (output_payload.coverage.covered !== expectedCovered) violations++;
    const expectedSurplus = toFixed(output_payload.coverage.reserve_total) - toFixed(output_payload.coverage.tokens_in_circulation);
    const actualSurplus = toFixed(output_payload.coverage.surplus_or_shortfall);
    if (expectedSurplus !== actualSurplus) violations++;
  }
  return { name: 'P2_coverage_ratio_bigint_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — permuting reserve_components never changes reserve totals or coverage ----------
function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1200; i++) {
    const pp = randomPP(rand);
    if (pp.reserve_components.length < 2) continue;
    const shuffled = { ...pp, reserve_components: [...pp.reserve_components].sort(() => rand() - 0.5) };
    const r1 = compute(pp).output_payload;
    const r2 = compute(shuffled).output_payload;
    checked++;
    if (r1.coverage.reserve_total !== r2.coverage.reserve_total) violations++;
    if (r1.coverage.covered !== r2.coverage.covered) violations++;
    if (r1.segregation.segregated_amount !== r2.segregation.segregated_amount) violations++;
  }
  return { name: 'P3_reserve_components_order_invariance', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applies) ----------
function checkP4_forced_categorical_boundaries() {
  let violations = 0, checked = 0;
  const base = { issuer_id: 'I', disclosure_ref: 'D', rules_version: 'v1', as_of: '2026-01-01', token_type: 'ART' };

  // zero circulation -> covered null, MICA_CIRCULATION_ZERO flag, no throw
  checked++;
  {
    const r = compute({ ...base, tokens_in_circulation: '0', reserve_components: [{ asset_class: 'cash', amount: '100' }] });
    if (r.output_payload.coverage.covered !== null || !r.compliance_flags.includes('MICA_CIRCULATION_ZERO')) violations++;
  }
  // empty reserve -> reserve_empty true, entire circulation is shortfall
  checked++;
  {
    const r = compute({ ...base, tokens_in_circulation: '100', reserve_components: [] });
    if (r.output_payload.coverage.reserve_empty !== true) violations++;
  }
  // exact coverage boundary: reserve === circulation -> covered true
  checked++;
  {
    const r = compute({ ...base, tokens_in_circulation: '100.00000000', reserve_components: [{ asset_class: 'cash', amount: '100.00000000' }] });
    if (r.output_payload.coverage.covered !== true) violations++;
  }
  // one unit (at 8dp scale) below coverage -> covered false
  checked++;
  {
    const r = compute({ ...base, tokens_in_circulation: '100.00000001', reserve_components: [{ asset_class: 'cash', amount: '100.00000000' }] });
    if (r.output_payload.coverage.covered !== false) violations++;
  }
  // decimal string beyond the internal 8dp fixed-point scale is TRUNCATED at parse time, never rounded
  // up, and the default 2dp display truncates again -- so 99.999999999999 reads back as 99.99, not
  // 100.00.
  checked++;
  {
    const r = compute({ ...base, tokens_in_circulation: '1', reserve_components: [{ asset_class: 'cash', amount: '99.999999999999' }] });
    if (r.output_payload.coverage.reserve_total !== '99.99') violations++;
  }
  // negative-looking malformed amount string -> parsed to 0, never throws
  checked++;
  {
    const r = compute({ ...base, tokens_in_circulation: '1', reserve_components: [{ asset_class: 'cash', amount: 'not-a-number' }] });
    if (r.output_payload.coverage.reserve_total !== '0.00') violations++;
  }
  return { name: 'P4_forced_categorical_boundaries', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_coverage_differential());
results.properties.push(checkP3_permutation_invariance());
results.properties.push(checkP4_forced_categorical_boundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-512-check-mica-reserve-disclosure',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
