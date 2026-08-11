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

export async function compute(pp) {
  const {
    nonce, created, expires, now_unix, max_age_s = 3600,
    seen_nonces = [], nonce_already_used = false,
  } = pp;

  const format_ok = nonceFormatOk(nonce);

  // TAP: created/expires spread MUST NOT exceed 8 minutes (480s).
  const spread_ok = (typeof created === 'number' && typeof expires === 'number')
    ? (expires - created) > 0 && (expires - created) <= 480
    : null;

  const fresh = (typeof created === 'number' && typeof now_unix === 'number')
    ? (now_unix - created) <= max_age_s && (now_unix - created) >= -300 && spread_ok !== false
    : null;

  const already_used = nonce_already_used === true
    || (Array.isArray(seen_nonces) && typeof nonce === 'string' && seen_nonces.includes(nonce));

  const nonce_valid = format_ok && fresh === true && !already_used;
  const verdict = nonce_valid ? 'ACCEPT' : 'REFUSE';

  const compliance_flags = ['NONCE_ASSESSED'];
  if (!format_ok) compliance_flags.push('NONCE_MALFORMED');
  if (fresh === false) compliance_flags.push('NONCE_STALE');
  if (already_used) compliance_flags.push('NONCE_REPLAY_SUSPECTED');
  compliance_flags.push(nonce_valid ? 'NONCE_ACCEPTED' : 'NONCE_REFUSED');

  return {
    output_payload: { format_ok, spread_ok, fresh, already_used, nonce_valid, verdict },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = await compute(pp);
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
