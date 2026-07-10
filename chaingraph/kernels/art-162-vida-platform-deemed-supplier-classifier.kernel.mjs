import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-162-vida-platform-deemed-supplier-classifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'classify_vida_platform_deemed_supplier',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ViDA Art. 46a (amended VAT Directive): platforms facilitating short-term accommodation (≤30
// consecutive nights) or intra-EU road passenger transport become deemed suppliers when the
// underlying supplier has no valid VAT ID. VAT liability transfers to the platform.
// Mandatory from 2028-07-01 (MS may extend to 2030-01-01). Root node of
// vida-platform-and-registration chain (art-162→163→164). Zero network.
export function compute(pp) {
  const { platform = {} } = pp;

  const ELIGIBLE_SECTORS = ['short_term_accommodation', 'passenger_transport_road'];
  const sector = platform.sector ?? '';
  const sector_eligible = ELIGIBLE_SECTORS.includes(sector);

  const duration_nights = Number.isFinite(Number(platform.duration_nights))
    ? Number(platform.duration_nights)
    : NaN;
  const accom_duration_ok =
    sector === 'short_term_accommodation'
      ? Number.isFinite(duration_nights) && duration_nights >= 1 && duration_nights <= 30
      : true;

  const supplier_has_vat = platform.supplier_has_valid_vat_id === true;
  const intra_eu_supply = platform.intra_eu_supply === true;

  const deemed_supplier = sector_eligible && accom_duration_ok && !supplier_has_vat && intra_eu_supply;

  const MANDATORY_DATE = '2028-07-01';
  const MS_EXTENSION_DATE = '2030-01-01';

  const compliance_flags = [];
  compliance_flags.push('VIDA_PLATFORM_ASSESSED');
  if (deemed_supplier) {
    compliance_flags.push('VIDA_DEEMED_SUPPLIER_APPLIES');
    compliance_flags.push('VIDA_VAT_LIABILITY_TRANSFERRED');
  } else if (sector_eligible && supplier_has_vat) {
    compliance_flags.push('VIDA_PLATFORM_FACILITATOR_ONLY');
  } else if (!sector_eligible) {
    compliance_flags.push('VIDA_DEEMED_SUPPLIER_NOT_APPLICABLE');
  } else {
    compliance_flags.push('VIDA_PLATFORM_NOT_IN_SCOPE');
  }

  return {
    output_payload: {
      deemed_supplier,
      sector,
      sector_eligible,
      supplier_has_valid_vat_id: platform.supplier_has_valid_vat_id ?? null,
      intra_eu_supply,
      duration_nights: Number.isFinite(duration_nights) ? duration_nights : null,
      mandatory_from: MANDATORY_DATE,
      ms_extension_option: MS_EXTENSION_DATE,
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
