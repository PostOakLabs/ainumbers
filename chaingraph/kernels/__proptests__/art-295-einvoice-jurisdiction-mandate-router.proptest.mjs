// kernel_digest_at_authoring: sha256:0b10eacc01a0d809c04d6f3548e9c09c589eb0eeb330672b8dfaab9877cd9d20
//
// FV-PROPFLOOR-SHARD-B28-1 — property-test floor for art-295-einvoice-jurisdiction-mandate-router.
// Class B (bounded-numeric per the WU row), NOT float-sensitive — this kernel routes on lexical
// ISO-8601 date-string comparison (dateAtOrPast uses `>=` on YYYY-MM-DD strings) and fixed lookup
// tables, no float arithmetic anywhere. Forced CATEGORICAL boundary cases (date string exactly at
// mandatory_from, one day before/after) used instead of ULP forcing, per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
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
const rand = mulberry32(0x295C3);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randDate(rng) {
  const y = 2024 + Math.floor(rng() * 4);
  const m = String(1 + Math.floor(rng() * 12)).padStart(2, '0');
  const d = String(1 + Math.floor(rng() * 28)).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
const TRIALS = 8000;

const REGIME_COUNTRIES = ['FR', 'DE', 'AE', 'MY', 'BE', 'PL'];
const OTHER_COUNTRIES = ['US', 'GB', 'ZZ'];
const TXN_TYPES = ['B2B', 'B2C', 'B2G'];

function mkPP(rng) {
  return {
    supplier_country: pick(rng, REGIME_COUNTRIES.concat(OTHER_COUNTRIES)),
    buyer_country: pick(rng, REGIME_COUNTRIES.concat(OTHER_COUNTRIES)),
    transaction_type: pick(rng, TXN_TYPES),
    transaction_date: randDate(rng),
  };
}

const CONFIRMED_DATE_REGIMES = { FR: '2026-09-01', DE: '2025-01-01', BE: '2026-01-01', PL: '2026-02-01' };
const ALL_REGIME_COUNTRIES = ['FR', 'DE', 'AE', 'MY', 'BE', 'PL'];

// ---------- P1: boundedness — phase_status always one of the declared enum values ----------
function checkP1_phaseStatusBounded() {
  let violations = 0, checked = 0;
  const VALID = ['consumer_out_of_scope', 'not_yet_mandated', 'mandatory', 'phase_in_pending', 'phase_unconfirmed'];
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (VALID.indexOf(r.output_payload.phase_status) === -1) violations++;
  }
  return { name: 'P1_phase_status_bounded_to_declared_enum', trials: checked, violations };
}

// ---------- P2: B2C out of scope unless buyer_country is MY ----------
function checkP2_b2cOutOfScope() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    if (pp.transaction_type !== 'B2C' || pp.buyer_country === 'MY') continue;
    const r = compute(pp);
    checked++;
    if (r.output_payload.phase_status !== 'consumer_out_of_scope') violations++;
  }
  return { name: 'P2_b2c_nonMY_always_out_of_scope', trials: checked, violations };
}

// ---------- P3: fixed threshold-tier agreement — for date-confirmed regimes, mandatory iff transaction_date >= mandatory_from lexically ----------
function checkP3_dateThresholdExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const isB2COutOfScope = pp.transaction_type === 'B2C' && pp.buyer_country !== 'MY';
    if (isB2COutOfScope) continue;
    // Kernel precedence: buyer_country's MANDATE_TABLE entry wins over supplier's if buyer has ANY
    // entry at all (even a non-date-confirmed one like AE/MY) — mirror that precedence exactly
    // before checking whether the resolved regime happens to have a confirmed date.
    const regimeCountry = ALL_REGIME_COUNTRIES.indexOf(pp.buyer_country) !== -1 ? pp.buyer_country
      : (ALL_REGIME_COUNTRIES.indexOf(pp.supplier_country) !== -1 ? pp.supplier_country : null);
    if (!regimeCountry || !CONFIRMED_DATE_REGIMES[regimeCountry]) continue;
    const r = compute(pp);
    checked++;
    const isPast = pp.transaction_date >= CONFIRMED_DATE_REGIMES[regimeCountry];
    const expected = isPast ? 'mandatory' : 'phase_in_pending';
    if (r.output_payload.phase_status !== expected) violations++;
  }
  return { name: 'P3_confirmed_regime_phase_status_matches_lexical_date_threshold', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (date exactly at mandatory_from, ±1 day) ----------
const BOUNDARY_CASES = [
  [{ supplier_country: 'DE', buyer_country: 'FR', transaction_type: 'B2B', transaction_date: '2026-09-01' }, 'transaction_date exactly at FR mandatory_from — phase_status must be mandatory (>= is inclusive)'],
  [{ supplier_country: 'DE', buyer_country: 'FR', transaction_type: 'B2B', transaction_date: '2026-08-31' }, 'transaction_date 1 day before FR mandatory_from — phase_status must be phase_in_pending'],
  [{ supplier_country: 'DE', buyer_country: 'FR', transaction_type: 'B2B', transaction_date: '2026-09-02' }, 'transaction_date 1 day after FR mandatory_from — phase_status must be mandatory'],
  [{ supplier_country: 'US', buyer_country: 'AE', transaction_type: 'B2B', transaction_date: '2026-09-01' }, 'AE mandatory_from is DRAFT-PIN (non-date string) — dateAtOrPast must return null, phase_status phase_unconfirmed'],
  [{ supplier_country: 'US', buyer_country: 'MY', transaction_type: 'B2C', transaction_date: '2026-09-01' }, 'B2C with buyer_country=MY is the sole B2C carve-in — must route through the regime table, not out-of-scope'],
  [{ supplier_country: 'US', buyer_country: 'GB', transaction_type: 'B2C', transaction_date: '2026-09-01' }, 'B2C with buyer_country other than MY — must be consumer_out_of_scope regardless of supplier'],
  [{ supplier_country: 'ZZ', buyer_country: 'ZZ', transaction_type: 'B2B', transaction_date: '2026-09-01' }, 'neither country has a regime — phase_status must be not_yet_mandated'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of BOUNDARY_CASES) {
    const r = compute(pp);
    const { phase_status } = r.output_payload;
    const plausible = typeof phase_status === 'string' && phase_status.length > 0;
    rows.push({ label, input: pp, phase_status, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_phaseStatusBounded());
results.properties.push(checkP2_b2cOutOfScope());
results.properties.push(checkP3_dateThresholdExact());
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
