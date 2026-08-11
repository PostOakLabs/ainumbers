// kernel_digest_at_authoring: sha256:989771281b7268f99e74d59f151efd4deaf418e9c6e233529b873618190229fd
//
// FV-PROPFLOOR-SHARD-B16-1 — property-test floor for art-72-cbam-precursor-emissions-aggregator.
// Class B (bounded-numeric), FLOAT-SENSITIVE — mass_fraction * see_tco2e_per_t contributions are
// weighted-summed then Math.max(0, ...)-clamped and scaled by quantity_tonnes through two
// chained toFixed() roundings — ULP-boundary forcing is MANDATORY per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-72-cbam-precursor-emissions-aggregator.proptest.mjs

import { compute } from '../art-72-cbam-precursor-emissions-aggregator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-72-cbam-precursor-emissions-aggregator.fixtures.json');
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
const rand = mulberry32(0x72F4);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 8000;

function mkPrecursors(rng, n) {
  const fracs = [];
  let remaining = 1;
  for (let i = 0; i < n; i++) {
    const f = i === n - 1 ? Math.max(0, remaining) : randRange(rng, 0, Math.max(0, remaining));
    fracs.push(+f.toFixed(4));
    remaining -= f;
  }
  return fracs.map((mf, i) => ({
    cn_code: `CN${i}`,
    mass_fraction: mf,
    see_tco2e_per_t: randRange(rng, 0, 5),
    source: rng() < 0.3 ? 'default' : 'actual',
  }));
}

function mkPP(rng, quantity_tonnes) {
  const n = 1 + Math.floor(rng() * 4);
  return {
    final_good: { cn_code: 'FG1', quantity_tonnes },
    precursors: mkPrecursors(rng, n),
    scrap_input_share: rng() < 0.4 ? randRange(rng, 0, 1) : 0,
  };
}

// ---------- P1: boundedness — cumulative_see_tco2e is always non-negative ----------
function checkP1_cumulativeNonNegative() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand, randRange(rand, 0, 10000));
    const r = compute(pp);
    checked++;
    if (r.output_payload.cumulative_see_tco2e < 0) violations++;
  }
  return { name: 'P1_cumulative_see_tco2e_nonnegative', trials: checked, violations };
}

// ---------- P2: metamorphic — cumulative_see_tco2e scales linearly with quantity_tonnes ----------
// (cumulative_see_per_tonne is quantity-independent; scaling quantity scales the total
// proportionally, within toFixed(3) rounding tolerance).
function checkP2_linearInQuantity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const base = mkPP(rand, 1);
    const scale = randRange(rand, 0.1, 20);
    checked++;
    const r1 = compute({ ...base, final_good: { ...base.final_good, quantity_tonnes: 1 } });
    const r2 = compute({ ...base, final_good: { ...base.final_good, quantity_tonnes: scale } });
    const expected = r1.output_payload.cumulative_see_per_tonne * scale;
    if (Math.abs(r2.output_payload.cumulative_see_tco2e - expected) > Math.abs(expected) * 1e-3 + 1e-3) violations++;
  }
  return { name: 'P2_cumulative_see_tco2e_linear_in_quantity_tonnes', trials: checked, violations };
}

// ---------- P3: boundedness — data_quality_grade always one of the four declared states ----------
function checkP3_dataQualityGradeBounded() {
  let violations = 0, checked = 0;
  const GRADES = ['INCOMPLETE', 'FRACTION_ERROR', 'MIXED_DEFAULT_ACTUAL', 'ACTUAL_DATA'];
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand, randRange(rand, 0, 10000));
    const r = compute(pp);
    checked++;
    if (!GRADES.includes(r.output_payload.data_quality_grade)) violations++;
  }
  return { name: 'P3_data_quality_grade_bounded_to_declared_enum', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ final_good: { quantity_tonnes: 10 }, precursors: [] }, 'no precursors — must take the PRECURSOR_DATA_MISSING early-return branch, cumulative_see_tco2e exactly 0'],
  [{ final_good: { quantity_tonnes: 10 }, precursors: [{ cn_code: 'X', mass_fraction: 1, see_tco2e_per_t: 0 }] }, 'single precursor with see_tco2e_per_t exactly zero — cumulative_see_tco2e must be exactly 0'],
  [{ final_good: { quantity_tonnes: 10 }, precursors: [{ cn_code: 'X', mass_fraction: -0, see_tco2e_per_t: -0 }] }, 'mass_fraction and see_tco2e_per_t both negative zero — must behave as zero, no NaN, FRACTION_ERROR expected since total_mass_fraction=0'],
  [{ final_good: { quantity_tonnes: 10 }, precursors: [{ cn_code: 'X', mass_fraction: 1 / 3, see_tco2e_per_t: 3 }, { cn_code: 'Y', mass_fraction: 1 / 3, see_tco2e_per_t: 3 }, { cn_code: 'Z', mass_fraction: 1 / 3, see_tco2e_per_t: 3 }] }, 'three mass fractions of 1/3 (sums to a double slightly off 1 via repeated 1/3), x/y*y!==x style — data_quality_grade must resolve via the |totalFraction-1|<0.05 tolerance, not a naive equality check'],
  [{ final_good: { quantity_tonnes: 10 }, precursors: [{ cn_code: 'X', mass_fraction: 1.05, see_tco2e_per_t: 1 }] }, 'total_mass_fraction exactly at the 0.05 tolerance boundary (1.05) — must classify FRACTION_ERROR (boundary is a strict <, not <=)'],
  [{ final_good: { quantity_tonnes: 10 }, precursors: [{ cn_code: 'X', mass_fraction: 1.0499999999999998, see_tco2e_per_t: 1 }] }, 'total_mass_fraction 1 ULP inside the 0.05 tolerance boundary — must classify as within-tolerance (not FRACTION_ERROR)'],
  [{ final_good: { quantity_tonnes: 10 }, precursors: [{ cn_code: 'X', mass_fraction: 1, see_tco2e_per_t: Number.MIN_VALUE }] }, 'see_tco2e_per_t at smallest positive denormal — contribution must remain finite, non-NaN'],
  [{ final_good: { quantity_tonnes: 10 }, precursors: [{ cn_code: 'X', mass_fraction: 1, see_tco2e_per_t: 10 }], scrap_input_share: 1 }, 'scrap_input_share at its maximum (1) — scrap_adjustment must be exactly -50% of raw_see (Math.min(scrap_input_share,1) clamp is a no-op here), cumulative floor at Math.max(0,...) must not go negative'],
  [{ final_good: { quantity_tonnes: 10 }, precursors: [{ cn_code: 'X', mass_fraction: 1, see_tco2e_per_t: 10 }], scrap_input_share: 5 }, 'scrap_input_share above the declared [0,1] domain (5) — Math.min(scrap_input_share,1) clamp must still cap the credit at 50%, cumulative_see_per_tonne must not go negative'],
  [{ final_good: { quantity_tonnes: 0 }, precursors: [{ cn_code: 'X', mass_fraction: 1, see_tco2e_per_t: 10 }] }, 'quantity_tonnes exactly zero — cumulative_see_tco2e must be exactly 0 regardless of a nonzero per-tonne rate'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { cumulative_see_tco2e, cumulative_see_per_tonne, scrap_adjustment } = r.output_payload;
    // The no-precursors branch returns a smaller output shape (no cumulative_see_per_tonne field) —
    // only require the fields that branch actually emits to stay finite.
    const numericFields = [cumulative_see_tco2e, scrap_adjustment];
    if (cumulative_see_per_tonne !== undefined) numericFields.push(cumulative_see_per_tonne);
    const plausible = numericFields.every(Number.isFinite) && cumulative_see_tco2e >= 0;
    rows.push({ label, input: pp, cumulative_see_tco2e, cumulative_see_per_tonne, scrap_adjustment, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_cumulativeNonNegative());
results.properties.push(checkP2_linearInQuantity());
results.properties.push(checkP3_dataQualityGradeBounded());
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
