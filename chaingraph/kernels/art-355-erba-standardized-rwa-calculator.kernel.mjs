import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-355-erba-standardized-rwa-calculator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_rwa_erba_2026',
  mandate_type: 'capital_assessment', gpu: false,
};

// Credit-risk expanded risk-based approach (ERBA) / standardized-approach RWA per the
// 2026 Basel Endgame reproposal (BCBS/US NPR, reproposed 2026-03-19, comments closed
// 2026-06-18, final expected ~Q4 2026). Versioned-constants delta on two rule_sets --
// '2023' (the original, stricter US NPR) and '2026' (the reproposed, relief-oriented
// text) -- so a caller can run the SAME exposure book through both and see the delta
// (feeds BT-3 compare_basel_2023_vs_2026). rule_status stays 'proposed' until the rule
// finalizes; re-pin WU pre-authorized at finalization. BASEL-TAKE2-BUILD-SPEC.md §BT-1.
// Constants are an illustrative approximation of the published bucket structure, NOT a
// verbatim regulatory-text transcription -- verify against the final rule at finalization.

const RULE_STATUS = 'proposed';

const RULE_SETS = {
  // Original 2023 US Basel III Endgame NPR: coarser residential-RE bands, no external-
  // ratings recognition (ECRA barred by Dodd-Frank §939A), flat unrated-corporate
  // treatment, zero CCF on unconditionally-cancellable commitments.
  '2023': {
    label: 'Basel III Endgame -- original 2023 US NPR',
    rre_ltv_bands: [
      { max_ltv: 50, risk_weight: 35 },
      { max_ltv: 60, risk_weight: 40 },
      { max_ltv: 80, risk_weight: 45 },
      { max_ltv: 90, risk_weight: 60 },
      { max_ltv: 100, risk_weight: 75 },
      { max_ltv: Infinity, risk_weight: 90 },
    ],
    retail_risk_weight: { qrre_transactor: 75, qrre_revolver: 75, other_retail: 75 },
    corporate_risk_weight: { unrated: 100, investment_grade_unrated: 100 },
    corporate_ecra_by_rating: null, // SCRA-only regime; external ratings not recognised
    sme_support_factor: 1.0,
    ccf: { under_1y: 20, over_1y: 50, direct_credit_substitute: 100, note_issuance_uw: 50, unconditionally_cancellable: 0 },
  },
  // 2026 reproposal: expanded residential-RE granularity, QRRE transactor relief,
  // ECRA external-ratings recognition restored for corporates, SME support factor,
  // and the notable UCC CCF increase 0%->10% (a relief-reversal item within the
  // broader net-relief headline).
  '2026': {
    label: 'Basel III Endgame -- 2026 reproposal (BCBS/US NPR, comments closed 2026-06-18)',
    rre_ltv_bands: [
      { max_ltv: 50, risk_weight: 20 },
      { max_ltv: 60, risk_weight: 25 },
      { max_ltv: 80, risk_weight: 30 },
      { max_ltv: 90, risk_weight: 40 },
      { max_ltv: 100, risk_weight: 50 },
      { max_ltv: Infinity, risk_weight: 70 },
    ],
    retail_risk_weight: { qrre_transactor: 45, qrre_revolver: 75, other_retail: 75 },
    corporate_risk_weight: { unrated: 100, investment_grade_unrated: 65 },
    corporate_ecra_by_rating: { AAA: 20, AA: 20, A: 50, BBB: 75, BB: 100, B: 100, CCC: 150 },
    sme_support_factor: 0.85,
    ccf: { under_1y: 20, over_1y: 50, direct_credit_substitute: 100, note_issuance_uw: 50, unconditionally_cancellable: 10 },
  },
};

const CONSTANTS_VERSION = 'BASEL-TAKE2-ERBA-2026-07-17-V1';
const TABLE_SOURCE = 'Illustrative approximation of BCBS/US Basel III Endgame reproposal (2026-03-19) standardized/ERBA risk-weight bucket structure, contrasted against the original 2023 US NPR. NOT a verbatim regulatory-text transcription -- verify against the final published rule (~Q4 2026).';

function finiteNum(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function rreRiskWeight(rules, ltv) {
  const bands = rules.rre_ltv_bands;
  for (const b of bands) if (ltv <= b.max_ltv) return b.risk_weight;
  return bands[bands.length - 1].risk_weight;
}

function corporateRiskWeight(rules, exp) {
  const rating = typeof exp.external_rating === 'string' ? exp.external_rating.toUpperCase() : '';
  if (rules.corporate_ecra_by_rating && rating && rules.corporate_ecra_by_rating[rating] != null) {
    return { risk_weight: rules.corporate_ecra_by_rating[rating], basis: 'ecra_external_rating' };
  }
  if (exp.investment_grade_unrated === true) {
    return { risk_weight: rules.corporate_risk_weight.investment_grade_unrated, basis: 'scra_investment_grade_unrated' };
  }
  return { risk_weight: rules.corporate_risk_weight.unrated, basis: 'scra_unrated' };
}

function ccfPercent(rules, commitmentType) {
  const key = typeof commitmentType === 'string' ? commitmentType : '';
  if (Object.prototype.hasOwnProperty.call(rules.ccf, key)) return rules.ccf[key];
  return rules.ccf.direct_credit_substitute; // most conservative fallback
}

function computeExposure(rules, exp) {
  const amount = Math.max(0, finiteNum(exp.exposure_amount, 0));
  const category = typeof exp.category === 'string' ? exp.category : 'corporate';
  const isSme = exp.sme === true;

  let risk_weight;
  let basis;
  let credit_equivalent_amount = amount;

  if (category === 'residential_re') {
    const ltv = Math.max(0, finiteNum(exp.ltv, 100));
    risk_weight = rreRiskWeight(rules, ltv);
    basis = 'residential_re_ltv_band';
  } else if (category === 'retail_qrre_transactor') {
    risk_weight = rules.retail_risk_weight.qrre_transactor; basis = 'qrre_transactor';
  } else if (category === 'retail_qrre_revolver') {
    risk_weight = rules.retail_risk_weight.qrre_revolver; basis = 'qrre_revolver';
  } else if (category === 'retail_other') {
    risk_weight = rules.retail_risk_weight.other_retail; basis = 'other_retail';
  } else if (category === 'off_balance') {
    const ccf = ccfPercent(rules, exp.commitment_type);
    credit_equivalent_amount = amount * (ccf / 100);
    const under = corporateRiskWeight(rules, exp);
    risk_weight = under.risk_weight;
    basis = 'off_balance_ccf_' + (exp.commitment_type || 'direct_credit_substitute') + '_then_' + under.basis;
  } else {
    const rated = corporateRiskWeight(rules, exp);
    risk_weight = rated.risk_weight; basis = rated.basis;
  }

  const sme_support_factor = isSme ? rules.sme_support_factor : 1.0;
  const effective_risk_weight = risk_weight * sme_support_factor;
  const rwa = credit_equivalent_amount * (effective_risk_weight / 100);

  return {
    id: exp.id ?? null,
    category,
    exposure_amount: amount,
    credit_equivalent_amount,
    risk_weight,
    sme_support_factor,
    effective_risk_weight,
    basis,
    rwa,
  };
}

export function compute(pp) {
  pp = pp || {};
  const ruleSetKey = RULE_SETS[pp.rule_set] ? pp.rule_set : '2026';
  const rules = RULE_SETS[ruleSetKey];
  const exposures = Array.isArray(pp.exposures) ? pp.exposures : [];

  const per_exposure = exposures.map((exp) => computeExposure(rules, exp));
  const total_exposure_amount = per_exposure.reduce((s, e) => s + e.exposure_amount, 0);
  const aggregate_rwa = per_exposure.reduce((s, e) => s + e.rwa, 0);
  const average_risk_weight = total_exposure_amount > 0 ? (aggregate_rwa / total_exposure_amount) * 100 : 0;

  const output_payload = {
    rule_set: ruleSetKey,
    rule_status: RULE_STATUS,
    rule_set_label: rules.label,
    per_exposure,
    total_exposure_amount,
    aggregate_rwa,
    average_risk_weight,
    exposure_count: per_exposure.length,
    constants_version: CONSTANTS_VERSION,
    table_source: TABLE_SOURCE,
    disambiguation: 'compute_rwa_erba_2026 computes per-exposure standardized/ERBA risk weights and aggregate RWA under a chosen Basel Endgame rule_set (2023 original NPR or 2026 reproposal). It does NOT run scenario replay (see sim-03-basel-rwa-scenario-modeler) and does NOT compare rule sets in one call (see compare_basel_2023_vs_2026, BT-3) -- run twice with different rule_set values for a delta.',
  };

  const compliance_flags = [ruleStatusFlag(RULE_STATUS)];
  if (ruleSetKey === '2026') compliance_flags.push('BASEL_2026_REPROPOSAL_NOT_YET_FINAL');

  return { output_payload, compliance_flags };
}

function ruleStatusFlag(status) {
  return status === 'proposed' ? 'RULE_STATUS_PROPOSED_NOT_FINAL' : 'RULE_STATUS_FINAL';
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
