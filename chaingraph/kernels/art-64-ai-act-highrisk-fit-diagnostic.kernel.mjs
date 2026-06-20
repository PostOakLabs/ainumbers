/**
 * art-64-ai-act-highrisk-fit-diagnostic.kernel.mjs
 * Wave 15 — EU AI Act High-Risk Fit & Classification Diagnostic (D0).
 * In-force-first order: Art 5 prohibited practices → Art 4 AI literacy → GPAI
 *   (Arts 53-55, in force since 2 Aug 2025) → Annex III high-risk classification.
 * Routes to the right Wave-15 aig-* chain and emits applicable obligation dates.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Citations (verify against current primary sources before citing on any page):
 *   EU AI Act (Reg. 2024/1689), consolidated text:
 *     Art 4 (AI literacy, in force 2 Feb 2025);
 *     Art 5 (prohibited practices, in force 2 Aug 2025, €35M/7% penalty);
 *     Arts 6 + Annex III (high-risk classification, credit scoring / insurance pricing /
 *       financial-standing — confirmed Dec 2027 per Digital Omnibus);
 *     Arts 9-15 (provider obligations: risk management, data governance, transparency,
 *       human oversight, accuracy/robustness — Dec 2027 or original 2 Aug 2026);
 *     Art 27 (FRIA, deployers — Dec 2027);
 *     Art 72 (post-market monitoring — Dec 2027);
 *     Arts 50-55 (GPAI + transparency, in force 2 Aug 2025; systemic risk 10^25 FLOP).
 *   Digital Omnibus on AI (provisional agreement 7 May 2026): Annex III high-risk
 *     financial AI deferred to 2 Dec 2027; legal effect on formal adoption before
 *     2 Aug 2026 — verify current status against Official Journal before quoting.
 *   DORA (Reg. 2022/2554) — fully enforced since 17 Jan 2025.
 *   EDUCATIONAL: outputs are decision-support drafts, not legal conformity certificates.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-64-ai-act-highrisk-fit-diagnostic';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'run_ai_act_highrisk_fit',
  mandate_type: 'agent_guardrail_mandate',
  gpu:          false,
};

// ─── Scoring tables ──────────────────────────────────────────────────────────
const S = {
  // In-force: Prohibited practices (Art 5, 2 Aug 2025, €35M/7%)
  prohibited_practice_exposure: { none: 4, borderline: 2, likely: 0 },
  // In-force: AI literacy (Art 4, 2 Feb 2025)
  ai_literacy_programme:        { 'in-place': 4, partial: 2, none: 0 },
  // In-force: GPAI dependency (Arts 53-55, 2 Aug 2025)
  foundation_model_dependency:  { none: 4, 'GPAI': 2, 'GPAI-systemic': 0 },
  // Classification
  annex_iii_match:              { 'clear-high-risk': 0, borderline: 2, 'out-of-scope': 4 },
  // Role
  actor_role:                   { both: 2, provider: 3, deployer: 3, 'GPAI-provider': 1 },
  // Articles 9-15 readiness
  risk_mgmt_system:             { full: 4, partial: 2, none: 0 },
  data_governance:              { full: 4, partial: 2, none: 0 },
  technical_documentation:      { full: 4, partial: 2, none: 0 },
  logging_oversight:            { full: 4, partial: 2, none: 0 },
  // Deployer duties
  fria_status:                  { complete: 4, partial: 2, 'not-started': 0 },
  post_market_monitoring:       { defined: 4, partial: 2, none: 0 },
  // Governance maturity
  model_risk_framework:         { 'SR-11-7-aligned': 4, partial: 2, none: 0 },
};

const pick   = (t, v, d = 0) => (v in t ? t[v] : d);
const letter = s => (s >= 85 ? 'A' : s >= 70 ? 'B' : s >= 55 ? 'C' : s >= 40 ? 'D' : 'F');

const WEIGHTS = {
  prohibited:     0.10,  // Art 5 in-force (highest penalty)
  literacy:       0.08,  // Art 4 in-force
  gpai:           0.07,  // Arts 53-55 in-force
  classification: 0.25,  // Annex III
  role:           0.10,  // Provider/deployer split
  articles_9_15:  0.20,  // Provider obligations (prepare-ahead for Dec 2027)
  deployer:       0.12,  // Deployer duties
  maturity:       0.08,  // Governance maturity
};

// ─── Routing ─────────────────────────────────────────────────────────────────
const CHAIN_ROUTES = {
  prohibited:     'aig-fit',            // DO NOW: remediate Art 5 exposure first
  literacy:       'aig-fit',            // DO NOW: Art 4 literacy gap
  gpai:           'aig-gpai-agentic',   // DO NOW: GPAI/systemic obligations in force
  resilience:     'aig-resilience-overlap', // DO NOW: DORA overlap
  provider:       'aig-conformity',     // Prepare-ahead: Annex IV + CE/DoC
  deployer:       'aig-fria-monitoring',// Prepare-ahead: FRIA + post-market
  fairness:       'aig-fairness-bias',  // DO NOW: non-discrimination
  credit:         'aig-credit-ai-conformity',
  audit:          'aig-audit-pack',
};

const DO_NOW_ITEMS = {
  prohibited:  'Art 5 prohibited-practice exposure — CRITICAL, in force 2 Aug 2025, €35M/7% penalty. Screen each use case against the prohibited practices list immediately. Verify against consolidated AI Act Art 5 text.',
  literacy:    'Art 4 AI literacy — in force 2 Feb 2025. Implement AI-literacy programme for all staff deploying or using AI systems. Verify against consolidated AI Act Art 4 text.',
  gpai:        'GPAI/foundation-model obligations (Arts 53-55) — in force 2 Aug 2025. Disclose training data summaries, implement copyright policy, register GPAI model with EU AI Office. Systemic-risk models (>10^25 FLOP) carry additional obligations (Art 55). Verify against current AI Act and GPAI Code of Practice.',
  dora:        'DORA (Reg. 2022/2554) — fully enforced since 17 Jan 2025. Treat the AI system as an ICT system: ICT risk management, incident reporting, vendor management (TPRM), TLPT. Run aig-resilience-overlap chain.',
  fairness:    'Non-discrimination / fair-lending (existing law, independent of AI Act date). Screen credit/insurance AI models for protected-characteristic bias. Run aig-fairness-bias chain.',
};

const PREPARE_AHEAD_ITEMS = {
  classification: 'Annex III high-risk classification (Arts 6+Annex III) — confirm target date (Digital Omnibus: 2 Dec 2027; else 2 Aug 2026). Verify formal-adoption status. Run aig-fit for classification routing.',
  articles_9_15:  'Arts 9-15 provider obligations — risk-management system (Art 9), data governance (Art 10), Annex IV technical documentation (Art 11), logging (Art 12), transparency (Art 13), human oversight (Art 14), accuracy/robustness/cybersecurity (Art 15). Run aig-conformity chain.',
  fria:           'Art 27 FRIA — Fundamental Rights Impact Assessment for deployers. Run aig-fria-monitoring chain. Decision-support draft, not a legal certificate.',
  post_market:    'Art 72 post-market monitoring — define monitoring metrics, drift triggers, review cadence. Run aig-fria-monitoring chain.',
};

export function compute(pp) {
  const {
    // In-force screens
    prohibited_practice_exposure = 'none',
    ai_literacy_programme        = 'none',
    // GPAI
    foundation_model_dependency  = 'none',
    // Classification
    use_case        = 'other',
    annex_iii_match = 'out-of-scope',
    // Role
    actor_role = 'deployer',
    // Articles 9-15
    risk_mgmt_system        = 'none',
    data_governance         = 'none',
    technical_documentation = 'none',
    logging_oversight       = 'none',
    // Deployer duties
    fria_status          = 'not-started',
    post_market_monitoring = 'none',
    // Governance maturity
    model_risk_framework = 'none',
    // Informational
    system_name  = '',
    eu_nexus     = true,
  } = pp;

  // ── Dimension scores ──
  const sub = {
    prohibited:     [pick(S.prohibited_practice_exposure, prohibited_practice_exposure)],
    literacy:       [pick(S.ai_literacy_programme, ai_literacy_programme)],
    gpai:           [pick(S.foundation_model_dependency, foundation_model_dependency)],
    classification: [pick(S.annex_iii_match, annex_iii_match)],
    role:           [pick(S.actor_role, actor_role)],
    articles_9_15:  [
      pick(S.risk_mgmt_system, risk_mgmt_system),
      pick(S.data_governance, data_governance),
      pick(S.technical_documentation, technical_documentation),
      pick(S.logging_oversight, logging_oversight),
    ],
    deployer:       [pick(S.fria_status, fria_status), pick(S.post_market_monitoring, post_market_monitoring)],
    maturity:       [pick(S.model_risk_framework, model_risk_framework)],
  };

  const dim_scores = {};
  for (const k of Object.keys(sub)) {
    const avg = sub[k].reduce((a, b) => a + b, 0) / sub[k].length;
    dim_scores[k] = { score: +(avg / 4 * 100).toFixed(1), grade: letter(avg / 4 * 100) };
  }

  const overall = +Object.keys(WEIGHTS).reduce(
    (acc, k) => acc + dim_scores[k].score * WEIGHTS[k], 0
  ).toFixed(1);
  const overall_grade = letter(overall);

  // ── In-force verdicts ──
  const prohibited_practice_verdict = prohibited_practice_exposure === 'likely'
    ? 'CRITICAL — likely prohibited practice detected. Stop and remediate before deployment.'
    : prohibited_practice_exposure === 'borderline'
    ? 'WARNING — borderline prohibited-practice risk. Legal review required before deployment.'
    : 'PASS — no obvious prohibited-practice exposure.';

  const ai_literacy_grade = dim_scores.literacy.grade;

  const gpai_applicability = foundation_model_dependency === 'none'
    ? 'Not applicable — no GPAI/foundation-model dependency'
    : foundation_model_dependency === 'GPAI'
    ? 'GPAI obligations apply (Arts 53-54, in force 2 Aug 2025)'
    : 'SYSTEMIC GPAI obligations apply (Art 55, 10^25 FLOP threshold — verify classification against EU AI Office list)';

  // ── High-risk verdict ──
  const high_risk_verdict = annex_iii_match === 'clear-high-risk'
    ? 'HIGH-RISK — Annex III match confirmed. Provider and/or deployer obligations apply.'
    : annex_iii_match === 'borderline'
    ? 'BORDERLINE — legal review required. May be high-risk under Arts 6+Annex III.'
    : 'OUT-OF-SCOPE — current assessment indicates system does not meet Annex III criteria. Re-assess if use case changes.';

  const annex_iii_basis = (() => {
    const cases = {
      'credit-scoring': 'Annex III §5(b) — creditworthiness assessment or credit scoring of natural persons',
      'insurance-pricing': 'Annex III §5(c) — risk assessment and pricing in life/health insurance',
      'financial-standing': 'Annex III §5(b) — financial-standing evaluation',
      'fraud-AML': 'Likely out-of-scope Annex III; verify AML-systems carve-out',
      'other': 'Use-case-specific analysis required — review consolidated Annex III against actual deployment context',
    };
    return cases[use_case] ?? cases['other'];
  })();

  // ── Applicable date ──
  const applicable_date = {
    note: 'Verify current status: Digital Omnibus (provisional agreement 7 May 2026) proposes Annex III high-risk obligations → 2 Dec 2027. Legal effect only on formal adoption and publication in Official Journal before 2 Aug 2026. If not adopted in time, original 2 Aug 2026 date applies. Always check the current AI Act timeline before relying on this date.',
    digital_omnibus_date: '2026-12-02',
    original_date: '2026-08-02',
  };

  // ── Routing ──
  const do_now_checklist = [];
  if (prohibited_practice_exposure !== 'none') {
    do_now_checklist.push({ obligation: 'Art 5 Prohibited Practices', status: 'IN FORCE 2 Aug 2025', action: DO_NOW_ITEMS.prohibited });
  }
  if (ai_literacy_programme !== 'in-place') {
    do_now_checklist.push({ obligation: 'Art 4 AI Literacy', status: 'IN FORCE 2 Feb 2025', action: DO_NOW_ITEMS.literacy });
  }
  if (foundation_model_dependency !== 'none') {
    do_now_checklist.push({ obligation: 'GPAI Obligations (Arts 53-55)', status: 'IN FORCE 2 Aug 2025', action: DO_NOW_ITEMS.gpai });
  }
  do_now_checklist.push({ obligation: 'DORA ICT Risk (if AI is an ICT system)', status: 'IN FORCE 17 Jan 2025', action: DO_NOW_ITEMS.dora });
  do_now_checklist.push({ obligation: 'Non-Discrimination / Fair-Lending (existing law)', status: 'IN FORCE', action: DO_NOW_ITEMS.fairness });

  const prepare_ahead_checklist = [];
  if (annex_iii_match !== 'out-of-scope') {
    prepare_ahead_checklist.push({ obligation: 'Annex III High-Risk Classification', target_date: '2 Dec 2027 (verify)', action: PREPARE_AHEAD_ITEMS.classification });
    prepare_ahead_checklist.push({ obligation: 'Arts 9-15 Provider Obligations', target_date: '2 Dec 2027 (verify)', action: PREPARE_AHEAD_ITEMS.articles_9_15 });
    if (actor_role === 'deployer' || actor_role === 'both') {
      prepare_ahead_checklist.push({ obligation: 'Art 27 FRIA', target_date: '2 Dec 2027 (verify)', action: PREPARE_AHEAD_ITEMS.fria });
      prepare_ahead_checklist.push({ obligation: 'Art 72 Post-Market Monitoring', target_date: '2 Dec 2027 (verify)', action: PREPARE_AHEAD_ITEMS.post_market });
    }
  }

  // ── Primary recommendation (in-force first) ──
  let primary_recommendation;
  if (prohibited_practice_exposure === 'likely') primary_recommendation = 'aig-fit';
  else if (foundation_model_dependency !== 'none') primary_recommendation = 'aig-gpai-agentic';
  else if (annex_iii_match !== 'out-of-scope' && (actor_role === 'provider' || actor_role === 'both')) primary_recommendation = 'aig-conformity';
  else if (annex_iii_match !== 'out-of-scope' && actor_role === 'deployer') primary_recommendation = 'aig-fria-monitoring';
  else primary_recommendation = 'aig-audit-pack';

  const secondary_recommendations = [
    'aig-resilience-overlap',
    'aig-fairness-bias',
    'aig-audit-pack',
  ].filter(r => r !== primary_recommendation);

  if (use_case === 'credit-scoring' && !secondary_recommendations.includes('aig-credit-ai-conformity'))
    secondary_recommendations.unshift('aig-credit-ai-conformity');

  // ── Compliance flags ──
  const compliance_flags = [];
  if (prohibited_practice_exposure === 'likely')       compliance_flags.push('PROHIBITED_PRACTICE_RISK');
  if (prohibited_practice_exposure === 'borderline')   compliance_flags.push('PROHIBITED_PRACTICE_BORDERLINE');
  if (ai_literacy_programme === 'none')                compliance_flags.push('NO_AI_LITERACY_PROGRAMME');
  if (foundation_model_dependency === 'GPAI-systemic') compliance_flags.push('GPAI_SYSTEMIC_DEPENDENCY');
  if (annex_iii_match === 'clear-high-risk')           compliance_flags.push('HIGH_RISK_ANNEX_III');
  if (fria_status === 'not-started')                   compliance_flags.push('NO_FRIA');
  if (technical_documentation === 'none')              compliance_flags.push('TECH_DOC_INCOMPLETE_ANNEX_IV');

  const output_payload = {
    prohibited_practice_verdict,
    ai_literacy_grade,
    gpai_applicability,
    high_risk_verdict,
    annex_iii_basis,
    role: actor_role,
    dim_scores,
    overall_score: overall,
    overall_grade,
    applicable_date,
    do_now_checklist,
    prepare_ahead_checklist,
    primary_recommendation,
    secondary_recommendations,
    note: 'Educational decision-support diagnostic. Outputs are not legal conformity certificates. '
      + 'EU AI Act timeline is in flux (Digital Omnibus pending formal adoption as of 2026-06-20) — '
      + 'carry both dates (2 Aug 2026 / 2 Dec 2027) and verify against the current AI Act / Official Journal. '
      + 'Verify all Article/Annex references against EU AI Act (Reg. 2024/1689) consolidated text '
      + 'at https://eur-lex.europa.eu/eli/reg/2024/1689/oj and Digital Omnibus updates.',
  };

  return { output_payload, compliance_flags };
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
