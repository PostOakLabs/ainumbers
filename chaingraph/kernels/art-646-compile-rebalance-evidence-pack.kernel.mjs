import { executionHash } from './_hash.mjs';

// art-646-compile-rebalance-evidence-pack — Compile Rebalance Evidence Pack: pure
// compliance-mandate kernel.
//
// Third entry of the Financial Index/Benchmark Administrator Lineage family
// (INDEX-LINEAGE-BUILD-SPEC.md, rebalance evidence pack section). Packages one
// rebalance event -- the current period's constituent set and weight set, plus
// the prior period's for diffing --
// into a regulator-shaped bundle: what changed (additions/removals/weight
// deltas), citing the underlying receipts rather than recomputing them. This is
// the vertical's answer to a BMR "administrator's oversight function" record and
// a SEBI benchmark-administrator disclosure pack.
//
// HARD FENCE (receipt MUST record this, copy MUST lead with it): this bundle
// CITES the referenced art-557/art-645 receipts (execution_hash + tool_id); it
// does not re-run or independently verify the weighting arithmetic against a
// third-party feed, and it makes no claim of BMR/SEBI compliance -- informative
// citation only, matching the convention already established on art-373 and the
// NAV-error evidence pack. The current/prior constituent and weight ROWS used
// for the diff are themselves caller-supplied and asserted (zero-egress), same
// fence as art-557/art-645.

const TOOL_ID = 'art-646-compile-rebalance-evidence-pack';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compile_rebalance_evidence_pack',
  mandate_type: 'compliance_mandate', gpu: false,
};

const NOT_PROVEN = [
  { item: 'Underlying receipt re-verification', detail: 'This kernel cites the supplied constituents_ref/weights_ref execution_hash + tool_id pairs; it does not re-run or independently re-derive the art-557/art-645 receipts those hashes point to.' },
  { item: 'Diff-row accuracy', detail: 'The current-period and prior-period constituent/weight rows used to compute additions, removals and weight_deltas are caller-supplied and asserted. This kernel performs no index-provider or market-data lookups (zero-egress).' },
  { item: 'Rebalance-execution correctness', detail: 'This bundle attests THAT a rebalance was declared with the stated additions/removals/weight deltas on the stated date, citing the referenced receipts. It is not a determination that the rebalance was correctly executed against live market data, and not evidence the eligibility criteria was correctly applied.' },
  { item: 'Regulatory benchmark-administrator compliance', detail: 'EU Benchmark Regulation (BMR, Regulation (EU) 2016/1011) Art 13(1) and SEBI (Index Providers) Regulations, 2024 Reg 19(2)/19(3) references are informative context only; this kernel makes no claim of compliance with either.' },
];

function normalizeRows(rows, keyField = 'security_id') {
  return (Array.isArray(rows) ? rows : []).filter((r) => r && r[keyField]);
}

function toWeightMap(rows) {
  const map = new Map();
  for (const r of normalizeRows(rows)) map.set(r.security_id, Number.isFinite(r.weight) ? r.weight : null);
  return map;
}

function normalizeRef(ref) {
  return ref && ref.execution_hash ? { execution_hash: ref.execution_hash, tool_id: ref.tool_id ?? null } : null;
}

/**
 * compute(pp) — pure rebalance-evidence-pack kernel.
 * pp: {
 *   index_id: string,
 *   rebalance_date: string,
 *   current: { constituents_ref?, constituents?: [{security_id,...}], weights_ref?, weights?: [{security_id,weight}] },
 *   prior?: { constituents_ref?, constituents?: [...], weights_ref?, weights?: [...] },  // omitted on a first rebalance
 * }
 */
export function compute(pp) {
  pp = pp || {};
  const indexId = pp.index_id ?? null;
  const rebalanceDate = pp.rebalance_date ?? null;
  const current = pp.current || {};
  const prior = pp.prior || null;

  const currentConstituents = normalizeRows(current.constituents);
  const priorConstituents = prior ? normalizeRows(prior.constituents) : [];
  const currentWeights = toWeightMap(current.weights);
  const priorWeights = prior ? toWeightMap(prior.weights) : new Map();

  let structuralError = null;
  if (!indexId) structuralError = 'index_id is required.';
  else if (!rebalanceDate) structuralError = 'rebalance_date is required.';
  else if (currentConstituents.length === 0) structuralError = 'current.constituents must be a non-empty array.';

  const currentIds = new Set(currentConstituents.map((c) => c.security_id));
  const priorIds = new Set(priorConstituents.map((c) => c.security_id));

  const additions = structuralError ? [] : currentConstituents.filter((c) => !priorIds.has(c.security_id));
  const removals = structuralError ? [] : priorConstituents.filter((c) => !currentIds.has(c.security_id));

  const weight_deltas = [];
  if (!structuralError) {
    const allIds = new Set([...currentIds, ...priorIds]);
    for (const id of allIds) {
      const priorWeight = priorWeights.has(id) ? priorWeights.get(id) : null;
      const newWeight = currentWeights.has(id) ? currentWeights.get(id) : null;
      if (priorWeight !== newWeight) weight_deltas.push({ security_id: id, prior_weight: priorWeight, new_weight: newWeight });
    }
  }

  const cited_receipts = [];
  const currentConstituentsRef = normalizeRef(current.constituents_ref);
  const currentWeightsRef = normalizeRef(current.weights_ref);
  const priorConstituentsRef = prior ? normalizeRef(prior.constituents_ref) : null;
  const priorWeightsRef = prior ? normalizeRef(prior.weights_ref) : null;
  if (currentConstituentsRef) cited_receipts.push({ ...currentConstituentsRef, role: 'current_constituents' });
  if (currentWeightsRef) cited_receipts.push({ ...currentWeightsRef, role: 'current_weights' });
  if (priorConstituentsRef) cited_receipts.push({ ...priorConstituentsRef, role: 'prior_constituents' });
  if (priorWeightsRef) cited_receipts.push({ ...priorWeightsRef, role: 'prior_weights' });

  const compliance_flags = [];
  if (structuralError) compliance_flags.push('REBALANCE_PACK_STRUCTURAL_ERROR');
  else compliance_flags.push('REBALANCE_PACK_COMPILED');
  if (!structuralError && !prior) compliance_flags.push('REBALANCE_PACK_FIRST_REBALANCE_NO_PRIOR');
  if (!structuralError) compliance_flags.push('REBALANCE_PACK_INPUTS_SUPPLIED_NOT_VERIFIED');
  if (cited_receipts.length === 0 && !structuralError) compliance_flags.push('REBALANCE_PACK_NO_RECEIPT_CITATIONS');

  const output_payload = {
    index_id: indexId,
    rebalance_date: rebalanceDate,
    structural_error: structuralError,
    additions,
    removals,
    weight_deltas,
    cited_receipts,
    not_proven: NOT_PROVEN,
    fence: 'This bundle CITES the supplied constituents_ref/weights_ref receipts (execution_hash + tool_id); it does not re-run or independently verify the weighting arithmetic against a third-party feed, and it makes no claim of BMR/SEBI compliance -- informative citation only.',
    regulatory_framework: 'EU Benchmark Regulation (BMR, Regulation (EU) 2016/1011) Art 13(1) and SEBI (Index Providers) Regulations, 2024 Reg 19(2)/19(3) references are informative context only; this kernel makes no compliance claim under either.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
