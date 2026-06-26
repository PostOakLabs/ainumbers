import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-142-nis2-art21-gap-checker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_nis2_art21_measures',
  mandate_type: 'compliance_mandate', gpu: false,
};

// NIS2 Art. 21(2)(a)-(j): ten mandatory cybersecurity risk-management measures.
const MEASURE_IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

export function compute(pp) {
  const { measures = [] } = pp;
  const arr = Array.isArray(measures) ? measures : [];
  let total_score = 0;
  const measures_summary = [];
  const critical_gaps = [];

  MEASURE_IDS.forEach(id => {
    const m = arr.find(x => x && x.measure_id === id) || {};
    const implemented = m.implemented === true;
    const documented = m.documented === true;
    const tested = typeof m.last_tested_date === 'string' && m.last_tested_date.length > 0;
    // Maturity: 0=absent, 1=documented-only, 2=implemented, 3=implemented+tested
    const maturity = (implemented && tested) ? 3 : implemented ? 2 : documented ? 1 : 0;
    total_score += maturity;
    measures_summary.push({ measure_id: id, maturity });
    if (maturity === 0) critical_gaps.push(id);
  });

  const max_score = MEASURE_IDS.length * 3; // 30
  const compliance_score = Math.round((total_score / max_score) * 100);
  const grade_thresholds = [[90, 'A'], [75, 'B'], [60, 'C'], [40, 'D']];
  const entry = grade_thresholds.find(([t]) => compliance_score >= t);
  const overall_grade = entry ? entry[1] : 'F';
  const remediation_priority = measures_summary
    .filter(m => m.maturity < 2)
    .sort((a, b) => a.maturity - b.maturity)
    .map(m => m.measure_id);

  const compliance_flags = { NIS2_ART21_ASSESSED: true };
  compliance_flags[compliance_score >= 60 ? 'NIS2_ART21_PASSING' : 'NIS2_ART21_GAPS_IDENTIFIED'] = true;
  if (critical_gaps.length > 0) compliance_flags.NIS2_ART21_CRITICAL_GAPS = true;

  return {
    output_payload: { compliance_score, overall_grade, measures_summary, critical_gaps, remediation_priority },
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
