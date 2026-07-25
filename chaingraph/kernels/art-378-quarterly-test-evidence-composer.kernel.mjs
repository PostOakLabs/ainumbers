import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-378-quarterly-test-evidence-composer';
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
  mcp_name: 'build_agent_test_evidence',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Scope correction (ART371-CLASS-RELOCATE, 2026-07-18): SPEC-TICK-088 landed
// §24.6.2 'seeded-stochastic' as a normative class in SPEC.md v0.8.8. This
// kernel now accepts all four §24.6 classes on an input test record; only a
// class OUTSIDE that set is coerced to 'estimated' and flagged
// AU2_DETERMINISM_CLASS_COERCED. PRNG algorithm/seed/draw count are carried
// as ordinary declared inputs for both 'estimated' and 'seeded-stochastic'
// records, since both classes are seed/PRNG-bearing per §24.6/§24.6.2.
//
// Evidence fence (spec copy guard): this is a testing-evidence FORMAT, never a
// certification claim. certification_note is fixed to "prepared for AIUC-1"
// phrasing and aiuc_version is carried as a plain data field so a quarterly
// catalog revision is a re-pin, not a rebuild.
//
// Chain model: each quarterly pack may declare the digest of the pack it
// chains from (declared_prior_pack_digest). The caller supplies the prior
// pack's own recorded identity (prior_quarter.pack_digest) out of band --
// this kernel does not look anything up. chain_intact is a straight equality
// check; a mismatch (prior pack tampered with, or a caller lying about
// lineage) sets tamper_detected and degrades pack_claim_strength to
// 'chain-broken' rather than silently accepting the claimed lineage.

const ALLOWED_CLASSES = new Set(['bit-exact', 'replayable', 'seeded-stochastic', 'estimated', 'deterministic']);

export function compute(pp) {
  const quarter = pp && typeof pp.quarter === 'string' ? pp.quarter : null;
  const aiuc_version = pp && typeof pp.aiuc_version === 'string' ? pp.aiuc_version : null;
  const suiteIn = (pp && typeof pp.suite === 'object' && pp.suite) || {};
  const suite = {
    suite_id: typeof suiteIn.suite_id === 'string' ? suiteIn.suite_id : null,
    suite_version: typeof suiteIn.suite_version === 'string' ? suiteIn.suite_version : null,
    suite_digest: typeof suiteIn.suite_digest === 'string' ? suiteIn.suite_digest : null,
  };
  const testsIn = Array.isArray(pp && pp.tests) ? pp.tests : [];

  const per_test = testsIn.map((t) => {
    const declared = t && typeof t.determinism_class === 'string' ? t.determinism_class : null;
    const coerced_from_forbidden_class = !ALLOWED_CLASSES.has(declared);
    const determinism_class = coerced_from_forbidden_class ? 'estimated' : declared;
    const prngIn = t && typeof t.prng === 'object' && t.prng;
    const prng = (determinism_class === 'estimated' || determinism_class === 'seeded-stochastic') && prngIn ? {
      algorithm: typeof prngIn.algorithm === 'string' ? prngIn.algorithm : null,
      seed: typeof prngIn.seed === 'string' || typeof prngIn.seed === 'number' ? prngIn.seed : null,
      draws: Number.isFinite(prngIn.draws) ? prngIn.draws : null,
    } : null;
    return {
      test_id: t && typeof t.test_id === 'string' ? t.test_id : null,
      determinism_class,
      coerced_from_forbidden_class,
      status: t && t.status === 'pass' ? 'pass' : 'fail',
      receipt_digest: t && typeof t.receipt_digest === 'string' ? t.receipt_digest : null,
      prng,
    };
  });

  const total = per_test.length;
  const passed = per_test.filter((t) => t.status === 'pass').length;
  const pass_rate = total > 0 ? passed / total : null;

  const priorIn = pp && typeof pp.prior_quarter === 'object' && pp.prior_quarter;
  const prior_quarter = priorIn ? {
    quarter: typeof priorIn.quarter === 'string' ? priorIn.quarter : null,
    pack_digest: typeof priorIn.pack_digest === 'string' ? priorIn.pack_digest : null,
    pass_rate: Number.isFinite(priorIn.pass_rate) ? priorIn.pass_rate : null,
  } : null;
  const declared_prior_pack_digest = pp && typeof pp.declared_prior_pack_digest === 'string' ? pp.declared_prior_pack_digest : null;

  const chain_intact = prior_quarter === null ? true : declared_prior_pack_digest === prior_quarter.pack_digest;
  const tamper_detected = prior_quarter !== null && !chain_intact;

  let delta = null;
  let regressed = false;
  if (prior_quarter && typeof prior_quarter.pass_rate === 'number' && pass_rate !== null) {
    delta = pass_rate - prior_quarter.pass_rate;
    regressed = delta < 0;
  }

  const pack_claim_strength = tamper_detected ? 'chain-broken' : (total === 0 ? 'insufficient' : 'evidence-backed');

  // HA-CONV-1 (SPEC.md §27.6): additive -- wraps the pack's per-test receipt
  // digests as an $defs/haEvidenceBundle's input_hashes, ONLY when the caller
  // declares which sealed subject artifact this quarterly pack evidences
  // (subject_hash, e.g. the AI system's registration/model-governance record).
  // Absent subject_hash, ha_evidence_bundle is null and the pack's shape is
  // byte-identical to a pre-convergence caller that never supplies it.
  const subject_hash = pp && typeof pp.subject_hash === 'string' ? pp.subject_hash : null;
  const ha_evidence_bundle = subject_hash ? assembleEvidenceBundle({
    subjectHash: subject_hash,
    inputHashes: per_test.map((t) => t.receipt_digest).filter(Boolean),
    kernelVersion: suite.suite_version || undefined,
    policyVersion: aiuc_version || undefined,
    verificationResult: pack_claim_strength,
  }) : null;

  const output_payload = {
    quarter, aiuc_version, suite, per_test, total, passed, pass_rate,
    prior_quarter, declared_prior_pack_digest, chain_intact, tamper_detected,
    regression: { delta, regressed },
    pack_claim_strength,
    ha_evidence_bundle,
    certification_note: 'Prepared for AIUC-1 technical testing evidence; not a certification and not an underwriting decision.',
  };

  const compliance_flags = [
    'AU2_TEST_EVIDENCE_ASSEMBLED',
    tamper_detected ? 'AU2_CHAIN_TAMPER_DETECTED' : null,
    regressed ? 'AU2_REGRESSION_DETECTED' : null,
    per_test.some((t) => t.coerced_from_forbidden_class) ? 'AU2_DETERMINISM_CLASS_COERCED' : null,
    ha_evidence_bundle ? 'AU2_HA_EVIDENCE_BUNDLE_ASSEMBLED' : null,
  ].filter(Boolean);

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
