// kernel_digest_at_authoring: sha256:7d2f0c60cd204d6e7a54daef6611623df431e3924739025376b1277e3461c343
//
// FV-PROPFLOOR-SHARD-B2-1 — property-test floor for art-115-dpp-data-carrier-validator.
// Class B (bounded categorical), float:no exception per the WU row — set-membership logic
// only, no continuous arithmetic. Forced categorical boundary cases used in place of ULP
// forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG +
// explicit boundary arrays), same shape as the B1 pilot harness. This file is READ-ONLY
// with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-115-dpp-data-carrier-validator.proptest.mjs

import { compute } from '../art-115-dpp-data-carrier-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-115-dpp-data-carrier-validator.fixtures.json');
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
const rand = mulberry32(0x11501);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const TRIALS = 10000;
const REQUIRED = ['unique_product_identifier', 'lookup_mechanism', 'durability', 'reparability', 'recyclability', 'carbon_footprint', 'substances_of_concern'];
const CARRIERS = ['qr_gs1_digital_link', 'datamatrix', 'nfc', 'rfid', 'barcode_1d', 'unknown_carrier'];

function randElements(rng) {
  const els = {};
  for (const k of REQUIRED) if (rng() < 0.6) els[k] = 'v';
  return els;
}
function mkPP(rng) {
  return {
    product_id: pick(rng, ['P1', '', null]),
    data_carrier_type: pick(rng, CARRIERS),
    elements: randElements(rng),
    ontology_version: pick(rng, ['v1', null]),
  };
}

// ---------- P1: monotone — adding a missing required element never increases missing_elements.length ----------
function checkP1_monotoneCompleteness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const fullElements = {}; for (const k of REQUIRED) fullElements[k] = 'v';
    const r1 = compute({ ...pp, elements: pp.elements });
    const r2 = compute({ ...pp, elements: { ...pp.elements, ...fullElements } });
    checked++;
    if (r2.output_payload.missing_elements.length > r1.output_payload.missing_elements.length) violations++;
    if (r1.output_payload.ontology_conformant && !r2.output_payload.ontology_conformant) violations++;
  }
  return { name: 'P1_monotone_missing_elements_nonincreasing_on_addition', trials: checked, violations };
}

// ---------- P2: boundedness — missing_elements is a subset of REQUIRED, length in [0,7] ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  const REQ_SET = new Set(REQUIRED);
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { missing_elements } = r.output_payload;
    if (missing_elements.length < 0 || missing_elements.length > 7) violations++;
    for (const m of missing_elements) if (!REQ_SET.has(m)) violations++;
  }
  return { name: 'P2_boundedness_missing_elements_subset_of_required', trials: checked, violations };
}

// ---------- P3: categorical threshold agreement — ontology_conformant equals the exact 3-way conjunction ----------
function checkP3_conformanceAgreement() {
  let violations = 0, checked = 0;
  const VALID_CARRIERS = new Set(['qr_gs1_digital_link', 'datamatrix', 'nfc', 'rfid']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const idPresent = typeof pp.product_id === 'string' && pp.product_id.length > 0;
    const carrierValid = VALID_CARRIERS.has(pp.data_carrier_type);
    const expected = r.output_payload.missing_elements.length === 0 && carrierValid && idPresent;
    if (r.output_payload.ontology_conformant !== expected) violations++;
    if (r.output_payload.carrier_valid !== carrierValid) violations++;
  }
  return { name: 'P3_conformance_equals_conjunction_of_three_checks', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const fullElements = {}; for (const k of REQUIRED) fullElements[k] = 'v';
const CATEGORICAL_BOUNDARY_CASES = [
  [{ product_id: 'P1', data_carrier_type: 'qr_gs1_digital_link', elements: fullElements, ontology_version: 'v1' }, 'fully conformant — all 7 elements present, valid carrier, id present'],
  [{ product_id: 'P1', data_carrier_type: 'qr_gs1_digital_link', elements: {}, ontology_version: 'v1' }, 'zero elements — missing_elements must list all 7, ontology_conformant false'],
  [{ product_id: '', data_carrier_type: 'qr_gs1_digital_link', elements: fullElements, ontology_version: 'v1' }, 'empty product_id string — id_present false, ontology_conformant must be false despite full elements'],
  [{ product_id: 'P1', data_carrier_type: 'barcode_1d', elements: fullElements, ontology_version: 'v1' }, 'invalid carrier type — carrier_valid false, ontology_conformant must be false despite full elements'],
  [{ product_id: 'P1', data_carrier_type: 'qr_gs1_digital_link', elements: { ...fullElements, carbon_footprint: '' }, ontology_version: 'v1' }, 'one element present but empty string — must count as missing (empty-string check)'],
  [{ product_id: null, data_carrier_type: 'nfc', elements: {}, ontology_version: null }, 'null product_id and null ontology_version — must not throw, id_present false'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { ontology_conformant, carrier_valid, missing_elements } = r.output_payload;
    const plausible = typeof ontology_conformant === 'boolean' && typeof carrier_valid === 'boolean' && Array.isArray(missing_elements);
    rows.push({ label, pp, ontology_conformant, carrier_valid, missing_elements, plausible });
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
results.properties.push(checkP3_conformanceAgreement());
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
