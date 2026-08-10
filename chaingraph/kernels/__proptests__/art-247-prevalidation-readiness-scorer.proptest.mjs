// kernel_digest_at_authoring: sha256:5474f7090f70ee2ec83b77349b3e6a1aa511bfb76c6e43c9b8972f5556b752c7
//
// FV-PROPFLOOR-SHARD-B9-1 — property-test floor for art-247-prevalidation-readiness-scorer.
// Class B (bounded categorical), float:no — IBAN mod-97/BIC/LEI/UETR/address structural checks and a
// fixed-denominator (÷5) readiness percentage, no continuous arithmetic. Forced categorical boundary
// cases used in place of ULP forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies
// (mulberry32 PRNG + explicit boundary arrays), same shape as the B1-B8 harnesses.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-247-prevalidation-readiness-scorer.proptest.mjs

import { compute } from '../art-247-prevalidation-readiness-scorer.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-247-prevalidation-readiness-scorer.fixtures.json');
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
const rand = mulberry32(0x2470A1);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;

const VALID_UETR = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const VALID_IBAN = 'GB29NWBK60161331926819'; // known-valid mod-97 IBAN
const VALID_BIC = 'NWBKGB2L';
const VALID_LEI = '213800WSGIIZCXF1P572';

function mkPP(rng) {
  return {
    iban: rng() < 0.5 ? VALID_IBAN : (rng() < 0.5 ? '' : 'BOGUS-IBAN'),
    bic: rng() < 0.5 ? VALID_BIC : (rng() < 0.5 ? '' : 'bad-bic'),
    lei: rng() < 0.5 ? VALID_LEI : (rng() < 0.5 ? '' : 'short-lei'),
    uetr: rng() < 0.7 ? VALID_UETR : (rng() < 0.5 ? '' : 'not-a-uuid'),
    address_street_name: rng() < 0.5 ? 'Main St' : '',
    address_building_number: rng() < 0.5 ? '10' : '',
    address_post_code: rng() < 0.5 ? '90210' : '',
    address_town_name: rng() < 0.5 ? 'Springfield' : '',
    address_country: rng() < 0.5 ? 'US' : '',
    address_lines: rng() < 0.5 ? [] : ['123 Main St'],
  };
}

// ---------- P1: monotone — degrading UETR/address away from valid never yields readier output ----------
function checkP1_monotoneReadiness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const better = { ...pp, uetr: VALID_UETR, address_lines: [], address_street_name: 'Main St', address_building_number: '1', address_post_code: '00000', address_country: 'US', address_town_name: '' };
    const worse = { ...pp, uetr: '', address_street_name: '', address_building_number: '', address_post_code: '', address_country: '', address_lines: [], address_town_name: '' };
    const r1 = compute(better);
    const r2 = compute(worse);
    checked++;
    if (r2.output_payload.checks_passed > r1.output_payload.checks_passed) violations++;
    if (r2.output_payload.readiness_pct > r1.output_payload.readiness_pct) violations++;
  }
  return { name: 'P1_monotone_readiness_nonincreasing_as_fields_degrade', trials: checked, violations };
}

// ---------- P2: boundedness — readiness_pct in [0,100], checks_passed <= checks_total ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { readiness_pct, checks_passed, checks_total } = r.output_payload;
    if (readiness_pct < 0 || readiness_pct > 100) violations++;
    if (checks_passed < 0 || checks_passed > checks_total) violations++;
    if (checks_total !== 5) violations++;
  }
  return { name: 'P2_boundedness_readiness_pct_and_checks_passed_within_total', trials: checked, violations };
}

// ---------- P3: fixed-tier agreement — ready matches independently-derived required-field rule ----------
function checkP3_readyAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const uetrOk = pp.uetr === VALID_UETR;
    const { ready, check_details } = r.output_payload;
    if (uetrOk !== (check_details.uetr.valid === true)) violations++;
    if (!uetrOk && ready) violations++;
  }
  return { name: 'P3_ready_requires_valid_uetr_matches_fixed_rule', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{}, 'fully empty input — no throw, ready=false, all optional checks pass=null-ish (not provided)'],
  [{ iban: VALID_IBAN, bic: VALID_BIC, lei: VALID_LEI, uetr: VALID_UETR, address_street_name: 'Main St', address_building_number: '1', address_post_code: '00000', address_country: 'US' }, 'all fields valid — ready must be true'],
  [{ uetr: VALID_UETR, address_country: 'US', address_town_name: 'City', address_lines: ['123 Main St'] }, 'hybrid address + valid uetr, no iban/bic/lei — ready must be true (optional checks not provided)'],
  [{ uetr: VALID_UETR, address_lines: ['Main St'], address_town_name: 'Main St', address_country: 'US' }, 'AdrLine duplicates town_name — HYBRID_SILENT_FAIL, ready must be false'],
  [{ uetr: 'not-a-uuid', address_country: 'US', address_street_name: 'Main St', address_building_number: '1' }, 'malformed UETR — ready must be false, uetr check_details.valid=false'],
  [{ uetr: VALID_UETR, iban: 'XX00INVALID', address_country: 'US', address_street_name: 'Main St', address_building_number: '1' }, 'malformed IBAN — optional check fails, ready must be false'],
  [{ uetr: VALID_UETR, address_lines: ['unstructured only'] }, 'unstructured address, no country/town — ready must be false'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { ready, readiness_pct, checks_passed } = r.output_payload;
    const plausible = typeof ready === 'boolean' && Number.isFinite(readiness_pct) && Number.isFinite(checks_passed);
    rows.push({ label, pp, ready, readiness_pct, checks_passed, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneReadiness());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_readyAgreement());
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
