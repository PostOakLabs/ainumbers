import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-174-nist-ai-rmf-function-mapper';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'map_nist_ai_rmf_functions',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Maps supplied controls/evidence booleans to the four NIST AI RMF core
// functions: GOVERN, MAP, MEASURE, MANAGE. Computes per-function coverage
// score (0–100) and gaps, then derives an overall coverage band and
// compliance flags. Zero network. No PII.
export function compute(pp) {
  const { evidence = {} } = pp;

  // --- Field definitions per function ---
  const FUNCTIONS = {
    GOVERN: ['govern_policy', 'govern_roles', 'govern_culture', 'govern_transparency', 'govern_accountability'],
    MAP:     ['map_context', 'map_categorization', 'map_risk_identification', 'map_stakeholders'],
    MEASURE: ['measure_analysis', 'measure_monitoring', 'measure_testing', 'measure_benchmarking'],
    MANAGE:  ['manage_response', 'manage_prioritization', 'manage_treatment', 'manage_residual_risk'],
  };

  // --- Compute per-function coverage ---
  const function_coverage = {};
  let score_sum = 0;

  for (const [fn, fields] of Object.entries(FUNCTIONS)) {
    const total = fields.length;
    const present_fields = fields.filter((f) => evidence[f] === true);
    const present = present_fields.length;
    const gaps = fields.filter((f) => evidence[f] !== true);
    // NaN guard: total is always >= 1 here, but guard defensively
    const raw_score = total > 0 ? (present / total) * 100 : 0;
    const score = Number.isFinite(raw_score) ? Math.round(raw_score) : 0;
    function_coverage[fn] = { score, gaps, total, present };
    score_sum += score;
  }

  // --- Overall coverage (average of four function scores) ---
  const fn_count = Object.keys(FUNCTIONS).length; // 4
  const raw_overall = fn_count > 0 ? score_sum / fn_count : 0;
  const overall_coverage = Number.isFinite(raw_overall) ? Math.round(raw_overall) : 0;

  // --- Coverage band ---
  let coverage_band;
  if (overall_coverage < 25)       coverage_band = 'Minimal';
  else if (overall_coverage < 50)  coverage_band = 'Partial';
  else if (overall_coverage < 75)  coverage_band = 'Substantial';
  else                             coverage_band = 'Comprehensive';

  // --- Flat gap list ---
  const all_gaps = Object.values(function_coverage).flatMap((fc) => fc.gaps);

  // --- Compliance flags ---
  // Note: overall_coverage is numeric (%) and already exposed via output_payload below;
  // compliance_flags is schema-typed as string[].
  const compliance_flags = ['NIST_RMF_MAPPED'];
  if (overall_coverage >= 75) {
    compliance_flags.push('NIST_RMF_SUBSTANTIAL');
  } else {
    compliance_flags.push('NIST_RMF_GAP_IDENTIFIED');
  }

  const total_controls = 17;
  const controls_present = total_controls - all_gaps.length;

  return {
    output_payload: {
      overall_coverage,
      coverage_band,
      function_coverage,
      all_gaps,
      total_controls,
      controls_present,
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
