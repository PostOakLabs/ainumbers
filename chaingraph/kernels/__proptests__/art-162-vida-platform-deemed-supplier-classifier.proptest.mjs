// kernel_digest_at_authoring: sha256:523805e9550b3f35628e46722c867689df3e80d5777a5961f2d8139922715403
//
// FV-PROPFLOOR-SHARD-B4-1 — property-test floor for art-162-vida-platform-deemed-supplier-classifier.
// Class B (bounded categorical), float:no exception per the WU row — sector/threshold-tier
// classification over a bounded integer (duration_nights) and booleans, no continuous
// arithmetic. Forced categorical boundary cases used in place of ULP forcing per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG + explicit
// boundary arrays), same shape as the B1/B2/B3 harnesses. This file is READ-ONLY with
// respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-162-vida-platform-deemed-supplier-classifier.proptest.mjs

import { compute } from '../art-162-vida-platform-deemed-supplier-classifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-162-vida-platform-deemed-supplier-classifier.fixtures.json');
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
const rand = mulberry32(0x16201);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const TRIALS = 10000;
const SECTORS = ['short_term_accommodation', 'passenger_transport_road', 'other_sector'];

function mkPP(rng) {
  const sector = pick(rng, SECTORS);
  return {
    platform: {
      sector,
      duration_nights: Math.floor(randRange(rng, -5, 40)),
      supplier_has_valid_vat_id: rng() < 0.5,
      intra_eu_supply: rng() < 0.5,
    },
  };
}

// ---------- P1: fixed-tier agreement — deemed_supplier exactly iff sector_eligible AND accom_duration_ok AND !supplier_has_vat AND intra_eu_supply ----------
function checkP1_deemedAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    const accom_ok = op.sector === 'short_term_accommodation'
      ? (op.duration_nights !== null && op.duration_nights >= 1 && op.duration_nights <= 30)
      : true;
    const expected = op.sector_eligible && accom_ok && !pp.platform.supplier_has_valid_vat_id && op.intra_eu_supply;
    if (op.deemed_supplier !== expected) violations++;
  }
  return { name: 'P1_deemed_supplier_matches_fixed_four_way_and', trials: checked, violations };
}

// ---------- P2: boundedness — sector_eligible only for the two named sectors, duration_nights accommodation bound respected when present ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  const ELIGIBLE = new Set(['short_term_accommodation', 'passenger_transport_road']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    if (op.sector_eligible !== ELIGIBLE.has(op.sector)) violations++;
    if (op.sector === 'short_term_accommodation' && op.deemed_supplier) {
      if (op.duration_nights < 1 || op.duration_nights > 30) violations++;
    }
  }
  return { name: 'P2_boundedness_sector_eligible_set_and_accom_duration', trials: checked, violations };
}

// ---------- P3: monotone — flipping supplier_has_valid_vat_id true→false never turns deemed_supplier true→false ----------
function checkP3_monotoneVatFlip() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    checked++;
    const withVat = { platform: { ...pp.platform, supplier_has_valid_vat_id: true } };
    const withoutVat = { platform: { ...pp.platform, supplier_has_valid_vat_id: false } };
    const rWith = compute(withVat);
    const rWithout = compute(withoutVat);
    if (rWith.output_payload.deemed_supplier && !rWithout.output_payload.deemed_supplier) violations++;
  }
  return { name: 'P3_monotone_removing_supplier_vat_never_turns_deemed_off', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{}, 'all-empty input — sector "" not eligible, deemed_supplier must be false, no throw'],
  [{ platform: { sector: 'short_term_accommodation', duration_nights: 1, supplier_has_valid_vat_id: false, intra_eu_supply: true } }, 'duration_nights exactly at lower boundary (1) — accom_duration_ok must be true'],
  [{ platform: { sector: 'short_term_accommodation', duration_nights: 0, supplier_has_valid_vat_id: false, intra_eu_supply: true } }, 'duration_nights just below lower boundary (0) — accom_duration_ok must be false'],
  [{ platform: { sector: 'short_term_accommodation', duration_nights: 30, supplier_has_valid_vat_id: false, intra_eu_supply: true } }, 'duration_nights exactly at upper boundary (30) — accom_duration_ok must be true'],
  [{ platform: { sector: 'short_term_accommodation', duration_nights: 31, supplier_has_valid_vat_id: false, intra_eu_supply: true } }, 'duration_nights just above upper boundary (31) — accom_duration_ok must be false'],
  [{ platform: { sector: 'passenger_transport_road', duration_nights: 999, supplier_has_valid_vat_id: false, intra_eu_supply: true } }, 'non-accommodation sector — duration_nights bound must NOT apply, deemed_supplier true'],
  [{ platform: { sector: 'unknown_sector', supplier_has_valid_vat_id: false, intra_eu_supply: true } }, 'unrecognized sector string — sector_eligible must be false, no throw'],
  [{ platform: { sector: 'short_term_accommodation', duration_nights: -5, supplier_has_valid_vat_id: false, intra_eu_supply: true } }, 'negative duration_nights — accom_duration_ok must be false, not throw'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { deemed_supplier, sector_eligible } = r.output_payload;
    const plausible = typeof deemed_supplier === 'boolean' && typeof sector_eligible === 'boolean';
    rows.push({ label, pp, deemed_supplier, sector_eligible, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_deemedAgreement());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_monotoneVatFlip());
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
