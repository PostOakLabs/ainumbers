// kernel_digest_at_authoring: sha256:2d03df3ee9d7450686eb4fb59512bb3e13c77915d6a1e96c27354725185e0ca2
//
// FV-PROPFLOOR-SHARD-B22-1 — property-test floor for art-388-tempo-fee-amm-converter.
// Class B (bounded-numeric). CORRECTED CLASSIFICATION: the WU row lists this kernel as
// float-sensitive, but every amount is parsed to BigInt and all fee/conversion arithmetic
// is exact integer BigInt math (validator_token_out, lp_fee_amount, exceeds_max_utilization
// cross-multiplication) — the sole Number() calls (pool_utilization_bps, max_pool_utilization_
// bps) are integer-domain BigInt-to-Number conversions of already-truncated integer
// quotients/small bps values, never a raw IEEE754 division. Reclassified float:no per FIX-2
// CARRY; forced CATEGORICAL/boundary cases (zero reserves, BigInt precision-loss range,
// malformed-string inputs) used in place of ULP forcing. Zero external dependencies. This
// file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-388-tempo-fee-amm-converter.proptest.mjs

import { compute } from '../art-388-tempo-fee-amm-converter.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-388-tempo-fee-amm-converter.fixtures.json');
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
const rand = mulberry32(0x388C1);
const TRIALS = 10000;
function randBigStr(rng, digits) {
  let s = '';
  for (let i = 0; i < digits; i++) s += Math.floor(rng() * 10);
  return s.replace(/^0+(?=\d)/, '');
}

function mkPP(rng) {
  const userIn = randBigStr(rng, 1 + Math.floor(rng() * 24));
  const feeReserve = randBigStr(rng, 1 + Math.floor(rng() * 24));
  const valReserve = randBigStr(rng, 1 + Math.floor(rng() * 24));
  return {
    fee_token: 'USDT',
    validator_token: 'USDC',
    user_token_in: userIn,
    pool_reserves: { fee_token_reserve: feeReserve, validator_token_reserve: valReserve },
  };
}

// ---------- P1: validator_token_out + lp_fee_amount === user_token_in exactly (BigInt round-trip) ----------
function checkP1_roundTripsExactly() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const lpFee = BigInt(r.output_payload.lp_fee_amount);
    const userIn = BigInt(pp.user_token_in);
    const out = r.output_payload.conversion_ok ? BigInt(r.output_payload.validator_token_out) : (userIn * 9970n) / 10000n;
    if (out + lpFee !== userIn) violations++;
  }
  return { name: 'P1_validator_out_plus_lp_fee_equals_user_in_exact', trials: checked, violations };
}

// ---------- P2: lp_fee_amount is exactly the fixed 30bps of user_token_in (floor division) ----------
function checkP2_lpFeeExactFormula() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const userIn = BigInt(pp.user_token_in);
    const expectedOut = (userIn * 9970n) / 10000n;
    const expectedFee = userIn - expectedOut;
    if (BigInt(r.output_payload.lp_fee_amount) !== expectedFee) violations++;
  }
  return { name: 'P2_lp_fee_exact_30bps_floor_division', trials: checked, violations };
}

// ---------- P3: conversion_ok is exactly !exceeds_max_utilization (boundedness) ----------
function checkP3_conversionOkBoundedByUtilization() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (!r.output_payload.conversion_ok && r.output_payload.reason !== 'INSUFFICIENT_LIQUIDITY') violations++;
    if (r.output_payload.conversion_ok && r.output_payload.reason !== null) violations++;
    if (!r.output_payload.conversion_ok && r.output_payload.validator_token_out !== null) violations++;
  }
  return { name: 'P3_conversion_ok_bounded_and_reason_consistent', trials: checked, violations };
}

// ---------- P4 (float:no exception): forced categorical/boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ user_token_in: '0', pool_reserves: { fee_token_reserve: '1000', validator_token_reserve: '1000' } }, 'user_token_in exactly zero — validator_token_out and lp_fee_amount must both be 0, conversion_ok true'],
  [{ user_token_in: '1000', pool_reserves: { fee_token_reserve: '1000', validator_token_reserve: '0' } }, 'validator_token_reserve exactly zero — exceeds_max_utilization must be forced true, INSUFFICIENT_LIQUIDITY'],
  [{ user_token_in: '1', pool_reserves: { fee_token_reserve: '1', validator_token_reserve: '1' } }, 'smallest nonzero unit conversion — must not floor to a negative fee (997/10000 truncates to 0, fee = 1)'],
  [{ user_token_in: '9007199254740993000000000000', pool_reserves: { fee_token_reserve: '9007199254740993000000000000', validator_token_reserve: '9007199254740993000000000000' } }, 'amounts far beyond Number.MAX_SAFE_INTEGER — BigInt math must stay exact even though pool_utilization_bps crosses through Number()'],
  [{ user_token_in: '-5', pool_reserves: { fee_token_reserve: '1000', validator_token_reserve: '1000' } }, 'negative user_token_in string — parseBig rejects the sign, MALFORMED_INPUT'],
  [{ user_token_in: 'not-a-number', pool_reserves: { fee_token_reserve: '1000', validator_token_reserve: '1000' } }, 'non-numeric user_token_in string — MALFORMED_INPUT, never a crash'],
  [{ user_token_in: '1000', pool_reserves: { fee_token_reserve: '1000', validator_token_reserve: '1000' }, max_pool_utilization_bps: 10000 }, 'max_pool_utilization_bps at its declared ceiling (10000 = 100%) — must be honored, not clamped lower'],
  [{ user_token_in: '1000', pool_reserves: { fee_token_reserve: '1000', validator_token_reserve: '1000' }, max_pool_utilization_bps: -1 }, 'max_pool_utilization_bps out of the declared 0-10000 range — must fall back to the 3000 default, not accept -1'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const full = { fee_token: 'USDT', validator_token: 'USDC', ...pp };
    const r = compute(full);
    const { conversion_ok, validator_token_out, lp_fee_amount, reason } = r.output_payload;
    const plausible = typeof conversion_ok === 'boolean' && lp_fee_amount !== undefined && !String(lp_fee_amount).includes('NaN');
    rows.push({ label, input: full, conversion_ok, validator_token_out, lp_fee_amount, reason, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_roundTripsExactly());
results.properties.push(checkP2_lpFeeExactFormula());
results.properties.push(checkP3_conversionOkBoundedByUtilization());
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
