import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-214-afp-dcc-position-close';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'afp_dcc_position_close',
  mandate_type: 'afp_dcc_position_close',
  gpu: false,
};

// AFP/DCC Position Close / Settlement Calculator
// Computes final PnL and returned margin for closing a derivatives position
// under the AFP/DCC model. Accepts voluntary close, liquidation, and
// expiry/oracle settlement close methods. Not financial advice.

export function compute(pp) {
  pp = pp || {};
  const ip = (pp && pp.input_parameters) ? pp.input_parameters : pp;

  const position_id           = typeof ip.position_id === 'string' ? ip.position_id : 'POS-00000000';
  const side                  = (typeof ip.side === 'string' && ip.side === 'SHORT') ? 'SHORT' : 'LONG';
  const size_contracts        = Number.isFinite(Number(ip.size_contracts)) && Number(ip.size_contracts) > 0
                                ? Number(ip.size_contracts) : 1;
  const contract_size         = Number.isFinite(Number(ip.contract_size)) && Number(ip.contract_size) > 0
                                ? Number(ip.contract_size) : 200.0;
  const open_price            = Number.isFinite(Number(ip.open_price))   ? Number(ip.open_price)   : 3.5;
  const close_price           = Number.isFinite(Number(ip.close_price))  ? Number(ip.close_price)  : 3.5;
  const close_method          = typeof ip.close_method === 'string' ? ip.close_method : 'VOLUNTARY';
  const margin_deposited      = Number.isFinite(Number(ip.margin_deposited)) ? Number(ip.margin_deposited) : 0;
  const settlement_ts         = typeof ip.settlement_ts === 'string' ? ip.settlement_ts : '';
  const parent_position_open_hash = typeof ip.parent_position_open_hash === 'string'
                                ? ip.parent_position_open_hash : '';
  const parent_oracle_hash    = typeof ip.parent_oracle_hash === 'string' ? ip.parent_oracle_hash : '';

  const side_sign = side === 'LONG' ? 1 : -1;

  const price_delta = side_sign * (close_price - open_price);
  const final_pnl = price_delta * contract_size * size_contracts;
  const margin_returned = Math.max(0, margin_deposited + final_pnl);

  // Round to 6 decimal places
  const r6 = (v) => {
    if (!Number.isFinite(v)) return 0;
    return Math.round(v * 1e6) / 1e6;
  };

  const output_payload = {
    final_pnl: r6(final_pnl),
    margin_returned: r6(margin_returned),
    settlement_method: close_method,
    price_delta: r6(price_delta),
    position_status: 'CLOSED',
  };

  const compliance_flags = [];
  if (close_method === 'LIQUIDATION') compliance_flags.push('LIQUIDATION_TRIGGERED');
  if (final_pnl < 0) compliance_flags.push('NEGATIVE_PNL');
  if (close_method === 'EXPIRY_SETTLEMENT') compliance_flags.push('ORACLE_SETTLEMENT');

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
