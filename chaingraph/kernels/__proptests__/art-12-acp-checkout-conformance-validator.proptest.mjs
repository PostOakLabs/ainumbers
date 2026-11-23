// art-12-acp-checkout-conformance-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C3-1).
// kernel_digest_at_authoring: sha256:763c756ba14cdb41f480953061d41148819391d5f84b8f804c9c9ba7a2b58dbe
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (rule engine is field-presence/regex/decision-table logic; the one
//   "amount precision" check counts decimal digits of a caller-supplied numeric string, no
//   float comparison or arithmetic threshold is involved).
// Checks: fixture-oracle gate, termination (checks array length data-bounded by the fixed rule
// tables, never by unbounded input), differential re-derivation of overall_status from the
// pass/fail/warn counts, and metamorphic permutation-invariance of the items array (order never
// changes the aggregate ACP-R07a verdict).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-12-acp-checkout-conformance-validator.proptest.mjs

import { compute } from '../art-12-acp-checkout-conformance-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-12-acp-checkout-conformance-validator.fixtures.json');
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
const rand = mulberry32(0x12ACD);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function maybe(rng, v, p = 0.7) { return rng() < p ? v : undefined; }

const CURRENCIES = ['USD', 'EUR', 'INVALID', 'JPY'];
const SIG_PREFIXES = ['sha256-hmac:abc', 'rs256:abc', 'garbage:abc', ''];

function randomItem(rng, i) {
  return {
    sku: maybe(rng, `SKU-${i}`),
    unit_price: maybe(rng, rng() * 100 - 10),
    quantity: maybe(rng, Math.floor(rng() * 5)),
  };
}

function randomRequestPayload(rng) {
  const nItems = Math.floor(rng() * 5);
  return {
    message_type: 'CheckoutRequest',
    request_id: maybe(rng, 'req-1'),
    merchant_id: maybe(rng, 'merchant-1'),
    agent_id: maybe(rng, 'agent-1'),
    amount: maybe(rng, rng() * 1000),
    currency: pick(rng, CURRENCIES),
    items: Array.from({ length: nItems }, (_, i) => randomItem(rng, i)),
    timestamp: maybe(rng, '2026-06-19T10:00:00.000Z'),
    redirect_url: pick(rng, ['https://a.com/x', 'http://a.com/x', 'not-a-url']),
    signature: pick(rng, SIG_PREFIXES),
    idempotency_key: maybe(rng, 'idem-1', 0.5),
  };
}

function randomResponsePayload(rng) {
  return {
    message_type: 'CheckoutResponse',
    request_id: maybe(rng, 'req-1'),
    status: pick(rng, ['approved', 'declined', 'pending', 'error', 'bogus']),
    shared_payment_token: maybe(rng, {
      token_id: maybe(rng, 't1'), token_type: maybe(rng, 'card'),
      issued_at: 1000, expires_at: maybe(rng, 1000 + Math.floor(rng() * 5000)),
      scope: pick(rng, ['single_use', 'multi_use', 'bad']), payment_rail: maybe(rng, 'x402'),
    }, 0.8),
    merchant_id: maybe(rng, 'merchant-1'),
    amount_charged: maybe(rng, rng() * 1000),
    currency: pick(rng, CURRENCIES),
    timestamp: maybe(rng, '2026-06-19T10:00:00.000Z'),
    response_signature: pick(rng, SIG_PREFIXES),
    transaction_id: maybe(rng, 'txn-1'),
  };
}

function randomPP(rng) {
  const payload = rng() < 0.5 ? randomRequestPayload(rng) : randomResponsePayload(rng);
  return { message_type_override: 'auto', payload };
}

const TRIALS = 5000;

// ---------- P1: termination — pass/fail/warn counts sum exactly to checks.length, checks bounded ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  const MAX_CHECKS = 20; // fixed rule tables: T01 + up to 10 field rules + R07a + P01 + R11 + SIG1 + 4 SPT checks
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const sum = output_payload.pass_count + output_payload.fail_count + output_payload.warn_count;
    if (sum !== output_payload.checks.length) violations++;
    if (output_payload.checks.length > MAX_CHECKS) violations++;
  }
  return { name: 'P1_termination_checks_bounded', trials: checked, violations };
}

// ---------- P2 (differential): overall_status re-derivation ----------
function checkP2_status_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expected = output_payload.fail_count > 0 ? 'fail' : output_payload.warn_count > 0 ? 'warn' : 'pass';
    if (output_payload.overall_status !== expected) violations++;
  }
  return { name: 'P2_overall_status_differential', trials: checked, violations };
}

// ---------- P3: boundedness — merchant_id/currency echo exactly what was supplied (or null) ----------
function checkP3_echo_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expMerchant = pp.payload.merchant_id || null;
    const expCurrency = pp.payload.currency || null;
    if (output_payload.merchant_id !== expMerchant) violations++;
    if (output_payload.currency !== expCurrency) violations++;
  }
  return { name: 'P3_merchant_currency_echo_boundedness', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance of items array (CheckoutRequest only) ----------
function checkP4_items_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const payload = randomRequestPayload(rand);
    if (!Array.isArray(payload.items) || payload.items.length < 2) continue;
    const shuffled = { ...payload, items: shuffle(rand, payload.items) };
    const r1 = compute({ message_type_override: 'auto', payload }).output_payload;
    const r2 = compute({ message_type_override: 'auto', payload: shuffled }).output_payload;
    checked++;
    if (r1.overall_status !== r2.overall_status) violations++;
    if (r1.pass_count !== r2.pass_count || r1.fail_count !== r2.fail_count || r1.warn_count !== r2.warn_count) violations++;
  }
  return { name: 'P4_items_permutation_invariance', trials: checked, violations };
}

// ---------- PF1 (KERNEL-BIGINT-F1-SAFE-FORMAT-1): a BigInt on payload.amount refuses, never throws ----------
// RED on main: compute() threw "Do not know how to serialize a BigInt" while building the
// field-validation refusal detail. GREEN on head: the same input returns the refusal
// (measured across 4 BigInt values on this field, origin/main 0289be7577 vs this branch).
function checkPF1_bigintInputRefusesWithoutThrowing() {
  let violations = 0, checked = 0;
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-12-acp-checkout-conformance-validator.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  for (const big of [7n, 123456789012345678901234567890n, -1n, 0n]) {
    const pp = structuredClone(fixtures.vectors[0].policy_parameters);
    if (!pp.payload || typeof pp.payload !== 'object') pp.payload = {};
    pp.payload.amount = big;
    checked++;
    try {
      const r = compute(pp);
      if (!r || !r.compliance_flags || !r.compliance_flags.includes('FIELD_VALIDATION_FAILED')) violations++;
    } catch (e) {
      violations++; // the serialization throw this cure removes
    }
  }
  return { name: 'PF1_bigint_payload_amount_refuses_without_throwing', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_status_differential());
results.properties.push(checkP3_echo_boundedness());
results.properties.push(checkP4_items_permutation_invariance());
results.properties.push(checkPF1_bigintInputRefusesWithoutThrowing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-12-acp-checkout-conformance-validator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
