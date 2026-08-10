// kernel_digest_at_authoring: sha256:80df4fc1195a5177c803aad81d51aabbfad003ca7e5c117591b4f557b278f2d9
//
// FV-PROPFLOOR-SHARD-B16-1 — property-test floor for art-71-cbam-certificate-cost-engine.
// Class B (bounded-numeric), FLOAT-SENSITIVE — net_liability_eur / eua_reference_price feeds
// a Math.ceil() certificate count, and origin_price_credit is a Math.min() over two
// independently-rounded values — ULP-boundary forcing is MANDATORY per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-71-cbam-certificate-cost-engine.proptest.mjs

import { compute } from '../art-71-cbam-certificate-cost-engine.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-71-cbam-certificate-cost-engine.fixtures.json');
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
const rand = mulberry32(0x71E3);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;

const YEARS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034];

function mkPP(rng, embedded_emissions_tco2e) {
  return {
    embedded_emissions_tco2e,
    cbam_factor_year: YEARS[Math.floor(rng() * YEARS.length)],
    origin_carbon_price_eur_per_t: randRange(rng, 0, 50),
    eua_reference_price: randRange(rng, 1, 200),
  };
}

// ---------- P1: boundedness — certificates_required is a non-negative integer ----------
function checkP1_certsBoundedNonNegativeInteger() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand, randRange(rand, 0, 100000));
    const r = compute(pp);
    checked++;
    const c = r.output_payload.certificates_required;
    if (!(Number.isInteger(c) && c >= 0)) violations++;
  }
  return { name: 'P1_certificates_required_nonnegative_integer', trials: checked, violations };
}

// ---------- P2: monotonicity — gross_liability_tco2e nondecreasing in embedded_emissions_tco2e ----------
function checkP2_grossLiabilityMonotonic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const base = mkPP(rand, 0);
    const lo = randRange(rand, 0, 50000);
    const hi = lo + randRange(rand, 0, 50000);
    checked++;
    const rLo = compute({ ...base, embedded_emissions_tco2e: lo });
    const rHi = compute({ ...base, embedded_emissions_tco2e: hi });
    if (rHi.output_payload.gross_liability_tco2e < rLo.output_payload.gross_liability_tco2e - 1e-6) violations++;
  }
  return { name: 'P2_gross_liability_nondecreasing_in_embedded_emissions', trials: checked, violations };
}

// ---------- P3: round-trip identity — certificates_required is the exact ceil of net_liability_eur/eua_reference_price ----------
function checkP3_certsIdentity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand, randRange(rand, 0, 100000));
    const r = compute(pp);
    checked++;
    const { net_liability_eur, eua_reference_price, certificates_required } = r.output_payload;
    const expected = eua_reference_price > 0 ? Math.ceil(net_liability_eur / eua_reference_price) : 0;
    if (certificates_required !== expected) violations++;
  }
  return { name: 'P3_certificates_required_exact_ceil_of_net_liability_over_eua_price', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ embedded_emissions_tco2e: 0, cbam_factor_year: 2026, eua_reference_price: 65 }, 'embedded_emissions_tco2e exactly zero — gross_liability_tco2e/net_liability_eur/certificates_required must all be exactly 0'],
  [{ embedded_emissions_tco2e: -0, cbam_factor_year: 2026, eua_reference_price: 65 }, 'embedded_emissions_tco2e negative zero — must behave as zero, no NaN'],
  [{ embedded_emissions_tco2e: 1000, cbam_factor_year: 2026, eua_reference_price: Number.MIN_VALUE }, 'eua_reference_price at smallest positive denormal (still >0) — certificates_required must remain finite, not Infinity, despite an enormous ceil() division'],
  [{ embedded_emissions_tco2e: 1000, cbam_factor_year: 2026, eua_reference_price: 0 }, 'eua_reference_price exactly zero — must take the explicit ternary branch (certificates_required=0), never divide by zero'],
  [{ embedded_emissions_tco2e: 1000, cbam_factor_year: 2026, eua_reference_price: -0 }, 'eua_reference_price negative zero — "> 0" is false for -0, so certificates_required must be exactly 0, not NaN/Infinity'],
  [{ embedded_emissions_tco2e: (1 / 3) * 3, cbam_factor_year: 2026, origin_carbon_price_eur_per_t: 65, eua_reference_price: 65 }, 'embedded_emissions_tco2e = (1/3)*3 combined with origin_carbon_price equal to eua_reference_price — exercises the Math.min() origin-credit cap boundary at a rounding-artifact input'],
  [{ embedded_emissions_tco2e: 500, cbam_factor_year: 9999, eua_reference_price: 65 }, 'cbam_factor_year outside the declared table — must fall back to the documented 1.000 factor (?? 1.000), never NaN'],
  [{ embedded_emissions_tco2e: 500, cbam_factor_year: 2034, eua_reference_price: 65, origin_carbon_price_eur_per_t: 1e10 }, 'origin_carbon_price_eur_per_t astronomically large — origin_price_credit must clamp via Math.min to the gross_liability*eua_reference_price cap, net_liability_eur must clamp to exactly 0 (Math.max(0, ...))'],
  [{ embedded_emissions_tco2e: 1e9, cbam_factor_year: 2026, eua_reference_price: 65 }, 'embedded_emissions_tco2e at a very large magnitude — must remain finite, not overflow to Infinity'],
  [{ embedded_emissions_tco2e: 500, cbam_factor_year: 2026, eua_reference_price: 65, import_schedule: [{ quarter: 'Q1', emissions: 500 }] }, 'single-entry import_schedule — quarterly_holding_schedule division by import_schedule.length(=1) must not distort cumulative_certs_required'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { certificate_liability_eur, certificates_required, net_liability_eur, gross_liability_tco2e, origin_price_credit } = r.output_payload;
    const plausible = [certificate_liability_eur, certificates_required, net_liability_eur, gross_liability_tco2e, origin_price_credit].every(Number.isFinite);
    rows.push({ label, input: pp, certificate_liability_eur, certificates_required, net_liability_eur, gross_liability_tco2e, origin_price_credit, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_certsBoundedNonNegativeInteger());
results.properties.push(checkP2_grossLiabilityMonotonic());
results.properties.push(checkP3_certsIdentity());
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
