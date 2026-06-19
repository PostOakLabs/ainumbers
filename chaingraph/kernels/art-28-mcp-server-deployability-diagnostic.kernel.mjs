export const meta = {
  tool_id: 'art-28-mcp-server-deployability-diagnostic',
  mcp_name: 'run_mcp_deployability_diagnostic',
  mandate_type: 'agent_guardrail_mandate',
};

// 4 domains × 3 questions = 12 (q1–q12)
const DOMAINS = [
  { id: 'defs',      label: 'Tool Definitions & Schemas', qs: ['q1','q2','q3'] },
  { id: 'transport', label: 'Transport & Auth',            qs: ['q4','q5','q6'] },
  { id: 'security',  label: 'Security Hygiene',            qs: ['q7','q8','q9'] },
  { id: 'ops',       label: 'Operations',                  qs: ['q10','q11','q12'] },
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
  const is_deployable = g === 'A' || g === 'B';

  const compliance_flags = {
    MCP_DEPLOYABILITY_SCORED: true,
    MCP_SERVER_DEPLOYABLE: is_deployable,
    MCP_SERVER_NOT_DEPLOYABLE: !is_deployable,
    TOOL_DEFINITIONS_GAP: domain_scores.defs.pct < 70,
    TRANSPORT_AUTH_GAP: domain_scores.transport.pct < 70,
    SECURITY_HYGIENE_GAP: domain_scores.security.pct < 70,
    OPERATIONS_GAP: domain_scores.ops.pct < 70,
  };

  return {
    verdict: g,
    score_pct,
    domain_scores,
    gaps,
    all_answered,
    is_deployable,
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
