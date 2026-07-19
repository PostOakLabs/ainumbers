import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-408-evidence-bundle-tier-labeler';
const TOOL_VERSION = '1.0.0';

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
