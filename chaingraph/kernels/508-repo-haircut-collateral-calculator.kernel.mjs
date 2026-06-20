/**
 * 508-repo-haircut-collateral-calculator.kernel.mjs
 * On-Chain Repo Haircut Calculator — Basel CRE22 haircuts, Canton vs legacy comparison.
 * Pure decision kernel — no DOM, no window, no Date.now().
 */

import { executionHash } from './_hash.mjs';

const TOOL_ID = '508-repo-haircut-collateral-calculator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'calculate_repo_haircut',
  mandate_type: 'collateral_mandate',
  gpu: false,
};

// Base haircuts by collateral type (Basel CRE22) — percent
const BASE_HAIRCUTS = {
  ust_10y:      4.0,
  ust_30y:      8.0,
  agency_mbs:   6.0,
  ig_corp_bond: 4.0,
  gilt_10y:     4.0,
  eu_sovereign: 4.0,
};

// d349 SFT haircut floors — percent
const FLOOR_SOVEREIGN     = 0.5;
const FLOOR_NON_SOVEREIGN = 2.0;

const SOVEREIGN_TYPES = new Set(['ust_10y', 'ust_30y', 'gilt_10y', 'eu_sovereign']);

// Adjustments (percentage points, additive)
const ADJ_ROLL_RISK       = 2.0;  // open_term or 6m tenor
const ADJ_CROSS_BORDER    = 1.0;
const ADJ_HEDGE_FUND_CP   = 1.0;
const ADJ_WEEKEND_GAP     = 1.5;  // legacy only (no Canton 24/7)
const ADJ_CONCENTRATION   = 2.0;  // concentration > 20%

// VM threshold (GMRA bilateral standard)
const VM_THRESHOLD_PCT = 0.002;  // 0.2%

export function compute(pp) {
  // pp: { collateral_type, notional_usd, tenor, cross_border, counterparty_type,
  //       canton247, concentration_pct }
  const collType    = (pp.collateral_type || 'ust_10y').toLowerCase();
  const notional    = Number(pp.notional_usd) || 0;
  const tenor       = (pp.tenor || 'overnight').toLowerCase();
  const crossBorder = !!pp.cross_border;
  const cpType      = (pp.counterparty_type || 'bank').toLowerCase();
  const canton247   = !!pp.canton247;
  const concPct     = Number(pp.concentration_pct) || 0;

  const baseHaircut = BASE_HAIRCUTS[collType] ?? 4.0;
  const isSovereign = SOVEREIGN_TYPES.has(collType);

  // Floor
  const floor = isSovereign ? FLOOR_SOVEREIGN : FLOOR_NON_SOVEREIGN;

  // Build legacy adjustments
  let legacyAdj = 0;
  const adjDetail = [];
  if (tenor === 'open_term' || tenor === '6m') {
    legacyAdj += ADJ_ROLL_RISK;
    adjDetail.push({ reason: 'roll_risk', delta: ADJ_ROLL_RISK });
  }
  if (crossBorder) {
    legacyAdj += ADJ_CROSS_BORDER;
    adjDetail.push({ reason: 'cross_border', delta: ADJ_CROSS_BORDER });
  }
  if (cpType === 'hedge_fund') {
    legacyAdj += ADJ_HEDGE_FUND_CP;
    adjDetail.push({ reason: 'hedge_fund_counterparty', delta: ADJ_HEDGE_FUND_CP });
  }
  // Weekend gap: always in legacy path
  legacyAdj += ADJ_WEEKEND_GAP;
  adjDetail.push({ reason: 'weekend_valuation_gap_legacy', delta: ADJ_WEEKEND_GAP });

  if (concPct > 20) {
    legacyAdj += ADJ_CONCENTRATION;
    adjDetail.push({ reason: 'concentration_risk', delta: ADJ_CONCENTRATION });
  }

  // Canton haircut: excludes weekend gap adjustment
  const cantonAdj = legacyAdj - ADJ_WEEKEND_GAP;

  // Raw haircuts (before floor)
  let legacyHaircutRaw = baseHaircut + legacyAdj;
  let cantonHaircutRaw = baseHaircut + cantonAdj;

  // Apply d349 floor
  const legacyHaircut = Math.max(legacyHaircutRaw, floor);
  const cantonHaircut = Math.max(cantonHaircutRaw, floor);

  // Weekend saving (may be compressed at floor)
  const weekendSaving = +(legacyHaircut - cantonHaircut).toFixed(2);

  // Initial margin
  const usedHaircut      = canton247 ? cantonHaircut : legacyHaircut;
  const initialMargin    = +(notional * (usedHaircut / 100)).toFixed(2);
  const vmThreshold      = +(notional * VM_THRESHOLD_PCT).toFixed(2);

  // Haircut color tier for display guidance
  function haircutTier(h) {
    if (h <= 4) return 'teal';
    if (h <= 6) return 'warn';
    return 'red';
  }

  const compliance_flags = [];
  if (weekendSaving > 0) compliance_flags.push('CANTON_HAIRCUT_SAVING_AVAILABLE');
  if (concPct > 20)      compliance_flags.push('CONCENTRATION_RISK_FLAG');
  if (cpType === 'hedge_fund') compliance_flags.push('HEDGE_FUND_COUNTERPARTY_SURCHARGE');
  if (legacyHaircut !== legacyHaircutRaw || cantonHaircut !== cantonHaircutRaw) {
    compliance_flags.push('D349_SFT_FLOOR_APPLIED');
  }

  const output_payload = {
    collateral_type:    collType,
    tenor,
    notional_usd:       notional,
    base_haircut_pct:   baseHaircut,
    d349_floor_pct:     floor,
    adjustments:        adjDetail,
    legacy_haircut_pct: legacyHaircut,
    canton_haircut_pct: cantonHaircut,
    weekend_saving_pp:  weekendSaving,
    active_haircut_pct: usedHaircut,
    initial_margin_usd: initialMargin,
    vm_threshold_usd:   vmThreshold,
    haircut_tier:       haircutTier(usedHaircut),
    canton247,
  };
  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
