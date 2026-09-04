// kernel_digest_at_authoring: sha256:5c913674e3f5067bbf69b39298780707fee957a39796b1898288f094bddf90c0
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

// ---------- P4: year-keying — a pre-2027 vintage NEVER receives a numeric holding requirement ----------
// This is the property that distinguishes the year-keyed correction from a blanket
// 0.80 -> 0.50 constant swap: under a blanket swap every row below would carry a number.
function checkP4_holdingRequirementYearKeyed() {
  let violations = 0, checked = 0;
  const SCHED = [
    { quarter: 'Q1', emissions: 2500 }, { quarter: 'Q2', emissions: 2500 },
    { quarter: 'Q3', emissions: 2500 }, { quarter: 'Q4', emissions: 2500 },
  ];
  for (let i = 0; i < TRIALS; i++) {
    const year = YEARS[Math.floor(rand() * YEARS.length)];
    const pp = {
      embedded_emissions_tco2e: randRange(rand, 0, 100000),
      cbam_factor_year: year,
      origin_carbon_price_eur_per_t: randRange(rand, 0, 50),
      eua_reference_price: randRange(rand, 1, 200),
      import_schedule: SCHED,
      annual_imported_net_mass_t: randRange(rand, 51, 100000), // above de minimis: obligations live
      cbam_sector: 'iron_steel',
    };
    const r = compute(pp);
    checked++;
    const rows = r.output_payload.quarterly_holding_schedule;
    if (year < 2027) {
      if (!rows.every((q) => q.holding_required === null && q.holding_applies === false)) violations++;
    } else if (!rows.every((q) => Number.isInteger(q.holding_required) && q.holding_required >= 0)) {
      violations++;
    }
  }
  return { name: 'P4_holding_requirement_null_before_2027_numeric_from_2027', trials: checked, violations };
}

// ---------- P5: the enforced holding requirement is exactly ceil(cumulative * 0.50) ----------
function checkP5_holdingShareIsFiftyPercent() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = {
      embedded_emissions_tco2e: randRange(rand, 0, 100000),
      cbam_factor_year: 2027 + Math.floor(rand() * 8),
      origin_carbon_price_eur_per_t: randRange(rand, 0, 50),
      eua_reference_price: randRange(rand, 1, 200),
      import_schedule: [{ quarter: 'Q1', emissions: randRange(rand, 0, 50000) }],
      annual_imported_net_mass_t: randRange(rand, 51, 100000),
      cbam_sector: 'cement',
    };
    const r = compute(pp);
    checked++;
    const share = r.output_payload.quarterly_holding_minimum_share;
    for (const q of r.output_payload.quarterly_holding_schedule) {
      if (!q.holding_enforced) continue;
      if (share !== 0.5) { violations++; break; }
      if (q.holding_required !== Math.ceil(q.cumulative_certs_required * 0.5)) { violations++; break; }
    }
  }
  return { name: 'P5_enforced_holding_required_is_exact_ceil_of_half_cumulative', trials: checked, violations };
}

// ---------- P6: de minimis exemption zeroes every liability field, and only ever below the threshold ----------
function checkP6_deMinimisExemptionZeroesLiability() {
  let violations = 0, checked = 0;
  const SECTORS = ['iron_steel', 'aluminium', 'fertilisers', 'cement', 'electricity', 'hydrogen'];
  // Mass is drawn so that the EXACT threshold and its two neighbouring ULPs are hit
  // often, not almost-never: "does not cumulatively exceed" makes 50 t itself exempt,
  // and a `<` / `<=` slip at exactly that point is invisible to uniform random floats.
  const EXACT = [50, 50 - Number.EPSILON * 50, 50 + Number.EPSILON * 50, 0, 100];
  for (let i = 0; i < TRIALS; i++) {
    const mass = rand() < 0.25 ? EXACT[Math.floor(rand() * EXACT.length)] : randRange(rand, 0, 120);
    const sector = SECTORS[Math.floor(rand() * SECTORS.length)];
    const pp = {
      embedded_emissions_tco2e: randRange(rand, 1, 100000),
      cbam_factor_year: YEARS[Math.floor(rand() * YEARS.length)],
      eua_reference_price: randRange(rand, 1, 200),
      annual_imported_net_mass_t: mass,
      cbam_sector: sector,
    };
    const r = compute(pp);
    checked++;
    const o = r.output_payload;
    const expectExempt = mass <= 50 && sector !== 'electricity' && sector !== 'hydrogen';
    if (o.de_minimis_exemption !== expectExempt) { violations++; continue; }
    if (o.de_minimis_exemption) {
      const zeroed = [o.certificate_liability_eur, o.certificates_required, o.net_liability_eur, o.gross_liability_tco2e, o.origin_price_credit];
      if (!zeroed.every((v) => v === 0)) violations++;
    }
  }
  return { name: 'P6_de_minimis_exemption_iff_below_threshold_and_in_scope_sector_and_zeroes_liability', trials: checked, violations };
}

// ---------- P7 (mandatory): ULP-boundary forcing ----------
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
  [{ embedded_emissions_tco2e: 1000, cbam_factor_year: 2027, eua_reference_price: 65, annual_imported_net_mass_t: 50, cbam_sector: 'iron_steel' }, 'net mass EXACTLY at the 50 t de minimis threshold — the comparison is "does not cumulatively exceed", so exactly 50 t is EXEMPT, not liable'],
  [{ embedded_emissions_tco2e: 1000, cbam_factor_year: 2027, eua_reference_price: 65, annual_imported_net_mass_t: 50 + Number.EPSILON * 50, cbam_sector: 'iron_steel' }, 'net mass one ULP ABOVE 50 t — must flip to the exceedance branch, no exemption'],
  [{ embedded_emissions_tco2e: 1000, cbam_factor_year: 2027, eua_reference_price: 65, annual_imported_net_mass_t: 0, cbam_sector: 'iron_steel' }, 'zero declared net mass — exempt (0 does not exceed 50), liability fields exactly 0'],
  [{ embedded_emissions_tco2e: 1000, cbam_factor_year: 2027, eua_reference_price: 65, annual_imported_net_mass_t: 10, cbam_sector: 'electricity' }, 'electricity below the threshold — the de minimis article does not apply to electricity, so NO exemption despite the small mass'],
  [{ embedded_emissions_tco2e: 1000, cbam_factor_year: 2026, eua_reference_price: 65, annual_imported_net_mass_t: 5000, cbam_sector: 'iron_steel', import_schedule: [{ quarter: 'Q1', emissions: 1000 }] }, '2026 vintage with a live import schedule — holding_required must be null (obligation not yet in force), never a number'],
  [{ embedded_emissions_tco2e: 8000, cbam_factor_year: 2027, eua_reference_price: 65, annual_imported_net_mass_t: 5000, cbam_sector: 'iron_steel', threshold_exceeded_quarter: 'Q4', import_schedule: [{ quarter: 'Q1', emissions: 2000 }, { quarter: 'Q2', emissions: 2000 }, { quarter: 'Q3', emissions: 2000 }, { quarter: 'Q4', emissions: 2000 }] }, 'threshold exceeded in the LAST quarter — the grace runs past the year end, so no quarter in this year is enforced and every holding_required is 0'],
  [{ embedded_emissions_tco2e: 4000, cbam_factor_year: 2026, eua_reference_price: 65, eua_quarter_avg_prices: {}, annual_imported_net_mass_t: 5000, cbam_sector: 'iron_steel', import_schedule: [{ quarter: 'Q1', emissions: 4000 }] }, 'empty quarterly-average price map on a 2026 vintage — must fall back to eua_reference_price and raise QUARTER_PRICE_FALLBACK, never divide by undefined'],
];

function checkP7_forced() {
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
results.properties.push(checkP4_holdingRequirementYearKeyed());
results.properties.push(checkP5_holdingShareIsFiftyPercent());
results.properties.push(checkP6_deMinimisExemptionZeroesLiability());
results.boundary_forced = checkP7_forced();

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
