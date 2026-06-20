/**
 * art-58-cross-network-settlement-validator.kernel.mjs
 * Wave 13 — Cross-Network Atomic Settlement Validator (W-A flagship).
 * Validates atomic settlement across two or more networks:
 *   cash leg final on money ledger, asset leg delivered on asset ledger,
 *   FX leg PvP where present.
 * Models BIS Agorá unifying-ledger / ECB Pontes TARGET-link / DTCC Collateral AppChain
 * coordination patterns.
 * Distinct from Wave 8 Canton single-network DvP (507) — this checks the
 * CROSS-NETWORK seam: coordination mechanism between two separate ledgers.
 * Pure decision kernel — no DOM, no window, no Date.now().
 * §13.4 enhancements: xbrl:ocg-ext export profile.
 * Citations (verify against current primary sources):
 *   BIS Project Agorá (atomic cross-currency settlement, unifying ledger);
 *   CPMI-IOSCO PFMI Principle 12 (DvP); PFMI Principle 8 (finality);
 *   ECB Pontes (TARGET link — pilot end-Q3 2026). Educational estimator.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-58-cross-network-settlement-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'validate_cross_network_settlement',
  mandate_type: 'settlement_mandate',
  gpu:          false,
};

// Atomicity scores per coordination mechanism (4 = best)
const ATOMICITY_SCORE = {
  'shared-ledger':   4,
  'HTLC':            3,
  'notary-signature': 2,
  'trusted-bridge':  1,
  'unsynchronised':  0,
};

// Finality tier weights for compatibility check (1 = legally final, 4 = unclear)
const FINALITY_RANK = {
  'deterministic': 1,  // SFD / PFMI-designated
  'legal-designated': 1,
  'probabilistic': 3,  // PoW-style probabilistic confirmation
};

function getRank(model) { return FINALITY_RANK[model] ?? 2; }

export function compute(pp) {
  const {
    networks              = [],
    coordination_mechanism= 'unsynchronised',
    legs                  = [],
    timeout_window_sec    = 300,
    rollback_supported    = false,
    pvp_required          = false,
  } = pp;

  const nets = Array.isArray(networks) ? networks : [];
  const legsArr = Array.isArray(legs) ? legs : [];

  // 1. Atomicity verdict
  const atomicity_score = ATOMICITY_SCORE[coordination_mechanism] ?? 0;
  let atomicity_verdict;
  if (atomicity_score === 4)      atomicity_verdict = 'atomic';
  else if (atomicity_score >= 2)  atomicity_verdict = 'partial';
  else                            atomicity_verdict = 'at-risk';

  // 2. Finality compatibility: no leg with weaker finality should gate a leg with stronger
  const leg_findings = [];
  const finality_ranks = nets.map(n => ({ role: n.role, rank: getRank(n.finality_model ?? 'probabilistic') }));
  const cashNet   = finality_ranks.find(r => r.role === 'cash');
  const assetNet  = finality_ranks.find(r => r.role === 'asset');
  const fxNet     = finality_ranks.find(r => r.role === 'fx');

  if (cashNet && assetNet && cashNet.rank > assetNet.rank) {
    leg_findings.push({
      leg: 'cash→asset',
      finality: 'mismatch',
      issue: 'Cash leg has weaker finality (rank ' + cashNet.rank + ') than asset leg (rank ' + assetNet.rank + '). Probabilistic cash cannot safely gate legally-final asset delivery.',
    });
  }
  if (fxNet && cashNet && fxNet.rank > cashNet.rank) {
    leg_findings.push({
      leg: 'fx→cash',
      finality: 'mismatch',
      issue: 'FX leg finality (rank ' + fxNet.rank + ') weaker than cash leg (rank ' + cashNet.rank + '). PvP safety compromised.',
    });
  }
  for (const leg of legsArr) {
    if (leg.conditional_on && leg.conditional_on.length === 0 && atomicity_verdict !== 'atomic') {
      leg_findings.push({
        leg: leg.leg_type ?? 'unknown',
        finality: 'unconditional',
        issue: leg.leg_type + ' leg has no conditional_on dependencies — settlement is not atomic across all legs.',
      });
    }
  }

  // 3. PvP check
  const pvp_check = pvp_required
    ? (coordination_mechanism === 'shared-ledger' || coordination_mechanism === 'HTLC'
        ? 'PVP_SUPPORTED'
        : 'PVP_AT_RISK')
    : 'PVP_NOT_REQUIRED';

  // 4. Settlement risk window
  // Risk window = timeout_window_sec if HTLC; 0 for shared-ledger; open-ended for unsynchronised
  const settlement_risk_window_sec =
    atomicity_verdict === 'atomic'   ? 0 :
    atomicity_verdict === 'partial'  ? timeout_window_sec :
    /* at-risk */                      timeout_window_sec * 10;

  // 5. Residual exposure (qualitative)
  const residual_exposure =
    atomicity_verdict === 'atomic'  ? 'none' :
    atomicity_verdict === 'partial' ? 'limited (within HTLC/notary timeout window)' :
    /* at-risk */                      'open (unsynchronised — one leg may settle while the other fails)';

  // 6. Coordination recommendation
  let coordination_recommendation;
  if (coordination_mechanism === 'shared-ledger') {
    coordination_recommendation = 'Shared-ledger lock provides strongest atomicity guarantee. Verify SFD designation of the locking ledger.';
  } else if (coordination_mechanism === 'HTLC') {
    coordination_recommendation = 'HTLC achieves conditional atomicity within timeout_window_sec. Ensure timeout is long enough for cross-network confirmation latency and short enough to limit exposure.';
  } else if (coordination_mechanism === 'notary-signature') {
    coordination_recommendation = 'Notary-signature reduces but does not eliminate principal risk. The notary is a trust anchor — ensure multi-party signing and legal finality of the notary confirmation.';
  } else if (coordination_mechanism === 'trusted-bridge') {
    coordination_recommendation = 'Trusted-bridge introduces a custodial intermediary. Assess bridge operator risk, redemption finality, and wrapping/unwrapping finality loss.';
  } else {
    coordination_recommendation = 'Unsynchronised settlement carries open principal risk. Upgrade to HTLC, shared-ledger lock, or notary-signature coordination. Consider BIS Agorá unifying-ledger / ECB Pontes TARGET-link / DTCC Collateral AppChain pattern.';
  }

  const output_payload = {
    atomicity_verdict,
    leg_findings,
    settlement_risk_window_sec,
    pvp_check,
    coordination_recommendation,
    residual_exposure,
    note: 'Cross-network atomicity and finality-compatibility check per CPMI-IOSCO PFMI Principles 8 + 12. Educational estimator — not a live settlement instruction or legal advice. Verify BIS Agorá / ECB Pontes / DTCC Collateral AppChain coordination mechanics against current primary sources.',
  };

  const compliance_flags = [];
  if (atomicity_verdict === 'at-risk')       compliance_flags.push('NON_ATOMIC_CROSS_NETWORK');
  if (leg_findings.some(f => f.finality === 'mismatch'))
    compliance_flags.push('FINALITY_MISMATCH_ACROSS_LEGS');
  if (pvp_check === 'PVP_AT_RISK')           compliance_flags.push('PVP_NOT_GUARANTEED');
  if (atomicity_verdict === 'partial' || atomicity_verdict === 'at-risk')
    compliance_flags.push('PFMI_P12_DVP_RISK');

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
