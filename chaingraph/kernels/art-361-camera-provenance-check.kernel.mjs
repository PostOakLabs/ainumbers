import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-361-camera-provenance-check';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'check_camera_provenance',
  mandate_type: 'compliance_control',
  gpu:          false,
};

// Camera-provenance check for an IDV/KYC capture. Reuses the art-123 C2PA
// manifest structural-validity check (claim well-formedness, hard-binding
// hash assertion, claim-signature reference) and adds a digitalSourceType
// read from the c2pa.actions assertion, flagging trainedAlgorithmicMedia
// (and its composite variant) so a downstream reader knows the capture was
// declared AI-generated rather than a live camera capture.
//
// HARD FENCE 1: structural check only -- this kernel does NOT validate the
// claim signature against any trust list and makes no chain-of-trust claim
// (C2PA-COMPOSE-1 fence, inherited). A structurally valid manifest is not
// proof of authenticity; an invalid/absent manifest is not proof of forgery.
//
// HARD FENCE 2: ZERO PII. Inputs are the decoded manifest's structural
// fields (claim metadata, assertion labels, signature presence) and a
// digest of the capture file -- never the capture image/video bytes
// themselves. A manifest_digest that isn't digest-shaped is rejected.
//
// Output feeds IS-1's (art-359) capture_chain field: {manifest_present,
// manifest_digest, label:"asserted"}.
//
// IDV-SESSION-BUILD-SPEC.md §IS-3.

const TRAINED_ALGORITHMIC_SOURCE_TYPES = new Set([
  'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia',
  'http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia',
]);

const CAPTURE_SOURCE_TYPES = new Set([
  'http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture',
]);

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }

function looksLikeDigest(v) {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  if (s.length === 0 || s.length > 128) return false;
  return /^(sha256:)?[a-fA-F0-9]{16,128}$/.test(s) || /^[A-Za-z0-9_-]{16,128}$/.test(s);
}

export function compute(pp) {
  pp = pp || {};

  const manifest_digest_raw = pp.manifest_digest;
  if (manifest_digest_raw != null && !looksLikeDigest(manifest_digest_raw)) {
    const output_payload = {
      rejected: true,
      rejection_reason: 'manifest_digest is raw-data-shaped, not a digest',
      capture_chain_field: null,
    };
    return { output_payload, compliance_flags: ['CAMERA_PROVENANCE_INPUT_REJECTED_PII_SHAPE'] };
  }

  const claim = pp.claim || {};
  const assertions = Array.isArray(pp.assertions) ? pp.assertions : [];
  const signature = pp.signature || {};
  const claim_generator = pp.claim_generator;

  const labels = assertions.map(a => a && a.label).filter(Boolean);
  const has_hard_binding = labels.includes('c2pa.hash.data') || labels.includes('c2pa.hash.bmff');
  const has_actions = labels.some(l => l === 'c2pa.actions' || l === 'c2pa.actions.v2');
  const claim_well_formed =
    typeof claim_generator === 'string' && claim_generator.length > 0 &&
    typeof claim.format === 'string' && typeof claim.instanceID === 'string';
  const sig_ref_present = !!signature && (signature.present === true || typeof signature.alg === 'string');

  const missing_elements = [];
  if (!claim_well_formed) missing_elements.push('CLAIM_GENERATOR_FORMAT_OR_INSTANCEID');
  if (!has_hard_binding)  missing_elements.push('HARD_BINDING_HASH_ASSERTION');
  if (!sig_ref_present)   missing_elements.push('CLAIM_SIGNATURE_REFERENCE');

  const manifest_valid = missing_elements.length === 0;
  const manifest_present = manifest_digest_raw != null || assertions.length > 0 || claim_well_formed;

  // digitalSourceType: read off the c2pa.actions assertion, first action entry.
  const actions_assertion = assertions.find(a => a && (a.label === 'c2pa.actions' || a.label === 'c2pa.actions.v2'));
  const actions_list = actions_assertion && Array.isArray(actions_assertion.actions) ? actions_assertion.actions : [];
  const digital_source_type = safeStr(actions_list.length && actions_list[0] && actions_list[0].digitalSourceType) || null;

  const trained_algorithmic_media_flagged = TRAINED_ALGORITHMIC_SOURCE_TYPES.has(digital_source_type);
  const digital_capture_asserted = CAPTURE_SOURCE_TYPES.has(digital_source_type);

  let provenance_label = 'indeterminate';
  if (trained_algorithmic_media_flagged) provenance_label = 'ai_generated_flagged';
  else if (digital_capture_asserted && manifest_valid) provenance_label = 'genuine_capture_asserted';

  const output_payload = {
    rejected: false,
    manifest_valid,
    manifest_present,
    has_hard_binding,
    has_actions,
    digital_source_type,
    trained_algorithmic_media_flagged,
    provenance_label,
    missing_elements,
    capture_chain_field: {
      manifest_present,
      manifest_digest: manifest_digest_raw ? safeStr(manifest_digest_raw) : null,
      label: 'asserted',
    },
    note: 'Structural check only -- no trust-list / chain-of-trust claim. digitalSourceType is read verbatim off the c2pa.actions assertion as declared by the manifest generator.',
  };

  const compliance_flags = ['CAMERA_PROVENANCE_ASSESSED', 'CAMERA_PROVENANCE_STRUCTURAL_ONLY'];
  compliance_flags.push(manifest_valid ? 'C2PA_MANIFEST_VALID' : 'C2PA_MANIFEST_INVALID');
  if (!has_actions) compliance_flags.push('NO_ACTIONS_ASSERTION');
  if (trained_algorithmic_media_flagged) compliance_flags.push('TRAINED_ALGORITHMIC_MEDIA_FLAGGED');

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':          'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version:  '0.4.0',
    mandate_type:        meta.mandate_type,
    tool_id:             TOOL_ID,
    tool_version:        TOOL_VERSION,
    generated_at:        now ?? null,
    execution_hash:      hash,
    chain:               { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:   pp,
    output_payload,
    compliance_flags,
    compute_mode:        'server',
    compute_proof_ready: 'deferred',
    audit_signature:     { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
