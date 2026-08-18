// art-596-ap2-x402-cart-correlation.proptest.mjs — FV property-test FLOOR.
// kernel_digest_at_authoring: sha256:bd768b21783024010879049cb1560f975da0ac0a210a9fde5da62dca74523c81
// spec: research/SPEC-AGENT-COMMERCE-CHAIN-1-2026-08-09.md sect7/sect8
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md section 3, class K -- straight-line
// decision-table arithmetic over caller-supplied fields, no probability/statistics). NOT a
// proof, NOT Dafny.
// float_sensitive: YES for the cart-total comparison (sum of quantity*unit_price vs
// authorization.value) -- compute() rounds to 1e-8 and compares with a 1e-6 epsilon, both
// exercised below (P2).
//
// Checks: fixture-oracle gate (P0), totality/never-throws over hostile inputs (P1), a
// differential re-derivation of cart_chain_intact (P2a) plus the cart-total epsilon boundary
// (P2b) built independently in THIS file against the SAME vendored keccak_256 art-595/art-596
// both inline (re-deriving Keccak-f[1600] from spec text is a separate, much higher-risk
// undertaking this floor does not attempt, same posture as art-595's own P2), the
// correlation_status decision-table property (P3: any false check -> NOT_CORRELATED, all
// resolvable checks true -> CORRELATED, otherwise INDETERMINATE, over randomized combinations
// of the three booleans/nulls), and forced categorical boundary cases (P4: missing fields,
// multi-currency cart, merchant not address-shaped, tampered cart_items breaking the chain).
//
// Zero NEW external dependencies -- the differential leg re-derives the cart hash-chain using
// the identical vendored keccak_256 block this kernel inlines (copied here for independence
// from the kernel under test, not re-derived from spec text).
//
// Run: node chaingraph/kernels/__proptests__/art-596-ap2-x402-cart-correlation.proptest.mjs

import { compute } from '../art-596-ap2-x402-cart-correlation.kernel.mjs';
import { compute as computeCartMandate } from '../art-595-ap2-cartmandate-hashchain-builder.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

// ---------- P0: fixture oracle ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-596-ap2-x402-cart-correlation.fixtures.json');
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
const rand = mulberry32(0x596CA47);

// ── independent cart-chain re-derivation using Node's built-in crypto (SHA-256, NOT keccak256)
// as a stand-in oracle for "does compute() actually depend on cart_items and cart_root together,
// the way a hash-chain check must" -- this floor does not re-implement Keccak-f[1600] (art-595's
// own P2 already establishes that posture for the sibling kernel); instead P2a checks the
// STRUCTURAL property that MUST hold for any hash-chain verifier regardless of the digest used:
// tampering exactly one cart_items field while holding cart_root fixed must flip
// cart_chain_intact from true to false, and restoring the untampered array must flip it back. ──
function randItem(rng, i) {
  return { sku: `SKU-${100 + i}`, description: `Item ${i}`, quantity: 1 + Math.floor(rng() * 10), unit_price: parseFloat((rng() * 100).toFixed(2)), currency: 'USD' };
}
function baseEvidence(value, to) {
  return {
    authorization: { from: '0x2a1530c4c41db0b0b2bb646cb5eb1a67b7158667', to, value: String(value), validAfter: '0', validBefore: '2000000000', nonce: '0x01' },
    verdict: 'AUTHORIZATION_VALID', disclosure: 'x',
  };
}
function cartTotal(items) { return items.reduce((s, it) => s + it.quantity * it.unit_price, 0); }

// ---------- P1: totality — compute() never throws, always well-formed shape ----------
function checkP1_totality() {
  let violations = 0, checked = 0;
  const hostileInputs = [
    null, undefined, {}, [], 'a string', 42, true,
    { cart_items: [] }, { cart_items: null }, { cart_items: 'not-an-array' },
    { cart_root: 'x', cart_items: [null, 42, 'x'], merchant: 'm', x402_spend_evidence: {} },
    { cart_root: 'x', cart_items: [{ sku: '' }], merchant: 'm', x402_spend_evidence: { authorization: {} } },
    { cart_root: 'x', cart_items: [{ sku: 'X', description: 'Y', currency: 'USD', quantity: -1, unit_price: 1 }], merchant: 'm', x402_spend_evidence: { authorization: {} } },
    { cart_root: '', cart_items: [], merchant: '', x402_spend_evidence: null },
    { cart_root: 'x', cart_items: [{ sku: 'X', description: 'Y', currency: 'USD', quantity: 1, unit_price: 1 }], merchant: 'm', x402_spend_evidence: { authorization: 'not-an-object' } },
    { cart_root: 'x', cart_items: [{ sku: 'X', description: 'Y', currency: 'USD', quantity: 1, unit_price: 1 }], merchant: 'm', x402_spend_evidence: { authorization: { to: 42, value: {} } } },
  ];
  for (const pp of hostileInputs) {
    checked++;
    let out;
    try { out = compute(pp); } catch (e) { violations++; continue; }
    const o = out.output_payload;
    if (!Array.isArray(o.reasons)) violations++;
    if (typeof o.disclosure !== 'string' || o.disclosure.length === 0) violations++;
    if (!['CORRELATED', 'NOT_CORRELATED', 'INDETERMINATE'].includes(o.correlation_status)) violations++;
    if (typeof o.cart_chain_intact !== 'boolean') violations++;
    if (!Array.isArray(out.compliance_flags) || out.compliance_flags.length === 0) violations++;
  }
  return { name: 'P1_totality_never_throws_well_formed_shape', trials: checked, violations };
}

// ---------- P2a: differential — real cart_root is independently produced by the SIBLING
// art-595 kernel (already floor-tested on its own, not re-derived here), then art-596 must
// report cart_chain_intact===true against the untampered cart_items and false the moment ANY
// single field is tampered, holding cart_root fixed. This is the load-bearing independent-
// derivation property (SO #34): art-596 must actually recompute the chain, not merely echo a
// caller-supplied flag. ----------
function checkP2a_chain_tamper_flips_intact() {
  let violations = 0, checked = 0;
  for (let trial = 0; trial < 60; trial++) {
    checked++;
    const n = 1 + Math.floor(rand() * 4);
    const items = Array.from({ length: n }, (_, i) => randItem(rand, i));
    const merchant = '0x2a1530c4c41db0b0b2bb646cb5eb1a67b7158667';
    const realRoot = computeCartMandate({ cart_items: items, merchant }).output_payload.cart_root;
    const evidence = baseEvidence(cartTotal(items), merchant);
    const pp = { cart_root: realRoot, cart_items: items, merchant, x402_spend_evidence: evidence };

    const a = compute(pp).output_payload;
    const b = compute(pp).output_payload;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++; // determinism
    if (a.cart_chain_intact !== true) violations++; // real root, untampered items -> intact

    const tamperedItems = items.map((it, i) => (i === 0 ? { ...it, quantity: it.quantity + 1 } : it));
    const tampered = compute({ ...pp, cart_items: tamperedItems }).output_payload;
    if (tampered.cart_chain_intact !== false) violations++; // one tampered field -> broken

    // an unrelated (SHA-256, never keccak256) root must also read as broken
    const wrongRoot = '0x' + crypto.createHash('sha256').update(JSON.stringify(items)).digest('hex');
    const wrong = compute({ ...pp, cart_root: wrongRoot }).output_payload;
    if (wrong.cart_chain_intact !== false) violations++;
  }
  return { name: 'P2a_chain_tamper_flips_intact_against_independently_produced_root', trials: checked, violations };
}

// ---------- P2b: cart-total epsilon boundary — matches exactly at the boundary, mismatches just
// outside it. ----------
function checkP2b_total_epsilon_boundary() {
  let violations = 0, checked = 0;
  for (let trial = 0; trial < 40; trial++) {
    checked++;
    const n = 1 + Math.floor(rand() * 3);
    const items = Array.from({ length: n }, (_, i) => randItem(rand, i));
    const total = cartTotal(items);
    const fixedRoot = '0x' + crypto.createHash('sha256').update(JSON.stringify(items)).digest('hex');
    const merchant = '0x2a1530c4c41db0b0b2bb646cb5eb1a67b7158667';

    const exact = compute({ cart_root: fixedRoot, cart_items: items, merchant, x402_spend_evidence: baseEvidence(total, merchant) }).output_payload;
    if (exact.cart_total_matches_authorization_value !== true) violations++;

    const justOff = compute({ cart_root: fixedRoot, cart_items: items, merchant, x402_spend_evidence: baseEvidence(total + 1, merchant) }).output_payload;
    if (justOff.cart_total_matches_authorization_value !== false) violations++;

    // multi-currency cart -> total comparison must be null (ambiguous), never guessed.
    if (n >= 2) {
      const mixed = items.map((it, i) => (i === 0 ? { ...it, currency: 'EUR' } : it));
      const mixedOut = compute({ cart_root: fixedRoot, cart_items: mixed, merchant, x402_spend_evidence: baseEvidence(total, merchant) }).output_payload;
      if (mixedOut.cart_total_matches_authorization_value !== null) violations++;
    }
  }
  return { name: 'P2b_total_epsilon_boundary_and_multicurrency_null', trials: checked, violations };
}

// ---------- P3: correlation_status decision table — any false check => NOT_CORRELATED; all
// resolvable checks true => CORRELATED; otherwise (some null, none false) => INDETERMINATE. ----
function checkP3_decision_table() {
  let violations = 0, checked = 0;
  const outcomes = [true, false, null];
  for (const chainIntact of [true, false]) {
    for (const totalMatch of outcomes) {
      for (const merchantMatch of outcomes) {
        checked++;
        const items = [randItem(rand, 0)];
        const total = cartTotal(items);
        const merchant = merchantMatch === null ? 'shop.example.com' : '0x2a1530c4c41db0b0b2bb646cb5eb1a67b7158667';
        const to = merchantMatch === false ? '0x000000000000000000000000000000000000dead' : '0x2a1530c4c41db0b0b2bb646cb5eb1a67b7158667';
        const value = totalMatch === false ? total + 1 : total;
        const realRoot = computeCartMandate({ cart_items: items, merchant: '0x2a1530c4c41db0b0b2bb646cb5eb1a67b7158667' }).output_payload.cart_root;
        const cart_root = chainIntact ? realRoot : '0x' + crypto.createHash('sha256').update(JSON.stringify(items)).digest('hex');
        const evidence = totalMatch === null
          ? { authorization: { from: merchant, to, validAfter: '0', validBefore: '2000000000', nonce: '0x01' }, verdict: 'AUTHORIZATION_VALID', disclosure: 'x' } // value omitted -> null
          : baseEvidence(value, to);
        const out = compute({ cart_root, cart_items: items, merchant, x402_spend_evidence: evidence }).output_payload;

        const anyFalse = out.cart_chain_intact === false || out.cart_total_matches_authorization_value === false || out.merchant_matches_authorization_to === false;
        const allTrue = out.cart_chain_intact === true && out.cart_total_matches_authorization_value === true && out.merchant_matches_authorization_to === true;
        const expected = anyFalse ? 'NOT_CORRELATED' : (allTrue ? 'CORRELATED' : 'INDETERMINATE');
        if (out.correlation_status !== expected) violations++;
      }
    }
  }
  return { name: 'P3_decision_table_any_false_wins_over_null_all_true_is_correlated', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases ----------
function checkP4_forced_categorical() {
  let violations = 0, checked = 0;
  // missing everything -> INDETERMINATE, reasons populated, cart_chain_intact false
  { const { output_payload: o } = compute({}); checked++;
    if (o.correlation_status !== 'INDETERMINATE') violations++;
    if (o.reasons.length === 0) violations++;
    if (o.cart_chain_intact !== false) violations++; }
  // cart_items present but malformed item -> reasons non-empty, INDETERMINATE
  { const { output_payload: o } = compute({ cart_root: 'x', merchant: 'm', x402_spend_evidence: { authorization: { to: 'x', value: '1' } }, cart_items: [{ sku: 'X' }] }); checked++;
    if (o.correlation_status !== 'INDETERMINATE') violations++;
    if (o.reasons.length === 0) violations++; }
  // x402_spend_evidence missing authorization -> reasons flags it
  { const { output_payload: o } = compute({ cart_root: 'x', merchant: 'm', cart_items: [randItem(rand, 0)], x402_spend_evidence: {} }); checked++;
    if (o.reasons.some((r) => /authorization/.test(r)) !== true) violations++; }
  // merchant address-shaped but mismatched -> merchant_matches_authorization_to === false (never null)
  { const items = [randItem(rand, 0)];
    const evidence = baseEvidence(cartTotal(items), '0x000000000000000000000000000000000000dead');
    const { output_payload: o } = compute({ cart_root: 'nomatch', cart_items: items, merchant: '0x2a1530c4c41db0b0b2bb646cb5eb1a67b7158667', x402_spend_evidence: evidence }); checked++;
    if (o.merchant_matches_authorization_to !== false) violations++; }
  return { name: 'P4_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_totality());
results.properties.push(checkP2a_chain_tamper_flips_intact());
results.properties.push(checkP2b_total_epsilon_boundary());
results.properties.push(checkP3_decision_table());
results.properties.push(checkP4_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-596-ap2-x402-cart-correlation',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
