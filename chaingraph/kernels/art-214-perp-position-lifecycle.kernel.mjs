import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-214-perp-position-lifecycle';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'model_perp_position',
  mandate_type: 'derivatives_margin_health', gpu: false,
};

function round6(v) { return isFinite(v) ? Math.round(v * 1e6) / 1e6 : 0; }
function round4(v) { return isFinite(v) ? Math.round(v * 1e4) / 1e4 : 0; }
function round2(v) { return isFinite(v) ? Math.round(v * 100) / 100 : 0; }
function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }

// Per-venue fee rate defaults
function venueMMR(venue, leverage) {
  const lev = Math.max(1, leverage);
  if (venue === 'hyperliquid') return 1 / (2 * Math.min(40, lev));
  if (venue === 'dydx_v4') return 0.03;
  if (venue === 'binance') return 0.005;
  return 0.025;
}

export function compute(pp) {
  pp = pp || {};

  const venue = pp.venue || 'hyperliquid';
  const side = pp.side === 'short' ? 'short' : 'long';
  const side_sign = side === 'long' ? 1 : -1;

  const entry_price = Math.max(0.01, safeNum(pp.entry_price, 50000));
  const exit_price = Math.max(0.01, safeNum(pp.exit_price, 52000));
  const position_size = Math.max(0.000001, safeNum(pp.position_size, 1.0));
  const leverage = Math.max(1, Math.min(500, safeNum(pp.leverage, 5)));

  const mmr_override = Number.isFinite(Number(pp.mmr_pct)) ? Math.max(0.0001, Number(pp.mmr_pct) / 100) : null;
  const mmr = mmr_override !== null ? mmr_override : venueMMR(venue, leverage);

  const taker_fee_pct = Math.max(0, safeNum(pp.taker_fee_pct, 0.055)); // Hyperliquid default 0.055%
  const maker_fee_pct = safeNum(pp.maker_fee_pct, -0.002); // Maker rebate
  const open_fee_type = pp.open_fee_type === 'maker' ? 'maker' : 'taker';
  const close_fee_type = pp.close_fee_type === 'maker' ? 'maker' : 'taker';

  // Funding parameters
  const funding_rate_per_interval = safeNum(pp.funding_rate_per_interval, 0.0001); // 0.01% default
  const n_intervals = Math.max(0, Math.round(safeNum(pp.n_intervals, 24))); // 24 hours default
  // Static-string timestamps — never Date.now(). Provided by user or default.
  const open_ts = typeof pp.open_ts === 'string' && pp.open_ts ? pp.open_ts : '2026-07-01T00:00:00Z';
  const close_ts = typeof pp.close_ts === 'string' && pp.close_ts ? pp.close_ts : '2026-07-02T00:00:00Z';

  const compliance_flags = [];

  // Open leg
  const notional = round6(entry_price * position_size);
  const initial_margin = round6(notional / leverage);
  const maintenance_threshold = round6(notional * mmr);

  const liq_price = side === 'long'
    ? round6(entry_price * (1 - 1 / leverage + mmr))
    : round6(entry_price * (1 + 1 / leverage - mmr));

  const open_fee_rate = open_fee_type === 'maker' ? maker_fee_pct / 100 : taker_fee_pct / 100;
  const open_fee = round2(notional * open_fee_rate);

  // Close leg
  const exit_notional = round6(exit_price * position_size);
  const close_fee_rate = close_fee_type === 'maker' ? maker_fee_pct / 100 : taker_fee_pct / 100;
  const close_fee = round2(exit_notional * close_fee_rate);

  // Realized PnL (before fees and funding)
  const price_delta = round6(exit_price - entry_price);
  const realized_pnl_gross = round6(side_sign * price_delta * position_size);

  // Cumulative funding
  // Positive rate: longs pay shorts. Negative rate: shorts pay longs.
  // funding_per_interval = notional * rate (using entry notional for simplicity)
  const funding_per_interval = round6(notional * Math.abs(funding_rate_per_interval));
  const total_funding_paid_raw = funding_per_interval * n_intervals;
  // Long with positive rate pays; short with positive rate receives
  const funding_sign = (side === 'long' && funding_rate_per_interval >= 0) ||
                        (side === 'short' && funding_rate_per_interval < 0) ? 1 : -1;
  const total_funding_impact = round2(funding_sign * total_funding_paid_raw);

  // Net P&L
  const total_fees = round2(open_fee + close_fee);
  const realized_pnl_net = round2(realized_pnl_gross - total_fees);
  const total_net_pnl = round2(realized_pnl_net - total_funding_impact);

  const margin_returned = round2(Math.max(0, initial_margin + total_net_pnl));
  const margin_return_pct = initial_margin > 0 ? round4(total_net_pnl / initial_margin * 100) : 0;

  // Did the position get liquidated?
  const mid_price_estimate = (entry_price + exit_price) / 2;
  const would_liquidate = side === 'long' ? mid_price_estimate <= liq_price : mid_price_estimate >= liq_price;

  if (would_liquidate) compliance_flags.push('LIQUIDATION_RISK');
  if (total_net_pnl < 0) compliance_flags.push('NEGATIVE_PNL');
  if (leverage > 10) compliance_flags.push('HIGH_LEVERAGE');
  if (n_intervals > 720) compliance_flags.push('LONG_HOLDING_PERIOD');
  if (total_funding_impact > Math.abs(realized_pnl_gross) * 0.5 && Math.abs(realized_pnl_gross) > 0) compliance_flags.push('FUNDING_DOMINATES');

  const output_payload = {
    venue: String(venue),
    side: side,
    entry_price: round6(entry_price),
    exit_price: round6(exit_price),
    position_size: round6(position_size),
    leverage: round4(leverage),
    notional: notional,
    initial_margin: initial_margin,
    maintenance_threshold: maintenance_threshold,
    liq_price: liq_price,
    open_ts: open_ts,
    close_ts: close_ts,
    open_fee_type: open_fee_type,
    close_fee_type: close_fee_type,
    open_fee: open_fee,
    close_fee: close_fee,
    total_fees: total_fees,
    price_delta: price_delta,
    realized_pnl_gross: realized_pnl_gross,
    realized_pnl_net: realized_pnl_net,
    funding_rate_per_interval: round6(funding_rate_per_interval),
    n_intervals: n_intervals,
    total_funding_impact: total_funding_impact,
    total_net_pnl: total_net_pnl,
    margin_returned: margin_returned,
    margin_return_pct: margin_return_pct,
    mmr_pct: round4(mmr * 100),
    disclaimer: 'Not financial advice. Funding rates are variable and unpredictable. Liquidation price is approximate (isolated margin). Actual outcomes depend on mark price, funding cadence, and venue rules. For informational purposes only.',
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
