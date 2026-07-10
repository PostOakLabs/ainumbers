import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-114-suspect-product-quarantine';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'assess_suspect_product_status',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

export function compute(pp) {
  const { verification_failed, identifier_unmatched, counterfeit_indicators = [],
          quarantined, fda_notified } = pp;
  const suspect = verification_failed === true || identifier_unmatched === true || counterfeit_indicators.length > 0;
  const illegitimate = suspect && counterfeit_indicators.length > 0;
  const required_actions = [];
  if (suspect) { required_actions.push('QUARANTINE', 'INVESTIGATE'); }
  if (illegitimate) { required_actions.push('FDA_FORM_3911_72H', 'NOTIFY_TRADING_PARTNERS'); }
  const status = illegitimate ? 'ILLEGITIMATE' : suspect ? 'SUSPECT' : 'CLEARED';
  const compliance_flags = [];
  compliance_flags.push('SUSPECT_PRODUCT_ASSESSED');
  if (suspect) compliance_flags.push('SUSPECT_PRODUCT');
  if (illegitimate) compliance_flags.push('ILLEGITIMATE_PRODUCT');
  if (suspect && quarantined !== true) compliance_flags.push('QUARANTINE_PENDING');
  if (illegitimate && fda_notified !== true) compliance_flags.push('FDA_NOTIFICATION_PENDING');
  return { output_payload: { status, required_actions }, compliance_flags };
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
