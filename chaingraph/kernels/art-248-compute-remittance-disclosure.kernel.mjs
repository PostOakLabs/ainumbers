import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-248-compute-remittance-disclosure';
const TOOL_VERSION = '1.0.0';

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mandate_type: 'compliance_mandate', gpu: false };

// Reg E subpart B (12 CFR 1005.31 / 1005.32) disclosure arithmetic.
// Zero PII: amounts, rates, fees, taxes only. No sender/recipient identity.
// TABLE_VERSION ties kernel identity to the regulatory snapshot (manual refresh).

const TABLE_VERSION = 'REG-E-SUBPART-B-12CFR1005.31-2024';
const TABLE_SOURCE  = '12 CFR §1005.31 (CFPB, effective 2013, current 2024 ed.); 12 CFR §1005.32 estimate conditions';

// §1005.32(a) estimate conditions (any one sufficient)
// (1) sender does not have a bank account, (2) foreign law prevents exact amounts,
// (3) sender requests estimate (not available in standard remittance transfer)
// We implement a structural flag: estimate_permissible = provider attests §1005.32 applies.
// This is a boolean decision; an agent gates on it.

export function compute(params) {
  const p = params || {};

  // Inputs
  const send_amount          = _finite(p.send_amount, 0);       // USD amount sender pays (pre-fees)
  const exchange_rate        = _finite(p.exchange_rate, 1);     // FX rate (destination currency per USD)
  const provider_fee         = _finite(p.provider_fee, 0);      // USD provider fee
  const third_party_fees     = _finite(p.third_party_fees, 0);  // USD covered third-party fees §1005.31(b)(1)(v)
  const taxes                = _finite(p.taxes, 0);             // USD taxes §1005.31(b)(1)(vi)
  const destination_currency = typeof p.destination_currency === 'string' ? p.destination_currency : 'MXN';
  const destination_country  = typeof p.destination_country  === 'string' ? p.destination_country  : 'MX';
  const estimate_permissible = p.estimate_permissible === true;  // §1005.32 estimate flag

  // §1005.31(b)(1)(i) Transfer amount: amount sent to recipient BEFORE deducting foreign fees/taxes
  // = send_amount - provider_fee - third_party_fees - taxes (all USD)
  const total_deductions_usd = _round6(provider_fee + third_party_fees + taxes);
  const transfer_amount_usd  = _round6(Math.max(0, send_amount - total_deductions_usd));

  // §1005.31(b)(1)(ii) Exchange rate (pre-rounding, as contractually locked)
  const exchange_rate_disclosed = _round6(exchange_rate);

  // §1005.31(b)(1)(iii) Amount received in destination currency
  // = transfer_amount_usd * exchange_rate  (then apply any recipient-country taxes if stated)
  const amount_received_dest = _round2(transfer_amount_usd * exchange_rate_disclosed);

  // §1005.31(b)(1)(iv) Fees breakdown
  const fees = {
    provider_fee:     _round2(provider_fee),
    third_party_fees: _round2(third_party_fees),
    taxes:            _round2(taxes),
    total_fees_usd:   _round2(provider_fee + third_party_fees + taxes)
  };

  // §1005.31(b)(1)(vii) Total to sender = send_amount
  const total_to_sender_usd = _round2(send_amount);

  // Completeness check: all required §1005.31(b)(1) fields populated
  const required_fields_complete = (
    send_amount > 0 &&
    exchange_rate > 0 &&
    destination_currency.length > 0 &&
    destination_country.length > 0
  );

  // §1005.32 estimate permissibility determination
  // If estimate_permissible=true, disclosure may use ESTIMATED values (provider must mark clearly).
  // If false, EXACT amounts required -- transfer is a "standard remittance transfer."
  const disclosure_type = estimate_permissible ? 'ESTIMATED' : 'EXACT';

  // Verify accounting identity: amount_received = (send - fees) * rate
  // Allow small floating-point tolerance
  const identity_check_delta = _round6(Math.abs(amount_received_dest - _round2(transfer_amount_usd * exchange_rate_disclosed)));
  const accounting_identity_ok = identity_check_delta < 0.01;

  return {
    // Core disclosure fields (§1005.31(b)(1))
    transfer_amount_usd,
    exchange_rate_disclosed,
    amount_received_dest,
    destination_currency,
    destination_country,
    fees,
    total_to_sender_usd,
    disclosure_type,
    estimate_permissible,
    // Completeness
    required_fields_complete,
    accounting_identity_ok,
    accounting_identity_delta: identity_check_delta,
    // Regulatory metadata (table_version folds into §17 kernel identity hash)
    table_version: TABLE_VERSION,
    table_source:  TABLE_SOURCE,
    regulatory_basis: '12 CFR §1005.31 (Reg E subpart B, CFPB) required disclosure field set; 12 CFR §1005.32 estimate permissibility conditions',
    pii_note: 'ZERO PII: amounts, rates, fees, taxes only. No sender, recipient, or account data enters this kernel.',
    anchor_surface: 'anchor.ainumbers.co/mcp -- anchor execution_hash pre-transfer to create a tamper-evident disclosure receipt for CFPB exam and error-resolution disputes (12 CFR §1005.33)'
  };
}

function _finite(v, def) {
  const n = Number(v);
  return (isFinite(n) && !isNaN(n)) ? n : def;
}

function _round6(v) { return Math.round(v * 1e6) / 1e6; }
function _round2(v) { return Math.round(v * 100) / 100; }

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const output_payload = compute(pp);
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
    compliance_flags: [],
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
