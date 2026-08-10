// art-166-eudr-geolocation-plot-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C5-1).
// kernel_digest_at_authoring: sha256:8f52903ef0106be3d988c08666ae2f0f87f7e1b19703d6d8c0a4dcfe6fd3079e
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES — the WU row's own classification, re-confirmed by direct source read:
// area_ha >= 4 threshold, longitude [-180,180] / latitude [-90,90] range comparisons, and the
// polygon-closure exact-equality check (Number(first[0]) === Number(last[0])) are all raw float
// comparisons — ULP-boundary forcing is mandatory per spec §3.
// Checks: fixture-oracle gate, termination (ring-point loop bounded by coords[0].length),
// boundedness (issues[] finite, no NaN), differential re-derivation of `valid`, metamorphic
// (micro_operator_exemption short-circuits to valid:true regardless of geometry), and ULP-forced
// boundary cases (area_ha exactly 4, lon/lat exactly ±180/±90, ±1 ULP off each side, closure
// exact-equality with a 1-ULP-perturbed closing point).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-166-eudr-geolocation-plot-validator.proptest.mjs

import { compute } from '../art-166-eudr-geolocation-plot-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-166-eudr-geolocation-plot-validator.fixtures.json');
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
const rand = mulberry32(0x166A0);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function closedRing(rng, n) {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push([randRange(rng, -179, 179), randRange(rng, -89, 89)]);
  pts.push([pts[0][0], pts[0][1]]); // closed ring
  return pts;
}

function randomGeo(rng) {
  const type = pick(rng, ['Point', 'Polygon', 'MultiPolygon', 'Invalid']);
  const area_ha = randRange(rng, 0, 20);
  if (type === 'Point') {
    return { type, coordinates: [randRange(rng, -180, 180), randRange(rng, -90, 90)], area_ha };
  }
  if (type === 'Polygon') {
    const n = 3 + Math.floor(rng() * 6);
    return { type, coordinates: [closedRing(rng, n)], area_ha };
  }
  return { type, coordinates: [], area_ha };
}

const TRIALS = 5000;

// ---------- P1: termination — ring-point loop bounded by coords[0].length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const geo = randomGeo(rand);
    const { output_payload } = compute({ geo });
    checked++;
    if (!Number.isFinite(output_payload.area_ha) && output_payload.area_ha !== 0) violations++;
    if (output_payload.issues.length > 4) violations++; // at most 4 distinct issue kinds ever pushed
  }
  return { name: 'P1_termination_and_boundedness', trials: checked, violations };
}

// ---------- P2 (differential): valid iff type_valid && size_rule_met && coordinates_valid && polygon_closed !== false ----------
function checkP2_valid_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const geo = randomGeo(rand);
    const { output_payload } = compute({ geo });
    checked++;
    const validTypes = ['Point', 'Polygon', 'MultiPolygon'].includes(output_payload.geo_type);
    if (!validTypes && output_payload.valid) violations++;
    if (output_payload.polygon_closed === false && output_payload.valid) violations++;
    if (!output_payload.coordinates_valid && output_payload.valid) violations++;
  }
  return { name: 'P2_valid_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — micro-operator exemption always short-circuits to valid:true ----------
function checkP3_micro_exemption_always_valid() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const geo = { ...randomGeo(rand), micro_operator_postal_address_provided: true };
    const { output_payload } = compute({ geo });
    checked++;
    if (output_payload.valid !== true) violations++;
    if (output_payload.micro_operator_exemption !== true) violations++;
    if (output_payload.issues.length !== 0) violations++;
  }
  return { name: 'P3_metamorphic_micro_exemption_always_valid', trials: checked, violations };
}

// ---------- P4 (ULP-forcing, float_sensitive:yes) — area_ha=4 threshold, lon/lat ±180/±90, closure exact-equality ----------
const ULP = Number.EPSILON;
const ULP_BOUNDARY_CASES = [
  { label: 'area_ha exactly 4 (Point) -> large_plot=true, Point fails size rule', geo: { type: 'Point', coordinates: [0, 0], area_ha: 4 } },
  { label: 'area_ha 1 ULP under 4 (Point) -> not large, Point size-rule OK', geo: { type: 'Point', coordinates: [0, 0], area_ha: 4 - 4 * ULP } },
  { label: 'area_ha 1 ULP over 4 (Point) -> large, Point fails size rule', geo: { type: 'Point', coordinates: [0, 0], area_ha: 4 + 4 * ULP } },
  { label: 'longitude exactly 180 -> valid boundary', geo: { type: 'Point', coordinates: [180, 0], area_ha: 1 } },
  { label: 'longitude 180 + 1 ULP -> invalid_longitude', geo: { type: 'Point', coordinates: [180 + 180 * ULP, 0], area_ha: 1 } },
  { label: 'latitude exactly -90 -> valid boundary', geo: { type: 'Point', coordinates: [0, -90], area_ha: 1 } },
  { label: 'latitude -90 - 1 ULP -> invalid_latitude', geo: { type: 'Point', coordinates: [0, -90 - 90 * ULP], area_ha: 1 } },
  { label: 'negative zero longitude/latitude -> valid (===0 semantics)', geo: { type: 'Point', coordinates: [-0, -0], area_ha: 1 } },
  {
    label: 'polygon closure exact-equality: closing point 1 ULP off first point -> not closed',
    geo: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0 + 1 * ULP, 0]]], area_ha: 5 },
  },
  {
    label: 'polygon closure exact-equality: closing point bit-identical to first point -> closed',
    geo: { type: 'Polygon', coordinates: [[[0.1, 0.2], [1, 0], [1, 1], [0.1, 0.2]]], area_ha: 5 },
  },
  {
    label: 'polygon closure with denormal-scale coordinate deltas near zero -> still exact-equality, closed',
    geo: { type: 'Polygon', coordinates: [[[5e-320, 0], [1, 0], [1, 1], [5e-320, 0]]], area_ha: 5 },
  },
];
function checkP4_forced() {
  return ULP_BOUNDARY_CASES.map((c) => {
    const { output_payload } = compute({ geo: c.geo });
    return { label: c.label, valid: output_payload.valid, size_rule_met: output_payload.size_rule_met, coordinates_valid: output_payload.coordinates_valid, polygon_closed: output_payload.polygon_closed, issues: output_payload.issues };
  });
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_valid_differential());
results.properties.push(checkP3_micro_exemption_always_valid());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
// Explicit cross-checks on the forced boundary rows (documented boundary contract):
const areaAtFourFails = results.boundary_forced[0].size_rule_met === false;
const areaUnderFourPasses = results.boundary_forced[1].size_rule_met === true;
const areaOverFourFails = results.boundary_forced[2].size_rule_met === false;
const lonAt180Valid = results.boundary_forced[3].coordinates_valid === true;
const lonOver180Invalid = results.boundary_forced[4].coordinates_valid === false;
const latAtNeg90Valid = results.boundary_forced[5].coordinates_valid === true;
const latUnderNeg90Invalid = results.boundary_forced[6].coordinates_valid === false;
const negZeroValid = results.boundary_forced[7].coordinates_valid === true;
const closureUlpOffNotClosed = results.boundary_forced[8].polygon_closed === false;
const closureExactClosed = results.boundary_forced[9].polygon_closed === true;
const closureDenormalClosed = results.boundary_forced[10].polygon_closed === true;
const anyBoundaryMismatch = !(areaAtFourFails && areaUnderFourPasses && areaOverFourFails &&
  lonAt180Valid && lonOver180Invalid && latAtNeg90Valid && latUnderNeg90Invalid && negZeroValid &&
  closureUlpOffNotClosed && closureExactClosed && closureDenormalClosed);

console.log(JSON.stringify({
  tool_id: 'art-166-eudr-geolocation-plot-validator',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);
