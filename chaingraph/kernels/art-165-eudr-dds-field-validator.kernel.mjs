import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-165-eudr-dds-field-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_eudr_due_diligence_statement',
  mandate_type: 'compliance_mandate', gpu: false,
};

// EUDR (Reg. EU 2023/1115) requires operators to file a Due Diligence Statement (DDS)
// in TRACES NT before placing regulated commodities on the EU market. This kernel validates
// the required-field subset of a DDS structurally: operator identity, EORI, HS code,
// trade name, quantity, country of production, and geolocation indicator. §16 candidate
// (DDS attestation). Feeds geolocation validator (art-166). Zero network.
export function compute(pp) {
  const { dds = {} } = pp;
  const v = (x) => typeof x === 'string' && x.trim().length > 0;
  const EORI_RE = /^[A-Z]{2}[A-Z0-9]{1,15}$/;
  // HS codes: EUDR Annex I covers chapters 01-09,12,15,16,20,23,24,38,40-41,44-48,94
  const HS_RE = /^\d{4,10}$/;

  const quantity_raw = Number(dds.quantity);
  const quantity = Number.isFinite(quantity_raw) ? quantity_raw : 0;
  const quantity_valid = Number.isFinite(quantity_raw) && quantity_raw > 0;

  const checks = {
    operator_name: v(dds.operator_name),
    operator_address: v(dds.operator_address),
    eori: typeof dds.eori === 'string' && EORI_RE.test(dds.eori.trim()),
    hs_code: typeof dds.hs_code === 'string' && HS_RE.test(dds.hs_code.trim()),
    trade_name: v(dds.trade_name),
    quantity: quantity_valid,
    country_of_production: typeof dds.country_of_production === 'string' && /^[A-Z]{2}$/.test(dds.country_of_production.trim()),
    geolocation_present: dds.geolocation_present === true || dds.micro_operator_exemption === true,
  };

  const missing_fields = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  const conformant = missing_fields.length === 0;

  const compliance_flags = [];
  compliance_flags.push('EUDR_DDS_ASSESSED');
  if (conformant) compliance_flags.push('EUDR_DDS_CONFORMANT');
  else compliance_flags.push('EUDR_DDS_INCOMPLETE');

  return {
    output_payload: {
      conformant,
      fields_checked: Object.keys(checks).length,
      fields_passed: Object.values(checks).filter(Boolean).length,
      missing_fields,
      quantity: quantity_valid ? quantity : 0,
      country_of_production: (typeof dds.country_of_production === 'string' ? dds.country_of_production.trim() : null) || null,
      micro_operator_exemption: dds.micro_operator_exemption === true,
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
