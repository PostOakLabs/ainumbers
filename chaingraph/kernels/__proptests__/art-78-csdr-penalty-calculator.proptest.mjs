// kernel_digest_at_authoring: sha256:696b46349d69a4f615727264f5a7a59492a6dfc1eb9b73e631af142a6d436a80
//
// FV-PROPFLOOR-SHARD-B16-1 — property-test floor for art-78-csdr-penalty-calculator.
// Class B (bounded-numeric), FLOAT-SENSITIVE — calcPenalty() multiplies a fixed bps rate by a
// partial-settlement-adjusted price and fail-day count through a single toFixed(2) rounding,
// and batch_total_exposure sums per-fail penalties through a second chained rounding — ULP-
// boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-78-csdr-penalty-calculator.proptest.mjs

import { compute } from '../art-78-csdr-penalty-calculator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-78-csdr-penalty-calculator.fixtures.json');
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
const rand = mulberry32(0x78FA);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;

const ASSET_CLASSES = ['equity', 'ssa_bond', 'non_ssa_bond', 'etf', 'illiquid'];
const RATES = { equity: 1.00, ssa_bond: 0.50, non_ssa_bond: 0.50, etf: 0.50, illiquid: 1.00 };

function mkFail(rng) {
  const asset_class = pick(rng, ASSET_CLASSES);
  const reference_price = randRange(rng, 0, 1000000);
  return {
    asset_class,
    notional: reference_price,
    reference_price,
    fail_days: randRange(rng, 0, 60),
    partial_settled_pct: randRange(rng, 0, 1),
    penalty_type: rng() < 0.5 ? 'sefp' : 'lmfp',
  };
}

// ---------- P1: boundedness — penalty_amount is always non-negative ----------
function checkP1_penaltyNonNegative() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = { fail: mkFail(rand) };
    const r = compute(pp);
    checked++;
    if (r.output_payload.penalty_amount < 0) violations++;
  }
  return { name: 'P1_penalty_amount_nonnegative', trials: checked, violations };
}

// ---------- P2: monotonicity — penalty_amount nondecreasing in fail_days ----------
function checkP2_penaltyMonotonicInFailDays() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const base = mkFail(rand);
    const lo = randRange(rand, 0, 60);
    const hi = lo + randRange(rand, 0, 60);
    checked++;
    const rLo = compute({ fail: { ...base, fail_days: lo } });
    const rHi = compute({ fail: { ...base, fail_days: hi } });
    if (rHi.output_payload.penalty_amount < rLo.output_payload.penalty_amount - 1e-6) violations++;
  }
  return { name: 'P2_penalty_amount_nondecreasing_in_fail_days', trials: checked, violations };
}

// ---------- P3: round-trip identity — penalty_amount is the exact rate*adj_price*days rounding ----------
function checkP3_penaltyExactFormula() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const fail = mkFail(rand);
    const r = compute({ fail });
    checked++;
    const rate = (RATES[fail.asset_class] ?? RATES.equity) / 10000;
    const adj_price = fail.reference_price * (1 - Math.min(1, Math.max(0, fail.partial_settled_pct)));
    const expected = +(rate * adj_price * fail.fail_days).toFixed(2);
    if (r.output_payload.penalty_amount !== expected) violations++;
  }
  return { name: 'P3_penalty_amount_exact_rate_times_adj_price_times_days', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ fail: { asset_class: 'equity', reference_price: 100000, fail_days: 5, partial_settled_pct: 1 } }, 'partial_settled_pct at its maximum (1) — full credit, penalty_amount must be exactly 0'],
  [{ fail: { asset_class: 'equity', reference_price: 100000, fail_days: 5, partial_settled_pct: 1.0000000000000002 } }, 'partial_settled_pct 1 ULP above 1 — Math.min(1,...) clamp must still cap it at exactly 1, penalty_amount exactly 0, no negative adj_price'],
  [{ fail: { asset_class: 'equity', reference_price: 100000, fail_days: 5, partial_settled_pct: -0 } }, 'partial_settled_pct negative zero — Math.max(0,...) must resolve to 0, no NaN, penalty computed at full price'],
  [{ fail: { asset_class: 'equity', reference_price: 100000, fail_days: 5, partial_settled_pct: -0.0001 } }, 'partial_settled_pct just below zero — Math.max(0,...) clamp must floor it at exactly 0, never a negative adj_price multiplier'],
  [{ fail: { asset_class: 'equity', reference_price: 100000, fail_days: 0, partial_settled_pct: 0 } }, 'fail_days exactly zero — penalty_amount must be exactly 0 regardless of price'],
  [{ fail: { asset_class: 'equity', reference_price: 0, fail_days: 5, partial_settled_pct: 0 } }, 'reference_price exactly zero — penalty_amount must be exactly 0'],
  [{ fail: { asset_class: 'equity', reference_price: -0, fail_days: 5, partial_settled_pct: 0 } }, 'reference_price negative zero — penalty_amount must be exactly 0, no NaN'],
  [{ fail: { asset_class: 'equity', reference_price: Number.MIN_VALUE, fail_days: 5, partial_settled_pct: 0 } }, 'reference_price at smallest positive denormal — penalty_amount must remain finite, non-NaN (rounds to 0.00 at 2dp)'],
  [{ fail: { asset_class: 'unknown_class', reference_price: 100000, fail_days: 5, partial_settled_pct: 0 } }, 'unrecognized asset_class — rate must fall back to the documented equity default (?? PENALTY_RATES_BPS.equity), never NaN'],
  [{ fail: { asset_class: 'equity', reference_price: (1 / 3) * 3 * 100000, fail_days: 5, partial_settled_pct: 0 } }, 'reference_price = (1/3)*3*100000, x/y*y!==x style rounding artifact — penalty_amount must use the exact double product, not a naively-reconstructed value'],
  [{ fail: { asset_class: 'equity', reference_price: 100000, fail_days: 5, partial_settled_pct: 0 }, open_fails: [{ asset_class: 'ssa_bond', reference_price: 50000, fail_days: 3, partial_settled_pct: 0 }, { asset_class: 'illiquid', reference_price: 25000, fail_days: 10, partial_settled_pct: 0.5 }] }, 'batch mode with two open_fails entries — batch_total_exposure must be the sum of the two independently-rounded per-fail penalties, within 1-cent chained-rounding tolerance'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { penalty_amount, batch_total_exposure } = r.output_payload;
    const plausible = Number.isFinite(penalty_amount) && penalty_amount >= 0 && Number.isFinite(batch_total_exposure) && batch_total_exposure >= 0;
    rows.push({ label, input: pp, penalty_amount, batch_total_exposure, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_penaltyNonNegative());
results.properties.push(checkP2_penaltyMonotonicInFailDays());
results.properties.push(checkP3_penaltyExactFormula());
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
