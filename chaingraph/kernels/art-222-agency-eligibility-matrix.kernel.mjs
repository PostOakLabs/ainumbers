import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-222-agency-eligibility-matrix';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_agency_eligibility_matrix',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ─── Fannie Mae DU / Freddie Mac LPA Agency Eligibility Matrix ───────────────
// Source: Fannie Mae Selling Guide B3-2-01 through B3-2-02 (Desktop Underwriter
//   eligibility) and B3-3.1-09 (manual underwriting); Freddie Mac Single-Family
//   Seller/Servicer Guide Chapter 5100-5300 (Loan Product Advisor eligibility).
//   Effective date: 2026-01-01 (DU Version 11.1+ guidelines).
// table_version: "FNM-LPA-ELIGIBILITY-2026-01-01"
//
// Disambiguation: check_agency_eligibility_matrix tests DU/LPA approval
//   parameters (DTI caps, LTV/CLTV/HCLTV grids by product/occupancy).
//   For FHFA conforming loan size limits use check_conforming_loan_limit.
//   For LLPA pricing surcharges use compute_llpa_stack.
//
// Inputs:
//   fico_score (number), ltv_pct (number), cltv_pct (number, opt),
//   hcltv_pct (number, opt), dti_pct (number), occupancy (primary|second_home|investment),
//   property_type (sfr|condo|2unit|3unit|4unit), loan_purpose (purchase|rate_term_refi|cash_out_refi),
//   underwriting_type (du|lpa|manual), units (1|2|3|4)

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

// Max LTV by occupancy × purpose for DU/AUS approval (primary 1-unit SFR as baseline).
// Rows: purpose [purchase, rate_term_refi, cash_out_refi]
// Cols: occupancy [primary, second_home, investment]
const MAX_LTV = {
  //                 primary  2nd_home  investment
  purchase:         [97.00,   90.00,    85.00],
  rate_term_refi:   [97.00,   90.00,    85.00],
  cash_out_refi:    [80.00,   75.00,    70.00],
};

// Max CLTV by occupancy × purpose (primary 1-unit SFR baseline)
const MAX_CLTV = {
  purchase:         [105.00,  90.00,    85.00],
  rate_term_refi:   [105.00,  90.00,    85.00],
  cash_out_refi:    [80.00,   75.00,    70.00],
};

// Multi-unit LTV caps (1-unit baseline already in MAX_LTV; only divergences stored)
// Units 2-4 are investment or primary; second-home is always 1 unit.
const MULTI_UNIT_MAX_LTV = {
  //          primary   investment
  2: [85.00, 75.00],
  3: [75.00, 70.00],
  4: [75.00, 70.00],
};

// DTI limits
// DU: standard DU approve → 50% DTI (Fannie SEL-2017-07).
// Manual: housing 36% / total 45% (standard); may go to 45%/50% with compensating factors.
// LPA: mirrors DU at 50%.
const DTI_MAX = { du: 50.00, lpa: 50.00, manual_housing: 36.00, manual_total: 45.00 };

// Minimum FICO for agency eligibility (DU/AUS path)
const MIN_FICO = 620; // Note: some products allow <620 with manual UW and compensating factors

function occupancyIndex(occ) {
  if (occ === 'second_home') return 1;
  if (occ === 'investment')  return 2;
  return 0; // primary
}

function normPurpose(p) {
  const s = String(p || 'purchase').toLowerCase().replace(/-/g, '_');
  if (s === 'refinance' || s === 'rate_term' || s === 'rate_term_refi') return 'rate_term_refi';
  if (s.includes('cash')) return 'cash_out_refi';
  return 'purchase';
}

export function compute(pp) {
  pp = pp || {};

  const fico      = safeNum(pp.fico_score, 0);
  const ltv       = safeNum(pp.ltv_pct, 0);
  const cltv      = safeNum(pp.cltv_pct, ltv);
  const hcltv     = safeNum(pp.hcltv_pct, cltv);
  const dti       = safeNum(pp.dti_pct, 0);
  const occ       = String(pp.occupancy_type || 'primary').toLowerCase();
  const prop      = String(pp.property_type   || 'sfr').toLowerCase();
  const purp      = normPurpose(pp.loan_purpose);
  const uw        = String(pp.underwriting_type || 'du').toLowerCase(); // du|lpa|manual
  const units     = Math.max(1, Math.min(4, Math.round(safeNum(pp.units, 1))));

  const oi = occupancyIndex(occ);
  const purpRow = MAX_LTV[purp] || MAX_LTV['purchase'];
  const purpCLTV = MAX_CLTV[purp] || MAX_CLTV['purchase'];

  let maxLtv = purpRow[oi];
  let maxCltv = purpCLTV[oi];
  let maxHcltv = maxCltv; // HCLTV = CLTV for most products; same cap

  // Multi-unit overrides (primary or investment only; second-home 1 unit only)
  if (units >= 2 && occ !== 'second_home') {
    const muRow = MULTI_UNIT_MAX_LTV[units] || MULTI_UNIT_MAX_LTV[4];
    const muIdx = occ === 'investment' ? 1 : 0;
    maxLtv  = Math.min(maxLtv,  muRow[muIdx]);
    maxCltv = Math.min(maxCltv, muRow[muIdx]);
    maxHcltv = maxCltv;
  }

  // Condo: no LTV surcharge at eligibility level (LLPA handles pricing); note only
  const isCondo = prop === 'condo';

  // DTI evaluation
  let dtiCap;
  let dtiHousingCap = null;
  if (uw === 'manual') {
    dtiCap = DTI_MAX.manual_total;
    dtiHousingCap = DTI_MAX.manual_housing;
  } else {
    dtiCap = uw === 'lpa' ? DTI_MAX.lpa : DTI_MAX.du;
  }

  const fails = [];
  const checks = [];

  // FICO check
  const ficoOk = fico >= MIN_FICO || (uw === 'manual'); // manual may allow <620 with factors
  checks.push({ check: 'fico_minimum', required: MIN_FICO, actual: fico, pass: ficoOk, note: fico < MIN_FICO && uw === 'manual' ? 'Compensating factors required per Selling Guide B3-5.1-01' : null });
  if (!ficoOk) fails.push('FICO_BELOW_MINIMUM');

  // LTV check
  const ltvOk = ltv <= maxLtv;
  checks.push({ check: 'ltv', required_max: r2(maxLtv), actual: r2(ltv), pass: ltvOk });
  if (!ltvOk) fails.push('LTV_EXCEEDS_MAX');

  // CLTV check
  const cltvOk = cltv <= maxCltv;
  checks.push({ check: 'cltv', required_max: r2(maxCltv), actual: r2(cltv), pass: cltvOk });
  if (!cltvOk) fails.push('CLTV_EXCEEDS_MAX');

  // HCLTV check
  const hcltvOk = hcltv <= maxHcltv;
  checks.push({ check: 'hcltv', required_max: r2(maxHcltv), actual: r2(hcltv), pass: hcltvOk });
  if (!hcltvOk) fails.push('HCLTV_EXCEEDS_MAX');

  // DTI check
  const dtiOk = dti <= dtiCap;
  checks.push({ check: 'dti_total', required_max: r2(dtiCap), actual: r2(dti), pass: dtiOk, underwriting: uw });
  if (!dtiOk) fails.push('DTI_EXCEEDS_LIMIT');

  if (dtiHousingCap !== null) {
    const housingDti = safeNum(pp.housing_dti_pct, dti);
    const hdtiOk = housingDti <= dtiHousingCap;
    checks.push({ check: 'dti_housing', required_max: r2(dtiHousingCap), actual: r2(housingDti), pass: hdtiOk });
    if (!hdtiOk) fails.push('HOUSING_DTI_EXCEEDS_LIMIT');
  }

  // Investment second-home rules
  if (occ === 'second_home' && units > 1) fails.push('SECOND_HOME_MUST_BE_1UNIT');
  if (occ === 'investment' && purp === 'cash_out_refi' && ltv > 70) fails.push('INVESTMENT_CASHOUT_MAX_LTV_70');

  const eligible = fails.length === 0;

  const output_payload = {
    eligible,
    eligible_flag: eligible ? 'ELIGIBLE' : 'INELIGIBLE',
    fails,
    checks,
    max_ltv_pct:   r2(maxLtv),
    max_cltv_pct:  r2(maxCltv),
    max_hcltv_pct: r2(maxHcltv),
    max_dti_pct:   r2(dtiCap),
    underwriting_type: uw,
    product_notes: isCondo ? ['Warrantable condo: standard eligibility applies; non-warrantable condos require project review'] : [],
    table_version: 'FNM-LPA-ELIGIBILITY-2026-01-01',
    table_source:  'Fannie Mae Selling Guide B3-2-01/B3-3.1-09 (DU); Freddie Mac Guide Ch.5100 (LPA); effective 2026-01-01',
    regulatory_basis: '12 USC 4501 (FHFA); Fannie Mae Selling Guide; Freddie Mac Single-Family Guide; DU v11.1+',
    pii_note: 'All inputs processed locally in your browser. No data is transmitted.',
  };

  const compliance_flags = [...fails];
  if (ltv === 0) compliance_flags.push('LTV_MISSING');
  if (fico === 0) compliance_flags.push('FICO_MISSING');
  if (dti === 0) compliance_flags.push('DTI_MISSING');

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
