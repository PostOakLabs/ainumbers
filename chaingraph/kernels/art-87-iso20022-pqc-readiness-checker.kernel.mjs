/**
 * art-87-iso20022-pqc-readiness-checker.kernel.mjs
 * Wave 18 — ISO 20022 PQC Readiness Checker.
 * Assesses the impact of post-quantum signature migration on ISO 20022
 * messaging, including BAH-level payload bloat (BIS Project Leap findings)
 * and maximum message size compliance.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Citations (verify before citing on any page):
 *   BIS Project Leap Phase 2 report — ML-DSA signature ≈ 12.9× RSA payload
 *     at BAH level (verify current BIS publication).
 *   NIST FIPS 204 (Aug 2024) — ML-DSA signature sizes.
 *   SWIFT BAH overhead — approximate 512 bytes (verify current SWIFT guidance).
 *   EDUCATIONAL: outputs are decision-support drafts.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-87-iso20022-pqc-readiness-checker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'check_iso20022_pqc_readiness',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

// BIS Project Leap Phase 2 — ML-DSA sig ≈ 12.9× RSA payload at BAH level (verify current BIS publication)
const BIS_LEAP_BLOAT_FACTOR = 12.9;

// NIST FIPS 204 (Aug 2024) ML-DSA signature sizes in bytes (verify current)
const ML_DSA_SIZES = {
  'ML-DSA-44': 2420,
  'ML-DSA-65': 3309,
  'ML-DSA-87': 4627,
};

// Legacy signature sizes
const RSA2048_SIG_BYTES  = 256; // RSA-2048
const ECDSA256_SIG_BYTES = 72;  // ECDSA P-256 (DER-encoded approximate)

// Approximate SWIFT BAH wrapper overhead in bytes (verify current SWIFT guidance)
const BAH_WRAPPER_BYTES = 512;

export function compute(pp) {
  const {
    messaging = {
      message_types:        [],
      signature_scheme:     'RSA2048',
      bah_present:          false,
      max_message_size_bytes: 32768,
    },
    pqc_algorithm    = 'ML-DSA-65',
    hndl_priority_ref = '',
  } = pp;

  const {
    message_types        = [],
    signature_scheme     = 'RSA2048',
    bah_present          = false,
    max_message_size_bytes = 32768,
  } = messaging;

  // --- Current signature size ---
  let current_sig_bytes;
  if (signature_scheme === 'RSA2048') {
    current_sig_bytes = RSA2048_SIG_BYTES;
  } else if (signature_scheme === 'ECDSA256') {
    current_sig_bytes = ECDSA256_SIG_BYTES;
  } else if (ML_DSA_SIZES[signature_scheme] !== undefined) {
    current_sig_bytes = ML_DSA_SIZES[signature_scheme];
  } else {
    current_sig_bytes = RSA2048_SIG_BYTES; // fallback
  }

  // --- New PQC signature size ---
  const new_sig_bytes = ML_DSA_SIZES[pqc_algorithm] ?? ML_DSA_SIZES['ML-DSA-65'];

  // --- New message size estimate ---
  // Baseline: assume existing message body is max_message_size_bytes minus current sig
  const baseline_body = Math.max(0, max_message_size_bytes - current_sig_bytes);
  const new_message_size_bytes = baseline_body + new_sig_bytes + (bah_present ? BAH_WRAPPER_BYTES : 0);

  // --- Size breach ---
  const size_breach = new_message_size_bytes > max_message_size_bytes;

  // --- Bloat factor ---
  const bloat_factor = +(new_sig_bytes / (current_sig_bytes || RSA2048_SIG_BYTES)).toFixed(1);

  // --- Readiness score (0–100) ---
  let readiness_score = 100;
  if (size_breach) readiness_score -= 30;
  if (!bah_present && pqc_algorithm.includes('87')) readiness_score -= 20;
  if (signature_scheme === 'RSA2048' || signature_scheme === 'ECDSA256') readiness_score -= 10;
  if (readiness_score < 0) readiness_score = 0;

  // --- Flags ---
  const compliance_flags = [];
  if (size_breach) compliance_flags.push('MESSAGE_SIZE_BREACH');
  if (bah_present && !signature_scheme.startsWith('ML-DSA')) {
    compliance_flags.push('BAH_SIGNATURE_NOT_PQC');
  }

  const output_payload = {
    readiness_score,
    current_sig_bytes,
    new_sig_bytes,
    new_message_size_bytes,
    size_breach,
    bloat_factor,
    affected_message_types: message_types.length > 0 ? message_types : [],
    bis_leap_ref:           'BIS Project Leap Phase 2 (verify current)',
    bis_leap_bloat_factor:  BIS_LEAP_BLOAT_FACTOR,
    algorithm_refs: {
      pqc_algorithm,
      bah_wrapper_bytes:      BAH_WRAPPER_BYTES,
      ml_dsa_sizes:           ML_DSA_SIZES,
    },
    hndl_priority_ref:      hndl_priority_ref || null,
    reference_version:      '2026-06',
    note: 'DECISION-SUPPORT DRAFT. BIS Project Leap Phase 2 bloat factor is indicative for BAH-level context — verify exact figures against the current BIS publication. ML-DSA sizes from NIST FIPS 204 (Aug 2024). BAH wrapper bytes are approximate; verify against current SWIFT messaging guidance.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    compute_mode:       'server',
    mandate_type:       meta.mandate_type,
    tool_id:            TOOL_ID,
    tool_version:       TOOL_VERSION,
    generated_at:       now ?? null,
    execution_hash:     hash,
    chain:              { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:  pp,
    output_payload,
    compliance_flags,
    audit_signature:    { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
