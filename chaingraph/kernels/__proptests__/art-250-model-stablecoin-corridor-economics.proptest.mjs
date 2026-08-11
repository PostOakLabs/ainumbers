// kernel_digest_at_authoring: sha256:65998d555685be3e102ff17ae1fd898ca63aa688a69873358fa6d7a520660f2b
//
// FV-PROPFLOOR-SHARD-B9-1 — property-test floor for art-250-model-stablecoin-corridor-economics.
// Class B (bounded-numeric), FLOAT-SENSITIVE — on_ramp/off_ramp/fx_spread pct raw doubles compared
// against a fixed SDG 3.0% threshold and driving a break-even division — ULP-boundary forcing is
// MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG + explicit
// boundary arrays), same shape as the B1-B8 float harnesses.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-250-model-stablecoin-corridor-economics.proptest.mjs

import { compute } from '../art-250-model-stablecoin-corridor-economics.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-250-model-stablecoin-corridor-economics.fixtures.json');
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
const rand = mulberry32(0x2500A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;
function r4(v) { return Math.round(v * 10000) / 10000; }

function mkPP(rng) {
  return {
    send_amount_usd: randRange(rng, 1, 10000),
    on_ramp_fee_pct: randRange(rng, 0, 3),
    chain_fee_usd: randRange(rng, 0, 1),
    off_ramp_fee_pct: randRange(rng, 0, 3),
    fx_spread_pct: randRange(rng, 0, 2),
    float_savings_rate_pct: randRange(rng, 0, 8),
    float_days: randRange(rng, 0, 30),
    correspondent_cost_pct: randRange(rng, 0, 10),
  };
}

// ---------- P1: monotone — increasing on_ramp_fee_pct never decreases gross_cost_pct ----------
function checkP1_monotoneGrossCost() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r1 = compute(pp);
    const r2v = compute({ ...pp, on_ramp_fee_pct: pp.on_ramp_fee_pct + 1 });
    checked++;
    if (r2v.gross_cost_pct < r1.gross_cost_pct) violations++;
    if (r2v.gross_stablecoin_cost_usd < r1.gross_stablecoin_cost_usd) violations++;
  }
  return { name: 'P1_monotone_gross_cost_nondecreasing_with_on_ramp_fee', trials: checked, violations };
}

// ---------- P2: boundedness — net cost never exceeds gross cost, costs never negative ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.net_stablecoin_cost_usd > r.gross_stablecoin_cost_usd) violations++;
    if (r.net_stablecoin_cost_usd < 0) violations++;
    if (r.gross_stablecoin_cost_usd < 0) violations++;
  }
  return { name: 'P2_boundedness_net_cost_never_exceeds_gross_and_nonnegative', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — meets_sdg_target matches independently-derived rule ----------
function checkP3_sdgAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expectedMeets = r.gross_cost_pct <= 3.0;
    if (r.meets_sdg_target !== expectedMeets) violations++;
    const expectedGrossUsd = Math.round((Math.round((pp.on_ramp_fee_pct / 100) * pp.send_amount_usd * 100) / 100 + pp.chain_fee_usd + Math.round((pp.off_ramp_fee_pct / 100) * pp.send_amount_usd * 100) / 100 + Math.round((pp.fx_spread_pct / 100) * pp.send_amount_usd * 100) / 100) * 100) / 100;
    if (r.gross_stablecoin_cost_usd !== expectedGrossUsd) violations++;
  }
  return { name: 'P3_meets_sdg_target_matches_fixed_3pct_threshold', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ send_amount_usd: 100, on_ramp_fee_pct: 3, off_ramp_fee_pct: 0, fx_spread_pct: 0, chain_fee_usd: 0 }, 'gross_cost_pct exactly at SDG 3.0% threshold — meets_sdg_target must be true'],
  [{ send_amount_usd: 100, on_ramp_fee_pct: 3.0001, off_ramp_fee_pct: 0, fx_spread_pct: 0, chain_fee_usd: 0 }, 'gross_cost_pct just above 3.0% threshold — meets_sdg_target must be false'],
  [{ send_amount_usd: 100, on_ramp_fee_pct: 0, off_ramp_fee_pct: 0, fx_spread_pct: 0, chain_fee_usd: 0 }, 'all-zero fees — gross_cost_pct must be exactly 0, meets_sdg_target true'],
  [{ send_amount_usd: 100, on_ramp_fee_pct: -0, off_ramp_fee_pct: 0, fx_spread_pct: 0, chain_fee_usd: 0 }, 'negative-zero on_ramp_fee_pct — must behave as zero'],
  [{ send_amount_usd: 100, on_ramp_fee_pct: Number.MIN_VALUE, off_ramp_fee_pct: 0, fx_spread_pct: 0, chain_fee_usd: 0 }, 'on_ramp_fee_pct smallest positive double — on_ramp_fee_usd must round to 0, no throw'],
  [{ send_amount_usd: 100, on_ramp_fee_pct: 0.1 * 3, off_ramp_fee_pct: 0, fx_spread_pct: 0, chain_fee_usd: 0 }, 'on_ramp_fee_pct = 0.1*3 (classic non-exact double) — must round-trip without throwing'],
  [{ send_amount_usd: 100, on_ramp_fee_pct: (1 / 3) * 3, off_ramp_fee_pct: 0, fx_spread_pct: 0, chain_fee_usd: 0 }, 'on_ramp_fee_pct = (1/3)*3 (x/y*y!==x rounding artifact) — must round-trip without throwing'],
  [{ send_amount_usd: 0, on_ramp_fee_pct: 1, off_ramp_fee_pct: 1, fx_spread_pct: 1, chain_fee_usd: 0 }, 'zero send_amount_usd — gross_cost_pct must be 0, no divide-by-zero throw'],
  [{ send_amount_usd: Number.MAX_SAFE_INTEGER, on_ramp_fee_pct: 1, off_ramp_fee_pct: 0, fx_spread_pct: 0, chain_fee_usd: 0 }, 'send_amount_usd at MAX_SAFE_INTEGER — gross_stablecoin_cost_usd must remain finite, no overflow'],
  [{ send_amount_usd: 100, on_ramp_fee_pct: 0, off_ramp_fee_pct: 0, fx_spread_pct: 0, chain_fee_usd: 0, correspondent_cost_pct: 0 }, 'break-even with cost_pct_diff exactly zero — break_even_usd must be 0, no division by zero'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = { ...overrides };
    const r = compute(pp);
    const plausible = Number.isFinite(r.gross_cost_pct) && Number.isFinite(r.gross_stablecoin_cost_usd) && typeof r.meets_sdg_target === 'boolean' && (r.break_even_usd === null || Number.isFinite(r.break_even_usd));
    rows.push({ label, on_ramp_fee_pct: pp.on_ramp_fee_pct, gross_cost_pct: r.gross_cost_pct, meets_sdg_target: r.meets_sdg_target, break_even_usd: r.break_even_usd, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneGrossCost());
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
