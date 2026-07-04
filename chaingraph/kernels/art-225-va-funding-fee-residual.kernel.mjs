import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-225-va-funding-fee-residual';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_va_funding_fee_residual',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ─── VA Funding Fee + Residual Income tables ──────────────────────────────────
// Funding fee source: 38 USC §3729 (current statutory table, as amended by
//   Blue Water Navy Vietnam Veterans Act of 2019, effective Jan 1 2020; rates
//   in effect as of 2025-01-01 per VA Circular 26-25-3).
// table_version (funding fee): "VA-FF-2025-01-01"
//
// Residual income source: VA Pamphlet 26-7 Ch.4 Table 41A (family size × region)
//   and Table 41B (loan amounts >= $80,000 supplemental).
// table_version (residual): "VA-PAMPHLET-26-7-CH4-2024"
//
// DTI benchmark: 41% (VA Pamphlet 26-7 §4.6; exceeding it triggers residual review).
//
// Funding fee table structure (38 USC §3729(a)(2)):
//   Regular military (Active/Reserves/National Guard):
//     First use: purchase 0% down → 2.15%; 5-9.99% → 1.50%; >=10% → 1.25%
//     Subsequent use: purchase 0% down → 3.30%; 5-9.99% → 1.50%; >=10% → 1.25%
//     Cash-out refi (first use) → 2.15%; subsequent → 3.30%
//     IRRRL (all) → 0.50%
//   Reserves / National Guard (treated same as regular since Blue Water Navy Act 2019).
//   Exemptions from fee (38 USC §3729(c)):
//     - Veteran receiving VA compensation for service-connected disability
//     - Surviving spouse of veteran who died in service or from service-connected disability
//     - Active-duty service member awarded Purple Heart (effective Jan 2020)
//
// Residual income tables (VA Pamphlet 26-7, Table 41A — monthly minimum):
//   Regions: Northeast, Midwest, South, West (continental US)
//   Family sizes: 1, 2, 3, 4, 5; above 5 add $80/additional member
//
// Table 41A (loans >= $80,000 — the standard qualifying table used for most mortgages)
// Northeast: NY, NJ, CT, ME, MA, NH, PA, RI, VT
// Midwest:   IL, IN, IA, KS, MI, MN, MO, NE, OH, ND, SD, WI
// South:     AL, AR, DE, DC, FL, GA, KY, LA, MD, MS, NC, OK, SC, TN, TX, VA, WV
// West:      AK, AZ, CA, CO, HI, ID, MT, NV, NM, OR, UT, WA, WY

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }
function r4(v) { return Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : 0; }

// Funding fee rates by [use][dp_tier] — Regular military and Reserves (same post-2019)
const FF_PURCHASE = {
  first:      [0.0215, 0.0150, 0.0125],  // dp: <5%, 5-9.99%, >=10%
  subsequent: [0.0330, 0.0150, 0.0125],
};
const FF_CASHOUT = { first: 0.0215, subsequent: 0.0330 };
const FF_IRRRL   = 0.0050;

function dpTier(dp_pct) {
  if (dp_pct <  5) return 0;
  if (dp_pct < 10) return 1;
  return 2;
}

// Residual income table 41A (loans >= $80,000)
// Rows: family size 1-5; Cols: [Northeast, Midwest, South, West]
const RESIDUAL_TABLE_41A = [
  [450, 441, 441, 491],  // 1
  [755, 738, 738, 823],  // 2
  [909, 889, 889, 990],  // 3
  [1025,1003,1003,1117], // 4
  [1062,1039,1039,1158], // 5
];
const RESIDUAL_EXTRA_MEMBER = 80; // per additional member above 5

// Region assignment by state (2-letter USPS)
const REGION_MAP = {
  // Northeast
  CT:'NE',ME:'NE',MA:'NE',NH:'NE',NJ:'NE',NY:'NE',PA:'NE',RI:'NE',VT:'NE',
  // Midwest
  IL:'MW',IN:'MW',IA:'MW',KS:'MW',MI:'MW',MN:'MW',MO:'MW',NE:'MW',ND:'MW',OH:'MW',SD:'MW',WI:'MW',
  // South
  AL:'SO',AR:'SO',DE:'SO',DC:'SO',FL:'SO',GA:'SO',KY:'SO',LA:'SO',MD:'SO',MS:'SO',
  NC:'SO',OK:'SO',SC:'SO',TN:'SO',TX:'SO',VA:'SO',WV:'SO',
  // West (including AK, HI per pamphlet)
  AK:'WE',AZ:'WE',CA:'WE',CO:'WE',HI:'WE',ID:'WE',MT:'WE',NV:'WE',NM:'WE',
  OR:'WE',UT:'WE',WA:'WE',WY:'WE',
};
const REGION_COL = { NE: 0, MW: 1, SO: 2, WE: 3 };

function residualIncome(family_size, state) {
  const region = REGION_MAP[state] || 'SO'; // default South if state unknown
  const col = REGION_COL[region];
  if (family_size <= 0) family_size = 1;
  if (family_size <= 5) {
    return RESIDUAL_TABLE_41A[family_size - 1][col];
  }
  return RESIDUAL_TABLE_41A[4][col] + (family_size - 5) * RESIDUAL_EXTRA_MEMBER;
}

export function compute(pp) {
  pp = pp || {};

  const base_loan      = safeNum(pp.base_loan_amount,    0);
  const down_pct       = safeNum(pp.down_payment_pct,    0);
  const purpose        = String(pp.loan_purpose || 'purchase').toLowerCase();
  const use_type       = String(pp.va_use_type  || 'first').toLowerCase(); // first | subsequent
  const exempt         = Boolean(pp.funding_fee_exempt);
  const family_size    = Math.max(1, Math.round(safeNum(pp.family_size, 1)));
  const state          = String(pp.state || '').toUpperCase().trim();
  const dti_pct        = safeNum(pp.dti_pct,              0);
  const monthly_income = safeNum(pp.gross_monthly_income,  0);
  const monthly_expenses = safeNum(pp.monthly_shelter_expenses, 0); // PITIA + other debts

  // --- Funding fee ---
  let ff_rate = 0;
  let ff_basis = '';
  if (exempt) {
    ff_rate  = 0;
    ff_basis = 'exempt';
  } else if (purpose === 'irrrl' || purpose === 'streamline_refi') {
    ff_rate  = FF_IRRRL;
    ff_basis = 'irrrl';
  } else if (purpose === 'cash_out_refi' || purpose === 'cashout') {
    ff_rate  = use_type === 'subsequent' ? FF_CASHOUT.subsequent : FF_CASHOUT.first;
    ff_basis = 'cashout_' + use_type;
  } else {
    // Purchase or rate-term refi
    const tier = dpTier(down_pct);
    ff_rate  = use_type === 'subsequent' ? FF_PURCHASE.subsequent[tier] : FF_PURCHASE.first[tier];
    ff_basis = 'purchase_' + use_type + '_dp_tier' + tier;
  }

  const funding_fee_amount = r2(base_loan * ff_rate);

  // --- Residual income ---
  const required_residual = residualIncome(family_size, state);
  // Actual residual = gross income minus all monthly shelter expenses and debts
  const actual_residual = r2(monthly_income > 0 ? monthly_income - monthly_expenses : 0);
  const residual_ok = monthly_income === 0 || actual_residual >= required_residual;
  const residual_margin = r2(actual_residual - required_residual);

  // --- DTI benchmark ---
  const dti_ok = dti_pct === 0 || dti_pct <= 41.0;
  const dti_residual_review = dti_pct > 41.0;

  const compliance_flags = [];
  if (base_loan === 0) compliance_flags.push('LOAN_AMOUNT_MISSING');
  if (!residual_ok) compliance_flags.push('RESIDUAL_INCOME_BELOW_MINIMUM');
  if (dti_residual_review && residual_ok) compliance_flags.push('DTI_EXCEEDS_41_RESIDUAL_REVIEW_REQUIRED');
  if (dti_residual_review && !residual_ok) compliance_flags.push('DTI_EXCEEDS_41_AND_RESIDUAL_INCOME_BELOW_MINIMUM');
  if (down_pct > 0 && base_loan > 0) {
    const dvr = (down_pct / 100) * base_loan;
    if (dvr > 0 && dvr < base_loan * 0.0499 && down_pct >= 5) {
      // inconsistency warning
    }
  }

  const region = REGION_MAP[state] || 'SO';

  const output_payload = {
    funding_fee: {
      rate_pct: r4(ff_rate * 100),
      amount: funding_fee_amount,
      exempt,
      basis: ff_basis,
      financed_loan_amount: r2(base_loan + funding_fee_amount),
    },
    residual_income: {
      required_monthly: required_residual,
      actual_monthly: actual_residual,
      margin: residual_margin,
      meets_requirement: residual_ok,
      family_size,
      region,
      state_code: state || null,
    },
    dti: {
      actual_pct: r2(dti_pct),
      benchmark_pct: 41.0,
      ok: dti_ok,
      residual_review_triggered: dti_residual_review,
    },
    table_version_funding_fee: 'VA-FF-2025-01-01',
    table_version_residual:    'VA-PAMPHLET-26-7-CH4-2024',
    table_source_funding_fee:  '38 USC §3729(a)(2); VA Circular 26-25-3 (effective 2025-01-01)',
    table_source_residual:     'VA Pamphlet 26-7 Ch.4 Tables 41A/41B (2024 edition)',
    regulatory_basis: '38 USC §§3701-3729 (VA Home Loan Program); 38 CFR Part 36; VA Pamphlet 26-7',
    pii_note: 'All inputs processed locally in your browser. No data is transmitted.',
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
