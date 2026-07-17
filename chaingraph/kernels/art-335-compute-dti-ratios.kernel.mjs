import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-335-compute-dti-ratios';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_dti_ratios',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Debt-to-income ratio computation per Fannie Mae Selling Guide B3-6-02
// (Debt-to-Income Ratios) and Freddie Mac Single-Family Seller/Servicer
// Guide 5401.2 (Debt payment-to-income ratio). Front-end (housing) and
// back-end (total) DTI, plus a tier classification against the standard
// manual-underwriting / compensating-factor / AUS-only bands used by both
// agencies. Feeds art-222-agency-eligibility-matrix (dti_total input).
//
// Pure ECMA-262 arithmetic only -- no Math.pow, no Date.now/new Date(),
// no Math.random. Percent values rounded to 2 decimal places (r2).

const MAX_DTI_PCT = {
  du: 50,      // Fannie Mae DU (Desktop Underwriter) max back-end, B3-6-02
  lpa: 50,     // Freddie Mac LPA (Loan Product Advisor) max back-end, 5401.2
  manual: 45,  // Manual underwrite ceiling with compensating factors, B3-6-02/5401.2
};

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

function classifyTier(backEndPct) {
  if (backEndPct <= 36) return 'standard_manual';
  if (backEndPct <= 45) return 'extended_manual_compensating_factors';
  if (backEndPct <= 50) return 'du_lpa_only';
  return 'exceeds_max_dti';
}

export function compute(pp) {
  pp = pp || {};

  const grossMonthlyIncome = safeNum(pp.gross_monthly_income, 0);
  const housingPaymentPitia = safeNum(pp.housing_payment_pitia, 0);
  const otherMonthlyDebts = safeNum(pp.other_monthly_debts, 0);
  const underwritingType = ['du', 'lpa', 'manual'].includes(pp.underwriting_type) ? pp.underwriting_type : 'du';

  const compliance_flags = [];
  const zeroIncome = grossMonthlyIncome <= 0;

  const totalMonthlyDebt = r2(housingPaymentPitia + otherMonthlyDebts);
  let frontEndDtiPct = 0;
  let backEndDtiPct = 0;
  let dtiTier = 'invalid_income';

  if (zeroIncome) {
    compliance_flags.push('DTI_ZERO_INCOME');
  } else {
    frontEndDtiPct = r2((housingPaymentPitia / grossMonthlyIncome) * 100);
    backEndDtiPct = r2((totalMonthlyDebt / grossMonthlyIncome) * 100);
    dtiTier = classifyTier(backEndDtiPct);
  }

  const maxDtiPct = MAX_DTI_PCT[underwritingType];
  const withinMax = !zeroIncome && backEndDtiPct <= maxDtiPct + 1e-9;
  if (!zeroIncome && !withinMax) compliance_flags.push('DTI_EXCEEDS_MAX');

  const output_payload = {
    front_end_dti_pct: frontEndDtiPct,
    back_end_dti_pct: backEndDtiPct,
    gross_monthly_income: r2(grossMonthlyIncome),
    housing_payment_pitia: r2(housingPaymentPitia),
    other_monthly_debts: r2(otherMonthlyDebts),
    total_monthly_debt: totalMonthlyDebt,
    dti_tier: dtiTier,
    underwriting_type: underwritingType,
    max_dti_pct: maxDtiPct,
    within_max: withinMax,
    regulatory_basis: 'Fannie Mae Selling Guide B3-6-02 (Debt-to-Income Ratios); Freddie Mac Single-Family Seller/Servicer Guide 5401.2 (Debt payment-to-income ratio)',
    note: 'Front-end = housing payment (PITIA) / gross monthly income. Back-end = total monthly debt / gross monthly income. Tier bands are representative GSE manual-underwriting / AUS bands -- confirm against the current Selling Guide / Seller Guide and the specific AUS findings for the loan in question. Not check_agency_eligibility_matrix (art-222), which consumes this ratio as one of several eligibility checks.',
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
