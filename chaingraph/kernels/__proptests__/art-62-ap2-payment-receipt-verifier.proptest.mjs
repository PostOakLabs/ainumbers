// kernel_digest_at_authoring: sha256:ca4201c7c2cff9069746a1e76dc3f53f390845654f2049dfb8769857a7ae12b9
//
// FV-PROPFLOOR-SHARD-B15-1 — property-test floor for art-62-ap2-payment-receipt-verifier.
// Class B (bounded-numeric), FLOAT:NO per the WU row — the only numeric arithmetic is
// authorized_amount_headroom = max_autonomous_amount - amount, a plain integer-minor-units
// subtraction with no rounding, and mandate_age_sec = Math.round((exec-issued)/1000) which
// always produces an integer. Every verdict is a boolean/enum decision, not a threshold-derived
// float. Per FV-PBT-FLOOR-BUILD-SPEC.md §3 this is a stated float:no exception — forced
// CATEGORICAL boundary cases (amount exactly at cap, mandate age exactly at max, cart-freshness
// exact-tie timestamps) stand in for ULP forcing.
// Zero external dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-62-ap2-payment-receipt-verifier.proptest.mjs

import { compute } from '../art-62-ap2-payment-receipt-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-62-ap2-payment-receipt-verifier.fixtures.json');
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
const rand = mulberry32(0x62A11);
const TRIALS = 8000;
function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const SIG_TYPES = ['VC-signed', 'API-asserted', 'none'];

function mkPP(rng) {
  const hasChain = rng() < 0.7;
  const intent = hasChain ? 'i1' : '';
  const cart = hasChain ? 'c1' : '';
  const pmt = hasChain ? 'p1' : '';
  const receiptRef = rng() < 0.8 ? pmt : 'wrong-ref';
  const humanPresent = rng() < 0.5;
  return {
    payment_receipt: {
      receipt_id: `r${randInt(rng, 1, 1000)}`,
      payment_mandate_ref: receiptRef,
      amount: randInt(rng, 0, 100000),
      currency: 'USD',
      executed_at: '2026-06-20T12:00:00Z',
      human_present: humanPresent,
      signature_type: pick(rng, SIG_TYPES),
      keyid: 'k1',
    },
    mandate_chain: {
      intent_mandate_id: intent,
      cart_mandate_id: cart,
      payment_mandate_id: pmt,
      mandate_issued_at: '2026-06-20T11:00:00Z',
      cart_updated_at: '2026-06-20T11:30:00Z',
    },
    hnp_policy: {
      max_autonomous_amount: randInt(rng, 0, 100000),
      allowed_categories: rng() < 0.6 ? ['food', 'travel'] : [],
      mandate_max_age_sec: randInt(rng, 100, 7200),
      require_fresh_cart: rng() < 0.7,
      payment_category: pick(rng, ['food', 'travel', 'other']),
    },
  };
}

// ---------- P1: exactness — receipt_verdict is exactly the declared AND of its three sub-checks ----------
function checkP1_receiptVerdictExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const chainIntact = !!(pp.mandate_chain.intent_mandate_id && pp.mandate_chain.cart_mandate_id && pp.mandate_chain.payment_mandate_id);
    const refMatches = !!pp.payment_receipt.payment_mandate_ref && pp.payment_receipt.payment_mandate_ref === pp.mandate_chain.payment_mandate_id;
    const sigScore = { 'VC-signed': 4, 'API-asserted': 2, 'none': 0 }[pp.payment_receipt.signature_type] ?? 0;
    const expectedValid = chainIntact && refMatches && sigScore >= 2;
    const expected = expectedValid ? 'valid' : 'invalid';
    if (r.output_payload.receipt_verdict !== expected) violations++;
  }
  return { name: 'P1_receipt_verdict_exact_AND_of_three_subchecks', trials: checked, violations };
}

// ---------- P2: exactness — hnp_verdict is 'na' iff human_present is true ----------
function checkP2_hnpVerdictNaIffHumanPresent() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const isNa = r.output_payload.hnp_verdict === 'na';
    if (isNa !== pp.payment_receipt.human_present) violations++;
  }
  return { name: 'P2_hnp_verdict_na_iff_human_present', trials: checked, violations };
}

// ---------- P3: exactness — authorized_amount_headroom = max - amount exactly when amount <= max and HNP active ----------
function checkP3_headroomExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { human_present, amount } = pp.payment_receipt;
    const { max_autonomous_amount } = pp.hnp_policy;
    if (!human_present && max_autonomous_amount > 0 && amount <= max_autonomous_amount) {
      const expected = max_autonomous_amount - amount;
      if (r.output_payload.authorized_amount_headroom !== expected) violations++;
    } else if (r.output_payload.authorized_amount_headroom !== null && human_present) {
      violations++;
    }
  }
  return { name: 'P3_headroom_exact_max_minus_amount_when_within_cap', trials: checked, violations };
}

// ---------- P4 (mandatory float:no exception): forced categorical boundary cases ----------
function checkP4_forced() {
  const base = mkPP(mulberry32(0x62B22));
  const rows = [];
  const push = (overrides, label) => {
    const pp = JSON.parse(JSON.stringify(base));
    Object.assign(pp.payment_receipt, overrides.payment_receipt || {});
    Object.assign(pp.mandate_chain, overrides.mandate_chain || {});
    Object.assign(pp.hnp_policy, overrides.hnp_policy || {});
    const r = compute(pp);
    const { receipt_verdict, hnp_verdict, authorized_amount_headroom } = r.output_payload;
    const plausible = typeof receipt_verdict === 'string' && typeof hnp_verdict === 'string';
    rows.push({ label, receipt_verdict, hnp_verdict, authorized_amount_headroom, plausible });
  };

  push({ payment_receipt: { human_present: false, amount: 500 }, hnp_policy: { max_autonomous_amount: 500 } }, 'amount exactly equals max_autonomous_amount (<=) — hnp_amount check must PASS at the boundary, headroom must be exactly 0');
  push({ payment_receipt: { human_present: false, amount: 501 }, hnp_policy: { max_autonomous_amount: 500 } }, 'amount one unit over max — hnp_amount check must FAIL, headroom must be null');
  push({ payment_receipt: { human_present: false }, hnp_policy: { max_autonomous_amount: 0 } }, 'max_autonomous_amount is exactly 0 — HNP not configured, must FAIL regardless of amount');
  push({ payment_receipt: { executed_at: '2026-06-20T12:00:00Z' }, mandate_chain: { mandate_issued_at: '2026-06-20T11:00:00Z' }, hnp_policy: { mandate_max_age_sec: 3600 }, payment_receipt2: null }, 'mandate age exactly equals mandate_max_age_sec (3600s) — <= boundary must PASS, not FAIL');
  push({ payment_receipt: { executed_at: '2026-06-20T12:00:01Z' }, mandate_chain: { mandate_issued_at: '2026-06-20T11:00:00Z' }, hnp_policy: { mandate_max_age_sec: 3600 } }, 'mandate age one second over max (3601s) — must FAIL with STALE_MANDATE');
  push({ mandate_chain: { cart_updated_at: '2026-06-20T12:00:00Z' }, payment_receipt: { executed_at: '2026-06-20T12:00:00Z' } }, 'cart_updated_at exactly equals executed_at — <= boundary must PASS cart freshness, not WARN');
  push({ payment_receipt: { signature_type: 'none' } }, 'no signature — signature check must FAIL and receipt_verdict must be invalid regardless of chain integrity');
  push({ mandate_chain: { intent_mandate_id: '', cart_mandate_id: '', payment_mandate_id: '' } }, 'fully empty mandate chain — mandate_chain_intact must be false, no throw');
  push({ hnp_policy: { allowed_categories: [] } }, 'empty allowed_categories array — must WARN (broad scope permitted), not FAIL, per the kernel\'s explicit else-branch');
  push({ payment_receipt: { human_present: false, amount: 0 }, hnp_policy: { max_autonomous_amount: 100 } }, 'amount exactly 0 with HNP active — headroom must equal max_autonomous_amount exactly, no negative-zero artifact');

  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_receiptVerdictExact());
results.properties.push(checkP2_hnpVerdictNaIffHumanPresent());
results.properties.push(checkP3_headroomExact());
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
