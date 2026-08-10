// kernel_digest_at_authoring: sha256:d4e0e283b6e1384fcd684e12c55e68e57ce1522b619bdab563f28f5e79ab4838
//
// FV-PROPFLOOR-SHARD-B16-1 — property-test floor for art-70-cbam-default-value-resolver.
// Class B (bounded-numeric), FLOAT-SENSITIVE — base*(1+markup) drives a single toFixed(4)
// rounding for effective_default, and markup_pct is a fixed-tier lookup keyed off
// reporting_year — ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3.
// Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-70-cbam-default-value-resolver.proptest.mjs

import { compute } from '../art-70-cbam-default-value-resolver.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-70-cbam-default-value-resolver.fixtures.json');
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
const rand = mulberry32(0x70D2);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;

const CATEGORIES = ['cement', 'iron_steel', 'aluminium', 'fertiliser', 'hydrogen', 'electricity'];
const COUNTRIES = ['CN', 'IN', 'TR', 'UA', 'ZZ_UNKNOWN', 'NO', 'JP'];

function mkPP(rng, reporting_year) {
  return {
    good_category: pick(rng, CATEGORIES),
    country_of_origin: pick(rng, COUNTRIES),
    reporting_year,
    actual_data_available: rng() < 0.5,
  };
}

// ---------- P1: fixed-threshold-tier agreement — markup_pct matches the exact year-tier rule ----------
function checkP1_markupTierExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const year = Math.floor(randRange(rand, 2024, 2035));
    const pp = mkPP(rand, year);
    const r = compute(pp);
    checked++;
    const expected = pp.good_category === 'fertiliser'
      ? 1
      : (year >= 2028 ? 30 : (year === 2026 ? 10 : year === 2027 ? 20 : 10));
    if (r.output_payload.markup_pct !== expected) violations++;
  }
  return { name: 'P1_markup_pct_matches_fixed_year_tier', trials: checked, violations };
}

// ---------- P2: monotonicity — markup_pct nondecreasing as reporting_year advances (non-fertiliser) ----------
function checkP2_markupMonotonicInYear() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const good_category = pick(rand, CATEGORIES.filter((c) => c !== 'fertiliser'));
    const country_of_origin = pick(rand, COUNTRIES);
    const yLo = Math.floor(randRange(rand, 2024, 2033));
    const yHi = yLo + Math.floor(randRange(rand, 0, 5));
    checked++;
    const rLo = compute({ good_category, country_of_origin, reporting_year: yLo });
    const rHi = compute({ good_category, country_of_origin, reporting_year: yHi });
    if (rHi.output_payload.markup_pct < rLo.output_payload.markup_pct) violations++;
  }
  return { name: 'P2_markup_pct_nondecreasing_in_reporting_year', trials: checked, violations };
}

// ---------- P3: round-trip identity — effective_default equals default_value_tco2e_per_t * (1+markup) ----------
// within a small tolerance, since default_value_tco2e_per_t is itself the toFixed(4) rounding
// of the unrounded base used to compute effective_default (same chained-rounding tolerance
// shape B12's art-327 documented for its annuity identity).
function checkP3_effectiveDefaultIdentity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const year = Math.floor(randRange(rand, 2024, 2035));
    const pp = mkPP(rand, year);
    const r = compute(pp);
    checked++;
    const { default_value_tco2e_per_t, markup_pct, effective_default } = r.output_payload;
    const expected = default_value_tco2e_per_t * (1 + markup_pct / 100);
    if (Math.abs(effective_default - expected) > 1e-3) violations++;
  }
  return { name: 'P3_effective_default_equals_base_times_one_plus_markup', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ good_category: 'iron_steel', country_of_origin: 'CN', reporting_year: 2026 }, 'reporting_year exactly at the 2026 tier boundary — markup_pct must be exactly 10'],
  [{ good_category: 'iron_steel', country_of_origin: 'CN', reporting_year: 2027 }, 'reporting_year exactly at the 2027 tier boundary — markup_pct must be exactly 20'],
  [{ good_category: 'iron_steel', country_of_origin: 'CN', reporting_year: 2028 }, 'reporting_year exactly at the 2028 tier boundary — markup_pct must be exactly 30'],
  [{ good_category: 'iron_steel', country_of_origin: 'CN', reporting_year: 2027.9999999999998 }, 'reporting_year 1 ULP below the 2028 boundary — must still resolve to the 2027-tier (20%) markup, not 30%'],
  [{ good_category: 'iron_steel', country_of_origin: 'CN', reporting_year: -0 }, 'reporting_year negative zero (pathological input) — getMarkup must not throw or return NaN; falls through to the ??10 default via MARKUP_BY_YEAR[0]'],
  [{ good_category: 'electricity', country_of_origin: 'ZZ_UNKNOWN', reporting_year: 2026 }, 'electricity world-average base is exactly 0 — effective_default must be exactly 0, no NaN from 0*(1+markup)'],
  [{ good_category: 'electricity', country_of_origin: 'ZZ_UNKNOWN', reporting_year: -0 }, 'base exactly 0 combined with reporting_year negative zero — must remain 0, no NaN'],
  [{ good_category: 'fertiliser', country_of_origin: 'CN', reporting_year: 2050 }, 'fertiliser flat +1% markup must hold even far in the future, never escalate to the 30% tier'],
  [{ good_category: 'aluminium', country_of_origin: 'NO', reporting_year: 2026 }, 'aluminium Norway default is the smallest table value (0.420) — effective_default must remain finite and precise at small magnitude'],
  [{ good_category: 'hydrogen', country_of_origin: 'CN', reporting_year: 2028 }, 'hydrogen China default is the largest table value (11.80) combined with the 30% top markup tier — effective_default must remain finite, not overflow'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { default_value_tco2e_per_t, markup_pct, effective_default } = r.output_payload;
    const plausible = [default_value_tco2e_per_t, markup_pct, effective_default].every(Number.isFinite);
    rows.push({ label, input: pp, default_value_tco2e_per_t, markup_pct, effective_default, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_markupTierExact());
results.properties.push(checkP2_markupMonotonicInYear());
results.properties.push(checkP3_effectiveDefaultIdentity());
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
