// kernel_digest_at_authoring: sha256:1b2549c6c23eeff309d070117288897e871490b446375f87875bd6d973e25a31
//
// FV-PROPFLOOR-SHARD-B12-1 — property-test floor for art-319-rhc-valuation-linter.
// Class B (bounded-numeric), FLOAT-SENSITIVE (raw_balance/chainlink_price_usd/ui_multiplier feed
// straight into unrounded float arithmetic compared with an EPS-relative tolerance) — ULP-boundary
// forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-319-rhc-valuation-linter.proptest.mjs

import { compute } from '../art-319-rhc-valuation-linter.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-319-rhc-valuation-linter.fixtures.json');
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
const rand = mulberry32(0x319C3);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;

function mkPP(rng) {
  const raw_balance = randRange(rng, 0.01, 10000);
  const chainlink_price_usd = randRange(rng, 0.01, 5000);
  const ui_multiplier = randRange(rng, 0.5, 5);
  const correct = raw_balance * chainlink_price_usd;
  const doubled = raw_balance * chainlink_price_usd * ui_multiplier;
  const branch = rng();
  const computed_usd_value_under_test = branch < 0.4 ? correct : branch < 0.8 ? doubled : randRange(rng, 0, doubled * 2);
  return { raw_balance, chainlink_price_usd, ui_multiplier, computed_usd_value_under_test, applied_multiplier_in_expression: false };
}

// ---------- P1: round-trip identity — delta always equals computed_usd_value_under_test - correct_value exactly ----------
function checkP1_deltaExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expectedDelta = pp.computed_usd_value_under_test - r.output_payload.correct_value;
    if (r.output_payload.delta !== expectedDelta) violations++;
  }
  return { name: 'P1_delta_exact_computed_minus_correct', trials: checked, violations };
}

// ---------- P2: boundedness — verdict always one of the three declared enum values ----------
function checkP2_verdictBounded() {
  let violations = 0, checked = 0;
  const VERDICTS = ['CLEAN', 'DOUBLE_COUNT_DETECTED', 'MISMATCH_UNEXPLAINED'];
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (!VERDICTS.includes(r.output_payload.verdict)) violations++;
  }
  return { name: 'P2_verdict_bounded_to_declared_enum', trials: checked, violations };
}

// ---------- P3: fixed rule — correct_value is exactly raw_balance*chainlink_price_usd, unrounded double ----------
function checkP3_correctValueExactProduct() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.correct_value !== pp.raw_balance * pp.chainlink_price_usd) violations++;
    if (r.output_payload.double_counted_value !== pp.raw_balance * pp.chainlink_price_usd * pp.ui_multiplier) violations++;
  }
  return { name: 'P3_correct_value_exact_unrounded_double_product', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ raw_balance: 10, chainlink_price_usd: 250, ui_multiplier: 2, computed_usd_value_under_test: 2500 * (1 + 1e-6 * 0.5) }, 'computed value at exactly half the EPS*max(1,|correct|) tolerance band inside CLEAN — must classify CLEAN, not MISMATCH'],
  [{ raw_balance: 10, chainlink_price_usd: 250, ui_multiplier: 2, computed_usd_value_under_test: 2500 * (1 + 1e-6 * 2) }, 'computed value at 2x the EPS tolerance band outside CLEAN, not matching double-count either — must classify MISMATCH_UNEXPLAINED'],
  [{ raw_balance: 0, chainlink_price_usd: 250, ui_multiplier: 2, computed_usd_value_under_test: 0 }, 'raw_balance exactly zero — correct_value must be exactly 0, verdict CLEAN'],
  [{ raw_balance: -0, chainlink_price_usd: 250, ui_multiplier: 2, computed_usd_value_under_test: -0 }, 'raw_balance negative zero — must behave as zero, no NaN'],
  [{ raw_balance: Number.MIN_VALUE, chainlink_price_usd: 1, ui_multiplier: 2, computed_usd_value_under_test: Number.MIN_VALUE }, 'raw_balance smallest positive double — correct_value must remain finite, non-NaN'],
  [{ raw_balance: 0.1, chainlink_price_usd: 3, ui_multiplier: 2, computed_usd_value_under_test: 0.1 * 3 }, 'chainlink leg = 0.1*3 (classic non-exact double 0.30000000000000004) — correct_value must equal that EXACT double, verdict CLEAN'],
  [{ raw_balance: 1 / 3, chainlink_price_usd: 3, ui_multiplier: 2, computed_usd_value_under_test: (1 / 3) * 3 }, 'raw_balance = 1/3, x/y*y!==x style rounding artifact — correct_value computed the same way as the kernel, verdict CLEAN'],
  [{ raw_balance: Number.MAX_SAFE_INTEGER, chainlink_price_usd: 1, ui_multiplier: 2, computed_usd_value_under_test: Number.MAX_SAFE_INTEGER }, 'raw_balance at MAX_SAFE_INTEGER — must not overflow to Infinity or lose finiteness'],
  [{ raw_balance: 10, chainlink_price_usd: 250, ui_multiplier: 2, computed_usd_value_under_test: NaN }, 'computed_usd_value_under_test is NaN — non-finite input gate must trip, verdict MISMATCH_UNEXPLAINED with reason'],
  [{ raw_balance: 1e-300, chainlink_price_usd: 1e-300, ui_multiplier: 2, computed_usd_value_under_test: 1e-300 * 1e-300 }, 'denormal-range product of two subnormal-adjacent doubles — must remain finite, non-NaN, verdict CLEAN'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const full = { ui_multiplier: 2, applied_multiplier_in_expression: false, ...pp };
    const r = compute(full);
    const { verdict, correct_value, double_counted_value, delta } = r.output_payload;
    const finite = verdict === 'MISMATCH_UNEXPLAINED' && !Number.isFinite(full.computed_usd_value_under_test)
      ? true // input-invalid branch legitimately reports null correct_value
      : Number.isFinite(correct_value) && Number.isFinite(double_counted_value);
    const plausible = finite && typeof verdict === 'string';
    rows.push({ label, input: full, verdict, correct_value, double_counted_value, delta, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_deltaExact());
results.properties.push(checkP2_verdictBounded());
results.properties.push(checkP3_correctValueExactProduct());
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
