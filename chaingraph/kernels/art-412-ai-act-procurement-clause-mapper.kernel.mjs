import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-412-ai-act-procurement-clause-mapper';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'map_ai_act_procurement_clauses',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Maps an EU AI Act risk tier to the EU Commission's Model Contractual AI Clauses
// (MCC-AI) template selection and its Chapter III procurement clause set.
// REFERENCE-MODE (§3.3): MCC-AI redistribution terms are unclear, so this node
// never vendors clause text — it selects a template + clause-name list and points
// to the official source. Input risk_tier is a normalized string the caller derives
// from an upstream classifier (e.g. art-64 run_ai_act_highrisk_fit's high_risk_verdict,
// or art-67 classify_agentic_ai_risk's risk grade): pass 'high-risk' when the
// upstream verdict is anything other than out-of-scope, else 'light'.
// Not legal advice. Selection + pointer only, never bespoke drafting.

const OFFICIAL_SOURCE_URL = 'https://digital-strategy.ec.europa.eu/en/policies/model-contractual-ai-clauses';

const HIGH_RISK_CLAUSES = ['transparency', 'risk_management', 'data_governance', 'human_oversight', 'cybersecurity'];
const LIGHT_CLAUSES = ['transparency', 'record_keeping'];

function _str(v) { return typeof v === 'string' ? v : ''; }

export function compute(pp) {
  pp = pp || {};
  const checks = [];

  const risk_tier = _str(pp.risk_tier).trim().toLowerCase();
  const deployment_context = _str(pp.deployment_context).trim();

  const tierValid = risk_tier === 'high-risk' || risk_tier === 'light';
  checks.push({ check: 'risk_tier_valid', pass: tierValid,
    detail: tierValid ? risk_tier : 'risk_tier must be "high-risk" or "light" (derive from an upstream AI Act classifier)' });

  const allValid = checks.every(c => c.pass);

  const template = risk_tier === 'high-risk' ? 'High-Risk' : (risk_tier === 'light' ? 'Light' : null);
  const applicable_chapter_iii_clauses = risk_tier === 'high-risk' ? HIGH_RISK_CLAUSES : (risk_tier === 'light' ? LIGHT_CLAUSES : []);

  const variable_map = { risk_tier, deployment_context };

  const output_payload = {
    risk_tier: tierValid ? risk_tier : null,
    template,
    applicable_chapter_iii_clauses,
    official_source_url: OFFICIAL_SOURCE_URL,
    checks,
    variable_map,
    license_mode: 'reference-only',
    not_legal_advice: true,
    disclaimer: 'Not legal advice. This tool selects the EU Model Contractual AI Clauses (MCC-AI) template and Chapter III clause set that corresponds to the supplied AI Act risk tier, and points to the official source. It does not vendor, draft, or advise on clause text. Consult a licensed attorney for your jurisdiction.',
  };

  const compliance_flags = ['AI_ACT_CLAUSE_MAPPING', 'REFERENCE_MODE_NO_VENDORED_BODY', 'ZERO_PII', 'NOT_LEGAL_ADVICE'];
  if (!allValid) compliance_flags.push('RISK_TIER_INVALID');

  return { output_payload, compliance_flags };
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
