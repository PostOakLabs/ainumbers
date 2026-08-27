import { executionHash } from './_hash.mjs';

// art-656-derivatives-margin-workbench — DERIV-WF-MARGIN-1. Consolidates AT-01/AT-02/AT-05 of
// DERIV-WORKFLOWS-BUILD-SPEC.md (workspace root) into one node under the single art-656
// reservation: event-market linear PnL (AT-01 Mode 1), margin health with a DECLARED venue
// margin model (AT-02, enhanced per this row's spec amendment — venue mechanics are an input,
// never a hardcoded per-venue lookup table, same doctrine DERIVMATH applies to funding
// mechanism), and two-position correlation-VaR cross-margin efficiency (AT-05 Mode A).
// Formulas transcribed verbatim from the internal source doc
// (ainumbers-internal/archive/autonity/autonity-workflows.md, AT-01/AT-02/AT-05 sections);
// this is market-convention/pedagogical math, not a cited regulatory text — standards_basis:
// not_applicable (no clause-snapshot obligation under SO #38).
//
// DETERMINISM: compute() is a PURE function of pp — no Date.now()/Math.random(), no network,
// no filesystem. No TextEncoder/atob/btoa/URL used (guest-builtin-safe by construction).

const TOOL_ID = 'art-656-derivatives-margin-workbench';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_derivatives_margin_workbench',
  mandate_type: 'derivatives_margin_health', gpu: false,
};

function round6(v) { return Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : 0; }
function round4(v) { return Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : 0; }
function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

/**
 * compute(pp) — pure decision kernel.
 * @param {object} pp policy_parameters — { event_market?, margin?, cross_margin? }
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const compliance_flags = [];

  // ---------- Block 1: event-market PnL — AT-01 Mode 1 (scalar/linear payoff) ----------
  const em = pp.event_market || {};
  const emSide = em.side === 'short' ? 'short' : 'long';
  const emSideSign = emSide === 'long' ? 1 : -1;
  const strike = safeNum(em.strike, 0);
  const unitValue = safeNum(em.unit_value, 1);
  const nContracts = Math.max(0, safeNum(em.n_contracts, 1));
  const minPrice = safeNum(em.min_price, -Infinity);
  const maxPrice = safeNum(em.max_price, Infinity);
  const settlementValue = safeNum(em.settlement_value, strike);
  const settlementInRange = settlementValue >= minPrice && settlementValue <= maxPrice;
  const settlementClamped = clamp(settlementValue, minPrice, maxPrice);
  const settlementDelta = round6(settlementClamped - strike);
  const eventPnl = round6(emSideSign * settlementDelta * unitValue * nContracts);

  if (!settlementInRange) compliance_flags.push('EVENT_SETTLEMENT_OUT_OF_RANGE');

  const event_market = {
    side: emSide,
    strike: round6(strike),
    settlement_value: round6(settlementValue),
    settlement_in_range: settlementInRange,
    unit_value: round6(unitValue),
    n_contracts: round6(nContracts),
    settlement_delta: settlementDelta,
    pnl: eventPnl,
  };

  // ---------- Block 2: margin health — AT-02, venue margin model DECLARED not hardcoded ----------
  const mg = pp.margin || {};
  const mgSide = mg.side === 'short' ? 'short' : 'long';
  const mgSideSign = mgSide === 'long' ? 1 : -1;
  const entryPrice = Math.max(1e-6, safeNum(mg.entry_price, 1));
  const markPrice = Math.max(1e-6, safeNum(mg.mark_price, entryPrice));
  const notional = Math.max(0, safeNum(mg.notional, 0));
  const marginPosted = Math.max(0, safeNum(mg.margin_posted, 0));
  const marginMode = mg.margin_mode === 'cross' ? 'cross' : 'isolated';

  // venue_margin_model is a DECLARED policy_parameter — regulated-DCM vs offshore-perp class,
  // each carrying its own imr/mmr. No per-venue-name lookup table lives in this kernel; the
  // caller states the mechanism, same doctrine DERIV-WF-DERIVMATH-1 applies to funding mechanism.
  const vmm = mg.venue_margin_model || {};
  const vmmClass = vmm.class === 'offshore_perp' ? 'offshore_perp' : 'regulated_dcm';
  const vmmLabel = typeof vmm.label === 'string' && vmm.label.length > 0
    ? vmm.label
    : (vmmClass === 'offshore_perp' ? 'Offshore perpetual venue' : 'Regulated DCM (CFTC-registered)');
  const imr = clamp(safeNum(vmm.imr, 0.10), 0.0001, 1);
  const mmr = clamp(safeNum(vmm.mmr, 0.05), 0.0001, imr);

  const initialMarginRequired = round6(notional * imr);
  const maintenanceThreshold = round6(notional * mmr);
  const unrealizedPnl = round6(mgSideSign * (markPrice - entryPrice) * (notional / entryPrice));
  const marginBalance = round6(marginPosted + unrealizedPnl);
  const buffer = round6(marginBalance - maintenanceThreshold);
  const bufferPct = maintenanceThreshold > 0 ? round4((buffer / maintenanceThreshold) * 100) : 0;

  const notionalOverEntry = notional / entryPrice || 1; // guards div-by-zero when notional === 0
  const liquidationPrice = round6(entryPrice - (mgSideSign * (marginPosted - maintenanceThreshold)) / notionalOverEntry);
  const leverageRatio = marginBalance > 0 ? round4(notional / marginBalance) : Infinity;

  let health;
  if (bufferPct > 100) health = 'GREEN';
  else if (bufferPct > 0) health = 'AMBER';
  else health = 'RED';

  if (marginPosted < initialMarginRequired) compliance_flags.push('MARGIN_BELOW_INITIAL');
  if (marginBalance < maintenanceThreshold) compliance_flags.push('MARGIN_BELOW_MAINTENANCE');
  if (Number.isFinite(leverageRatio) && leverageRatio > 10) compliance_flags.push('HIGH_LEVERAGE');

  const margin = {
    side: mgSide,
    margin_mode: marginMode,
    entry_price: round6(entryPrice),
    mark_price: round6(markPrice),
    notional: round6(notional),
    margin_posted: round6(marginPosted),
    venue_margin_model: {
      class: vmmClass,
      label: vmmLabel,
      imr_pct: round4(imr * 100),
      mmr_pct: round4(mmr * 100),
    },
    initial_margin_required: initialMarginRequired,
    unrealized_pnl: unrealizedPnl,
    margin_balance: marginBalance,
    maintenance_threshold: maintenanceThreshold,
    buffer: buffer,
    buffer_pct: bufferPct,
    liquidation_price: marginMode === 'isolated' ? liquidationPrice : null,
    leverage_ratio: Number.isFinite(leverageRatio) ? leverageRatio : null,
    health: health,
    cross_margin_note: marginMode === 'cross'
      ? "Cross-margin: account-level liquidation fires when account value (incl. unrealized PnL) falls below the sum of each position's maintenance requirement. Leverage sets how much collateral is drawn, not the liquidation trigger."
      : null,
  };

  // ---------- Block 3: cross-margin efficiency — AT-05 Mode A (correlation-VaR, 2 positions) ----------
  const cm = pp.cross_margin;
  let cross_margin = null;
  if (cm && typeof cm === 'object') {
    const bNotional = Math.max(0, safeNum(cm.position_b_notional, 0));
    const bImr = clamp(safeNum(cm.position_b_imr, imr), 0.0001, 1);
    const correlation = clamp(safeNum(cm.correlation, 0), -1, 1);
    const totalNotional = notional + bNotional;
    const defaultWeightA = totalNotional > 0 ? notional / totalNotional : 0.5;
    const weightA = clamp(safeNum(cm.weight_a, defaultWeightA), 0, 1);
    const weightB = clamp(safeNum(cm.weight_b, 1 - weightA), 0, 1);

    const siloed = round6(notional * imr + bNotional * bImr);
    const shared = round6(siloed * Math.sqrt(Math.max(0, 1 + 2 * correlation * weightA * weightB)));
    const efficiencyRatio = siloed > 0 ? round4(shared / siloed) : 1;
    const capitalSaved = round6(siloed - shared);

    let benefit;
    if (efficiencyRatio < 0.75) benefit = 'SIGNIFICANT';
    else if (efficiencyRatio <= 0.90) benefit = 'MODERATE';
    else if (efficiencyRatio < 1.0) benefit = 'MINIMAL';
    else benefit = 'NONE';

    if (efficiencyRatio < 1.0) compliance_flags.push('SUBOPTIMAL_MARGINING');
    if (Math.abs(correlation) < 0.2) compliance_flags.push('UNCORRELATED_POSITIONS');
    if (correlation > 0.5) compliance_flags.push('POSITIVE_CORRELATION');

    cross_margin = {
      position_a_notional: round6(notional),
      position_a_imr_pct: round4(imr * 100),
      position_b_notional: round6(bNotional),
      position_b_imr_pct: round4(bImr * 100),
      correlation: round4(correlation),
      weight_a: round4(weightA),
      weight_b: round4(weightB),
      siloed_margin: siloed,
      shared_margin: shared,
      efficiency_ratio: efficiencyRatio,
      capital_saved: capitalSaved,
      benefit: benefit,
    };
  }

  // Flag-mirror doctrine (AUTHORING-STANDARD.md, mirror-into-output-payload section):
  // compliance_flags is CONDITIONAL (it differs across observed inputs), so it must mirror into
  // a truthy output_payload member — `warnings` carries the same caveats in reader-facing prose,
  // never a re-derivation of the codes.
  const WARNING_TEXT = {
    EVENT_SETTLEMENT_OUT_OF_RANGE: 'Event-market settlement value was outside the declared [min_price, max_price] range and was clamped before computing PnL.',
    MARGIN_BELOW_INITIAL: 'Margin posted is below the initial margin required by the declared venue margin model.',
    MARGIN_BELOW_MAINTENANCE: 'Margin balance is below the maintenance threshold; this position is eligible for liquidation.',
    HIGH_LEVERAGE: 'Effective leverage exceeds 10x.',
    SUBOPTIMAL_MARGINING: 'Cross-margining raises the combined requirement above the siloed total for this correlation and weighting.',
    UNCORRELATED_POSITIONS: 'Correlation magnitude is below 0.2; cross-margining benefit is minimal for uncorrelated positions.',
    POSITIVE_CORRELATION: 'Correlation exceeds 0.5; same-direction risk is not diversified away by cross-margining.',
  };
  const warnings = compliance_flags.map((code) => WARNING_TEXT[code] || code);

  const output_payload = {
    event_market,
    margin,
    cross_margin,
    warnings,
    scope_note: 'Cross-margin efficiency is a closed-form correlation-VaR approximation of what scenario-grid margin systems deliver — production risk engines (CME SPAN/SPAN2, Deribit PME, OKX risk units) use stress grids, not this formula.',
    disclaimer: 'Not financial advice. Venue margin conventions, funding mechanics, and event-contract terms vary and change; verify current parameters with the venue before trading. For informational purposes only.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
