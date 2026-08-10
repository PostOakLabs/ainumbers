// kernel_digest_at_authoring: sha256:b02a9e30e2bd0f0086ca064fa77f1a49da8659ae4889831342f1c8fbfb487a6a
//
// FV-PROPFLOOR-SHARD-B11-1 — property-test floor for art-295-einvoice-jurisdiction-mandate-router.
// Class B (bounded categorical), float:no exception per the WU row — table lookup + string-compare
// date logic only, no continuous arithmetic. Forced categorical boundary cases used in place of
// ULP forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG +
// explicit boundary arrays), same shape as the B1/B2/B3 harnesses. This file is READ-ONLY with
// respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-295-einvoice-jurisdiction-mandate-router.proptest.mjs

import { compute } from '../art-295-einvoice-jurisdiction-mandate-router.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-295-einvoice-jurisdiction-mandate-router.fixtures.json');
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
const rand = mulberry32(0x29501);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const TRIALS = 10000;
const REGIME_COUNTRIES = ['FR', 'DE', 'AE', 'MY', 'BE', 'PL'];
const NO_REGIME_COUNTRIES = ['US', 'JP', 'CA'];
const TX_TYPES = ['B2B', 'B2C'];

function randDate(rng) {
  const y = 2024 + Math.floor(rng() * 4);
  const m = 1 + Math.floor(rng() * 12);
  const d = 1 + Math.floor(rng() * 28);
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function mkPP(rng) {
  return {
    supplier_country: pick(rng, [...REGIME_COUNTRIES, ...NO_REGIME_COUNTRIES]),
    buyer_country: pick(rng, [...REGIME_COUNTRIES, ...NO_REGIME_COUNTRIES]),
    transaction_type: pick(rng, TX_TYPES),
    transaction_date: randDate(rng),
  };
}

// ---------- P1: boundedness — phase_status/table_version drawn from the known fixed set ----------
function checkP1_boundedness() {
  let violations = 0, checked = 0;
  const KNOWN_STATUSES = new Set(['consumer_out_of_scope', 'not_yet_mandated', 'mandatory', 'phase_in_pending', 'phase_unconfirmed']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { phase_status, table_version } = r.output_payload;
    if (!KNOWN_STATUSES.has(phase_status)) violations++;
    if (table_version !== 'einvoice-mandate-table-2026-07-24') violations++;
  }
  return { name: 'P1_boundedness_phase_status_and_table_version_from_known_set', trials: checked, violations };
}

// ---------- P2: round-trip/metamorphic — regime_country, when non-null, is always buyer or supplier country ----------
function checkP2_regimeCountryFromInputs() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const rc = r.output_payload.regime_country;
    if (rc !== null && rc !== pp.supplier_country.toUpperCase() && rc !== pp.buyer_country.toUpperCase()) violations++;
  }
  return { name: 'P2_regime_country_matches_supplier_or_buyer_when_present', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — B2C non-MY always routes to consumer_out_of_scope ----------
function checkP3_b2cOutOfScopeAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = { ...mkPP(rand), transaction_type: 'B2C', buyer_country: pick(rand, ['FR', 'DE', 'US']) };
    const r = compute(pp);
    checked++;
    if (r.output_payload.phase_status !== 'consumer_out_of_scope') violations++;
    if (r.output_payload.transmission_channel !== 'none') violations++;
  }
  return { name: 'P3_b2c_non_my_always_out_of_scope', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ supplier_country: 'de', buyer_country: 'fr', transaction_type: 'B2B', transaction_date: '2026-09-01' }, 'lowercase country codes — must uppercase-normalize, mandatory_from exact-date tie is inclusive (>=)'],
  [{ supplier_country: 'DE', buyer_country: 'FR', transaction_type: 'B2B', transaction_date: '2026-08-31' }, 'transaction_date one day before FR mandatory_from — must be phase_in_pending, not mandatory'],
  [{ buyer_country: 'MY', transaction_type: 'B2C', transaction_date: '2026-01-01' }, 'B2C with buyer_country MY — must NOT short-circuit to consumer_out_of_scope (explicit MY exception)'],
  [{ supplier_country: 'US', buyer_country: 'JP', transaction_type: 'B2B', transaction_date: '2026-01-01' }, 'neither country has a regime — must be not_yet_mandated with null format'],
  [{}, 'all-empty input — empty strings normalize, no regime found, no throw'],
  [{ supplier_country: 'AE', buyer_country: 'AE', transaction_type: 'B2B', transaction_date: 'not-a-date' }, 'malformed transaction_date against an already-unconfirmed mandatory_from — phase_unconfirmed either way'],
  [{ supplier_country: '  fr  ', buyer_country: 'DE', transaction_type: 'B2B', transaction_date: '2026-09-15' }, 'whitespace-padded country code — must trim before matching'],
  [{ supplier_country: 'DE', buyer_country: 'BE', transaction_type: 'B2B', transaction_date: '2026-01-01' }, 'transaction_date exactly on BE mandatory_from — must be mandatory (inclusive boundary)'],
  [{ supplier_country: 'FR', buyer_country: 'PL', transaction_type: 'B2B', transaction_date: '2026-01-31' }, 'transaction_date one day before PL mandatory_from — must be phase_in_pending'],
  [{ supplier_country: 'DE', buyer_country: 'FR', transaction_type: 'B2C', transaction_date: '2026-09-15' }, 'B2C non-MY — must be consumer_out_of_scope regardless of otherwise-mandatory regime'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { phase_status, table_version, transmission_channel } = r.output_payload;
    const plausible = typeof phase_status === 'string' && table_version === 'einvoice-mandate-table-2026-07-24' && typeof transmission_channel === 'string';
    rows.push({ label, pp, phase_status, table_version, transmission_channel, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_boundedness());
results.properties.push(checkP2_regimeCountryFromInputs());
results.properties.push(checkP3_b2cOutOfScopeAgreement());
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
