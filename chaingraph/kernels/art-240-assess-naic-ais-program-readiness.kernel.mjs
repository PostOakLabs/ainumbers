import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-240-assess-naic-ais-program-readiness';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'assess_naic_ais_program_readiness',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ─── NAIC AI Model Bulletin Readiness Diagnostic ─────────────────────────────
// Diagnostic scoring tool mapped to the NAIC AI Model Bulletin (adopted Aug 2020,
// most recently updated 2023) and the NAIC AI Systems (AIS) Evaluation Tool.
// Tracks state adoption: 24+ states have adopted or substantially adopted the
// bulletin as of mid-2026; 12-state market-conduct exam pilot ran Jan-Sep 2026
// (NAIC press release Jan 2026).
//
// Scoring dimensions (per NAIC AIS Evaluation Tool):
//   1. Governance & Accountability (policy, ownership, board oversight)
//   2. Risk Management Framework (risk register, model risk integration)
//   3. Data Governance (source documentation, bias monitoring)
//   4. Testing & Validation (pre/post-deploy validation, 3rd party review)
//   5. Transparency & Explainability (factor disclosure, producer/consumer info)
//   6. Complaint & Audit Readiness (exam evidence, audit trail)
//
// Each dimension is scored 0-3: 0=Not started, 1=Planning, 2=Partially implemented,
// 3=Fully implemented. Total 0-18; readiness tier = Green/Yellow/Red.
//
// Regulatory basis:
//   NAIC AI Model Bulletin (Aug 2020, rev. 2023)
//   NAIC AI Systems (AIS) Evaluation Tool (2024 edition)
//   NAIC Market Regulation Handbook (2024) — exam procedures for AI systems
//   12-state market-conduct exam pilot 2026 (NAIC; verify state-specific adoption)
//   table_version: "NAIC-AIS-BULLETIN-2023-R1"

function safeNum(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(3, Math.max(0, Math.round(n))) : (def !== undefined ? def : 0);
}
function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }

const DIMS = [
  { key: 'governance_score',      label: 'Governance & Accountability' },
  { key: 'risk_mgmt_score',       label: 'Risk Management Framework' },
  { key: 'data_governance_score', label: 'Data Governance & Bias Monitoring' },
  { key: 'testing_score',         label: 'Testing & Validation' },
  { key: 'transparency_score',    label: 'Transparency & Explainability' },
  { key: 'audit_score',           label: 'Complaint & Audit Readiness' },
];

const SCORE_LABELS = { 0: 'NOT_STARTED', 1: 'PLANNING', 2: 'PARTIAL', 3: 'IMPLEMENTED' };

export function compute(pp) {
  pp = pp || {};

  const dim_scores = DIMS.map(d => {
    const score = safeNum(pp[d.key], 0);
    return { key: d.key, name: d.label, score, status: SCORE_LABELS[score] };
  });

  const total = dim_scores.reduce((s, d) => s + d.score, 0);
  const max = DIMS.length * 3;  // 18
  const pct = Math.round(total / max * 100);

  // Readiness tier
  const tier = pct >= 78 ? 'GREEN' : pct >= 44 ? 'YELLOW' : 'RED';
  const tier_label = tier === 'GREEN' ? 'EXAM_READY' : tier === 'YELLOW' ? 'IN_PROGRESS' : 'SIGNIFICANT_GAPS';

  // Gaps
  const gaps = dim_scores.filter(d => d.score < 2).map(d => ({
    dimension: d.name,
    current: d.status,
    gap: 'Below Partially Implemented — address before market-conduct exam',
  }));

  const do_now = [];
  if (dim_scores.find(d => d.key === 'governance_score' && d.score < 2)) {
    do_now.push('Establish AI governance policy with named owner and board-level reporting line (NAIC AIS Bulletin §II.A).');
  }
  if (dim_scores.find(d => d.key === 'data_governance_score' && d.score < 2)) {
    do_now.push('Document training data sources and implement bias monitoring program (NAIC AIS Bulletin §II.C).');
  }
  if (dim_scores.find(d => d.key === 'audit_score' && d.score < 2)) {
    do_now.push('Build exam-ready audit evidence package: model documentation, validation reports, complaint log (NAIC AIS Bulletin §II.F).');
  }
  if (pct < 44) {
    do_now.push('Engage outside counsel for NAIC AI Model Bulletin gap analysis before market-conduct exam.');
  }

  // Adopted-states note
  const adopted_states_note = 'NAIC AI Model Bulletin adopted or substantially adopted by 24+ states as of mid-2026. 12-state market-conduct exam pilot ran Jan-Sep 2026 (verify current adoption status with NAIC and state regulator before relying on this count).';

  const compliance_flags = [];
  if (tier === 'RED') compliance_flags.push('SIGNIFICANT_GAPS_EXAM_NOT_READY');
  if (tier === 'YELLOW') compliance_flags.push('IN_PROGRESS_EXAM_RISK');
  if (gaps.length > 0) compliance_flags.push('READINESS_GAPS_PRESENT');

  const output_payload = {
    readiness_tier: tier,
    readiness_label: tier_label,
    total_score: total,
    max_score: max,
    readiness_pct: pct,
    dimension_scores: dim_scores.map(d => ({ dimension: d.name, score: d.score, status: d.status })),
    gaps,
    do_now: do_now.length > 0 ? do_now : ['All dimensions at Partially Implemented or above — focus on documentation and exam-evidence preparation.'],
    adopted_states_note,
    exam_pilot_note: '12-state market-conduct exam pilot ran Jan-Sep 2026 per NAIC. Verify current exam schedule with your state regulator.',
    regulatory_basis: 'NAIC AI Model Bulletin (Aug 2020, rev. 2023); NAIC AI Systems (AIS) Evaluation Tool (2024 edition); NAIC Market Regulation Handbook (2024)',
    table_version: 'NAIC-AIS-BULLETIN-2023-R1',
    table_source: 'NAIC AI Model Bulletin (adopted Aug 2020, updated 2023); NAIC AI Systems Evaluation Tool (2024 ed., naic.org)',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
