import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-307-claim-dispute-bundle-builder';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'build_claim_dispute_bundle',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Honesty guard (INSURANCE-EVIDENCE-SPEC.md §GUARDS, binding): the dossier records a
// REPLAYABLE claim (measured-vs-threshold breach/no-breach from the supplied receipts),
// NEVER a settlement decision. Two-sided: serves both the underwriter and the insured party
// reviewing the same replay instructions. claim_strength is the honest status of the bound
// execution_claim, never inflated by the presence of a KPI breach input.

function measuredAggregate(receipts) {
  const values = receipts.map((r) => r && r.measured_metric).filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function compute(pp) {
  const execution_claim = (pp && typeof pp.execution_claim === 'object' && pp.execution_claim) || null;
  const challenge = (pp && typeof pp.challenge === 'object' && pp.challenge) || null;
  const warranty = (pp && typeof pp.warranty_kpi_breach === 'object' && pp.warranty_kpi_breach) || null;

  const claim_digest = execution_claim && typeof execution_claim.execution_hash === 'string' ? execution_claim.execution_hash : null;
  const challenge_digest = challenge && typeof challenge.digest === 'string' ? challenge.digest : null;
  const claim_receipts = execution_claim && Array.isArray(execution_claim.receipts) ? execution_claim.receipts : [];
  const validReceipts = claim_receipts.filter((r) => r && typeof r.receipt_hash === 'string' && r.receipt_hash.length > 0);

  let claim_strength;
  if (!claim_digest) claim_strength = 'missing';
  else if (validReceipts.length > 0 && validReceipts.length === claim_receipts.length) claim_strength = 'receipt-backed';
  else claim_strength = 'attestation-only';

  const replay_instructions = claim_digest
    ? `Replay tool_id ${execution_claim.tool_id || 'unknown'} with the recorded policy_parameters and confirm execution_hash reproduces ${claim_digest}; cross-check ${validReceipts.length} bound receipt(s).`
    : null;

  let kpi_breach = null;
  if (warranty && typeof warranty.kpi === 'string' && typeof warranty.threshold === 'number') {
    const kpiReceipts = Array.isArray(warranty.receipts) ? warranty.receipts : [];
    const measured = measuredAggregate(kpiReceipts);
    const direction = warranty.direction === 'above' ? 'above' : 'below';
    const breached = measured === null ? false : (direction === 'below' ? measured < warranty.threshold : measured > warranty.threshold);
    kpi_breach = { kpi: warranty.kpi, threshold: warranty.threshold, measured, breached };
  }

  const bundle_claim_strength = claim_strength;
  const insufficient_evidence = !claim_digest && !challenge_digest;

  const compliance_flags = ['CLAIM_DISPUTE_BUNDLE_BUILT', kpi_breach && kpi_breach.breached ? 'WARRANTY_KPI_BREACH_RECORDED' : 'NO_KPI_BREACH_RECORDED'];

  return {
    output_payload: { claim_digest, challenge_digest, replay_instructions, receipts: validReceipts, kpi_breach, bundle_claim_strength, insufficient_evidence },
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
