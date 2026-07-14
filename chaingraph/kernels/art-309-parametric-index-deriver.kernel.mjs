import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-309-parametric-index-deriver';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'derive_parametric_index_from_receipts',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Honesty guard (INSURANCE-EVIDENCE-SPEC.md §GUARDS, binding): the index_value is a
// REPLAYABLE derived value, NEVER a settlement trigger by itself. This is a thin kernel:
// it derives an index from receipts (an oracle replacement -- replay-on-challenge instead
// of trust-the-feed); it feeds the shipped compute_parametric_trigger_payout kernel
// (art-251-compute-parametric-trigger-payout), which does the actual payout math. Never
// reimplement that payout logic here.

const AGGREGATIONS = ['mean', 'sum', 'count', 'max', 'min'];

export function compute(pp) {
  const receipts = Array.isArray(pp && pp.receipts) ? pp.receipts : [];
  const index_def = (pp && typeof pp.index_def === 'object' && pp.index_def) || {};
  const metric = typeof index_def.metric === 'string' ? index_def.metric : null;
  const aggregation = AGGREGATIONS.includes(index_def.aggregation) ? index_def.aggregation : 'mean';
  const window = index_def.window !== undefined ? index_def.window : null;

  const values = receipts
    .filter((r) => r && typeof r.receipt_hash === 'string' && r.receipt_hash.length > 0 && typeof r.measured_metric === 'number' && Number.isFinite(r.measured_metric))
    .map((r) => r.measured_metric);

  const insufficient_evidence = values.length === 0;
  let index_value = 0;
  if (!insufficient_evidence) {
    if (aggregation === 'sum') index_value = values.reduce((a, b) => a + b, 0);
    else if (aggregation === 'count') index_value = values.length;
    else if (aggregation === 'max') index_value = Math.max(...values);
    else if (aggregation === 'min') index_value = Math.min(...values);
    else index_value = values.reduce((a, b) => a + b, 0) / values.length; // mean
  }

  const compliance_flags = ['PARAMETRIC_INDEX_DERIVED', insufficient_evidence ? 'PARAMETRIC_INDEX_INSUFFICIENT_EVIDENCE' : 'PARAMETRIC_INDEX_OK'];

  return {
    output_payload: { metric, aggregation, index_value, contributing_receipts: values.length, window, insufficient_evidence },
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
