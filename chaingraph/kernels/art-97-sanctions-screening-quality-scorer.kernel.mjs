/**
 * art-97-sanctions-screening-quality-scorer.kernel.mjs
 * Wave 19 — Sanctions Screening-Program Quality Scorer.
 * Wolfsberg-aligned engine-quality scorecard: list coverage + match calibration
 * + alert tuning + escalation workflow → overall program conformance grade.
 *
 * Citations (verify before citing):
 *   Wolfsberg Sanctions Screening Guidance 2019 — screening-quality dimensions.
 *   FATF Recommendation 6 (targeted financial sanctions) + interpretive notes.
 *   UK OFSI Financial Sanctions Guidance (verify current at gov.uk).
 *   US OFAC Framework for OFAC Compliance Commitments (2019, verify current).
 *   EDUCATIONAL: outputs are decision-support drafts.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-97-sanctions-screening-quality-scorer';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'score_sanctions_screening_quality',
  mandate_type: 'model_governance',
  gpu:          false,
};

// Grade conversion for letter inputs
const GRADE_NUM = { A: 100, B: 80, C: 60, D: 40, F: 20 };

function gradeToNum(g) { return GRADE_NUM[g?.toUpperCase()] ?? 0; }
function numToGrade(n) {
  if (n >= 88) return 'A';
  if (n >= 72) return 'B';
  if (n >= 56) return 'C';
  if (n >= 40) return 'D';
  return 'F';
}

// Wolfsberg-aligned weights (verify current guidance)
const COMPONENT_WEIGHTS = {
  list_coverage:       25,  // Coverage of required lists
  match_calibration:   25,  // FPR/recall calibration
  alert_tuning:        20,  // Alert generation and tuning
  escalation_workflow: 15,  // Alert review + escalation SLA
  model_validation:    15,  // Independent model validation
};

const MAX_SCORE = Object.values(COMPONENT_WEIGHTS).reduce((a, b) => a + b, 0);

export function compute(pp) {
  const {
    inputs = {},
  } = pp;

  const {
    list_coverage_grade  = 'F',   // from ART-92
    calibration_grade    = 'F',   // from ART-93
    alert_tuning         = 'loose',  // tight | calibrated | loose
    escalation_workflow  = 'none',   // defined | partial | none
    model_validation     = 'no',     // yes | partial | no
  } = inputs;

  // Component scores (0–100 per component)
  const list_score  = gradeToNum(list_coverage_grade);
  const calib_score = gradeToNum(calibration_grade);

  const alert_score =
    alert_tuning === 'tight'       ? 90 :
    alert_tuning === 'calibrated'  ? 75 :
    alert_tuning === 'loose'       ? 30 : 0;

  const escal_score =
    escalation_workflow === 'defined' ? 90 :
    escalation_workflow === 'partial' ? 50 : 0;

  const valid_score =
    model_validation === 'yes'     ? 90 :
    model_validation === 'partial' ? 50 : 0;

  // Weighted composite
  const composite =
    (list_score  * COMPONENT_WEIGHTS.list_coverage     / 100) +
    (calib_score * COMPONENT_WEIGHTS.match_calibration  / 100) +
    (alert_score * COMPONENT_WEIGHTS.alert_tuning       / 100) +
    (escal_score * COMPONENT_WEIGHTS.escalation_workflow / 100) +
    (valid_score * COMPONENT_WEIGHTS.model_validation   / 100);

  const composite_pct = Math.round((composite / MAX_SCORE) * 100);
  const program_grade = numToGrade(composite_pct);

  // Improvement priorities (worst first)
  const scores = [
    { dimension: 'list_coverage',        score: list_score,  weight: COMPONENT_WEIGHTS.list_coverage },
    { dimension: 'match_calibration',    score: calib_score, weight: COMPONENT_WEIGHTS.match_calibration },
    { dimension: 'alert_tuning',         score: alert_score, weight: COMPONENT_WEIGHTS.alert_tuning },
    { dimension: 'escalation_workflow',  score: escal_score, weight: COMPONENT_WEIGHTS.escalation_workflow },
    { dimension: 'model_validation',     score: valid_score, weight: COMPONENT_WEIGHTS.model_validation },
  ];
  const improvement_priorities = scores
    .filter(s => s.score < 75)
    .sort((a, b) => (a.score * a.weight) - (b.score * b.weight))
    .map(s => ({
      dimension:   s.dimension,
      current_score: s.score,
      action:
        s.dimension === 'list_coverage'       ? 'Run sanc-list-coverage chain — remediate missing lists and nexus gaps' :
        s.dimension === 'match_calibration'   ? 'Run sanc-fuzzy-calibration chain — calibrate threshold to minimise false negatives' :
        s.dimension === 'alert_tuning'        ? 'Review alert generation rules — calibrate suppression rules to reduce false positives without reducing recall' :
        s.dimension === 'escalation_workflow' ? 'Define and document alert review SLA and escalation path' :
        'Commission independent model validation of the screening engine',
    }));

  const compliance_flags = [];
  if (program_grade === 'D' || program_grade === 'F')
    compliance_flags.push('PROGRAM_BELOW_STANDARD');
  if (model_validation === 'no')
    compliance_flags.push('NO_MODEL_VALIDATION');

  const output_payload = {
    program_grade,
    composite_pct,
    component_scores: {
      list_coverage:       list_score,
      match_calibration:   calib_score,
      alert_tuning:        alert_score,
      escalation_workflow: escal_score,
      model_validation:    valid_score,
    },
    component_weights: COMPONENT_WEIGHTS,
    improvement_priorities,
    wolfsberg_note: 'Wolfsberg Sanctions Screening Guidance (2019) sets benchmarks across list coverage, match quality, alert management, and governance. Verify current guidance version.',
    reference_version: '2026-06',
    note: 'DECISION-SUPPORT DRAFT. Program grades reflect inputs only — comprehensive assessment requires examination of underlying evidence. Verify Wolfsberg/FATF/OFAC/OFSI guidance for current expectations.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    compute_mode:       'server',
    mandate_type:       meta.mandate_type,
    tool_id:            TOOL_ID,
    tool_version:       TOOL_VERSION,
    generated_at:       now ?? null,
    execution_hash:     hash,
    chain:              { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:  pp,
    output_payload,
    compliance_flags,
    audit_signature:    { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
