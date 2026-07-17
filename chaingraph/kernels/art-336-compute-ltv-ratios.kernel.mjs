import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-336-compute-ltv-ratios';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_ltv_ratios',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Loan-to-value ratio family per Fannie Mae Selling Guide B2-1.1-03
// (Loan-to-Value, Combined LTV, HCLTV Ratios) and Freddie Mac Single-Family
// Seller/Servicer Guide 5401.1 (LTV/TLTV/HTLTV ratios). LTV, CLTV (combined,
// closed-end subordinate financing), and HCLTV (home-equity combined,
// including undrawn HELOC lines) against the lesser-of-value-or-price rule
// for purchases and appraised value for refinances. Feeds
// art-222-agency-eligibility-matrix (ltv/cltv/hcltv inputs).
//
// Pure ECMA-262 arithmetic only -- no Math.pow, no Date.now/new Date(),
// no Math.random. Percent values rounded to 2 decimal places (r2).

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

export function compute(pp) {
  pp = pp || {};

  const appraisedValue = safeNum(pp.appraised_value, 0);
  const salesPrice = safeNum(pp.sales_price, 0);
  const firstLienAmount = safeNum(pp.first_lien_amount, 0);
  const subordinateLienAmount = safeNum(pp.subordinate_lien_amount, 0);
  const helocCreditLimit = safeNum(pp.heloc_credit_limit, 0);
  const transactionType = pp.transaction_type === 'refinance' ? 'refinance' : 'purchase';

  // Lesser-of-value-or-price rule (B2-1.1-03): purchases use the lesser of
  // appraised value and sales price; refinances use appraised value only.
  let valueUsed;
  if (transactionType === 'purchase') {
    valueUsed = salesPrice > 0 ? Math.min(appraisedValue, salesPrice) : appraisedValue;
  } else {
    valueUsed = appraisedValue;
  }

  const compliance_flags = [];
  const zeroValue = valueUsed <= 0;
  if (zeroValue) compliance_flags.push('LTV_ZERO_VALUE');

  let ltvPct = 0, cltvPct = 0, hcltvPct = 0;
  if (!zeroValue) {
    ltvPct = r2((firstLienAmount / valueUsed) * 100);
    cltvPct = r2(((firstLienAmount + subordinateLienAmount) / valueUsed) * 100);
    hcltvPct = r2(((firstLienAmount + subordinateLienAmount + helocCreditLimit) / valueUsed) * 100);
  }

  const output_payload = {
    ltv_pct: ltvPct,
    cltv_pct: cltvPct,
    hcltv_pct: hcltvPct,
    value_used: r2(valueUsed),
    appraised_value: r2(appraisedValue),
    sales_price: r2(salesPrice),
    first_lien_amount: r2(firstLienAmount),
    subordinate_lien_amount: r2(subordinateLienAmount),
    heloc_credit_limit: r2(helocCreditLimit),
    transaction_type: transactionType,
    regulatory_basis: 'Fannie Mae Selling Guide B2-1.1-03 (LTV, CLTV, HCLTV Ratios); Freddie Mac Single-Family Seller/Servicer Guide 5401.1 (LTV/TLTV/HTLTV ratios)',
    note: 'CLTV includes closed-end subordinate financing at the drawn balance. HCLTV includes the full HELOC credit limit whether or not fully drawn, per B2-1.1-03. Value used is the lesser of appraised value and sales price for purchases; appraised value only for refinances. Not check_agency_eligibility_matrix (art-222), which consumes these ratios as inputs to its own LTV/CLTV/HCLTV eligibility checks.',
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
