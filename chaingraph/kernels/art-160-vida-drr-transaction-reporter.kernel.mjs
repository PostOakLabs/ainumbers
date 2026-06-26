import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-160-vida-drr-transaction-reporter';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'assess_vida_drr_reporting_obligation',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ViDA Digital Reporting Requirements (DRR): replaces EC Sales Lists for intra-EU B2B cross-border
// from 2030-07-01. Reports due within 10 calendar days of invoice date (Art. 262 VAT Directive as
// amended). Consumes art-159 conformance signal; feeds migration assessor (art-161). Zero network.
export function compute(pp) {
  const { transaction = {} } = pp;
  const MEMBER_STATES = new Set([
    'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR',
    'HR','HU','IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK',
  ]);
  const msOk = (x) => typeof x === 'string' && MEMBER_STATES.has(x.trim().toUpperCase());

  const seller_ms = (transaction.seller_member_state ?? '').trim().toUpperCase();
  const buyer_ms = (transaction.buyer_member_state ?? '').trim().toUpperCase();
  const intra_eu = msOk(seller_ms) && msOk(buyer_ms) && seller_ms !== buyer_ms;
  const is_b2b = transaction.supply_type === 'B2B';
  const has_seller_vat = typeof transaction.seller_vat_id === 'string' && transaction.seller_vat_id.trim().length > 0;
  const has_buyer_vat = typeof transaction.buyer_vat_id === 'string' && transaction.buyer_vat_id.trim().length > 0;

  const txn_value = Number.isFinite(Number(transaction.transaction_value))
    ? Number(transaction.transaction_value)
    : 0;

  const drr_in_scope = intra_eu && is_b2b;
  const MANDATORY_DATE = '2030-07-01';

  let reporting_deadline = null;
  const invoice_date = transaction.invoice_date ?? '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(invoice_date)) {
    const d = new Date(invoice_date + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 10);
    reporting_deadline = d.toISOString().slice(0, 10);
  }

  const data_elements_ok = has_seller_vat && has_buyer_vat && txn_value >= 0;

  const compliance_flags = { VIDA_DRR_ASSESSED: true };
  if (drr_in_scope) {
    compliance_flags.VIDA_DRR_IN_SCOPE = true;
    if (data_elements_ok) compliance_flags.VIDA_DRR_DATA_ELEMENTS_COMPLETE = true;
    else compliance_flags.VIDA_DRR_DATA_ELEMENTS_INCOMPLETE = true;
  } else {
    compliance_flags.VIDA_DRR_OUT_OF_SCOPE = true;
  }

  return {
    output_payload: {
      drr_in_scope,
      intra_eu,
      is_b2b,
      seller_member_state: seller_ms || null,
      buyer_member_state: buyer_ms || null,
      reporting_deadline,
      mandatory_from: MANDATORY_DATE,
      transaction_value: txn_value,
      data_elements_ok,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
