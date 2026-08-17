import { executionHash } from './_hash.mjs';

// art-645-compute-index-weights — Compute Index Weights: pure attestation kernel.
//
// Second entry of the Financial Index/Benchmark Administrator Lineage family
// (INDEX-LINEAGE-BUILD-SPEC.md, weighting-computation receipts section). Computes
// (or receipts an externally-declared) weight per constituent from a stated
// methodology and inputs, giving the weight set its own citable artifact separate
// from the constituent-membership fact in art-557.
//
// HARD FENCE (receipt MUST record this, copy MUST lead with it): every input row
// (market_cap/price/float_factor/factor_score) is SUPPLIED by the caller and
// merely ASSERTED -- this kernel performs zero market-data lookups (zero-egress
// by contract, no network calls). It attests THAT a weight set was computed
// exactly as stated from the declared inputs and methodology -- nothing about
// whether those inputs are accurate. Fence matches art-557/art-373.
//
// `constituents_ref` is OPTIONAL — a caller with no art-557 artifact yet still
// gets a valid weighting receipt over its declared constituent list; the caller
// populates chain.parent_hashes/parent_tool_ids via buildArtifact()'s options
// only when constituents_ref is supplied (this kernel itself never re-derives
// that linkage — see art-557's own compute()).

const TOOL_ID = 'art-645-compute-index-weights';
const TOOL_VERSION = '1.0.0';
const WEIGHT_SUM_TOLERANCE = 1e-9;

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_index_weights',
  mandate_type: 'attestation_mandate', gpu: false,
};

const NOT_PROVEN = [
  { item: 'Input-data accuracy', detail: 'Every market_cap/price/float_factor/factor_score value is caller-supplied and asserted. This kernel performs no market-data or index-provider lookups (zero-egress) and does not verify these values against any external source.' },
  { item: 'Constituent-set membership', detail: 'This kernel computes weights over the supplied inputs list; it does not itself verify that the list matches any particular constituent-set attestation (art-557), even when constituents_ref is supplied for citation.' },
  { item: 'Regulatory benchmark-administrator compliance', detail: 'EU Benchmark Regulation (BMR, Regulation (EU) 2016/1011) Art 12(1) and SEBI (Index Providers) Regulations, 2024 Reg 18(1)/18(3) references are informative context only; this kernel makes no claim of compliance with either.' },
];

const METHODOLOGIES = new Set(['market-cap', 'float-adjusted-market-cap', 'equal-weight', 'price-weight', 'factor-tilted']);

function normalizeInput(row) {
  row = row || {};
  return {
    security_id: row.security_id ?? null,
    market_cap: Number.isFinite(row.market_cap) ? row.market_cap : null,
    price: Number.isFinite(row.price) ? row.price : null,
    float_factor: Number.isFinite(row.float_factor) ? row.float_factor : null,
    factor_score: Number.isFinite(row.factor_score) ? row.factor_score : null,
    currency: row.currency ?? null,
  };
}

// Returns the basis value used by a methodology for one input row, or null if the
// field required by that methodology is absent/non-finite on that row.
function basisFor(methodology, row) {
  if (methodology === 'market-cap') return row.market_cap;
  if (methodology === 'float-adjusted-market-cap') {
    return row.market_cap != null && row.float_factor != null ? row.market_cap * row.float_factor : null;
  }
  if (methodology === 'equal-weight') return 1;
  if (methodology === 'price-weight') return row.price;
  if (methodology === 'factor-tilted') return row.factor_score;
  return null;
}

/**
 * compute(pp) — pure weighting-computation kernel.
 * pp: {
 *   index_id: string,
 *   as_of_date: string,
 *   weighting_methodology: 'market-cap'|'float-adjusted-market-cap'|'equal-weight'|'price-weight'|'factor-tilted',
 *   constituents_ref?: { execution_hash: string, tool_id: string },
 *   inputs: [{ security_id, market_cap?, price?, float_factor?, factor_score?, currency? }],
 * }
 */
export function compute(pp) {
  pp = pp || {};
  const indexId = pp.index_id ?? null;
  const asOfDate = pp.as_of_date ?? null;
  const methodology = pp.weighting_methodology ?? null;
  const inputsRaw = Array.isArray(pp.inputs) ? pp.inputs : [];
  const inputs = inputsRaw.map(normalizeInput);
  const constituentsRef = pp.constituents_ref && pp.constituents_ref.execution_hash
    ? { execution_hash: pp.constituents_ref.execution_hash, tool_id: pp.constituents_ref.tool_id ?? null }
    : null;

  let structuralError = null;
  if (!indexId) structuralError = 'index_id is required.';
  else if (!asOfDate) structuralError = 'as_of_date is required.';
  else if (!methodology || !METHODOLOGIES.has(methodology)) structuralError = 'weighting_methodology must be one of market-cap, float-adjusted-market-cap, equal-weight, price-weight, factor-tilted.';
  else if (inputs.length === 0) structuralError = 'inputs must be a non-empty array.';

  let weights = [];
  let weightSumCheck = null;
  let missingBasisCount = 0;

  if (!structuralError) {
    const basisValues = inputs.map((row) => basisFor(methodology, row));
    missingBasisCount = basisValues.filter((v) => v == null).length;
    const basisSum = basisValues.reduce((acc, v) => acc + (v ?? 0), 0);
    if (missingBasisCount > 0) {
      structuralError = `${missingBasisCount} input row(s) are missing the field required by weighting_methodology="${methodology}".`;
    } else if (basisSum <= 0) {
      structuralError = 'the sum of weighting-basis values must be strictly positive.';
    } else {
      weights = inputs.map((row, i) => ({ security_id: row.security_id, weight: basisValues[i] / basisSum }));
      weightSumCheck = weights.reduce((acc, w) => acc + w.weight, 0);
    }
  }

  const weightSumWithinTolerance = weightSumCheck != null && Math.abs(weightSumCheck - 1) <= WEIGHT_SUM_TOLERANCE;

  const compliance_flags = [];
  if (structuralError) compliance_flags.push('INDEX_WEIGHTS_STRUCTURAL_ERROR');
  else compliance_flags.push('INDEX_WEIGHTS_COMPUTED');
  if (!structuralError && !weightSumWithinTolerance) compliance_flags.push('INDEX_WEIGHTS_SUM_CHECK_FAILED');
  if (!structuralError) compliance_flags.push('INDEX_WEIGHTS_INPUTS_SUPPLIED_NOT_VERIFIED');
  if (constituentsRef) compliance_flags.push('INDEX_WEIGHTS_CITES_CONSTITUENTS_REF');

  const methodologyNotes = `weight_i = basis_i / sum(basis) under methodology="${methodology ?? 'unset'}"; basis is ${methodology === 'market-cap' ? 'market_cap' : methodology === 'float-adjusted-market-cap' ? 'market_cap * float_factor' : methodology === 'equal-weight' ? '1 (uniform)' : methodology === 'price-weight' ? 'price' : methodology === 'factor-tilted' ? 'factor_score' : 'undefined'} per constituent.`;

  const output_payload = {
    index_id: indexId,
    as_of_date: asOfDate,
    structural_error: structuralError,
    weighting_methodology: methodology,
    constituents_ref: constituentsRef,
    weights,
    weight_sum_check: weightSumCheck,
    weight_sum_within_tolerance: structuralError ? null : weightSumWithinTolerance,
    methodology_notes: methodologyNotes,
    not_proven: NOT_PROVEN,
    fence: 'Every input row (market_cap/price/float_factor/factor_score) is SUPPLIED, asserted, and digested into this receipt. This kernel attests THAT a weight set was computed exactly as stated from the declared inputs and methodology -- never a verification of those inputs against market data, never a live index-data feed (zero-egress by contract).',
    regulatory_framework: 'EU Benchmark Regulation (BMR, Regulation (EU) 2016/1011) Art 12(1) and SEBI (Index Providers) Regulations, 2024 Reg 18(1)/18(3) references are informative context only; this kernel makes no compliance claim under either.',
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
