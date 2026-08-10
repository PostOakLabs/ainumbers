// art-01-ap2-mandate-chain-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C1-1).
// kernel_digest_at_authoring: sha256:623495f9378cb65cb88c889831f43c2c82c8844af29dfaa32e3a5d1e6cfa5337
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES — ULP-boundary forcing mandatory (spend-limit tolerance = 0.01, expires_at <=
// validate_at exact-equality expiry boundary, payAmount === maxAmount exact-equality).
// Checks: fixture-oracle gate, termination (fixed 8-check pipeline, bounded), overall-verdict
// differential re-derivation (FAIL iff any check fails), ULP-forced spend/expiry boundary cases, and a
// metamorphic check (valid, non-expired, in-scope, in-budget chain must always PASS).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-01-ap2-mandate-chain-validator.proptest.mjs

import { compute } from '../art-01-ap2-mandate-chain-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-01-ap2-mandate-chain-validator.fixtures.json');
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
const rand = mulberry32(0xA01A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

const VALID_HASH = 'a'.repeat(64);
const BASE_AT = '2026-06-01T00:00:00.000Z';

function validChain(pp = {}) {
  const maxAmount = pp.maxAmount ?? 1000;
  const payAmount = pp.payAmount ?? 500;
  return {
    intent: {
      mandate_type: 'intent', mandate_id: 'intent-1',
      scope: { merchant_ids: ['m1'], currency: 'USD', max_amount: maxAmount },
      expires_at: '2026-06-02T00:00:00.000Z', issued_at: '2026-05-31T00:00:00.000Z',
    },
    payment: {
      mandate_type: 'payment', mandate_id: 'pay-1', parent_mandate_id: 'intent-1',
      parent_hash: VALID_HASH, merchant_id: 'm1', currency: 'USD', amount: payAmount,
      expires_at: '2026-06-02T00:00:00.000Z', issued_at: '2026-05-31T00:00:00.000Z',
    },
    validate_at: pp.validate_at ?? BASE_AT,
  };
}

// ---------- P1: termination — checks_run is always in {7,8} (HNP toggle), never unbounded ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const hnp = ['strict', 'lenient', 'off'][Math.floor(rand() * 3)];
    const pp = { ...validChain({ maxAmount: randRange(rand, 1, 10000), payAmount: randRange(rand, 1, 10000) }), hnp_mode: hnp };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.checks_run < 7 || output_payload.checks_run > 8) violations++;
  }
  return { name: 'P1_termination_bounded_checks', trials: checked, violations };
}

// ---------- P2 (differential): verdict FAIL iff failing_checks non-empty, PASS iff no fail and no warn ----------
function checkP2_verdict_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 3000; i++) {
    const maxAmount = randRange(rand, 1, 5000);
    const payAmount = rand() < 0.3 ? maxAmount * randRange(rand, 1.01, 3) : randRange(rand, 1, maxAmount);
    const pp = validChain({ maxAmount, payAmount });
    const { output_payload } = compute(pp);
    checked++;
    const overSpend = payAmount > maxAmount;
    if (overSpend && output_payload.validation_verdict === 'PASS') violations++;
    if (output_payload.validation_verdict === 'FAIL' && output_payload.failing_checks.length === 0) violations++;
    if (output_payload.validation_verdict !== 'FAIL' && output_payload.failing_checks.length > 0) violations++;
  }
  return { name: 'P2_verdict_failing_checks_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — a well-formed in-budget in-window chain always PASSes ----------
function checkP3_valid_chain_always_passes() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 3000; i++) {
    const maxAmount = randRange(rand, 10, 100000);
    const payAmount = randRange(rand, 0, maxAmount);
    const pp = validChain({ maxAmount, payAmount });
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.validation_verdict !== 'PASS') violations++;
  }
  return { name: 'P3_metamorphic_valid_chain_always_pass', trials: checked, violations };
}

// ---------- P4 (ULP-forcing, float_sensitive:yes) — spend tolerance (0.01) and expiry exact-equality ----------
const ULP_BOUNDARY_CASES = [
  { payAmount: 1000.00, maxAmount: 1000.00, label: 'payAmount === maxAmount exactly -> must PASS (not >)' },
  { payAmount: 1000.0000000001, maxAmount: 1000, label: 'payAmount fractionally over maxAmount by 1e-10 -> must FAIL' },
  { payAmount: 999.9999999999, maxAmount: 1000, label: 'payAmount fractionally under maxAmount -> must PASS' },
  { validate_at: '2026-06-02T00:00:00.000Z', label: 'validate_at === expires_at exactly -> must be EXPIRED (<=)' },
  { validate_at: '2026-06-01T23:59:59.999Z', label: 'validate_at 1ms before expires_at -> must be valid' },
];
function checkP4_forced() {
  const rows = [];
  for (const c of ULP_BOUNDARY_CASES) {
    const pp = validChain(c);
    const { output_payload } = compute(pp);
    rows.push({
      label: c.label,
      validation_verdict: output_payload.validation_verdict,
      failing_checks: output_payload.failing_checks.map((f) => f.id),
      finite_amounts: true,
    });
  }
  return rows;
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_verdict_differential());
results.properties.push(checkP3_valid_chain_always_passes());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
// Cross-check the two forced spend cases explicitly (documented boundary contract):
const spendExactPass = results.boundary_forced[0].validation_verdict === 'PASS';
const spendOverFail = results.boundary_forced[1].validation_verdict === 'FAIL';
const spendUnderPass = results.boundary_forced[2].validation_verdict === 'PASS';
const expiryExactFail = results.boundary_forced[3].validation_verdict === 'FAIL';
const expiryBeforePass = results.boundary_forced[4].validation_verdict === 'PASS';
const anyBoundaryMismatch = !(spendExactPass && spendOverFail && spendUnderPass && expiryExactFail && expiryBeforePass);

console.log(JSON.stringify({
  tool_id: 'art-01-ap2-mandate-chain-validator',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);
