import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-171-iso42001-aims-clause-conformance';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'assess_iso42001_aims_conformance',
  mandate_type: 'compliance_mandate', gpu: false,
};

function fieldWeight(val) {
  if (val === true) return 1.0;
  if (typeof val === 'string' && val === 'partial') return 0.5;
  return 0.0;
}

function fieldStatus(val) {
  if (val === true) return 'present';
  if (typeof val === 'string' && val === 'partial') return 'partial';
  return 'absent';
}

function safeInt(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

export function compute(pp) {
  const aims = (pp && typeof pp.aims === 'object' && pp.aims !== null) ? pp.aims : {};

  const clauseFields = [
    'clause_4_context',
    'clause_5_leadership',
    'clause_6_planning',
    'clause_7_support',
    'clause_8_operation',
    'clause_9_evaluation',
    'clause_10_improvement',
  ];

  const controlFields = [
    'annex_a_ai_policy',
    'annex_a_roles',
    'annex_a_impact_assessment',
    'annex_a_data_governance',
    'annex_a_system_lifecycle',
    'annex_a_third_party',
  ];

  const total_clauses = 7;
  const total_controls = 6;

  let clauseWeightSum = 0;
  let clauses_fully_present = 0;
  const gaps = [];

  for (const field of clauseFields) {
    const val = aims[field];
    const w = fieldWeight(val);
    const status = fieldStatus(val);
    clauseWeightSum += w;
    if (status === 'present') {
      clauses_fully_present += 1;
    } else {
      gaps.push({ field, status });
    }
  }

  let controlWeightSum = 0;
  let controls_fully_present = 0;

  for (const field of controlFields) {
    const val = aims[field];
    const w = fieldWeight(val);
    const status = fieldStatus(val);
    controlWeightSum += w;
    if (status === 'present') {
      controls_fully_present += 1;
    } else {
      gaps.push({ field, status });
    }
  }

  const clauseScoreRaw = Number.isFinite(clauseWeightSum) ? (clauseWeightSum / total_clauses) * 100 : 0;
  const controlScoreRaw = Number.isFinite(controlWeightSum) ? (controlWeightSum / total_controls) * 100 : 0;

  const clause_score = Math.min(100, Math.max(0, safeInt(clauseScoreRaw)));
  const control_score = Math.min(100, Math.max(0, safeInt(controlScoreRaw)));

  const overallRaw = (clause_score + control_score) / 2;
  const overall_maturity = Math.min(100, Math.max(0, Number.isFinite(overallRaw) ? Math.round(overallRaw) : 0));

  let maturity_band;
  if (overall_maturity < 25) maturity_band = 'Initial';
  else if (overall_maturity < 50) maturity_band = 'Developing';
  else if (overall_maturity < 75) maturity_band = 'Defined';
  else if (overall_maturity < 90) maturity_band = 'Managed';
  else maturity_band = 'Optimizing';

  const compliance_flags = {
    AIMS_ASSESSED: true,
    AIMS_CLAUSE_COVERAGE_PCT: clause_score,
    AIMS_CONTROL_COVERAGE_PCT: control_score,
  };

  if (overall_maturity >= 75) {
    compliance_flags.AIMS_CONFORMANT = true;
  } else {
    compliance_flags.AIMS_GAP_IDENTIFIED = true;
  }

  const output_payload = {
    overall_maturity,
    maturity_band,
    clause_score,
    control_score,
    clauses_fully_present,
    controls_fully_present,
    gaps,
    total_clauses,
    total_controls,
  };

  return { output_payload, compliance_flags };
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
