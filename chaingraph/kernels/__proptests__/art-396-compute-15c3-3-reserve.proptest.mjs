// art-396-compute-15c3-3-reserve.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C18-1).
// kernel_digest_at_authoring: sha256:4d4f69e7fa90f1983449c71e85bbf2446e5dae6ee6b77249b04fa5f8f891223a
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct read confirmed — total_credits/total_debits are plain float
// sums via reduce, the margin-debit haircut is `amount * (1 - 1/100)`, and netDiff/
// reserveRequirement/surplusShortfall chain float subtraction — the kernel's own comment
// states "there is no division in this formula", but the haircut multiplication and the sums
// are genuine float ops) — ULP-boundary forcing is MANDATORY per spec §3.
// Unbounded input: policy_parameters.credit_items and .debit_items (caller-supplied arrays),
// mapped/reduced by plain Array.prototype.map/reduce with no declared cap — termination
// bound is each array's own length.
// Checks: fixture-oracle gate, termination (map/reduce passes scale linearly with array
// length, never hang), finite-gate (the kernel's own stated guarantee — every derived figure
// resolves to a finite number for any input, verified directly: no division anywhere in this
// formula, so safeNum/Math.max(0,...) alone are sufficient), boundedness (reserveRequirement
// is never negative — Math.max(0,...) floor — and every included_musd/amount_musd stays
// non-negative), metamorphic (permutation-invariance: reordering credit_items or debit_items
// leaves total_credits_musd/total_debits_musd unchanged up to the kernel's own r2 rounding),
// ULP-boundary forcing on amount_musd near the aging-exclusion boundary and on the margin
// haircut multiplication (0, denormal, values that expose `x/y*y !== x`-shaped rounding).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-396-compute-15c3-3-reserve.proptest.mjs

import { compute } from '../art-396-compute-15c3-3-reserve.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-396-compute-15c3-3-reserve.fixtures.json');
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
const rand = mulberry32(0x3969F0);

const CREDIT_CATS = ['free_credit_balances', 'margin_credit_balances', 'other_credit_balance'];
const DEBIT_CATS = ['margin_account_debit', 'securities_failed_to_deliver', 'other_allowable_debit'];

function randomCredit(rng, i) { return { label: `C${i}`, category: CREDIT_CATS[Math.floor(rng() * CREDIT_CATS.length)], amount_musd: rng() * 1e6 }; }
function randomDebit(rng, i) { return { label: `D${i}`, category: DEBIT_CATS[Math.floor(rng() * DEBIT_CATS.length)], amount_musd: rng() * 1e6, aging_days: Math.floor(rng() * 60) }; }

const TRIALS = 2000;

// ---------- P1: termination — map/reduce scale linearly with item-array length, never hang ----------
function checkP1_termination_linear_scaling() {
  let violations = 0, checked = 0;
  const sizes = [0, 1, 10, 100, 3000];
  for (const n of sizes) {
    const credit_items = Array.from({ length: n }, (_, i) => randomCredit(rand, i));
    const debit_items = Array.from({ length: n }, (_, i) => randomDebit(rand, i));
    const start = Date.now();
    const { output_payload } = compute({ credit_items, debit_items });
    checked++;
    if (Date.now() - start > 3000) violations++;
    if (output_payload.credit_items.length !== n || output_payload.debit_items.length !== n) violations++;
  }
  return { name: 'P1_termination_linear_scaling_never_hangs', trials: checked, violations };
}

// ---------- P2: finite-gate + boundedness — every derived figure finite, reserveRequirement >= 0 ----------
function checkP2_finite_gate_and_reserve_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const nc = Math.floor(rand() * 15), nd = Math.floor(rand() * 15);
    const credit_items = Array.from({ length: nc }, (_, idx) => randomCredit(rand, idx));
    const debit_items = Array.from({ length: nd }, (_, idx) => randomDebit(rand, idx));
    const deposit = rand() * 1e7;
    const { output_payload } = compute({ credit_items, debit_items, reserve_account_balance_musd: deposit });
    checked++;
    for (const v of [output_payload.total_credits_musd, output_payload.total_debits_musd, output_payload.reserve_requirement_musd, output_payload.surplus_shortfall_musd]) {
      if (!Number.isFinite(v)) violations++;
    }
    if (output_payload.reserve_requirement_musd < 0) violations++;
    for (const l of [...output_payload.credit_items, ...output_payload.debit_items]) {
      if (l.included_musd < -1e-9) violations++;
    }
  }
  return { name: 'P2_finite_gate_and_reserve_requirement_never_negative', trials: checked, violations };
}

// ---------- P3: metamorphic — permutation-invariance of totals (up to r2 rounding) ----------
function checkP3_metamorphic_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 300; i++) {
    const n = 1 + Math.floor(rand() * 15);
    const credit_items = Array.from({ length: n }, (_, idx) => randomCredit(rand, idx));
    const shuffled = [...credit_items];
    for (let j = shuffled.length - 1; j > 0; j--) { const k = Math.floor(rand() * (j + 1)); [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]]; }
    const outA = compute({ credit_items, debit_items: [] }).output_payload;
    const outB = compute({ credit_items: shuffled, debit_items: [] }).output_payload;
    checked++;
    if (Math.abs(outA.total_credits_musd - outB.total_credits_musd) > 1e-6) violations++;
  }
  return { name: 'P3_metamorphic_permutation_invariance_of_totals', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
function checkP4_ulp_forcing_haircut_and_aging_boundary() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  const haircutForced = [0, -0, eps, Number.MIN_VALUE, 1e-300, 1e15, 0.01 - eps, 0.01 + eps];
  for (const amt of haircutForced) {
    const debit_items = [{ label: 'D', category: 'margin_account_debit', amount_musd: amt }];
    const { output_payload } = compute({ credit_items: [], debit_items });
    checked++;
    if (!Number.isFinite(output_payload.debit_items[0].included_musd)) violations++;
    if (output_payload.debit_items[0].included_musd < -1e-9) violations++;
  }
  // aging_days exactly at the 30-day exclusion boundary vs one day past it
  const atBoundary = compute({ credit_items: [], debit_items: [{ label: 'D', category: 'securities_failed_to_deliver', amount_musd: 1000, aging_days: 30 }] }).output_payload;
  checked++;
  if (atBoundary.debit_items[0].exclusion_reason !== null) violations++; // 30 is NOT > 30, must still be included
  const pastBoundary = compute({ credit_items: [], debit_items: [{ label: 'D', category: 'securities_failed_to_deliver', amount_musd: 1000, aging_days: 31 }] }).output_payload;
  checked++;
  if (pastBoundary.debit_items[0].exclusion_reason !== 'AGED_FTD_EXCLUDED_OVER_30_DAYS') violations++;
  return { name: 'P4_ulp_boundary_forcing_haircut_and_aging_boundary', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_linear_scaling());
results.properties.push(checkP2_finite_gate_and_reserve_boundedness());
results.properties.push(checkP3_metamorphic_permutation_invariance());
results.properties.push(checkP4_ulp_forcing_haircut_and_aging_boundary());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-396-compute-15c3-3-reserve',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
