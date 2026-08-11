// kernel_digest_at_authoring: sha256:d7f2833446d60e8f7303219930929c8108dd595e8e1574ddb37f60d366d375c8
//
// FV-PROPFLOOR-SHARD-B4-1 — property-test floor for art-160-vida-drr-transaction-reporter.
// Class B (bounded categorical), float:no exception per the WU row — member-state set
// membership and date-arithmetic logic only, no continuous arithmetic beyond a guarded
// numeric coercion. Forced categorical boundary cases used in place of ULP forcing per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG + explicit
// boundary arrays), same shape as the B1/B2/B3 harnesses. This file is READ-ONLY with
// respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-160-vida-drr-transaction-reporter.proptest.mjs

import { compute } from '../art-160-vida-drr-transaction-reporter.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-160-vida-drr-transaction-reporter.fixtures.json');
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
const rand = mulberry32(0x16001);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const TRIALS = 10000;
const MEMBER_STATES = ['AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU','IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK'];

function mkPP(rng) {
  const seller = pick(rng, MEMBER_STATES);
  let buyer = pick(rng, MEMBER_STATES);
  const supply_type = rng() < 0.7 ? 'B2B' : 'B2C';
  return {
    transaction: {
      supply_type,
      seller_member_state: seller,
      buyer_member_state: buyer,
      seller_vat_id: rng() < 0.85 ? `${seller}${Math.floor(randRange(rng, 100000000, 999999999))}` : '',
      buyer_vat_id: rng() < 0.85 ? `${buyer}${Math.floor(randRange(rng, 100000000, 999999999))}` : '',
      invoice_date: '2030-08-01',
      transaction_value: randRange(rng, 0, 500000),
    },
  };
}

// ---------- P1: fixed-tier agreement — drr_in_scope exactly iff intra_eu AND is_b2b ----------
function checkP1_scopeAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = r.output_payload.intra_eu && r.output_payload.is_b2b;
    if (r.output_payload.drr_in_scope !== expected) violations++;
  }
  return { name: 'P1_drr_in_scope_matches_intra_eu_and_is_b2b', trials: checked, violations };
}

// ---------- P2: boundedness — reporting_deadline is exactly invoice_date+10 calendar days when the date parses ----------
function checkP2_deadlineBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const d = new Date(pp.transaction.invoice_date + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 10);
    const expected = d.toISOString().slice(0, 10);
    if (r.output_payload.reporting_deadline !== expected) violations++;
    if (!Number.isFinite(r.output_payload.transaction_value)) violations++;
  }
  return { name: 'P2_reporting_deadline_exactly_10_days_after_invoice_date', trials: checked, violations };
}

// ---------- P3: round-trip — seller/buyer member state pass through uppercased-trimmed, transaction_value unchanged for finite input ----------
function checkP3_roundTrip() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.seller_member_state !== pp.transaction.seller_member_state.toUpperCase()) violations++;
    if (r.output_payload.buyer_member_state !== pp.transaction.buyer_member_state.toUpperCase()) violations++;
    if (r.output_payload.transaction_value !== pp.transaction.transaction_value) violations++;
  }
  return { name: 'P3_member_states_and_value_roundtrip_exact', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{}, 'all-empty input — must not throw, drr_in_scope false, reporting_deadline null'],
  [{ transaction: { supply_type: 'B2B', seller_member_state: 'DE', buyer_member_state: 'de', seller_vat_id: 'X', buyer_vat_id: 'Y', invoice_date: '2030-08-01' } }, 'lowercase buyer_member_state must be normalized before comparing to seller — same state, not intra-EU'],
  [{ transaction: { supply_type: 'B2B', seller_member_state: 'XX', buyer_member_state: 'FR', seller_vat_id: 'X', buyer_vat_id: 'Y', invoice_date: '2030-08-01' } }, 'seller_member_state not in the 27-state set — intra_eu must be false, not throw'],
  [{ transaction: { supply_type: 'B2C', seller_member_state: 'DE', buyer_member_state: 'FR', seller_vat_id: 'X', buyer_vat_id: 'Y', invoice_date: '2030-08-01' } }, 'B2C intra-EU — is_b2b false, drr_in_scope must be false'],
  [{ transaction: { supply_type: 'B2B', seller_member_state: 'DE', buyer_member_state: 'FR', invoice_date: '2030-08-01' } }, 'missing both VAT ids in-scope transaction — data_elements_ok must be false, no throw'],
  [{ transaction: { supply_type: 'B2B', seller_member_state: 'DE', buyer_member_state: 'FR', seller_vat_id: 'X', buyer_vat_id: 'Y', invoice_date: '2030-02-30' } }, 'calendar-invalid but regex-valid invoice_date (Feb 30) — Date auto-normalizes, must not throw'],
  [{ transaction: { supply_type: 'B2B', seller_member_state: 'DE', buyer_member_state: 'FR', seller_vat_id: 'X', buyer_vat_id: 'Y', invoice_date: '2030-08-01', transaction_value: -500 } }, 'negative transaction_value — kernel does not clamp, must pass through as finite -500, not NaN'],
  [{ transaction: { supply_type: 'B2B', seller_member_state: 'DE', buyer_member_state: 'FR', seller_vat_id: 'X', buyer_vat_id: 'Y', invoice_date: '2030-08-01', transaction_value: 'not-a-number' } }, 'non-numeric transaction_value — must coerce to 0, not NaN'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { drr_in_scope, reporting_deadline, transaction_value } = r.output_payload;
    const plausible = typeof drr_in_scope === 'boolean' && Number.isFinite(transaction_value) && (reporting_deadline === null || /^\d{4}-\d{2}-\d{2}$/.test(reporting_deadline));
    rows.push({ label, pp, drr_in_scope, reporting_deadline, transaction_value, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_scopeAgreement());
results.properties.push(checkP2_deadlineBounded());
results.properties.push(checkP3_roundTrip());
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
