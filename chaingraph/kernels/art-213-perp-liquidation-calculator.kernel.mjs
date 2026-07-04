import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-213-perp-liquidation-calculator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_perp_margin',
  mandate_type: 'derivatives_margin_health', gpu: false,
};

// Venue-specific MMR tier defaults (as fraction, not %)
// These are simplified tiers for the default preset. Actual tiers vary by notional.
function venueMMR(venue, leverage) {
  const lev = Math.max(1, leverage);
  if (venue === 'hyperliquid') {
    // Hyperliquid: mmr = 1/(2 * max_leverage), where max_leverage varies by notional
    // Default: 40x max → mmr = 1.25%
    return 1 / (2 * Math.min(40, lev));
  }
  if (venue === 'dydx_v4') return 0.03; // MMF 3% for BTC-style
  if (venue === 'binance') return 0.005; // Binance PM: position-tier-dependent; use 0.5% as base
  if (venue === 'gmx') return 0.01; // GMX v2: 1% maintenance
  if (venue === 'aster') return 0.025; // Aster generic
  return 0.025; // generic default
}

function venueIMR(venue, leverage) {
  const lev = Math.max(1, leverage);
  if (venue === 'dydx_v4') return Math.max(0.05, 1 / lev); // IMF 5% min
  return 1 / lev;
}

function round6(v) { return isFinite(v) ? Math.round(v * 1e6) / 1e6 : 0; }
function round4(v) { return isFinite(v) ? Math.round(v * 1e4) / 1e4 : 0; }
function round2(v) { return isFinite(v) ? Math.round(v * 100) / 100 : 0; }
function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }

export function compute(pp) {
  pp = pp || {};

  const venue = pp.venue || 'hyperliquid';
  const side = pp.side === 'short' ? 'short' : 'long';
  const mode = pp.mode === 'cross' ? 'cross' : 'isolated';
  const leverage = Math.max(1, Math.min(500, safeNum(pp.leverage, 5)));
  const entry_price = Math.max(0.01, safeNum(pp.entry_price, 50000));
  const position_size = Math.max(0.000001, safeNum(pp.position_size, 1.0));
  const mark_price = Math.max(0.01, safeNum(pp.mark_price, entry_price));

  const compliance_flags = [];

  // MMR and IMR
  const mmr_override = Number.isFinite(Number(pp.mmr_pct)) ? Math.max(0.0001, Number(pp.mmr_pct) / 100) : null;
  const mmr = mmr_override !== null ? mmr_override : venueMMR(venue, leverage);
  const imr = venueIMR(venue, leverage);

  const notional = round6(entry_price * position_size);
  const initial_margin = round6(notional * imr);
  const maintenance_threshold = round6(notional * mmr);

  const side_sign = side === 'long' ? 1 : -1;
  const unrealized_pnl = round6(side_sign * (mark_price - entry_price) * position_size);
  const margin_balance = round6(initial_margin + unrealized_pnl);

  // Liquidation price (isolated)
  const liq_price_isolated = side === 'long'
    ? round6(entry_price * (1 - 1 / leverage + mmr))
    : round6(entry_price * (1 + 1 / leverage - mmr));

  // Distance to liquidation as %
  const liq_diff = side === 'long'
    ? (mark_price - liq_price_isolated) / mark_price
    : (liq_price_isolated - mark_price) / mark_price;
  const distance_to_liq_pct = round4(liq_diff * 100);

  // Buffer
  const buffer = round6(margin_balance - maintenance_threshold);
  const buffer_pct = maintenance_threshold > 0 ? round4(buffer / maintenance_threshold * 100) : 0;

  let health;
  if (buffer_pct > 100) health = 'GREEN';
  else if (buffer_pct > 0) health = 'AMBER';
  else health = 'RED';

  // Portfolio margin mode (spot offset)
  let portfolio_margin_note = null;
  let cross_margin_efficiency = null;

  if (mode === 'cross') {
    const spot_offset_usd = safeNum(pp.spot_offset_usd, 0);
    const correlation = Math.max(-1, Math.min(1, safeNum(pp.correlation, 0.9)));
    // For a short perp hedged by long spot: effective margin benefit
    if (spot_offset_usd > 0 && side === 'short') {
      const hedge_offset = spot_offset_usd * Math.abs(correlation);
      const effective_margin = round6(initial_margin + hedge_offset);
      const effective_buffer = round6(effective_margin + unrealized_pnl - maintenance_threshold);
      cross_margin_efficiency = {
        spot_offset_usd: round2(spot_offset_usd),
        correlation: round4(correlation),
        hedge_offset: round2(hedge_offset),
        effective_margin: round2(effective_margin),
        effective_buffer: round2(effective_buffer),
      };
    }
    portfolio_margin_note = 'Cross-margin: account-level liquidation when account_value < sum(notional_i * mmr_i). Leverage sets collateral drawn, not the liquidation trigger.';
  }

  if (health === 'RED') compliance_flags.push('BELOW_MAINTENANCE');
  if (health === 'AMBER') compliance_flags.push('NEAR_MAINTENANCE');
  if (leverage > 10) compliance_flags.push('HIGH_LEVERAGE');
  if (distance_to_liq_pct < 5 && distance_to_liq_pct >= 0) compliance_flags.push('NEAR_LIQUIDATION');

  const output_payload = {
    venue: String(venue),
    mode: mode,
    side: side,
    leverage: round4(leverage),
    entry_price: round6(entry_price),
    mark_price: round6(mark_price),
    position_size: round6(position_size),
    notional: notional,
    imr_pct: round4(imr * 100),
    mmr_pct: round4(mmr * 100),
    initial_margin: initial_margin,
    maintenance_threshold: maintenance_threshold,
    unrealized_pnl: unrealized_pnl,
    margin_balance: margin_balance,
    buffer: buffer,
    buffer_pct: buffer_pct,
    liq_price: liq_price_isolated,
    distance_to_liq_pct: distance_to_liq_pct,
    health: health,
    cross_margin_efficiency: cross_margin_efficiency,
    portfolio_margin_note: portfolio_margin_note,
    mark_price_note: 'Liquidation is triggered at the mark price (not last-traded). On Hyperliquid, mark = median(spot, bid, ask). Divergence from entry can cause liquidation before the price you see on charts.',
    disclaimer: 'Not financial advice. Liquidation parameters vary by venue, tier, and market conditions. Verify MMR tiers and mark-price rules with your venue before trading. For informational purposes only.',
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
