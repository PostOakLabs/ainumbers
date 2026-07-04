import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-231-compute-mla-mapr';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_mla_mapr',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ─── Military Lending Act (MLA) MAPR Calculator ───────────────────────────────
// Computes the Military Annual Percentage Rate (MAPR) per 32 CFR §232.4(c) and
//   tests compliance with the 36% statutory cap for covered borrowers.
//
// MLA (10 USC §987) applies to consumer credit extended to covered borrowers
//   (active-duty servicemembers + their dependents) for personal, family, or
//   household purposes. DoD rule: 32 CFR Part 232 (effective Oct 3, 2016).
//
// MAPR construction (32 CFR §232.4(c)(1)):
//   Includes: interest, finance charges, credit insurance premiums, credit card
//   fees (other than bona-fide participation fees up to $100/year), and any other
//   charges incident to the extension of credit.
//
// Bona-fide participation fee exclusion (32 CFR §232.4(c)(1)(iii)(A)):
//   A participation fee up to $100/year for a credit card account MAY be excluded
//   if the card provides a specific benefit in addition to the simple extension
//   of credit. EXCLUDED from MAPR calculation.
//
// Application fee exclusion (32 CFR §232.4(c)(1)(iii)(B)):
//   A bona-fide application fee that is charged to all applicants in a consistent,
//   non-discriminatory manner MAY be excluded if the amount is reasonable.
//   EXCLUDED from MAPR calculation in this implementation.
//
// 36% MAPR cap: 32 CFR §232.4(c); 10 USC §987(b).
//   Violation: creditor may not extend credit to a covered borrower at MAPR > 36%.
// table_version: "MLA-DOD-32CFR232-2016-10-03"

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r6(v) { return Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : 0; }
function r4(v) { return Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : 0; }

// Integer power via loop (no Math.pow) for annualization
function intPow(base, exp) {
  if (exp === 0) return 1;
  let result = 1;
  let b = base;
  let e = exp;
  while (e > 0) {
    if (e & 1) result *= b;
    b *= b;
    e >>= 1;
  }
  return result;
}

const MLA_CAP_PCT = 36.0;
const BONA_FIDE_FEE_MAX_ANNUAL = 100.0; // 32 CFR §232.4(c)(1)(iii)(A)

export function compute(pp) {
  pp = pp || {};

  const loan_amount = Math.max(0, safeNum(pp.loan_amount, 0));
  const term_months = Math.max(1, Math.round(safeNum(pp.term_months, 12)));
  const stated_apr_pct = safeNum(pp.stated_apr_pct, 0);

  // Includable fees
  const finance_charge_total = Math.max(0, safeNum(pp.finance_charge_total, 0));
  const credit_insurance_premium_total = Math.max(0, safeNum(pp.credit_insurance_premium_total, 0));
  const credit_card_annual_fee = Math.max(0, safeNum(pp.credit_card_annual_fee, 0));

  // Excludable fees (reduce from MAPR calculation)
  const participation_fee_annual = Math.max(0, safeNum(pp.participation_fee_annual, 0));
  const application_fee = Math.max(0, safeNum(pp.application_fee, 0));
  const is_credit_card = Boolean(pp.is_credit_card);

  // Guard: empty inputs return finite zero-state
  if (loan_amount === 0 && stated_apr_pct === 0) {
    return {
      output_payload: {
        mapr_pct: 0,
        mapr_cap_pct: MLA_CAP_PCT,
        exceeds_cap: false,
        total_includable_charges: 0,
        total_excluded_charges: 0,
        loan_amount: 0,
        term_months: 0,
        stated_apr_pct: 0,
        regulatory_basis: '10 USC §987(b); 32 CFR §232.4(c); DoD MLA rule effective Oct 3, 2016',
        table_version: 'MLA-DOD-32CFR232-2016-10-03',
        table_source: '10 USC §987(b); 32 CFR Part 232 (Federal Register 80 FR 43560, Jul 22, 2015, effective Oct 3, 2016); 32 CFR §232.4(c)(1)(iii)(A) $100 bona-fide fee exclusion',
        pii_note: 'All inputs are processed locally in your browser. No data is transmitted.',
      },
      compliance_flags: [],
    };
  }

  // Compute finance charges from APR if not provided explicitly
  // Simplified: annual interest = loan_amount * stated_apr_pct/100
  // For MAPR, use total finance charge approach (not iterative APR solve)
  const implicit_finance_charge = loan_amount > 0 && stated_apr_pct > 0
    ? r6(loan_amount * (stated_apr_pct / 100) * (term_months / 12))
    : 0;

  const effective_finance_charge = finance_charge_total > 0 ? finance_charge_total : implicit_finance_charge;

  // Bona-fide participation fee exclusion (32 CFR §232.4(c)(1)(iii)(A))
  const excluded_participation = is_credit_card
    ? Math.min(participation_fee_annual, BONA_FIDE_FEE_MAX_ANNUAL)
    : 0;
  const excluded_application = application_fee; // reasonable bona-fide application fee

  const total_includable = effective_finance_charge + credit_insurance_premium_total + credit_card_annual_fee;
  const total_excluded = excluded_participation + excluded_application;

  // MAPR = (total includable charges / loan amount) * (12 / term_months) * 100
  // Simplified annual rate formula (DoD uses actuarial method for installment loans;
  // this is the nominal rate approach per 32 CFR §232.4(c)(2) for open-end credit)
  let mapr_pct = 0;
  if (loan_amount > 0 && term_months > 0) {
    mapr_pct = r4((total_includable / loan_amount) * (12 / term_months) * 100);
    // Floor at stated APR (MAPR >= APR by definition -- APR is a subset of MAPR components)
    if (mapr_pct < stated_apr_pct) mapr_pct = r4(stated_apr_pct);
  }

  const exceeds_cap = mapr_pct > MLA_CAP_PCT;

  const compliance_flags = [];
  if (exceeds_cap) compliance_flags.push('MLA_MAPR_EXCEEDS_36PCT_CAP');
  if (mapr_pct > 30 && !exceeds_cap) compliance_flags.push('MLA_MAPR_APPROACHING_CAP');

  const output_payload = {
    mapr_pct,
    mapr_cap_pct: MLA_CAP_PCT,
    exceeds_cap,
    bona_fide_fee_annual_limit: BONA_FIDE_FEE_MAX_ANNUAL,
    total_includable_charges: r4(total_includable),
    total_excluded_charges: r4(total_excluded),
    effective_finance_charge: r4(effective_finance_charge),
    credit_insurance_premium_total: r4(credit_insurance_premium_total),
    credit_card_annual_fee_included: r4(credit_card_annual_fee),
    participation_fee_excluded: r4(excluded_participation),
    application_fee_excluded: r4(excluded_application),
    loan_amount: r4(loan_amount),
    term_months,
    stated_apr_pct,
    is_credit_card,
    regulatory_basis: '10 USC §987(b); 32 CFR §232.4(c); DoD MLA rule effective Oct 3, 2016',
    table_version: 'MLA-DOD-32CFR232-2016-10-03',
    table_source: '10 USC §987(b); 32 CFR Part 232 (Federal Register 80 FR 43560 Jul 22 2015, effective Oct 3 2016); 32 CFR §232.4(c)(1)(iii)(A) bona-fide participation fee $100/yr annual exclusion; 32 CFR §232.4(c)(1)(iii)(B) bona-fide application fee exclusion',
    pii_note: 'All inputs are processed locally in your browser. No data is transmitted.',
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
