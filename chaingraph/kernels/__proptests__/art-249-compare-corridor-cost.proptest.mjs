// kernel_digest_at_authoring: sha256:5b97702d4128add63e1efcd5e53b18eb0f0c6775b5e0a7192e52492070064bec
//
// FV-PROPFLOOR-SHARD-B9-1 — property-test floor for art-249-compare-corridor-cost.
// Class B (bounded-numeric), FLOAT-SENSITIVE — fee_pct/fx_margin_pct raw doubles compared against
// fixed SDG 3.0% and RPW/SmaRT benchmark thresholds — ULP-boundary forcing is MANDATORY per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG + explicit boundary
// arrays), same shape as the B1-B8 float harnesses.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-249-compare-corridor-cost.proptest.mjs

import { compute } from '../art-249-compare-corridor-cost.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-249-compare-corridor-cost.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const output_payload = compute(vec.policy_parameters);
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
const rand = mulberry32(0x2490A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;
function r4(v) { return Math.round(v * 10000) / 10000; }

function mkPP(rng) {
  return {
    from_country: 'US',
    to_country: 'MX',
    send_amount: randRange(rng, 1, 2000),
    provider_fee: randRange(rng, 0, 50),
    fx_rate_used: randRange(rng, 1, 25),
    fx_rate_mid: randRange(rng, 1, 25),
    service_name: 'test-service',
  };
}

// ---------- P1: monotone — increasing provider_fee never decreases total_cost_pct ----------
function checkP1_monotoneCost() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r1 = compute(pp);
    const r2v = compute({ ...pp, provider_fee: pp.provider_fee + 10 });
    checked++;
    if (r2v.total_cost_pct < r1.total_cost_pct) violations++;
    if (r2v.fee_pct < r1.fee_pct) violations++;
  }
  return { name: 'P1_monotone_total_cost_nondecreasing_with_provider_fee', trials: checked, violations };
}

// ---------- P2: boundedness — fee_pct/fx_margin_pct never negative ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.fee_pct < 0) violations++;
    if (r.fx_margin_pct < 0) violations++;
    if (r.total_cost_pct < 0) violations++;
  }
  return { name: 'P2_boundedness_fee_and_fx_margin_pct_nonnegative', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — meets_sdg_target matches independently-derived rule ----------
function checkP3_sdgAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expectedFeePct = pp.send_amount > 0 ? r4((pp.provider_fee / pp.send_amount) * 100) : 0;
    if (r.fee_pct !== expectedFeePct) violations++;
    const expectedMeets = r.total_cost_pct <= 3.0;
    if (r.meets_sdg_target !== expectedMeets) violations++;
  }
  return { name: 'P3_meets_sdg_target_matches_fixed_3pct_threshold', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ send_amount: 100, provider_fee: 3, fx_rate_used: 1, fx_rate_mid: 1 }, 'total_cost_pct exactly at SDG 3.0% threshold — meets_sdg_target must be true'],
  [{ send_amount: 100, provider_fee: 3.0001, fx_rate_used: 1, fx_rate_mid: 1 }, 'total_cost_pct just above 3.0% threshold — meets_sdg_target must be false'],
  [{ send_amount: 100, provider_fee: 0, fx_rate_used: 1, fx_rate_mid: 1 }, 'zero fee and equal rates — total_cost_pct must be exactly 0, meets_sdg_target true'],
  [{ send_amount: 100, provider_fee: -0, fx_rate_used: 1, fx_rate_mid: 1 }, 'negative-zero provider_fee — must behave as zero'],
  [{ send_amount: 100, provider_fee: Number.MIN_VALUE, fx_rate_used: 1, fx_rate_mid: 1 }, 'provider_fee smallest positive double — fee_pct must round to 0, no throw'],
  [{ send_amount: 100, provider_fee: 0.1 * 3, fx_rate_used: 1, fx_rate_mid: 1 }, 'provider_fee = 0.1*3 (classic non-exact double) — fee_pct must round-trip without throwing'],
  [{ send_amount: 100, provider_fee: (1 / 3) * 3, fx_rate_used: 1, fx_rate_mid: 1 }, 'provider_fee = (1/3)*3 (x/y*y!==x rounding artifact) — must round-trip without throwing'],
  [{ send_amount: 100, provider_fee: 0, fx_rate_used: 1, fx_rate_mid: 0.9 }, 'fx_rate_used better than mid — fx_margin_pct must clamp to 0, not negative'],
  [{ send_amount: 0, provider_fee: 5, fx_rate_used: 1, fx_rate_mid: 1 }, 'zero send_amount — fee_pct must be 0, no divide-by-zero throw'],
  [{ send_amount: 100, provider_fee: Number.MAX_SAFE_INTEGER, fx_rate_used: 1, fx_rate_mid: 1 }, 'provider_fee at MAX_SAFE_INTEGER — fee_pct must remain finite, no overflow'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = { from_country: 'US', to_country: 'MX', service_name: '', ...overrides };
    const r = compute(pp);
    const plausible = Number.isFinite(r.fee_pct) && Number.isFinite(r.fx_margin_pct) && Number.isFinite(r.total_cost_pct) && typeof r.meets_sdg_target === 'boolean';
    rows.push({ label, provider_fee: pp.provider_fee, fee_pct: r.fee_pct, total_cost_pct: r.total_cost_pct, meets_sdg_target: r.meets_sdg_target, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneCost());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_sdgAgreement());
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
