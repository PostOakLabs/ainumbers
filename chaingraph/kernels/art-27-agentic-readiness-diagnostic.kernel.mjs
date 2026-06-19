import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-27-agentic-readiness-diagnostic';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'run_agentic_readiness_diagnostic',
  mandate_type: 'agent_guardrail_mandate',
  gpu: false,
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

  const output_payload = { verdict: g, score_pct, domain_scores, gaps, all_answered, is_ready };
  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    ap2_version: '1.0.0',
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
