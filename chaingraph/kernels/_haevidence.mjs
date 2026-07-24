// OpenChainGraph §27.6 Human Accountability evidence-bundle assembler + §13.12 SD-JWT export.
// Sits BESIDE `_hagate.mjs` and `_gateval.mjs` — assembles the `haEvidenceBundle` shape
// ($defs/haEvidenceBundle) from a subject's collected human_accountability_records[], then reuses the
// SHIPPED §13.12 SD-JWT exporter (`chaingraph/exporters/sdjwt.mjs`) verbatim rather than re-implementing
// selective disclosure. No new canonicalization or signing path — `exportSdJwt` is the single §13.12
// implementation for every profile, evidence bundles included.
//
// ALWAYS-DISCLOSED (§27.6): subject_hash, verification_result, kernel_version, policy_version,
// timestamps, submission_receipt (mapped to output_payload — never redactable, per §13.12).
// SELECTIVELY DISCLOSABLE: reviewers, approvers, annotations, exception_rationale, input_hashes
// (mapped to policy_parameters.input_parameters — the only redactable container §13.12 recognizes).
//
// `assembleEvidenceBundle` is pure (no I/O/Date/crypto — caller supplies `nowISO` for any stamped
// field it chooses to add). `exportEvidenceBundleSdJwt` is NOT pure — it delegates to `exportSdJwt`,
// which requires WebCrypto (browser / Workers / Node 18+) and a caller-supplied Ed25519 private key
// (§16.2 default-off signing posture: nothing runs, and no identity is disclosed, unless a caller
// explicitly signs).

import { exportSdJwt } from '../exporters/sdjwt.mjs';

/**
 * Build a §27.6 `haEvidenceBundle` object from a subject and its collected HA records.
 * @param {object} params
 * @param {string} params.subjectHash - required; the sha256ref of the artifact this bundle documents
 * @param {Array<object>} [params.records] - human_accountability_records over this subject
 * @param {string[]} [params.inputHashes]
 * @param {string} [params.kernelVersion]
 * @param {string} [params.policyVersion]
 * @param {string} [params.verificationResult] - the §16/§18/§20 verdict
 * @param {string} [params.submissionReceipt] - populated ONLY after a real transmission (never fabricate)
 * @returns {object} haEvidenceBundle
 */
export function assembleEvidenceBundle({
  subjectHash, records = [], inputHashes, kernelVersion, policyVersion, verificationResult, submissionReceipt,
}) {
  if (!subjectHash) throw new Error('assembleEvidenceBundle requires subjectHash');
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

// Wrap a §27.6 bundle as a §4-envelope-shaped object so the SHIPPED `exportSdJwt` (§13.12) can be
// reused without a second selective-disclosure implementation. This is a VIEW for export purposes
// only — it mints no execution_hash and is never itself hashed or validated against $defs/artifact.
function bundleAsPseudoArtifact(bundle) {
  return {
    execution_hash: bundle.subject_hash,
    chaingraph_version: '0.4.0',
    tool_id: 'ha-evidence-bundle',
    mandate_type: 'human_accountability_evidence_bundle',
    policy_parameters: {
      input_parameters: {
        ...(bundle.input_hashes ? { input_hashes: bundle.input_hashes } : {}),
        ...(bundle.reviewers ? { reviewers: bundle.reviewers } : {}),
        ...(bundle.approvers ? { approvers: bundle.approvers } : {}),
        ...(bundle.annotations ? { annotations: bundle.annotations } : {}),
        ...(bundle.exception_rationale ? { exception_rationale: bundle.exception_rationale } : {}),
      },
    },
    output_payload: {
      subject_hash: bundle.subject_hash,
      ...(bundle.verification_result ? { verification_result: bundle.verification_result } : {}),
      ...(bundle.kernel_version ? { kernel_version: bundle.kernel_version } : {}),
      ...(bundle.policy_version ? { policy_version: bundle.policy_version } : {}),
      ...(bundle.timestamps ? { timestamps: bundle.timestamps } : {}),
      ...(bundle.submission_receipt ? { submission_receipt: bundle.submission_receipt } : {}),
    },
  };
}

/**
 * exportEvidenceBundleSdJwt(bundle, { privateKey, verificationMethod }) -> { sd_jwt, bytes, filename, media_type }
 * Delegates to the shipped `exportSdJwt` (§13.12) — see that module's NORMATIVE limitation: the
 * resulting SD-JWT evidences the human trail, it is NOT re-executable and does not recompute any hash.
 */
export async function exportEvidenceBundleSdJwt(bundle, { privateKey, verificationMethod, saltGenerator } = {}) {
  return exportSdJwt(bundleAsPseudoArtifact(bundle), {
    privateKey, verificationMethod, saltGenerator,
    spec_version: '0.8.12', compute_capability: 'ha-evidence-bundle',
  });
}
