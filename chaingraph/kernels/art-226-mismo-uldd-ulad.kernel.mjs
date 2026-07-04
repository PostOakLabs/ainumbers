import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-226-mismo-uldd-ulad';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'lint_mismo_uldd_ulad',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ─── ULDD Phase 5 / ULAD Structural Lint ─────────────────────────────────────
// This node performs STRUCTURAL lint of Fannie Mae ULDD (Uniform Loan Delivery
// Dataset) Phase 5 and Freddie Mac ULAD (Uniform Loan Application Dataset)
// required data points and enumeration values.
//
// Source: Fannie Mae ULDD Phase 5 Data Stencil (published at
//   fanniemae.com/funding-and-liquidity/mortgage-backed-securities/uldd,
//   free public access). ULDD Phase 5 mandate effective 2025-07-28.
//   Freddie Mac ULAD Data Dictionary v1.3 (freddiemac.com/learn/uniform-mortgage-data-program,
//   free public access).
// table_version: "ULDD-PHASE5-ULAD-1.3-2025-07-28"
//
// LICENSE NOTICE: This node lints against the PUBLIC Fannie Mae ULDD Phase 5
//   Data Stencil and public Freddie Mac ULAD data dictionaries, which are free
//   to access and reference. It does NOT embed, reproduce, or validate against
//   the membership-licensed MISMO v3.x Reference Model schema. Describe this
//   tool as "ULDD/ULAD structural lint," never as a "MISMO validator."
//
// PII NOTE: Loan data is personally identifiable information. This node receives
//   STRUCTURAL fields and enumerations only, never free-form personal identifiers.
//   All inputs are processed locally in your browser; no data is transmitted.
//
// Input schema (bounded structural fields):
//   loan_data: object with the following optional structural fields:
//     loan_purpose_type: string (enum)
//     amortization_type: string (enum)
//     loan_amount: number
//     ltv_pct: number
//     occupancy_type: string (enum)
//     property_type: string (enum)
//     number_of_units: number
//     interest_rate_pct: number
//     loan_term_months: number
//     arm_index_type: string (enum, if ARM)
//     arm_margin_pct: number (if ARM)
//     qualifying_rate_pct: number
//     prepayment_penalty_indicator: boolean
//     balloon_indicator: boolean
//     negative_amortization_indicator: boolean
//     interest_only_indicator: boolean
//     buydown_indicator: boolean
//     credit_score: number
//     dti_pct: number
//     down_payment_pct: number
//     down_payment_source_type: string (enum)
//     seller_concession_amount: number
//     mi_type: string (enum)
//     mi_coverage_pct: number
//     channel_type: string (enum)
//     doc_type: string (enum)
//
// Exec-check note (from W38 rider): bounded structural fields; no large asset blobs,
//   no BLAKE3/similarity hashing. Cycle count is low (pure enum and range checks).

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

// ULDD Phase 5 required field presence set for standard conforming delivery
const ULDD_REQUIRED_FIELDS = [
  'loan_purpose_type',
  'amortization_type',
  'loan_amount',
  'ltv_pct',
  'occupancy_type',
  'property_type',
  'number_of_units',
  'interest_rate_pct',
  'loan_term_months',
  'credit_score',
  'dti_pct',
  'channel_type',
  'doc_type',
];

// Enumeration dictionaries from public ULDD Phase 5 / ULAD data stencils
const ENUM = {
  loan_purpose_type: ['Purchase','CashOutRefinance','NoCashOutRefinance','Other'],
  amortization_type: ['AdjustableRate','FixedRate','GraduatedPaymentMortgage','OtherAmortizationType'],
  occupancy_type:    ['InvestorProperty','PrimaryResidence','SecondHome'],
  property_type:     ['Attached','Condominium','Cooperative','Detached','HighRiseCondominium',
                      'ManufacturedHousing','ManufacturedHousingCondo','MH-Advantage',
                      'PlanedUnitDevelopment','DetachedCondominium'],
  arm_index_type:    ['CmtIndex1Yr','CmtIndex3Yr','CmtIndex5Yr','CmtIndex7Yr','CmtIndex10Yr',
                      'LIBOR6Month','SOFR30DayAverage','SOFR90DayAverage','SOFR180DayAverage',
                      'TBillAuction6Mo','Other'],
  down_payment_source_type: ['Borrower','Bridge','CashDeposit','CheckingOrSavingsAccount',
                              'CommunityNonprofit','EmployerAssistanceProgram','FHAGift',
                              'Gift','GiftOfEquity','GovernmentAssistanceProgram','LifeInsuranceCashValue',
                              'LotEquity','Other','RealEstatePropertyForSale','RetirementFunds',
                              'SecuredBorrowedFunds','StocksBonds','SweatEquity','TradeEquityFromPropertySwap',
                              'TrustFunds','UnsecuredBorrowedFunds'],
  mi_type:      ['BorrowerPaid','LenderPaid','NoMI','Split','Other'],
  channel_type: ['Broker','Correspondent','Retail','Wholesale','Other'],
  doc_type:     ['FullDocumentation','LimitedDocumentation','NoDocumentation',
                 'NoRatioDocumentation','StatedAssets','StatedIncome','StatedIncome-StatedAssets'],
};

// ULDD Phase 5 conditionality rules
// ARM-conditional fields required when amortization_type = AdjustableRate
const ARM_CONDITIONAL = ['arm_index_type', 'arm_margin_pct'];

// Range checks aligned to ULDD data stencil field constraints
const RANGE_CHECKS = {
  loan_amount:           { min: 1, max: 50000000 },
  ltv_pct:               { min: 0, max: 100 },
  interest_rate_pct:     { min: 0, max: 25 },
  loan_term_months:      { min: 12, max: 480 },
  credit_score:          { min: 300, max: 850 },
  dti_pct:               { min: 0, max: 100 },
  number_of_units:       { min: 1, max: 4 },
  down_payment_pct:      { min: 0, max: 100 },
  mi_coverage_pct:       { min: 0, max: 100 },
  arm_margin_pct:        { min: 0, max: 10 },
  seller_concession_amount: { min: 0, max: 50000000 },
  qualifying_rate_pct:   { min: 0, max: 25 },
};

export function compute(pp) {
  pp = pp || {};
  const loan = pp.loan_data || {};

  const errors = [];
  const warnings = [];
  const field_results = [];

  // --- Required field presence ---
  for (const field of ULDD_REQUIRED_FIELDS) {
    const present = loan[field] !== undefined && loan[field] !== null && loan[field] !== '';
    field_results.push({ field, required: true, present, status: present ? 'ok' : 'missing' });
    if (!present) errors.push({ code: 'REQUIRED_FIELD_MISSING', field });
  }

  // --- Enum validation ---
  for (const [field, allowed] of Object.entries(ENUM)) {
    if (loan[field] === undefined || loan[field] === null) continue;
    const val = String(loan[field]);
    if (!allowed.includes(val)) {
      errors.push({ code: 'INVALID_ENUM_VALUE', field, value: val, allowed_values: allowed });
    }
  }

  // --- Range validation ---
  for (const [field, { min, max }] of Object.entries(RANGE_CHECKS)) {
    if (loan[field] === undefined || loan[field] === null) continue;
    const n = safeNum(loan[field], null);
    if (n === null || !Number.isFinite(n)) {
      errors.push({ code: 'FIELD_NOT_NUMERIC', field });
    } else if (n < min || n > max) {
      errors.push({ code: 'VALUE_OUT_OF_RANGE', field, value: n, min, max });
    }
  }

  // --- ARM conditionality ---
  if (loan.amortization_type === 'AdjustableRate') {
    for (const f of ARM_CONDITIONAL) {
      if (loan[f] === undefined || loan[f] === null) {
        errors.push({ code: 'ARM_CONDITIONAL_REQUIRED', field: f, trigger: 'amortization_type=AdjustableRate' });
      }
    }
  }

  // --- Indicator consistency ---
  if (loan.balloon_indicator && loan.amortization_type === 'FixedRate' &&
      safeNum(loan.loan_term_months, 0) > 360) {
    warnings.push({ code: 'BALLOON_LONG_TERM_REVIEW', note: 'Balloon indicator with term > 360 months warrants delivery review' });
  }
  if (loan.negative_amortization_indicator && loan.amortization_type === 'FixedRate') {
    warnings.push({ code: 'NEG_AM_FIXED_RATE_INCONSISTENCY', note: 'Negative amortization with fixed rate is atypical; verify loan type' });
  }
  if (loan.mi_type === 'NoMI' && safeNum(loan.ltv_pct, 0) > 80) {
    warnings.push({ code: 'LTV_OVER_80_NO_MI', note: 'LTV > 80% with NoMI typically requires agency credit enhancement or exception' });
  }

  // --- ULAD Phase 5 mandate date check ---
  const uldd_mandate_date = '2025-07-28';
  const total_fields_supplied = Object.keys(loan).filter(k => loan[k] !== undefined && loan[k] !== null).length;

  const pass = errors.length === 0;

  const compliance_flags = [];
  if (!pass) compliance_flags.push('ULDD_ULAD_LINT_ERRORS_FOUND');
  if (warnings.length > 0) compliance_flags.push('ULDD_ULAD_LINT_WARNINGS');

  const output_payload = {
    lint_pass: pass,
    errors,
    warnings,
    error_count: errors.length,
    warning_count: warnings.length,
    fields_supplied: total_fields_supplied,
    field_results: field_results.slice(0, 30), // cap at 30 to bound output size
    uldd_phase:     'Phase 5',
    uldd_mandate_date,
    table_version:  'ULDD-PHASE5-ULAD-1.3-2025-07-28',
    table_source:   'Fannie Mae ULDD Phase 5 Data Stencil (public, fanniemae.com); Freddie Mac ULAD Data Dictionary v1.3 (public, freddiemac.com); ULDD Phase 5 mandate effective 2025-07-28',
    regulatory_basis: '12 USC 4501 (FHFA); Fannie Mae ULDD Phase 5 mandate; Freddie Mac ULAD v1.3; Uniform Mortgage Data Program (UMDP)',
    license_note: 'Lints against public ULDD Phase 5 / ULAD data dictionaries. Does not embed or validate against the membership-licensed MISMO v3.x Reference Model schema.',
    pii_note: 'All inputs are processed locally in your browser. No data is transmitted. Loan data is PII: use structural/synthetic inputs only.',
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
