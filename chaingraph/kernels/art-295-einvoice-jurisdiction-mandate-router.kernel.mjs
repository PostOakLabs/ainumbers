import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-295-einvoice-jurisdiction-mandate-router';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'route_einvoice_jurisdiction_mandate',
  mandate_type: 'compliance_mandate', gpu: false,
};

const TABLE_VERSION = 'einvoice-mandate-table-2026-07-13';

// Version-pinned mandate table. FR receive-obligation date (2026-09-01) is the
// confirmed research-cited date for this build. DE/AE/MY dates are DRAFT-PIN
// (could not be re-confirmed against a live source at build time).
const MANDATE_TABLE = {
  FR: {
    applicable_format: 'factur-x_or_ubl', mandatory_from: '2026-09-01',
    transmission_channel: 'PDP', note: 'B2B receive obligation via Plateforme de Dematerialisation Partenaire',
  },
  DE: {
    applicable_format: 'xrechnung', mandatory_from: '2025-01-01',
    transmission_channel: 'direct', note: 'B2B receive live; issue obligation phases 2027-01-01/2028-01-01 (DRAFT-PIN, unconfirmed as of 2026-07-13)',
  },
  AE: {
    applicable_format: 'pint-ae', mandatory_from: 'DRAFT-PIN unconfirmed as of 2026-07-13',
    transmission_channel: 'direct', note: 'PINT-AE pilot phase',
  },
  MY: {
    applicable_format: 'myinvois', mandatory_from: 'DRAFT-PIN unconfirmed as of 2026-07-13',
    transmission_channel: 'direct', note: 'MyInvois phased rollout by taxpayer tier',
  },
};

function dateAtOrPast(dateStr, mandatoryFrom) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(mandatoryFrom)) return null; // DRAFT-PIN, non-comparable
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  return dateStr >= mandatoryFrom;
}

export function compute(pp) {
  const supplier_country = typeof pp.supplier_country === 'string' ? pp.supplier_country.trim().toUpperCase() : '';
  const buyer_country = typeof pp.buyer_country === 'string' ? pp.buyer_country.trim().toUpperCase() : '';
  const transaction_type = pp.transaction_type;
  const transaction_date = typeof pp.transaction_date === 'string' ? pp.transaction_date : '';

  if (transaction_type === 'B2C' && buyer_country !== 'MY') {
    return {
      output_payload: {
        regime_country: buyer_country || null, applicable_format: null, mandatory_from: null,
        phase_status: 'consumer_out_of_scope', transmission_channel: 'none', table_version: TABLE_VERSION,
      },
      compliance_flags: ['EINVOICE_MANDATE_ASSESSED', 'EINVOICE_MANDATE_OUT_OF_SCOPE'],
    };
  }

  const regime = MANDATE_TABLE[buyer_country] || MANDATE_TABLE[supplier_country];
  const regime_country = MANDATE_TABLE[buyer_country] ? buyer_country : (MANDATE_TABLE[supplier_country] ? supplier_country : null);

  if (!regime) {
    return {
      output_payload: {
        regime_country: null, applicable_format: null, mandatory_from: null,
        phase_status: 'not_yet_mandated', transmission_channel: 'none', table_version: TABLE_VERSION,
      },
      compliance_flags: ['EINVOICE_MANDATE_ASSESSED', 'EINVOICE_MANDATE_NO_REGIME'],
    };
  }

  const isPast = dateAtOrPast(transaction_date, regime.mandatory_from);
  const phase_status = isPast === true ? 'mandatory' : (isPast === false ? 'phase_in_pending' : 'phase_unconfirmed');

  const compliance_flags = ['EINVOICE_MANDATE_ASSESSED', 'EINVOICE_MANDATE_ROUTED_' + phase_status.toUpperCase()];

  return {
    output_payload: {
      regime_country, applicable_format: regime.applicable_format, mandatory_from: regime.mandatory_from,
      phase_status, transmission_channel: regime.transmission_channel, table_version: TABLE_VERSION,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.4/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
