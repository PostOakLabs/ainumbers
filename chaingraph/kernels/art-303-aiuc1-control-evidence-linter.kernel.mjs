import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-303-aiuc1-control-evidence-linter';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'lint_aiuc1_control_evidence',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Honesty guard (INSURANCE-EVIDENCE-SPEC.md §GUARDS, binding): this lint asserts "these
// inputs replay to this coverage score," NEVER "these controls are certified" or that AIUC
// (or any underwriter) endorses, accepts, or is bound by the output. Scope = the 23
// automatable AIUC-1 controls only; the ~26 procedural controls are structurally out of
// automatable scope and are reported as such, never silently dropped or claimed covered.
// AIUC-1 v2026-Q1 pillars (public, aiuc-1.com): A Data & Privacy, B Security, C Safety,
// D Reliability, E Accountability, F Society. This kernel inlines a minimal automatable-
// control ID/pillar subset for scoring; the full descriptive catalog (expected evidence
// types + crosswalk) ships as the standalone reference fixture
// chaingraph/kernels/fixtures/aiuc1-catalog-2026-q1.json, the single version anchor for §A.

export const CATALOG_VERSION = '2026-Q1';
export const PROCEDURAL_CONTROLS_OUT_OF_SCOPE = 26;

export const AUTOMATABLE_CONTROLS = [
  { control_id: 'AIUC-A-01', pillar: 'A' }, { control_id: 'AIUC-A-02', pillar: 'A' },
  { control_id: 'AIUC-A-03', pillar: 'A' }, { control_id: 'AIUC-A-04', pillar: 'A' },
  { control_id: 'AIUC-B-01', pillar: 'B' }, { control_id: 'AIUC-B-02', pillar: 'B' },
  { control_id: 'AIUC-B-03', pillar: 'B' }, { control_id: 'AIUC-B-04', pillar: 'B' },
  { control_id: 'AIUC-C-01', pillar: 'C' }, { control_id: 'AIUC-C-02', pillar: 'C' },
  { control_id: 'AIUC-C-03', pillar: 'C' }, { control_id: 'AIUC-C-04', pillar: 'C' },
  { control_id: 'AIUC-D-01', pillar: 'D' }, { control_id: 'AIUC-D-02', pillar: 'D' },
  { control_id: 'AIUC-D-03', pillar: 'D' }, { control_id: 'AIUC-D-04', pillar: 'D' },
  { control_id: 'AIUC-E-01', pillar: 'E' }, { control_id: 'AIUC-E-02', pillar: 'E' },
  { control_id: 'AIUC-E-03', pillar: 'E' }, { control_id: 'AIUC-E-04', pillar: 'E' },
  { control_id: 'AIUC-F-01', pillar: 'F' }, { control_id: 'AIUC-F-02', pillar: 'F' },
  { control_id: 'AIUC-F-03', pillar: 'F' },
];

export function evidenceStatusFor(entry) {
  if (!entry || !Array.isArray(entry.evidence) || entry.evidence.length === 0) return 'missing';
  const hasReceipt = entry.evidence.some((e) => e && typeof e.receipt_hash === 'string' && e.receipt_hash.length > 0);
  if (hasReceipt) return 'receipt-backed';
  return 'attestation-only';
}

export function compute(pp) {
  const aiuc1_version = pp && typeof pp.aiuc1_version === 'string' ? pp.aiuc1_version : null;

  if (aiuc1_version !== CATALOG_VERSION) {
    return {
      output_payload: {
        aiuc1_version, version_mismatch: true,
        per_control: [], per_pillar_coverage: {}, overall_coverage: 0,
        receipt_backed_count: 0, attestation_only_count: 0, missing_count: 0,
        procedural_controls_out_of_scope: PROCEDURAL_CONTROLS_OUT_OF_SCOPE,
        automatable_scope: AUTOMATABLE_CONTROLS.length,
      },
      compliance_flags: ['AIUC1_LINT_RUN', 'AIUC1_VERSION_MISMATCH'],
    };
  }

  const controlEvidence = Array.isArray(pp.control_evidence) ? pp.control_evidence : [];
  const byId = new Map();
  for (const entry of controlEvidence) {
    if (entry && typeof entry.control_id === 'string') byId.set(entry.control_id, entry);
  }

  const per_control = AUTOMATABLE_CONTROLS.map((c) => ({
    control_id: c.control_id, pillar: c.pillar, status: evidenceStatusFor(byId.get(c.control_id)),
  }));

  let receipt_backed_count = 0, attestation_only_count = 0, missing_count = 0;
  const pillarTotals = {}, pillarScores = {};
  for (const c of AUTOMATABLE_CONTROLS) { pillarTotals[c.pillar] = (pillarTotals[c.pillar] || 0) + 1; pillarScores[c.pillar] = 0; }

  for (const row of per_control) {
    if (row.status === 'receipt-backed') { receipt_backed_count++; pillarScores[row.pillar] += 1; }
    else if (row.status === 'attestation-only') { attestation_only_count++; pillarScores[row.pillar] += 0.5; }
    else missing_count++;
  }

  const per_pillar_coverage = {};
  for (const pillar of Object.keys(pillarTotals)) {
    per_pillar_coverage[pillar] = pillarTotals[pillar] > 0 ? pillarScores[pillar] / pillarTotals[pillar] : 0;
  }

  const overall_coverage = AUTOMATABLE_CONTROLS.length > 0
    ? (receipt_backed_count + 0.5 * attestation_only_count) / AUTOMATABLE_CONTROLS.length
    : 0;

  const insufficient_evidence = controlEvidence.length === 0;

  const compliance_flags = ['AIUC1_LINT_RUN', insufficient_evidence ? 'AIUC1_INSUFFICIENT_EVIDENCE' : 'AIUC1_SCORED'];

  return {
    output_payload: {
      aiuc1_version, version_mismatch: false,
      per_control, per_pillar_coverage, overall_coverage,
      receipt_backed_count, attestation_only_count, missing_count,
      procedural_controls_out_of_scope: PROCEDURAL_CONTROLS_OUT_OF_SCOPE,
      automatable_scope: AUTOMATABLE_CONTROLS.length,
      insufficient_evidence,
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
