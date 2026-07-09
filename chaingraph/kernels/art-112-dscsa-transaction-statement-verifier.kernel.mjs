import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-112-dscsa-transaction-statement-verifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'verify_dscsa_transaction_statement',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

// GS1 SGTIN: GTIN-14 (numeric) + serial. Deterministic structural check only.
function sgtinValid(sgtin) {
  if (typeof sgtin !== 'string') return false;
  const parts = sgtin.split('.');
  return parts.length === 2 && /^\d{14}$/.test(parts[0]) && parts[1].length > 0;
}

export function compute(pp) {
  const {
    product_identifier, lot, expiry,
    ti_present, th_present, ts_present,
    gln_seller, gln_buyer, epcis_event_type, transaction_date,
  } = pp;

  const missing_elements = [];
  if (!ti_present) missing_elements.push('TRANSACTION_INFORMATION');
  if (!th_present) missing_elements.push('TRANSACTION_HISTORY');
  if (!ts_present) missing_elements.push('TRANSACTION_STATEMENT');
  if (!lot) missing_elements.push('LOT');
  if (!expiry) missing_elements.push('EXPIRY');
  if (!gln_seller) missing_elements.push('GLN_SELLER');
  if (!gln_buyer) missing_elements.push('GLN_BUYER');

  const identifier_valid = sgtinValid(product_identifier);
  if (!identifier_valid) missing_elements.push('VALID_SGTIN');

  const VALID_EVENTS = ['commissioning', 'shipping', 'receiving', 'aggregation', 'disaggregation'];
  const epcis_event = VALID_EVENTS.includes(epcis_event_type) ? epcis_event_type : 'UNKNOWN';

  const t3_complete = ti_present === true && th_present === true && ts_present === true;

  const compliance_flags = [];
  compliance_flags.push('DSCSA_T3_ASSESSED');
  if (t3_complete && identifier_valid && missing_elements.length === 0) {
    compliance_flags.push('DSCSA_T3_COMPLETE');
  } else {
    compliance_flags.push('DSCSA_T3_INCOMPLETE');
  }
  if (epcis_event === 'UNKNOWN') compliance_flags.push('EPCIS_EVENT_UNRECOGNIZED');

  const output_payload = {
    t3_complete,
    identifier_valid,
    epcis_event,
    missing_elements,
    transaction_date: transaction_date ?? null,
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
