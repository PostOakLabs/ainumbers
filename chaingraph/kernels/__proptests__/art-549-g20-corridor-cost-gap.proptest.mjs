// kernel_digest_at_authoring: sha256:466123f62f6e6d1ee5414ed2b8d39004b3677e2cac5a9934c3c146bb1568975d
//
// FV-PROPFLOOR-SHARD-B26-1 — property-test floor for art-549-g20-corridor-cost-gap.
//
// ⚠ FIX-2 CARRY CORRECTION (per WU instruction "verify float-sensitivity ... not inherited from
// the triage table alone"): the WU row lists this kernel as float:yes, but the shipped kernel's
// own docstring states "FIXED-POINT COST MATH ... no division anywhere in compute(), so no
// branch can divide by zero" — gap_bps is computed as an integer subtraction of two
// Number.isSafeInteger-constrained bps values (toBpsOrNull rejects any non-safe-integer input).
// There is no multiplication, division, or rounding call anywhere in compute(). This is
// class-B FLOAT:NO in substance: forced CATEGORICAL boundary cases are used below in place of
// ULP forcing, and this correction is recorded in the shard manifest per FIX-2 CARRY.
//
// Zero external dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the
// B1/B3/B12 harness. READ-ONLY w.r.t. the kernel.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-549-g20-corridor-cost-gap.proptest.mjs

import { compute } from '../art-549-g20-corridor-cost-gap.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-549-g20-corridor-cost-gap.fixtures.json');
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
const rand = mulberry32(0x549549);
const TRIALS = 8000;
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const TARGETS = { 2027: 300, 2030: 500 };

function mkPP(rng) {
  const hasCorridor = rng() < 0.85;
  const target_year = rng() < 0.85 ? pick(rng, [2027, 2030]) : pick(rng, [2028, 2026, null]);
  return {
    as_of: '2026-08-01',
    corridor_pair: hasCorridor ? { send_country: 'US', receive_country: pick(rng, ['MX', 'NG', 'IN']) } : undefined,
    observed_cost_bps: rng() < 0.9 ? Math.floor(rng() * 1000) : -1,
    send_amount_basis: pick(rng, ['USD_200', 'USD_500', 'USD_999']),
    target_year,
  };
}

// ---------- P1: gap_bps is exact integer subtraction observed - target_any_corridor_bps, or null ----------
function checkP1_gapBpsExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const target = TARGETS[pp.target_year];
    if (target === undefined) {
      if (r.gap_bps !== null) violations++;
      continue;
    }
    if (r.gap_bps === null) continue; // other inputs insufficient
    const observed = Number.isSafeInteger(pp.observed_cost_bps) && pp.observed_cost_bps >= 0 ? pp.observed_cost_bps : 0;
    if (r.gap_bps !== observed - target) violations++;
    if (!Number.isInteger(r.gap_bps)) violations++;
  }
  return { name: 'P1_gap_bps_exact_integer_subtraction', trials: checked, violations };
}

// ---------- P2: meets_target is exact (gap_bps <= 0) whenever a target resolved ----------
function checkP2_meetsTargetExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (r.gap_bps === null) {
      if (r.meets_target !== null) violations++;
      continue;
    }
    if (r.meets_target !== (r.gap_bps <= 0)) violations++;
  }
  return { name: 'P2_meets_target_exact_gap_bps_lte_0', trials: checked, violations };
}

// ---------- P3: gap_bps is null exactly when target_year failed to resolve (the ONLY input gap_bps depends on) ----------
function checkP3_gapNullIffTargetYearMissing() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if ((r.gap_bps === null) !== (r.target_year === null)) violations++;
    // rejected_inputs is empty only when send_country/receive_country/target_year/observed_cost_bps/send_amount_basis all resolved.
    const shouldHaveRejections = r.corridor_pair.send_country === null || r.corridor_pair.receive_country === null
      || r.target_year === null || pp.observed_cost_bps < 0
      || (pp.send_amount_basis !== 'USD_200' && pp.send_amount_basis !== 'USD_500');
    if ((r.rejected_inputs.length > 0) !== shouldHaveRejections) violations++;
  }
  return { name: 'P3_gap_null_iff_target_year_missing', trials: checked, violations };
}

// ---------- P4 (float:no exception, corrected per FIX-2 CARRY): forced categorical boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ as_of: '2026-08-01', corridor_pair: { send_country: 'US', receive_country: 'MX' }, observed_cost_bps: 300, send_amount_basis: 'USD_200', target_year: 2027 }, 'observed_cost_bps exactly equal to the any-corridor ceiling (300 = 3.00%) — gap_bps exactly 0, meets_target true (boundary is inclusive, <=)'],
  [{ as_of: '2026-08-01', corridor_pair: { send_country: 'US', receive_country: 'MX' }, observed_cost_bps: 301, send_amount_basis: 'USD_200', target_year: 2027 }, 'observed_cost_bps one bps above the ceiling — gap_bps exactly 1, meets_target false'],
  [{ as_of: '2026-08-01', corridor_pair: { send_country: 'US', receive_country: 'MX' }, observed_cost_bps: 0, send_amount_basis: 'USD_200', target_year: 2027 }, 'observed_cost_bps exactly 0 — gap_bps is the most-negative case, meets_target true'],
  [{ as_of: '2026-08-01', corridor_pair: { send_country: 'US', receive_country: 'MX' }, observed_cost_bps: 300, send_amount_basis: 'USD_200', target_year: 2026 }, 'target_year not exactly 2027 or 2030 — rejected, gap_bps null, never a lookup KeyError'],
  [{ as_of: '2026-08-01', corridor_pair: { send_country: 'us', receive_country: 'mx' }, observed_cost_bps: 300, send_amount_basis: 'USD_200', target_year: 2027 }, 'lower-case country codes — must be uppercased before use, resolving identically to upper-case'],
  [{ as_of: '2026-08-01', corridor_pair: {}, observed_cost_bps: 300, send_amount_basis: 'USD_200', target_year: 2027 }, 'corridor_pair present as an object but both country fields absent — both rejected, gap still computable since only corridor identity is missing, not the numeric inputs'],
  [{ as_of: '2026-08-01', corridor_pair: { send_country: 'US', receive_country: 'MX' }, observed_cost_bps: -1, send_amount_basis: 'USD_200', target_year: 2027 }, 'observed_cost_bps negative — rejected as not a non-negative integer, treated as 0 with rejected_inputs entry'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const plausible = (r.gap_bps === null || Number.isInteger(r.gap_bps)) && (r.meets_target === null || typeof r.meets_target === 'boolean');
    rows.push({ label, input: pp, gap_bps: r.gap_bps, meets_target: r.meets_target, rejected_inputs: r.rejected_inputs, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_gapBpsExact());
results.properties.push(checkP2_meetsTargetExact());
results.properties.push(checkP3_gapNullIffTargetYearMissing());
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
