import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-170-eudr-readiness-diagnostic';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'run_eudr_readiness_fit',
  mandate_type: 'compliance_mandate', gpu: false,
};

// A–F EUDR readiness diagnostic across six dimensions. Terminal node of the
// eudr-supply-chain-risk-and-traceability chain (art-168→169→170). Returns grade,
// readiness_score (0–100), gap list, and the dual EUDR enforcement deadlines
// (large/medium: 2026-12-30; micro/SME: 2027-06-30). Zero network.
export function compute(pp) {
  const { entity = {} } = pp;

  const DIMENSIONS = [
    'scope_mapped',
    'geolocation_data_ready',
    'dds_submission_ready',
    'risk_assessed',
    'mitigation_documented',
    'retention_system_ready',
  ];

  const dim = {
    scope_mapped: entity.scope_mapped === true,
    geolocation_data_ready: entity.geolocation_data_ready === true,
    dds_submission_ready: entity.dds_submission_ready === true,
    risk_assessed: entity.risk_assessed === true,
    mitigation_documented: entity.mitigation_documented === true,
    retention_system_ready: entity.retention_system_ready === true,
  };

  const dims_met = DIMENSIONS.filter((d) => dim[d]).length;
  const total_dims = DIMENSIONS.length;
  const readiness_score = Math.round((dims_met / total_dims) * 100);
  const gaps = DIMENSIONS.filter((d) => !dim[d]);

  // A–F grade
  const GRADES = ['F', 'F', 'E', 'D', 'C', 'B', 'A'];
  const readiness_grade = GRADES[dims_met] ?? 'F';

  const DEADLINES = [
    { date: '2026-12-30', scope: 'Large and medium operators: mandatory EUDR compliance (EUDR Art. 38)' },
    { date: '2027-06-30', scope: 'Micro-enterprises and SMEs: mandatory EUDR compliance (EUDR Art. 38(3))' },
  ];

  const compliance_flags = [];
  compliance_flags.push('EUDR_READINESS_ASSESSED');
  if (dims_met === total_dims) compliance_flags.push('EUDR_FULLY_READY');
  else if (readiness_score >= 67) compliance_flags.push('EUDR_SUBSTANTIALLY_READY');
  else if (readiness_score >= 33) compliance_flags.push('EUDR_PARTIALLY_READY');
  else compliance_flags.push('EUDR_NOT_READY');

  return {
    output_payload: {
      readiness_grade,
      readiness_score,
      fully_ready: dims_met === total_dims,
      dimensions_met: dims_met,
      dimensions_total: total_dims,
      gaps,
      enforcement_deadlines: DEADLINES,
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
