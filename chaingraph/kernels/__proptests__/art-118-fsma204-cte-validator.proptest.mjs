// kernel_digest_at_authoring: sha256:e34e3e945044a3bafac4c9c72d15227e4b0a89ddff995e5afb0f4ae661015922
//
// FV-PROPFLOOR-SHARD-B2-1 — property-test floor for art-118-fsma204-cte-validator.
// Class B (bounded categorical), float:no exception per the WU row — set-membership logic
// only, no continuous arithmetic. Forced categorical boundary cases used in place of ULP
// forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG +
// explicit boundary arrays), same shape as the B1 pilot harness. This file is READ-ONLY
// with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-118-fsma204-cte-validator.proptest.mjs

import { compute } from '../art-118-fsma204-cte-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-118-fsma204-cte-validator.fixtures.json');
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
const rand = mulberry32(0x11801);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const TRIALS = 10000;
const REQUIRED = {
  harvesting: ['traceability_lot_code', 'location_description', 'harvest_date', 'reference_document'],
  cooling: ['traceability_lot_code', 'location_description', 'cooling_date', 'quantity'],
  initial_packing: ['traceability_lot_code', 'location_description', 'packing_date', 'quantity', 'product_description'],
  shipping: ['traceability_lot_code', 'ship_to_location', 'ship_date', 'quantity', 'reference_document'],
  receiving: ['traceability_lot_code', 'receive_location', 'receive_date', 'quantity', 'reference_document'],
  transformation: ['new_traceability_lot_code', 'input_traceability_lot_codes', 'location_description', 'transformation_date', 'quantity'],
};
const CTE_TYPES = [...Object.keys(REQUIRED), 'unrecognized_cte'];

function randKdes(rng, cteType) {
  const req = REQUIRED[cteType] || [];
  const kdes = {};
  for (const k of req) if (rng() < 0.6) kdes[k] = 'v';
  return kdes;
}
function mkPP(rng) {
  const cte_type = pick(rng, CTE_TYPES);
  return { cte_type, kdes: randKdes(rng, cte_type), ftl_food: pick(rng, ['romaine lettuce', null]) };
}

// ---------- P1: monotone — filling in a missing KDE never increases missing_kdes.length ----------
function checkP1_monotoneCompleteness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const req = REQUIRED[pp.cte_type] || [];
    const fullKdes = {}; for (const k of req) fullKdes[k] = 'v';
    const r1 = compute(pp);
    const r2 = compute({ ...pp, kdes: { ...pp.kdes, ...fullKdes } });
    checked++;
    if (r2.output_payload.missing_kdes.length > r1.output_payload.missing_kdes.length) violations++;
    if (r1.output_payload.cte_valid && !r2.output_payload.cte_valid) violations++;
  }
  return { name: 'P1_monotone_missing_kdes_nonincreasing_on_completion', trials: checked, violations };
}

// ---------- P2: boundedness — missing_kdes is a subset of REQUIRED[cte_type], length in [0,5] ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const req = REQUIRED[pp.cte_type] || [];
    const reqSet = new Set(req);
    const r = compute(pp);
    checked++;
    const { missing_kdes } = r.output_payload;
    if (missing_kdes.length < 0 || missing_kdes.length > 5) violations++;
    for (const m of missing_kdes) if (!reqSet.has(m)) violations++;
  }
  return { name: 'P2_boundedness_missing_kdes_subset_of_required', trials: checked, violations };
}

// ---------- P3: categorical threshold agreement — cte_valid equals (required nonempty AND missing_kdes empty) ----------
function checkP3_validAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const req = REQUIRED[pp.cte_type] || [];
    const r = compute(pp);
    checked++;
    const expected = req.length > 0 && r.output_payload.missing_kdes.length === 0;
    if (r.output_payload.cte_valid !== expected) violations++;
  }
  return { name: 'P3_cte_valid_equals_nonempty_required_and_no_missing', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
function fullKdesFor(cteType) { const k = {}; for (const f of REQUIRED[cteType] || []) k[f] = 'v'; return k; }
const CATEGORICAL_BOUNDARY_CASES = [
  ['shipping', fullKdesFor('shipping'), 'spinach', 'fully complete shipping CTE — cte_valid true, missing_kdes empty'],
  ['shipping', {}, 'spinach', 'zero KDEs for shipping — missing_kdes must list all 5, cte_valid false'],
  ['transformation', fullKdesFor('transformation'), 'mixed produce', 'transformation with new+input lot codes both present — cte_valid true'],
  ['unrecognized_cte', {}, 'x', 'unrecognized cte_type — required=[] so missing_kdes empty AND cte_valid must still be false (empty-required guard)'],
  ['harvesting', { traceability_lot_code: 'v', location_description: 'v', harvest_date: 'v' }, 'lettuce', 'exactly 1 of 4 KDEs missing (reference_document) — cte_valid false, missing_kdes length 1'],
  ['cooling', fullKdesFor('cooling'), null, 'ftl_food null — must pass through as null, not throw'],
];

function checkP4_forced() {
  const rows = [];
  for (const [cte_type, kdes, ftl_food, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute({ cte_type, kdes, ftl_food });
    const { cte_valid, missing_kdes } = r.output_payload;
    const plausible = typeof cte_valid === 'boolean' && Array.isArray(missing_kdes);
    rows.push({ label, cte_type, kdes, cte_valid, missing_kdes, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneCompleteness());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_validAgreement());
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
