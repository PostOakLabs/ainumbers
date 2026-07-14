import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-313-traiga-exposure-assessor';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'assess_traiga_exposure',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Honesty guard (STATE-AI-WAVE-SPEC.md §D2 / wave-wide honesty invariants, binding): this
// asserts "these supplied attributes replay to this exposure/prohibited-use flag set against
// the pinned Texas TRAIGA text (HB 149, Tex. Bus. & Com. Code Ch. 552-553, eff. 2026-01-01),"
// NEVER "you are TRAIGA-compliant" or legal advice. Prohibited-use categories are the
// statute's INTENTIONAL-misuse list (accidental/unintentional impacts alone do not trigger
// a violation per the statute's intent standard) -- this kernel flags a supplied intentional-
// use assertion, it does not itself determine intent.

export const STATUTE_CITATION = 'Tex. Bus. & Com. Code Ch. 552-553 (TRAIGA, HB 149), eff. 2026-01-01';

export const PROHIBITED_USE_CATEGORIES = [
  'intentional_self_harm_incitement',
  'intentional_violence_incitement',
  'intentional_illegal_activity_facilitation',
  'intentional_unlawful_discrimination',
  'csam_or_illegal_sexual_content',
  'child_impersonation_sexual_chat',
];

export function compute(pp) {
  const deploys_in_texas = (pp && pp.deploys_in_texas === true) || false;
  const asserted_uses = Array.isArray(pp && pp.asserted_use_flags) ? pp.asserted_use_flags : [];

  const matched_prohibited_uses = asserted_uses.filter((f) => PROHIBITED_USE_CATEGORIES.includes(f));
  const prohibited_use_detected = matched_prohibited_uses.length > 0;
  const traiga_applicable = deploys_in_texas;

  const output_payload = {
    traiga_applicable,
    prohibited_use_detected,
    matched_prohibited_uses,
    statute_citation: STATUTE_CITATION,
    penalty_per_violation_usd: 200000,
    cure_window_days: 60,
  };

  const compliance_flags = ['TRAIGA_EXPOSURE_ASSESSED', prohibited_use_detected ? 'TRAIGA_PROHIBITED_USE_FLAGGED' : 'TRAIGA_NO_PROHIBITED_USE_ASSERTED'];

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.4/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
