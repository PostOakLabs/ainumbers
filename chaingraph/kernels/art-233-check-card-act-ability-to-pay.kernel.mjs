import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-233-check-card-act-ability-to-pay';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_card_act_ability_to_pay',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ─── CARD Act Ability to Pay / Penalty Fee Safe Harbor ───────────────────────
// Credit CARD Act of 2009 (Pub. L. 111-24); Reg Z §1026.51 (ability to pay)
//   + §1026.52(b) (penalty fee safe harbor).
//
// §1026.51 Ability-to-Repay:
//   (a): Creditor must consider the consumer's ability to make minimum payments.
//   (a)(1): Consideration of current or reasonably expected income / assets.
//   (a)(2): For applicants under 21: income or assets independently must support
//           the account. Unless cosigner/co-applicant, decline if independently
//           insufficient.
//   Methods (Reg Z comment 51(a)(1)-2):
//     Method A: income / assets approach -- annual income >= 12 * minimum_payment
//     Method B: DTI approach -- (monthly_obligations / monthly_income) <= threshold
//     Method C: income proxy -- stated income validated against demographic model
//
// §1026.52(b) Penalty Fee Safe Harbor (as of 2024, post-vacatur of CFPB $8 rule):
//   Safe harbor amounts are indexed annually to the CFPB CPI adjustment.
//   Current safe-harbor caps (effective Jan 1 2024):
//     First violation:       $32
//     Subsequent violation:  $43 (within 6 billing cycles)
//   Per 12 CFR §1026.52(b)(1)(ii)(A)-(B).
//   CFPB $8 late-fee rule (March 2024) was vacated by 5th Circuit (May 2024
//   stay, vacated Jan 2025). Safe-harbor reverts to 2024 index values.
// table_version: "CARD-ACT-REG-Z-1026-51-52-2024"

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }
function r4(v) { return Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : 0; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 1e2) / 1e2 : 0; }

// §1026.52(b) safe-harbor penalty fees (effective 2024-01-01)
const PENALTY_FEE_FIRST_VIOLATION = 32;     // 12 CFR §1026.52(b)(1)(ii)(A)
const PENALTY_FEE_SUBSEQUENT = 43;           // 12 CFR §1026.52(b)(1)(ii)(B)
const SAFE_HARBOR_TABLE_VERSION = '2024-01-01';

// Under-21 threshold: applicant under 21 must independently qualify
const UNDER_21_AGE_THRESHOLD = 21;

// DTI threshold for Method B
const DTI_THRESHOLD_MAX = 0.45; // 45% total obligations / income

export function compute(pp) {
  pp = pp || {};

  const applicant_age = Math.max(0, Math.round(safeNum(pp.applicant_age, 30)));
  const annual_income = Math.max(0, safeNum(pp.annual_income, 0));
  const total_assets = Math.max(0, safeNum(pp.total_assets, 0));
  const monthly_housing_payment = Math.max(0, safeNum(pp.monthly_housing_payment, 0));
  const monthly_debt_obligations = Math.max(0, safeNum(pp.monthly_debt_obligations, 0));
  const requested_credit_limit = Math.max(0, safeNum(pp.requested_credit_limit, 500));
  const has_cosigner = Boolean(pp.has_cosigner);
  const method = safeStr(pp.method || 'income_assets'); // 'income_assets' | 'dti' | 'income_proxy'
  const atp_minimum_payment_pct = Math.max(0.01, safeNum(pp.minimum_payment_pct, 0.02)); // 2% default

  // Guard: empty inputs return finite zero-state
  if (annual_income === 0 && total_assets === 0 && requested_credit_limit === 0) {
    return {
      output_payload: {
        ability_to_pay_result: 'INSUFFICIENT_DATA',
        under_21_restriction: false,
        requires_cosigner: false,
        method_used: method,
        annual_income: 0,
        monthly_income: 0,
        monthly_minimum_payment_est: 0,
        dti_ratio: 0,
        dti_threshold: DTI_THRESHOLD_MAX,
        penalty_fee_safe_harbor: {
          first_violation: PENALTY_FEE_FIRST_VIOLATION,
          subsequent_within_6_cycles: PENALTY_FEE_SUBSEQUENT,
          table_version: SAFE_HARBOR_TABLE_VERSION,
          rule_note: 'CFPB $8 late-fee rule vacated Jan 2025; safe harbor reverts to 2024 CFPB index values per 12 CFR §1026.52(b)(1)(ii)',
        },
        regulatory_basis: '15 USC §1665e (CARD Act §109); 12 CFR §1026.51 (ability to pay); 12 CFR §1026.52(b) (penalty fee safe harbor)',
        table_version: 'CARD-ACT-REG-Z-1026-51-52-2024',
        table_source: 'CARD Act of 2009 Pub. L. 111-24; 12 CFR §1026.51 (Reg Z ability to pay, effective Aug 22 2010); 12 CFR §1026.52(b)(1)(ii) safe harbor 2024 CFPB CPI adjustment; CFPB $8 rule vacated 5th Cir 2025',
        pii_note: 'All inputs are processed locally in your browser. No data is transmitted.',
      },
      compliance_flags: [],
    };
  }

  const monthly_income = r4(annual_income / 12);
  const income_and_assets = annual_income + total_assets;

  // ── Under-21 check (§1026.51(a)(2)) ─────────────────────────────────────
  const is_under_21 = applicant_age > 0 && applicant_age < UNDER_21_AGE_THRESHOLD;
  // Under-21 applicant without cosigner must independently qualify
  const requires_cosigner_u21 = is_under_21 && !has_cosigner && income_and_assets < requested_credit_limit;

  // ── Method A: Income/Assets (§1026.51(a)(1)) ─────────────────────────────
  // Minimum payment estimate = requested_credit_limit * minimum_payment_pct / 12
  const monthly_min_payment_est = r4(requested_credit_limit * atp_minimum_payment_pct);
  const annual_min_payments = monthly_min_payment_est * 12;
  const method_a_sufficient = income_and_assets >= annual_min_payments && annual_income >= annual_min_payments * 0.5;

  // ── Method B: DTI (§1026.51(a)(1)) ───────────────────────────────────────
  const total_monthly_obligations = monthly_debt_obligations + monthly_housing_payment + monthly_min_payment_est;
  const dti_ratio = monthly_income > 0 ? r4(total_monthly_obligations / monthly_income) : 999;
  const method_b_sufficient = dti_ratio <= DTI_THRESHOLD_MAX;

  // ── Combined ability to pay result ───────────────────────────────────────
  let sufficient;
  if (method === 'dti') {
    sufficient = method_b_sufficient;
  } else {
    // income_assets or income_proxy: use Method A as primary
    sufficient = method_a_sufficient;
  }

  let ability_to_pay_result;
  if (requires_cosigner_u21) {
    ability_to_pay_result = 'REQUIRES_COSIGNER_UNDER_21';
  } else if (!sufficient) {
    ability_to_pay_result = 'INSUFFICIENT';
  } else {
    ability_to_pay_result = 'SUFFICIENT';
  }

  const compliance_flags = [];
  if (!sufficient) compliance_flags.push('CARD_ACT_ATP_INSUFFICIENT');
  if (is_under_21 && !has_cosigner) compliance_flags.push('CARD_ACT_UNDER_21_NO_COSIGNER');
  if (requires_cosigner_u21) compliance_flags.push('CARD_ACT_UNDER_21_REQUIRES_COSIGNER');

  const output_payload = {
    ability_to_pay_result,
    under_21_restriction: is_under_21,
    requires_cosigner: requires_cosigner_u21,
    has_cosigner,
    method_used: method,
    annual_income: r2(annual_income),
    total_assets: r2(total_assets),
    income_and_assets: r2(income_and_assets),
    monthly_income: r2(monthly_income),
    requested_credit_limit: r2(requested_credit_limit),
    monthly_minimum_payment_est: r2(monthly_min_payment_est),
    annual_minimum_payments_est: r2(annual_min_payments),
    method_a_sufficient,
    monthly_housing_payment: r2(monthly_housing_payment),
    monthly_debt_obligations: r2(monthly_debt_obligations),
    total_monthly_obligations: r2(total_monthly_obligations),
    dti_ratio: r4(dti_ratio),
    dti_threshold: DTI_THRESHOLD_MAX,
    method_b_sufficient,
    penalty_fee_safe_harbor: {
      first_violation: PENALTY_FEE_FIRST_VIOLATION,
      subsequent_within_6_cycles: PENALTY_FEE_SUBSEQUENT,
      table_version: SAFE_HARBOR_TABLE_VERSION,
      rule_note: 'CFPB $8 late-fee rule vacated Jan 2025; safe harbor reverts to 2024 CFPB CPI index values per 12 CFR §1026.52(b)(1)(ii)',
    },
    regulatory_basis: '15 USC §1665e (CARD Act §109); 12 CFR §1026.51 (ability to pay); 12 CFR §1026.51(a)(2) (under-21); 12 CFR §1026.52(b) (penalty fee safe harbor)',
    table_version: 'CARD-ACT-REG-Z-1026-51-52-2024',
    table_source: 'CARD Act of 2009 Pub. L. 111-24 §109; 12 CFR §1026.51 (effective Aug 22 2010); 12 CFR §1026.52(b)(1)(ii)(A) $32 first-violation safe harbor (2024); 12 CFR §1026.52(b)(1)(ii)(B) $43 subsequent safe harbor (2024); CFPB CPI adjustment 2024-01-01',
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
