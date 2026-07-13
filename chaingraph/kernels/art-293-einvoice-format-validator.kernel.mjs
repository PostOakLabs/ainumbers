import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-293-einvoice-format-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_einvoice_format',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Version-pinned format rule sets. FR mandate date (2026-09-01) is confirmed by the
// EU B2B e-invoicing/e-reporting phase-in text; the other format/profile versions could
// not be re-confirmed against a live source at build time and are DRAFT-PIN labeled.
const FORMAT_RULES = {
  'factur-x': {
    rule_set_version: 'Factur-X 1.0.07 / ZUGFeRD 2.3.2 (DRAFT-PIN, unconfirmed as of 2026-07-13)',
    required: ['invoice_number', 'invoice_date', 'currency_code', 'seller_name', 'seller_vat_id', 'buyer_name'],
  },
  'xrechnung': {
    rule_set_version: 'XRechnung CIUS 3.0.2 (DRAFT-PIN, unconfirmed as of 2026-07-13)',
    required: ['invoice_number', 'invoice_date', 'currency_code', 'seller_name', 'seller_vat_id', 'buyer_name', 'leitweg_id'],
  },
  'pint-ae': {
    rule_set_version: 'PINT-AE 1.0 pilot profile (DRAFT-PIN, unconfirmed as of 2026-07-13)',
    required: ['invoice_number', 'invoice_date', 'currency_code', 'seller_name', 'seller_vat_id', 'buyer_name'],
  },
  'myinvois': {
    rule_set_version: 'MyInvois e-Invoice Guideline v4.3 (DRAFT-PIN, unconfirmed as of 2026-07-13)',
    required: ['invoice_number', 'invoice_date', 'currency_code', 'seller_name', 'seller_vat_id', 'buyer_name'],
  },
};

const CURRENCY_CODES = new Set(['EUR', 'USD', 'GBP', 'AED', 'MYR']);
const VAT_CATEGORIES = new Set(['S', 'Z', 'E', 'AE', 'O']);

function fieldPresent(v) {
  return v !== undefined && v !== null && String(v).trim().length > 0;
}

// Shared structural-extract check (§E2.parse doctrine: the caller supplies an
// already-extracted structured invoice model, not raw XML/PDF bytes, since the
// zkVM guest has no DOMParser and compute() may not use crypto.subtle). A
// malformed/absent document object yields a structured parse-error verdict,
// never a throw.
function parseInvoiceExtract(document) {
  if (!document || typeof document !== 'object') {
    return { ok: false, error: 'missing_or_malformed_document', fields: {}, line_items: [] };
  }
  const format = typeof document.format === 'string' ? document.format : '';
  if (!FORMAT_RULES[format]) {
    return { ok: false, error: 'unsupported_or_missing_format', fields: {}, line_items: [] };
  }
  const fields = (document.fields && typeof document.fields === 'object') ? document.fields : {};
  const line_items = Array.isArray(document.line_items) ? document.line_items : [];
  return { ok: true, format, fields, line_items, document };
}

export function compute(pp) {
  const parsed = parseInvoiceExtract(pp.document);

  if (!parsed.ok) {
    return {
      output_payload: {
        format: parsed.format || null,
        rule_set_version: null,
        findings: [],
        missing_fields: [],
        line_item_count: 0,
        structural_completeness: false,
        parse_error: parsed.error,
      },
      compliance_flags: ['EINVOICE_FORMAT_PARSE_ERROR'],
    };
  }

  const rules = FORMAT_RULES[parsed.format];
  const findings = [];
  const missing_fields = [];

  for (const f of rules.required) {
    const pass = fieldPresent(parsed.fields[f]);
    findings.push({ rule: 'mandatory_field:' + f, pass });
    if (!pass) missing_fields.push(f);
  }

  const currency = parsed.fields.currency_code;
  const currencyOk = typeof currency === 'string' && CURRENCY_CODES.has(currency.trim().toUpperCase());
  findings.push({ rule: 'codelist:currency_code', pass: currencyOk });
  if (!currencyOk) missing_fields.push('currency_code(codelist)');

  const hasLines = parsed.line_items.length > 0;
  findings.push({ rule: 'cardinality:line_items_non_empty', pass: hasLines });
  if (!hasLines) missing_fields.push('line_items');

  let allCategoriesOk = true;
  parsed.line_items.forEach((li, idx) => {
    const cat = li && li.vat_category;
    const ok = typeof cat === 'string' && VAT_CATEGORIES.has(cat.trim().toUpperCase());
    if (!ok) allCategoriesOk = false;
    findings.push({ rule: 'codelist:line[' + idx + '].vat_category', pass: ok });
  });

  const structural_completeness = findings.every((f) => f.pass);

  const compliance_flags = ['EINVOICE_FORMAT_ASSESSED'];
  compliance_flags.push(structural_completeness ? 'EINVOICE_FORMAT_STRUCTURAL_PASS' : 'EINVOICE_FORMAT_STRUCTURAL_FAIL');

  return {
    output_payload: {
      format: parsed.format,
      rule_set_version: rules.rule_set_version,
      findings,
      missing_fields,
      line_item_count: parsed.line_items.length,
      structural_completeness,
      parse_error: null,
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
