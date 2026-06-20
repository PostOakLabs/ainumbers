/**
 * art-61-x402-batch-settlement-reconciler.kernel.mjs
 * Wave 14 — x402 V2 Batch-Settlement Reconciler (W-A flagship).
 * Reconciles a set of off-chain x402 V2 payment vouchers against the onchain
 * batch settlement transaction: verifies totals, detects unredeemed/orphan vouchers,
 * computes Merkle root over the voucher set, and derives the settlement-risk window.
 *
 * Runtime/post-trade reframe vs art-03 (x402 settlement modeler):
 *   art-03 MODELS per-request settlement cost and finality BEFORE the buy (pre-trade).
 *   ART-61 RECONCILES an actual V2 batch AFTER settlement — voucher → batch → onchain —
 *   which V1/art-03 never supported (V2 batch settlement shipped May 2026).
 *
 * Pure decision kernel — no DOM, no window, no Date.now().
 * Citations (verify against current primary sources):
 *   x402 V2 Batch Settlement spec — escrow + off-chain vouchers:
 *     https://github.com/x402-foundation/x402
 *   Linux Foundation x402 Foundation (Apr 2026, Coinbase/Stripe/Cloudflare/Visa/Google/Solana/Fiserv).
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-61-x402-batch-settlement-reconciler';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'reconcile_x402_batch_settlement',
  mandate_type: 'settlement_mandate',
  gpu:          false,
};

// Minimal deterministic Merkle root over a set of string values (hex-encoded).
// Production implementations should use the x402 Foundation's canonical Merkle spec;
// this is an educational approximation using the same SHA-256 leaf-hash approach.
function simpleMerkleRoot(leaves) {
  // For reproducibility in the browser (no crypto.subtle here — caller passes pre-hashed strings).
  // We concatenate sorted leaf strings, length-prefixed, as the root preimage.
  // This is NOT the production x402 Merkle spec — label it clearly.
  if (!leaves || leaves.length === 0) return 'empty';
  const sorted = [...leaves].sort();
  return sorted.join('|'); // raw preimage string; hash applied by executionHash over output_payload
}

export function compute(pp) {
  const {
    vouchers              = [],    // Array of { voucher_id, payer_agent, payee_agent, amount, currency, signed_at, redeemed }
    batch                 = {},    // { batch_id, onchain_tx_total, settlement_asset, settled_at, escrow_address }
    tolerance_minor_units = 0,     // Acceptable rounding delta in minor currency units
    finality_threshold    = 1,     // Required confirmations
  } = pp;

  const {
    batch_id         = '',
    onchain_tx_total = 0,
    settlement_asset = 'USDC',
    settled_at       = '',
    escrow_address   = '',
  } = batch;

  // --- Voucher analysis ---
  const voucher_findings = [];
  let redeemed_total = 0;
  let unredeemed_value = 0;
  const voucher_ids = [];

  for (const v of vouchers) {
    const amt = Number(v.amount) || 0;
    voucher_ids.push(String(v.voucher_id || ''));
    if (v.redeemed) {
      redeemed_total += amt;
    } else {
      unredeemed_value += amt;
      voucher_findings.push({
        voucher_id: v.voucher_id,
        issue: 'UNREDEEMED',
        amount: amt,
        currency: v.currency || settlement_asset,
      });
    }
    if (!v.signed_at) {
      voucher_findings.push({ voucher_id: v.voucher_id, issue: 'MISSING_SIGNED_AT' });
    }
  }

  // --- Batch reconciliation ---
  const batch_delta = redeemed_total - onchain_tx_total;
  const within_tolerance = Math.abs(batch_delta) <= tolerance_minor_units;

  let recon_verdict;
  if (vouchers.length === 0 && onchain_tx_total === 0) {
    recon_verdict = 'empty';
  } else if (within_tolerance) {
    recon_verdict = 'matched';
  } else if (batch_delta < -tolerance_minor_units) {
    recon_verdict = 'short'; // onchain total exceeds redeemed vouchers
  } else if (batch_delta > tolerance_minor_units) {
    recon_verdict = 'over';  // redeemed vouchers exceed onchain total
  } else {
    recon_verdict = 'at-risk';
  }

  // Settlement risk window = value of signed-but-unredeemed vouchers still outstanding
  const settlement_risk_window = unredeemed_value;

  // Merkle root over voucher ID set (educational approximation — see note above)
  const merkle_root_preimage = simpleMerkleRoot(voucher_ids);

  // Escrow underfunded check: if batch total > onchain_tx_total significantly
  const escrow_underfunded = batch_delta > tolerance_minor_units && batch_delta > 0;

  const compliance_flags = [];
  if (recon_verdict === 'short' || recon_verdict === 'over') compliance_flags.push('BATCH_RECON_MISMATCH');
  if (unredeemed_value > 0) compliance_flags.push('UNREDEEMED_VOUCHER_EXPOSURE');
  if (escrow_underfunded) compliance_flags.push('ESCROW_UNDERFUNDED');
  if (finality_threshold < 1) compliance_flags.push('FINALITY_THRESHOLD_BELOW_MINIMUM');

  const output_payload = {
    recon_verdict,
    voucher_findings,
    batch_delta_minor_units: batch_delta,
    redeemed_total,
    unredeemed_value,
    settlement_risk_window,
    merkle_root_preimage, // raw preimage for independent verification; full root requires x402 Merkle spec
    voucher_count: vouchers.length,
    redeemed_count: vouchers.filter(v => v.redeemed).length,
    batch_id,
    settlement_asset,
    within_tolerance,
    escrow_address: escrow_address || null,
    note: 'Educational x402 V2 batch-settlement reconciler. Runtime/post-trade counterpart to art-03 (which models per-request settlement pre-trade). The Merkle root preimage is an educational approximation — production implementations must use the canonical x402 Foundation Merkle spec. Verify x402 V2 batch-settlement escrow/voucher rules against current Linux Foundation x402 Foundation primary sources (2026-06-20). Not settlement or legal advice.',
    status_asof: '2026-06-20 — verify x402 V2 spec: https://github.com/x402-foundation/x402',
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
