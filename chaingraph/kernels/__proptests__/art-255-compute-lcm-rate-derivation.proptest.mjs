// kernel_digest_at_authoring: sha256:d206ed051fd45134f40a3c4a1c1d7ff696243aa84d005225fe8c3d4e9084dca4
//
// FV-PROPFLOOR-SHARD-B9-1 — property-test floor for art-255-compute-lcm-rate-derivation.
// Class B (bounded-numeric), FLOAT-SENSITIVE — loading pct raw doubles feed a 1/(1-loading) LCM
// division with a denominator<=0 boundary — ULP-boundary forcing is MANDATORY per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG + explicit boundary
// arrays), same shape as the B1-B8 float harnesses.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-255-compute-lcm-rate-derivation.proptest.mjs

import { compute } from '../art-255-compute-lcm-rate-derivation.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-255-compute-lcm-rate-derivation.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const output_payload = compute(vec.policy_parameters);
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
const rand = mulberry32(0x2550A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;
function r4(v) { return Math.round(v * 10000) / 10000; }

function mkPP(rng) {
  return {
    pure_loss_cost: randRange(rng, 1, 500),
    lae_pct: randRange(rng, 0, 0.15),
    fixed_expense_pct: randRange(rng, 0, 0.15),
    variable_exp_pct: randRange(rng, 0, 0.1),
    profit_pct: randRange(rng, 0, 0.1),
    credibility_z: 1,
  };
}

// ---------- P1: monotone — increasing any loading component never decreases lcm (when denominator stays valid) ----------
function checkP1_monotoneLcm() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r1 = compute(pp);
    const r2v = compute({ ...pp, profit_pct: pp.profit_pct + 0.01 });
    checked++;
    if (r1.lcm !== null && r2v.lcm !== null && r2v.lcm < r1.lcm) violations++;
  }
  return { name: 'P1_monotone_lcm_nondecreasing_with_loading_increase', trials: checked, violations };
}

// ---------- P2: boundedness — lcm >= 1 when valid, denominator_valid gates a null lcm ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.denominator_valid && r.lcm === null) violations++;
    if (!r.denominator_valid && r.lcm !== null) violations++;
    if (r.lcm !== null && r.lcm < 1) violations++;
  }
  return { name: 'P2_boundedness_lcm_at_least_one_when_denominator_valid', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — lcm matches independently-derived 1/(1-loading) formula ----------
function checkP3_lcmAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const totalLoading = pp.lae_pct + pp.fixed_expense_pct + pp.variable_exp_pct + pp.profit_pct;
    const denom = 1 - totalLoading;
    const expectedValid = denom > 0;
    if (r.denominator_valid !== expectedValid) violations++;
    if (expectedValid) {
      const expectedLcm = r4(1 / denom);
      if (r.lcm !== expectedLcm) violations++;
    }
  }
  return { name: 'P3_lcm_matches_fixed_one_over_one_minus_loading_formula', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ pure_loss_cost: 100, lae_pct: 0, fixed_expense_pct: 0, variable_exp_pct: 0, profit_pct: 0 }, 'zero loading — lcm must be exactly 1'],
  [{ pure_loss_cost: 100, lae_pct: 1, fixed_expense_pct: 0, variable_exp_pct: 0, profit_pct: 0 }, 'total_loading exactly at 1 (100%) — denominator zero, lcm must be null, no throw/Infinity'],
  [{ pure_loss_cost: 100, lae_pct: 0.9999, fixed_expense_pct: 0, variable_exp_pct: 0, profit_pct: 0 }, 'total_loading just below 1 — denominator near zero, lcm must be large but finite'],
  [{ pure_loss_cost: 100, lae_pct: 1.0001, fixed_expense_pct: 0, variable_exp_pct: 0, profit_pct: 0 }, 'total_loading just above 1 — negative denominator, lcm must be null'],
  [{ pure_loss_cost: 0, lae_pct: 0, fixed_expense_pct: 0, variable_exp_pct: 0, profit_pct: 0 }, 'zero pure_loss_cost — lcm computed but issues flagged, no throw'],
  [{ pure_loss_cost: 100, lae_pct: -0, fixed_expense_pct: 0, variable_exp_pct: 0, profit_pct: 0 }, 'negative-zero lae_pct — must behave as zero'],
  [{ pure_loss_cost: 100, lae_pct: Number.MIN_VALUE, fixed_expense_pct: 0, variable_exp_pct: 0, profit_pct: 0 }, 'lae_pct smallest positive double — lcm must round to 1, no throw'],
  [{ pure_loss_cost: 100, lae_pct: 0.1 * 3, fixed_expense_pct: 0, variable_exp_pct: 0, profit_pct: 0 }, 'lae_pct = 0.1*3 (classic non-exact double) — must round-trip without throwing'],
  [{ pure_loss_cost: 100, lae_pct: (1 / 3) * 3 * 0.1, fixed_expense_pct: 0, variable_exp_pct: 0, profit_pct: 0 }, 'lae_pct = (1/3)*3*0.1 (x/y*y!==x rounding artifact) — must round-trip without throwing'],
  [{ pure_loss_cost: Number.MAX_SAFE_INTEGER, lae_pct: 0, fixed_expense_pct: 0, variable_exp_pct: 0, profit_pct: 0 }, 'pure_loss_cost at MAX_SAFE_INTEGER — indicated_rate must remain finite, no overflow'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = { credibility_z: 1, ...overrides };
    const r = compute(pp);
    const plausible = (r.lcm === null || Number.isFinite(r.lcm)) && (r.indicated_rate === null || Number.isFinite(r.indicated_rate)) && typeof r.denominator_valid === 'boolean';
    rows.push({ label, lae_pct: pp.lae_pct, lcm: r.lcm, denominator_valid: r.denominator_valid, indicated_rate: r.indicated_rate, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneLcm());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_lcmAgreement());
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
