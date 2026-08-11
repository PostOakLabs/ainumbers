// art-30-agent-commerce-conformance-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C10-1).
// kernel_digest_at_authoring: sha256:48228bd926421bc7b6d0b41aa34880912b7d96d3f048f2865ee2ba72a1b9a2f0
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO per the WU triage — this is a multi-protocol structural conformance
// lint (field presence, regex, enum membership), not a computed monetary quantity. Two
// cross-protocol checks DO compare amounts with Math.abs(...) < fixed tolerance (0.005,
// 0.01) — confirmed by direct read; these are forced as categorical boundary cases below
// (exactly-at-tolerance, just-inside, just-outside) rather than full ULP forcing, since the
// values being compared are caller-asserted amounts, not a kernel-computed rounding chain.
// Checks: fixture-oracle gate, termination/boundedness (pass+fail+warn counts sum to
// checks.length), differential re-derivation of overall_status from the counts, metamorphic
// protocols_validated correctness (only includes a protocol name iff its input field was
// supplied), and forced boundary cases at the two 0.005/0.01 amount-tolerance thresholds.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-30-agent-commerce-conformance-validator.proptest.mjs

import { compute } from '../art-30-agent-commerce-conformance-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-30-agent-commerce-conformance-validator.fixtures.json');
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
const rand = mulberry32(0x30A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function bool(rng, p = 0.5) { return rng() < p; }

function randomAp2Trio(rng) {
  const intent = {
    mandate_type: bool(rng, 0.85) ? 'intent' : 'bad',
    mandate_id: bool(rng, 0.85) ? 'intent-' + Math.floor(rng() * 100) : undefined,
    expires_at: bool(rng, 0.7) ? '2026-12-31T00:00:00Z' : undefined,
    scope: bool(rng, 0.8) ? { merchant_ids: ['m-1'], currency: 'USD', max_amount: 500 } : undefined,
    human_not_present: bool(rng, 0.8) ? true : undefined,
    issuer_id: bool(rng, 0.7) ? 'issuer:test' : undefined,
  };
  const cart = bool(rng, 0.5) ? {
    mandate_type: bool(rng, 0.85) ? 'cart' : 'bad',
    parent_mandate_id: bool(rng, 0.8) ? intent.mandate_id : 'wrong',
    parent_hash: bool(rng, 0.6) ? 'a'.repeat(64) : 'short',
    items: bool(rng, 0.8) ? [{ sku: 'x' }] : [],
    mandate_id: 'cart-' + Math.floor(rng() * 100),
  } : undefined;
  const payment = {
    mandate_type: bool(rng, 0.85) ? 'payment' : 'bad',
    parent_mandate_id: cart ? cart.mandate_id : intent.mandate_id,
    parent_hash: bool(rng, 0.6) ? 'b'.repeat(64) : 'short',
    amount: Math.round(rng() * 100000) / 100,
    currency: bool(rng, 0.8) ? 'USD' : 'EUR',
    human_not_present: intent.human_not_present,
    payment_method: bool(rng, 0.85) ? 'card' : undefined,
  };
  return { intent, cart, payment };
}

const TRIALS = 3000;

// ---------- P1: boundedness — pass+fail+warn sums to checks.length ----------
function checkP1_counts_sum_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = { ap2_mandate_trio: randomAp2Trio(rand) };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.pass_count + output_payload.fail_count + output_payload.warn_count !== output_payload.checks.length) violations++;
  }
  return { name: 'P1_pass_fail_warn_sum_equals_checks_length', trials: checked, violations };
}

// ---------- P2 (differential): overall_status re-derived from counts ----------
function checkP2_overall_status_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = { ap2_mandate_trio: randomAp2Trio(rand) };
    const { output_payload } = compute(pp);
    checked++;
    const expected = output_payload.fail_count > 0 ? 'fail' : output_payload.warn_count > 0 ? 'warn' : 'pass';
    if (output_payload.overall_status !== expected) violations++;
  }
  return { name: 'P2_overall_status_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — protocols_validated matches which optional fields were supplied ----------
function checkP3_protocols_validated_correct() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const ap2 = randomAp2Trio(rand);
    const hasAcp = bool(rand, 0.4);
    const hasX402 = bool(rand, 0.4);
    const pp = {
      ap2_mandate_trio: ap2,
      acp_payload: hasAcp ? JSON.stringify({ agent_id: 'a1', merchant_id: 'm1', currency: 'USD', amount: 10 }) : undefined,
      x402_payload: hasX402 ? { scheme: 'exact', network: 'base', maxAmountRequired: '1.5', asset: 'USDC', payTo: '0xabc' } : undefined,
    };
    const { output_payload } = compute(pp);
    checked++;
    const expected = ['AP2'];
    if (hasAcp) expected.push('ACP');
    if (hasX402) expected.push('x402');
    if (JSON.stringify(output_payload.protocols_validated) !== JSON.stringify(expected)) violations++;
  }
  return { name: 'P3_protocols_validated_matches_supplied_fields', trials: checked, violations };
}

// ---------- P4: forced boundary cases at the 0.005 / 0.01 amount-tolerance thresholds ----------
function checkP4_amount_tolerance_boundary_forcing() {
  let violations = 0, checked = 0;
  const base = randomAp2Trio(rand);
  base.payment.amount = 100;
  const deltas005 = [0.0049, 0.005, 0.0051]; // XP-A01: < 0.005 => pass, else warn
  for (const d of deltas005) {
    checked++;
    const acpAmt = base.payment.amount + d;
    // recompute the ACTUAL float delta the kernel will see (Math.abs(pay.amount - acpAmt)),
    // not the nominal d — float representation of base+d can land fractionally under/over d.
    const actualDelta = Math.abs(base.payment.amount - acpAmt);
    const { output_payload } = compute({ ap2_mandate_trio: base, acp_payload: JSON.stringify({ agent_id: 'a', merchant_id: 'm', currency: 'USD', amount: acpAmt }) });
    const check = output_payload.checks.find((c) => c.code === 'XP-A01');
    const expected = actualDelta < 0.005 ? 'pass' : 'warn';
    if (!check || check.status !== expected) violations++;
  }
  const deltas01 = [0.0099, 0.01, 0.0101]; // XP-A03: < 0.01 => pass, else warn
  for (const d of deltas01) {
    checked++;
    const x402Amt = base.payment.amount + d;
    const actualDelta = Math.abs(base.payment.amount - x402Amt);
    const { output_payload } = compute({ ap2_mandate_trio: base, x402_payload: { scheme: 'exact', network: 'base', maxAmountRequired: String(x402Amt), asset: 'USDC', payTo: '0xabc' } });
    const check = output_payload.checks.find((c) => c.code === 'XP-A03');
    const expected = actualDelta < 0.01 ? 'pass' : 'warn';
    if (!check || check.status !== expected) violations++;
  }
  return { name: 'P4_amount_tolerance_boundary_forcing_0005_and_001', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_counts_sum_bounded());
results.properties.push(checkP2_overall_status_differential());
results.properties.push(checkP3_protocols_validated_correct());
results.properties.push(checkP4_amount_tolerance_boundary_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-30-agent-commerce-conformance-validator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
