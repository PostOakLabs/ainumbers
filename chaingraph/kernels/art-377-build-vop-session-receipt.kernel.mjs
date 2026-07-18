import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-377-build-vop-session-receipt';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'build_vop_session_receipt',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

// VOP-EVIDENCE-BUILD-SPEC.md SS VE-2 -- mismatch-metadata + warning-display
// session receipt, hash-chained across a VoP/CoP session's attempts.
//
// THE FENCE (must survive into every copy surface): this kernel attests the
// COMPUTATION and the DECLARED session record -- NOT ground-truth identity,
// and NOT the PSP's own UI. The PSP ASSERTS what score/band it used, what
// warning text/severity it displayed, and what the consumer did; this
// receipt binds those assertions into a tamper-evident, offline-verifiable
// chain. A match score/band from an external source is only ever bound
// alongside its declared source string -- an undeclared source does not
// invalidate the record but is flagged (VOP_MATCH_SOURCE_UNDECLARED), never
// silently dropped, because the receipt's job is to preserve exactly what
// was asserted, gaps included.
//
// A session is an ordered list of attempts (initial + any retries after a
// corrected reference_name). Each attempt carries: the match result (score,
// band, algorithm_version or declared external source), the warning shown
// (text + severity, asserted by the PSP), and the consumer's action
// (proceeded / abandoned / retried). buildArtifact() hash-chains each
// attempt's receipt to the prior receipt hash, rooted at a genesis hash
// derived from session_id -- so two sessions with byte-identical first
// attempts still produce distinct chains, and reordering, inserting, or
// editing any attempt breaks every receipt hash after it (tamper-evident).
// Verification only needs the artifact JSON + this kernel's pure functions
// -- no network call, so it verifies fully offline.
//
// Consumes VE-1 (score_payee_name_match, art-376) by tool_id reference only
// in match_result.source -- no runtime dependency on its kernel.

const VALID_SEVERITY = ['none', 'info', 'warning', 'blocking'];
const VALID_BAND     = ['MATCH', 'CLOSE_MATCH', 'NO_MATCH'];
const VALID_ACTION   = ['proceeded', 'abandoned', 'retried'];

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }
function safeInt(v) { return Number.isInteger(v) ? v : null; }

function normalizeAttempt(raw, i) {
  const a = raw || {};
  const mr = a.match_result || {};
  const source = safeStr(mr.source);
  const source_declared = source.length > 0;
  const algorithm_version = mr.algorithm_version != null ? safeStr(mr.algorithm_version) : null;
  const score = safeInt(mr.score);
  const match_band = VALID_BAND.includes(mr.match_band) ? mr.match_band : 'NO_MATCH';

  const warn = a.warning_shown || {};
  const warning_text = safeStr(warn.text);
  const severity = VALID_SEVERITY.includes(warn.severity) ? warn.severity : 'none';

  const action_declared = VALID_ACTION.includes(a.consumer_action);
  const consumer_action = action_declared ? a.consumer_action : 'unknown';

  return {
    attempt_id:  safeStr(a.attempt_id) || String(i),
    match_result: { source, source_declared, algorithm_version, score, match_band },
    warning_shown: { text: warning_text, severity },
    consumer_action,
    consumer_action_declared: action_declared,
    asserted_at: safeStr(a.asserted_at),
  };
}

export function compute(pp) {
  pp = pp || {};
  const session_id = safeStr(pp.session_id);
  const rawAttempts = Array.isArray(pp.attempts) ? pp.attempts : [];
  const attempts = rawAttempts.map(normalizeAttempt);
  const attempt_count = attempts.length;

  let session_outcome = 'incomplete';
  let final_match_band = null;
  let warning_overridden = false;
  let warning_heeded = false;

  if (attempt_count > 0) {
    const last = attempts[attempt_count - 1];
    final_match_band = last.match_result.match_band;
    if (last.consumer_action === 'proceeded') session_outcome = 'proceeded';
    else if (last.consumer_action === 'abandoned') session_outcome = 'abandoned';
    else session_outcome = 'incomplete'; // last action was 'retried' or undeclared

    const lastWarned = last.warning_shown.severity === 'warning' || last.warning_shown.severity === 'blocking';
    warning_overridden = session_outcome === 'proceeded' && lastWarned;
    warning_heeded      = session_outcome === 'abandoned' && lastWarned;
  }

  const compliance_flags = ['VOP_SESSION_RECEIPT_BUILT'];
  if (attempt_count === 0) compliance_flags.push('VOP_SESSION_EMPTY');
  if (attempts.some((a) => !a.match_result.source_declared)) compliance_flags.push('VOP_MATCH_SOURCE_UNDECLARED');
  if (attempts.some((a) => !a.consumer_action_declared)) compliance_flags.push('VOP_CONSUMER_ACTION_UNDECLARED');
  if (warning_overridden) compliance_flags.push('VOP_WARNING_OVERRIDDEN_BY_CONSUMER');
  if (warning_heeded) compliance_flags.push('VOP_WARNING_HEEDED_ABANDONED');
  if (attempt_count > 0 && session_outcome === 'incomplete') compliance_flags.push('VOP_SESSION_INCOMPLETE');

  const output_payload = {
    session_id,
    attempt_count,
    session_outcome,
    final_match_band,
    warning_overridden,
    session_receipts: null,     // filled by buildArtifact (hash chaining requires async WebCrypto)
    chain_genesis_hash: null,   // filled by buildArtifact
    final_receipt_hash: null,   // filled by buildArtifact
    note: 'Attests the computation over the declared session record -- match result, warning shown, and consumer action as asserted by the PSP -- NOT ground-truth identity and NOT the PSP\'s own UI. Hash-chained per attempt; tampering with any attempt breaks every downstream receipt hash. Verifies fully offline.',
  };

  return { output_payload, compliance_flags, attempts, session_id };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags, attempts, session_id } = compute(pp);

  // Genesis anchors the chain to this session_id, so two sessions whose
  // first attempt is byte-identical still diverge from receipt #0 onward.
  const genesis = await executionHash({ genesis: true, session_id }, { receipt_marker: TOOL_ID });

  const session_receipts = [];
  let prev = genesis;
  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    const receipt_hash = await executionHash({ attempt, prev_receipt_hash: prev }, { receipt_marker: TOOL_ID });
    session_receipts.push({ index: i, ...attempt, prev_receipt_hash: prev, receipt_hash });
    prev = receipt_hash;
  }
  output_payload.session_receipts = session_receipts;
  output_payload.chain_genesis_hash = genesis;
  output_payload.final_receipt_hash = prev;

  const hash = await executionHash(pp, output_payload);
  return {
    '@context':          'https://ainumbers.co/chaingraph/context/v0.4/context.jsonld',
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
