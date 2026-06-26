import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-163-vida-oss-registration-router';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'route_vida_oss_registration',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ViDA extends Single VAT Registration (SVR) via OSS from 2028-07-01: Union OSS covers all
// cross-border B2C supplies, stock transfers, and deemed-supplier platform supplies within the EU.
// This kernel routes a supply to the correct OSS scheme or domestic VAT. Consumes art-162 (platform
// classifier); feeds art-164 (readiness diagnostic). Zero network.
export function compute(pp) {
  const { supply = {} } = pp;
  const MEMBER_STATES = new Set([
    'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR',
    'HR','HU','IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK',
  ]);
  const msOk = (x) => typeof x === 'string' && MEMBER_STATES.has(x.trim().toUpperCase());

  const supply_type = supply.supply_type ?? '';
  const seller_ms = (supply.seller_establishment ?? '').trim().toUpperCase();
  const dest_ms = (supply.destination_member_state ?? '').trim().toUpperCase();
  const seller_in_eu = msOk(seller_ms);
  const dest_in_eu = msOk(dest_ms);
  const is_b2c = supply_type.startsWith('B2C') || supply_type === 'deemed_supplier' || supply_type === 'stock_transfer';

  let recommended_scheme = null;
  let scheme_rationale = null;

  if (supply_type === 'stock_transfer') {
    recommended_scheme = 'Union_OSS';
    scheme_rationale = 'ViDA extends Union OSS to cover B2C stock transfers from 2028-07-01';
  } else if (is_b2c && seller_in_eu && dest_in_eu && seller_ms !== dest_ms) {
    recommended_scheme = 'Union_OSS';
    scheme_rationale = 'EU-established supplier, cross-border B2C supply within EU';
  } else if (is_b2c && seller_in_eu && seller_ms === dest_ms) {
    recommended_scheme = 'Domestic_VAT';
    scheme_rationale = 'Same-MS supply: domestic VAT registration applies, not OSS';
  } else if (is_b2c && !seller_in_eu && dest_in_eu) {
    if (supply_type === 'B2C_digital' || supply_type === 'deemed_supplier') {
      recommended_scheme = 'Non_Union_OSS';
      scheme_rationale = 'Non-EU supplier: digital or platform-facilitated B2C services to EU consumers';
    } else {
      recommended_scheme = 'IOSS';
      scheme_rationale = 'Non-EU supplier importing goods (≤EUR 150) to EU B2C consumers via IOSS';
    }
  }

  const eligible_for_oss = recommended_scheme !== null && recommended_scheme !== 'Domestic_VAT';

  const compliance_flags = { VIDA_OSS_ASSESSED: true };
  if (recommended_scheme === 'Union_OSS') compliance_flags.VIDA_OSS_UNION = true;
  else if (recommended_scheme === 'Non_Union_OSS') compliance_flags.VIDA_OSS_NON_UNION = true;
  else if (recommended_scheme === 'IOSS') compliance_flags.VIDA_OSS_IOSS = true;
  else if (recommended_scheme === 'Domestic_VAT') compliance_flags.VIDA_OSS_DOMESTIC = true;
  else compliance_flags.VIDA_OSS_UNDETERMINED = true;

  return {
    output_payload: {
      recommended_scheme,
      scheme_rationale,
      eligible_for_oss,
      supply_type,
      seller_establishment: seller_ms || null,
      destination_member_state: dest_ms || null,
      seller_in_eu,
      dest_in_eu,
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
