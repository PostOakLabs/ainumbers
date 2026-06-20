/**
 * art-59-settlement-asset-finality-classifier.kernel.mjs
 * Wave 13 — Settlement-Asset & Legal-Finality Classifier (W-C).
 * Classifies the settlement asset (CBM / tokenized deposit / stablecoin / e-money)
 * and the legal-finality regime (SFD / PFMI / UCC Art.12) → finality tier 1–4
 * + singleness-of-money assessment.
 * Gates ART-58 cross-network settlement validator.
 * Pure decision kernel — no DOM, no window, no Date.now().
 * §13.4 enhancements: deadline/deadline_note + xbrl:ocg-ext export profile.
 * Citations (verify against current primary sources):
 *   EU Settlement Finality Directive 98/26/EC;
 *   UCC Article 12 (controllable electronic records, 2022 amendments);
 *   CPMI-IOSCO PFMI Principle 8 (settlement finality);
 *   BIS singleness-of-money / unified ledger concept.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-59-settlement-asset-finality-classifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'classify_settlement_asset_finality',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

// Tier mapping: (settlement_asset + issuer) → base tier
const ASSET_TIER = {
  'CBM-token':                    1,  // Central bank money — highest finality
  'commercial-bank-deposit-token': 2,  // Tokenized deposit: on-balance-sheet bank liability
  'regulated-stablecoin':         3,  // Reserve-backed / GENIUS/MiCA regulated
  'e-money-token':                3,
  'off-chain-RTGS':               2,  // Designated system finality
};

// Finality designation uplift/downgrade
const FINALITY_MOD = {
  'SFD-designated':    -1,   // Best: pull tier UP by 1 (lower tier = better finality)
  'PFMI-compliant-FMI': 0,
  'UCC-Art12-control':  0,
  'contractual-only':  +1,   // Worse: push tier down
  'none':              +2,
};

// Singleness: 1 unit = par with CBM?
const SINGLENESS = {
  'par-with-CBM':  'SINGLENESS_CONFIRMED',
  'pegged':        'SINGLENESS_CONDITIONAL',
  'floating':      'SINGLENESS_BROKEN',
};

const REGIME_MAP = {
  US:  'US deposit law (commercial bank liability, not a security or e-money); UCC Art.12 controllable electronic record; verify current OCC/Fed guidance',
  UK:  'UK RLN model (tokenised sterling deposit); FCA e-money / payment-services regime for EMTs; verify current FCA/BoE guidance',
  EU:  'EU Settlement Finality Directive 98/26/EC (designated system finality); MiCA EMT/ART (Arts. 48+) for stablecoins; ECB TARGET settlement finality; verify current ECB/EBA guidance',
  other: 'Jurisdiction-specific; verify against applicable central-bank / CSD / legislative framework',
};

function classifyTier(settlement_asset, finality_designation) {
  const base = ASSET_TIER[settlement_asset] ?? 4;
  const mod  = FINALITY_MOD[finality_designation] ?? +1;
  return Math.min(4, Math.max(1, base + mod));
}

export function compute(pp) {
  const {
    settlement_asset     = 'off-chain-RTGS',
    issuer               = 'regulated-bank',
    finality_designation = 'none',
    jurisdiction         = 'other',
    governing_law        = '',
    transfer_mechanism   = 'DvP-conditional',
    singleness_test      = 'pegged',
  } = pp;

  const finality_tier = classifyTier(settlement_asset, finality_designation);

  const singleness_verdict = SINGLENESS[singleness_test] ?? 'SINGLENESS_BROKEN';

  // Finality gaps
  const finality_gaps = [];
  if (transfer_mechanism === 'wrapped-bridged') finality_gaps.push('WRAPPED_ASSET_FINALITY_GAP');
  if (finality_designation === 'none' || finality_designation === 'contractual-only')
    finality_gaps.push('NO_LEGAL_FINALITY_DESIGNATION');
  if (settlement_asset === 'e-money-token' && finality_designation !== 'SFD-designated')
    finality_gaps.push('EMT_NOT_SFD_DESIGNATED');
  if (singleness_verdict === 'SINGLENESS_BROKEN') finality_gaps.push('SINGLENESS_BROKEN_WITH_CBM');

  // Applicable regime
  const applicable_regime = REGIME_MAP[jurisdiction] ?? REGIME_MAP.other;

  // Recommendation
  let recommendation = '';
  if (finality_tier === 1) {
    recommendation = 'Tier 1 — legally final (CBM / SFD-designated). Proceed to ART-58 cross-network atomicity check.';
  } else if (finality_tier === 2) {
    recommendation = 'Tier 2 — conditional finality. Confirm SFD designation or PFMI compliance with the relevant CSD/FMI before relying on finality. Run ART-58 with finality_designation upgrade if achievable.';
  } else if (finality_tier === 3) {
    recommendation = 'Tier 3 — contractual / reserve-backed finality. Assess whether the issuer and product qualify as SFD-designated or PFMI-compliant. Stablecoin may satisfy GENIUS Act / MiCA reserve requirements but does not achieve Tier 1 legal finality without a designation. Run wts-settlement-asset.';
  } else {
    recommendation = 'Tier 4 — finality unclear. Do not use this asset class for wholesale settlement without legal clarification. Obtain SFD designation or PFMI compliance assessment. Run wts-settlement-asset.';
  }

  // Settlement asset class (human-readable)
  const asset_class_labels = {
    'CBM-token':                    'Central Bank Money (tokenized)',
    'commercial-bank-deposit-token': 'Tokenized Commercial Bank Deposit (bank liability, redeemable at par)',
    'regulated-stablecoin':          'Regulated Stablecoin (GENIUS Act / MiCA reserve-backed)',
    'e-money-token':                 'E-Money Token (MiCA Art. 48+)',
    'off-chain-RTGS':                'Off-Chain RTGS Settlement',
  };
  const settlement_asset_class = asset_class_labels[settlement_asset] ?? settlement_asset;

  const output_payload = {
    settlement_asset_class,
    finality_tier,
    singleness_verdict,
    finality_gaps,
    applicable_regime,
    recommendation,
    status_asof: '2026-06-20 — verify EU SFD 98/26/EC, UCC Art.12, CPMI-IOSCO PFMI Principle 8 against current regulatory guidance',
    note: 'Educational classification — not legal or settlement advice. Tier 1 = legally final (CBM/SFD); Tier 2 = conditional (deposit token/PFMI); Tier 3 = contractual (stablecoin); Tier 4 = unclear/none. Gates wts-cross-network-dvp atomicity check.',
  };

  const compliance_flags = [];
  if (finality_tier === 4) compliance_flags.push('FINALITY_TIER_4_UNCLEAR');
  if (singleness_verdict === 'SINGLENESS_BROKEN') compliance_flags.push('SINGLENESS_BROKEN');
  if (finality_gaps.includes('WRAPPED_ASSET_FINALITY_GAP')) compliance_flags.push('WRAPPED_ASSET_FINALITY_GAP');
  if (finality_tier >= 3) compliance_flags.push('FINALITY_BELOW_TIER2');

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
