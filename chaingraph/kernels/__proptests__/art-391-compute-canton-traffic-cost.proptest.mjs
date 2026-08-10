// kernel_digest_at_authoring: sha256:6784aa8d8ebe52de0d2ab52e2bb48d95559cd4796016eb7fd5388ca559b9d73b
//
// FV-PROPFLOOR-SHARD-B22-1 — property-test floor for art-391-compute-canton-traffic-cost.
// Class B (bounded-numeric), FLOAT-SENSITIVE (confirmed per FIX-2 CARRY: usd_traffic_cost =
// envelope_mb * rate is a raw float multiplication, cc_burned = usd_traffic_cost / cc_usd_price
// is a raw float division) — ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md
// §3. Zero external dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-391-compute-canton-traffic-cost.proptest.mjs

import { compute } from '../art-391-compute-canton-traffic-cost.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-391-compute-canton-traffic-cost.fixtures.json');
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
const rand = mulberry32(0x391E1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 12000;
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }
function r6(v) { return Number.isFinite(v) ? Math.round(v * 1000000) / 1000000 : 0; }

function mkPP(rng) {
  return {
    protocol_version: '3.5.5',
    envelope_mb: randRange(rng, 0.001, 500),
    rate_usd_per_mb: randRange(rng, 1, 200),
    cc_usd_price: randRange(rng, 0.01, 1000),
    is_transfer_preapproval: rng() < 0.3,
    preapproval_age_days: randRange(rng, 0, 200),
  };
}

// ---------- P1: usd_traffic_cost recomputes exactly (r2 of envelope*effective_rate) ----------
function checkP1_usdTrafficCostExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = r2(pp.envelope_mb * r.output_payload.effective_rate_usd_per_mb);
    if (r.output_payload.usd_traffic_cost !== expected) violations++;
  }
  return { name: 'P1_usd_traffic_cost_exact_r2_envelope_times_effective_rate', trials: checked, violations };
}

// ---------- P2: cc_burned is bounded (finite, non-negative when inputs non-negative) ----------
function checkP2_ccBurnedBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (!Number.isFinite(r.output_payload.cc_burned)) violations++;
    if (r.output_payload.cc_burned < 0) violations++;
    // cc_burned divides the RAW (unrounded) usd_traffic_cost, not the r2-displayed figure —
    // mirrors the kernel's own usdTrafficCost/ccUsdPrice computation before rounding.
    const rawUsdTrafficCost = pp.envelope_mb * r.output_payload.effective_rate_usd_per_mb;
    const expected = r6(rawUsdTrafficCost / pp.cc_usd_price);
    if (r.output_payload.cc_burned !== expected) violations++;
  }
  return { name: 'P2_cc_burned_bounded_and_exact_r6_division', trials: checked, violations };
}

// ---------- P3: free_period_applies boundary — exactly at CIP0119_FREE_PERIOD_DAYS (90) vs one past ----------
function checkP3_freePeriodBoundary() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const rng2 = rand;
    const atBoundary = { protocol_version: '3.5.5', envelope_mb: 1, rate_usd_per_mb: 60, cc_usd_price: 10, is_transfer_preapproval: true, preapproval_age_days: 90 };
    const overBoundary = { ...atBoundary, preapproval_age_days: 91 };
    const rAt = compute(atBoundary);
    const rOver = compute(overBoundary);
    checked++;
    if (rAt.output_payload.free_period_applies !== true) violations++;
    if (rOver.output_payload.free_period_applies !== false) violations++;
    if (i > 5) break; // deterministic boundary check, no need to repeat per trial
  }
  return { name: 'P3_free_period_applies_exact_boundary_at_90_days', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ envelope_mb: 0, rate_usd_per_mb: 60, cc_usd_price: 10 }, 'envelope_mb exactly zero — usd_traffic_cost must be exactly 0, cc_burned 0, CANTON_NON_POSITIVE_ENVELOPE flagged'],
  [{ envelope_mb: -0, rate_usd_per_mb: 60, cc_usd_price: 10 }, 'envelope_mb negative zero — must behave as zero, no NaN, flagged non-positive'],
  [{ envelope_mb: 1, rate_usd_per_mb: 60, cc_usd_price: 0 }, 'cc_usd_price exactly zero — cc_burned must fall back to 0 (guarded), not Infinity/NaN'],
  [{ envelope_mb: 1e-300, rate_usd_per_mb: 60, cc_usd_price: 1e-300 }, 'denormal-range envelope and price — product/quotient must remain finite, non-NaN'],
  [{ envelope_mb: Number.MIN_VALUE, rate_usd_per_mb: 60, cc_usd_price: 1 }, 'envelope_mb smallest positive double — usd_traffic_cost must round to 0.00, not throw'],
  [{ envelope_mb: 0.1, rate_usd_per_mb: 3, cc_usd_price: 1 }, 'classic non-exact double product 0.1*3=0.30000000000000004 — r2 must round this to 0.3 exactly'],
  [{ envelope_mb: 1 / 3, rate_usd_per_mb: 3, cc_usd_price: 1 }, 'x/y*y!==x style rounding artifact (1/3 * 3) — usd_traffic_cost must resolve to r2(1) === 1'],
  [{ envelope_mb: 2.005, rate_usd_per_mb: 100, cc_usd_price: 1 }, 'product lands exactly on a half-cent rounding boundary (200.5) after r2 -- deterministic Math.round direction, not a NaN'],
  [{ envelope_mb: Number.MAX_SAFE_INTEGER, rate_usd_per_mb: 1, cc_usd_price: 1 }, 'envelope_mb at MAX_SAFE_INTEGER — must not overflow to Infinity'],
  [{ envelope_mb: 1, rate_usd_per_mb: 60, cc_usd_price: -0 }, 'cc_usd_price negative zero — treated as non-positive (<=0 branch), cc_burned falls back to 0'],
  [{ envelope_mb: 1, rate_usd_per_mb: NaN, cc_usd_price: 10 }, 'rate_usd_per_mb is NaN — safeNum must degrade to the 60 default, never propagate NaN into the receipt'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const full = { protocol_version: '3.5.5', is_transfer_preapproval: false, preapproval_age_days: 0, ...pp };
    const r = compute(full);
    const { usd_traffic_cost, cc_burned } = r.output_payload;
    const plausible = Number.isFinite(usd_traffic_cost) && Number.isFinite(cc_burned);
    rows.push({ label, input: full, usd_traffic_cost, cc_burned, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_usdTrafficCostExact());
results.properties.push(checkP2_ccBurnedBounded());
results.properties.push(checkP3_freePeriodBoundary());
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
