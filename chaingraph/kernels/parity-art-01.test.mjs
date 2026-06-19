// Hash-parity + correctness harness for the art-01 kernel.
// Run:  node repo/chaingraph/kernels/parity-art-01.test.mjs
// Exits non-zero on any failure (CI gate per AGENT-NATIVE-MCP-SPEC §11).
//
// What it proves:
//   1. Kernel reproduces the expected verdict for each fixture.
//   2. execution_hash is DETERMINISTIC (same inputs -> same hash, twice).
//   3. Independent re-verification matches (mimics verify_execution_hash -> valid:true).
//   4. The hash ANCHORS the inputs (mutating an input changes the hash).
//   5. Regression guard: the legacy browser canonicalizer (shallow array-replacer)
//      does NOT anchor inputs — demonstrates the bug this kernel fixes.

import { compute, buildArtifact } from './art-01-ap2-mandate-chain-validator.kernel.mjs';
import { executionHash, cgCanon } from './_hash.mjs';

// ── Deterministic fixtures (absolute timestamps; fixed validate_at) ──
const VALIDATE_AT = '2026-06-18T12:00:00.000Z';
const HEXA = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
const HEXB = 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3';

const FIXTURES = [
  {
    name: 'valid_trio',
    expected_verdict: 'PASS',
    pp: {
      validate_at: VALIDATE_AT, hnp_mode: 'strict',
      intent: { mandate_type: 'intent', mandate_id: 'int-001', version: '2.0', issued_at: '2026-06-18T10:00:00.000Z', expires_at: '2026-06-19T10:00:00.000Z', issuer_id: 'agent-alpha', scope: { merchant_ids: ['merchant-acme'], category_codes: ['5411', '5912'], currency: 'USD', max_amount: 500.00 }, human_not_present: false },
      cart: { mandate_type: 'cart', mandate_id: 'crt-001', version: '2.0', issued_at: '2026-06-18T11:00:00.000Z', expires_at: '2026-06-19T11:00:00.000Z', parent_mandate_id: 'int-001', parent_hash: HEXA, items: [{ sku: 'SKU-001', description: 'Organic Coffee 500g', unit_price: 12.99, quantity: 3, merchant_id: 'merchant-acme', category_code: '5411' }], cart_total: 38.97, currency: 'USD', merchant_id: 'merchant-acme' },
      payment: { mandate_type: 'payment', mandate_id: 'pay-001', version: '2.0', issued_at: '2026-06-18T11:54:00.000Z', expires_at: '2026-06-18T12:30:00.000Z', parent_mandate_id: 'crt-001', parent_hash: HEXB, amount: 38.97, currency: 'USD', merchant_id: 'merchant-acme', payment_method: 'card_on_file', human_not_present: false },
    },
  },
  {
    name: 'overspend',
    expected_verdict: 'FAIL',
    pp: {
      validate_at: VALIDATE_AT, hnp_mode: 'strict',
      intent: { mandate_type: 'intent', mandate_id: 'int-os-001', version: '2.0', issued_at: '2026-06-18T11:00:00.000Z', expires_at: '2026-06-19T11:00:00.000Z', issuer_id: 'agent-zeta', scope: { merchant_ids: ['merchant-acme'], category_codes: ['5411'], currency: 'USD', max_amount: 50.00 }, human_not_present: false },
      cart: { mandate_type: 'cart', mandate_id: 'crt-os-001', version: '2.0', issued_at: '2026-06-18T11:30:00.000Z', expires_at: '2026-06-19T11:30:00.000Z', parent_mandate_id: 'int-os-001', parent_hash: HEXA, items: [{ sku: 'SKU-Y', description: 'Premium Widget', unit_price: 120.00, quantity: 1, merchant_id: 'merchant-acme', category_code: '5411' }], cart_total: 120.00, currency: 'USD', merchant_id: 'merchant-acme' },
      payment: { mandate_type: 'payment', mandate_id: 'pay-os-001', version: '2.0', issued_at: '2026-06-18T11:54:00.000Z', expires_at: '2026-06-18T12:30:00.000Z', parent_mandate_id: 'crt-os-001', parent_hash: HEXB, amount: 120.00, currency: 'USD', merchant_id: 'merchant-acme', payment_method: 'card_on_file', human_not_present: false },
    },
  },
  {
    name: 'expired_intent',
    expected_verdict: 'FAIL',
    pp: {
      validate_at: VALIDATE_AT, hnp_mode: 'strict',
      intent: { mandate_type: 'intent', mandate_id: 'int-exp-001', version: '2.0', issued_at: '2026-06-17T11:00:00.000Z', expires_at: '2026-06-18T11:00:00.000Z', issuer_id: 'agent-epsilon', scope: { merchant_ids: ['merchant-acme'], category_codes: ['5411'], currency: 'USD', max_amount: 100.00 }, human_not_present: false },
      cart: null,
      payment: { mandate_type: 'payment', mandate_id: 'pay-exp-001', version: '2.0', issued_at: '2026-06-18T11:54:00.000Z', expires_at: '2026-06-18T12:30:00.000Z', parent_mandate_id: 'int-exp-001', parent_hash: HEXA, amount: 50.00, currency: 'USD', merchant_id: 'merchant-acme', payment_method: 'card_on_file', human_not_present: false },
    },
  },
];

// Legacy browser canonicalizer (repo/chaingraph/art-01-...html line ~886) — for the regression guard.
async function legacyBrowserHash(policy_parameters, output_payload) {
  const obj = { policy_parameters, output_payload };
  const canonical = JSON.stringify(obj, Object.keys(obj).sort()); // shallow array-replacer (the bug)
  const buf = new TextEncoder().encode(canonical);
  const hb = await globalThis.crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hb)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };

console.log('— art-01 kernel parity & correctness —\n');

for (const fx of FIXTURES) {
  const { verdict } = compute(fx.pp);
  ok(verdict === fx.expected_verdict, `[${fx.name}] verdict ${verdict} === expected ${fx.expected_verdict}`);

  const a1 = await buildArtifact(fx.pp, { now: '2026-06-18T12:00:00.000Z' });
  const a2 = await buildArtifact(fx.pp, { now: '2099-01-01T00:00:00.000Z' }); // different framing time
  ok(a1.execution_hash === a2.execution_hash, `[${fx.name}] hash deterministic across runs (framing timestamp excluded from preimage)`);

  const reverify = await executionHash(a1.policy_parameters, a1.output_payload);
  ok(reverify === a1.execution_hash, `[${fx.name}] independent re-verify matches (verify_execution_hash -> valid:true)`);
}

// 4. Anchoring: mutate one input field -> hash MUST change.
const base = FIXTURES[0];
const baseHash = (await buildArtifact(base.pp)).execution_hash;
const mutated = structuredClone(base.pp);
mutated.payment.amount = 39.00; // 38.97 -> 39.00
const mutatedHash = (await buildArtifact(mutated)).execution_hash;
ok(baseHash !== mutatedHash, '[anchoring] mutating payment.amount changes execution_hash (inputs are anchored)');

// 5. Regression guard: legacy shallow-replacer hash does NOT anchor inputs.
const baseOut = compute(base.pp).output_payload;
const mutOut = compute(mutated).output_payload;
const legacyBase = await legacyBrowserHash(base.pp, baseOut);
const legacyMut = await legacyBrowserHash(mutated.pp ?? mutated, mutOut);
ok(legacyBase === legacyMut, '[regression] legacy browser canonicalizer collapses both inputs to the SAME hash (demonstrates the bug the kernel fixes)');
console.log(`        legacy preimage = ${JSON.stringify(cgCanon({ policy_parameters: base.pp, output_payload: baseOut })).length} bytes of real data, but legacy hash ignores it`);

console.log(`\n${failures === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
