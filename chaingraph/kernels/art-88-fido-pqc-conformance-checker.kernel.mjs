/**
 * art-88-fido-pqc-conformance-checker.kernel.mjs
 * Wave 18 — FIDO PQC Conformance Checker.
 * Determines whether an authenticator's COSE algorithm support and CTAP
 * version meet the post-quantum conformance requirements defined by the
 * FIDO Alliance CTAP2.3 specification and IANA COSE Algorithm Registry.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Citations (verify before citing on any page):
 *   IANA COSE Algorithms Registry — ML-DSA COSE IDs (verify current IANA registry).
 *   FIDO Alliance CTAP2.3 specification — minimum version for native PQC (verify current).
 *   EDUCATIONAL: outputs are decision-support drafts.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-88-fido-pqc-conformance-checker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'check_fido_pqc_conformance',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

// IANA COSE Algorithms — ML-DSA algorithm IDs (verify current IANA registry)
const COSE_PQC_IDS = {
  'ML-DSA-44': -48,
  'ML-DSA-65': -49,
  'ML-DSA-87': -50,
};

// CTAP2.3 minimum version required for native PQC (FIDO Alliance CTAP2.3 spec — verify current)
const CTAP_23_REQUIRED = '2.3';

// Legacy COSE algorithm IDs: ES256/ES384/ES512/RS256/RS384/RS512 (verify IANA)
const LEGACY_COSE_ALGS = [-7, -35, -36, -257, -258, -259];

export function compute(pp) {
  const {
    authenticator = {
      cose_algorithms:    [],
      attestation_format: 'packed',
      ctap_version:       '2.0',
    },
    target_pqc = 'ML-DSA-65',
  } = pp;

  const {
    cose_algorithms    = [],
    attestation_format = 'packed',
    ctap_version       = '2.0',
  } = authenticator;

  // --- Target COSE ID ---
  const target_cose_id = COSE_PQC_IDS[target_pqc] ?? null;

  // --- Supported PQC COSE IDs ---
  const pqc_values = Object.values(COSE_PQC_IDS);
  const supported_pqc_cose_ids = cose_algorithms.filter(id => pqc_values.includes(id));

  // --- Legacy detection ---
  const legacy_algs_present = cose_algorithms.some(id => LEGACY_COSE_ALGS.includes(id));

  // --- CTAP version check ---
  // Compare as semver-like strings — pad to comparable form
  const ctap_pqc_ready = ctap_version >= CTAP_23_REQUIRED;

  // --- Conformance ---
  const target_supported = target_cose_id !== null && supported_pqc_cose_ids.includes(target_cose_id);
  const conformant = target_supported && ctap_pqc_ready;

  // --- Gaps ---
  const gaps = [];
  if (!target_supported) {
    gaps.push('Target COSE algorithm (' + target_pqc + ', ID ' + target_cose_id + ') not in supported list');
  }
  if (!ctap_pqc_ready) {
    gaps.push('CTAP version ' + ctap_version + ' < ' + CTAP_23_REQUIRED + ' — CTAP2.3 required for native PQC support');
  }
  if (attestation_format === 'none') {
    gaps.push('Attestation format "none" — cannot verify PQC algorithm support chain');
  }

  // --- Hybrid status ---
  let hybrid_status;
  if (supported_pqc_cose_ids.length > 0 && legacy_algs_present) {
    hybrid_status = 'hybrid';
  } else if (supported_pqc_cose_ids.length > 0) {
    hybrid_status = 'pqc_only';
  } else {
    hybrid_status = 'legacy_only';
  }

  // --- Flags ---
  const compliance_flags = [];
  if (supported_pqc_cose_ids.length === 0) {
    compliance_flags.push('NO_PQC_COSE_SUPPORT');
  }
  if (!ctap_pqc_ready) {
    compliance_flags.push('PRE_CTAP23');
  }

  const output_payload = {
    conformant,
    target_pqc,
    target_cose_id,
    supported_pqc_cose_ids,
    gaps,
    hybrid_status,
    ctap_pqc_ready,
    attestation_format,
    ctap_version,
    cose_pqc_registry: COSE_PQC_IDS,
    reference_version: '2026-06',
    note: 'DECISION-SUPPORT DRAFT. COSE PQC algorithm IDs from IANA COSE Algorithms Registry — verify current assignments. CTAP2.3 PQC requirement from FIDO Alliance CTAP2.3 specification — verify current version. ML-DSA COSE IDs may be updated as IANA registration progresses.',
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
