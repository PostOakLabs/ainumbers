// kernel_digest_at_authoring: sha256:5bcd64e2925ab483c805160229d7a37241e311140192cd080b09be6d358fec1b
//
// FV-PROPFLOOR-SHARD-B25-1 — property-test floor for art-458-attribute-sampling-plan.
// Class B (bounded-numeric), FLOAT-SENSITIVE (baseN = ln(alpha)/ln(1-tdr), expansion_factor =
// 1/(1-edr/tdr) -- transcendental division feeding a Math.ceil) — ULP-boundary forcing is
// MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-458-attribute-sampling-plan.proptest.mjs

import { compute } from '../art-458-attribute-sampling-plan.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-458-attribute-sampling-plan.fixtures.json');
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
const rand = mulberry32(0x458C3);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function randInt(rng, lo, hi) { return Math.floor(randRange(rng, lo, hi + 1)); }
const TRIALS = 12000;

const CONF = [90, 95, 99];
function mkPP(rng) {
  const confidence_level = CONF[randInt(rng, 0, 2)];
  const population_size = randInt(rng, 1, 100000);
  const tolerable_deviation_rate = randRange(rng, 0, 100);
  const expected_deviation_rate = randRange(rng, 0, 100);
  const population_hash = 'h' + randInt(rng, 0, 1e9);
  return { confidence_level, population_size, tolerable_deviation_rate, expected_deviation_rate, population_hash };
}

// ---------- P1: boundedness — sample_size always in [1, population_size] ----------
function checkP1_sampleSizeBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { sample_size, population_size } = r.output_payload;
    if (!(sample_size >= 1 && sample_size <= population_size)) violations++;
  }
  return { name: 'P1_sample_size_bounded_1_to_population', trials: checked, violations };
}

// ---------- P2: fixed rule — indefensible branch (tdr<=edr) always full-census ----------
function checkP2_indefensibleFullCensus() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { tolerable_deviation_rate, expected_deviation_rate } = r.output_payload;
    const indefensible = tolerable_deviation_rate <= expected_deviation_rate;
    if (indefensible) {
      if (r.output_payload.method !== 'full_census_fallback') violations++;
      if (r.output_payload.sample_size !== r.output_payload.population_size) violations++;
      if (!r.compliance_flags.includes('SAMPLE_PLAN_INDEFENSIBLE_FULL_CENSUS')) violations++;
    } else {
      if (r.output_payload.method !== 'poisson_attribute_sampling') violations++;
    }
  }
  return { name: 'P2_indefensible_tdr_lte_edr_forces_full_census', trials: checked, violations };
}

// ---------- P3: monotonicity — increasing TDR (holding EDR=0, confidence fixed) never increases sample_size ----------
function checkP3_monotonicSampleSizeVsTdr() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS / 4; i++) {
    const confidence_level = CONF[randInt(rand, 0, 2)];
    const population_size = randInt(rand, 100, 100000);
    const population_hash = 'h' + randInt(rand, 0, 1e9);
    const tdrLo = randRange(rand, 1, 49);
    const tdrHi = tdrLo + randRange(rand, 0.5, 49);
    const rLo = compute({ confidence_level, population_size, tolerable_deviation_rate: tdrLo, expected_deviation_rate: 0, population_hash });
    const rHi = compute({ confidence_level, population_size, tolerable_deviation_rate: tdrHi, expected_deviation_rate: 0, population_hash });
    checked++;
    if (rHi.output_payload.sample_size > rLo.output_payload.sample_size) violations++;
  }
  return { name: 'P3_monotonic_sample_size_non_increasing_in_tdr', trials: checked, violations };
}

// ---------- P4: round-trip — selected_indices unique, sorted ascending, always within population ----------
function checkP4_selectedIndicesValid() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { selected_indices, population_size } = r.output_payload;
    const seen = new Set();
    let sorted = true;
    for (let j = 0; j < selected_indices.length; j++) {
      const idx = selected_indices[j];
      if (idx < 0 || idx >= population_size) violations++;
      if (seen.has(idx)) violations++;
      seen.add(idx);
      if (j > 0 && selected_indices[j] <= selected_indices[j - 1]) sorted = false;
    }
    if (!sorted) violations++;
  }
  return { name: 'P4_selected_indices_unique_sorted_in_range', trials: checked, violations };
}

// ---------- P5 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ confidence_level: 95, population_size: 1000, tolerable_deviation_rate: 5, expected_deviation_rate: 5, population_hash: 'x' }, 'tdr exactly equal to edr — must trip indefensible full-census, not divide-by-zero'],
  [{ confidence_level: 95, population_size: 1000, tolerable_deviation_rate: 5 + Number.EPSILON, expected_deviation_rate: 5, population_hash: 'x' }, 'tdr at 1 ULP above edr — must NOT be indefensible, expansion_factor must remain finite'],
  [{ confidence_level: 95, population_size: 1000, tolerable_deviation_rate: 5 - Number.EPSILON * 4, expected_deviation_rate: 5, population_hash: 'x' }, 'tdr at a few ULP below edr — must be indefensible (tdr<=edr)'],
  [{ confidence_level: 95, population_size: 1000, tolerable_deviation_rate: 0, expected_deviation_rate: 0, population_hash: 'x' }, 'tdr and edr both exactly zero — indefensible, full census, no NaN'],
  [{ confidence_level: 95, population_size: 1, tolerable_deviation_rate: 100, expected_deviation_rate: 0, population_hash: 'x' }, 'tdr at 100% (log(1-1)=log(0)=-Infinity) — sample_size must remain finite and clamped to population'],
  [{ confidence_level: 95, population_size: 1000, tolerable_deviation_rate: 100, expected_deviation_rate: 100, population_hash: 'x' }, 'tdr=edr=100 — indefensible branch guards the log(0)/log(0) NaN case'],
  [{ confidence_level: 95, population_size: 1000, tolerable_deviation_rate: 5, expected_deviation_rate: Number.MIN_VALUE, population_hash: 'x' }, 'edr smallest positive double — expansion_factor must be finite, ~1'],
  [{ confidence_level: 95, population_size: Number.MAX_SAFE_INTEGER, tolerable_deviation_rate: 5, expected_deviation_rate: 0, population_hash: 'x' }, 'population_size at MAX_SAFE_INTEGER — sample_size/interval must not overflow to Infinity or NaN'],
  [{ confidence_level: 95, population_size: 1000, tolerable_deviation_rate: -0, expected_deviation_rate: 0, population_hash: 'x' }, 'tdr negative zero — clamps to 0, behaves as tdr<=edr, must not NaN'],
  [{ confidence_level: 95, population_size: 1000, tolerable_deviation_rate: 1 / 3, expected_deviation_rate: 0.1, population_hash: 'x' }, 'x/y*y!==x style non-exact-double tdr/edr — expansion_factor computed via the kernel own formula, must be finite'],
];

function checkP5_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { sample_size, population_size, expansion_factor } = r.output_payload;
    const plausible = Number.isFinite(sample_size) && sample_size >= 1 && sample_size <= population_size
      && (expansion_factor === null || Number.isFinite(expansion_factor));
    rows.push({ label, input: pp, sample_size, expansion_factor, method: r.output_payload.method, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_sampleSizeBounded());
results.properties.push(checkP2_indefensibleFullCensus());
results.properties.push(checkP3_monotonicSampleSizeVsTdr());
results.properties.push(checkP4_selectedIndicesValid());
results.boundary_forced = checkP5_forced();

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
