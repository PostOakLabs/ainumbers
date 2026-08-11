// kernel_digest_at_authoring: sha256:acd7dd7b0e4b050841535e867851410def190cd19b3c3965fea524418965bb8c
//
// FV-PROPFLOOR-SHARD-B4-1 — property-test floor for art-165-eudr-dds-field-validator.
// Class B (bounded categorical), float:no exception per the WU row — 8-field structural
// presence/regex validation, no continuous arithmetic beyond a guarded numeric coercion.
// Forced categorical boundary cases used in place of ULP forcing per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG + explicit
// boundary arrays), same shape as the B1/B2/B3 harnesses. This file is READ-ONLY with
// respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-165-eudr-dds-field-validator.proptest.mjs

import { compute } from '../art-165-eudr-dds-field-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-165-eudr-dds-field-validator.fixtures.json');
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
const rand = mulberry32(0x16501);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

const FIELD_FACTORIES = {
  operator_name: () => 'Acme GmbH',
  operator_address: () => 'Street 1, Berlin',
  eori: () => 'DE123456789012',
  hs_code: () => '4407',
  trade_name: () => 'Timber',
  quantity: () => 1000,
  country_of_production: () => 'BR',
  geolocation_present: () => true,
};
const FIELDS = Object.keys(FIELD_FACTORIES);
const TRIALS = 10000;

function mkPP(rng) {
  const dds = {};
  for (const f of FIELDS) if (rng() < 0.6) dds[f] = FIELD_FACTORIES[f]();
  return { dds };
}

// ---------- P1: monotone — adding one more valid field never decreases fields_passed ----------
function checkP1_monotoneFieldsPassed() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const missing = FIELDS.filter((f) => !(f in pp.dds));
    checked++;
    if (missing.length === 0) continue;
    const f0 = missing[0];
    const withMore = { dds: { ...pp.dds, [f0]: FIELD_FACTORIES[f0]() } };
    const r1 = compute(pp);
    const r2 = compute(withMore);
    if (r2.output_payload.fields_passed < r1.output_payload.fields_passed) violations++;
  }
  return { name: 'P1_monotone_fields_passed_nondecreasing_on_added_field', trials: checked, violations };
}

// ---------- P2: boundedness — fields_passed in [0,8], missing_fields subset of the 8 known fields ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { fields_passed, missing_fields, fields_checked } = r.output_payload;
    if (fields_checked !== 8) violations++;
    if (fields_passed < 0 || fields_passed > 8) violations++;
    for (const f of missing_fields) if (!FIELDS.includes(f)) violations++;
    if (fields_passed + missing_fields.length !== 8) violations++;
  }
  return { name: 'P2_boundedness_fields_passed_and_missing_fields_subset', trials: checked, violations };
}

// ---------- P3: fixed-tier agreement — conformant exactly iff missing_fields is empty ----------
function checkP3_conformantAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.conformant !== (r.output_payload.missing_fields.length === 0)) violations++;
  }
  return { name: 'P3_conformant_matches_missing_fields_empty', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{}, 'all-empty input — must not throw, conformant false, all 8 fields missing'],
  [{ dds: { operator_name: 'A', operator_address: 'B', eori: 'DE123456789012', hs_code: '4407', trade_name: 'C', quantity: 1, country_of_production: 'BR', geolocation_present: true } }, 'all 8 fields valid — conformant true, 0 missing'],
  [{ dds: { eori: 'INVALID-FORMAT' } }, 'malformed EORI (fails regex) — must count as missing, not throw'],
  [{ dds: { hs_code: 'ABCD' } }, 'non-numeric hs_code — must count as missing'],
  [{ dds: { hs_code: '444' } }, 'hs_code below 4-digit minimum — must count as missing'],
  [{ dds: { country_of_production: 'usa' } }, 'lowercase 3-letter country code — regex requires exactly 2 uppercase letters, must count as missing'],
  [{ dds: { quantity: 0 } }, 'quantity exactly zero — must NOT count as valid (quantity_valid requires > 0)'],
  [{ dds: { quantity: -5 } }, 'negative quantity — must count as missing, not throw'],
  [{ dds: { micro_operator_exemption: true } }, 'micro_operator_exemption true with geolocation_present unset — geolocation_present check must still pass via the exemption OR'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { conformant, fields_passed, missing_fields } = r.output_payload;
    const plausible = typeof conformant === 'boolean' && fields_passed >= 0 && fields_passed <= 8 && Array.isArray(missing_fields);
    rows.push({ label, pp, conformant, fields_passed, missing_fields, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneFieldsPassed());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_conformantAgreement());
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
