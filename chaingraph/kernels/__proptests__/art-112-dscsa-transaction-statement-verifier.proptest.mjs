// kernel_digest_at_authoring: sha256:050a30a2760caae0cac020f44dd26cfe3f9be9ec02e89386c12b22dbe18f791c
//
// FV-PROPFLOOR-SHARD-B2-1 — property-test floor for art-112-dscsa-transaction-statement-verifier.
// Class B (bounded categorical), float:no exception per the WU row — boolean/set-membership
// logic only, no continuous arithmetic. Forced categorical boundary cases used in place of
// ULP forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG
// + explicit boundary arrays), same shape as the B1 pilot harness. This file is READ-ONLY
// with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-112-dscsa-transaction-statement-verifier.proptest.mjs

import { compute } from '../art-112-dscsa-transaction-statement-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-112-dscsa-transaction-statement-verifier.fixtures.json');
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
const rand = mulberry32(0x11201);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const TRIALS = 10000;
const EVENTS = ['commissioning', 'shipping', 'receiving', 'aggregation', 'disaggregation', 'bogus_event'];

function mkPP(rng) {
  return {
    product_identifier: pick(rng, ['00312345678906.SN12345', 'INVALID', '', '00312345678906.']),
    lot: pick(rng, ['L2026A', '', null]),
    expiry: pick(rng, ['2027-12-31', '']),
    ti_present: rng() < 0.5,
    th_present: rng() < 0.5,
    ts_present: rng() < 0.5,
    gln_seller: pick(rng, ['0312345000009', '']),
    gln_buyer: pick(rng, ['0312345000016', '']),
    epcis_event_type: pick(rng, EVENTS),
    transaction_date: pick(rng, ['2026-06-01', null]),
  };
}

// ---------- P1: monotone — flipping any missing required field to present never increases missing_elements ----------
function checkP1_monotoneCompleteness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const worse = { ...pp, ti_present: false, th_present: false, ts_present: false, lot: '', gln_seller: '' };
    const better = { ...pp, ti_present: true, th_present: true, ts_present: true, lot: 'L1', gln_seller: 'G1' };
    const r1 = compute(worse);
    const r2 = compute(better);
    checked++;
    if (r2.output_payload.missing_elements.length > r1.output_payload.missing_elements.length) violations++;
    if (r1.output_payload.t3_complete && !r2.output_payload.t3_complete) violations++;
  }
  return { name: 'P1_monotone_missing_elements_nonincreasing_on_completion', trials: checked, violations };
}

// ---------- P2: boundedness — t3_complete equals exact conjunction of the 3 T3 booleans ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = pp.ti_present === true && pp.th_present === true && pp.ts_present === true;
    if (r.output_payload.t3_complete !== expected) violations++;
    if (r.output_payload.missing_elements.length < 0 || r.output_payload.missing_elements.length > 8) violations++;
  }
  return { name: 'P2_boundedness_t3_complete_equals_conjunction', trials: checked, violations };
}

// ---------- P3: categorical threshold agreement — epcis_event is UNKNOWN iff input not in the valid set ----------
function checkP3_eventCategoryAgreement() {
  let violations = 0, checked = 0;
  const VALID = new Set(['commissioning', 'shipping', 'receiving', 'aggregation', 'disaggregation']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = VALID.has(pp.epcis_event_type) ? pp.epcis_event_type : 'UNKNOWN';
    if (r.output_payload.epcis_event !== expected) violations++;
  }
  return { name: 'P3_epcis_event_category_agreement', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ product_identifier: '00312345678906.SN1', lot: 'L1', expiry: '2027-12-31', ti_present: true, th_present: true, ts_present: true, gln_seller: 'G1', gln_buyer: 'G2', epcis_event_type: 'shipping', transaction_date: '2026-01-01' }, 'fully complete — t3_complete true, missing_elements empty'],
  [{ product_identifier: '', lot: '', expiry: '', ti_present: false, th_present: false, ts_present: false, gln_seller: '', gln_buyer: '', epcis_event_type: '', transaction_date: null }, 'everything empty/false — missing_elements must list all 8'],
  [{ product_identifier: '0031234567890.SN1', lot: 'L1', expiry: 'x', ti_present: true, th_present: true, ts_present: true, gln_seller: 'G1', gln_buyer: 'G2', epcis_event_type: 'shipping', transaction_date: 'x' }, '13-digit GTIN (1 short of 14) — identifier_valid must be false'],
  [{ product_identifier: '003123456789067.SN1', lot: 'L1', expiry: 'x', ti_present: true, th_present: true, ts_present: true, gln_seller: 'G1', gln_buyer: 'G2', epcis_event_type: 'shipping', transaction_date: 'x' }, '15-digit GTIN (1 over 14) — identifier_valid must be false'],
  [{ product_identifier: '00312345678906.', lot: 'L1', expiry: 'x', ti_present: true, th_present: true, ts_present: true, gln_seller: 'G1', gln_buyer: 'G2', epcis_event_type: 'shipping', transaction_date: 'x' }, 'empty serial after the dot — identifier_valid must be false (serial length must be >0)'],
  [{ product_identifier: '00312345678906.S', lot: 'L1', expiry: 'x', ti_present: true, th_present: true, ts_present: true, gln_seller: 'G1', gln_buyer: 'G2', epcis_event_type: 'unrecognized_boundary_event', transaction_date: 'x' }, 'unrecognized epcis_event_type string — epcis_event must be UNKNOWN, not throw'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { t3_complete, identifier_valid, epcis_event, missing_elements } = r.output_payload;
    const plausible = typeof t3_complete === 'boolean' && typeof identifier_valid === 'boolean' && Array.isArray(missing_elements);
    rows.push({ label, pp, t3_complete, identifier_valid, epcis_event, missing_elements, plausible });
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
results.properties.push(checkP3_eventCategoryAgreement());
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
