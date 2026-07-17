import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-339-compute-gross-to-net';
const TOOL_VERSION = '1.0.0';
const CONSTANTS_VERSION = '2025';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_gross_to_net',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Gross-to-net payroll calculation: FICA (Social Security + Medicare, incl.
// Additional Medicare Tax) per IRC 3101/3121, pretax deduction ordering, and
// net pay. Federal only. NOT TAX ADVICE. State and local withholding, state
// disability/unemployment employee contributions are out of scope for v1.
//
// FEDERAL_ONLY_NOT_TAX_ADVICE. Federal withholding is a declared INPUT to
// this kernel (federal_withholding_per_period) rather than recomputed here,
// so a caller can feed it from art-338-compute-federal-withholding's
// output_payload.federal_withholding_per_period -- this kernel does not
// import another kernel (no imports besides _hash.mjs are permitted), so
// the composition happens at the chain/orchestration layer, not in-kernel.
// This node's chaingraph.json `consumes` declares that dependency.
//
// FICA constants (2025, IRC 3101/3121; SSA 2025 Contribution and Benefit
// Base announcement):
//   - Social Security (OASDI): 6.2% employee share, up to the annual wage
//     base ($176,100 for 2025). No employee share above the wage base.
//   - Medicare (HI): 1.45% employee share, NO wage base cap.
//   - Additional Medicare Tax (IRC 3101(b)(2)): +0.9% employee share on
//     wages paid in a calendar year in excess of $200,000, applied by the
//     EMPLOYER without regard to the employee's filing status or a
//     spouse's wages (that reconciliation happens on the employee's Form
//     1040 / Form 8959, out of scope here).
//
// Pretax ordering (declared, v1 scope): `pretax_reduces_fica_and_fit`
// covers traditional 401(k)/403(b) elective deferrals, Section 125
// cafeteria-plan (health/dependent-care) elections, and HSA contributions
// made through payroll -- all FICA-exempt AND FIT-exempt. Everything else
// non-wage is `post_tax_other_deductions` (Roth deferrals, garnishments,
// after-tax benefit premiums, etc.) -- included in neither FICA wages nor
// the federal-withholding wage base, but still reduces net pay.
//
// This kernel is PER-PAY-PERIOD and stateless across periods; the caller
// supplies `ytd_fica_wages_before_period` (cumulative FICA-taxable wages
// paid in the calendar year BEFORE this period, i.e. already net of any
// pretax FICA-exempt deductions) so the SS wage-base cap and the $200,000
// Additional Medicare threshold can be evaluated correctly mid-year.
//
// Pure ECMA-262 arithmetic only -- no Math.pow, no Date.now/new Date(), no
// Math.random, no Intl/.toLocaleString.

const SS_WAGE_BASE_2025 = 176100;
const SS_EMPLOYEE_RATE = 0.062;
const MEDICARE_RATE = 0.0145;
const ADDITIONAL_MEDICARE_THRESHOLD = 200000;
const ADDITIONAL_MEDICARE_RATE = 0.009;

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

export function compute(pp) {
  pp = pp || {};

  const grossWagesPerPeriod = Math.max(0, safeNum(pp.gross_wages_per_period, 0));
  const federalWithholdingPerPeriod = Math.max(0, safeNum(pp.federal_withholding_per_period, 0));
  const pretaxReducesFicaAndFit = Math.max(0, safeNum(pp.pretax_reduces_fica_and_fit, 0));
  const postTaxOtherDeductions = Math.max(0, safeNum(pp.post_tax_other_deductions, 0));
  const ytdFicaWagesBeforePeriod = Math.max(0, safeNum(pp.ytd_fica_wages_before_period, 0));

  const compliance_flags = ['FEDERAL_ONLY_NOT_TAX_ADVICE'];

  // FICA wages this period = gross less FICA-exempt pretax deductions,
  // never negative (a pretax deduction larger than gross is a caller error;
  // clamp rather than emit a negative FICA wage base).
  const ficaWagesThisPeriod = Math.max(0, r2(grossWagesPerPeriod - pretaxReducesFicaAndFit));

  // Social Security: taxable only up to the annual wage base, tracked via
  // the caller-supplied YTD balance.
  const ssRoomRemaining = Math.max(0, r2(SS_WAGE_BASE_2025 - ytdFicaWagesBeforePeriod));
  const ssTaxableWagesThisPeriod = Math.min(ficaWagesThisPeriod, ssRoomRemaining);
  const socialSecurityTax = r2(ssTaxableWagesThisPeriod * SS_EMPLOYEE_RATE);
  if (ssTaxableWagesThisPeriod < ficaWagesThisPeriod) compliance_flags.push('SS_WAGE_BASE_REACHED');

  // Medicare: no cap, applies to all FICA wages this period.
  const medicareTax = r2(ficaWagesThisPeriod * MEDICARE_RATE);

  // Additional Medicare Tax: 0.9% on cumulative wages over $200,000,
  // computed as the overlap of [ytdBefore, ytdAfter] with (200000, infinity).
  const ytdFicaWagesAfterPeriod = r2(ytdFicaWagesBeforePeriod + ficaWagesThisPeriod);
  const priorOverThreshold = Math.max(0, r2(ytdFicaWagesBeforePeriod - ADDITIONAL_MEDICARE_THRESHOLD));
  const totalOverThreshold = Math.max(0, r2(ytdFicaWagesAfterPeriod - ADDITIONAL_MEDICARE_THRESHOLD));
  const additionalMedicareWagesThisPeriod = Math.max(0, r2(totalOverThreshold - priorOverThreshold));
  const additionalMedicareTax = r2(additionalMedicareWagesThisPeriod * ADDITIONAL_MEDICARE_RATE);
  if (additionalMedicareWagesThisPeriod > 0) compliance_flags.push('ADDITIONAL_MEDICARE_APPLIED');

  const ficaTaxTotal = r2(socialSecurityTax + medicareTax + additionalMedicareTax);

  const netPay = r2(
    grossWagesPerPeriod
    - pretaxReducesFicaAndFit
    - federalWithholdingPerPeriod
    - ficaTaxTotal
    - postTaxOtherDeductions
  );
  if (netPay < 0) compliance_flags.push('NET_PAY_NEGATIVE');
  if (grossWagesPerPeriod <= 0) compliance_flags.push('GROSS_TO_NET_ZERO_WAGES');

  const output_payload = {
    net_pay: Math.max(0, netPay),
    fica_wages_this_period: ficaWagesThisPeriod,
    social_security_tax: socialSecurityTax,
    ss_taxable_wages_this_period: ssTaxableWagesThisPeriod,
    medicare_tax: medicareTax,
    additional_medicare_tax: additionalMedicareTax,
    additional_medicare_wages_this_period: additionalMedicareWagesThisPeriod,
    fica_tax_total: ficaTaxTotal,
    federal_withholding_per_period: federalWithholdingPerPeriod,
    pretax_reduces_fica_and_fit: pretaxReducesFicaAndFit,
    post_tax_other_deductions: postTaxOtherDeductions,
    ytd_fica_wages_after_period: ytdFicaWagesAfterPeriod,
    ss_wage_base: SS_WAGE_BASE_2025,
    additional_medicare_threshold: ADDITIONAL_MEDICARE_THRESHOLD,
    constants_version: CONSTANTS_VERSION,
    regulatory_basis: 'IRC 3101/3121 (FICA); SSA 2025 Contribution and Benefit Base ($176,100 OASDI wage base); IRC 3101(b)(2) Additional Medicare Tax ($200,000 employer-withholding threshold).',
    note: 'Federal FICA and net pay only; not tax advice. State/local withholding and state disability/unemployment employee contributions out of scope. federal_withholding_per_period is a declared input (e.g. from compute_federal_withholding), not recomputed here.',
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
