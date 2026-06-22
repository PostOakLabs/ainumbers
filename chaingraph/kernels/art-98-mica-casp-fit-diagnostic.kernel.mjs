import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-98-mica-casp-fit-diagnostic';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'run_mica_casp_fit',
  mandate_type: 'agent_guardrail_mandate',
  gpu: false,
};

export function compute(pp) {
  const {
    services = [],
    member_state = '',
    current_status = 'none',
    governance_maturity = 'weak',
    custody_segregation = 'none',
    own_funds_status = 'unknown',
    whitepaper_required = false,
    mar_arrangements = 'none',
    travel_rule_status = 'none',
  } = pp.inputs ?? pp;

  // Authorization score
  let auth_score = 0;
  if (current_status === 'authorised') auth_score = 100;
  else if (current_status === 'transitional') auth_score = 70;
  else if (current_status === 'applying') auth_score = 50;
  else auth_score = 0;

  const gov_bonus = governance_maturity === 'strong' ? 20 : governance_maturity === 'adequate' ? 10 : 0;
  auth_score = Math.min(100, auth_score + gov_bonus);

  // Own funds score
  const own_funds_score =
    own_funds_status === 'compliant' ? 100 : own_funds_status === 'unknown' ? 50 : 0;

  // Whitepaper score
  const wp_score = whitepaper_required === false ? 100 : 50;

  // MAR score
  const mar_score =
    mar_arrangements === 'in-place' ? 100 : mar_arrangements === 'partial' ? 50 : 0;

  // Travel rule score
  const tr_score =
    travel_rule_status === 'compliant' ? 100 : travel_rule_status === 'partial' ? 50 : 0;

  const composite = (auth_score + own_funds_score + wp_score + mar_score + tr_score) / 5;

  const readiness_grade =
    composite >= 88 ? 'A' :
    composite >= 72 ? 'B' :
    composite >= 56 ? 'C' :
    composite >= 40 ? 'D' : 'F';

  const gaps = [];
  if (auth_score < 75) gaps.push('Authorization status requires improvement — pursue full MiCA authorization (Title V)');
  if (own_funds_score < 75) gaps.push('Own funds status is non-compliant or unknown — quantify and remediate against Art 67 + Annex IV requirements');
  if (wp_score < 75) gaps.push('Crypto-asset white paper required — prepare and notify per Art 6-21 MiCA');
  if (mar_score < 75) gaps.push('Market-abuse arrangements incomplete — implement surveillance and reporting per Art 92 MiCA');
  if (tr_score < 75) gaps.push('Travel Rule compliance incomplete — implement TFR (Regulation (EU) 2023/1113) controls');

  const primary_recommendation =
    readiness_grade === 'A' ? 'Authorization posture is strong; conduct periodic MiCA compliance reviews.' :
    readiness_grade === 'B' ? 'Good baseline; address identified gaps before next NCA review cycle.' :
    readiness_grade === 'C' ? 'Material gaps present; prioritize authorization and own-funds remediation.' :
    readiness_grade === 'D' ? 'Significant deficiencies; engage legal counsel and NCA dialogue immediately.' :
    'Critical non-compliance; assess whether continued operation is permissible under transitional provisions.';

  const compliance_flags = [];
  if (current_status === 'transitional') compliance_flags.push('TRANSITIONAL_DEADLINE_RISK');
  if (mar_arrangements === 'none') compliance_flags.push('NO_MAR_ARRANGEMENTS');
  if (own_funds_status === 'shortfall') compliance_flags.push('OWN_FUNDS_SHORTFALL');

  const output_payload = {
    readiness_grade,
    services_count: services.length,
    dim_scores: {
      authorization: Math.round(auth_score),
      own_funds: own_funds_score,
      whitepaper: wp_score,
      mar: mar_score,
      travel_rule: tr_score,
    },
    gaps,
    primary_recommendation,
    secondary_recommendations: [],
    reference_version: '2026-06',
    note: 'DECISION-SUPPORT DRAFT. MiCA Title V (CASP) applied 30 Dec 2024. Verify all thresholds against MiCA Reg. (EU) 2023/1114.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    compute_mode: 'server',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    audit_signature: {
      payloadType: 'application/vnd.openchain.graph+json;version=0.4',
      payload: '',
      signatures: [],
    },
  };
}
