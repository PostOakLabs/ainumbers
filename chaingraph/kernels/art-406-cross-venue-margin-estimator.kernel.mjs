import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-406-cross-venue-margin-estimator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'estimate_cross_venue_margin_capital',
  mandate_type: 'analytics_mandate', gpu: false,
};

// Crypto off-exchange settlement / cross-venue margin, per AT-CLEARING-WAVE-SPEC.md
// SS CW-1 (Copper ClearLoop + FalconX + Ceffu model). Computes: (1) the net cross-venue
// margin requirement for a book spread across venues, against the sum of each venue's own
// isolated margin if held on-exchange with no netting; (2) the capital freed / capital
// efficiency from off-exchange (MPC-custody) settlement vs on-exchange isolated margin;
// (3) financing cost of running the book at a declared leverage multiple, checked against
// a caller-declared program leverage cap (ClearLoop Loans up to 4x / FalconX up to 5x are
// examples, never hard-coded here -- the cap is always caller-supplied); (4) a plain
// counterparty/custody-risk framing string keyed off the declared custody model. All
// netting %, leverage caps, and program names are caller-declared fixtures (constants_version
// pinned), never fetched or hard-coded -- these programs' terms move fast. Pure ECMA-262
// arithmetic only -- no Math.pow, no Date.now/new Date(), no Math.random.

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }
function r6(v) { return Number.isFinite(v) ? Math.round(v * 1000000) / 1000000 : 0; }

const CUSTODY_FRAMING = {
  mpc_off_exchange_bankruptcy_remote:
    'Assets held in MPC custody, off the trading venues, structured bankruptcy-remote from any single venue’s insolvency -- venue default risk is a trading-counterparty risk, not a custody/asset-loss risk.',
  on_exchange_isolated:
    'Assets held on-exchange, isolated per venue -- a venue default or exchange-level failure exposes the assets posted to that venue directly; no cross-venue custody separation.',
};

export function compute(pp) {
  pp = pp || {};
  const venuePositionsRaw = Array.isArray(pp.venue_positions) ? pp.venue_positions : [];
  const crossMarginOffsetPct = safeNum(pp.cross_margin_offset_pct, 0);
  const leverageMultiple = safeNum(pp.leverage_multiple, 1);
  const leverageProgramCapMultiple = safeNum(pp.leverage_program_cap_multiple, 0);
  const leverageProgramName = String(pp.leverage_program_name || '').trim();
  const financingAprPct = safeNum(pp.financing_apr_pct, 0);
  const financingHorizonDays = safeNum(pp.financing_horizon_days, 0);
  const custodyModel = String(pp.custody_model || '').trim();
  const constantsVersion = String(pp.constants_version || '').trim();

  const venue_positions = venuePositionsRaw.map((v) => ({
    venue: String((v && v.venue) || '').trim(),
    gross_notional_usd: safeNum(v && v.gross_notional_usd, 0),
    isolated_margin_requirement_usd: safeNum(v && v.isolated_margin_requirement_usd, 0),
  }));

  const compliance_flags = [];
  if (venue_positions.length === 0) compliance_flags.push('XVM_EMPTY_BOOK');
  if (venue_positions.length === 1) compliance_flags.push('XVM_SINGLE_VENUE_NO_CROSS_MARGIN_BENEFIT');
  if (crossMarginOffsetPct < 0 || crossMarginOffsetPct > 1) compliance_flags.push('XVM_INVALID_OFFSET_PCT');
  if (leverageMultiple <= 0) compliance_flags.push('XVM_INVALID_LEVERAGE');
  if (leverageProgramCapMultiple > 0 && leverageMultiple > leverageProgramCapMultiple) compliance_flags.push('XVM_LEVERAGE_EXCEEDS_PROGRAM_CAP');
  if (!CUSTODY_FRAMING[custodyModel]) compliance_flags.push('XVM_UNKNOWN_CUSTODY_MODEL');
  if (!constantsVersion) compliance_flags.push('XVM_CONSTANTS_VERSION_UNPINNED');

  const sumIsolatedMarginUsd = venue_positions.reduce((a, v) => a + v.isolated_margin_requirement_usd, 0);
  const financingNotionalUsd = venue_positions.reduce((a, v) => a + v.gross_notional_usd, 0);

  const clampedOffset = crossMarginOffsetPct < 0 ? 0 : (crossMarginOffsetPct > 1 ? 1 : crossMarginOffsetPct);
  const crossVenueMarginRequirementUsd = sumIsolatedMarginUsd * (1 - clampedOffset);
  const capitalFreedUsd = sumIsolatedMarginUsd - crossVenueMarginRequirementUsd;
  const capitalEfficiencyPct = sumIsolatedMarginUsd > 0 ? capitalFreedUsd / sumIsolatedMarginUsd : 0;

  const safeLeverage = leverageMultiple > 0 ? leverageMultiple : 1;
  const financedAmountUsd = financingNotionalUsd * (1 - 1 / safeLeverage);
  const financingCostUsd = financedAmountUsd * (financingAprPct / 100) * (financingHorizonDays / 365);

  const output_payload = {
    leverage_program_name: leverageProgramName,
    leverage_program_cap_multiple: leverageProgramCapMultiple,
    leverage_multiple: leverageMultiple,
    custody_model: custodyModel,
    constants_version: constantsVersion,
    venue_count: venue_positions.length,
    venue_positions,
    sum_isolated_margin_usd: r2(sumIsolatedMarginUsd),
    cross_margin_offset_pct: crossMarginOffsetPct,
    cross_venue_margin_requirement_usd: r2(crossVenueMarginRequirementUsd),
    capital_freed_usd: r2(capitalFreedUsd),
    capital_efficiency_pct: r6(capitalEfficiencyPct),
    financing_notional_usd: r2(financingNotionalUsd),
    financed_amount_usd: r2(financedAmountUsd),
    financing_apr_pct: financingAprPct,
    financing_horizon_days: financingHorizonDays,
    financing_cost_usd: r2(financingCostUsd),
    counterparty_risk_framing: CUSTODY_FRAMING[custodyModel] || 'Unrecognized custody model -- risk framing not computed.',
    disambiguation: 'Cross-venue crypto off-exchange settlement/margin (Copper ClearLoop / FalconX / Ceffu model) for a book spread across trading venues. Distinct from the TradFi treasury-clearing cluster (art-48..51), which addresses the US Treasury cash/repo clearing mandate and CME-FICC Combined Portfolio margining. This receipt attests our computation over the user’s declared positions and venue terms -- it does not verify those positions, and is not a margin call, a settlement instruction, or investment advice.',
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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
