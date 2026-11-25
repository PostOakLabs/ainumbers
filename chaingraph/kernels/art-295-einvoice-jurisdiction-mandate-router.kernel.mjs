import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-295-einvoice-jurisdiction-mandate-router';
const TOOL_VERSION = '1.1.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'route_einvoice_jurisdiction_mandate',
  mandate_type: 'compliance_mandate', gpu: false,
};

const TABLE_VERSION = 'einvoice-mandate-table-2027';

// Version-pinned mandate table, re-verified 2026-11-25 against official sources.
// Confirmed rows: FR receive obligation 2026-09-01 (impots.gouv.fr), DE issue phases
// 2027-01-01 / 2028-01-01 (§27 Abs. 38 UStG, gesetze-im-internet.de), BE 2026-01-01
// (einvoice.belgium.be), PL 2026-02-01 / 2026-04-01 (ksef.podatki.gov.pl). Rows whose
// date could not be confirmed on an official page carry the DRAFT-PIN form, which
// routes to phase_unconfirmed: DE receive date, AE timeline, MY tiered rollout.
// The table pin names 2027 because the confirmed dates are statutory and govern 2027;
// it makes no currency claim for the DRAFT-PIN rows.
const MANDATE_TABLE = {
  FR: {
    applicable_format: 'factur-x_or_ubl', mandatory_from: '2026-09-01',
    transmission_channel: 'PDP', note: 'All businesses must be able to receive e-invoices from 2026-09-01; large and mid-size issue from 2026-09-01 (impots.gouv.fr, read 2026-11-25; official pages now say plateforme agreee). SME/micro issue date unverified on an official page as of 2026-11-25.',
  },
  DE: {
    applicable_format: 'xrechnung', mandatory_from: 'DRAFT-PIN unconfirmed as of 2026-11-25',
    transmission_channel: 'direct', note: 'Issue obligation for supplies from 2027-01-01 (prior-year turnover above EUR 800,000) and from 2028-01-01 for all others, per §27 Abs. 38 UStG; EN 16931 format per §14 UStG. The 2025-01-01 receive date is not stated in those sections and is unverified as of 2026-11-25.',
  },
  AE: {
    applicable_format: 'pint-ae', mandatory_from: 'DRAFT-PIN unconfirmed as of 2026-11-25',
    transmission_channel: 'direct', note: 'Ministerial Decisions No. 243 and 244 of 2025; Peppol 5-corner model, UAE PINT (tax.gov.ae). Timeline dates unverified on an official page as of 2026-11-25.',
  },
  MY: {
    applicable_format: 'myinvois', mandatory_from: 'DRAFT-PIN unconfirmed as of 2026-11-25',
    transmission_channel: 'direct', note: 'MyInvois rollout is tiered by annual turnover (LHDN timeline, updated 2026-08-30), with tier dates 2024-08-01, 2025-01-01, 2025-07-01 and 2026-01-01; turnover below RM3m exempt. A single-date table cannot represent the tiers, so the date stays unpinned.',
  },
  BE: {
    applicable_format: 'peppol-bis3', mandatory_from: '2026-01-01',
    transmission_channel: 'Peppol network', note: 'Belgium mandatory B2B structured e-invoicing, live since 2026-01-01',
  },
  PL: {
    applicable_format: 'ksef-fa3', mandatory_from: '2026-02-01',
    transmission_channel: 'KSeF', note: 'KSeF 2.0 mandatory from 2026-02-01 for taxpayers with 2024 sales above PLN 200m and from 2026-04-01 for others; FA(3) from 2026-02-01 (ksef.podatki.gov.pl, read 2026-11-25). mandatory_from carries the first phase.',
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
