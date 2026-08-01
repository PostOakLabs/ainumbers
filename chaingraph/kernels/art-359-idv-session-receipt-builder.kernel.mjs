import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-359-idv-session-receipt-builder';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'build_idv_session_receipt',
  mandate_type: 'compliance_control',
  gpu:          false,
};

// IDV/KYC session evidence receipt (deepfake era). Consumes session metadata
// plus the AS-SUPPLIED, already-computed results of a verification session --
// capture-chain digest (C2PA manifest digest if present, art-123 validation
// reused), injection-detection verdict, liveness verdict, document-check
// digests, device-signal summary -- and hash-chains them per attempt into a
// tamper-evident session receipt.
//
// HARD FENCE 1: this kernel attests the RECORD AS DECLARED by the verifier --
// it does NOT independently assess detection quality or subject genuineness.
// Every field sourced from an upstream verifier is labeled "asserted" in the
// receipt so a downstream reader never mistakes a declared value for an
// independently-checked one.
//
// HARD FENCE 2: ZERO PII. This kernel consumes only digests, booleans, and
// scores -- never images, documents, or biometrics. Any policy_parameters
// field shaped like raw capture data (long non-hex/non-digest strings on the
// known-PII-risk keys) is rejected before compute proceeds.
//
// ⛔⛔ THE ZERO-PII FENCE IS A SHAPE CHECK, NOT PROTECTION AGAINST A REVERSIBLE
// COMMITMENT. looksLikeDigest() cannot distinguish a digest of a photograph from
// a digest of a document number -- both are the same shape. It stops raw PII; it
// does NOT stop a caller shipping a rainbow-table-recoverable commitment.
//
// ⛔⛔ DOCUMENT-CHECK DIGEST COMMITMENT FORM (SPEC.md §25.0-§25.2,
// ocg-private-input@1). `capture_chain.manifest_digest` is bound to a capture
// event -- a digest over an image or a C2PA manifest is high-entropy and is NOT
// exposed by this mechanism, so it is deliberately left as a plain opaque digest
// and is NOT covered by this contract. `document_check.digest` is different: this
// kernel's contract never pinned it off enumerable values, so a caller may
// legitimately be supplying a digest of a document number, an expiry date, or a
// small structured field. Those spaces are small, so a bare
// SHA-256(cgCanon(value)) is NOT safe -- an attacker holding the artifact
// precomputes the digest of every candidate and recovers the plaintext by table
// lookup (SPEC.md §25.1). A caller in that position MUST supply
// `document_check.digest` as a `sha256-salted@1` commitment --
// `"sha256:" + hex(SHA-256(salt || cgCanon(input_value)))` with a fresh >=256-bit
// CSPRNG `salt` the caller (the prover) generates and RETAINS; the salt is never
// sent to this kernel and never appears in the artifact. Declaring
// `document_check.digest_commitment_scheme: "sha256-salted@1"` opts that digest
// into the contract: a value that is not a well-formed `sha256:<64-hex>`
// commitment is REJECTED (dropped to null, flagged), and naming any scheme other
// than `sha256-salted@1` rejects it the same way -- a verifier MUST reject an
// unknown scheme rather than treat it as opaque (SPEC.md §25.0). An accepted
// commitment is declared in the artifact's top-level `private_inputs[]` (§25.0):
// `pointer` an RFC 6901 pointer into `policy_parameters`, `commitment` the same
// string sitting at that pointer (§25.2 plaintext-exclusion -- never the
// plaintext), `commitment_scheme: "sha256-salted@1"`. The scheme field is
// OPTIONAL for backward compatibility with sessions that predate this contract --
// when absent, `document_check.digest` is treated as an opaque digest exactly as
// before and nothing is declared private.
//
// IDV-SESSION-BUILD-SPEC.md §IS-1.

const PII_RISK_KEYS = ['document_image', 'face_image', 'selfie', 'biometric_template', 'raw_capture'];

// SPEC.md §25.1 -- the sole commitment scheme this profile version accepts.
const SHA256_SALTED_SCHEME = 'sha256-salted@1';
const SHA256_COMMITMENT_RE = /^sha256:[0-9a-f]{64}$/;

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }
function safeBool(v) { return typeof v === 'boolean' ? v : null; }
function safeNum(v) { return typeof v === 'number' && Number.isFinite(v) ? v : null; }

// A digest is accepted as a digest (hex/base64url, bounded length); anything
// longer or containing non-digest characters is treated as PII-shaped and
// rejected rather than silently truncated or hashed away.
function looksLikeDigest(v) {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  if (s.length === 0 || s.length > 128) return false;
  return /^(sha256:)?[a-fA-F0-9]{16,128}$/.test(s) || /^[A-Za-z0-9_-]{16,128}$/.test(s);
}

function rejectPiiShaped(pp) {
  const violations = [];
  for (const key of PII_RISK_KEYS) {
    if (pp[key] != null) violations.push(key);
  }
  const digestFields = [
    ['capture_chain', 'manifest_digest'],
    ['document_check', 'digest'],
  ];
  for (const [group, field] of digestFields) {
    const g = pp[group];
    if (g && g[field] != null && !looksLikeDigest(g[field])) {
      violations.push(`${group}.${field}`);
    }
  }
  return violations;
}

export function compute(pp) {
  pp = pp || {};

  const pii_violations = rejectPiiShaped(pp);
  if (pii_violations.length) {
    const output_payload = {
      rejected: true,
      rejection_reason: 'raw-data-shaped input on PII-risk field(s), not a digest/boolean/score',
      pii_violations,
      session: null,
    };
    return { output_payload, compliance_flags: ['IDV_SESSION_INPUT_REJECTED_PII_SHAPE'], attempts: [], private_input_candidates: [] };
  }

  const session_id      = safeStr(pp.session_id);
  const verifier_id      = safeStr(pp.verifier_id);
  const verifier_version  = safeStr(pp.verifier_version);
  const timestamp        = safeStr(pp.timestamp);

  const capture_chain = pp.capture_chain || {};
  const injection_detection = pp.injection_detection || {};
  const liveness = pp.liveness || {};
  const document_check = pp.document_check || {};
  const device_signal = pp.device_signal || {};

  // OPTIONAL, scoped to document_check.digest (SPEC.md §25.0-§25.2, see the file banner).
  // Absent -- exactly today's behaviour: the digest is an opaque token, nothing declared
  // private, byte-identical output for every pre-existing caller. Declared -> sha256-salted@1
  // is the sole accepted scheme; any other name, or a digest that is not a well-formed
  // sha256:<64-hex> commitment, is REJECTED and dropped rather than trusted as opaque.
  const declaredScheme = safeStr(document_check.digest_commitment_scheme) || null;
  const schemeKnown = declaredScheme === null || declaredScheme === SHA256_SALTED_SCHEME;
  let document_digest = document_check.digest ? safeStr(document_check.digest) : null;
  let document_digest_is_commitment = false;
  const commitment_rejections = [];
  if (declaredScheme !== null) {
    if (!schemeKnown) {
      commitment_rejections.push({
        where: 'document_check.digest_commitment_scheme',
        reason: `unknown commitment scheme -- "${SHA256_SALTED_SCHEME}" is the sole scheme accepted (SPEC.md §25.1); the declared document_check.digest is excluded rather than trusted as opaque`,
        supplied: declaredScheme,
      });
      document_digest = null;
    } else if (document_digest !== null && !SHA256_COMMITMENT_RE.test(document_digest)) {
      commitment_rejections.push({
        where: 'document_check.digest',
        reason: `declared commitment_scheme "${SHA256_SALTED_SCHEME}" but the value is not a well-formed sha256: commitment (^sha256:[0-9a-f]{64}$)`,
        supplied: document_digest,
      });
      document_digest = null;
    } else if (document_digest !== null) {
      document_digest_is_commitment = true;
    }
  }

  const session = {
    session_id,
    verifier_id,
    verifier_version,
    timestamp,
    capture_chain: {
      manifest_present: !!capture_chain.manifest_digest,
      manifest_digest: capture_chain.manifest_digest ? safeStr(capture_chain.manifest_digest) : null,
      label: 'asserted',
    },
    injection_detection: {
      vendor: safeStr(injection_detection.vendor),
      vendor_version: safeStr(injection_detection.vendor_version),
      verdict: injection_detection.verdict === true || injection_detection.verdict === false ? injection_detection.verdict : null,
      confidence: safeNum(injection_detection.confidence),
      label: 'asserted',
    },
    liveness: {
      method: safeStr(liveness.method),
      verdict: safeBool(liveness.verdict),
      score: safeNum(liveness.score),
      label: 'asserted',
    },
    document_check: {
      digest: document_digest,
      verdict: safeBool(document_check.verdict),
      label: 'asserted',
    },
    device_signal: {
      summary: safeStr(device_signal.summary),
      risk_score: safeNum(device_signal.risk_score),
      label: 'asserted',
    },
  };

  // §25.0 declaration + the opt-in reader-facing echo. Both are added ONLY when the caller
  // declares the scheme, so a session that predates this contract is byte-identical.
  const private_input_candidates = [];
  if (declaredScheme !== null) {
    session.document_check.digest_commitment_scheme = declaredScheme;
    if (commitment_rejections.length) session.document_check.commitment_rejections = commitment_rejections;
    if (document_digest_is_commitment) {
      private_input_candidates.push({
        pointer: '/document_check/digest',
        commitment: document_digest,
        commitment_scheme: SHA256_SALTED_SCHEME,
      });
    }
  }

  const flags_missing = [];
  if (!session_id) flags_missing.push('session_id');
  if (!verifier_id) flags_missing.push('verifier_id');
  if (!timestamp) flags_missing.push('timestamp');
  const session_complete = flags_missing.length === 0;

  const output_payload = {
    rejected: false,
    session,
    session_complete,
    missing_fields: flags_missing,
    session_receipt: null, // filled by buildArtifact (hash chaining requires async WebCrypto)
    note: 'Hash-chained IDV/KYC session evidence receipt. Attests the session record AS DECLARED by the verifier -- not detection quality, not subject genuineness. All verifier-sourced fields are labeled "asserted". Zero PII: digests/booleans/scores only, raw-data-shaped inputs are rejected.',
  };

  const compliance_flags = ['IDV_SESSION_RECEIPT_ASSERTED_ONLY'];
  compliance_flags.push(session_complete ? 'IDV_SESSION_METADATA_COMPLETE' : 'IDV_SESSION_METADATA_INCOMPLETE');
  if (session.injection_detection.verdict === true) compliance_flags.push('IDV_INJECTION_DETECTED_ASSERTED');
  if (session.liveness.verdict === false) compliance_flags.push('IDV_LIVENESS_FAILED_ASSERTED');
  if (document_digest_is_commitment) compliance_flags.push('IDV_DOCUMENT_DIGEST_PRIVATE_INPUT');
  if (commitment_rejections.length) compliance_flags.push('IDV_DOCUMENT_DIGEST_COMMITMENT_REJECTED');

  return { output_payload, compliance_flags, attempts: [], private_input_candidates };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags, private_input_candidates } = compute(pp);

  if (!output_payload.rejected) {
    // Hash-chain the receipt: binds {session, prior_attempt_hash}. Genesis
    // prior_attempt_hash is the supplied session_id itself (or empty string),
    // so re-running the same session data reproduces the same genesis anchor.
    const prior_attempt_hash = safeStr((pp && pp.prior_attempt_hash) || '') || output_payload.session.session_id || '';
    const receipt_hash = await executionHash(
      { session: output_payload.session, prior_attempt_hash },
      { receipt_marker: TOOL_ID }
    );
    output_payload.session_receipt = {
      prior_attempt_hash,
      receipt_hash,
    };
  }

  const hash = await executionHash(pp, output_payload);
  const artifact = {
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
  // §25.0 -- attached AFTER executionHash, hash-excluded by construction (SPEC.md §25.0/§25.6).
  // Zero candidates (every pre-existing caller) omits the field entirely, not an empty array --
  // matches the other §20/§23/§25 optional declarations already in this envelope.
  if (private_input_candidates.length > 0) artifact.private_inputs = private_input_candidates;
  return artifact;
}
