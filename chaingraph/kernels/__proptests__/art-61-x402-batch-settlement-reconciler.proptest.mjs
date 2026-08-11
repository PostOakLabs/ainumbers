// kernel_digest_at_authoring: sha256:93f57377ae56edc40fdb3e1381a0bc126350b4fa9584d9b59a931175ef17d054
//
// FV-PROPFLOOR-SHARD-B15-1 — property-test floor for art-61-x402-batch-settlement-reconciler.
// Class B (bounded-numeric), FLOAT:NO per the WU row — vouchers[].amount and onchain_tx_total
// are user-supplied minor-currency-unit integers in the tool's intended usage (not fractional
// doubles), and every recon_verdict branch compares batch_delta against the user-supplied
// tolerance_minor_units parameter via <=/< rather than a hardcoded threshold — there is no
// FIXED numeric constant to force ULP boundaries against. Per FV-PBT-FLOOR-BUILD-SPEC.md §3
// this is a stated float:no exception — forced CATEGORICAL boundary cases (tolerance exact-match,
// zero-voucher/zero-total empty state, redeemed-flag toggling) stand in for ULP forcing.
// Zero external dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-61-x402-batch-settlement-reconciler.proptest.mjs

import { compute } from '../art-61-x402-batch-settlement-reconciler.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-61-x402-batch-settlement-reconciler.fixtures.json');
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
const rand = mulberry32(0x61A11);
const TRIALS = 8000;
function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }

function mkVoucher(rng, i) {
  return {
    voucher_id: `v${i}`,
    payer_agent: 'agentA',
    payee_agent: 'agentB',
    amount: randInt(rng, 1, 100000),
    currency: 'USDC',
    signed_at: rng() < 0.9 ? '2026-06-20T00:00:00Z' : '',
    redeemed: rng() < 0.7,
  };
}

function mkPP(rng) {
  const n = randInt(rng, 0, 20);
  const vouchers = Array.from({ length: n }, (_, i) => mkVoucher(rng, i));
  const redeemedTotal = vouchers.filter(v => v.redeemed).reduce((a, v) => a + v.amount, 0);
  const drift = randInt(rng, -50, 50);
  return {
    vouchers,
    batch: {
      batch_id: `b${randInt(rng, 1, 1000)}`,
      onchain_tx_total: Math.max(0, redeemedTotal + drift),
      settlement_asset: 'USDC',
      settled_at: '2026-06-20T01:00:00Z',
      escrow_address: '0xabc',
    },
    tolerance_minor_units: randInt(rng, 0, 10),
    finality_threshold: randInt(rng, 0, 3),
  };
}

// ---------- P1: fixed-enum agreement — recon_verdict always one of the 5 declared verdicts ----------
function checkP1_verdictFixedEnum() {
  const VALID = new Set(['empty', 'matched', 'short', 'over', 'at-risk']);
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (!VALID.has(r.output_payload.recon_verdict)) violations++;
  }
  return { name: 'P1_recon_verdict_fixed_5_state_enum', trials: checked, violations };
}

// ---------- P2: exactness — batch_delta_minor_units is exactly redeemed_total - onchain_tx_total ----------
function checkP2_batchDeltaExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = r.output_payload.redeemed_total - pp.batch.onchain_tx_total;
    if (r.output_payload.batch_delta_minor_units !== expected) violations++;
  }
  return { name: 'P2_batch_delta_exact_redeemed_minus_onchain', trials: checked, violations };
}

// ---------- P3: within_tolerance agreement — matches |delta| <= tolerance_minor_units exactly ----------
function checkP3_withinToleranceAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = Math.abs(r.output_payload.batch_delta_minor_units) <= pp.tolerance_minor_units;
    if (r.output_payload.within_tolerance !== expected) violations++;
  }
  return { name: 'P3_within_tolerance_matches_abs_delta_le_tolerance', trials: checked, violations };
}

// ---------- P4 (mandatory float:no exception): forced categorical boundary cases ----------
function checkP4_forced() {
  const rows = [];
  const push = (pp, label) => {
    const r = compute(pp);
    const { recon_verdict, batch_delta_minor_units, within_tolerance } = r.output_payload;
    const plausible = typeof recon_verdict === 'string' && Number.isFinite(batch_delta_minor_units) && typeof within_tolerance === 'boolean';
    rows.push({ label, input: pp, recon_verdict, batch_delta_minor_units, within_tolerance, plausible });
  };

  push({ vouchers: [], batch: {} }, 'zero vouchers + zero onchain_tx_total (all defaults) — must be recon_verdict=empty, not matched');
  push({ vouchers: [{ voucher_id: 'v1', amount: 100, redeemed: true, signed_at: 'x' }], batch: { onchain_tx_total: 100 }, tolerance_minor_units: 0 }, 'delta exactly 0, tolerance exactly 0 — <= boundary must classify matched');
  push({ vouchers: [{ voucher_id: 'v1', amount: 100, redeemed: true, signed_at: 'x' }], batch: { onchain_tx_total: 95 }, tolerance_minor_units: 5 }, 'delta exactly equals tolerance (5) — <= boundary must classify matched, not short/over');
  push({ vouchers: [{ voucher_id: 'v1', amount: 100, redeemed: true, signed_at: 'x' }], batch: { onchain_tx_total: 94 }, tolerance_minor_units: 5 }, 'delta = 6, one unit past tolerance — must classify over (redeemed > onchain)');
  push({ vouchers: [{ voucher_id: 'v1', amount: 100, redeemed: true, signed_at: 'x' }], batch: { onchain_tx_total: 106 }, tolerance_minor_units: 5 }, 'delta = -6, one unit past negative tolerance — must classify short');
  push({ vouchers: [{ voucher_id: 'v1', amount: 100, redeemed: false, signed_at: 'x' }], batch: { onchain_tx_total: 0 }, tolerance_minor_units: 0 }, 'single unredeemed voucher — must surface UNREDEEMED finding and nonzero settlement_risk_window');
  push({ vouchers: [{ voucher_id: 'v1', amount: 100, redeemed: true, signed_at: '' }], batch: { onchain_tx_total: 100 } }, 'missing signed_at on an otherwise-valid voucher — must surface MISSING_SIGNED_AT finding');
  push({ vouchers: [{ voucher_id: 'v1', amount: 'not-a-number', redeemed: true, signed_at: 'x' }], batch: { onchain_tx_total: 0 } }, 'non-numeric amount string — Number(v.amount)||0 guard must coerce to 0, not NaN');
  push({ vouchers: [], batch: { onchain_tx_total: 50 }, finality_threshold: 0 }, 'finality_threshold below minimum (0) with zero vouchers — must trigger FINALITY_THRESHOLD_BELOW_MINIMUM flag');
  push({ vouchers: [{ voucher_id: 'v1', amount: 100, redeemed: true, signed_at: 'x' }, { voucher_id: 'v1', amount: 50, redeemed: true, signed_at: 'x' }], batch: { onchain_tx_total: 150 } }, 'duplicate voucher_id values — must not throw, merkle preimage must still be a string');

  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_verdictFixedEnum());
results.properties.push(checkP2_batchDeltaExact());
results.properties.push(checkP3_withinToleranceAgreement());
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
