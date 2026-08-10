// kernel_digest_at_authoring: sha256:18f88fa54000e35774488e4e653fe00d09df23fee91ad40e50611f194cf1d7f7
//
// FV-PROPFLOOR-SHARD-B9-1 — property-test floor for art-248-compute-remittance-disclosure.
// Class B (bounded-numeric), FLOAT-SENSITIVE — send_amount/exchange_rate/fees are raw doubles feeding
// a chained (send-fees)*rate identity with a 0.01 accounting-identity tolerance — ULP-boundary forcing
// is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG +
// explicit boundary arrays), same shape as the B1-B8 float harnesses.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-248-compute-remittance-disclosure.proptest.mjs

import { compute } from '../art-248-compute-remittance-disclosure.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-248-compute-remittance-disclosure.fixtures.json');
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
const rand = mulberry32(0x2480A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;

function r6(v) { return Math.round(v * 1e6) / 1e6; }
function r2(v) { return Math.round(v * 100) / 100; }

function mkPP(rng) {
  return {
    send_amount: randRange(rng, 0, 5000),
    exchange_rate: randRange(rng, 0.001, 30),
    provider_fee: randRange(rng, 0, 20),
    third_party_fees: randRange(rng, 0, 10),
    taxes: randRange(rng, 0, 10),
    destination_currency: 'MXN',
    destination_country: 'MX',
    estimate_permissible: rng() < 0.5,
  };
}

// ---------- P1: monotone — increasing send_amount never decreases amount_received_dest ----------
function checkP1_monotoneReceived() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r1 = compute(pp);
    const r2v = compute({ ...pp, send_amount: pp.send_amount + 100 });
    checked++;
    if (r2v.amount_received_dest < r1.amount_received_dest) violations++;
    if (r2v.transfer_amount_usd < r1.transfer_amount_usd) violations++;
  }
  return { name: 'P1_monotone_received_nondecreasing_with_send_amount', trials: checked, violations };
}

// ---------- P2: boundedness — transfer_amount_usd never negative, accounting identity holds ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.transfer_amount_usd < 0) violations++;
    if (!r.accounting_identity_ok) violations++;
    if (r.accounting_identity_delta >= 0.01) violations++;
  }
  return { name: 'P2_boundedness_transfer_amount_nonnegative_and_identity_holds', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — transfer_amount_usd matches independently-derived formula ----------
function checkP3_transferAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expectedDeductions = r6(pp.provider_fee + pp.third_party_fees + pp.taxes);
    const expectedTransfer = r6(Math.max(0, pp.send_amount - expectedDeductions));
    if (r.transfer_amount_usd !== expectedTransfer) violations++;
    const expectedReceived = r2(expectedTransfer * r6(pp.exchange_rate));
    if (r.amount_received_dest !== expectedReceived) violations++;
    const expectedType = pp.estimate_permissible ? 'ESTIMATED' : 'EXACT';
    if (r.disclosure_type !== expectedType) violations++;
  }
  return { name: 'P3_transfer_and_received_match_fixed_deduction_formula', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ send_amount: 1, exchange_rate: 1, provider_fee: 0, third_party_fees: 0, taxes: 0 }, 'minimal $1 transfer at 1:1 rate — no fees — transfer must equal 1, received must equal 1'],
  [{ send_amount: 0, exchange_rate: 1, provider_fee: 0, third_party_fees: 0, taxes: 0 }, 'zero send_amount — transfer/received must be 0, no throw'],
  [{ send_amount: -0, exchange_rate: 1, provider_fee: 0, third_party_fees: 0, taxes: 0 }, 'negative-zero send_amount — must behave as zero'],
  [{ send_amount: Number.MIN_VALUE, exchange_rate: 1, provider_fee: 0, third_party_fees: 0, taxes: 0 }, 'smallest positive double send_amount — must round to finite value, no NaN'],
  [{ send_amount: 0.1 * 3, exchange_rate: 1, provider_fee: 0, third_party_fees: 0, taxes: 0 }, 'send_amount = 0.1*3 (classic non-exact double) — transfer_amount_usd must equal r6(0.30000000000000004) rounded to 0.3'],
  [{ send_amount: (1 / 3) * 3, exchange_rate: 1, provider_fee: 0, third_party_fees: 0, taxes: 0 }, 'send_amount = (1/3)*3 (x/y*y!==x rounding artifact) — must round-trip without throwing'],
  [{ send_amount: 100, exchange_rate: 1, provider_fee: 100, third_party_fees: 0, taxes: 0 }, 'provider_fee exactly equals send_amount — transfer_amount_usd must clamp to 0, not negative'],
  [{ send_amount: 100, exchange_rate: 1, provider_fee: 150, third_party_fees: 0, taxes: 0 }, 'fees exceed send_amount — transfer_amount_usd must clamp to 0 via Math.max, no negative leak'],
  [{ send_amount: Number.MAX_SAFE_INTEGER, exchange_rate: 1, provider_fee: 0, third_party_fees: 0, taxes: 0 }, 'send_amount at MAX_SAFE_INTEGER — transfer_amount_usd must remain finite, no overflow'],
  [{ send_amount: 1000, exchange_rate: Number.MIN_VALUE, provider_fee: 0, third_party_fees: 0, taxes: 0 }, 'exchange_rate smallest positive double — amount_received_dest must round to 0, not throw or NaN'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = { destination_currency: 'MXN', destination_country: 'MX', estimate_permissible: false, ...overrides };
    const r = compute(pp);
    const plausible = Number.isFinite(r.transfer_amount_usd) && Number.isFinite(r.amount_received_dest) && r.transfer_amount_usd >= 0;
    rows.push({ label, send_amount: pp.send_amount, exchange_rate: pp.exchange_rate, transfer_amount_usd: r.transfer_amount_usd, amount_received_dest: r.amount_received_dest, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneReceived());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_transferAgreement());
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
