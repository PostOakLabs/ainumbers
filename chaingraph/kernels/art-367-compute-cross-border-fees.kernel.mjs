import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-367-compute-cross-border-fees';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_cross_border_fees',
  mandate_type: 'analytics_mandate', gpu: false,
};

// Cross-border B2B payment cost breakdown (ports tools/141-cross-border-b2b-fee-calculator.html
// calcFees() into a kernel, per TOOLIFY-1-BUILD-SPEC.md TF-2). Pairs with the
// already-shipped compare_corridor_cost node (art-249) -- that node benchmarks a
// remittance corridor against World Bank RPW/SDG targets; this node itemizes a
// single B2B invoice's cross-border cost stack (FX spread, method fee, VAT/reverse
// charge, documentary-credit cost, reconciliation cost). Caller-supplied
// vat_rate/doc_cost/method_fee -- this kernel does not vendor VAT-treaty or
// documentary-credit-fee tables, only the published cost-stack formula:
//   fx_cost = invoice_amount x (fx_spread_bps / 10000)
//   vat_cost = invoice_amount x vat_rate
//   total_cost = fx_cost + method_fee + vat_cost + doc_cost + recon_cost
//   pct_of_invoice = total_cost / invoice_amount x 100
// Pure ECMA-262 arithmetic only -- no Math.pow, no Date.now/new Date(), no Math.random.

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }
function r4(v) { return Number.isFinite(v) ? Math.round(v * 10000) / 10000 : 0; }

export function compute(pp) {
  pp = pp || {};
  const invoiceAmount = safeNum(pp.invoice_amount, 0);
  const originCountry = String(pp.origin_country || '').trim().toUpperCase();
  const destCountry = String(pp.dest_country || '').trim().toUpperCase();
  const fxSpreadBps = safeNum(pp.fx_spread_bps, 0);
  const methodFee = safeNum(pp.method_fee, 0);
  const vatRate = safeNum(pp.vat_rate, 0);
  const docCost = safeNum(pp.doc_cost, 0);
  const reconCost = safeNum(pp.recon_cost, 0);

  const compliance_flags = [];
  if (invoiceAmount <= 0) compliance_flags.push('XBFEE_NON_POSITIVE_INVOICE');

  const fxCost = invoiceAmount * (fxSpreadBps / 10000);
  const vatCost = invoiceAmount * vatRate;
  const totalCost = fxCost + methodFee + vatCost + docCost + reconCost;
  const pctOfInvoice = invoiceAmount > 0 ? (totalCost / invoiceAmount) * 100 : 0;

  const output_payload = {
    origin_country: originCountry,
    dest_country: destCountry,
    invoice_amount: r2(invoiceAmount),
    fx_spread_bps: fxSpreadBps,
    fx_cost: r2(fxCost),
    method_fee: r2(methodFee),
    vat_rate: vatRate,
    vat_cost: r2(vatCost),
    doc_cost: r2(docCost),
    recon_cost: r2(reconCost),
    total_cost: r2(totalCost),
    pct_of_invoice: r4(pctOfInvoice),
    regulatory_basis: 'VAT/reverse-charge treatment, documentary-credit fees, and correspondent/method fees are caller-supplied per their own treaty position and banking agreement -- this kernel never vendors a VAT-treaty or correspondent-fee table, only the published cost-stack formula.',
    disambiguation: 'Itemizes one cross-border B2B invoice cost stack. For remittance-corridor benchmarking against World Bank RPW / SDG 10.c targets, see compare_corridor_cost.',
  };

  return { output_payload, compliance_flags };
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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
