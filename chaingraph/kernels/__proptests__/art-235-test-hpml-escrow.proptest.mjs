// kernel_digest_at_authoring: sha256:94fc7bbe48acda47dbbe6f448d2c3ee67377a531525a417ecb3e484f31fb381b
//
// FV-PROPFLOOR-SHARD-B8-1 — property-test floor for art-235-test-hpml-escrow.
// Class B (bounded-numeric), FLOAT-SENSITIVE (apr_pct/apor_pct are raw doubles, the HPML spread
// compares r4()-rounded doubles against fixed 1.5/2.5/3.5pp thresholds with a 1e-5 tolerance) —
// ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies
// (mulberry32 PRNG + explicit boundary arrays), same shape as the B1-B7 float harnesses.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-235-test-hpml-escrow.proptest.mjs

import { compute } from '../art-235-test-hpml-escrow.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-235-test-hpml-escrow.fixtures.json');
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
const rand = mulberry32(0x2350A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;

function thresholdFor(lien_type, is_jumbo) {
  if (lien_type === 'subordinate') return 3.5;
  if (is_jumbo) return 2.5;
  return 1.5;
}
function r4(v) { return Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : 0; }

function mkPP(rng) {
  return {
    apr_pct: randRange(rng, 0, 20),
    apor_pct: randRange(rng, 0, 20),
    lien_type: pick(rng, ['first', 'subordinate']),
    is_jumbo: rng() < 0.5,
    is_rural_or_underserved: rng() < 0.3,
    creditor_assets_under_2b: rng() < 0.3,
    loan_count_under_500: rng() < 0.3,
    property_is_condo_master_policy: rng() < 0.3,
    year: 2026,
  };
}

// ---------- P1: monotone — increasing apr_pct never flips is_hpml true -> false ----------
function checkP1_monotoneHpml() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r1 = compute(pp);
    const r2 = compute({ ...pp, apr_pct: pp.apr_pct + 5 });
    checked++;
    if (r1.output_payload.is_hpml && !r2.output_payload.is_hpml) violations++;
    if (r2.output_payload.apr_spread_pct < r1.output_payload.apr_spread_pct) violations++;
  }
  return { name: 'P1_monotone_is_hpml_nondecreasing_with_apr_increase', trials: checked, violations };
}

// ---------- P2: boundedness/round-trip — apr_spread_pct exactly equals r4(apr-apor) ----------
function checkP2_spreadRoundTrip() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = r4(pp.apr_pct - pp.apor_pct);
    if (r.output_payload.apr_spread_pct !== expected) violations++;
    if (![1.5, 2.5, 3.5].includes(r.output_payload.spread_threshold_pct)) violations++;
  }
  return { name: 'P2_spread_roundtrip_and_threshold_from_fixed_set', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — is_hpml matches independently-derived rule ----------
function checkP3_hpmlThresholdAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const threshold = thresholdFor(pp.lien_type, pp.is_jumbo);
    const spread = r4(pp.apr_pct - pp.apor_pct);
    const expected_is_hpml = spread >= threshold - 1e-5;
    if (r.output_payload.is_hpml !== expected_is_hpml) violations++;
    const expected_escrow = expected_is_hpml && pp.lien_type === 'first' &&
      !(pp.is_rural_or_underserved && pp.creditor_assets_under_2b && pp.loan_count_under_500) &&
      !pp.property_is_condo_master_policy;
    if (r.output_payload.escrow_required !== expected_escrow) violations++;
  }
  return { name: 'P3_is_hpml_and_escrow_match_fixed_threshold_rule', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ apr_pct: 1.5, apor_pct: 0, lien_type: 'first', is_jumbo: false }, 'apr_spread exactly at 1.5pp first-lien standard threshold — is_hpml must be true'],
  [{ apr_pct: 1.4999, apor_pct: 0, lien_type: 'first', is_jumbo: false }, 'apr_spread just below 1.5pp threshold minus tolerance — is_hpml must be false'],
  [{ apr_pct: 0, apor_pct: 0, lien_type: 'first', is_jumbo: false }, 'apr_spread exactly zero — is_hpml false, no throw'],
  [{ apr_pct: -0, apor_pct: 0, lien_type: 'first', is_jumbo: false }, 'apr_pct negative zero — must behave as zero'],
  [{ apr_pct: Number.MIN_VALUE, apor_pct: 0, lien_type: 'first', is_jumbo: false }, 'apr_pct smallest positive double — spread must round to 0, not throw or NaN'],
  [{ apr_pct: 0.1 * 3, apor_pct: 0, lien_type: 'first', is_jumbo: false }, 'apr_pct = 0.1*3 (classic non-exact double) — apr_spread_pct must equal r4(0.30000000000000004) = 0.3'],
  [{ apr_pct: (1 / 3) * 3, apor_pct: 0, lien_type: 'first', is_jumbo: false }, 'apr_pct = (1/3)*3 (x/y*y!==x rounding artifact) — must round-trip via r4 without throwing'],
  [{ apr_pct: 2.5, apor_pct: 0, lien_type: 'first', is_jumbo: true }, 'apr_spread exactly at 2.5pp jumbo first-lien threshold — is_hpml must be true'],
  [{ apr_pct: 3.5, apor_pct: 0, lien_type: 'subordinate', is_jumbo: false }, 'apr_spread exactly at 3.5pp subordinate-lien threshold — is_hpml true, escrow NOT required (subordinate)'],
  [{ apr_pct: Number.MAX_SAFE_INTEGER, apor_pct: 0, lien_type: 'first', is_jumbo: false }, 'apr_pct at MAX_SAFE_INTEGER — apr_spread_pct must remain finite, is_hpml true, no overflow'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = { is_rural_or_underserved: false, creditor_assets_under_2b: false, loan_count_under_500: false, property_is_condo_master_policy: false, year: 2026, ...overrides };
    const r = compute(pp);
    const { is_hpml, escrow_required, apr_spread_pct } = r.output_payload;
    const plausible = typeof is_hpml === 'boolean' && typeof escrow_required === 'boolean' && Number.isFinite(apr_spread_pct);
    rows.push({ label, apr_pct: pp.apr_pct, apor_pct: pp.apor_pct, is_hpml, escrow_required, apr_spread_pct, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneHpml());
results.properties.push(checkP2_spreadRoundTrip());
results.properties.push(checkP3_hpmlThresholdAgreement());
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
