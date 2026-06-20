/**
 * art-62-ap2-payment-receipt-verifier.kernel.mjs
 * Wave 14 — AP2 PaymentReceipt Verifier & Human-Not-Present (HNP) Guardrail (W-B flagship).
 * Verifies an AP2 v0.2 PaymentReceipt against its signed Intent/Cart/Payment mandate chain,
 * and applies the "Human Not Present" autonomy guardrail — does this autonomous payment fall
 * within the mandate's scope, caps, freshness, and category whitelist?
 *
 * Runtime/post-trade reframe vs art-01 (ap2-mandate-chain-validator):
 *   art-01 validates the mandate chain BEFORE the buy (pre-trade intent/authorization).
 *   ART-62 verifies the receipt AFTER the executed payment (post-trade receipt verification
 *   + HNP gating), which is an AP2 v0.2 primitive — not in the art-01 wave 6 scope.
 *
 * Pure decision kernel — no DOM, no window, no Date.now().
 * Citations (verify against current primary sources):
 *   AP2 v0.2 (Agent Payments Protocol) — Intent/Cart/Payment Mandates, PaymentReceipt,
 *     Human-Not-Present autonomous payments: https://ap2-protocol.org/
 *     https://github.com/google-agentic-commerce/AP2
 *   Google donates AP2 to FIDO Alliance (Apr 2026, 60+ orgs):
 *     https://blog.google/products-and-platforms/platforms/google-pay/agent-payments-protocol-fido-alliance/
 *   W3C Verifiable Credentials (mandate/receipt signing).
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-62-ap2-payment-receipt-verifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'verify_ap2_payment_receipt',
  mandate_type: 'attestation_mandate',
  gpu:          false,
};

// Signature check levels (educational approximation — not a real cryptographic verifier)
const SIG_LEVELS = {
  'VC-signed':       { score: 4, label: 'W3C Verifiable Credential — signed mandate chain' },
  'API-asserted':    { score: 2, label: 'API-asserted — no cryptographic signature' },
  'none':            { score: 0, label: 'No signature present' },
};

export function compute(pp) {
  const {
    payment_receipt = {},
    mandate_chain   = {},
    hnp_policy      = {},
  } = pp;

  const {
    receipt_id            = '',
    payment_mandate_ref   = '',
    amount                = 0,
    currency              = 'USD',
    executed_at           = '',
    human_present         = true,
    signature_type        = 'none',  // 'VC-signed' | 'API-asserted' | 'none'
    keyid                 = '',
  } = payment_receipt;

  const {
    intent_mandate_id    = '',
    cart_mandate_id      = '',
    payment_mandate_id   = '',
    mandate_issued_at    = '',
    cart_updated_at      = '',
  } = mandate_chain;

  const {
    max_autonomous_amount = 0,     // minor units; 0 = HNP not configured
    allowed_categories    = [],
    mandate_max_age_sec   = 3600,
    require_fresh_cart    = true,
    payment_category      = '',    // Category of this payment (must be in allowed_categories)
  } = hnp_policy;

  const findings = [];

  // --- 1. Mandate chain integrity ---
  const mandate_chain_intact = !!(intent_mandate_id && cart_mandate_id && payment_mandate_id);
  if (!mandate_chain_intact) {
    findings.push({ check: 'mandate_chain_intact', result: 'FAIL', detail: 'One or more mandate chain IDs (intent/cart/payment) are missing.' });
  } else {
    findings.push({ check: 'mandate_chain_intact', result: 'PASS', detail: 'Intent, Cart, and Payment mandate IDs all present.' });
  }

  // Check that the receipt references the payment mandate
  const mandate_ref_matches = !!payment_mandate_ref && payment_mandate_ref === payment_mandate_id;
  if (mandate_chain_intact) {
    if (mandate_ref_matches) {
      findings.push({ check: 'receipt_mandate_ref', result: 'PASS', detail: 'Receipt payment_mandate_ref matches the mandate chain payment_mandate_id.' });
    } else {
      findings.push({ check: 'receipt_mandate_ref', result: 'FAIL', detail: 'Receipt payment_mandate_ref does not match mandate chain payment_mandate_id.' });
    }
  }

  // --- 2. Signature verification (educational approximation) ---
  const sig_level = SIG_LEVELS[signature_type] ?? SIG_LEVELS['none'];
  const signature_check = sig_level.label;
  if (sig_level.score === 4) {
    findings.push({ check: 'signature', result: 'PASS', detail: signature_check });
  } else if (sig_level.score === 2) {
    findings.push({ check: 'signature', result: 'WARN', detail: signature_check + ' — VC-signed mandate chain recommended for production.' });
  } else {
    findings.push({ check: 'signature', result: 'FAIL', detail: 'No signature on receipt or mandate chain.' });
  }

  // --- 3. Receipt verdict ---
  const receipt_valid = mandate_chain_intact && mandate_ref_matches && sig_level.score >= 2;
  const receipt_verdict = receipt_valid ? 'valid' : 'invalid';

  // --- 4. HNP guardrail (only if human_present is false) ---
  let hnp_verdict = 'na';
  let authorized_amount_headroom = null;

  if (!human_present) {
    const hnp_checks = [];

    // Amount check
    if (max_autonomous_amount > 0) {
      const amt = Number(amount);
      if (amt <= max_autonomous_amount) {
        hnp_checks.push({ check: 'hnp_amount', result: 'PASS', detail: `Amount ${amt} ${currency} ≤ max_autonomous_amount ${max_autonomous_amount}` });
        authorized_amount_headroom = max_autonomous_amount - amt;
      } else {
        hnp_checks.push({ check: 'hnp_amount', result: 'FAIL', detail: `Amount ${amt} ${currency} exceeds max_autonomous_amount ${max_autonomous_amount}` });
      }
    } else {
      hnp_checks.push({ check: 'hnp_amount', result: 'FAIL', detail: 'max_autonomous_amount is 0 or not configured — HNP not permitted.' });
    }

    // Category check
    if (allowed_categories.length > 0) {
      if (allowed_categories.includes(payment_category)) {
        hnp_checks.push({ check: 'hnp_category', result: 'PASS', detail: `Category "${payment_category}" is in allowed_categories.` });
      } else {
        hnp_checks.push({ check: 'hnp_category', result: 'FAIL', detail: `Category "${payment_category}" is NOT in allowed_categories [${allowed_categories.join(', ')}].` });
      }
    } else {
      hnp_checks.push({ check: 'hnp_category', result: 'WARN', detail: 'No allowed_categories configured — all categories permitted (broad scope).' });
    }

    // Mandate age check
    if (mandate_issued_at && mandate_max_age_sec > 0) {
      let mandate_age_sec = null;
      try {
        const issued = new Date(mandate_issued_at).getTime();
        const exec   = executed_at ? new Date(executed_at).getTime() : null;
        if (!isNaN(issued) && exec !== null && !isNaN(exec)) {
          mandate_age_sec = Math.round((exec - issued) / 1000);
        }
      } catch (_) {}
      if (mandate_age_sec !== null) {
        if (mandate_age_sec <= mandate_max_age_sec) {
          hnp_checks.push({ check: 'hnp_mandate_age', result: 'PASS', detail: `Mandate age ${mandate_age_sec}s ≤ max ${mandate_max_age_sec}s` });
        } else {
          hnp_checks.push({ check: 'hnp_mandate_age', result: 'FAIL', detail: `Mandate age ${mandate_age_sec}s exceeds max ${mandate_max_age_sec}s — STALE_MANDATE.` });
        }
      } else {
        hnp_checks.push({ check: 'hnp_mandate_age', result: 'WARN', detail: 'Cannot compute mandate age — mandate_issued_at or executed_at missing or unparseable.' });
      }
    }

    // Cart freshness check
    if (require_fresh_cart) {
      if (cart_updated_at && executed_at) {
        try {
          const cartUpdated = new Date(cart_updated_at).getTime();
          const execTime    = new Date(executed_at).getTime();
          if (!isNaN(cartUpdated) && !isNaN(execTime) && cartUpdated <= execTime) {
            hnp_checks.push({ check: 'hnp_cart_fresh', result: 'PASS', detail: 'Cart mandate updated before or at execution.' });
          } else {
            hnp_checks.push({ check: 'hnp_cart_fresh', result: 'WARN', detail: 'Cart freshness check inconclusive — timestamps may be in wrong order.' });
          }
        } catch (_) {
          hnp_checks.push({ check: 'hnp_cart_fresh', result: 'WARN', detail: 'Cannot verify cart freshness — timestamp parse error.' });
        }
      } else {
        hnp_checks.push({ check: 'hnp_cart_fresh', result: 'WARN', detail: 'require_fresh_cart is true but cart_updated_at or executed_at missing.' });
      }
    }

    findings.push(...hnp_checks);

    // HNP verdict: all PASS (or acceptable WARN for category) → authorized
    const hnp_fails = hnp_checks.filter(c => c.result === 'FAIL');
    hnp_verdict = hnp_fails.length === 0 ? 'authorized' : 'blocked';
  }

  // --- 5. Compliance flags ---
  const compliance_flags = [];
  if (receipt_verdict === 'invalid') {
    if (!mandate_ref_matches) compliance_flags.push('RECEIPT_MANDATE_MISMATCH');
    if (sig_level.score === 0) compliance_flags.push('SIGNATURE_INVALID');
  }
  if (!human_present && hnp_verdict === 'blocked') compliance_flags.push('HNP_OUT_OF_POLICY');
  const stale_finding = findings.find(f => f.check === 'hnp_mandate_age' && f.result === 'FAIL');
  if (stale_finding) compliance_flags.push('STALE_MANDATE');

  const output_payload = {
    receipt_verdict,
    mandate_chain_intact,
    hnp_verdict,
    findings,
    signature_check,
    authorized_amount_headroom,
    receipt_id: receipt_id || null,
    human_present,
    note: 'Educational AP2 v0.2 PaymentReceipt verifier and HNP guardrail. Runtime/post-trade — verifies the receipt AFTER an executed payment. art-01 validates the mandate chain BEFORE the buy (pre-trade). Signature verification is an educational approximation — production implementations must use a real VC verifier against the AP2 v0.2 FIDO Alliance spec. Not legal or payment advice. Verify AP2 v0.2 rules against current FIDO Alliance / ap2-protocol.org primary sources (2026-06-20).',
    status_asof: '2026-06-20 — verify AP2 v0.2: https://ap2-protocol.org/ · FIDO Alliance governance',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':          'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version:  '0.4.0',
    mandate_type:        meta.mandate_type,
    tool_id:             TOOL_ID,
    tool_version:        TOOL_VERSION,
    generated_at:        now ?? null,
    execution_hash:      hash,
    chain:               { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:   pp,
    output_payload,
    compliance_flags,
    compute_mode:        'server',
    audit_signature:     { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
