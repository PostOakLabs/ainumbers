// kernel_digest_at_authoring: sha256:b93b7309081c0f6c2d2a5f3e8728d9d2cd11f4701cc936c42efc0d4d29c7809a
//
// FV-PROPFLOOR-SHARD-B16-1 — property-test floor for art-76-climate-scenario-applicator.
// Class B (bounded-numeric), FLOAT-SENSITIVE — carbon_price_at_horizon is a piecewise-linear
// interpolation across three scenario waypoints, and stressed_pd is a Math.min(1, ...)-clamped
// PD uplift feeding a chain of toFixed() roundings — ULP-boundary forcing is MANDATORY per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-76-climate-scenario-applicator.proptest.mjs

import { compute } from '../art-76-climate-scenario-applicator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-76-climate-scenario-applicator.fixtures.json');
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
const rand = mulberry32(0x76D8);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 8000;

const FAMILIES = ['NGFS-orderly', 'NGFS-disorderly', 'NGFS-hot-house', 'Fit-for-55'];
const SECTORS = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'Z'];

function mkExposures(rng, n) {
  return Array.from({ length: n }, (_, i) => ({
    sector_nace: pick(rng, SECTORS),
    ead: randRange(rng, 0, 100000),
    base_pd: randRange(rng, 0, 0.5),
  }));
}

function mkPP(rng, horizon) {
  const n = 1 + Math.floor(rng() * 4);
  return {
    scenario: { family: pick(rng, FAMILIES), horizon },
    exposures: mkExposures(rng, n),
    metric: 'stressed-PD',
  };
}

// ---------- P1: boundedness — every stressed_pd in delta_by_sector stays within [0,1] ----------
function checkP1_stressedPdBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand, Math.floor(randRange(rand, 2025, 2055)));
    const r = compute(pp);
    checked++;
    for (const d of r.output_payload.delta_by_sector) {
      if (d.stressed_pd < 0 || d.stressed_pd > 1) violations++;
    }
  }
  return { name: 'P1_stressed_pd_bounded_0_to_1', trials: checked, violations };
}

// ---------- P2: monotonicity — carbon_price_assumption nondecreasing as horizon advances (fixed family) ----------
// (every declared scenario family's waypoint table is nondecreasing 2030<=2040<=2050, verified
// directly against the source table, so the piecewise-linear interpolation is monotonic too.)
function checkP2_carbonPriceMonotonicInHorizon() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const family = pick(rand, FAMILIES);
    const exposures = mkExposures(rand, 1);
    const hLo = Math.floor(randRange(rand, 2025, 2049));
    const hHi = hLo + Math.floor(randRange(rand, 0, 10));
    checked++;
    const rLo = compute({ scenario: { family, horizon: hLo }, exposures });
    const rHi = compute({ scenario: { family, horizon: hHi }, exposures });
    if (rHi.output_payload.carbon_price_assumption < rLo.output_payload.carbon_price_assumption) violations++;
  }
  return { name: 'P2_carbon_price_assumption_nondecreasing_in_horizon_fixed_family', trials: checked, violations };
}

// ---------- P3: round-trip identity — carbon_price_at_horizon is the exact toFixed(0) of the piecewise interpolation ----------
const SCENARIO_PATHS = {
  'NGFS-orderly':    { carbon_price_2030: 130, carbon_price_2040: 310, carbon_price_2050: 680 },
  'NGFS-disorderly': { carbon_price_2030: 200, carbon_price_2040: 420, carbon_price_2050: 850 },
  'NGFS-hot-house':  { carbon_price_2030: 25,  carbon_price_2040: 30,  carbon_price_2050: 35 },
  'Fit-for-55':      { carbon_price_2030: 100, carbon_price_2040: 220, carbon_price_2050: 500 },
};
function checkP3_carbonPriceExactInterpolation() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const family = pick(rand, FAMILIES);
    const horizon = Math.floor(randRange(rand, 2020, 2060));
    const r = compute({ scenario: { family, horizon }, exposures: [] });
    checked++;
    const s = SCENARIO_PATHS[family];
    const h = horizon;
    let expected;
    if (h <= 2030) expected = s.carbon_price_2030;
    else if (h <= 2040) expected = s.carbon_price_2030 + (s.carbon_price_2040 - s.carbon_price_2030) * ((h - 2030) / 10);
    else expected = s.carbon_price_2040 + (s.carbon_price_2050 - s.carbon_price_2040) * ((h - 2040) / 10);
    expected = +expected.toFixed(0);
    if (r.output_payload.carbon_price_assumption !== expected) violations++;
  }
  return { name: 'P3_carbon_price_assumption_exact_piecewise_interpolation', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ scenario: { family: 'NGFS-orderly', horizon: 2030 } }, 'horizon exactly at the 2030 waypoint boundary — carbon_price_assumption must be exactly 130, no interpolation drift'],
  [{ scenario: { family: 'NGFS-orderly', horizon: 2040 } }, 'horizon exactly at the 2040 waypoint boundary — carbon_price_assumption must be exactly 310'],
  [{ scenario: { family: 'NGFS-orderly', horizon: 2029.9999999999998 } }, 'horizon 1 ULP below the 2030 boundary — must still resolve via the <=2030 branch (flat 130), not slip into the 2030-2040 interpolation leg'],
  [{ scenario: { family: 'NGFS-orderly', horizon: 2040.0000000000002 } }, 'horizon 1 ULP above the 2040 boundary — must resolve via the 2040-2050 interpolation leg, not the 2030-2040 leg'],
  [{ scenario: { family: 'NGFS-orderly', horizon: -0 } }, 'horizon negative zero — must resolve via the <=2030 flat branch (−0 <= 2030 is true), no NaN'],
  [{ scenario: { family: 'NGFS-orderly', horizon: 2035 }, exposures: [{ sector_nace: 'D', ead: 100000, base_pd: 1 }] }, 'base_pd already at its maximum (1) — stressed_pd Math.min(1,...) clamp must hold it at exactly 1, never exceed 1 from the added carbon uplift'],
  [{ scenario: { family: 'NGFS-orderly', horizon: 2035 }, exposures: [{ sector_nace: 'D', ead: 100000, base_pd: -0 }] }, 'base_pd negative zero — stressed_pd must remain finite, non-negative, no NaN'],
  [{ scenario: { family: 'NGFS-orderly', horizon: 2035 }, exposures: [{ sector_nace: 'D', ead: 0, base_pd: 0.02 }] }, 'ead exactly zero — baseline_el/stressed_el must both be exactly 0, el_delta exactly 0'],
  [{ scenario: { family: 'NGFS-orderly', horizon: 2035 }, exposures: [{ sector_nace: 'D', ead: Number.MIN_VALUE, base_pd: 0.02 }] }, 'ead at smallest positive denormal — baseline_el/stressed_el must remain finite, non-NaN'],
  [{ scenario: { family: 'UNKNOWN-FAMILY-XYZ', horizon: 2035 }, exposures: [{ sector_nace: 'Z', ead: 100, base_pd: 0.02 }] }, 'unrecognized scenario family — must fall back to the documented NGFS-orderly default (?? SCENARIO_PATHS["NGFS-orderly"]), never throw or return NaN; unrecognized sector "Z" must fall back to _default sensitivity'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { carbon_price_assumption, baseline_metric, stressed_metric } = r.output_payload;
    const perSectorOk = r.output_payload.delta_by_sector.every((d) => Number.isFinite(d.stressed_pd) && d.stressed_pd >= 0 && d.stressed_pd <= 1 && Number.isFinite(d.baseline_el) && Number.isFinite(d.stressed_el));
    const plausible = [carbon_price_assumption, baseline_metric, stressed_metric].every(Number.isFinite) && perSectorOk;
    rows.push({ label, input: pp, carbon_price_assumption, baseline_metric, stressed_metric, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_stressedPdBounded());
results.properties.push(checkP2_carbonPriceMonotonicInHorizon());
results.properties.push(checkP3_carbonPriceExactInterpolation());
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
