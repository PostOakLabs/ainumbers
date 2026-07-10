import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-159-vida-einvoice-en16931-conformance-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_vida_einvoice_conformance',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ViDA (EU 2025/516) mandates EN 16931 structured e-invoicing for intra-EU B2B from 2030-07-01.
// EN 16931-1:2026 (CEN) defines mandatory BTs. This kernel validates the required-field subset
// structurally. Feeds DRR reporter (art-160). Zero network.
export function compute(pp) {
  const { invoice = {} } = pp;
  const v = (x) => typeof x === 'string' && x.trim().length > 0;
  const CCY = /^[A-Z]{3}$/;
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const VAT_CATS = ['S', 'Z', 'E', 'K', 'G', 'O', 'L', 'M'];
  // EN 16931 §5.10: syntax conformant means urn:cen.eu:en16931 prefix
  const SYNTAX_IDS = [
    'urn:cen.eu:en16931:2017',
    'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0',
    'urn:cen.eu:en16931:2017#conformant#urn:UBL.BE:1.0.0.20180214',
  ];

  const total_with_vat = Number.isFinite(Number(invoice.total_with_vat))
    ? Number(invoice.total_with_vat)
    : NaN;
  const total_ok = Number.isFinite(total_with_vat) && total_with_vat >= 0;

  const vat_breakdown_present =
    Array.isArray(invoice.vat_breakdown) && invoice.vat_breakdown.length > 0;
  const vat_category_valid =
    vat_breakdown_present &&
    invoice.vat_breakdown.every(
      (vb) => typeof vb === 'object' && vb !== null && VAT_CATS.includes(vb.category_code)
    );

  const checks = {
    invoice_number: v(invoice.invoice_number),
    invoice_date: typeof invoice.invoice_date === 'string' && DATE.test(invoice.invoice_date),
    currency_code: typeof invoice.currency_code === 'string' && CCY.test(invoice.currency_code),
    seller_name: v(invoice.seller_name),
    buyer_name: v(invoice.buyer_name),
    seller_vat_id: v(invoice.seller_vat_id),
    vat_breakdown_present,
    vat_category_valid,
    total_with_vat: total_ok,
  };

  const syntax_id_valid = SYNTAX_IDS.includes(invoice.syntax_id ?? '');
  const missing_fields = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  const conformant = missing_fields.length === 0;
  const vida_ready = conformant && syntax_id_valid;

  const compliance_flags = [];
  compliance_flags.push('VIDA_EINVOICE_ASSESSED');
  if (vida_ready) compliance_flags.push('VIDA_EN16931_CONFORMANT');
  else if (conformant) compliance_flags.push('EN16931_CONFORMANT_SYNTAX_ADVISORY');
  else compliance_flags.push('EN16931_NON_CONFORMANT');

  return {
    output_payload: {
      conformant,
      vida_ready,
      syntax_id_valid,
      mandatory_fields_checked: Object.keys(checks).length,
      missing_fields,
      currency_code: invoice.currency_code ?? null,
      total_with_vat: Number.isFinite(total_with_vat) ? total_with_vat : 0,
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
