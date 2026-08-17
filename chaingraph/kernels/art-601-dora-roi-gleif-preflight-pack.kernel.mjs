import { executionHash } from './_hash.mjs';

// art-601-dora-roi-gleif-preflight-pack — DORA RoI GLEIF pre-submission evidence pack.
// SPEC-DORA-GLEIF-FEEDERS-1-2026-08-09.md §4. Terminal node of chain
// dora-roi-gleif-preflight-pack: art-466 (dora-roi-builder) -> art-599 (gleif_snapshot_digest)
// [xN, one per LEI-bearing counterparty] -> art-600 (lei_relationship_consistency) [xN, same
// set] -> art-601 (this node).
//
// Pure composition over upstream node outputs, same shape as art-300/art-304/art-585: no new
// domain logic beyond what its own inputs need, zero network, zero PII, in-memory only. It
// never re-derives the RoI dataset -- it links to the upstream dora-roi-builder artifact by
// execution_hash + tool_id only, never the raw dataset (SPEC §4 artifact-chain rule).
//
// HARD FRAMING, non-negotiable (SPEC §4): this is a preparation aid a firm compiles for its own
// DORA RoI submission process. It is NOT a submission, NOT a filing, NOT a determination that a
// submission is complete or accurate, and NOT a statement that any regulator has reviewed or
// would accept this output. compliance_flags here describe pack-assembly state ONLY -- never
// "compliant", "satisfies", or "meets DORA requirements" language anywhere in this kernel or its
// output strings.
const SCOPE_NOTE = 'Assembles evidence a firm compiles for its own DORA RoI submission process. Not a submission, not a filing, not a determination that a submission is complete or accurate, and not a statement that any regulator has reviewed or would accept this output.';

const TOOL_ID = 'art-601-dora-roi-gleif-preflight-pack';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_dora_roi_gleif_preflight_pack',
  mandate_type: 'compliance_control', gpu: false,
};

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function str(v) { return typeof v === 'string' ? v.trim() : ''; }
function bool(v) { return v === true ? true : v === false ? false : null; }
function num(v) { return typeof v === 'number' && Number.isFinite(v) ? v : null; }

// Named-human attestation closure -- identical shape to art-300's, management-body role per
// SPEC §4 (echoes the Art.5 personal-accountability framing already established in
// dora-roi-annual-cycle; copied, not re-derived).
function attestationVerdict(attestation) {
  if (!isObj(attestation)) return { status: 'pending_named_human_closure', signer_name: null, signer_title: null, signed_at: null };
  const name = str(attestation.name) || null;
  const title = str(attestation.title) || null;
  const signedAt = str(attestation.timestamp) || null;
  if (!name || !title || !signedAt) return { status: 'pending_named_human_closure', signer_name: name, signer_title: title, signed_at: signedAt };
  return { status: 'closed', signer_name: name, signer_title: title, signed_at: signedAt };
}

// One counterparty's GLEIF pre-flight evidence: the art-599 snapshot digest result and the
// art-600 relationship-consistency result, as the caller carries them forward from those two
// upstream node runs. Every element carries captured_at + a source digest so staleness is
// visible without this pack asserting freshness (SPEC §4, "the whole point").
function summarizeCounterparty(entry) {
  entry = isObj(entry) ? entry : {};
  const counterparty_id = str(entry.counterparty_id) || null;
  const snap = isObj(entry.gleif_snapshot) ? entry.gleif_snapshot : {};
  const rel = isObj(entry.lei_relationship_check) ? entry.lei_relationship_check : {};

  const snapshot_captured = bool(snap.snapshot_captured);
  const lei_checksum_valid = bool(snap.lei_checksum_valid);
  const source_sha256 = str(snap.source_sha256) || null;
  const captured_at = str(snap.captured_at) || null;
  const last_update_date = str(snap.last_update_date) || null;

  const relationships_assessed = bool(rel.records_assessed);
  const relationship_consistent = rel.consistent === true ? true : rel.consistent === false ? false : null;
  const violation_count = num(rel.violation_count);

  return {
    counterparty_id,
    lei: str(snap.lei) || str(rel.subject_lei) || null,
    gleif_snapshot: { snapshot_captured, lei_checksum_valid, source_sha256, captured_at, last_update_date },
    lei_relationship_check: { relationships_assessed, relationship_consistent, violation_count },
    snapshot_missing: snapshot_captured !== true,
    relationship_violation_present: relationship_consistent === false,
  };
}

export function compute(pp) {
  pp = pp || {};

  const roiRefIn = isObj(pp.dora_roi_artifact) ? pp.dora_roi_artifact : {};
  const roi_execution_hash = str(roiRefIn.execution_hash) || null;
  const roi_tool_id = str(roiRefIn.tool_id) || null;
  const dora_roi_artifact_linked = !!roi_execution_hash && !!roi_tool_id;

  const counterpartiesIn = Array.isArray(pp.counterparties) ? pp.counterparties : [];
  const attestation = attestationVerdict(pp.attestation);

  if (!dora_roi_artifact_linked || counterpartiesIn.length === 0) {
    return {
      output_payload: {
        scope_note: SCOPE_NOTE,
        dora_roi_artifact_ref: { execution_hash: roi_execution_hash, tool_id: roi_tool_id, linked: dora_roi_artifact_linked },
        counterparty_count: counterpartiesIn.length,
        counterparties: [],
        rollup: { all_snapshots_captured: null, any_relationship_violation: null },
        attestation,
        error: !dora_roi_artifact_linked ? 'missing_dora_roi_artifact_reference' : 'no_counterparties_supplied',
      },
      compliance_flags: ['DORA_ROI_GLEIF_PREFLIGHT_PACK_PARAMETER_NOT_SUPPLIED'],
    };
  }

  const counterparties = counterpartiesIn.map(summarizeCounterparty);
  const all_snapshots_captured = counterparties.every((c) => c.snapshot_missing === false);
  const any_relationship_violation = counterparties.some((c) => c.relationship_violation_present === true);
  const counterparties_missing_snapshot = counterparties.filter((c) => c.snapshot_missing).map((c) => c.counterparty_id);
  const counterparties_with_violations = counterparties.filter((c) => c.relationship_violation_present).map((c) => c.counterparty_id);

  const compliance_flags = ['DORA_ROI_GLEIF_PREFLIGHT_PACK_ASSEMBLED'];
  compliance_flags.push(all_snapshots_captured ? 'ALL_GLEIF_SNAPSHOTS_CAPTURED' : 'GLEIF_SNAPSHOT_MISSING');
  compliance_flags.push(any_relationship_violation ? 'RELATIONSHIP_VIOLATION_PRESENT' : 'NO_RELATIONSHIP_VIOLATIONS');
  compliance_flags.push(attestation.status === 'closed' ? 'DORA_ROI_GLEIF_PREFLIGHT_ATTESTATION_CLOSED' : 'DORA_ROI_GLEIF_PREFLIGHT_ATTESTATION_PENDING');

  return {
    output_payload: {
      scope_note: SCOPE_NOTE,
      dora_roi_artifact_ref: { execution_hash: roi_execution_hash, tool_id: roi_tool_id, linked: dora_roi_artifact_linked },
      counterparty_count: counterparties.length,
      counterparties,
      rollup: { all_snapshots_captured, any_relationship_violation, counterparties_missing_snapshot, counterparties_with_violations },
      attestation,
      error: null,
    },
    compliance_flags,
  };
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
