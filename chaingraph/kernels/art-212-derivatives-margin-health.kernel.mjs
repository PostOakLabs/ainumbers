import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-212-derivatives-margin-health';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'derivatives_margin_health',
  mandate_type: 'derivatives_margin_health',
  gpu: false,
};

// Derivatives Margin Health Calculator
// Computes unrealized PnL, margin balance, maintenance buffer, liquidation price,
// and leverage ratio for an isolated margin position. Not financial advice.

export function compute(pp) {
  pp = pp || {};
  const ip = (pp && pp.input_parameters) ? pp.input_parameters : pp;

  const side          = (typeof ip.side === 'string' && ip.side === 'SHORT') ? 'SHORT' : 'LONG';
  const entry_price   = Number.isFinite(Number(ip.entry_price))   && Number(ip.entry_price)   > 0 ? Number(ip.entry_price)   : 3.5;
  const mark_price    = Number.isFinite(Number(ip.mark_price))    && Number(ip.mark_price)    > 0 ? Number(ip.mark_price)    : 3.5;
  const notional      = Number.isFinite(Number(ip.notional))      && Number(ip.notional)      > 0 ? Number(ip.notional)      : 1000.0;
  const margin_posted = Number.isFinite(Number(ip.margin_posted))                                   ? Number(ip.margin_posted) : 100.0;
  const mmr           = Number.isFinite(Number(ip.mmr))           && Number(ip.mmr)           > 0 ? Number(ip.mmr)           : 0.05;
  const imr           = Number.isFinite(Number(ip.imr))           && Number(ip.imr)           > 0 ? Number(ip.imr)           : null;

  const side_sign = side === 'LONG' ? 1 : -1;

  // Contracts quantity: notional / entry_price (guard against zero)
  const qty = entry_price > 0 ? notional / entry_price : 0;

  // Unrealized PnL
  const unrealized_pnl = side_sign * (mark_price - entry_price) * qty;

  // Margin balance
  const margin_balance = margin_posted + unrealized_pnl;

  // Maintenance threshold
  const maintenance_threshold = notional * mmr;

  // Buffer and buffer_pct
  const buffer = margin_balance - maintenance_threshold;
  const buffer_pct = maintenance_threshold > 0
    ? (buffer / maintenance_threshold) * 100
    : 0;

  // Liquidation price (isolated margin approximation)
  // liq_price = entry_price - side_sign * (margin_posted - maintenance_threshold) / qty
  const liquidation_price = qty > 0
    ? entry_price - side_sign * (margin_posted - maintenance_threshold) / qty
    : 0;

  // Leverage ratio
  const leverage_ratio = margin_balance > 0
    ? notional / margin_balance
    : 999;

  // Health classification
  let health;
  if (buffer_pct > 100) health = 'GREEN';
  else if (buffer_pct > 0) health = 'AMBER';
  else health = 'RED';

  // Round to 6 decimal places
  const r6 = (v) => {
    if (!Number.isFinite(v)) return 0;
    return Math.round(v * 1e6) / 1e6;
  };

  const output_payload = {
    unrealized_pnl: r6(unrealized_pnl),
    margin_balance: r6(margin_balance),
    maintenance_threshold: r6(maintenance_threshold),
    buffer: r6(buffer),
    buffer_pct: r6(buffer_pct),
    liquidation_price: r6(liquidation_price),
    leverage_ratio: r6(Math.min(leverage_ratio, 999)),
    health: health,
  };

  const compliance_flags = [];
  if (buffer < 0) compliance_flags.push('MARGIN_BELOW_MAINTENANCE');
  if (imr !== null && margin_posted < notional * imr) compliance_flags.push('MARGIN_BELOW_INITIAL');
  if (leverage_ratio > 10) compliance_flags.push('HIGH_LEVERAGE');

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
    buildType: 'https://ainumbers.co/chaingraph/standard/openchain-graph-spec#WebCryptoSHA256',
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    audit_signature: {
      payloadType: 'application/vnd.openchain.graph+json;version=0.2',
      payload: '', signatures: [],
      client_side_executed: false, zero_pii_verified: true, deterministic_run: true,
    },
  };
}
