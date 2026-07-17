import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-338-compute-federal-withholding';
const TOOL_VERSION = '1.0.0';
const CONSTANTS_VERSION = '2025';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_federal_withholding',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Federal income tax withholding, percentage method, per IRS Publication 15-T
// (2025) Section 4 "Percentage Method Tables for Automated Payroll Systems"
// and Worksheet 1A "Employer's Withholding Worksheet for Percentage Method
// Tables for Automated Payroll Systems," applied to a 2020-or-later Form W-4.
//
// FEDERAL ONLY. NOT TAX ADVICE. State and local withholding are out of scope
// for v1. The Form W-4 Step 2 multiple-jobs CHECKBOX withholding tables (a
// separate, lower-threshold schedule) are NOT implemented in v1 -- this
// kernel always applies the STANDARD Withholding Rate Schedules and the
// box-not-checked line-1g backout amount, matching an employee who has NOT
// checked the Step 2 box. See `compliance_flags` for an explicit marker.
//
// Bracket table + pay-period counts below are inlined from the shipped,
// versioned, digest-pinned dataset (CALC-CORE-BAND-SPEC.md CURATED-DATASET
// CONVENTION; kernels may only import `_hash.mjs`, never JSON, so the table
// is duplicated here verbatim -- keep byte-identical to the canonical copy):
// data/reference/irs-pub15t-2025-percentage-method.json
//
// Pure ECMA-262 arithmetic only -- no Math.pow, no Date.now/new Date(), no
// Math.random, no Intl/.toLocaleString. Dollar values rounded to 2 decimals
// (r2) only at declared output boundaries; the annual bracket math itself is
// exact (table values are already 2-decimal-clean).

const FILING_STATUSES = ['single_or_mfs', 'married_filing_jointly', 'head_of_household'];

const PAY_PERIODS_PER_YEAR = {
  daily: 260, weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12, quarterly: 4, semiannually: 2,
};

const MULTIPLE_JOBS_BACKOUT_AMOUNT = {
  married_filing_jointly: 12900, single_or_mfs: 8600, head_of_household: 8600,
};

// STANDARD Withholding Rate Schedules, 2025 Annual Percentage Method table.
const ANNUAL_BRACKETS = {
  single_or_mfs: [
    { at_least: 0,      less_than: 6400,   base_tax: 0,         rate: 0.00 },
    { at_least: 6400,   less_than: 18325,  base_tax: 0,         rate: 0.10 },
    { at_least: 18325,  less_than: 54875,  base_tax: 1192.50,   rate: 0.12 },
    { at_least: 54875,  less_than: 109750, base_tax: 5578.50,   rate: 0.22 },
    { at_least: 109750, less_than: 203700, base_tax: 17651.00,  rate: 0.24 },
    { at_least: 203700, less_than: 256925, base_tax: 40199.00,  rate: 0.32 },
    { at_least: 256925, less_than: 632750, base_tax: 57231.00,  rate: 0.35 },
    { at_least: 632750, less_than: null,   base_tax: 188769.75, rate: 0.37 },
  ],
  married_filing_jointly: [
    { at_least: 0,      less_than: 17100,  base_tax: 0,         rate: 0.00 },
    { at_least: 17100,  less_than: 40950,  base_tax: 0,         rate: 0.10 },
    { at_least: 40950,  less_than: 114050, base_tax: 2385.00,   rate: 0.12 },
    { at_least: 114050, less_than: 223800, base_tax: 11157.00,  rate: 0.22 },
    { at_least: 223800, less_than: 411700, base_tax: 35302.00,  rate: 0.24 },
    { at_least: 411700, less_than: 518150, base_tax: 80398.00,  rate: 0.32 },
    { at_least: 518150, less_than: 768700, base_tax: 114462.00, rate: 0.35 },
    { at_least: 768700, less_than: null,   base_tax: 202154.50, rate: 0.37 },
  ],
  head_of_household: [
    { at_least: 0,      less_than: 13900,  base_tax: 0,         rate: 0.00 },
    { at_least: 13900,  less_than: 30900,  base_tax: 0,         rate: 0.10 },
    { at_least: 30900,  less_than: 78750,  base_tax: 1700.00,   rate: 0.12 },
    { at_least: 78750,  less_than: 117250, base_tax: 7442.00,   rate: 0.22 },
    { at_least: 117250, less_than: 211200, base_tax: 15912.00,  rate: 0.24 },
    { at_least: 211200, less_than: 264400, base_tax: 38460.00,  rate: 0.32 },
    { at_least: 264400, less_than: 640250, base_tax: 55484.00,  rate: 0.35 },
    { at_least: 640250, less_than: null,   base_tax: 187031.50, rate: 0.37 },
  ],
};

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

function bracketFor(filingStatus, annualWageAmount) {
  const rows = ANNUAL_BRACKETS[filingStatus];
  for (const row of rows) {
    if (annualWageAmount >= row.at_least && (row.less_than === null || annualWageAmount < row.less_than)) {
      return row;
    }
  }
  return rows[rows.length - 1];
}

export function compute(pp) {
  pp = pp || {};

  const grossWagesPerPeriod = Math.max(0, safeNum(pp.gross_wages_per_period, 0));
  const payFrequency = Object.prototype.hasOwnProperty.call(PAY_PERIODS_PER_YEAR, pp.pay_frequency) ? pp.pay_frequency : 'biweekly';
  const filingStatus = FILING_STATUSES.includes(pp.filing_status) ? pp.filing_status : 'single_or_mfs';
  const step3DependentsCreditAnnual = Math.max(0, safeNum(pp.step3_dependents_credit_annual, 0));
  const step4aOtherIncomeAnnual = Math.max(0, safeNum(pp.step4a_other_income_annual, 0));
  const step4bDeductionsAnnual = Math.max(0, safeNum(pp.step4b_deductions_annual, 0));
  const step4cExtraWithholdingPerPeriod = Math.max(0, safeNum(pp.step4c_extra_withholding_per_period, 0));

  const compliance_flags = ['MULTIPLE_JOBS_CHECKBOX_NOT_SUPPORTED_V1', 'FEDERAL_ONLY_NOT_TAX_ADVICE'];

  const periodsPerYear = PAY_PERIODS_PER_YEAR[payFrequency];

  // Worksheet 1A, Step 1: Adjust the employee's payment amount.
  const line1c = r2(grossWagesPerPeriod * periodsPerYear);
  const line1e = r2(line1c + step4aOtherIncomeAnnual);
  const backoutAmount = MULTIPLE_JOBS_BACKOUT_AMOUNT[filingStatus];
  const line1h = r2(step4bDeductionsAnnual + backoutAmount);
  const adjustedAnnualWageAmount = Math.max(0, r2(line1e - line1h));

  // Worksheet 1A, Step 2: Figure the Tentative Withholding Amount.
  const bracket = bracketFor(filingStatus, adjustedAnnualWageAmount);
  const excessOverBracketFloor = r2(adjustedAnnualWageAmount - bracket.at_least);
  const tentativeAnnualWithholding = r2(bracket.base_tax + excessOverBracketFloor * bracket.rate);
  const tentativeWithholdingThisPeriod = r2(tentativeAnnualWithholding / periodsPerYear);

  // Worksheet 1A, Step 3: Account for tax credits.
  const line3b = r2(step3DependentsCreditAnnual / periodsPerYear);
  const line3c = Math.max(0, r2(tentativeWithholdingThisPeriod - line3b));

  // Worksheet 1A, Step 4: Figure the final amount to withhold.
  const federalWithholdingPerPeriod = r2(line3c + step4cExtraWithholdingPerPeriod);

  if (grossWagesPerPeriod <= 0) compliance_flags.push('WITHHOLDING_ZERO_WAGES');
  if (bracket.rate >= 0.37) compliance_flags.push('TOP_MARGINAL_BRACKET');

  const output_payload = {
    federal_withholding_per_period: federalWithholdingPerPeriod,
    pay_frequency: payFrequency,
    periods_per_year: periodsPerYear,
    filing_status: filingStatus,
    adjusted_annual_wage_amount: adjustedAnnualWageAmount,
    bracket_at_least: bracket.at_least,
    bracket_rate: bracket.rate,
    tentative_annual_withholding: tentativeAnnualWithholding,
    tentative_withholding_this_period: tentativeWithholdingThisPeriod,
    step3_credit_this_period: line3b,
    step4c_extra_withholding_per_period: step4cExtraWithholdingPerPeriod,
    constants_version: CONSTANTS_VERSION,
    regulatory_basis: 'IRS Publication 15-T (2025), Section 4, Percentage Method Tables for Automated Payroll Systems; Worksheet 1A.',
    note: 'STANDARD Withholding Rate Schedules only (Form W-4 Step 2 multiple-jobs checkbox not supported in v1). Federal withholding only; not tax advice; state and local withholding out of scope.',
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
