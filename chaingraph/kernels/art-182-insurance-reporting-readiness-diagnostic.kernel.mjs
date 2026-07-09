import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-182-insurance-reporting-readiness-diagnostic';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'run_insurance_reporting_fit',
  mandate_type: 'compliance_mandate', gpu: false,
};

// A–F insurance reporting readiness diagnostic across six dimensions:
// IFRS 17 measurement model, CSM system, risk-adjustment disclosure,
// SII Pillar-3 QRT reporting, SII↔IFRS 17 reconciliation, ICS assessment.
// Terminal node of solvency-ii-reconciliation-and-capital chain. Zero network, zero PII.
export function compute(pp) {
  const { entity = {} } = pp;

  const DIMENSIONS = [
    'ifrs17_measurement_model_elected',
    'csm_system_implemented',
    'risk_adjustment_disclosed',
    'sii_qrt_reporting_complete',
    'sii_ifrs17_reconciliation_done',
    'ics_assessed',
  ];

  const dim = {
    ifrs17_measurement_model_elected: entity.ifrs17_measurement_model_elected === true,
    csm_system_implemented:           entity.csm_system_implemented === true,
    risk_adjustment_disclosed:        entity.risk_adjustment_disclosed === true,
    sii_qrt_reporting_complete:       entity.sii_qrt_reporting_complete === true,
    sii_ifrs17_reconciliation_done:   entity.sii_ifrs17_reconciliation_done === true,
    ics_assessed:                     entity.ics_assessed === true,
  };

  const dims_met = DIMENSIONS.filter((d) => dim[d]).length;
  const readiness_score = Number.isFinite(dims_met) ? Math.round((dims_met / 6) * 100) : 0;
  const gaps = DIMENSIONS.filter((d) => !dim[d]);

  // Grade mapping: index 0–6 → ['F','F','E','D','C','B','A']
  const GRADES = ['F', 'F', 'E', 'D', 'C', 'B', 'A'];
  const readiness_grade = GRADES[dims_met] ?? 'F';

  const compliance_flags = [];
  compliance_flags.push('INSURANCE_REPORTING_READINESS_ASSESSED');
  if (dims_met === 6)              compliance_flags.push('INSURANCE_REPORTING_FULLY_READY');
  else if (readiness_score >= 67)  compliance_flags.push('INSURANCE_REPORTING_SUBSTANTIALLY_READY');
  else if (readiness_score >= 33)  compliance_flags.push('INSURANCE_REPORTING_PARTIALLY_READY');
  else                             compliance_flags.push('INSURANCE_REPORTING_NOT_READY');

  return {
    output_payload: {
      readiness_grade,
      readiness_score,
      fully_ready: dims_met === 6,
      dimensions_met: dims_met,
      dimensions_total: 6,
      gaps,
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
