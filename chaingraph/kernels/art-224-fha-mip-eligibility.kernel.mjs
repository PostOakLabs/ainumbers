import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-224-fha-mip-eligibility';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_fha_mip_eligibility',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ─── FHA MIP (Mortgage Insurance Premium) Eligibility ─────────────────────────
// Source: HUD Handbook 4000.1 §II.A.8.p (UFMIP) and §II.A.8.q (Annual MIP);
//   HUD Mortgagee Letter 2023-05 (effective Mar 20 2023, reduced annual MIP);
//   HUD Mortgagee Letter 2024-01 (rates in effect 2024-2025; extended 2026 per HUD notice).
// table_version: "HUD-MIP-ML2023-05-ML2024-01"
//
// UFMIP: 1.75% of base loan amount (all FHA forward mortgages, financed into loan).
// Annual MIP grid: depends on (base_loan_amount, ltv, term).
//   Annual MIP = rate applied monthly to remaining principal balance.
//   Duration: 11-year MIP if original LTV <= 90%; life-of-loan MIP if LTV > 90%.
//
// Annual MIP rate table (per Mortgagee Letter 2023-05):
//  Term > 15 years:
//    LTV <= 90.00%:  base <= $726,200 → 0.50%;  base > $726,200 → 0.70%
//    LTV 90.01-95%:  base <= $726,200 → 0.50%;  base > $726,200 → 0.70%  (same per ML2023-05 table)
//    LTV > 95%:      base <= $726,200 → 0.55%;  base > $726,200 → 0.75%
//  Term <= 15 years:
//    LTV <= 90.00%:  base <= $726,200 → 0.15%;  base > $726,200 → 0.40%
//    LTV > 90.00%:   base <= $726,200 → 0.40%;  base > $726,200 → 0.65%
//
// Qualifying ratios per HUD Handbook 4000.1 §II.A.5:
//   Front-end (housing) DTI: 31% guideline (may exceed with compensating factors to 40%).
//   Back-end (total) DTI: 43% guideline (may exceed with compensating factors to 57% with AUS).
//
// Credit score floor: 580 for max FHA LTV (96.5%); 500-579 → max 90% LTV; <500 ineligible.
// Max LTV by credit score: >=580 → 96.5%; 500-579 → 90%; <500 → 0% (ineligible).

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r4(v) { return Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : 0; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

// MIP threshold for high-balance distinction (tied to 2023 FHA limit reset; 2026 uses same table structure)
const MIP_LOAN_THRESHOLD = 726200;

function annualMipRate(base_loan, ltv, term_years) {
  if (term_years <= 15) {
    if (ltv <= 90.00) return base_loan <= MIP_LOAN_THRESHOLD ? 0.0015 : 0.0040;
    return base_loan <= MIP_LOAN_THRESHOLD ? 0.0040 : 0.0065;
  }
  // Term > 15 years
  if (ltv <= 90.00) return base_loan <= MIP_LOAN_THRESHOLD ? 0.0050 : 0.0070;
  if (ltv <= 95.00) return base_loan <= MIP_LOAN_THRESHOLD ? 0.0050 : 0.0070;
  return base_loan <= MIP_LOAN_THRESHOLD ? 0.0055 : 0.0075;
}

export function compute(pp) {
  pp = pp || {};

  const base_loan   = safeNum(pp.base_loan_amount,  0);
  const ltv         = safeNum(pp.ltv_pct,           0);
  const term_years  = Math.max(1, safeNum(pp.term_years, 30));
  const fico        = safeNum(pp.fico_score,        0);
  const front_dti   = safeNum(pp.front_end_dti_pct, 0);
  const back_dti    = safeNum(pp.back_end_dti_pct,  0);
  const purpose     = String(pp.loan_purpose || 'purchase').toLowerCase();

  // --- Credit score eligibility ---
  const ficoOk   = fico >= 500;
  const maxLtv   = fico >= 580 ? 96.5 : (fico >= 500 ? 90.0 : 0.0);
  const ltvOk    = base_loan === 0 || ltv <= maxLtv;

  // --- UFMIP ---
  const ufmip_rate = 0.0175;
  const ufmip_amount = r2(base_loan * ufmip_rate);

  // --- Annual MIP ---
  const annual_mip_rate_pct = annualMipRate(base_loan, ltv, term_years);
  const annual_mip_amount = r2(base_loan * annual_mip_rate_pct);
  const monthly_mip_amount = r4(annual_mip_amount / 12);

  // --- MIP Duration ---
  // Original LTV <= 90% → MIP for 11 years; > 90% → life of loan
  const mip_duration = ltv <= 90.00 ? '11_years' : 'life_of_loan';

  // --- DTI checks ---
  const frontDtiOk = front_dti === 0 || front_dti <= 31.00;
  const backDtiOk  = back_dti  === 0 || back_dti  <= 43.00;
  const frontDtiCf = front_dti > 31.00 && front_dti <= 40.00;
  const backDtiCf  = back_dti  > 43.00 && back_dti  <= 57.00;

  const compliance_flags = [];
  if (!ficoOk)       compliance_flags.push('FICO_BELOW_500_FHA_INELIGIBLE');
  if (fico >= 500 && fico < 580) compliance_flags.push('FICO_500_579_MAX_LTV_90PCT');
  if (!ltvOk)        compliance_flags.push('LTV_EXCEEDS_FHA_MAX');
  if (ltv > 96.5)    compliance_flags.push('LTV_ABOVE_965_FHA_CAP');
  if (!frontDtiOk && !frontDtiCf) compliance_flags.push('FRONT_DTI_EXCEEDS_40_COMPENSATING_FACTOR_NEEDED');
  else if (!frontDtiOk) compliance_flags.push('FRONT_DTI_31_40_COMPENSATING_FACTOR_NEEDED');
  if (!backDtiOk && !backDtiCf) compliance_flags.push('BACK_DTI_EXCEEDS_57_AUS_APPROVAL_NEEDED');
  else if (!backDtiOk) compliance_flags.push('BACK_DTI_43_57_COMPENSATING_FACTOR_NEEDED');
  if (base_loan === 0) compliance_flags.push('LOAN_AMOUNT_MISSING');
  if (fico === 0) compliance_flags.push('FICO_MISSING');

  const eligible_base = ficoOk && ltvOk;

  const output_payload = {
    fha_eligible: eligible_base,
    fico_eligible: ficoOk,
    ltv_eligible: ltvOk,
    max_ltv_pct: maxLtv,
    ufmip: {
      rate_pct: r4(ufmip_rate * 100),
      amount: ufmip_amount,
      note: 'Financed into loan amount (or paid at closing)',
    },
    annual_mip: {
      rate_pct: r4(annual_mip_rate_pct * 100),
      annual_amount: annual_mip_amount,
      monthly_amount: monthly_mip_amount,
      duration: mip_duration,
    },
    dti: {
      front_end_guideline_pct: 31.0,
      back_end_guideline_pct: 43.0,
      front_end_actual_pct: r2(front_dti),
      back_end_actual_pct: r2(back_dti),
      front_dti_ok: frontDtiOk || frontDtiCf,
      back_dti_ok: backDtiOk || backDtiCf,
      compensating_factors_needed: (!frontDtiOk && frontDtiCf) || (!backDtiOk && backDtiCf),
    },
    table_version: 'HUD-MIP-ML2023-05-ML2024-01',
    table_source:  'HUD Handbook 4000.1 §II.A.8.p-q; HUD Mortgagee Letter 2023-05 (effective 2023-03-20); ML 2024-01',
    regulatory_basis: '12 USC 1709 (National Housing Act §203(b)); HUD Handbook 4000.1; 24 CFR Part 203',
    note: 'FHA MIP rates from ML 2023-05 (reduced rates effective Mar 2023). Verify current Mortgagee Letter schedule for any updates beyond 2025.',
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
