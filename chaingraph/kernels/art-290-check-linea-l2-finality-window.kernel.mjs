import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-290-check-linea-l2-finality-window';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'check_linea_l2_finality_window',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

// Classifies a tokenized-deposit transfer's finality risk from SUPPLIED
// L2-batch / L1-finalization state. Never observes a chain or an RPC endpoint
// (SLI-WAVE-1 §5 hard doctrine). Tier ranking is a generic optimistic/batched
// L2-to-L1 model, not a claim of Linea-specific published finality windows
// (unpublished as of SLI-WAVE-1 STEP-0 re-verify -- draft-pinned).
const TIER_RANK = { soft: 0, batched: 1, l1_final: 2 };

function classifyTier(batchSubmissionStatus, l1FinalizationStatus) {
  if (l1FinalizationStatus === 'finalized') return 'l1_final';
  if (batchSubmissionStatus === 'submitted' || batchSubmissionStatus === 'batched') return 'batched';
  return 'soft';
}

const REORG_RISK_BY_TIER = { soft: 'high', batched: 'low', l1_final: 'none' };

export function compute(pp) {
  const l2Block = pp.l2_block == null ? null : pp.l2_block;
  const batchSubmissionStatus = pp.batch_submission_status || 'unsubmitted';
  const l1FinalizationStatus = pp.l1_finalization_status || 'pending';
  const corridorCutoff = Object.prototype.hasOwnProperty.call(TIER_RANK, pp.corridor_cutoff) ? pp.corridor_cutoff : 'l1_final';
  const assetType = pp.asset_type || 'tokenized_deposit';

  const finality_tier = classifyTier(batchSubmissionStatus, l1FinalizationStatus);
  const reorg_window_risk = REORG_RISK_BY_TIER[finality_tier];
  const safe_to_release = TIER_RANK[finality_tier] >= TIER_RANK[corridorCutoff];

  const rationale = [
    `l2_block=${l2Block == null ? 'n/a' : l2Block}, batch_submission_status=${batchSubmissionStatus}, l1_finalization_status=${l1FinalizationStatus}, asset_type=${assetType}.`,
    `Classified finality_tier="${finality_tier}" (reorg_window_risk="${reorg_window_risk}") from supplied state only; this kernel classifies supplied state and does NOT observe the chain.`,
    safe_to_release
      ? `finality_tier meets or exceeds the required corridor_cutoff ("${corridorCutoff}"); release is safe under the supplied policy.`
      : `finality_tier is below the required corridor_cutoff ("${corridorCutoff}"); release is NOT safe under the supplied policy.`,
  ];

  const output_payload = {
    finality_tier,
    reorg_window_risk,
    safe_to_release,
    corridor_cutoff: corridorCutoff,
    rationale,
    draft_pinned: true,
  };
  const compliance_flags = safe_to_release
    ? ['SLI_FINALITY_SAFE_TO_RELEASE']
    : ['SLI_FINALITY_HOLD', 'ESCALATION_RAISED'];

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
