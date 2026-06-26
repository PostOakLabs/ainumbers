import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-146-nis2-governance-readiness-checker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_nis2_governance_readiness',
  mandate_type: 'compliance_mandate', gpu: false,
};

// NIS2 Art. 20: management body must approve Art. 21 measures, receive regular updates,
// and complete cybersecurity training. Personal liability for gross negligence.
// `board_review_age_days`: caller computes from last review date (avoids Date.now() in kernel).
const CONTROLS = [
  'board_approved_art21_measures',
  'board_receives_quarterly_status_updates',
  'ciso_or_equivalent_designated',
  'board_cybersecurity_training_completed',
  'training_covers_threat_landscape',
  'training_covers_incident_response',
];
const BOARD_ACTIONS = {
  board_approved_art21_measures: 'Board must formally approve all Art. 21 cybersecurity risk-management measures (Directive Art. 20(1))',
  board_receives_quarterly_status_updates: 'Establish quarterly board-level cybersecurity status reporting cadence',
  ciso_or_equivalent_designated: 'Designate a CISO or equivalent cybersecurity officer with board-level accountability',
  board_cybersecurity_training_completed: 'Schedule and complete NIS2-mandated cybersecurity training for all management-body members',
  training_covers_threat_landscape: 'Confirm training curriculum includes sector-specific threat landscape and risk context',
  training_covers_incident_response: 'Confirm training curriculum covers Art. 23 incident-reporting clocks (24h/72h/30d)',
  board_review_stale: 'Schedule overdue board cybersecurity review — last review is more than 12 months ago',
};

export function compute(pp) {
  const { board_review_age_days = null } = pp;

  const review_age = Number(board_review_age_days);
  const review_stale = !Number.isFinite(review_age) || review_age < 0 || review_age > 365;

  const gaps = [];
  let controls_met = 0;
  CONTROLS.forEach(key => {
    if (pp[key] === true) controls_met++;
    else gaps.push(key);
  });
  if (review_stale) gaps.push('board_review_stale');

  const board_action_items = gaps.map(g => BOARD_ACTIONS[g] || `Address gap: ${g}`);
  const grade = controls_met >= 6 ? 'A' : controls_met >= 5 ? 'B' : controls_met >= 3 ? 'C' : 'D';

  // Personal liability: board has not approved Art. 21 OR review is overdue
  const personal_liability_risk = pp.board_approved_art21_measures !== true || review_stale;

  const compliance_flags = { NIS2_GOVERNANCE_ASSESSED: true };
  compliance_flags[`NIS2_GOVERNANCE_GRADE_${grade}`] = true;
  if (personal_liability_risk) compliance_flags.NIS2_PERSONAL_LIABILITY_RISK = true;
  if (gaps.length === 0) compliance_flags.NIS2_GOVERNANCE_READY = true;

  return {
    output_payload: {
      governance_grade: grade, controls_met, total_controls: CONTROLS.length,
      gaps, board_action_items, personal_liability_risk,
      board_review_age_days: Number.isFinite(review_age) ? review_age : null,
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
