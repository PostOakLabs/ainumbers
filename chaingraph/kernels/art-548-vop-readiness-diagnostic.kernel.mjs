/**
 * art-548-vop-readiness-diagnostic.kernel.mjs
 * EU Instant Payments Regulation Verification-of-Payee (VoP) readiness/
 * consistency diagnostic — OUTCOME-ATTESTATION shape, not recompute-the-match
 * (XBORDER-PAYMENTS-BUILD-SPEC.md §1.1). The EPC VoP fuzzy name-matching
 * algorithm is not a single pinned, publicly-specified computation, and a
 * live IBAN/account-holder-name directory lookup is forbidden (SPEC.md §0 /
 * XBORDER-PAYMENTS-BUILD-SPEC.md §0 zero-egress). This kernel does NOT
 * perform IBAN/name verification itself: it deterministically classifies a
 * caller-declared `match_score` against the caller-declared thresholds into
 * match | close_match | no_match | not_verifiable, then cross-checks that
 * classification against the caller-declared `psp_vop_response_code` for
 * internal consistency — flagging, never silently correcting, a mismatch.
 *
 * Distinct from three existing VoP-adjacent nodes (near-collision note):
 *   - art-11-vop-batch-match-rate-analyser (simulate_vop_matching): a BATCH
 *     aggregate analyzer over many payee pairs using its own float
 *     Jaro-Winkler similarity — this node ingests ONE already-scored PSP
 *     result and never computes similarity itself.
 *   - art-376-score-payee-name-match (score_payee_name_match): computes a
 *     declared-algorithm name-match score FROM a name pair — this node
 *     never sees a name pair in the clear (§25 private) and never computes
 *     a score; it only classifies a score the caller already has.
 *   - art-377-build-vop-session-receipt (build_vop_session_receipt): builds
 *     a session receipt artifact — this node is the upstream readiness
 *     check that a session receipt may cite, not the receipt itself.
 *
 * SPEC.md §25 Private-Input Profile (ocg-private-input@1, sha256-salted@1):
 * `iban`, `payee_name`, and `account_holder_id` (if collected) are
 * enumerable/PII and MUST be committed, never carried in the clear. Each
 * gets its own salt and its own commitment pointer in `private_inputs[]`.
 * `match_score` is NOT committed here (§1.2 makes that optional, not
 * mandatory) — it is not itself enumerable/PII the way an IBAN or a name is.
 *
 * mandate_type is the new node-specific value "vop_readiness_attestation" —
 * explicitly NOT "human_accountability_record" (SPEC.md §27 is a different,
 * unrelated artifact shape; this node emits no §27 record).
 *
 * Pure decision kernel — no DOM, no window, no Date.now(), no Math.random().
 */
import { executionHash, cgCanon } from './_hash.mjs';

const TOOL_ID      = 'art-548-vop-readiness-diagnostic';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'run_vop_readiness_diagnostic',
  mandate_type: 'vop_readiness_attestation',
  gpu:          false,
  // §25 profile marker — buildArtifact's first argument is the PRIVATE WITNESS
  // (iban/payee_name/account_holder_id + salts), not the artifact's own
  // policy_parameters (which carries only the commitments). Gate scripts that
  // replay buildArtifact(fixture.policy_parameters) must skip nodes carrying
  // this flag (chaingraph/kernels/vm-parity-gate.mjs).
  private_input_profile: 'ocg-private-input@1',
};

const SCOPE_NOTE = 'This is a readiness/consistency diagnostic over caller-declared inputs, not a claim that this node performed IBAN or payee-name verification. It does not query any IBAN or account-holder directory and does not implement the EPC VoP fuzzy name-matching algorithm.';

const REGULATORY_BASIS = 'EU Instant Payments Regulation (Regulation (EU) 2024/886), Verification-of-Payee obligation — in force 2025-10-09 for euro-area PSPs, 2027-07-09 for non-euro-area PSPs. The EPC VoP Rulebook leaves the fuzzy name-matching algorithm to vendor-selected engines with EBA-suggested, not mandated, thresholds; this diagnostic only recomputes the deterministic threshold classification and cross-checks it against the PSP-declared response code.';

const PII_NOTE = 'ZERO plaintext PII disclosed: the IBAN, payee name, and account-holder identifier (if collected) are private witnesses, committed via sha256-salted@1 (OCG Standard §25 ocg-private-input@1) and never present in policy_parameters or output_payload in the clear. Only the threshold classification and consistency verdict are public.';

const NOT_LEGAL_ADVICE = 'Not legal advice. A Verification-of-Payee readiness determination requires review by a qualified payments-compliance officer against the applicable PSP VoP Rulebook implementation.';

// psp_vop_response_code -> the classification that response code asserts.
// Enum per EPC VoP Rulebook outcome codes (MTCH/CMTCH/NMTCH/NVRF style).
const RESPONSE_CODE_CLASSIFICATION = {
  MTCH:  'match',
  CMTCH: 'close_match',
  NMTCH: 'no_match',
  NVRF:  'not_verifiable',
};

// ---- pure, deterministic classification math (never sees the private witness) ----
function classifyVopReadiness(match_score, match_threshold_exact, match_threshold_close, psp_vop_response_code) {
  const scoreProvided = typeof match_score === 'number' && Number.isFinite(match_score);

  let classification;
  if (!scoreProvided) {
    classification = 'not_verifiable';
  } else if (match_score >= match_threshold_exact) {
    classification = 'match';
  } else if (match_score >= match_threshold_close) {
    classification = 'close_match';
  } else {
    classification = 'no_match';
  }

  const psp_declared_maps_to = Object.prototype.hasOwnProperty.call(RESPONSE_CODE_CLASSIFICATION, psp_vop_response_code)
    ? RESPONSE_CODE_CLASSIFICATION[psp_vop_response_code]
    : 'unrecognized_code';
  const consistent = psp_declared_maps_to === classification;

  return { classification, match_score_provided: scoreProvided, psp_declared_maps_to, consistent };
}

// §25.1 commitment = sha256(salt || cgCanon(input_value)), hex-encoded, "sha256:"-prefixed.
// salt: hex string, >=256 bits (>=64 hex chars). Never returned, never logged, never persisted here.
async function commitPrivateInput(saltHex, inputValue) {
  if (typeof saltHex !== 'string' || saltHex.length < 64 || !/^[0-9a-f]+$/i.test(saltHex)) {
    throw new Error('salt must be a hex string of at least 256 bits (64 hex chars)');
  }
  const saltBytes = new Uint8Array(saltHex.length / 2);
  for (let i = 0; i < saltBytes.length; i++) saltBytes[i] = parseInt(saltHex.slice(i * 2, i * 2 + 2), 16);
  const inputBytes = new TextEncoder().encode(JSON.stringify(cgCanon(inputValue)));
  const combined = new Uint8Array(saltBytes.length + inputBytes.length);
  combined.set(saltBytes, 0);
  combined.set(inputBytes, saltBytes.length);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', combined);
  return 'sha256:' + Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Deterministic, side-effect-free recompute over an ALREADY-COMMITTED policy_parameters —
// exists for gate harnesses that expect a `compute` export (empty-input-finite.test.mjs skips
// kernels lacking one; this satisfies it without ever seeing the plaintext witness). Per SPEC.md
// §18.3, a private-input node's output is NOT third-party-recomputable from policy_parameters
// alone — this function only echoes the public shape, it never re-derives the verdict. Defined
// BEFORE buildArtifact so check-engine-parity.mjs's bundler (which extracts everything textually
// preceding `export async function buildArtifact` as the QuickJS-runnable region) captures it.
export function compute(pp) {
  const p = pp || {};
  return {
    classification: 'not_verifiable',
    match_score_provided: false,
    psp_declared_maps_to: 'unrecognized_code',
    consistent: null,
    psp_vop_response_code: p.psp_vop_response_code ?? null,
    scope_note: SCOPE_NOTE,
    note: 'Private-input node: verdict is not recomputable from policy_parameters alone (SPEC.md §18.3). Call buildArtifact with the private witness.',
  };
}

/**
 * buildArtifact — the wire input `raw` is the caller's PRIVATE witness plus public config:
 *   { iban, iban_salt, payee_name, payee_name_salt, account_holder_id?, account_holder_id_salt?,
 *     match_score, match_threshold_exact, match_threshold_close, psp_vop_response_code }
 * The returned artifact's own policy_parameters carries ONLY commitments + the public
 * match/threshold/response-code fields — `iban`, `payee_name`, `account_holder_id`, and the
 * salts never enter policy_parameters, output_payload, or the §4 preimage.
 */
export async function buildArtifact(raw, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const r = raw || {};
  const match_score            = r.match_score;
  const match_threshold_exact  = r.match_threshold_exact;
  const match_threshold_close  = r.match_threshold_close;
  const psp_vop_response_code  = String(r.psp_vop_response_code ?? '');

  const verdict = classifyVopReadiness(match_score, match_threshold_exact, match_threshold_close, psp_vop_response_code);

  const iban_commitment         = await commitPrivateInput(r.iban_salt, r.iban);
  const payee_name_commitment   = await commitPrivateInput(r.payee_name_salt, r.payee_name);
  const hasAccountHolderId      = r.account_holder_id !== undefined && r.account_holder_id !== null && r.account_holder_id !== '';
  const account_holder_id_commitment = hasAccountHolderId
    ? await commitPrivateInput(r.account_holder_id_salt, r.account_holder_id)
    : null;

  const policy_parameters = {
    iban_commitment,
    payee_name_commitment,
    ...(account_holder_id_commitment ? { account_holder_id_commitment } : {}),
    match_threshold_exact,
    match_threshold_close,
    psp_vop_response_code,
  };
  const output_payload = {
    classification:         verdict.classification,
    match_score_provided:   verdict.match_score_provided,
    psp_vop_response_code,
    psp_declared_maps_to:   verdict.psp_declared_maps_to,
    consistent:             verdict.consistent,
    scope_note:             SCOPE_NOTE,
    regulatory_basis:       REGULATORY_BASIS,
    pii_note:               PII_NOTE,
    not_legal_advice:       NOT_LEGAL_ADVICE,
  };

  const hash = await executionHash(policy_parameters, output_payload);

  const private_inputs = [
    { pointer: '/iban_commitment', commitment: iban_commitment, commitment_scheme: 'sha256-salted@1' },
    { pointer: '/payee_name_commitment', commitment: payee_name_commitment, commitment_scheme: 'sha256-salted@1' },
  ];
  if (account_holder_id_commitment) {
    private_inputs.push({ pointer: '/account_holder_id_commitment', commitment: account_holder_id_commitment, commitment_scheme: 'sha256-salted@1' });
  }

  const compliance_flags = [];
  compliance_flags.push(verdict.consistent ? 'VOP_CONSISTENT' : 'VOP_CONSISTENCY_MISMATCH');
  if (verdict.classification === 'match') compliance_flags.push('VOP_MATCH');
  else if (verdict.classification === 'close_match') compliance_flags.push('VOP_CLOSE_MATCH');
  else if (verdict.classification === 'no_match') compliance_flags.push('VOP_NO_MATCH');
  else compliance_flags.push('VOP_NOT_VERIFIABLE');

  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters,
    output_payload,
    private_inputs,
    compliance_flags,
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
