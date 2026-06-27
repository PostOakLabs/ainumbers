import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-176-ai-governance-readiness-diagnostic';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'run_ai_governance_fit',
  mandate_type: 'compliance_mandate', gpu: false,
};

// A–F AI governance readiness diagnostic across six dimensions covering
// ISO 42001 + NIST AI RMF + EU AI Act convergence. Terminal node of the
// ai-governance-iso42001-conformance chain. Returns grade, readiness_score
// (0–100), gap list, and frameworks_addressed breakdown. Zero network.
export function compute(pp) {
  const { entity = {} } = pp;

  const DIMENSIONS = [
    'aims_documented',
    'impact_assessed',
    'nist_rmf_mapped',
    'gpai_obligations_checked',
    'monitoring_plan_active',
    'review_cycle_defined',
  ];

  const dim = {
    aims_documented:          entity.aims_documented === true,
    impact_assessed:          entity.impact_assessed === true,
    nist_rmf_mapped:          entity.nist_rmf_mapped === true,
    gpai_obligations_checked: entity.gpai_obligations_checked === true,
    monitoring_plan_active:   entity.monitoring_plan_active === true,
    review_cycle_defined:     entity.review_cycle_defined === true,
  };

  const dims_met = DIMENSIONS.filter((d) => dim[d]).length;
  const readiness_score = Number.isFinite(dims_met) ? Math.round(dims_met / 6 * 100) : 0;
  const gaps = DIMENSIONS.filter((d) => !dim[d]);

  // A–F grade: index 0–6 → ['F','F','E','D','C','B','A']
  const GRADES = ['F', 'F', 'E', 'D', 'C', 'B', 'A'];
  const readiness_grade = GRADES[dims_met] ?? 'F';

  const frameworks_addressed = {
    iso_42001: dim.aims_documented && dim.impact_assessed,
    nist_rmf:  dim.nist_rmf_mapped,
    eu_ai_act: dim.gpai_obligations_checked,
  };

  const compliance_flags = { AI_GOVERNANCE_READINESS_ASSESSED: true };
  if (dims_met === 6)          compliance_flags.AI_GOVERNANCE_FULLY_READY = true;
  else if (readiness_score >= 67) compliance_flags.AI_GOVERNANCE_SUBSTANTIALLY_READY = true;
  else if (readiness_score >= 33) compliance_flags.AI_GOVERNANCE_PARTIALLY_READY = true;
  else                            compliance_flags.AI_GOVERNANCE_NOT_READY = true;

  return {
    output_payload: {
      readiness_grade,
      readiness_score,
      fully_ready: dims_met === 6,
      dimensions_met: dims_met,
      dimensions_total: 6,
      gaps,
      frameworks_addressed,
    },
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
