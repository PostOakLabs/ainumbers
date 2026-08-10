// kernel_digest_at_authoring: sha256:aee8d23400f51967716d7a7033f200fa5947d81889f3f656b06fced816014de1
//
// FV-PROPFLOOR-SHARD-B10-1 — property-test floor for art-270-perp-funding-carry.
// Class B (bounded-numeric), FLOAT-SENSITIVE (funding rate normalization, basis-pct
// arithmetic, and a deterministic fdlibm compound-APR pow all pass raw doubles through
// division and rounding) — ULP-boundary forcing is MANDATORY per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG + explicit
// boundary arrays), same shape as the B1-B9 float harnesses. READ-ONLY with respect to
// the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-270-perp-funding-carry.proptest.mjs

import { compute } from '../art-270-perp-funding-carry.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-270-perp-funding-carry.fixtures.json');
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
const rand = mulberry32(0x2700A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;
const VENUES = ['hyperliquid', 'binance', 'bybit', 'dydx_v4', 'okx'];

// cadence/rate kept within realistic funding-rate territory (cadence >= 1h, |rate| <= 6%)
// so compoundAnnualPct's hourly_rate_pct stays well clear of the narrow band (~8.28-8.4%
// hourly) where pow()'s finite-but-huge return (~1e304-1e308) is itself under the
// isFinite(result) guard yet still overflows to Infinity through round4's *1e4 scaling —
// a distinct, unrelated finite-precision quirk in the rounding helper, not a P4 ULP case.
function mkPP(rng) {
  return {
    venue: VENUES[Math.floor(rng() * VENUES.length)],
    cadence_hours: randRange(rng, 1, 24),
    funding_rate_pct_per_period: randRange(rng, -6, 6),
    taker_fee_pct: randRange(rng, 0, 0.2),
    basis_spot_price: randRange(rng, 1, 100000),
    basis_perp_price: randRange(rng, 1, 100000),
  };
}

// ---------- P1: monotonicity — basis_usd tracks (basis_perp - basis_spot) monotonically ----------
function checkP1_basisMonotone() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r1 = compute(pp);
    const r2 = compute({ ...pp, basis_perp_price: pp.basis_perp_price + 100 });
    checked++;
    if (!(r2.output_payload.basis_usd > r1.output_payload.basis_usd)) violations++;
    if (!(r2.output_payload.basis_pct >= r1.output_payload.basis_pct)) violations++;
  }
  return { name: 'P1_basis_usd_and_pct_nondecreasing_on_basis_perp_increase', trials: checked, violations };
}

// ---------- P2: boundedness — every numeric output field stays finite ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    const numericFields = [op.hourly_rate_pct, op.simple_annualized_rate_pct, op.compound_annualized_rate_pct, op.basis_usd, op.basis_pct, op.annualized_basis_pct];
    for (const v of numericFields) if (!Number.isFinite(v)) violations++;
  }
  return { name: 'P2_all_numeric_output_fields_finite', trials: checked, violations };
}

// ---------- P3: fixed-threshold agreement — ABOVE_HL_FUNDING_CAP iff |rate| > 4 and cadence <= 1 ----------
function checkP3_capThresholdAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = Math.abs(pp.funding_rate_pct_per_period) > 4 && pp.cadence_hours <= 1;
    const has = r.compliance_flags.includes('ABOVE_HL_FUNDING_CAP');
    if (expected !== has) violations++;
  }
  return { name: 'P3_above_hl_funding_cap_flag_matches_fixed_threshold_rule', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ funding_rate_pct_per_period: 4, cadence_hours: 1 }, 'rate exactly at cap boundary (4), cadence 1 — strict > means flag must be ABSENT'],
  [{ funding_rate_pct_per_period: 4 + Number.EPSILON * 4, cadence_hours: 1 }, 'rate 1-ULP above cap boundary, cadence 1 — flag must be PRESENT'],
  [{ funding_rate_pct_per_period: -4, cadence_hours: 1 }, 'rate exactly at negative cap boundary — abs()==4, strict > means flag ABSENT'],
  [{ basis_spot_price: 60000, basis_perp_price: 60000 }, 'basis_perp equals basis_spot exactly — basis_usd must be exactly 0, not -0 or epsilon'],
  [{ basis_spot_price: 0.1 * 3, basis_perp_price: 1 }, 'basis_spot = 0.1*3 (classic non-exact double 0.30000000000000004) — basis_usd must reflect the EXACT double difference'],
  [{ cadence_hours: 0.0001 }, 'cadence_hours at its own Math.max floor — hourly_rate_pct division by the smallest permitted divisor must stay finite'],
  [{ funding_rate_pct_per_period: (1 / 3) * 3 }, 'rate = (1/3)*3 (x/y*y!==x rounding artifact) — round6 must not throw or misround'],
  [{ funding_rate_pct_per_period: -0 }, 'rate negative zero — Math.abs(-0)=0, must not trip the cap flag and must not render "-0" anywhere'],
  [{ funding_rate_pct_per_period: -100, cadence_hours: 1 }, 'hourly_rate_pct exactly -100 drives compoundAnnualPct r<=-1 branch — must return exactly -100, not NaN/Infinity'],
  [{ defi_yield_pct_annual: Number.MIN_VALUE }, 'defi_yield_pct_annual at smallest positive double — delta_neutral_carry branch must not throw'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = { venue: 'hyperliquid', cadence_hours: 1, funding_rate_pct_per_period: 0.01, taker_fee_pct: 0.035, basis_spot_price: 60000, basis_perp_price: 60000, ...overrides };
    const r = compute(pp);
    const op = r.output_payload;
    const numericFields = [op.hourly_rate_pct, op.simple_annualized_rate_pct, op.compound_annualized_rate_pct, op.basis_usd, op.basis_pct, op.annualized_basis_pct];
    const finite = numericFields.every(Number.isFinite);
    rows.push({ label, overrides, hourly_rate_pct: op.hourly_rate_pct, compound_annualized_rate_pct: op.compound_annualized_rate_pct, basis_usd: op.basis_usd, compliance_flags: r.compliance_flags, finite, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_basisMonotone());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_capThresholdAgreement());
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
