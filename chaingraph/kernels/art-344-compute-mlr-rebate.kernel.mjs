import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-344-compute-mlr-rebate';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_mlr_rebate',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Medical Loss Ratio (MLR) rebate computation per 45 CFR 158 (ACA MLR rule).
// Numerator = adjusted incurred claims (claims + quality-improvement activity
// expenditures, net of reinsurance recoveries and risk-adjustment/risk-corridors
// transfers) per 158.140-158.150. Denominator = adjusted earned premium (earned
// premium less federal/state taxes and licensing/regulatory fees) per 158.160-158.162.
// Credibility adjustment per 158.230-158.232: non-credible experience (< 1,000
// member life-years) is deemed compliant without a rebate calculation; partially
// credible experience (1,000-74,999 life-years) gets a credibility-adjustment
// add-on (this kernel uses a REPRESENTATIVE linear taper standing in for CMS's
// stepped, deductible-banded credibility table -- confirm the exact figure
// against the current CMS MLR credibility-adjustment table for filing); fully
// credible experience (>= 75,000 life-years) gets no add-on. Three-year averaging
// per 158.221: current + up to two prior years, weighted by each year's adjusted
// earned premium. Rebate per 158.240: (threshold - 3yr-avg adjusted MLR) x current
// year adjusted earned premium, when positive. De minimis per 158.243: no payment
// required when the per-enrollee rebate is below $5 (individual market) or $20
// (group market) -- this kernel approximates per-enrollee using member_life_years
// as the enrollee-count proxy.
//
// Pure ECMA-262 arithmetic only -- no Math.pow, no Date.now/new Date(), no
// Math.random. Dollar and percent values rounded to 2 decimal places (r2).

const THRESHOLD_PCT = { individual: 80, small_group: 80, large_group: 85 };
const DE_MINIMIS_USD = { individual: 5, small_group: 20, large_group: 20 };
const NON_CREDIBLE_MAX_LIFE_YEARS = 1000;
const FULLY_CREDIBLE_MIN_LIFE_YEARS = 75000;
const MAX_CREDIBILITY_ADJUSTMENT_PCT = 8;

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

function creditbilityTier(lifeYears) {
  if (lifeYears < NON_CREDIBLE_MAX_LIFE_YEARS) return 'non_credible';
  if (lifeYears >= FULLY_CREDIBLE_MIN_LIFE_YEARS) return 'fully_credible';
  return 'partially_credible';
}

function creditbilityAdjustmentPct(tier, lifeYears) {
  if (tier === 'fully_credible' || tier === 'non_credible') return 0;
  const span = FULLY_CREDIBLE_MIN_LIFE_YEARS - NON_CREDIBLE_MAX_LIFE_YEARS;
  const frac = (lifeYears - NON_CREDIBLE_MAX_LIFE_YEARS) / span;
  const pct = MAX_CREDIBILITY_ADJUSTMENT_PCT * (1 - frac);
  return r2(Math.max(0, Math.min(MAX_CREDIBILITY_ADJUSTMENT_PCT, pct)));
}

export function compute(pp) {
  pp = pp || {};

  const market = ['individual', 'small_group', 'large_group'].includes(pp.market) ? pp.market : 'individual';
  const reportingYear = safeNum(pp.reporting_year, 0);
  const earnedPremium = safeNum(pp.earned_premium, 0);
  const federalTaxesFees = safeNum(pp.federal_taxes_fees, 0);
  const stateTaxesFees = safeNum(pp.state_taxes_fees, 0);
  const incurredClaims = safeNum(pp.incurred_claims, 0);
  const qualityImprovementExpenditures = safeNum(pp.quality_improvement_expenditures, 0);
  const reinsuranceRecoveries = safeNum(pp.reinsurance_recoveries, 0);
  const riskAdjustmentNet = safeNum(pp.risk_adjustment_net, 0);
  const riskCorridorsNet = safeNum(pp.risk_corridors_net, 0);
  const memberLifeYears = safeNum(pp.member_life_years, 0);
  const priorYear1AdjustedMlrPct = safeNum(pp.prior_year_1_adjusted_mlr_pct, null);
  const priorYear1EarnedPremium = safeNum(pp.prior_year_1_earned_premium, 0);
  const priorYear2AdjustedMlrPct = safeNum(pp.prior_year_2_adjusted_mlr_pct, null);
  const priorYear2EarnedPremium = safeNum(pp.prior_year_2_earned_premium, 0);

  const compliance_flags = [];

  const adjustedIncurredClaims = r2(incurredClaims + qualityImprovementExpenditures - reinsuranceRecoveries + riskAdjustmentNet + riskCorridorsNet);
  const adjustedEarnedPremium = r2(earnedPremium - federalTaxesFees - stateTaxesFees);
  const zeroPremium = adjustedEarnedPremium <= 0;

  let rawMlrPct = 0;
  if (zeroPremium) {
    compliance_flags.push('MLR_ZERO_PREMIUM');
  } else {
    rawMlrPct = r2((adjustedIncurredClaims / adjustedEarnedPremium) * 100);
  }

  const credibilityTier = zeroPremium ? 'indeterminate' : creditbilityTier(memberLifeYears);
  const credibilityAdjustmentPct = credibilityTier === 'partially_credible' ? creditbilityAdjustmentPct(credibilityTier, memberLifeYears) : 0;

  const thresholdPct = THRESHOLD_PCT[market];

  let currentYearAdjustedMlrPct = null;
  let threeYrAverageMlrPct = null;
  let yearsIncludedInAverage = 0;
  let rebateOwed = false;
  let rebatePctPoints = 0;
  let rebateAmount = 0;
  let deMinimis = false;

  if (zeroPremium) {
    // no computable MLR -- nothing further to derive.
  } else if (credibilityTier === 'non_credible') {
    compliance_flags.push('MLR_NON_CREDIBLE_DEFAULT_COMPLIANT');
  } else {
    currentYearAdjustedMlrPct = r2(rawMlrPct + credibilityAdjustmentPct);

    let weightedSum = currentYearAdjustedMlrPct * adjustedEarnedPremium;
    let weightSum = adjustedEarnedPremium;
    yearsIncludedInAverage = 1;

    if (priorYear1AdjustedMlrPct !== null && priorYear1EarnedPremium > 0) {
      weightedSum += priorYear1AdjustedMlrPct * priorYear1EarnedPremium;
      weightSum += priorYear1EarnedPremium;
      yearsIncludedInAverage += 1;
    }
    if (priorYear2AdjustedMlrPct !== null && priorYear2EarnedPremium > 0) {
      weightedSum += priorYear2AdjustedMlrPct * priorYear2EarnedPremium;
      weightSum += priorYear2EarnedPremium;
      yearsIncludedInAverage += 1;
    }

    threeYrAverageMlrPct = weightSum > 0 ? r2(weightedSum / weightSum) : currentYearAdjustedMlrPct;

    if (threeYrAverageMlrPct < thresholdPct) {
      rebatePctPoints = r2(thresholdPct - threeYrAverageMlrPct);
      rebateAmount = r2((rebatePctPoints / 100) * adjustedEarnedPremium);
      rebateOwed = rebateAmount > 0;
    }

    if (rebateOwed) {
      compliance_flags.push('MLR_BELOW_THRESHOLD_REBATE_OWED');
      const perEnrollee = memberLifeYears > 0 ? rebateAmount / memberLifeYears : rebateAmount;
      const deMinThreshold = DE_MINIMIS_USD[market];
      if (perEnrollee < deMinThreshold) {
        deMinimis = true;
        compliance_flags.push('MLR_DE_MINIMIS_NO_PAYMENT');
      }
    }
  }

  const output_payload = {
    market,
    reporting_year: reportingYear,
    constants_version: String(reportingYear || 'unspecified'),
    adjusted_incurred_claims: adjustedIncurredClaims,
    adjusted_earned_premium: adjustedEarnedPremium,
    raw_mlr_pct: rawMlrPct,
    member_life_years: memberLifeYears,
    credibility_tier: credibilityTier,
    credibility_adjustment_pct_points: credibilityAdjustmentPct,
    current_year_adjusted_mlr_pct: currentYearAdjustedMlrPct,
    three_yr_average_mlr_pct: threeYrAverageMlrPct,
    years_included_in_average: yearsIncludedInAverage,
    threshold_pct: thresholdPct,
    rebate_owed: rebateOwed,
    rebate_pct_points: rebatePctPoints,
    rebate_amount: rebateAmount,
    de_minimis: deMinimis,
    regulatory_basis: '45 CFR 158 (ACA Medical Loss Ratio rule): numerator/denominator 158.140-158.162, credibility adjustment 158.230-158.232, 3-year averaging 158.221, rebate calculation 158.240, de minimis 158.243.',
    note: 'Credibility-adjustment table is a REPRESENTATIVE linear taper, not the exact CMS deductible-banded schedule -- confirm the precise add-on against the current CMS MLR credibility-adjustment table before filing. De minimis check approximates per-enrollee rebate using member_life_years as the enrollee-count proxy.',
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
