import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-294-einvoice-vat-calc-verifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'verify_einvoice_vat_calc',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Zero-rate / reverse-charge categories carry no computed VAT regardless of any
// stated rate (EN 16931 UNTDID 5305 subset: S=standard, Z=zero-rated,
// E=exempt, AE=reverse charge, O=out of scope).
const NO_VAT_CATEGORIES = new Set(['Z', 'E', 'AE', 'O']);

function round2(n, method) {
  const scaled = n * 100;
  if (method === 'half-even') {
    const floor = Math.floor(scaled);
    const diff = scaled - floor;
    let r;
    if (Math.abs(diff - 0.5) < 1e-9) r = (floor % 2 === 0) ? floor : floor + 1;
    else r = Math.round(scaled);
    return r / 100;
  }
  // half-up (default)
  return Math.round(scaled) / 100;
}

function computeLineVat(li, method) {
  const net = Number.isFinite(Number(li.net_amount)) ? Number(li.net_amount) : 0;
  const cat = typeof li.vat_category === 'string' ? li.vat_category.trim().toUpperCase() : '';
  const rate = Number.isFinite(Number(li.vat_rate_pct)) ? Number(li.vat_rate_pct) : 0;
  const effective_rate = NO_VAT_CATEGORIES.has(cat) ? 0 : rate;
  return { net, cat, rate: effective_rate, vat: round2(net * effective_rate / 100, method) };
}

export function compute(pp) {
  const document = (pp && typeof pp.document === 'object' && pp.document) || {};
  const line_items = Array.isArray(document.line_items) ? document.line_items : [];
  const asserted_subtotals = Array.isArray(document.tax_subtotals_asserted) ? document.tax_subtotals_asserted : [];
  const grand_total_asserted = Number.isFinite(Number(document.grand_total_asserted)) ? Number(document.grand_total_asserted) : null;
  const tax_total_asserted = Number.isFinite(Number(document.tax_total_asserted)) ? Number(document.tax_total_asserted) : null;

  const rounding = (pp && typeof pp.rounding === 'object' && pp.rounding) || {};
  const method = rounding.method === 'half-even' ? 'half-even' : 'half-up';
  const granularity = rounding.granularity === 'per-subtotal' ? 'per-subtotal' : 'per-line';

  if (line_items.length === 0) {
    return {
      output_payload: {
        rounding: { method, granularity }, subtotal_deltas: [], tax_total_delta: null,
        grand_total_delta: null, tax_total_computed: null, grand_total_computed: null,
        consistent: false, parse_error: 'no_line_items',
      },
      compliance_flags: ['EINVOICE_VAT_NO_LINE_ITEMS'],
    };
  }

  const computed = line_items.map((li) => computeLineVat(li || {}, method));

  // group by category+rate
  const groups = new Map();
  for (const c of computed) {
    const key = c.cat + '|' + c.rate;
    if (!groups.has(key)) groups.set(key, { vat_category: c.cat, vat_rate_pct: c.rate, taxable_amount: 0, tax_amount_lines_sum: 0 });
    const g = groups.get(key);
    g.taxable_amount += c.net;
    g.tax_amount_lines_sum += c.vat;
  }

  const subtotal_deltas = [];
  let tax_total_computed = 0;
  for (const g of groups.values()) {
    const taxable_amount = round2(g.taxable_amount, method);
    const tax_amount_computed = granularity === 'per-subtotal'
      ? round2(taxable_amount * g.vat_rate_pct / 100, method)
      : round2(g.tax_amount_lines_sum, method);
    tax_total_computed += tax_amount_computed;

    const asserted = asserted_subtotals.find((s) => s && String(s.vat_category).trim().toUpperCase() === g.vat_category
      && Number(s.vat_rate_pct) === g.vat_rate_pct);
    const taxable_amount_delta = asserted ? round2(taxable_amount - Number(asserted.taxable_amount || 0), method) : null;
    const tax_amount_delta = asserted ? round2(tax_amount_computed - Number(asserted.tax_amount || 0), method) : null;

    subtotal_deltas.push({
      vat_category: g.vat_category, vat_rate_pct: g.vat_rate_pct,
      taxable_amount_computed: taxable_amount, tax_amount_computed,
      taxable_amount_delta, tax_amount_delta,
      matched_asserted_subtotal: !!asserted,
    });
  }
  tax_total_computed = round2(tax_total_computed, method);

  const net_total = round2(computed.reduce((s, c) => s + c.net, 0), method);
  const grand_total_computed = round2(net_total + tax_total_computed, method);

  const tax_total_delta = tax_total_asserted !== null ? round2(tax_total_computed - tax_total_asserted, method) : null;
  const grand_total_delta = grand_total_asserted !== null ? round2(grand_total_computed - grand_total_asserted, method) : null;

  const consistent = subtotal_deltas.every((s) => s.matched_asserted_subtotal && s.taxable_amount_delta === 0 && s.tax_amount_delta === 0)
    && tax_total_delta === 0 && grand_total_delta === 0;

  const compliance_flags = ['EINVOICE_VAT_ASSESSED', consistent ? 'EINVOICE_VAT_CONSISTENT' : 'EINVOICE_VAT_INCONSISTENT'];

  return {
    output_payload: {
      rounding: { method, granularity }, subtotal_deltas, tax_total_delta, grand_total_delta,
      tax_total_computed, grand_total_computed, consistent, parse_error: null,
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
