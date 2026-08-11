// art-543-csdr-penalty-recompute.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C28-1).
// kernel_digest_at_authoring: sha256:b2b0ccaae79b05facefac2e7c9a2294abd353bd1978a163471dc45d28a8ed371
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (matches the WU row, direct read confirms). gross_penalty =
// daily_rate_bps/10000 * reference_price * quantity * fail_days is a real IEEE-754 division
// followed by a multiplication chain with ZERO rounding applied anywhere in the file (no r2/r4
// helper exists in this kernel) -- the shipped golden fixture itself already carries visible
// float noise (gross_penalty: 12312.500000000002), confirming genuine accumulation error.
// penalty_amount = gross_penalty - partial_credit is a subtraction of two derived floats
// (catastrophic-cancellation shape when partial_settled_pct is near 1). ULP-boundary forcing is
// mandatory around the arithmetic chain itself (no threshold/branch depends on the float value,
// but boundedness/finiteness of the accumulated result is exactly what a floor must check).
// Checks: fixture-oracle gate, termination (determinations bounded by open_fails.length, never
// exceeding it since some fails may be rejected), boundedness (total_penalty_exposure always
// finite for finite inputs), differential re-derivation of gross_penalty/partial_credit/
// penalty_amount/total_penalty_exposure, permutation-invariance of open_fails order (bounded
// tolerance on the summed total, per the same non-associative-float-sum caveat as art-541), the
// rate_table_version kill-condition forced categorical case, and ULP-boundary forcing (0,
// negative zero, denormal reference_price/quantity, partial_settled_pct exactly 0 and 1
// boundaries, x/y*y!==x-shaped daily_rate_bps chain).
// Zero external dependencies -- pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-543-csdr-penalty-recompute.proptest.mjs

import { compute } from '../art-543-csdr-penalty-recompute.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };
const RATE_TABLE_VERSION = 'CSDR-RTS-2025-10';
const RATE_TABLE = {
  equity: { sefp: 1.0, lmfp: 0.5, csdp: 0.5 },
  ssa_bond: { sefp: 0.5, lmfp: 0.25, csdp: 0.25 },
  non_ssa_bond: { sefp: 0.5, lmfp: 0.25, csdp: 0.25 },
  other: { sefp: 0.5, lmfp: 0.5, csdp: 0.5 },
};

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-543-csdr-penalty-recompute.fixtures.json');
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
const rand = mulberry32(0x54300028);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const ASSET_CLASSES = Object.keys(RATE_TABLE);
const PENALTY_TYPES = ['sefp', 'lmfp', 'csdp'];

function randomFail(rng, i) {
  return {
    fail_id: `F${i}`,
    isin: `ISIN-${i}`,
    asset_class: pick(rng, ASSET_CLASSES),
    penalty_type: pick(rng, PENALTY_TYPES),
    reference_price: Math.floor(rng() * 1000000) / 100,
    quantity: Math.floor(rng() * 100000),
    fail_days: Math.floor(rng() * 30),
    partial_settled_pct: Math.floor(rng() * 101) / 100,
  };
}
function randomPP(rng) {
  const n = Math.floor(rng() * 10);
  return {
    recompute_id: 'PBT-TEST',
    rate_table_version: RATE_TABLE_VERSION,
    open_fails: Array.from({ length: n }, (_, i) => randomFail(rng, i)),
  };
}

const TRIALS = 3000;

// ---------- P1: termination -- determinations never exceed open_fails.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.determinations.length > pp.open_fails.length) violations++;
    if (output_payload.fail_count !== output_payload.determinations.length) violations++;
  }
  return { name: 'P1_determinations_bounded_by_open_fails_length', trials: checked, violations };
}

// ---------- P2: boundedness -- total_penalty_exposure always finite for finite inputs ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (!Number.isFinite(output_payload.total_penalty_exposure)) violations++;
    for (const d of output_payload.determinations) {
      if (!Number.isFinite(d.gross_penalty) || !Number.isFinite(d.partial_credit) || !Number.isFinite(d.penalty_amount)) violations++;
      if (d.penalty_amount < -1e-6) violations++; // penalty never goes meaningfully negative
    }
  }
  return { name: 'P2_penalty_amounts_finite_and_nonnegative', trials: checked, violations };
}

// ---------- P3 (differential): gross_penalty/partial_credit/penalty_amount/total re-derived ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    let expectedTotal = 0;
    for (const d of output_payload.determinations) {
      const rate = RATE_TABLE[d.asset_class][d.penalty_type];
      const gross = rate / 10000 * d.reference_price * d.quantity * d.fail_days;
      const credit = gross * d.partial_settled_pct;
      const amount = gross - credit;
      if (d.daily_rate_bps !== rate) violations++;
      if (d.gross_penalty !== gross) violations++;
      if (d.partial_credit !== credit) violations++;
      if (d.penalty_amount !== amount) violations++;
      expectedTotal += amount;
    }
    if (output_payload.total_penalty_exposure !== expectedTotal) violations++;
  }
  return { name: 'P3_penalty_arithmetic_differential', trials: checked, violations };
}

// ---------- P4: metamorphic -- permutation-invariance of open_fails order (tolerant total) ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1200; i++) {
    const pp = randomPP(rand);
    if (pp.open_fails.length < 2) continue;
    const shuffled = { ...pp, open_fails: [...pp.open_fails].sort(() => rand() - 0.5) };
    const r1 = compute(pp).output_payload;
    const r2v = compute(shuffled).output_payload;
    checked++;
    if (r1.fail_count !== r2v.fail_count) violations++;
    // Floating-point summation is not associative; tolerate the ULP-scale drift a reordered
    // reduce() can introduce rather than asserting bit-exact equality (same shape as art-541's
    // documented avg_price_improvement_bps caveat, scaled to this kernel's larger magnitudes).
    const relTol = Math.max(1e-6, Math.abs(r1.total_penalty_exposure) * 1e-9);
    if (Math.abs(r1.total_penalty_exposure - r2v.total_penalty_exposure) > relTol) violations++;
  }
  return { name: 'P4_open_fails_order_invariance_tolerant_total', trials: checked, violations };
}

// ---------- P5: forced categorical -- rate_table_version kill condition ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  // missing rate_table_version -> did_not_run, zero exposure, never a division artifact
  checked++;
  {
    const r = compute({ recompute_id: 'X', open_fails: [{ fail_id: 'F1', isin: 'I1', asset_class: 'equity', penalty_type: 'sefp', reference_price: 100, quantity: 10, fail_days: 1 }] }).output_payload;
    if (r.decision.execution_state !== 'did_not_run' || r.total_penalty_exposure !== 0) violations++;
  }
  // empty open_fails -> vacuous pass, ran, zero exposure (distinct from the kill condition)
  checked++;
  {
    const r = compute({ recompute_id: 'X', rate_table_version: RATE_TABLE_VERSION, open_fails: [] }).output_payload;
    if (r.decision.execution_state !== 'ran' || r.total_penalty_exposure !== 0 || r.fail_count !== 0) violations++;
  }
  // no rate for asset_class/penalty_type combo -> rejected, never priced
  checked++;
  {
    const r = compute({ recompute_id: 'X', rate_table_version: RATE_TABLE_VERSION, open_fails: [{ fail_id: 'F1', isin: 'I1', asset_class: 'unknown_class', penalty_type: 'sefp', reference_price: 100, quantity: 10, fail_days: 1 }] }).output_payload;
    if (r.fail_count !== 0 || r.rejected_inputs.length !== 1) violations++;
  }
  return { name: 'P5_forced_categorical_rate_table_kill_condition', trials: checked, violations };
}

// ---------- P6: ULP-boundary forcing around the gross_penalty arithmetic chain ----------
function checkP6_ulp_boundary_forcing() {
  let violations = 0, checked = 0;
  const mk = (fail) => ({ recompute_id: 'X', rate_table_version: RATE_TABLE_VERSION, open_fails: [{ fail_id: 'F1', isin: 'I1', asset_class: 'equity', penalty_type: 'sefp', ...fail }] });

  // partial_settled_pct === 0 -> full penalty, zero credit
  checked++;
  {
    const r = compute(mk({ reference_price: 100, quantity: 10, fail_days: 1, partial_settled_pct: 0 })).output_payload;
    const d = r.determinations[0];
    if (d.partial_credit !== 0 || d.penalty_amount !== d.gross_penalty) violations++;
  }
  // partial_settled_pct === 1 -> full credit, penalty_amount === 0 (catastrophic-cancellation shape)
  checked++;
  {
    const r = compute(mk({ reference_price: 98.5, quantity: 500000, fail_days: 5, partial_settled_pct: 1 })).output_payload;
    const d = r.determinations[0];
    if (Math.abs(d.penalty_amount) > 1e-6) violations++;
  }
  // denormal reference_price -> never throws, never NaN/Infinity
  checked++;
  {
    const r = compute(mk({ reference_price: Number.MIN_VALUE, quantity: 100, fail_days: 1, partial_settled_pct: 0 })).output_payload;
    if (!Number.isFinite(r.determinations[0].gross_penalty)) violations++;
  }
  // negative-zero reference_price -> treated as zero (>=0 check passes for -0)
  checked++;
  {
    const r = compute(mk({ reference_price: -0, quantity: 100, fail_days: 1, partial_settled_pct: 0 })).output_payload;
    if (r.determinations.length !== 1 || r.determinations[0].gross_penalty !== 0) violations++;
  }
  // fail_days === 0 -> zero penalty, never a division artifact
  checked++;
  {
    const r = compute(mk({ reference_price: 100, quantity: 10, fail_days: 0, partial_settled_pct: 0 })).output_payload;
    if (r.determinations[0].gross_penalty !== 0) violations++;
  }
  // x/y*y !== x shaped reference_price -> resolves finite, never throws
  checked++;
  {
    const x = 0.1, y = 3;
    const derived = (x / y) * y;
    const r = compute(mk({ reference_price: 100 + (derived - x), quantity: 1000, fail_days: 2, partial_settled_pct: 0.4 })).output_payload;
    if (!Number.isFinite(r.determinations[0].penalty_amount)) violations++;
  }
  return { name: 'P6_ulp_boundary_forcing_gross_penalty_chain', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_permutation_invariance());
results.properties.push(checkP5_forced_categorical());
results.properties.push(checkP6_ulp_boundary_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-543-csdr-penalty-recompute',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
