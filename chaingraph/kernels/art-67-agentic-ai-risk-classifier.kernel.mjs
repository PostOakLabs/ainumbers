/**
 * art-67-agentic-ai-risk-classifier.kernel.mjs
 * Wave 15 — Agentic AI Risk & GPAI Governance Classifier.
 * Co-flagship and the wave's strongest IN-FORCE anchor:
 *   GPAI/foundation-model obligations (Arts 53-55) are enforceable since 2 Aug 2025
 *   and are EXPLICITLY UNCHANGED by the Digital Omnibus.
 * Classifies: autonomy level → governance tier; GPAI obligations (Art 53);
 *   systemic-risk designation (Art 55, 10^25 FLOP threshold); Art 50 transparency
 *   for agent interactions; and the interaction with high-risk duties when the agent
 *   is used in a financial Annex III use case (credit scoring, insurance pricing).
 * Reflexive tie to Wave 14: the agents that transact on AINumbers' rails are
 *   AI systems that must be governed TODAY under Arts 53-55.
 *
 * Citations (verify against current primary sources):
 *   EU AI Act Arts 50 (transparency, near-term 2026), 51 (GPAI definition),
 *   53 (GPAI obligations: training data disclosure, copyright policy, documentation),
 *   54 (GPAI compliance by model card / code of practice),
 *   55 (systemic-risk GPAI: Art 55§1, additional obligations, 10^25 FLOP threshold).
 *   EU AI Office GPAI Code of Practice (draft, 2025-2026) — verify current version.
 *   Arts 6 + Annex III for high-risk interaction when used in FS use case.
 *   EDUCATIONAL: outputs are decision-support drafts, not legal determinations.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-67-agentic-ai-risk-classifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'classify_agentic_ai_risk',
  mandate_type: 'model_governance',
  gpu:          false,
};

// ─── Governance tiers ─────────────────────────────────────────────────────────
const GOVERNANCE_TIER = {
  // autonomy_level → base tier
  'assistive':    'Tier 1 — Assistive (human final decision; limited GPAI obligations unless using GPAI model)',
  'supervised':   'Tier 2 — Supervised Autonomous (human review before action; GPAI obligations if using foundation model)',
  'autonomous-HNP': 'Tier 3 — Human-Not-Present Autonomous (highest risk; GPAI + systemic-risk checks mandatory; Art 14 oversight design critical)',
};

// ─── Scoring ──────────────────────────────────────────────────────────────────
const S = {
  autonomy_level: { 'assistive': 4, 'supervised': 2, 'autonomous-HNP': 0 },
  human_oversight: { 'full-control': 4, 'review-before-action': 3, 'monitoring-only': 1, 'none': 0 },
  model_type: { 'bespoke': 4, 'fine-tuned-GPAI': 2, 'GPAI': 0 },
  transparency_art50: { 'in-place': 4, 'partial': 2, 'none': 0 },
  gpai_documentation: { 'in-place': 4, 'partial': 2, 'none': 0 },
  systemic_risk_eval: { 'complete': 4, 'in-progress': 2, 'not-started': 0, 'n/a': 4 },
};

const pick   = (t, v, d = 0) => (v in t ? t[v] : d);
const letter = s => (s >= 85 ? 'A' : s >= 70 ? 'B' : s >= 55 ? 'C' : s >= 40 ? 'D' : 'F');

export function compute(pp) {
  const {
    agent = {
      autonomy_level:       'supervised',
      financial_use_case:   'other',
      human_oversight:      'review-before-action',
    },
    model = {
      type:                 'GPAI',
      training_compute_flop: 0,
      systemic_designation: 'unknown',
    },
    obligations = {
      transparency:      'none',
      gpai_documentation:'none',
      systemic_risk_eval:'not-started',
    },
    downstream_highrisk = false,
  } = pp;

  // ── GPAI classification ──
  const is_gpai = model.type === 'GPAI' || model.type === 'fine-tuned-GPAI';
  const systemic_threshold_flop = 1e25; // 10^25 FLOP — verify against current Art 55 text
  const above_threshold = typeof model.training_compute_flop === 'number'
    && model.training_compute_flop > 0
    && model.training_compute_flop >= systemic_threshold_flop;

  const gpai_class = !is_gpai
    ? 'none'
    : (model.systemic_designation === 'yes' || above_threshold)
    ? 'systemic-gpai'
    : 'gpai';

  // ── Applicable obligations ──
  const applicable_obligations = [];

  // Art 4 (in force 2 Feb 2025) — always applies to any deployer/provider
  applicable_obligations.push({
    article: 'Art 4 (AI Literacy)',
    status: 'IN FORCE — 2 Feb 2025',
    requirement: 'Ensure all staff deploying or using the agent have adequate AI literacy (Art 4). Verify scope against consolidated text.',
  });

  // Art 50 transparency (near-term 2026, verify if Omnibus moved)
  applicable_obligations.push({
    article: 'Art 50 (Transparency — chatbots / AI interactions)',
    status: 'IN FORCE target ~2 Aug 2026 (verify — Omnibus may have adjusted; check Official Journal)',
    requirement: 'Disclose to users that they are interacting with an AI system (chatbot/agent). Art 50§1. Verify exact scope and any exceptions against consolidated text.',
  });

  if (is_gpai) {
    applicable_obligations.push({
      article: 'Art 53 (GPAI provider obligations)',
      status: 'IN FORCE — 2 Aug 2025',
      requirement: 'Provider of GPAI model must: maintain technical documentation; make training data summary available; implement copyright policy; publish model card or register with EU AI Office. Verify against current GPAI Code of Practice and Art 53 text.',
    });
    applicable_obligations.push({
      article: 'Art 54 (GPAI compliance)',
      status: 'IN FORCE — 2 Aug 2025',
      requirement: 'Comply with harmonised standards or the GPAI Code of Practice (Art 54). Verify current Code of Practice status with EU AI Office.',
    });
  }

  if (gpai_class === 'systemic-gpai') {
    applicable_obligations.push({
      article: 'Art 55 (Systemic-risk GPAI — additional obligations)',
      status: 'IN FORCE — 2 Aug 2025',
      requirement: 'Systemic-risk GPAI (>10^25 FLOP training compute or designated by EU AI Office): adversarial testing, cybersecurity incident reporting, energy-efficiency disclosure (Art 55). Verify 10^25 FLOP threshold and current EU AI Office designation list against primary sources.',
    });
  }

  if (downstream_highrisk) {
    applicable_obligations.push({
      article: 'Arts 9-15 (High-risk AI system obligations — via Annex III downstream use)',
      status: 'PREPARE-AHEAD — 2 Dec 2027 (verify Digital Omnibus adoption)',
      requirement: 'When an agent is used in an Annex III financial-services use case (credit scoring, insurance pricing), the full Arts 9-15 high-risk regime applies to the deploying provider. Run aig-conformity chain for the provider and aig-fria-monitoring for the deployer.',
    });
  }

  if (agent.autonomy_level === 'autonomous-HNP') {
    applicable_obligations.push({
      article: 'Art 14 (Human Oversight — special attention for HNP)',
      status: 'PREPARE-AHEAD — 2 Dec 2027 for high-risk / IN FORCE under existing financial regulation for FS',
      requirement: 'Autonomous Human-Not-Present (HNP) agents require meaningful human oversight (Art 14). For financial services, existing regulatory expectations (EBA, ECB) may already require human control over material AI-driven decisions — independent of the AI Act timeline.',
    });
  }

  // ── Autonomy/oversight verdict ──
  const autonomy_oversight_verdict = (() => {
    if (agent.autonomy_level === 'autonomous-HNP' && agent.human_oversight === 'none')
      return 'CRITICAL — HNP autonomous agent with no human oversight. Highest risk configuration. AI Act Art 14 + existing FS regulatory expectations require meaningful oversight for material decisions. Immediate review required.';
    if (agent.autonomy_level === 'autonomous-HNP')
      return 'HIGH RISK — HNP autonomous agent. Ensure oversight is meaningful (documented escalation, authority to intervene) not nominal. Review against Art 14 and existing FS supervisory expectations.';
    if (agent.autonomy_level === 'supervised')
      return 'MODERATE — Supervised autonomous agent. Human review before action is appropriate. Document oversight procedures.';
    return 'LOWER RISK — Assistive agent with human final decision. Ensure transparency obligations (Art 50) are met.';
  })();

  // ── High-risk interaction ──
  const highrisk_interaction = downstream_highrisk
    ? `Downstream high-risk use detected (financial_use_case: ${agent.financial_use_case}). The agent's outputs feed an Annex III use case (credit scoring / insurance pricing / financial-standing). Arts 9-15 provider obligations and Art 27 FRIA deployer obligations apply (prepare-ahead, 2 Dec 2027 per Digital Omnibus — verify). Run aig-conformity + aig-fria-monitoring chains.`
    : 'No downstream high-risk Annex III financial-services use case declared. If use case changes, re-assess.';

  // ── Dimension scoring ──
  const dim = {
    autonomy:     pick(S.autonomy_level, agent.autonomy_level),
    oversight:    pick(S.human_oversight, agent.human_oversight),
    model_type:   pick(S.model_type, model.type),
    transparency: pick(S.transparency_art50, obligations.transparency),
    gpai_docs:    is_gpai ? pick(S.gpai_documentation, obligations.gpai_documentation) : 4,
    systemic_eval:gpai_class === 'systemic-gpai' ? pick(S.systemic_risk_eval, obligations.systemic_risk_eval) : 4,
  };

  const overall_score = +(
    (dim.autonomy + dim.oversight + dim.model_type + dim.transparency + dim.gpai_docs + dim.systemic_eval)
    / (6 * 4) * 100
  ).toFixed(1);
  const overall_grade = letter(overall_score);

  // ── Compliance flags ──
  const compliance_flags = [];
  if (gpai_class === 'systemic-gpai')                            compliance_flags.push('SYSTEMIC_GPAI');
  if (agent.autonomy_level === 'autonomous-HNP' && downstream_highrisk) compliance_flags.push('AUTONOMOUS_HNP_HIGH_RISK');
  if (agent.human_oversight === 'none')                          compliance_flags.push('OVERSIGHT_INSUFFICIENT_FOR_AUTONOMY');
  if (obligations.transparency === 'none')                       compliance_flags.push('TRANSPARENCY_ART50_MISSING');
  if (is_gpai && obligations.gpai_documentation === 'none')      compliance_flags.push('GPAI_DOCUMENTATION_MISSING');

  const output_payload = {
    overall_score,
    overall_grade,
    governance_tier:           GOVERNANCE_TIER[agent.autonomy_level] ?? 'Unknown autonomy level',
    gpai_class,
    applicable_obligations,
    autonomy_oversight_verdict,
    highrisk_interaction,
    dim_scores: {
      autonomy:     { score: +(dim.autonomy / 4 * 100).toFixed(1),     grade: letter(dim.autonomy / 4 * 100) },
      oversight:    { score: +(dim.oversight / 4 * 100).toFixed(1),    grade: letter(dim.oversight / 4 * 100) },
      model_type:   { score: +(dim.model_type / 4 * 100).toFixed(1),   grade: letter(dim.model_type / 4 * 100) },
      transparency: { score: +(dim.transparency / 4 * 100).toFixed(1), grade: letter(dim.transparency / 4 * 100) },
      gpai_docs:    { score: +(dim.gpai_docs / 4 * 100).toFixed(1),    grade: letter(dim.gpai_docs / 4 * 100) },
      systemic_eval:{ score: +(dim.systemic_eval / 4 * 100).toFixed(1),grade: letter(dim.systemic_eval / 4 * 100) },
    },
    recommendation: primary_recommendation(agent, gpai_class, downstream_highrisk),
    in_force_status: 'GPAI obligations (Arts 53-55) IN FORCE since 2 Aug 2025. AI literacy (Art 4) IN FORCE since 2 Feb 2025. Verify GPAI Code of Practice version against EU AI Office. Systemic-risk threshold (10^25 FLOP) — verify against current Art 55 text.',
    note: 'EDUCATIONAL — Decision-support draft. Outputs are not legal determinations. Verify all Art references against EU AI Act (Reg. 2024/1689) consolidated text at https://eur-lex.europa.eu/eli/reg/2024/1689/oj and current GPAI Code of Practice at EU AI Office.',
  };

  return { output_payload, compliance_flags };
}

function primary_recommendation(agent, gpai_class, downstream_highrisk) {
  if (gpai_class === 'systemic-gpai') return 'IMMEDIATE: Run aig-gpai-agentic chain to classify systemic-risk obligations and map Art 55 requirements. Systemic-risk obligations are IN FORCE (2 Aug 2025).';
  if (gpai_class === 'gpai')          return 'RUN aig-gpai-agentic chain to map GPAI obligations (Arts 53-54, in force 2 Aug 2025). Register model with EU AI Office and comply with GPAI Code of Practice.';
  if (downstream_highrisk)            return 'Provider: run aig-conformity chain for Annex IV + CE/DoC. Deployer: run aig-fria-monitoring for FRIA + post-market monitoring (prepare-ahead, 2 Dec 2027 — verify).';
  if (agent.autonomy_level === 'autonomous-HNP') return 'Review Art 14 human-oversight design for HNP agent. Run aig-audit-pack for a hash-anchored governance record.';
  return 'Ensure Art 50 transparency (disclose AI interaction to users) and Art 4 AI literacy. Run aig-audit-pack for governance record.';
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type:       meta.mandate_type,
    tool_id:            TOOL_ID,
    tool_version:       TOOL_VERSION,
    generated_at:       now ?? null,
    execution_hash:     hash,
    chain:              { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:  pp,
    output_payload,
    compliance_flags,
    compute_mode:       'server',
    audit_signature:    { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
