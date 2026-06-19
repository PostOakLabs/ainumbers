export const meta = {
  tool_id: 'art-27-agentic-readiness-diagnostic',
  mcp_name: 'run_agentic_readiness_diagnostic',
  mandate_type: 'agent_guardrail_mandate',
};

// 4 domains × 3 questions = 12 (q1–q12)
const DOMAINS = [
  { id: 'policy',   label: 'Policy & Mandates',         qs: ['q1','q2','q3'] },
  { id: 'protocol', label: 'Protocol Formalisation',     qs: ['q4','q5','q6'] },
  { id: 'controls', label: 'Financial-Crime Controls',   qs: ['q7','q8','q9'] },
  { id: 'runtime',  label: 'MCP Runtime Operations',     qs: ['q10','q11','q12'] },
];

const VALUES = { yes: 2, partial: 1, no: 0 };

function grade(pct) {
  return pct >= 85 ? 'A' : pct >= 70 ? 'B' : pct >= 55 ? 'C' : pct >= 40 ? 'D' : 'F';
}

export function compute(pp) {
  let total = 0, max = 0;
  const domain_scores = {};
  const gaps = [];
  let all_answered = true;

  let qn = 0;
  for (const d of DOMAINS) {
    let t = 0, m = 0;
    for (const q of d.qs) {
      qn++;
      let v = pp[q] ?? pp['q' + qn];
      if (!v || !(v in VALUES)) { all_answered = false; v = 'no'; }
      t += VALUES[v];
      m += 2;
      if (v !== 'yes') gaps.push({ question: q, domain: d.id, severity: v === 'no' ? 'no' : 'partial' });
    }
    domain_scores[d.id] = { label: d.label, pct: Math.round(100 * t / m) };
    total += t;
    max += m;
  }

  const score_pct = Math.round(100 * total / max);
  const g = grade(score_pct);
  const is_ready = g === 'A' || g === 'B';

  const compliance_flags = {
    AGENTIC_READINESS_SCORED: true,
    AGENT_PAYMENTS_READY: is_ready,
    AGENT_PAYMENTS_NOT_READY: !is_ready,
    POLICY_GAP: domain_scores.policy.pct < 70,
    PROTOCOL_GAP: domain_scores.protocol.pct < 70,
    CONTROLS_GAP: domain_scores.controls.pct < 70,
    RUNTIME_GAP: domain_scores.runtime.pct < 70,
  };

  return {
    verdict: g,
    score_pct,
    domain_scores,
    gaps,
    all_answered,
    is_ready,
    compliance_flags,
  };
}

export function buildArtifact(pp, opts = {}) {
  const result = compute(pp);
  return {
    tool_id: meta.tool_id,
    mcp_name: meta.mcp_name,
    mandate_type: meta.mandate_type,
    ...result,
  };
}
