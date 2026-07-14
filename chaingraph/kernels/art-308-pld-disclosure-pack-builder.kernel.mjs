import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-308-pld-disclosure-pack-builder';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'build_pld_disclosure_pack',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Honesty guard (INSURANCE-EVIDENCE-SPEC.md §GUARDS, binding): asserts "these inputs replay
// to this trace," framed as an EU PLD 2024/2853 disclosure/rebuttal artifact -- NEVER a
// legal conclusion of non-defectiveness. AILD is confirmed withdrawn (Oct 2025); PLD is the
// only surviving EU frame this maps to. National transposition text (H2 2026) is out of
// scope of this kernel's static rebuttal-trigger taxonomy (non_disclosure, ai_act_breach).

const PRESUMPTION_TRIGGERS = ['non_disclosure', 'ai_act_breach'];

export function compute(pp) {
  const disputed_window = (pp && typeof pp.disputed_window === 'object' && pp.disputed_window) || { from: null, to: null };
  const product_ref = typeof pp?.product_ref === 'string' ? pp.product_ref : null;
  const receipts = Array.isArray(pp && pp.receipts) ? pp.receipts : [];
  const alleged_defect = typeof pp?.alleged_defect === 'string' ? pp.alleged_defect : null;

  const hashes = receipts.map((r) => r && r.receipt_hash).filter((h) => typeof h === 'string' && h.length > 0).sort();
  const trace_digest = hashes.length > 0 ? `trace:${hashes.length}:${hashes.join(',')}` : null;

  const replay_instructions = receipts.length > 0
    ? `Replay each of the ${receipts.length} receipt(s) for ${product_ref || 'the product'} over the window ${disputed_window.from || '?'}..${disputed_window.to || '?'} and confirm execution_hash reproduces every receipt_hash in trace_digest.`
    : null;

  const rebuttal_mapping = PRESUMPTION_TRIGGERS.map((trigger) => ({
    presumption_trigger: trigger,
    rebutting_receipts: receipts.filter((r) => r && Array.isArray(r.rebuts) && r.rebuts.includes(trigger)).map((r) => r.receipt_hash).filter((h) => typeof h === 'string'),
  }));

  const gap_in_window = receipts.length === 0;
  const insufficient_evidence = gap_in_window;
  const anchor = pp && pp.anchor_document_integrity ? pp.anchor_document_integrity : null;

  const compliance_flags = ['PLD_DISCLOSURE_PACK_BUILT', gap_in_window ? 'PLD_GAP_IN_WINDOW' : 'PLD_TRACE_ASSEMBLED'];

  return {
    output_payload: {
      product_ref, disputed_window, trace_digest, replay_instructions, rebuttal_mapping,
      gap_in_window, insufficient_evidence, anchor, alleged_defect,
    },
    compliance_flags,
  };
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
