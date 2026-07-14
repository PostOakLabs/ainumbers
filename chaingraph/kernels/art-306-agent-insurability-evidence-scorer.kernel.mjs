import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-306-agent-insurability-evidence-scorer';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'score_agent_insurability_evidence',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Honesty guard (INSURANCE-EVIDENCE-SPEC.md §GUARDS, binding): this scores EVIDENCE
// COMPLETENESS for underwriter-facing review, NEVER an insurability decision, a reserve
// attestation, or an agent-is-insurable claim. Verify-side only. Rubrics are version-pinned,
// documented weight tables (union of the public Munich Re aiSure evidence-doc list, AIUC
// evidence types, and Armilla KPI-warranty dimensions); "generic" is the equal-weight union
// superset. Self-asserted reputation is recorded but zero-weighted in composite (Munich Re:
// third-party validation affects premium -- we surface provenance, we do NOT price).

export const RUBRIC_VERSION = 'rubric-2026-q1';

const RUBRICS = {
  aiuc: { determinism: 0.3, replayability: 0.3, oversight_density: 0.25, dispute_history: 0.15 },
  aisure: { determinism: 0.25, replayability: 0.25, oversight_density: 0.2, dispute_history: 0.3 },
  armilla: { determinism: 0.2, replayability: 0.2, oversight_density: 0.3, dispute_history: 0.3 },
  generic: { determinism: 0.25, replayability: 0.25, oversight_density: 0.25, dispute_history: 0.25 },
};

export function compute(pp) {
  const underwriter_profile = ['aiuc', 'aisure', 'armilla', 'generic'].includes(pp && pp.underwriter_profile)
    ? pp.underwriter_profile : 'generic';
  const rubric = RUBRICS[underwriter_profile];

  const execution_claims = Array.isArray(pp && pp.execution_claims) ? pp.execution_claims : [];
  const receipts = Array.isArray(pp && pp.receipts) ? pp.receipts : [];
  const incident_history = Array.isArray(pp && pp.incident_history) ? pp.incident_history : [];
  const reputation = (pp && typeof pp.reputation === 'object' && pp.reputation) || null;

  const receiptHashes = new Set(receipts.map((r) => r && r.receipt_hash).filter((h) => typeof h === 'string'));

  const determinism = execution_claims.length > 0
    ? execution_claims.filter((c) => c && typeof c.execution_hash === 'string' && receiptHashes.has(c.execution_hash)).length / execution_claims.length
    : 0;

  const replayability = receipts.length > 0
    ? receipts.filter((r) => r && typeof r.receipt_hash === 'string' && r.receipt_hash.length > 0).length / receipts.length
    : 0;

  const oversight_density = execution_claims.length > 0
    ? execution_claims.filter((c) => c && c.human_oversight === true).length / execution_claims.length
    : 0;

  const incident_history_provided = incident_history.length > 0;
  let dispute_history = 0.5; // neutral when absent
  if (incident_history_provided) {
    const closed = incident_history.filter((i) => i && typeof i.closure === 'object' && i.closure && typeof i.closure.closed_at === 'string').length;
    dispute_history = closed / incident_history.length;
  }

  let reputation_self_asserted = false;
  if (reputation && typeof reputation.score === 'number') {
    if (reputation.provenance === 'receipt-derived') {
      dispute_history = (dispute_history + Math.max(0, Math.min(1, reputation.score))) / 2;
    } else {
      reputation_self_asserted = true; // recorded, zero-weighted
    }
  }

  const dims = { determinism, replayability, oversight_density, dispute_history };
  const composite = dims.determinism * rubric.determinism + dims.replayability * rubric.replayability
    + dims.oversight_density * rubric.oversight_density + dims.dispute_history * rubric.dispute_history;

  const insufficient_evidence = execution_claims.length === 0 && receipts.length === 0;

  const output_payload = {
    underwriter_profile, rubric_version: RUBRIC_VERSION,
    dims: insufficient_evidence ? { determinism: 0, replayability: 0, oversight_density: 0, dispute_history: 0 } : dims,
    composite: insufficient_evidence ? 0 : composite,
    incident_history_provided, reputation_self_asserted, insufficient_evidence,
  };

  const compliance_flags = ['AGENT_INSURABILITY_EVIDENCE_SCORED', insufficient_evidence ? 'INSURABILITY_INSUFFICIENT_EVIDENCE' : 'INSURABILITY_SCORED'];

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
