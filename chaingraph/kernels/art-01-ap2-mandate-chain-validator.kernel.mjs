// art-01 — AP2 Mandate-Chain Validator: pure decision kernel.
// Faithful port of the validateChain() logic in
//   repo/chaingraph/art-01-ap2-mandate-chain-validator.html  (checks 1–8).
// Pure: no DOM, no window, no network, no Date.now(), no randomness.
// Determinism requires an explicit validate_at — the browser tool currently
// defaults a blank field to new Date(), which is non-reproducible; the kernel
// makes it a required input so the same inputs always produce the same hash.
//
// CONTRACT CHANGE vs the shipped browser tool (see POC-ART01-FINDINGS-AND-WIRING.md):
//   policy_parameters now CARRIES the decision inputs (intent/cart/payment),
//   so the execution_hash actually anchors them. The hash is computed over the
//   SAME output_payload that ships in the artifact (not a separate reduced object).

import { executionHash } from './_hash.mjs';

const HEX64 = /^[0-9a-fA-F]{64}$/;
const TOOL_ID = 'art-01-ap2-mandate-chain-validator';
const TOOL_VERSION = '1.0.0';

/**
 * Pure compute. Throws on missing required inputs (caller maps to an MCP error).
 * @param {object} pp policy_parameters: { intent, cart?, payment, hnp_mode?, validate_at }
 * @returns {{ output_payload:object, compliance_flags:string[], verdict:string, checks:object[] }}
 */
export function compute(pp) {
  const { intent, payment } = pp;
  const cart = pp.cart ?? null;
  const hnp_mode = pp.hnp_mode ?? 'strict';
  if (!intent) throw new Error('policy_parameters.intent is required.');
  if (!payment) throw new Error('policy_parameters.payment is required.');
  if (!pp.validate_at) throw new Error('policy_parameters.validate_at (ISO 8601) is required for a reproducible hash.');
  const validateAt = new Date(pp.validate_at);
  if (isNaN(validateAt.getTime())) throw new Error('policy_parameters.validate_at is not a valid ISO timestamp.');

  const checks = [];

  /* 1. STRUCTURAL TYPE CHECKS */
  const intentTypeOk = intent.mandate_type === 'intent';
  const paymentTypeOk = payment.mandate_type === 'payment';
  const cartTypeOk = !cart || cart.mandate_type === 'cart';
  checks.push({ id: 'struct', name: 'Mandate type declarations', spec: 'AP2 v0.2 §2.1',
    status: (intentTypeOk && paymentTypeOk && cartTypeOk) ? 'pass' : 'fail',
    detail: (intentTypeOk && paymentTypeOk && cartTypeOk)
      ? 'All mandate_type fields correctly declared (intent / cart / payment).'
      : `Type errors: intent="${intent.mandate_type}" cart="${cart?.mandate_type || '–'}" payment="${payment.mandate_type}". Expected: intent/cart/payment.` });

  /* 2. PARENT MANDATE ID LINKAGE */
  let parentLinkOk = true; let parentLinkDetail = '';
  if (cart) {
    if (cart.parent_mandate_id !== intent.mandate_id) { parentLinkOk = false; parentLinkDetail += `Cart.parent_mandate_id "${cart.parent_mandate_id}" ≠ Intent.mandate_id "${intent.mandate_id}". `; }
    if (payment.parent_mandate_id !== cart.mandate_id) { parentLinkOk = false; parentLinkDetail += `Payment.parent_mandate_id "${payment.parent_mandate_id}" ≠ Cart.mandate_id "${cart.mandate_id}". `; }
  } else if (payment.parent_mandate_id !== intent.mandate_id) {
    parentLinkOk = false; parentLinkDetail = `Payment.parent_mandate_id "${payment.parent_mandate_id}" ≠ Intent.mandate_id "${intent.mandate_id}".`;
  }
  checks.push({ id: 'parent_id', name: 'Parent mandate ID linkage', spec: 'AP2 v0.2 §3.2',
    status: parentLinkOk ? 'pass' : 'fail',
    detail: parentLinkOk ? 'parent_mandate_id chain correctly links Intent → ' + (cart ? 'Cart → ' : '') + 'Payment.' : parentLinkDetail });

  /* 3. PARENT HASH PLAUSIBILITY */
  const hashChecks = [];
  if (cart && cart.parent_hash !== undefined) hashChecks.push(['cart.parent_hash', cart.parent_hash]);
  if (payment.parent_hash !== undefined) hashChecks.push(['payment.parent_hash', payment.parent_hash]);
  let hashFormatOk = true; let hashFormatDetail = '';
  hashChecks.forEach(([field, h]) => {
    if (!HEX64.test(h)) { hashFormatOk = false; hashFormatDetail += `${field} is not a valid 64-hex SHA-256 hash (got "${String(h).slice(0, 20)}…"). `; }
    else if (/^0+$/.test(h) || /^dead/i.test(h) || /^cafe/i.test(h)) { hashFormatOk = false; hashFormatDetail += `${field} appears to be a placeholder/sentinel value. `; }
  });
  if (hashChecks.length === 0) { hashFormatOk = false; hashFormatDetail = 'No parent_hash fields found in payment (or cart). Parent hashes are required per AP2 v0.2 §3.3.'; }
  checks.push({ id: 'parent_hash', name: 'Parent hash format & integrity', spec: 'AP2 v0.2 §3.3',
    status: hashFormatOk ? 'pass' : 'fail',
    detail: hashFormatOk ? 'All parent_hash fields pass format validation (64-hex SHA-256 plausible).' : hashFormatDetail });

  /* 4. TTL / EXPIRY */
  const ttlChecks = [['intent', intent], ...(cart ? [['cart', cart]] : []), ['payment', payment]];
  let ttlOk = true; const ttlDetails = [];
  ttlChecks.forEach(([name, m]) => {
    if (!m.expires_at) { ttlOk = false; ttlDetails.push(`${name}: missing expires_at field.`); return; }
    const exp = new Date(m.expires_at);
    if (isNaN(exp.getTime())) { ttlOk = false; ttlDetails.push(`${name}: expires_at "${m.expires_at}" is not a valid ISO timestamp.`); return; }
    if (exp <= validateAt) { ttlOk = false; ttlDetails.push(`${name}: EXPIRED — expires_at ${m.expires_at} ≤ validate-at ${validateAt.toISOString()}.`); }
    else ttlDetails.push(`${name}: valid until ${m.expires_at} (${Math.round((exp - validateAt) / 60000)} min remaining).`);
  });
  checks.push({ id: 'ttl', name: 'TTL / expiry validation', spec: 'AP2 v0.2 §4.1', status: ttlOk ? 'pass' : 'fail', detail: ttlDetails.join(' ') });

  /* 5. SCOPE CONSISTENCY */
  let scopeOk = true; const scopeDetails = [];
  const intentScope = intent.scope || {};
  const intentMerchants = intentScope.merchant_ids || [];
  const payMerchant = payment.merchant_id;
  const cartMerchant = cart?.merchant_id;
  if (intentMerchants.length > 0) {
    if (payMerchant && !intentMerchants.includes(payMerchant)) { scopeOk = false; scopeDetails.push(`Payment merchant "${payMerchant}" not in intent scope merchant_ids [${intentMerchants.join(', ')}].`); }
    else if (payMerchant) { scopeDetails.push(`Payment merchant "${payMerchant}" ✓ in scope.`); }
    if (cartMerchant && !intentMerchants.includes(cartMerchant)) { scopeOk = false; scopeDetails.push(`Cart merchant "${cartMerchant}" not in intent scope merchant_ids.`); }
  }
  const intentCurrency = intentScope.currency;
  [['cart', cart], ['payment', payment]].forEach(([name, m]) => {
    if (!m) return;
    if (intentCurrency && m.currency && m.currency !== intentCurrency) { scopeOk = false; scopeDetails.push(`${name}.currency "${m.currency}" ≠ intent.scope.currency "${intentCurrency}".`); }
  });
  if (scopeOk) scopeDetails.push('Merchant IDs and currency consistent across chain.');
  checks.push({ id: 'scope', name: 'Scope & merchant consistency', spec: 'AP2 v0.2 §3.4', status: scopeOk ? 'pass' : 'fail', detail: scopeDetails.join(' ') });

  /* 6. SPEND LIMIT ENFORCEMENT */
  let spendOk = true; const spendDetails = [];
  const maxAmount = intentScope.max_amount;
  const payAmount = payment.amount;
  const cartTotal = cart?.cart_total;
  if (maxAmount != null && payAmount != null) {
    if (payAmount > maxAmount) { spendOk = false; spendDetails.push(`Payment amount ${payAmount} ${payment.currency || ''} exceeds intent max_amount ${maxAmount} — over-spend of ${(payAmount - maxAmount).toFixed(2)}.`); }
    else { spendDetails.push(`Payment ${payAmount} ≤ intent max_amount ${maxAmount} ✓.`); }
  }
  if (cart && maxAmount != null && cartTotal != null) {
    if (cartTotal > maxAmount) { spendOk = false; spendDetails.push(`Cart total ${cartTotal} exceeds intent max_amount ${maxAmount}.`); }
  }
  if (cart && cartTotal != null && payAmount != null) {
    const tolerance = 0.01;
    if (payAmount > cartTotal + tolerance) { spendOk = false; spendDetails.push(`Payment amount ${payAmount} > cart_total ${cartTotal} (over-charge of ${(payAmount - cartTotal).toFixed(2)}).`); }
  }
  if (maxAmount == null) spendDetails.push('Intent has no max_amount — no ceiling enforced (informational).');
  checks.push({ id: 'spend', name: 'Spend limit enforcement', spec: 'AP2 v0.2 §5.1', status: spendOk ? 'pass' : 'fail', detail: spendDetails.join(' ') || 'Spend limits consistent.' });

  /* 7. HNP (HUMAN-NOT-PRESENT) FLAG CONSISTENCY */
  if (hnp_mode !== 'off') {
    const intentHnp = intent.human_not_present;
    const paymentHnp = payment.human_not_present;
    let hnpOk = true; const hnpDetails = [];
    if (intentHnp === true) {
      if (paymentHnp !== true) { hnpOk = false; hnpDetails.push(`Intent declares human_not_present:true but payment.human_not_present is "${paymentHnp}". HNP flag must propagate to Payment per AP2 v0.2 §6.2.`); }
      else { hnpDetails.push('HNP flag correctly propagated from Intent to Payment.'); }
      const policy = intent.hnp_policy;
      if (policy && policy.allowed_payment_methods && payment.payment_method) {
        if (!policy.allowed_payment_methods.includes(payment.payment_method)) { hnpOk = false; hnpDetails.push(`Payment method "${payment.payment_method}" not in hnp_policy.allowed_payment_methods [${policy.allowed_payment_methods.join(', ')}].`); }
      }
      if (policy && policy.require_human_review_above != null && payAmount != null) {
        if (payAmount > policy.require_human_review_above) { hnpOk = false; hnpDetails.push(`Payment amount ${payAmount} > hnp_policy.require_human_review_above ${policy.require_human_review_above} — human review required for this amount.`); }
      }
    } else {
      hnpDetails.push('Intent is human-present (human_not_present falsy) — HNP checks N/A.');
    }
    checks.push({ id: 'hnp', name: 'Human-Not-Present (HNP) flow flags', spec: 'AP2 v0.2 §6.2',
      status: hnpOk ? 'pass' : (hnp_mode === 'lenient' ? 'warn' : 'fail'), detail: hnpDetails.join(' ') });
  } else {
    checks.push({ id: 'hnp', name: 'Human-Not-Present (HNP) flow flags', spec: 'AP2 v0.2 §6.2', status: 'skip', detail: 'HNP checks disabled in settings.' });
  }

  /* 8. ISSUED_AT SANITY */
  let issuedOk = true; const issuedDetails = [];
  const mandatesForIssuedCheck = [['intent', intent], ...(cart ? [['cart', cart]] : []), ['payment', payment]];
  mandatesForIssuedCheck.forEach(([name, m]) => {
    if (!m.issued_at) { issuedDetails.push(`${name}: missing issued_at.`); issuedOk = false; return; }
    const iss = new Date(m.issued_at);
    if (isNaN(iss.getTime())) { issuedDetails.push(`${name}: issued_at not a valid ISO timestamp.`); issuedOk = false; return; }
    const exp = m.expires_at ? new Date(m.expires_at) : null;
    if (exp && iss >= exp) { issuedDetails.push(`${name}: issued_at ${m.issued_at} ≥ expires_at — invalid window.`); issuedOk = false; }
  });
  if (issuedOk) issuedDetails.push('All issued_at timestamps valid and precede expires_at.');
  checks.push({ id: 'issued_at', name: 'Issued-at / timestamp sanity', spec: 'AP2 v0.2 §4.2', status: issuedOk ? 'pass' : 'fail', detail: issuedDetails.join(' ') });

  /* OVERALL */
  const failing = checks.filter((c) => c.status === 'fail');
  const warnings = checks.filter((c) => c.status === 'warn');
  const verdict = failing.length > 0 ? 'FAIL' : warnings.length > 0 ? 'WARN' : 'PASS';

  // output_payload mirrors the shape the browser artifact ships (HTML lines 756–764),
  // so the hash is computed over exactly what is stored in the artifact.
  const output_payload = {
    validation_verdict: verdict,
    checks_run: checks.length,
    failing_checks: failing.map((c) => ({ id: c.id, detail: c.detail.slice(0, 200) })),
    warning_checks: warnings.map((c) => c.id),
    mandate_ids: { intent: intent.mandate_id, cart: cart?.mandate_id || null, payment: payment.mandate_id },
    has_cart: !!cart,
    human_not_present: !!intent.human_not_present,
  };

  const compliance_flags = verdict === 'PASS'
    ? ['AP2_MANDATE_CHAIN_VALID']
    : verdict === 'WARN'
      ? ['AP2_MANDATE_CHAIN_WARN']
      : ['AP2_MANDATE_CHAIN_INVALID', ...failing.map((c) => `CHECK_FAIL_${c.id.toUpperCase()}`)];

  return { output_payload, compliance_flags, verdict, checks };
}

// Build the full v0.4 artifact envelope, hash included. `now` and chain wiring
// are injected by the caller so the kernel stays pure (timestamps are framing,
// outside the hash preimage).
export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags, verdict } = compute(pp);
  const execution_hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    'dct:conformsTo': ['https://github.com/google-agentic-commerce/AP2/tree/v0.2'],
    ap2_version: '1.0.0', // deprecated alias, retained for back-compat
    mandate_type: 'payment_mandate',
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
    _verdict: verdict,
  };
}

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, gpu: false, mandate_type: 'payment_mandate' };
