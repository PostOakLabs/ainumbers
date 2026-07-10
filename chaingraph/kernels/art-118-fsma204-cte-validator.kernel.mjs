import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-118-fsma204-cte-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'validate_fsma204_cte',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

export function compute(pp) {
  const { cte_type, kdes = {}, ftl_food } = pp;
  // Required KDEs per CTE type (FDA FSMA 204 §1.1345). Simplified canonical set.
  const REQUIRED = {
    harvesting:      ['traceability_lot_code','location_description','harvest_date','reference_document'],
    cooling:         ['traceability_lot_code','location_description','cooling_date','quantity'],
    initial_packing: ['traceability_lot_code','location_description','packing_date','quantity','product_description'],
    shipping:        ['traceability_lot_code','ship_to_location','ship_date','quantity','reference_document'],
    receiving:       ['traceability_lot_code','receive_location','receive_date','quantity','reference_document'],
    transformation:  ['new_traceability_lot_code','input_traceability_lot_codes','location_description','transformation_date','quantity'],
  };
  const required = REQUIRED[cte_type] || [];
  const missing_kdes = required.filter(k => kdes[k] === undefined || kdes[k] === null || kdes[k] === '');
  const cte_valid = required.length > 0 && missing_kdes.length === 0;
  const compliance_flags = [];
  compliance_flags.push('FSMA204_CTE_ASSESSED');
  compliance_flags.push(cte_valid ? 'FSMA204_CTE_COMPLETE' : 'FSMA204_CTE_INCOMPLETE');
  if (required.length === 0) compliance_flags.push('UNRECOGNIZED_CTE_TYPE');
  return { output_payload: { cte_type, cte_valid, missing_kdes, ftl_food: ftl_food ?? null }, compliance_flags };
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
