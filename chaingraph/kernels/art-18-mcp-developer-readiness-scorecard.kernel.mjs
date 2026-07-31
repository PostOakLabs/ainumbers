/**
 * art-18-mcp-developer-readiness-scorecard.kernel.mjs
 * Server-side port of the deterministic MCP ship-readiness self-scorecard
 * (ORPHANNODE-ONBOARD-2). Rolls up caller-supplied yes/partial/no answers across the
 * six readiness sections (tool definitions, server.json/registry, OAuth 2.1, transport
 * security, tool-poisoning hygiene, spec-revision compliance) into an overall score
 * and a prioritized gap list. Self-reported rollup — validate each weak section with
 * its own deep-dive tool.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-18-mcp-developer-readiness-scorecard';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'score_mcp_server_readiness',
  mandate_type: 'compliance_control',
  gpu: false,
};

const SECTIONS = [
  { id: 'tooldef', name: 'Tool Definitions', toolLabel: 'T274 Linter',
    qs: [{ id: 'schema' }, { id: 'desc' }, { id: 'ann' }] },
  { id: 'serverjson', name: 'server.json / Registry', toolLabel: 'T275 Validator',
    qs: [{ id: 'name' }, { id: 'meta' }, { id: 'pkg' }] },
  { id: 'oauth', name: 'OAuth 2.1 Authorization', toolLabel: 'T278 Auditor',
    qs: [{ id: 'prm' }, { id: 'aud' }, { id: 'pass' }] },
  { id: 'transport', name: 'Transport Security', toolLabel: 'T284 Auditor',
    qs: [{ id: 'origin' }, { id: 'bind' }] },
  { id: 'poison', name: 'Tool-Poisoning Hygiene', toolLabel: 'T282 Scanner',
    qs: [{ id: 'clean' }, { id: 'trust' }] },
  { id: 'spec', name: 'Spec-Revision Compliance', toolLabel: 'T280 Scorer',
    qs: [{ id: 'rev' }, { id: 'stateless' }] },
];

const VALID_ANSWERS = ['yes', 'partial', 'no'];

export function compute(pp) {
  pp = pp || {};
  const answersIn = (pp.answers && typeof pp.answers === 'object') ? pp.answers : {};

  const secResults = [];
  const gaps = [];
  const answers_used = {};
  let totalGot = 0;
  let totalMax = 0;

  SECTIONS.forEach((s) => {
    let got = 0;
    const max = s.qs.length * 2;
    s.qs.forEach((q) => {
      const key = `${s.id}_${q.id}`;
      const raw = answersIn[key];
      const v = VALID_ANSWERS.includes(raw) ? raw : 'no';
      answers_used[key] = v;
      got += v === 'yes' ? 2 : v === 'partial' ? 1 : 0;
      if (v === 'no') gaps.push({ section: s.name, tool: s.toolLabel, question_id: q.id, severity: 'gap' });
      else if (v === 'partial') gaps.push({ section: s.name, tool: s.toolLabel, question_id: q.id, severity: 'partial' });
    });
    const pct = Math.round((got / max) * 100);
    secResults.push({ id: s.id, name: s.name, tool: s.toolLabel, pct });
    totalGot += got;
    totalMax += max;
  });

  const overall = totalMax > 0 ? Math.round((totalGot / totalMax) * 100) : 0;
  const verdict = overall >= 90 ? 'Ship-ready.'
    : overall >= 70 ? 'Nearly there — close the gaps below.'
    : overall >= 50 ? 'Not ready — several sections need work.'
    : 'Significant work before shipping.';

  const output_payload = {
    overall,
    verdict,
    sections: secResults,
    gaps_count: gaps.length,
    gaps,
    answers_used,
    note: 'Self-reported rollup across six MCP ship-readiness sections. Validate each weak section with its own deep-dive tool before treating this as a launch gate.',
  };

  const compliance_flags = [];
  if (overall >= 90) compliance_flags.push('SHIP_READY');
  if (gaps.some((g) => g.severity === 'gap')) compliance_flags.push('READINESS_GAPS_FOUND');

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
