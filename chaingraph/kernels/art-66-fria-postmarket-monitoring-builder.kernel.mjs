/**
 * art-66-fria-postmarket-monitoring-builder.kernel.mjs
 * Wave 15 — FRIA & Post-Market Monitoring Plan Builder.
 * The flagship DEPLOYER tool: builds an Art 27 FRIA + Art 72 post-market monitoring plan
 * + Art 12 logging + Art 14 human-oversight design for banks/insurers deploying
 * a high-risk AI system. Also maps the Art 73 serious-incident reporting path.
 * PREPARE-AHEAD: Art 27 FRIA and Art 72 post-market monitoring obligations are confirmed
 * for 2 Dec 2027 (Digital Omnibus provisional agreement 7 May 2026) or original
 * 2 Aug 2026 if Omnibus not formally adopted before that date. Verify.
 *
 * Citations (verify before citing):
 *   EU AI Act Arts 12 (logging), 14 (human oversight), 26 (deployer general obligations),
 *   27 (FRIA — Fundamental Rights Impact Assessment), 72 (post-market monitoring),
 *   73 (serious-incident reporting + market-surveillance authority notification).
 *   Digital Omnibus on AI (provisional agreement 7 May 2026).
 *   EDUCATIONAL: outputs are decision-support drafts, not legal assessments.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-66-fria-postmarket-monitoring-builder';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'build_fria_monitoring_plan',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

// ─── Art 27 FRIA elements ─────────────────────────────────────────────────────
// Verify each element against consolidated EU AI Act Art 27 text.
const FRIA_ELEMENTS = [
  { id: 'purpose',    label: 'Description of intended use, deployment context, and decision impact (Art 27)' },
  { id: 'persons',    label: 'Categories of affected persons (consumers, workers, applicants) and population size (Art 27)' },
  { id: 'rights',     label: 'Fundamental rights and non-discrimination risks identification (Art 27)' },
  { id: 'oversight',  label: 'Human-oversight measures and escalation procedures (Arts 14+27)' },
  { id: 'mitigation', label: 'Risk mitigation measures and residual-risk acceptance (Art 27)' },
  { id: 'governance', label: 'Internal governance: responsible function, review cadence, sign-off (Art 27)' },
];

const STATUS_SCORE = { complete: 4, partial: 2, 'not-started': 0 };
const pick   = (t, v, d = 0) => (v in t ? t[v] : d);
const letter = s => (s >= 85 ? 'A' : s >= 70 ? 'B' : s >= 55 ? 'C' : s >= 40 ? 'D' : 'F');

export function compute(pp) {
  const {
    deployment    = { use_case: 'credit-scoring', affected_persons: 'consumers', automation_level: 'human-review' },
    fria          = [],   // [{element, status}] matching FRIA_ELEMENTS ids
    human_oversight       = 'nominal',
    logging               = 'none',
    monitoring_plan       = 'none',
    incident_reporting    = 'not-mapped',
  } = pp;

  // ── FRIA completeness ──
  const friaMap = {};
  for (const f of fria) {
    if (f.element) friaMap[f.element] = f;
  }

  const fria_gaps = [];
  let friaTotal = 0;
  for (const el of FRIA_ELEMENTS) {
    const entry  = friaMap[el.id];
    const status = entry?.status ?? 'not-started';
    const score  = pick(STATUS_SCORE, status);
    friaTotal += score;
    if (status !== 'complete') {
      fria_gaps.push({
        element:     el.id,
        label:       el.label,
        status,
        remediation: `Complete: ${el.label}. Verify requirement against EU AI Act Art 27 consolidated text.`,
      });
    }
  }
  const fria_score = +(friaTotal / (FRIA_ELEMENTS.length * 4) * 100).toFixed(1);
  const fria_grade = letter(fria_score);

  // ── Human oversight (Art 14) ──
  const OVERSIGHT_SCORE = { meaningful: 4, nominal: 2, none: 0 };
  const oversight_score = pick(OVERSIGHT_SCORE, human_oversight);
  const oversight_verdict = human_oversight === 'meaningful'
    ? 'PASS — meaningful human oversight in place (Art 14)'
    : human_oversight === 'nominal'
    ? 'WARNING — oversight is nominal; upgrade to meaningful review with documented escalation path (Art 14)'
    : 'FAIL — no human-oversight mechanism. Art 14 requires deployers to assign oversight to qualified staff with authority to intervene.';

  // ── Logging (Art 12) ──
  const LOGGING_SCORE = { 'full-traceability': 4, partial: 2, none: 0 };
  const logging_score = pick(LOGGING_SCORE, logging);
  const logging_verdict = logging === 'full-traceability'
    ? 'PASS — full-traceability logging (Art 12)'
    : logging === 'partial'
    ? 'WARNING — partial logging; implement complete audit-log trail required by Art 12'
    : 'FAIL — no logging. Art 12 requires automatic logging of events enabling post-hoc review.';

  // ── Post-market monitoring plan skeleton (Art 72) ──
  const monitoring_plan_skeleton = {
    note: 'DECISION-SUPPORT SKELETON — not a legally-compliant Art 72 post-market monitoring plan. Review and complete with qualified compliance staff.',
    metrics: [
      { metric: 'Model accuracy on live data vs validation baseline', frequency: 'Monthly', threshold: 'Alert if >5% drift', action: 'Model review and re-validation' },
      { metric: 'Adverse decision rate by demographic group', frequency: 'Quarterly', threshold: 'Alert on statistically significant disparity', action: 'Fairness audit + Art 10 data review' },
      { metric: 'Serious-incident count (Art 73)', frequency: 'Continuous', threshold: 'Any serious incident', action: 'Art 73 notification within deadline — verify current deadline against consolidated text' },
      { metric: 'Human-oversight intervention rate', frequency: 'Monthly', threshold: 'Alert if intervention rate > 20% (review automation level)', action: 'Oversight design review' },
      { metric: 'Logging completeness', frequency: 'Weekly', threshold: '100% — zero gaps', action: 'Logging system repair + gap audit' },
    ],
    review_cadence: 'Annual full review + ad-hoc review on material change (new use case, model retrain, regulatory update)',
    responsible_function: '[Assign: Model Risk / AI Governance / Chief Risk Officer]',
    applicable_date_note: 'Art 72 post-market monitoring obligations: verify target date (Digital Omnibus: 2 Dec 2027; else 2 Aug 2026) against current Official Journal status.',
  };

  // ── Serious-incident reporting path (Art 73) ──
  const incident_path = {
    note: 'DECISION-SUPPORT ONLY — verify Art 73 notification requirements, deadlines, and the designated market-surveillance authority (MSA) for your jurisdiction against consolidated AI Act Art 73 text. Deadlines vary by incident severity.',
    mapped: incident_reporting !== 'not-mapped',
    recommendation: incident_reporting === 'not-mapped'
      ? 'Map the Art 73 serious-incident reporting path now: identify your national market-surveillance authority, determine notification deadline (verify against Art 73 text), assign internal incident-triage function.'
      : 'Art 73 path mapped. Verify MSA contact + deadline against current national AI Act enforcement guidance.',
  };

  // ── Affected rights ──
  const affected_rights = [
    'Non-discrimination and equality (Art 21 EU Charter)',
    'Data protection and privacy (Art 8 EU Charter, GDPR)',
    'Human dignity (Art 1 EU Charter)',
  ];
  if (deployment.affected_persons === 'workers') affected_rights.push('Fair working conditions (Art 31 EU Charter)');
  if (deployment.use_case === 'credit-scoring' || deployment.use_case === 'insurance-pricing') {
    affected_rights.push('Access to essential services (housing, financial services)');
  }

  // ── Overall scoring ──
  const overall_score = +(
    fria_score * 0.45
    + oversight_score / 4 * 100 * 0.25
    + logging_score / 4 * 100 * 0.15
    + (monitoring_plan === 'defined' ? 100 : monitoring_plan === 'partial' ? 50 : 0) * 0.15
  ).toFixed(1);
  const overall_grade = letter(overall_score);

  // ── Compliance flags ──
  const compliance_flags = [];
  if (fria_grade === 'D' || fria_grade === 'F') compliance_flags.push('FRIA_INCOMPLETE');
  if (human_oversight === 'nominal')            compliance_flags.push('OVERSIGHT_NOMINAL');
  if (human_oversight === 'none')               compliance_flags.push('OVERSIGHT_ABSENT');
  if (monitoring_plan === 'none')               compliance_flags.push('NO_POST_MARKET_MONITORING');
  if (logging === 'none')                       compliance_flags.push('NO_LOGGING_ART12');
  if (incident_reporting === 'not-mapped')      compliance_flags.push('INCIDENT_PATH_NOT_MAPPED');

  const output_payload = {
    deployment: {
      use_case:         deployment.use_case,
      affected_persons: deployment.affected_persons,
      automation_level: deployment.automation_level,
    },
    overall_score,
    fria_grade,
    fria_score,
    fria_gaps,
    oversight_verdict,
    logging_verdict,
    monitoring_plan_skeleton,
    incident_path,
    affected_rights,
    applicable_date_note: 'Art 27 FRIA + Art 72 post-market monitoring: Digital Omnibus proposes 2 Dec 2027 (provisional agreement 7 May 2026, pending formal adoption). Verify status against Official Journal. Original date: 2 Aug 2026.',
    note: 'PREPARE-AHEAD — Decision-support draft. FRIA/monitoring outputs are NOT legal assessments or compliance certificates. Complete with qualified legal and compliance staff. Verify all Art references against EU AI Act (Reg. 2024/1689) consolidated text at https://eur-lex.europa.eu/eli/reg/2024/1689/oj.',
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
