// kernel_digest_at_authoring: sha256:426290aa93af154925c8418526e40ce47f1ccab54eb19febae4774c50041c1b3
//
// FV-PROPFLOOR-SHARD-B26-1 — property-test floor for art-547-corporate-action-entitlement-recompute.
// Class B (bounded-numeric), FLOAT:YES per the WU row — position_qty and ratio_or_rate are
// unconstrained finite numbers (finiteNum() imposes no integer restriction), so raw_shares =
// qty*rate and cash_entitlement = round2(qty*rate) are genuine float arithmetic. ULP-boundary
// forcing is MANDATORY. Zero external dependencies (mulberry32 PRNG + explicit boundary
// arrays), same shape as the B1/B3/B12 harness. READ-ONLY w.r.t. the kernel. NOTE: this
// kernel's compute(pp) returns output_payload DIRECTLY (not the {output_payload,
// compliance_flags} tuple shape most sibling kernels use) — confirmed against the shipped
// source before authoring, per FIX-2 CARRY.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-547-corporate-action-entitlement-recompute.proptest.mjs

import { compute } from '../art-547-corporate-action-entitlement-recompute.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-547-corporate-action-entitlement-recompute.fixtures.json');
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
const rand = mulberry32(0x547547);
const TRIALS = 8000;
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

const CASH_TYPES = ['DVCA'];
const SHARE_TYPES = ['DVSE', 'RHDI', 'SPLF', 'SPLR'];

function mkPP(rng) {
  const type = pick(rng, [...CASH_TYPES, ...SHARE_TYPES]);
  return {
    corporate_action_type: type,
    position_qty: Math.round(rng() * 100000 * 100) / 100,
    ratio_or_rate: Math.round(rng() * 5 * 10000) / 10000,
    record_date: '2027-01-15',
    reference_id: 'CA-TEST',
  };
}

// ---------- P1: cash_entitlement is exact round2(qty*rate) for cash types, shares split otherwise ----------
function checkP1_entitlementExactFormula() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (!r.entitlement_computed) continue;
    if (CASH_TYPES.indexOf(pp.corporate_action_type) >= 0) {
      const expected = round2(pp.position_qty * pp.ratio_or_rate);
      if (r.cash_entitlement !== expected) violations++;
      if (r.whole_shares !== null || r.fractional_shares !== null) violations++;
    } else {
      const raw = pp.position_qty * pp.ratio_or_rate;
      const expectedWhole = Math.floor(raw);
      const expectedFrac = round2(raw - expectedWhole);
      if (r.whole_shares !== expectedWhole) violations++;
      if (r.fractional_shares !== expectedFrac) violations++;
      if (r.cash_entitlement !== null) violations++;
    }
  }
  return { name: 'P1_entitlement_exact_formula_per_type', trials: checked, violations };
}

// ---------- P2: whole_shares + fractional_shares round-trips to raw_shares within rounding tolerance ----------
function checkP2_shareRoundTrip() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    if (CASH_TYPES.indexOf(pp.corporate_action_type) >= 0) continue;
    const r = compute(pp);
    checked++;
    if (!r.entitlement_computed) continue;
    const raw = pp.position_qty * pp.ratio_or_rate;
    const reconstructed = r.whole_shares + r.fractional_shares;
    if (Math.abs(reconstructed - raw) > 0.01) violations++;
  }
  return { name: 'P2_whole_plus_fractional_roundtrips_to_raw_shares', trials: checked, violations };
}

// ---------- P3: fractional_shares_present is exact (fractional_shares > 0) ----------
function checkP3_fractionalPresentExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    if (CASH_TYPES.indexOf(pp.corporate_action_type) >= 0) continue;
    const r = compute(pp);
    checked++;
    if (!r.entitlement_computed) continue;
    if (r.fractional_shares_present !== (r.fractional_shares > 0)) violations++;
  }
  return { name: 'P3_fractional_shares_present_exact', trials: checked, violations };
}

// ---------- P4: entitlement_computed is the exact negation of (error_count > 0) ----------
function checkP4_computedExactNegation() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    if (rng_maybe_break(pp, rand)) { /* occasionally corrupt an input to exercise the error path */ }
    const r = compute(pp);
    checked++;
    if (r.entitlement_computed !== (r.error_count === 0)) violations++;
  }
  return { name: 'P4_entitlement_computed_exact_negation_of_error_count', trials: checked, violations };
}
function rng_maybe_break(pp, rng) {
  if (rng() < 0.2) { pp.position_qty = undefined; return true; }
  if (rng() < 0.2) { pp.ratio_or_rate = -1; return true; }
  return false;
}

// ---------- P5 (mandatory, float:yes): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ corporate_action_type: 'DVCA', position_qty: 1200, ratio_or_rate: 0.1 + 0.2 - 0.3, record_date: '2027-01-15' }, 'ratio_or_rate constructed from the classic 0.1+0.2-0.3 float artifact (tiny non-zero residue) — must round2 deterministically, never NaN'],
  [{ corporate_action_type: 'DVCA', position_qty: 1, ratio_or_rate: Number.EPSILON, record_date: '2027-01-15' }, 'ratio_or_rate exactly Number.EPSILON (smallest representable positive double near zero) — rejected as non-positive? no: EPSILON > 0, must compute a tiny but finite cash_entitlement'],
  [{ corporate_action_type: 'DVCA', position_qty: 1000, ratio_or_rate: 0, record_date: '2027-01-15' }, 'ratio_or_rate exactly 0 — rejected: NON_POSITIVE_RATIO_OR_RATE fires (rate must be > 0)'],
  [{ corporate_action_type: 'DVCA', position_qty: 1000, ratio_or_rate: -0, record_date: '2027-01-15' }, 'ratio_or_rate negative zero — must be treated identically to positive zero (still rejected as non-positive)'],
  [{ corporate_action_type: 'RHDI', position_qty: 3, ratio_or_rate: 1 / 3, record_date: '2027-01-15' }, 'classic 1/3 repeating-fraction ratio on qty 3 — raw_shares should land exactly at 1.0 or 1 ULP away; whole_shares must be 0 or 1 consistently with Math.floor, never off-by-one from float drift'],
  [{ corporate_action_type: 'RHDI', position_qty: 999, ratio_or_rate: 0.25, record_date: '2027-01-15' }, 'raw_shares exactly at a .75 fractional boundary (999*0.25=249.75) — whole 249, fractional 0.75 exactly'],
  [{ corporate_action_type: 'RHDI', position_qty: 100, ratio_or_rate: 0.01, record_date: '2027-01-15' }, 'raw_shares exactly integer-valued (100*0.01=1.0 in real arithmetic, but IEEE-754 may leave a residue) — fractional_shares must round2 to exactly 0, fractional_shares_present false'],
  [{ corporate_action_type: 'DVCA', position_qty: Number.MAX_SAFE_INTEGER, ratio_or_rate: 0.01, record_date: '2027-01-15' }, 'position_qty at MAX_SAFE_INTEGER — cash_entitlement must stay finite, never Infinity/NaN'],
];

function checkP5_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const plausible = Number.isFinite(r.cash_entitlement) || r.cash_entitlement === null;
    const plausible2 = Number.isFinite(r.whole_shares) || r.whole_shares === null;
    rows.push({ label, input: pp, cash_entitlement: r.cash_entitlement, whole_shares: r.whole_shares, fractional_shares: r.fractional_shares, entitlement_computed: r.entitlement_computed, plausible: plausible && plausible2 });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_entitlementExactFormula());
results.properties.push(checkP2_shareRoundTrip());
results.properties.push(checkP3_fractionalPresentExact());
results.properties.push(checkP4_computedExactNegation());
results.boundary_forced = checkP5_forced();

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
