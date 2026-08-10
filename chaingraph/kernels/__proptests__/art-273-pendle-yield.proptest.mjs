// kernel_digest_at_authoring: sha256:11142b24e8baee3beb0ab8ef15ab1c5ddc7fbe07ad7b5b63b7d81d66ff289439
//
// FV-PROPFLOOR-SHARD-B10-1 — property-test floor for art-273-pendle-yield.
// Class B (bounded-numeric), FLOAT-SENSITIVE (pt_implied_fixed_yield uses a deterministic
// fdlibm pow over raw price/day doubles, plus several chained percentage divisions) —
// ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays). READ-ONLY with respect to
// the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-273-pendle-yield.proptest.mjs

import { compute } from '../art-273-pendle-yield.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-273-pendle-yield.fixtures.json');
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
const rand = mulberry32(0x273B10);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;

function mkPP(rng) {
  const pt = randRange(rng, 0.01, 0.99);
  return {
    pt_price: pt,
    yt_price: 1 - pt,
    days_to_maturity: randRange(rng, 1, 720),
    underlying_apy_pct: randRange(rng, 0, 50),
    investment_usd: randRange(rng, 0, 1000000),
  };
}

// ---------- P1: PT/YT invariant — pt_yt_sum stays within tolerance of 1.0 when constructed that way ----------
function checkP1_invariant() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (!r.output_payload.invariant_holds) violations++;
    if (r.compliance_flags.includes('PT_YT_INVARIANT_VIOLATED')) violations++;
  }
  return { name: 'P1_pt_yt_sum_invariant_holds_when_constructed_at_face_value', trials: checked, violations };
}

// ---------- P2: monotonicity — pt_discount_pct and pt_return_to_maturity_pct increase as pt_price decreases ----------
function checkP2_discountMonotone() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pt1 = randRange(rand, 0.5, 0.9);
    const pt2 = pt1 - 0.05;
    const days = randRange(rand, 30, 360);
    const r1 = compute({ pt_price: pt1, yt_price: 1 - pt1, days_to_maturity: days, underlying_apy_pct: 5, investment_usd: 1000 });
    const r2 = compute({ pt_price: pt2, yt_price: 1 - pt2, days_to_maturity: days, underlying_apy_pct: 5, investment_usd: 1000 });
    checked++;
    if (!(r2.output_payload.pt_discount_pct > r1.output_payload.pt_discount_pct)) violations++;
    if (!(r2.output_payload.pt_return_to_maturity_pct > r1.output_payload.pt_return_to_maturity_pct)) violations++;
  }
  return { name: 'P2_pt_discount_and_return_increase_as_pt_price_falls', trials: checked, violations };
}

// ---------- P3: boundedness — all numeric outputs finite for the declared domain ----------
function checkP3_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    const fields = [op.pt_implied_fixed_yield_pct, op.yt_leverage, op.yt_levered_apy_pct, op.yt_break_even_apy_pct, op.pt_discount_pct, op.pt_return_to_maturity_pct, op.pt_simple_apr_pct];
    for (const v of fields) if (!Number.isFinite(v)) violations++;
  }
  return { name: 'P3_all_numeric_output_fields_finite_over_declared_domain', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ pt_price: 0.5, yt_price: 0.5 }, 'pt_price + yt_price exactly 0.5+0.5 — pt_yt_sum must be exactly 1.0, invariant_holds true'],
  [{ pt_price: 0.999999, yt_price: 0.000001 }, 'pt_price at its own Math.min(0.999999) clamp ceiling — yt_leverage must not overflow'],
  [{ pt_price: 0.000001, yt_price: 0.999999 }, 'pt_price at its own Math.max(0.000001) clamp floor — pt_implied_fixed_yield must not be Infinity'],
  [{ days_to_maturity: 1 }, 'days_to_maturity at its own Math.max(1) floor — years_to_maturity = 1/365, must not divide-by-near-zero'],
  [{ pt_price: 0.1 * 3 + 0.4, yt_price: 1 - (0.1 * 3 + 0.4) }, 'pt_price = 0.1*3+0.4 (classic non-exact double artifact) — pt_yt_sum must reflect the EXACT double sum'],
  [{ underlying_apy_pct: 0 }, 'underlying_apy exactly zero — yt_levered_apy_pct must be exactly 0, YT_BELOW_BREAK_EVEN flag present unless yt_price is also 0'],
  [{ investment_usd: 0 }, 'investment_usd exactly zero — pt_units_bought and yt_units_bought must be exactly 0, no division-by-zero artifact'],
  [{ pt_price: (1 / 3) * 3, yt_price: 1 - (1 / 3) * 3 }, 'pt_price = (1/3)*3 (x/y*y!==x rounding artifact) — invariant check must still hold within the 0.005 tolerance'],
  [{ days_to_maturity: 365 }, 'days_to_maturity exactly 365 — years_to_maturity must be exactly 1.0, pt_simple_apr_pct == pt_return_to_maturity_pct'],
  [{ investment_usd: Number.MAX_SAFE_INTEGER }, 'investment_usd at MAX_SAFE_INTEGER — pt_units_bought must not overflow or lose precision'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = { pt_price: 0.94, yt_price: 0.06, days_to_maturity: 180, underlying_apy_pct: 12, investment_usd: 10000, ...overrides };
    const r = compute(pp);
    const op = r.output_payload;
    const finite = Number.isFinite(op.pt_implied_fixed_yield_pct) && Number.isFinite(op.yt_leverage) && Number.isFinite(op.pt_units_bought) && Number.isFinite(op.yt_units_bought);
    rows.push({ label, overrides, pt_yt_sum: op.pt_yt_sum, invariant_holds: op.invariant_holds, pt_implied_fixed_yield_pct: op.pt_implied_fixed_yield_pct, yt_leverage: op.yt_leverage, finite, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_invariant());
results.properties.push(checkP2_discountMonotone());
results.properties.push(checkP3_boundedness());
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
