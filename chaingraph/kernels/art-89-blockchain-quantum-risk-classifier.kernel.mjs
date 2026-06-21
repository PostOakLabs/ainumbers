/**
 * art-89-blockchain-quantum-risk-classifier.kernel.mjs
 * Wave 18 — Blockchain Quantum Risk Classifier.
 * Classifies the quantum risk tier for a blockchain asset based on
 * signature scheme, exposed public-key share, address-reuse rate,
 * and migration roadmap status.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Citations (verify before citing on any page):
 *   Citi Digital Assets Research (May 2026) — exposed public-key analysis
 *     approach for quantum risk tiering (verify current publication).
 *   Bitcoin BIP-360 — quantum-safe address proposal (verify current BIP status).
 *   EDUCATIONAL: outputs are decision-support drafts.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-89-blockchain-quantum-risk-classifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'classify_blockchain_quantum_risk',
  mandate_type: 'model_governance',
  gpu:          false,
};

// Exposed public-key percentage thresholds for quantum risk tiering.
// No canonical regulatory standard; derived from Citi Digital Assets Research
// May 2026 analysis approach — verify current publication.
const EXPOSURE_THRESHOLDS = {
  high:   25, // % exposed pubkeys
  medium: 10,
};

// Bitcoin BIP-360 — quantum-safe address proposal status (verify current BIP status)
const BIP360_STATUS = 'proposed';

// Known migration roadmap references per signature scheme
// Sources: BIP tracker, Ethereum EIP tracker, XRP Ledger roadmap discussions (verify current)
const SCHEME_ROADMAP = {
  'ECDSA': {
    bitcoin:  'BIP-360 proposed',
    ethereum: 'EIP proposed',
    xrpl:     'roadmap discussed',
  },
  'EdDSA': {
    solana: 'no roadmap',
    xrpl:   'roadmap discussed',
  },
  'Schnorr': {
    bitcoin: 'BIP-360 proposed',
  },
  'ML-DSA': {
    status: 'already_pqc',
  },
};

export function compute(pp) {
  const {
    chain = {
      signature_scheme:    'ECDSA',
      exposed_pubkey_pct:  0,
      address_reuse_pct:   0,
      migration_roadmap:   'none',
    },
    asset_type = 'L1',
  } = pp;

  const {
    signature_scheme   = 'ECDSA',
    exposed_pubkey_pct = 0,
    address_reuse_pct  = 0,
    migration_roadmap  = 'none',
  } = chain;

  // --- Already PQC ---
  if (signature_scheme === 'ML-DSA') {
    const output_payload = {
      quantum_risk_tier:   'none',
      exposed_pct:         exposed_pubkey_pct,
      reuse_risk:          'low',
      migration_readiness: 'complete',
      roadmap_ref:         SCHEME_ROADMAP['ML-DSA'] || {},
      asset_type,
      signature_scheme,
      bip360_status:       BIP360_STATUS,
      reference_version:   '2026-06',
      note: 'ML-DSA signature scheme is post-quantum — no classical quantum risk. Verify implementation follows NIST FIPS 204 (Aug 2024).',
    };
    return { output_payload, compliance_flags: [] };
  }

  // --- Quantum risk tier ---
  const exposed_pct = exposed_pubkey_pct;
  let quantum_risk_tier;
  if (exposed_pct >= EXPOSURE_THRESHOLDS.high && migration_roadmap === 'none') {
    quantum_risk_tier = 'critical';
  } else if (exposed_pct >= EXPOSURE_THRESHOLDS.high) {
    quantum_risk_tier = 'high';
  } else if (exposed_pct >= EXPOSURE_THRESHOLDS.medium) {
    quantum_risk_tier = 'medium';
  } else {
    quantum_risk_tier = 'low';
  }

  // --- Migration readiness ---
  const migration_readiness =
    migration_roadmap === 'defined'   ? 'roadmap_defined' :
    migration_roadmap === 'proposed'  ? 'roadmap_proposed' :
    'no_roadmap';

  // --- Address reuse risk ---
  const reuse_risk =
    address_reuse_pct > 30 ? 'high' :
    address_reuse_pct > 10 ? 'medium' :
    'low';

  // --- Roadmap reference ---
  const roadmap_ref = SCHEME_ROADMAP[signature_scheme] || {};

  // --- Flags ---
  const compliance_flags = [];
  if (exposed_pct >= EXPOSURE_THRESHOLDS.high) {
    compliance_flags.push('HIGH_EXPOSED_PUBKEY_SHARE');
  }
  if (migration_roadmap === 'none') {
    compliance_flags.push('NO_MIGRATION_ROADMAP');
  }

  const output_payload = {
    quantum_risk_tier,
    exposed_pct,
    reuse_risk,
    migration_readiness,
    roadmap_ref,
    asset_type,
    signature_scheme,
    address_reuse_pct,
    exposure_thresholds: EXPOSURE_THRESHOLDS,
    bip360_status:       BIP360_STATUS,
    reference_version:   '2026-06',
    note: 'DECISION-SUPPORT DRAFT. Exposure thresholds derived from Citi Digital Assets Research (May 2026) analysis approach — verify current publication. BIP-360 and chain-specific PQC proposals are evolving; verify current status at BIP tracker and respective chain governance forums.',
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
