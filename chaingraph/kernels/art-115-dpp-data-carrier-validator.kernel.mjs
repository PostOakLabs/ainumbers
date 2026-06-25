import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-115-dpp-data-carrier-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'validate_dpp_data_carrier',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

export function compute(pp) {
  const { product_id, data_carrier_type, elements = {}, ontology_version } = pp;
  // CIRPASS-2 DPP Core Ontology required element set (simplified canonical).
  const REQUIRED = ['unique_product_identifier','lookup_mechanism','durability','reparability','recyclability','carbon_footprint','substances_of_concern'];
  const missing_elements = REQUIRED.filter(k => elements[k] === undefined || elements[k] === null || elements[k] === '');
  const VALID_CARRIERS = ['qr_gs1_digital_link','datamatrix','nfc','rfid'];
  const carrier_valid = VALID_CARRIERS.includes(data_carrier_type);
  const id_present = typeof product_id === 'string' && product_id.length > 0;
  const ontology_conformant = missing_elements.length === 0 && carrier_valid && id_present;
  const compliance_flags = { DPP_CARRIER_ASSESSED: true };
  compliance_flags[ontology_conformant ? 'DPP_CORE_ONTOLOGY_CONFORMANT' : 'DPP_NONCONFORMANT'] = true;
  if (!carrier_valid) compliance_flags.DPP_CARRIER_INVALID = true;
  return { output_payload: { product_id: product_id ?? null, carrier_valid, missing_elements, ontology_conformant, ontology_version: ontology_version ?? null }, compliance_flags };
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
