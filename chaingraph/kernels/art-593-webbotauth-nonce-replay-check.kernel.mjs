import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-593-webbotauth-nonce-replay-check';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_webbotauth_nonce_replay',
  mandate_type: 'compliance_mandate', gpu: false,
};

// TAP nonce sizing: >=16 raw bytes, base64url-encoded (no padding).
function nonceFormatOk(nonce) {
  if (typeof nonce !== 'string' || nonce.length === 0) return false;
  if (!/^[A-Za-z0-9_-]+$/.test(nonce)) return false;
  // base64url decode length estimate: 4 chars ~ 3 bytes
  const approxBytes = Math.floor((nonce.length * 3) / 4);
  return approxBytes >= 16;
}

// Fail-closed on required inputs: nonce, created, expires and now_unix are
// required (manifest input schema). A null derived value never passes: when
// the created/expires spread cannot be evaluated (expires absent, null or
// non-numeric) the spread does not read as satisfied, so freshness fails and
// the nonce is REFUSED instead of bypassing the 8-minute spread rule.
export function compute(pp) {
  const {
    nonce, created, expires, now_unix, max_age_s = 3600,
    seen_nonces, nonce_already_used,
  } = pp;

  // Replay store: supplied when seen_nonces is an array (empty is a real, empty
  // store) or nonce_already_used is a boolean. With neither, the replay check was
  // not evaluated and the verdict never reads as a clean ACCEPT.
  const replay_evaluated = Array.isArray(seen_nonces) || typeof nonce_already_used === 'boolean';

  const format_ok = nonceFormatOk(nonce);

  // TAP: created/expires spread MUST NOT exceed 8 minutes (480s).
  const spread_ok = (typeof created === 'number' && typeof expires === 'number')
    ? (expires - created) > 0 && (expires - created) <= 480
    : null;

  const fresh = (typeof created === 'number' && typeof now_unix === 'number')
    ? (now_unix - created) <= max_age_s && (now_unix - created) >= -300 && spread_ok === true
    : null;

  const already_used = nonce_already_used === true
    || (Array.isArray(seen_nonces) && typeof nonce === 'string' && seen_nonces.includes(nonce));

  const checks_pass = format_ok && fresh === true && !already_used;
  const nonce_valid = checks_pass && replay_evaluated;
  // Format and freshness pass but no replay store was supplied: a named
  // not-evaluated verdict, never ACCEPT. Expiry ordering (now_unix <= expires)
  // is deliberately not checked; this node is a replay check, not a freshness
  // verifier, and freshness is bounded by created, max_age_s and the spread.
  const verdict = nonce_valid ? 'ACCEPT'
    : (checks_pass ? 'REPLAY_CHECK_NOT_EVALUATED' : 'REFUSE');

  const compliance_flags = ['NONCE_ASSESSED'];
  if (!format_ok) compliance_flags.push('NONCE_MALFORMED');
  if (fresh === false) compliance_flags.push('NONCE_STALE');
  if (already_used) compliance_flags.push('NONCE_REPLAY_SUSPECTED');
  if (!replay_evaluated) compliance_flags.push('NONCE_REPLAY_STORE_ABSENT');
  if (nonce_valid) compliance_flags.push('NONCE_ACCEPTED');
  else if (verdict === 'REFUSE') compliance_flags.push('NONCE_REFUSED');

  return {
    output_payload: { format_ok, spread_ok, fresh, already_used, replay_evaluated, nonce_valid, verdict },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
