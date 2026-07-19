import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-404-check-retail-installment-disclosures';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_retail_installment_disclosures',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Retail-installment-contract TILA disclosure tie-out (12 CFR 1026.18): Amount
// Financed / Finance Charge / Total of Payments must tie to the amortization
// schedule the contract is actually built on. THIS KERNEL DOES NOT AMORTIZE --
// it CONSUMES the totals already produced by build_amortization_schedule
// (art-332, "CC-A") and, where the schedule was TVM-derived, art-324..331
// ("CC-G"). The caller composes by chain (feed art-332's output_payload
// straight into this kernel's amortization_schedule input) or by reference
// (paste the totals + schedule_digest) -- reimplementing the amortization math
// here would trigger the SPEC.md kernel-identity regen requirement, which this
// kernel deliberately avoids by never touching art-332/art-324..331's files.
// Also records a dealer-participation/markup declaration -- ASSERTED and
// receipt-bound only; this is a fair-lending ADJACENCY note, not a
// discrimination determination (no disparate-impact/disparate-treatment
// analysis is computed here).

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function toCents(dollars) { return Math.round(safeNum(dollars, 0) * 100); }
function fromCents(cents) { return Number.isFinite(cents) ? Math.round(cents) / 100 : 0; }

// Reg Z 1026.18(d)(1)(i): the regular-transaction finance-charge disclosure
// tolerance is understated/overstated by no more than $5 (or $10 for
// transactions >$1000 or with an irregular payment schedule/multiple
// advances). Declared, not hardcoded as a silent default: the caller may
// override tolerance_cents; 500 is the regulatory default cited above.
const DEFAULT_TOLERANCE_CENTS = 500;

export function compute(pp) {
  pp = pp || {};
  const { inputs = {} } = pp;
  const {
    cash_price = 0,
    downpayment = 0,
    other_amounts_financed = 0,
    prepaid_finance_charge = 0,
    amortization_schedule = {},
    disclosed_amount_financed = null,
    disclosed_finance_charge = null,
    disclosed_total_of_payments = null,
    tolerance_cents = DEFAULT_TOLERANCE_CENTS,
    dealer_participation = {},
  } = inputs;

  const totals = (amortization_schedule && amortization_schedule.totals) || {};
  const schedule_digest = amortization_schedule && amortization_schedule.schedule_digest;
  const schedule_source_tool_id = (amortization_schedule && amortization_schedule.source_tool_id) || 'art-332-build-amortization-schedule';

  const provenance_ok = typeof schedule_digest === 'string' && schedule_digest.startsWith('sha256:');

  const amountFinancedCents = toCents(cash_price) - toCents(downpayment) + toCents(other_amounts_financed) - toCents(prepaid_finance_charge);
  const totalPrincipalCents = toCents(totals.total_principal);
  const totalInterestCents = toCents(totals.total_interest);
  const totalOfPaymentsCents = totalPrincipalCents + totalInterestCents;
  const financeChargeCents = totalOfPaymentsCents - amountFinancedCents;

  const tol = Math.max(0, Math.round(safeNum(tolerance_cents, DEFAULT_TOLERANCE_CENTS)));

  function tieOut(label, disclosed, computedCents) {
    if (disclosed === null || disclosed === undefined) {
      return { label, disclosed: null, computed: fromCents(computedCents), within_tolerance: null };
    }
    const disclosedCents = toCents(disclosed);
    const diff = Math.abs(disclosedCents - computedCents);
    return { label, disclosed: safeNum(disclosed, 0), computed: fromCents(computedCents), diff_cents: diff, within_tolerance: diff <= tol };
  }

  const tie_outs = [
    tieOut('amount_financed', disclosed_amount_financed, amountFinancedCents),
    tieOut('finance_charge', disclosed_finance_charge, financeChargeCents),
    tieOut('total_of_payments', disclosed_total_of_payments, totalOfPaymentsCents),
  ];

  const compliance_flags = [];
  if (!provenance_ok) compliance_flags.push('AMORTIZATION_SCHEDULE_PROVENANCE_MISSING');
  const failures = tie_outs.filter((t) => t.within_tolerance === false);
  if (failures.length > 0) compliance_flags.push('TILA_DISCLOSURE_TIE_OUT_FAIL');

  const markup_pct = safeNum(dealer_participation.markup_pct, null);
  const dealer_reserve_disclosed = !!dealer_participation.dealer_reserve_disclosed;
  const dealer_record = {
    markup_pct,
    dealer_reserve_disclosed,
    declaration_note: typeof dealer_participation.declaration_note === 'string' ? dealer_participation.declaration_note : null,
    disambiguation: 'This dealer-participation record is ASSERTED and receipt-bound only -- a fair-lending ADJACENCY note (dealer markup/reserve practices are a known ECOA/Reg B disparate-impact risk area), NOT a discrimination determination. No disparate-impact or disparate-treatment analysis is computed here.',
  };
  if (markup_pct !== null && markup_pct > 0 && !dealer_reserve_disclosed) compliance_flags.push('DEALER_MARKUP_NOT_DISCLOSED');

  const output_payload = {
    compliant: failures.length === 0 && provenance_ok,
    amount_financed: fromCents(amountFinancedCents),
    total_of_payments: fromCents(totalOfPaymentsCents),
    finance_charge: fromCents(financeChargeCents),
    tie_outs,
    tolerance_cents: tol,
    amortization_provenance: {
      source_tool_id: schedule_source_tool_id,
      schedule_digest: schedule_digest || null,
      provenance_ok,
      total_interest: fromCents(totalInterestCents),
      total_principal: fromCents(totalPrincipalCents),
      num_payments: totals.num_payments ?? null,
    },
    dealer_participation: dealer_record,
    disambiguation: 'check_retail_installment_disclosures ties the declared cash-price/downpayment/prepaid-finance-charge inputs against a REUSED amortization schedule (art-332, and where TVM-derived, art-324..331) -- it does not compute or verify the amortization itself, and a wrong schedule_digest/totals yields a faithfully wrong tie-out.',
    regulatory_basis: '12 CFR 1026.18(b)/(d)/(h) (Reg Z retail-installment TILA disclosures: amount financed, finance charge, total of payments) and 1026.18(d)(1)(i) (finance-charge tolerance).',
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
