import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-172-ai-risk-impact-assessment-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_ai_impact_assessment',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ISO 42005-style AI impact-assessment completeness check across 7 fields.
// Returns completeness_score (0–100), gaps list, and compliance_flags.
// Zero network; all computation is deterministic and finite.
export function compute(pp) {
  const { assessment = {} } = pp;

  // 1. intended_use — non-empty string
  const check_intended_use =
    typeof assessment.intended_use === 'string' && assessment.intended_use.trim().length > 0;

  // 2. affected_stakeholders — array with at least 1 item
  const check_affected_stakeholders =
    Array.isArray(assessment.affected_stakeholders) &&
    assessment.affected_stakeholders.length >= 1;

  // 3. risk_treatment_defined — boolean true
  const check_risk_treatment_defined = assessment.risk_treatment_defined === true;

  // 4. monitoring_plan — non-empty string
  const check_monitoring_plan =
    typeof assessment.monitoring_plan === 'string' && assessment.monitoring_plan.trim().length > 0;

  // 5. approval_documented — boolean true
  const check_approval_documented = assessment.approval_documented === true;

  // 6. risk_categories — array with at least 1 item
  const check_risk_categories =
    Array.isArray(assessment.risk_categories) && assessment.risk_categories.length >= 1;

  // 7. data_sources_listed — boolean true
  const check_data_sources_listed = assessment.data_sources_listed === true;

  const CHECKS = {
    intended_use: check_intended_use,
    affected_stakeholders: check_affected_stakeholders,
    risk_treatment_defined: check_risk_treatment_defined,
    monitoring_plan: check_monitoring_plan,
    approval_documented: check_approval_documented,
    risk_categories: check_risk_categories,
    data_sources_listed: check_data_sources_listed,
  };

  const fields_checked = 7;
  const fields_passed = Object.values(CHECKS).filter(Boolean).length;
  const raw_score = fields_passed / fields_checked * 100;
  const completeness_score = Number.isFinite(raw_score) ? Math.round(raw_score) : 0;
  const complete = fields_passed === fields_checked;
  const gaps = Object.entries(CHECKS)
    .filter(([, pass]) => !pass)
    .map(([field]) => field);

  const compliance_flags = { AI_IMPACT_ASSESSED: true };
  if (complete) {
    compliance_flags.AI_IMPACT_ASSESSMENT_COMPLETE = true;
  } else {
    compliance_flags.AI_IMPACT_ASSESSMENT_INCOMPLETE = true;
  }

  return {
    output_payload: { complete, completeness_score, fields_checked, fields_passed, gaps },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
