import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-211-event-market-pnl';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'event_market_pnl',
  mandate_type: 'event_market_pnl',
  gpu: false,
};

// Event-Market PnL Calculator (Scalar/Linear mode)
// Computes PnL for scalar event contracts (AFP forecast futures, Kalshi scalar,
// CME weather) using strike, settlement value, unit value, direction, and
// contract count. Clamps settlement_value to [min_price, max_price].
// Not financial advice.

export function compute(pp) {
  pp = pp || {};
  const ip = (pp && pp.input_parameters) ? pp.input_parameters : pp;

  const mode             = typeof ip.mode === 'string' ? ip.mode : 'scalar';
  const underlying       = typeof ip.underlying === 'string' ? ip.underlying : 'CUSTOM';
  const strike           = Number.isFinite(Number(ip.strike)) ? Number(ip.strike) : 3.5;
  const raw_settlement   = Number.isFinite(Number(ip.settlement_value)) ? Number(ip.settlement_value) : 3.5;
  const unit_value       = Number.isFinite(Number(ip.unit_value)) ? Number(ip.unit_value) : 200;
  const n_contracts      = Number.isFinite(Number(ip.n_contracts)) ? Math.max(1, Number(ip.n_contracts)) : 1;
  const side             = (typeof ip.side === 'string' && ip.side === 'SHORT') ? 'SHORT' : 'LONG';
  const min_price        = Number.isFinite(Number(ip.min_price)) ? Number(ip.min_price) : 0.0;
  const max_price        = Number.isFinite(Number(ip.max_price)) && Number(ip.max_price) > min_price
                           ? Number(ip.max_price) : min_price + 10.0;

  const side_sign = side === 'LONG' ? 1 : -1;

  // Clamp settlement_value to [min_price, max_price]
  const settlement_value = Math.min(Math.max(raw_settlement, min_price), max_price);
  const settlement_in_range = raw_settlement >= min_price && raw_settlement <= max_price;

  // Core PnL calculation
  const settlement_delta = settlement_value - strike;
  const pnl = side_sign * settlement_delta * unit_value * n_contracts;

  // Binary equivalent PnL (fixed payoff regardless of distance from strike)
  const equivalent_binary_pnl = side_sign * unit_value * n_contracts;

  // Fees: 0 for scalar mode
  const fees_paid = 0;

  // Round to 6 decimal places to avoid floating-point noise in hash
  const r6 = (v) => Math.round(v * 1e6) / 1e6;

  const output_payload = {
    pnl: r6(pnl),
    settlement_delta: r6(settlement_delta),
    payoff_type: 'linear',
    settlement_in_range: settlement_in_range,
    equivalent_binary_pnl: r6(equivalent_binary_pnl),
    fees_paid: fees_paid,
  };

  const compliance_flags = [];
  if (!settlement_in_range) compliance_flags.push('OUT_OF_RANGE');
  // FULLY_COLLATERALIZED info flag always present in scalar mode
  compliance_flags.push('FULLY_COLLATERALIZED');

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
