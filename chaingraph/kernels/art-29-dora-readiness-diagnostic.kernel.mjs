// art-29 — DORA Readiness Diagnostic: pure decision kernel.
// Faithful port of runDiagnostic() in
//   repo/chaingraph/art-29-dora-readiness-diagnostic.html
// Pure: no DOM, no window, no network.
// DORA (EU) 2022/2554 — 12-question, 4-domain scored diagnostic.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-29-dora-readiness-diagnostic';
const TOOL_VERSION = '1.0.0';

// Four DORA pillars, 3 questions each
const DOMAINS = [
  {
    label: 'ICT Risk Management',
    articles: 'Art. 5–16',
    questions: [
      { qid:'q1', text:'Is there a board-approved ICT risk framework mapped to DORA Articles 5–16?' },
      { qid:'q2', text:'Are critical or important functions (CIFs) formally identified and documented?' },
      { qid:'q3', text:'Has proportionality been assessed and documented for your entity class?' },
    ],
  },
  {
    label: 'Incident Classification & Reporting',
    articles: 'Art. 17–23',
    questions: [
      { qid:'q4', text:'Can you classify a major ICT incident against the DORA criteria within the reporting clock?' },
      { qid:'q5', text:'Are NCA submission templates and deadlines tracked end-to-end?' },
      { qid:'q6', text:'Is there a tested escalation runbook from detection to initial notification?' },
    ],
  },
  {
    label: 'Resilience Testing',
    articles: 'Art. 24–27',
    questions: [
      { qid:'q7', text:'Is there a risk-based digital operational resilience testing programme (not just annual pen tests)?' },
      { qid:'q8', text:'If in scope, is TLPT (threat-led penetration testing) scoped and scheduled?' },
      { qid:'q9', text:'Are test findings tracked to closure with board visibility?' },
    ],
  },
  {
    label: 'Third-Party Risk',
    articles: 'Art. 28–30',
    questions: [
      { qid:'q10', text:'Is the register of information for all ICT third-party arrangements complete and current?' },
      { qid:'q11', text:'Do critical ICT contracts contain the DORA-mandated provisions (audit, exit, sub-outsourcing)?' },
      { qid:'q12', text:'Is ICT concentration risk measured and reported (single-provider dependencies)?' },
    ],
  },
];

const VALUES = { yes: 2, partial: 1, no: 0 };

function grade(pct) {
  return pct >= 85 ? 'A' : pct >= 70 ? 'B' : pct >= 55 ? 'C' : pct >= 40 ? 'D' : 'F';
}

const GRADE_TITLES = { A: 'Review-ready', B: 'Nearly there', C: 'Exposed', D: 'Not ready', F: 'Stop' };

/**
 * compute(pp) — pure DORA readiness diagnostic engine.
 * pp: {
 *   answers: Record<'q1'|'q2'|...'q12', 'yes'|'partial'|'no'|null>
 *   // Unanswered (null/undefined) treated as 'no'
 * }
 */
export function compute(pp) {
  const answers = pp.answers ?? {};

  let totalEarned = 0;
  const totalMax = DOMAINS.length * 3 * 2; // 4 domains × 3 questions × max 2 pts = 24
  const domainScores = [];
  const gaps = [];
  let allAnswered = true;

  for (const domain of DOMAINS) {
    let domainEarned = 0;
    const domainMax = domain.questions.length * 2;

    for (const q of domain.questions) {
      const raw = answers[q.qid];
      if (raw == null) allAnswered = false;
      const answer = raw ?? 'no';
      const pts = VALUES[answer] ?? 0;
      domainEarned += pts;
      if (answer !== 'yes') {
        gaps.push({
          question:     q.text,
          domain:       domain.label,
          severity:     answer === 'partial' ? 'partial' : 'no',
          articles:     domain.articles,
        });
      }
    }

    totalEarned += domainEarned;
    const domainPct = Math.round(100 * domainEarned / domainMax);
    domainScores.push({ label: domain.label, articles: domain.articles, pct: domainPct, grade: grade(domainPct) });
  }

  const scorePct = Math.round(100 * totalEarned / totalMax);
  const overallGrade = grade(scorePct);

  // Compliance flags driven by score and incident-domain performance
  const incidentDomainPct = domainScores[1]?.pct ?? 0; // domain B — Incident Classification

  const output_payload = {
    score_pct:    scorePct,
    grade:        overallGrade,
    grade_title:  GRADE_TITLES[overallGrade],
    domain_scores: domainScores,
    gaps_count:   gaps.length,
    gaps,
    all_answered: allAnswered,
    supervisory_exposure:        scorePct < 70,
    immediate_action_required:   scorePct < 40,
    incident_route_recommended:  incidentDomainPct < 67,
    regulatory_framework:        'DORA (EU) 2022/2554 · EBA/ESMA/EIOPA RTS on ICT risk management · JC 2023 83',
    applicable_deadline_note:    'DORA in force January 2025 — ~22,000 in-scope entities across the EU',
  };

  const compliance_flags = scorePct < 40
    ? ['DORA_NOT_READY', 'IMMEDIATE_REMEDIATION_REQUIRED']
    : scorePct < 70
      ? ['DORA_GAPS_IDENTIFIED', 'SUPERVISORY_EXPOSURE']
      : ['DORA_REVIEW_READY'];

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type:       'infrastructure_mandate',
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

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, gpu: false, mandate_type: 'infrastructure_mandate' };
