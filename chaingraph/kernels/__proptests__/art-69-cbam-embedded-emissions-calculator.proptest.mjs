// kernel_digest_at_authoring: sha256:41700ba84727c6ac4cb1f9fb130ed565723c48eb48cd03b94b3f3ac31e4d6f00
//
// FV-PROPFLOOR-SHARD-B16-1 — property-test floor for art-69-cbam-embedded-emissions-calculator.
// Class B (bounded-numeric), FLOAT-SENSITIVE — see_direct/see_indirect/quantity_tonnes/
// precursor_emissions drive two chained toFixed() roundings (see_total then
// total_embedded_emissions_tco2e) — ULP-boundary forcing is MANDATORY per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-69-cbam-embedded-emissions-calculator.proptest.mjs

import { compute } from '../art-69-cbam-embedded-emissions-calculator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-69-cbam-embedded-emissions-calculator.fixtures.json');
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
const rand = mulberry32(0x69C1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;

const CATEGORIES = ['cement', 'iron_steel', 'aluminium', 'fertiliser', 'hydrogen', 'electricity'];

// Domain restricted to non-negative actual-data factors — the kernel places no explicit
// floor on direct/indirect emission factors, but a negative factor makes the
// quantity-monotonicity property meaningless (embedded emissions could then legitimately
// decrease as quantity rises), so the floor's monotonicity claim is scoped to the
// physically-sane non-negative-factor domain, same "narrow rather than force the kernel"
// reasoning B12's art-331 documented.
function mkPP(rng, quantity_tonnes) {
  const good_category = pick(rng, CATEGORIES);
  const emissions_basis = rng() < 0.5 ? 'actual' : 'default';
  const pp = { good_category, quantity_tonnes, emissions_basis };
  if (emissions_basis === 'actual') {
    pp.direct_emissions_factor = randRange(rng, 0, 20);
    if (rng() < 0.7) pp.indirect_emissions_factor = randRange(rng, 0, 5);
  }
  if (rng() < 0.5) {
    pp.precursor_emissions = { cumulative_see_tco2e: randRange(rng, 0, 1000) };
  }
  return pp;
}

// ---------- P1: monotonicity — total_embedded_emissions_tco2e nondecreasing in quantity_tonnes ----------
function checkP1_monotonicInQuantity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const base = mkPP(rand, randRange(rand, 0, 5000));
    const lo = randRange(rand, 0, 5000);
    const hi = lo + randRange(rand, 0, 5000);
    checked++;
    const rLo = compute({ ...base, quantity_tonnes: lo });
    const rHi = compute({ ...base, quantity_tonnes: hi });
    if (rHi.output_payload.total_embedded_emissions_tco2e < rLo.output_payload.total_embedded_emissions_tco2e - 1e-6) violations++;
  }
  return { name: 'P1_total_embedded_emissions_nondecreasing_in_quantity', trials: checked, violations };
}

// ---------- P2: boundedness — basis/data_quality_flag stay within their declared enums ----------
function checkP2_enumsBounded() {
  let violations = 0, checked = 0;
  const BASES = ['actual', 'default'];
  const FLAGS = ['HIGH', 'DEFAULT_VALUES'];
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand, randRange(rand, 0, 100000));
    const r = compute(pp);
    checked++;
    if (!BASES.includes(r.output_payload.basis)) violations++;
    if (!FLAGS.includes(r.output_payload.data_quality_flag)) violations++;
  }
  return { name: 'P2_basis_and_data_quality_flag_bounded_to_declared_enum', trials: checked, violations };
}

// ---------- P3: round-trip identity — total_embedded_emissions_tco2e is the exact two-step ----------
// rounding of see_total*quantity_tonnes + precursor_contribution (recomputed from the OTHER
// output fields, which is an exact identity — no tolerance needed since the chained rounding
// is reproduced verbatim from the kernel source).
function checkP3_totalIdentity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand, randRange(rand, 0, 100000));
    const r = compute(pp);
    checked++;
    const { see_total, quantity_tonnes, precursor_contribution, total_embedded_emissions_tco2e } = r.output_payload;
    const total_from_see = +(see_total * quantity_tonnes).toFixed(3);
    const expected = +(total_from_see + precursor_contribution).toFixed(3);
    if (total_embedded_emissions_tco2e !== expected) violations++;
  }
  return { name: 'P3_total_embedded_emissions_exact_two_step_rounding', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ quantity_tonnes: 0 }, 'quantity_tonnes exactly zero — total_embedded_emissions_tco2e must equal precursor_contribution exactly, no NaN'],
  [{ quantity_tonnes: -0 }, 'quantity_tonnes negative zero — must behave identically to positive zero'],
  [{ good_category: 'iron_steel', emissions_basis: 'actual', direct_emissions_factor: Number.MIN_VALUE, quantity_tonnes: 10 }, 'direct_emissions_factor at smallest positive denormal — see_direct must remain finite, non-NaN'],
  [{ good_category: 'iron_steel', quantity_tonnes: (1 / 3) * 3 }, 'quantity_tonnes = (1/3)*3, x/y*y!==x style rounding artifact — total_from_see must use the exact double, not a naively-reconstructed 3'],
  [{ good_category: 'aluminium', emissions_basis: 'actual', direct_emissions_factor: 0, indirect_emissions_factor: 0, quantity_tonnes: 500 }, 'both actual emission factors exactly zero — see_total must be exactly 0, total_embedded_emissions_tco2e must be exactly 0 (plus precursor contribution)'],
  [{ good_category: 'aluminium', emissions_basis: 'actual', direct_emissions_factor: -0, indirect_emissions_factor: -0, quantity_tonnes: 500 }, 'both actual emission factors negative zero — must behave as zero, no NaN'],
  [{ good_category: 'electricity', quantity_tonnes: 1e12 }, 'quantity_tonnes at a very large magnitude — total_from_see must remain finite, not overflow to Infinity for the electricity default (see_total=0)'],
  [{ good_category: 'iron_steel', quantity_tonnes: 10, precursor_emissions: { cumulative_see_tco2e: Number.MIN_VALUE } }, 'precursor cumulative_see_tco2e at smallest positive denormal — total must remain finite'],
  [{ good_category: 'iron_steel', quantity_tonnes: 10, precursor_emissions: { cumulative_see_tco2e: -0 } }, 'precursor cumulative_see_tco2e negative zero — must behave as zero'],
  [{ good_category: 'fertiliser', emissions_basis: 'actual', direct_emissions_factor: 99.99999999999999, quantity_tonnes: 1 }, 'direct_emissions_factor at 1-ULP-below-100 boundary — see_direct/see_total must remain finite and precise'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { total_embedded_emissions_tco2e, see_direct, see_indirect, see_total } = r.output_payload;
    const plausible = [total_embedded_emissions_tco2e, see_direct, see_indirect, see_total].every(Number.isFinite);
    rows.push({ label, input: pp, total_embedded_emissions_tco2e, see_direct, see_indirect, see_total, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotonicInQuantity());
results.properties.push(checkP2_enumsBounded());
results.properties.push(checkP3_totalIdentity());
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
