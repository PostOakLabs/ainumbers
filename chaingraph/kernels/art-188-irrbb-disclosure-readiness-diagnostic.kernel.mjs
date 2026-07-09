import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-188-irrbb-disclosure-readiness-diagnostic';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'run_irrbb_disclosure_fit',
  mandate_type: 'compliance_mandate', gpu: false,
};

// A-F IRRBB disclosure readiness diagnostic across five dimensions: EVE shock
// calculation performed, SOT (EVE + NII) evaluated, standardised approach
// mapped, CSRBB scope assessed, Pillar 3 IRRBB1 disclosure template ready.
// Terminal node of irrbb-measurement-and-disclosure chain. Zero network, zero PII.
export function compute(pp) {
  const { entity = {} } = pp;

  const DIMENSIONS = [
    'eve_shock_calculated',
    'sot_eve_nii_evaluated',
    'standardised_approach_mapped',
    'csrbb_scope_assessed',
    'pillar3_irrbb1_ready',
  ];

  const dim = {
    eve_shock_calculated:          entity.eve_shock_calculated === true,
    sot_eve_nii_evaluated:         entity.sot_eve_nii_evaluated === true,
    standardised_approach_mapped:  entity.standardised_approach_mapped === true,
    csrbb_scope_assessed:          entity.csrbb_scope_assessed === true,
    pillar3_irrbb1_ready:          entity.pillar3_irrbb1_ready === true,
  };

  const dims_met = DIMENSIONS.filter((d) => dim[d]).length;
  const readiness_score = Number.isFinite(dims_met) ? Math.round((dims_met / 5) * 100) : 0;
  const gaps = DIMENSIONS.filter((d) => !dim[d]);

  // Grade mapping: index 0-5 met -> ['F','F','D','C','B','A']
  const GRADES = ['F', 'F', 'D', 'C', 'B', 'A'];
  const readiness_grade = GRADES[dims_met] ?? 'F';

  const compliance_flags = [];
  compliance_flags.push('IRRBB_DISCLOSURE_READINESS_ASSESSED');
  if (dims_met === 5)              compliance_flags.push('IRRBB_DISCLOSURE_FULLY_READY');
  else if (readiness_score >= 60)  compliance_flags.push('IRRBB_DISCLOSURE_SUBSTANTIALLY_READY');
  else if (readiness_score >= 40)  compliance_flags.push('IRRBB_DISCLOSURE_PARTIALLY_READY');
  else                             compliance_flags.push('IRRBB_DISCLOSURE_NOT_READY');

  return {
    output_payload: {
      readiness_grade,
      readiness_score,
      fully_ready: dims_met === 5,
      dimensions_met: dims_met,
      dimensions_total: 5,
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
