import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-213-afp-dcc-position-open';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'afp_dcc_position_open',
  mandate_type: 'afp_dcc_position_open',
  gpu: false,
};

// AFP/DCC Position Open Simulator
// Simulates opening a derivatives position under the AFP (Automated Financial
// Protocol) and DCC (Derivatives Clearing Contract) model. Computes margin
// requirements, validates deposit sufficiency, and generates a deterministic
// position identifier. Not financial advice.

// DJB2-style 32-bit hash for deterministic position_id from inputs.
function derivePositionId(product_id, account_id, intent_ts) {
  const s = (product_id || '') + '|' + (account_id || '') + '|' + (intent_ts || '');
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  }
  return 'POS-' + h.toString(16).toUpperCase().padStart(8, '0');
}

export function compute(pp) {
  pp = pp || {};
  const ip = (pp && pp.input_parameters) ? pp.input_parameters : pp;

  const product_id            = typeof ip.product_id === 'string' ? ip.product_id : 'CUSTOM';
  const account_id            = typeof ip.account_id === 'string' ? ip.account_id : '0x00000000';
  const side                  = (typeof ip.side === 'string' && ip.side === 'SHORT') ? 'SHORT' : 'LONG';
  const size_contracts        = Number.isFinite(Number(ip.size_contracts)) && Number(ip.size_contracts) > 0
                                ? Number(ip.size_contracts) : 1;
  const margin_deposited      = Number.isFinite(Number(ip.margin_deposited)) ? Number(ip.margin_deposited) : 0;
  const venue_id              = typeof ip.venue_id === 'string' ? ip.venue_id : '';
  const intent_ts             = typeof ip.intent_ts === 'string' ? ip.intent_ts : '';
  const initial_margin_ratio  = Number.isFinite(Number(ip.initial_margin_ratio)) && Number(ip.initial_margin_ratio) > 0
                                ? Number(ip.initial_margin_ratio) : 0.10;
  const contract_size         = Number.isFinite(Number(ip.contract_size)) && Number(ip.contract_size) > 0
                                ? Number(ip.contract_size) : 200.0;
  const parent_margin_health_hash = typeof ip.parent_margin_health_hash === 'string'
                                ? ip.parent_margin_health_hash : '';

  const notional = size_contracts * contract_size;
  const margin_required = notional * initial_margin_ratio;
  const margin_excess = margin_deposited - margin_required;
  const margin_accepted = margin_deposited >= margin_required;

  const position_id = derivePositionId(product_id, account_id, intent_ts);

  // Round to 6 decimal places
  const r6 = (v) => {
    if (!Number.isFinite(v)) return 0;
    return Math.round(v * 1e6) / 1e6;
  };

  const output_payload = {
    position_id: position_id,
    margin_required: r6(margin_required),
    margin_excess: r6(margin_excess),
    open_interest_delta: size_contracts,
    notional: r6(notional),
    margin_accepted: margin_accepted,
    position_status: 'OPEN',
  };

  const compliance_flags = [];
  if (!margin_accepted) compliance_flags.push('INSUFFICIENT_MARGIN');
  if (margin_accepted && margin_excess < 0.1 * margin_required) compliance_flags.push('MARGIN_TIGHT');
  if (venue_id !== 'autex') compliance_flags.push('VENUE_NOT_REGISTERED');

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
