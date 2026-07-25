import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-408-evidence-bundle-tier-labeler';
const TOOL_VERSION = '1.1.0';

// HA-CONV-1: inlined from _haevidence.mjs's pure assembleEvidenceBundle
// (verbatim logic) -- the kernel-VM strips all ESM imports except _hash.mjs's
// (chaingraph/vm/kernel-vm.mjs stripEsmSyntaxForVm), so any other cross-file
// import throws "assembleEvidenceBundle is not defined" under VM-1a parity.
function assembleEvidenceBundle({ subjectHash, records = [], inputHashes, kernelVersion, policyVersion, verificationResult, submissionReceipt }) {
  const forSubject = records.filter((r) => r?.subject_hash === subjectHash);
  const reviewers = forSubject.filter((r) => r.record_type === 'approval' && r.role === 'reviewer').map((r) => r.identity?.id).filter(Boolean);
  const approvers = forSubject.filter((r) => r.record_type === 'approval' && r.role !== 'reviewer').map((r) => r.identity?.id).filter(Boolean);
  const annotations = forSubject.filter((r) => r.record_type === 'annotation').map((r) => r.reason_code || r.decision).filter(Boolean);
  const timestamps = forSubject.map((r) => r.timestamp).filter(Boolean);
  const overrideRec = forSubject.find((r) => r.record_type === 'override');
  const bundle = { subject_hash: subjectHash };
  if (inputHashes?.length) bundle.input_hashes = inputHashes;
  if (kernelVersion) bundle.kernel_version = kernelVersion;
  if (policyVersion) bundle.policy_version = policyVersion;
  if (verificationResult) bundle.verification_result = verificationResult;
  if (overrideRec?.reason_code) bundle.exception_rationale = overrideRec.reason_code;
  if (annotations.length) bundle.annotations = annotations;
  if (reviewers.length) bundle.reviewers = [...new Set(reviewers)];
  if (approvers.length) bundle.approvers = [...new Set(approvers)];
  if (timestamps.length) bundle.timestamps = timestamps;
  if (submissionReceipt) bundle.submission_receipt = submissionReceipt;
  return bundle;
}

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'assemble_ocg_evidence_bundle',
  mandate_type: 'attestation_mandate', gpu: false,
};

// SPEC.md §SIDECAR.1 evidence-bundle tooling. Assembles a shareable evidence
// bundle around an artifact + its declared proof set and stamps the tiered
// label (OCG-Verify / OCG-Execute / OCG-Prove) the artifact qualifies for,
// computed PURELY from which §15 gates the caller declares passed. Zero
// network, zero fetch -- this node never re-runs the underlying gates itself,
// it only re-expresses their pass/fail result as a label. The label adds no
// new gate and mints no new trust claim (SPEC.md:1677): OCG-Verify requires
// §1/§4 (envelope well-formed + execution_hash recomputes); OCG-Execute
// additionally requires §21 chain-execution + §22 mandate gates; OCG-Prove
// additionally requires a §18 compute-integrity proof. Any gate false at a
// tier, and every tier above it is unavailable -- tiers are cumulative, not
// independent choices.
export function compute(pp) {
  pp = pp || {};
  const artifact_tool_id = typeof pp.artifact_tool_id === 'string' ? pp.artifact_tool_id : '';
  const artifact_execution_hash = typeof pp.artifact_execution_hash === 'string' ? pp.artifact_execution_hash : '';
  const proof_refs = Array.isArray(pp.proof_refs) ? pp.proof_refs.filter((r) => typeof r === 'string' && r.length > 0) : [];
  const gr = pp.gate_results || {};

  const envelope_well_formed = !!gr.envelope_well_formed;
  const execution_hash_recomputes = !!gr.execution_hash_recomputes;
  const chain_execution_valid = !!gr.chain_execution_valid;
  const mandate_gates_valid = !!gr.mandate_gates_valid;
  const compute_integrity_proof_valid = !!gr.compute_integrity_proof_valid;

  const verify_ok = envelope_well_formed && execution_hash_recomputes;
  const execute_ok = verify_ok && chain_execution_valid && mandate_gates_valid;
  const prove_ok = execute_ok && compute_integrity_proof_valid;

  const eligible_tiers = [];
  if (verify_ok) eligible_tiers.push('OCG-Verify');
  if (execute_ok) eligible_tiers.push('OCG-Execute');
  if (prove_ok) eligible_tiers.push('OCG-Prove');

  const tier_label = prove_ok ? 'OCG-Prove' : execute_ok ? 'OCG-Execute' : verify_ok ? 'OCG-Verify' : 'UNLABELED';

  const compliance_flags = ['EVIDENCE_BUNDLE_ASSEMBLED'];
  compliance_flags.push(
    tier_label === 'OCG-Prove' ? 'SIDECAR_TIER_OCG_PROVE'
    : tier_label === 'OCG-Execute' ? 'SIDECAR_TIER_OCG_EXECUTE'
    : tier_label === 'OCG-Verify' ? 'SIDECAR_TIER_OCG_VERIFY'
    : 'SIDECAR_UNLABELED_GATES_FAILED'
  );
  if (!artifact_execution_hash) compliance_flags.push('SIDECAR_NO_ARTIFACT_HASH_DECLARED');

  // HA-CONV-1 (SPEC.md §27.6): consume/emit the $defs/haEvidenceBundle so the
  // tier label rides the SAME diffable object as the accountability trail.
  // Additive -- ONLY populated when the caller supplies human_accountability_
  // records (already-collected §27.2 records over this artifact); the tier
  // label above is unaffected either way (this node never re-runs gates).
  const human_accountability_records = Array.isArray(pp.human_accountability_records) ? pp.human_accountability_records : [];
  const ha_evidence_bundle = (artifact_execution_hash && human_accountability_records.length) ? assembleEvidenceBundle({
    subjectHash: artifact_execution_hash,
    records: human_accountability_records,
    verificationResult: tier_label,
  }) : null;
  if (ha_evidence_bundle) compliance_flags.push('SIDECAR_HA_EVIDENCE_BUNDLE_ATTACHED');

  const output_payload = {
    artifact_tool_id,
    artifact_execution_hash,
    tier_label,
    eligible_tiers,
    gate_provenance: {
      envelope_well_formed, execution_hash_recomputes,
      chain_execution_valid, mandate_gates_valid, compute_integrity_proof_valid,
    },
    proof_refs,
    proof_ref_count: proof_refs.length,
    ha_evidence_bundle,
    note: 'The tiered label re-expresses existing §15 gate-pass results; it adds no new gate and mints no new trust claim (SPEC.md §SIDECAR.1).',
    disambiguation: 'This node does not re-run §1/§4/§18/§21/§22 gates itself -- gate_results is a caller declaration of prior gate outcomes for the referenced artifact, not independently re-verified here.',
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
