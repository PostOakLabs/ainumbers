/**
 * art-56-tokenized-settlement-fit-diagnostic.kernel.mjs
 * Wave 13 — Wholesale Tokenized Settlement fit diagnostic.
 * 12 questions → 6 weighted dimensions → A–F grade + routing to the right wts-* chain.
 * Cash/settlement layer distinct from Wave 8 Canton asset layer.
 * Pure decision kernel — no DOM, no window, no Date.now().
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-56-tokenized-settlement-fit-diagnostic';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'run_tokenized_settlement_fit',
  mandate_type: 'agent_guardrail_mandate',
  gpu:          false,
};

// --- Scoring tables: each answer → 0..4 sub-score ---
const S = {
  // Settlement asset dimension
  cash_leg_asset:       { 'central-bank-money': 4, 'tokenized-deposit': 3, 'regulated-stablecoin': 2, 'e-money': 1, 'off-chain-RTGS': 1 },
  finality_regime:      { 'SFD-designated': 4, 'PFMI-aligned': 3, 'UCC-Art12': 2, 'unclear': 0 },
  // Network dimension
  network_model:        { 'single-ledger': 4, 'two-network-bridged': 2, 'multi-network': 3 },
  atomicity_mechanism:  { 'shared-ledger': 4, 'HTLC': 3, 'notary': 2, 'unsynchronised': 0 },
  // Asset-leg dimension
  asset_leg_type:       { 'tokenized-security': 4, 'tokenized-collateral': 4, 'tokenized-repo': 3, 'tokenized-MMF': 2, 'none': 0 },
  participant_eligibility: { 'allowlisted-LEI': 4, 'KYC-tiered': 2, 'open': 0 },
  // Issuer dimension
  deposit_token_issuer: { 'G-SIB-deposit-token': 4, 'CBM-account': 4, 'RLN-member': 3, 'stablecoin-issuer': 2, 'none': 0 },
  operating_hours:      { '24x7': 4, 'extended': 2, 'RTGS-window-only': 1 },
  // Liquidity dimension
  intraday_liquidity:   { 'prefunded': 4, 'intraday-credit': 3, 'netting': 2, 'none': 0 },
  // Controls dimension
  reconciliation_model: { 'hash-anchored': 4, 'dual-ledger-recon': 2, 'manual': 0 },
};

const pick   = (t, v, d = 0) => (v in t ? t[v] : d);
const letter = s => (s >= 85 ? 'A' : s >= 70 ? 'B' : s >= 55 ? 'C' : s >= 40 ? 'D' : 'F');

const WEIGHTS = {
  settlement_asset: 0.25,
  network:          0.20,
  asset_leg:        0.15,
  issuer:           0.15,
  liquidity:        0.15,
  controls:         0.10,
};

const ROUTE = {
  settlement_asset: 'wts-settlement-asset',
  network:          'wts-cross-network-dvp',
  asset_leg:        'wts-collateral-mobility',
  issuer:           'wts-deposit-token',
  liquidity:        'wts-intraday-liquidity',
  controls:         'wts-participant-onboarding',
};

const REMEDIATION = {
  settlement_asset: 'Clarify settlement-asset type and verify its finality regime (SFD designation / PFMI alignment / UCC Art.12 control). Run wts-settlement-asset to classify finality tier.',
  network:          'Assess cross-network atomicity mechanism. HTLC or shared-ledger locking preferred over unsynchronised settlement. Run wts-cross-network-dvp.',
  asset_leg:        'Confirm tokenized-asset eligibility and DTCC Collateral AppChain readiness. Run wts-collateral-mobility.',
  issuer:           'Validate deposit-token issuer type (G-SIB liability vs stablecoin). Run wts-deposit-token.',
  liquidity:        'Model intraday liquidity under 24/7 settlement windows. Run wts-intraday-liquidity.',
  controls:         'Upgrade reconciliation to hash-anchored audit trail. Screen participants via wts-participant-onboarding.',
};

export function compute(pp) {
  const {
    cash_leg_asset         = 'off-chain-RTGS',
    finality_regime        = 'unclear',
    network_model          = 'two-network-bridged',
    atomicity_mechanism    = 'unsynchronised',
    asset_leg_type         = 'none',
    participant_eligibility= 'KYC-tiered',
    deposit_token_issuer   = 'none',
    operating_hours        = 'RTGS-window-only',
    intraday_liquidity     = 'none',
    reconciliation_model   = 'manual',
    // informational only:
    participant_type       = 'bank',
    annual_settlement_value_usd = 0,
  } = pp;

  const sub = {
    settlement_asset: [pick(S.cash_leg_asset, cash_leg_asset), pick(S.finality_regime, finality_regime)],
    network:          [pick(S.network_model, network_model), pick(S.atomicity_mechanism, atomicity_mechanism)],
    asset_leg:        [pick(S.asset_leg_type, asset_leg_type), pick(S.participant_eligibility, participant_eligibility)],
    issuer:           [pick(S.deposit_token_issuer, deposit_token_issuer), pick(S.operating_hours, operating_hours)],
    liquidity:        [pick(S.intraday_liquidity, intraday_liquidity)],
    controls:         [pick(S.reconciliation_model, reconciliation_model)],
  };

  const dim_scores = {};
  for (const k of Object.keys(sub)) {
    const avg = sub[k].reduce((a, b) => a + b, 0) / sub[k].length;
    dim_scores[k] = { score: +(avg / 4 * 100).toFixed(1), grade: letter(avg / 4 * 100) };
  }

  const overall = +Object.keys(WEIGHTS).reduce(
    (acc, k) => acc + dim_scores[k].score * WEIGHTS[k], 0
  ).toFixed(1);
  const overall_grade = letter(overall);

  // Routing: weakest dimension drives primary recommendation.
  const ranked = Object.keys(dim_scores).sort((a, b) => dim_scores[a].score - dim_scores[b].score);
  const primary_recommendation = ROUTE[ranked[0]];

  const secondary_recommendations = [];
  if (deposit_token_issuer !== 'none' && ROUTE.issuer !== primary_recommendation)
    secondary_recommendations.push('wts-deposit-token');
  if ((atomicity_mechanism === 'unsynchronised' || network_model !== 'single-ledger') &&
      ROUTE.network !== primary_recommendation && !secondary_recommendations.includes('wts-cross-network-dvp'))
    secondary_recommendations.push('wts-cross-network-dvp');
  if (asset_leg_type !== 'none' && ROUTE.asset_leg !== primary_recommendation &&
      !secondary_recommendations.includes('wts-collateral-mobility'))
    secondary_recommendations.push('wts-collateral-mobility');
  if (!secondary_recommendations.includes(ROUTE[ranked[1]]) && ROUTE[ranked[1]] !== primary_recommendation)
    secondary_recommendations.push(ROUTE[ranked[1]]);
  if (!secondary_recommendations.includes('wts-audit-pack'))
    secondary_recommendations.push('wts-audit-pack');

  const remediation_checklist = [];
  for (const k of Object.keys(dim_scores)) {
    if (dim_scores[k].grade === 'D' || dim_scores[k].grade === 'F') {
      remediation_checklist.push({ dimension: k, grade: dim_scores[k].grade, action: REMEDIATION[k] });
    }
  }

  const compliance_flags = [];
  if (finality_regime === 'unclear') compliance_flags.push('FINALITY_REGIME_UNCLEAR');
  if (atomicity_mechanism === 'unsynchronised') compliance_flags.push('UNSYNCHRONISED_ATOMICITY');
  if (cash_leg_asset === 'off-chain-RTGS' || cash_leg_asset === 'e-money')
    compliance_flags.push('SETTLEMENT_ASSET_NOT_CLASSIFIED');
  if (overall_grade === 'D' || overall_grade === 'F') compliance_flags.push('LOW_READINESS');

  const finality_flag = finality_regime === 'unclear' ? 'FINALITY_REGIME_UNCLEAR' : null;

  const output_payload = {
    dim_scores,
    overall_score: overall,
    overall_grade,
    primary_recommendation,
    secondary_recommendations,
    remediation_checklist,
    finality_flag,
    note: 'Educational readiness diagnostic for Wholesale Tokenized Settlement — cash/settlement layer. Distinct from Wave 8 Canton asset layer. Routes to the relevant wts-* chain; not settlement or legal advice. Verify DTCC/ECB Pontes/RLN/Agorá status against current primary sources.',
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
