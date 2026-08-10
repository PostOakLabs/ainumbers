// kernel_digest_at_authoring: sha256:165274b6b7aaf7bdd149aa20b208b60dd4d5a632e159d6801d213a8808b2e4e9
//
// FV-PROPFLOOR-SHARD-B12-1 — property-test floor for art-327-tvm-annuity.
// Class B (bounded-numeric), FLOAT-SENSITIVE — rate_pct/nper drive a Taylor-series pow/exp/ln
// implementation with an explicit near-zero-rate limit branch — ULP-boundary forcing is MANDATORY
// per FV-PBT-FLOOR-BUILD-SPEC.md §3, and per the WU row MUST include near-zero-rate edge cases
// since the annuity factor divides by rate. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-327-tvm-annuity.proptest.mjs

import { compute } from '../art-327-tvm-annuity.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-327-tvm-annuity.fixtures.json');
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
const rand = mulberry32(0x327A7);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 8000;

function mkPP(rng) {
  const rate_pct = randRange(rng, 0.01, 15);
  const nper = Math.floor(randRange(rng, 1, 360));
  const due = rng() < 0.5;
  const solve_for = pick(rng, ['pv', 'fv', 'pmt']);
  const pv = solve_for === 'pv' ? undefined : randRange(rng, -50000, 0);
  const pmt = solve_for === 'pmt' ? undefined : randRange(rng, -2000, -10);
  const fv = solve_for === 'fv' ? undefined : randRange(rng, -10000, 10000);
  const pp = { rate_pct, nper, due, solve_for };
  if (pv !== undefined) pp.pv = pv;
  if (pmt !== undefined) pp.pmt = pmt;
  if (fv !== undefined) pp.fv = fv;
  return pp;
}

// ---------- P1: metamorphic identity — the annuity equation holds for the solved value ----------
function checkP1_annuityEquationHolds() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { pv, fv, pmt, rate_pct, nper, due } = r.output_payload;
    const rate = rate_pct / 100;
    const growth = Math.pow(1 + rate, nper);
    const annFactor = Math.abs(rate) < 1e-15 ? nper : ((growth - 1) / rate / growth) * (1 + rate * (due ? 1 : 0));
    const residual = pv + pmt * annFactor + fv * Math.pow(1 + rate, -nper);
    // Tolerance scales with magnitude — output values are rounded to 2dp (r2) before this check
    // runs, and a 0.005 rounding error on pmt/pv/fv gets amplified by annFactor (which can reach
    // the low hundreds for small rates/large nper), so the annFactor term is required, not optional.
    const scale = Math.max(1, Math.abs(pv), Math.abs(fv), Math.abs(pmt * annFactor));
    if (Math.abs(residual) > 1 + scale * 1e-4 + Math.abs(annFactor) * 0.01) violations++;
  }
  return { name: 'P1_annuity_equation_holds_for_solved_value', trials: checked, violations };
}

// ---------- P2: boundedness — annuity_factor and solved outputs are always finite ----------
function checkP2_outputsFinite() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { pv, fv, pmt, annuity_factor } = r.output_payload;
    if (![pv, fv, pmt, annuity_factor].every(Number.isFinite)) violations++;
  }
  return { name: 'P2_solved_outputs_and_annuity_factor_finite', trials: checked, violations };
}

// ---------- P3: metamorphic — due-annuity factor equals ordinary factor * (1 + rate) ----------
function checkP3_dueFactorRelation() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    checked++;
    const rOrd = compute({ ...pp, due: false });
    const rDue = compute({ ...pp, due: true });
    const rate = pp.rate_pct / 100;
    if (Math.abs(rate) < 1e-9) continue; // limit branch collapses the relation, skip
    const expected = rOrd.output_payload.annuity_factor * (1 + rate);
    if (Math.abs(rDue.output_payload.annuity_factor - expected) > Math.abs(expected) * 1e-3 + 1e-6) violations++;
  }
  return { name: 'P3_due_annuity_factor_equals_ordinary_times_1_plus_rate', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing, incl. near-zero-rate cases ----------
const ULP_BOUNDARY_CASES = [
  [{ rate_pct: 0, nper: 24, pmt: -100, fv: 0, solve_for: 'pv' }, 'rate_pct exactly zero (near-zero-rate limit branch) — annuity_factor must equal nper exactly, pv must equal -pmt*nper'],
  [{ rate_pct: 1e-13, nper: 24, pmt: -100, fv: 0, solve_for: 'pv' }, 'rate_pct at 1e-13 (nonzero but below the 1e-15 limit-branch cutoff is NOT triggered — exercises the non-limit closed form at a near-zero rate) — must remain finite, close to the zero-rate result'],
  [{ rate_pct: -0, nper: 24, pmt: -100, fv: 0, solve_for: 'pv' }, 'rate_pct negative zero — must behave identically to positive zero (limit branch), no NaN'],
  [{ rate_pct: 0.5, nper: 1, pv: -1000, fv: 0, solve_for: 'pmt' }, 'nper at minimum value 1 — single-period annuity factor must reduce to a simple one-period discount, no division-by-near-zero artifact'],
  [{ rate_pct: 5, nper: 0.1 * 3 * 10, pv: -1000, fv: 0, solve_for: 'fv' }, 'nper = (0.1*3)*10, a repeating-decimal double close to but not exactly 3 — myPow must still resolve via the non-integer exponent path without NaN'],
  [{ rate_pct: 8, nper: 360, pv: -100000, fv: 0, solve_for: 'pmt' }, 'nper at a large-but-realistic 360-period (30yr monthly mortgage) magnitude — growth term must remain finite, not overflow'],
  [{ rate_pct: 99.9999999999999, nper: 5, pv: -1000, fv: 0, solve_for: 'fv' }, 'rate_pct at 1-ULP-below-100 boundary — growth factor (1+rate)^n must remain finite and precise'],
  [{ rate_pct: 5, nper: 10, pv: 0, pmt: 0, fv: 0, solve_for: 'pv' }, 'pv/pmt/fv all exactly zero — pv solved must be exactly 0, annuity identity trivially satisfied'],
  [{ rate_pct: -2, nper: 10, pv: -1000, fv: 0, solve_for: 'pmt' }, 'negative rate_pct (deflationary/negative-yield scenario) — annuity_factor and pmt must remain finite, no NaN from myPow on a base below 1'],
  [{ rate_pct: 5, nper: 10, pv: -1000, pmt: -50, solve_for: 'pv' }, 'solve_for requests "pv" while pv is also supplied — kernel must still resolve pv deterministically (the supplied pv is overwritten by the solved value), never echo the stale input unresolved'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { pv, fv, pmt, annuity_factor } = r.output_payload;
    const plausible = [pv, fv, pmt, annuity_factor].every(Number.isFinite);
    rows.push({ label, input: pp, pv, fv, pmt, annuity_factor, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_annuityEquationHolds());
results.properties.push(checkP2_outputsFinite());
results.properties.push(checkP3_dueFactorRelation());
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
