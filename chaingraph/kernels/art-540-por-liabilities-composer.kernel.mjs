import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-540-por-liabilities-composer';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_por_liabilities_composite',
  mandate_type: 'compliance_mandate', gpu: false,
};

// PoR-liabilities composer (art-540), per EXCHANGE-ASSURANCE-BUILD-SPEC.md SS2.3 -- composes
// with art-280-reserve-proof-verifier as a soft-dep input (same optional-composition pattern
// art-280 already uses for VR-1 storage_proof_composition) plus a caller-supplied aggregate
// liabilities figure. Does NOT edit art-280's kernel (hash-neutral != proof-neutral, memory
// feedback-hash-neutral-is-not-proof-neutral) -- composition happens entirely in this new node.
//
// por_input carries the caller-restated subset of art-280's own output_payload
// (inclusion_verified, computed_root.sum) -- field names reused verbatim per SPEC.md SS27, not
// renamed. If absent (the soft dep not supplied), inclusion is treated as NOT verified -- a
// fail-safe default, never an assumed pass.
//
// reported_total_liabilities_musd missing, null, or <= 0 is treated uniformly as "no liabilities
// figure supplied" (LIABILITIES_INPUT_MISSING) -- a non-positive liabilities total is not a
// meaningful denominator, so it collapses into the same missing-input case rather than a
// division artifact (never NaN/Infinity).
//
// Determination priority (liabilities-input check first, since without it no ratio exists to
// evaluate): LIABILITIES_INPUT_MISSING > INCLUSION_FAILED > LIABILITIES_UNDERCOVERED (ratio < 1)
// > INCLUSION_AND_LIABILITIES_CONSISTENT.
//
// HARD NON-CLAIM (carried forward from art-280, plus this node's own): this node verifies
// internal consistency between a PoR inclusion result and a claimed liabilities total -- it does
// NOT independently audit the liabilities figure's source.
//
// Pure ECMA-262 arithmetic only -- no Date.now/argless new Date(), no Math.random, no
// crypto.subtle (not needed here; no hashing performed inside compute()).

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r4(v) { return (v === null || !Number.isFinite(v)) ? null : Math.round(v * 10000) / 10000; }
function s(v) { return String(v == null ? '' : v).trim(); }

const NOT_PROVEN = [
  { item: 'Total liabilities completeness', detail: 'Only the audited customer set is provable from a single-leaf inclusion proof. An issuer could omit accounts from the tree entirely and this proof cannot detect the omission.' },
  { item: 'Off-balance-sheet encumbrances', detail: 'Pledges, rehypothecation, or liens against reserve assets are not visible in a Merkle-sum inclusion proof.' },
  { item: 'Continuous solvency', detail: 'This is a point-in-time snapshot at attestation time, not a continuous or real-time solvency guarantee.' },
  { item: 'PCAOB audit opinion', detail: 'This tool performs no audit and carries no PCAOB or other audit-firm opinion; it is a cryptographic inclusion check only.' },
  { item: 'Liabilities figure provenance', detail: 'reported_total_liabilities_musd is caller-asserted, not independently audited -- this node verifies internal consistency between a PoR inclusion result and a claimed liabilities total, it does not audit the liabilities source.' },
];

/**
 * compute(pp) -- pure PoR/liabilities composite determination.
 * pp: {
 *   por_input?: { inclusion_verified: boolean, computed_root?: { sum: number } } | null,
 *   reported_total_liabilities_musd?: number | null,
 *   liabilities_attestation_source?: string,
 * }
 */
export function compute(pp) {
  pp = pp || {};
  const porInput = pp.por_input ?? null;
  const inclusionVerified = porInput ? Boolean(porInput.inclusion_verified) : false;
  const computedRootSumMusd = (porInput && porInput.computed_root)
    ? safeNum(porInput.computed_root.sum, 0) : 0;

  const reportedRaw = pp.reported_total_liabilities_musd;
  const reportedNum = safeNum(reportedRaw, null);
  const liabilitiesSupplied = reportedNum != null && reportedNum > 0;
  const liabilities_attestation_source = s(pp.liabilities_attestation_source);

  const reserve_to_liability_ratio = liabilitiesSupplied
    ? r4(computedRootSumMusd / reportedNum) : null;

  let composite_determination;
  if (!liabilitiesSupplied) composite_determination = 'LIABILITIES_INPUT_MISSING';
  else if (!inclusionVerified) composite_determination = 'INCLUSION_FAILED';
  else if (reserve_to_liability_ratio < 1) composite_determination = 'LIABILITIES_UNDERCOVERED';
  else composite_determination = 'INCLUSION_AND_LIABILITIES_CONSISTENT';

  const compliance_flags = [`COMPOSITE_${composite_determination}`];
  if (!porInput) compliance_flags.push('POR_INPUT_STUBBED');
  if (composite_determination === 'INCLUSION_AND_LIABILITIES_CONSISTENT') compliance_flags.push('POR_LIABILITIES_CLEAN');

  const output_payload = {
    composite_determination,
    reserve_to_liability_ratio,
    inclusion_verified: inclusionVerified,
    computed_root: { sum: computedRootSumMusd },
    reported_total_liabilities_musd: liabilitiesSupplied ? reportedNum : null,
    liabilities_attestation_source: liabilities_attestation_source || null,
    por_input_supplied: Boolean(porInput),
    not_proven: NOT_PROVEN,
    formula: 'reserve_to_liability_ratio = computed_root.sum / reported_total_liabilities_musd',
    note: 'Composes with art-280-reserve-proof-verifier (soft-dep, not_proven carried forward unchanged plus its own). Verifies internal consistency between a PoR inclusion result and a claimed liabilities total; does not audit the liabilities source. Voluntary industry practice (Summa-report-structure lineage), not a codified regime requirement as of this writing.',
    regulatory_framework: 'Voluntary proof-of-reserves-plus-liabilities attestation practice; not a codified regime requirement as of this writing.',
  };

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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
