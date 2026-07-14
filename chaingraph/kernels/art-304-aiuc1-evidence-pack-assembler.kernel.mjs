import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-304-aiuc1-evidence-pack-assembler';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'assemble_aiuc1_evidence_pack',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Honesty guard (INSURANCE-EVIDENCE-SPEC.md §GUARDS, binding): the pack asserts "these
// artifacts replay to these control bindings," NEVER "these controls are certified" or that
// any underwriter accepts the pack. claim_strength is the HONEST minimum across a control's
// bound artifacts -- a pack mixing receipt-backed and attestation-only controls is
// attestation-strength overall, not proven. Verify-side evidence assembly only.
//
// Never re-derives cadence: cadence_attestation, when supplied, is interpreted from a
// caller-precomputed gap table (meant to be sourced from the shipped
// aggregate_execution_receipts kernel, cry-05-agent-action-audit-trail-aggregator) -- this
// kernel does not reimplement receipt aggregation. anchor_document_integrity is an optional,
// documented pass-through tail; the pack is fully replayable without it.
//
// OSCAL export note: oscal_assessment_results follows the AI-evidence property-extension
// mapping described in arXiv:2604.13767 (16 AI-evidence property extensions, Apache-2.0
// reference implementation) so the pack is ingestible by generic OSCAL/GRC tooling. That
// paper is a documented mapping cited for interoperability, never a runtime dependency.

export const CATALOG_VERSION = '2026-Q1';

const STRENGTH_RANK = { 'receipt-backed': 2, 'attestation-only': 1, missing: 0 };
const STRENGTH_NAME = ['missing', 'attestation-only', 'receipt-backed'];

function resolveDigest(ref, artifacts) {
  const pools = [artifacts.receipts, artifacts.escalation_closures, artifacts.mandates];
  for (const pool of pools) {
    if (!Array.isArray(pool)) continue;
    const hit = pool.find((a) => a && (a.id === ref || a.digest === ref));
    if (hit && typeof hit.digest === 'string' && hit.digest.length > 0) return hit.digest;
  }
  return null;
}

export function compute(pp) {
  const aiuc1_version = pp && typeof pp.aiuc1_version === 'string' ? pp.aiuc1_version : null;
  const artifacts = (pp && typeof pp.artifacts === 'object' && pp.artifacts) || {};
  artifacts.receipts = Array.isArray(artifacts.receipts) ? artifacts.receipts : [];
  artifacts.escalation_closures = Array.isArray(artifacts.escalation_closures) ? artifacts.escalation_closures : [];
  artifacts.mandates = Array.isArray(artifacts.mandates) ? artifacts.mandates : [];
  const control_mapping = Array.isArray(pp.control_mapping) ? pp.control_mapping : [];

  if (aiuc1_version !== CATALOG_VERSION) {
    return {
      output_payload: {
        aiuc1_version, version_mismatch: true, controls: [], pack_claim_strength: 'insufficient',
        oscal_assessment_results: null, cadence_attestation: null, anchor: null,
      },
      compliance_flags: ['AIUC1_PACK_ASSEMBLED', 'AIUC1_VERSION_MISMATCH'],
    };
  }

  const controls = control_mapping.map((m) => {
    const control_id = typeof m?.control_id === 'string' ? m.control_id : null;
    const refs = Array.isArray(m?.artifact_refs) ? m.artifact_refs : [];
    const artifact_digests = refs.map((r) => resolveDigest(r, artifacts)).filter((d) => typeof d === 'string');
    let status;
    if (refs.length === 0) status = 'missing';
    else if (artifact_digests.length === refs.length) status = 'receipt-backed';
    else status = 'attestation-only';
    return { control_id, status, artifact_digests, claim_strength: status };
  });

  const bound = controls.filter((c) => c.status !== 'missing');
  const pack_claim_strength = bound.length === 0
    ? 'insufficient'
    : STRENGTH_NAME[Math.min(...bound.map((c) => STRENGTH_RANK[c.status]))];

  const oscal_assessment_results = controls.length > 0 ? {
    _source_citation: 'arXiv:2604.13767 AI-evidence property-extension mapping (Apache-2.0 reference implementation); documented mapping only, not a runtime dependency.',
    type: 'oscal-assessment-results',
    aiuc1_version,
    results: controls.map((c) => ({ control_id: c.control_id, state: c.status === 'receipt-backed' ? 'satisfied' : c.status === 'attestation-only' ? 'not-satisfied' : 'not-applicable' })),
  } : null;

  let cadence_attestation = null;
  const cadenceInput = pp && typeof pp.cadence_attestation_input === 'object' && pp.cadence_attestation_input;
  if (cadenceInput && Array.isArray(cadenceInput.max_gap_days_by_control)) {
    const period = Number.isFinite(pp.cadence_period_days) ? pp.cadence_period_days : 90;
    const rows = cadenceInput.max_gap_days_by_control.map((r) => ({
      control_id: typeof r?.control_id === 'string' ? r.control_id : null,
      max_gap_days: Number.isFinite(r?.max_gap_days) ? r.max_gap_days : null,
      within_cadence: Number.isFinite(r?.max_gap_days) ? r.max_gap_days <= period : false,
    }));
    cadence_attestation = { period_days: period, rows, all_within_cadence: rows.every((r) => r.within_cadence) };
  }

  const anchor = pp && pp.anchor_document_integrity ? pp.anchor_document_integrity : null;

  const insufficient_evidence = control_mapping.length === 0;

  return {
    output_payload: {
      aiuc1_version, version_mismatch: false, controls, pack_claim_strength,
      oscal_assessment_results, cadence_attestation, anchor, insufficient_evidence,
    },
    compliance_flags: ['AIUC1_PACK_ASSEMBLED', insufficient_evidence ? 'AIUC1_PACK_INSUFFICIENT' : 'AIUC1_PACK_SCORED'],
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
