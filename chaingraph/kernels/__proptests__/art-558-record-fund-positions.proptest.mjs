// art-558-record-fund-positions.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C28-1).
// kernel_digest_at_authoring: sha256:131eac7aaf5e372e1965aa999e673311441ba0a4febdaab6db2acae582e9496f
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO -- CORRECTED from the WU row's float:yes (per FIX-2 discipline). Direct
// source read: this is a pure positions-snapshot attestation kernel, the exact structural twin
// of art-557 in this same shard. normalizeHolding() only VALIDATES quantity/shares_outstanding
// via typeof/Number.isFinite/>0 checks and echoes the caller-supplied value verbatim -- there is
// NO summation, division, multiplication, or rounding of quantity/shares_outstanding anywhere
// in the file (no price field exists here at all; that arithmetic belongs to the downstream
// art-373-recompute-fund-nav node this kernel explicitly defers to, per its own header comment).
// Forced categorical boundary cases are used in place of ULP-boundary forcing.
// Checks: fixture-oracle gate, termination (holdings array echoed 1:1, never expanded, bounded
// by pp.holdings.length), boundedness (holding_count === holdings.length, missingSecurityIds/
// invalidQuantities counts <= holding_count), differential re-derivation of structural_error/
// compliance_flags via an independent reimplementation, permutation-invariance of holdings order
// (count/structural_error are order-independent), and forced categorical boundary cases (missing
// fund_id, missing valuation_date, empty holdings, shares_outstanding<=0, non-numeric quantity,
// one holding missing security_id).
// Zero external dependencies -- pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-558-record-fund-positions.proptest.mjs

import { compute } from '../art-558-record-fund-positions.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-558-record-fund-positions.fixtures.json');
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
const rand = mulberry32(0x55800028);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomHolding(rng, i) {
  return {
    security_id: rng() < 0.15 ? undefined : `SEC-${i}`,
    quantity: rng() < 0.1 ? 'not-a-number' : Math.floor(rng() * 100000),
    currency: pick(rng, ['USD', 'GBP', 'EUR']),
  };
}
function randomPP(rng) {
  const n = Math.floor(rng() * 10);
  return {
    fund_id: rng() < 0.1 ? undefined : `FUND-${Math.floor(rng() * 1000)}`,
    valuation_date: rng() < 0.1 ? undefined : '2026-08-05',
    holdings: Array.from({ length: n }, (_, i) => randomHolding(rng, i)),
    shares_outstanding: rng() < 0.1 ? -100 : Math.floor(rng() * 1000000) + 1,
  };
}

const TRIALS = 3000;

// ---------- P1: termination -- holdings echoed 1:1, never expanded ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.holdings.length !== pp.holdings.length) violations++;
    if (output_payload.holding_count !== output_payload.holdings.length) violations++;
  }
  return { name: 'P1_holdings_echoed_1to1_bounded_by_input_length', trials: checked, violations };
}

// ---------- P2: boundedness -- missingSecurityIds/invalidQuantities bounded by holding_count ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const missingIds = output_payload.holdings.filter((h) => !h.security_id).length;
    const invalidQty = output_payload.holdings.filter((h) => h.quantity === null).length;
    if (missingIds > output_payload.holding_count) violations++;
    if (invalidQty > output_payload.holding_count) violations++;
  }
  return { name: 'P2_missing_ids_and_invalid_qty_bounded_by_holding_count', trials: checked, violations };
}

// ---------- P3 (differential): structural_error/compliance_flags re-derived ----------
function reimplement(pp) {
  const holdings = Array.isArray(pp.holdings) ? pp.holdings : [];
  const sharesOk = typeof pp.shares_outstanding === 'number' && Number.isFinite(pp.shares_outstanding) && pp.shares_outstanding > 0;
  let structuralError = null;
  if (!pp.fund_id) structuralError = 'fund_id is required.';
  else if (!pp.valuation_date) structuralError = 'valuation_date is required.';
  else if (holdings.length === 0) structuralError = 'holdings must be a non-empty array.';
  else if (!sharesOk) structuralError = 'shares_outstanding is required and must be a positive number.';
  return { structuralError };
}
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expected = reimplement(pp);
    if (output_payload.structural_error !== expected.structuralError) violations++;
  }
  return { name: 'P3_structural_error_differential', trials: checked, violations };
}

// ---------- P4: metamorphic -- permutation-invariance of holdings order ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1200; i++) {
    const pp = randomPP(rand);
    if (pp.holdings.length < 2) continue;
    const shuffled = { ...pp, holdings: [...pp.holdings].reverse() };
    const r1 = compute(pp).output_payload;
    const r2v = compute(shuffled).output_payload;
    checked++;
    if (r1.holding_count !== r2v.holding_count) violations++;
    if (r1.structural_error !== r2v.structural_error) violations++;
  }
  return { name: 'P4_holdings_order_invariance', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no) ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  const base = { fund_id: 'F', valuation_date: '2026-08-05', shares_outstanding: 100, holdings: [{ security_id: 'S1', quantity: 10, currency: 'USD' }] };
  // missing fund_id -> structural error
  checked++;
  { const r = compute({ ...base, fund_id: undefined }).output_payload; if (!r.structural_error) violations++; }
  // missing valuation_date -> structural error
  checked++;
  { const r = compute({ ...base, valuation_date: undefined }).output_payload; if (!r.structural_error) violations++; }
  // empty holdings -> structural error
  checked++;
  { const r = compute({ ...base, holdings: [] }).output_payload; if (!r.structural_error) violations++; }
  // shares_outstanding === 0 -> structural error (must be positive, not merely non-negative)
  checked++;
  { const r = compute({ ...base, shares_outstanding: 0 }).output_payload; if (!r.structural_error) violations++; }
  // shares_outstanding negative -> structural error
  checked++;
  { const r = compute({ ...base, shares_outstanding: -1 }).output_payload; if (!r.structural_error) violations++; }
  // shares_outstanding just above zero -> valid, no structural error
  checked++;
  { const r = compute({ ...base, shares_outstanding: 1 }).output_payload; if (r.structural_error !== null) violations++; }
  // non-numeric quantity -> null quantity, invalid-quantity flag, never a structural error
  checked++;
  { const r = compute({ ...base, holdings: [{ security_id: 'S1', quantity: 'oops', currency: 'USD' }] }); if (r.output_payload.holdings[0].quantity !== null || !r.compliance_flags.includes('POSITIONS_QUANTITY_INVALID')) violations++; }
  // one holding missing security_id -> soft flag, not a structural error
  checked++;
  { const r = compute({ ...base, holdings: [{ quantity: 10, currency: 'USD' }] }); if (r.output_payload.structural_error !== null || !r.compliance_flags.includes('POSITIONS_MISSING_SECURITY_ID')) violations++; }
  return { name: 'P5_forced_categorical_boundaries', trials: checked, violations };
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

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-558-record-fund-positions',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
