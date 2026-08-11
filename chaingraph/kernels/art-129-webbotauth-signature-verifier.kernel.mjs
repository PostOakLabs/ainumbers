import { executionHash } from './_hash.mjs';
// Ed25519 verification runs through the vendored noble bundle, NOT crypto.subtle. The QuickJS
// guest inside the zkVM has no WebCrypto at all, so the old `await crypto.subtle.verify(...)`
// path could never execute in-guest and the receipt sealed an empty journal. noble's verify is
// synchronous pure JS, so compute() is synchronous and the proof attests the real verification.
// Mode is strict RFC 8032 (`zip215: false`) — see the equivalence test for why.
import { ed25519 } from './_noble-ed25519.bundle.mjs';

const TOOL_ID = 'art-129-webbotauth-signature-verifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'verify_webbotauth_signature',
  mandate_type: 'compliance_mandate', gpu: false,
};

function b64ToBytes(b64) {
  const bin = (globalThis.atob ? globalThis.atob(b64) : Buffer.from(b64, 'base64').toString('binary'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// base64url -> bytes, no atob dependency on padding (RFC 7515 §2).
function b64uToBytes(s) {
  let t = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  return b64ToBytes(t);
}

// JWK -> raw 32-byte Ed25519 public key. Mirrors what crypto.subtle.importKey enforced:
// a non-OKP / non-Ed25519 / wrong-length key is a THROW, which the caller turns into
// signature_cryptographically_valid = false. Callers may or may not carry the non-standard
// 'alg' member (RFC 8037 wants 'EdDSA', C2PA tooling often writes 'Ed25519'); it is ignored
// either way, which is what the old `delete jwk.alg` workaround achieved.
function ed25519PublicKeyFromJwk(jwk) {
  if (!jwk || typeof jwk !== 'object') throw new Error('jwk missing');
  if (jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519') throw new Error('jwk is not an Ed25519 OKP key');
  if (typeof jwk.x !== 'string') throw new Error('jwk.x missing');
  const raw = b64uToBytes(jwk.x);
  if (raw.length !== 32) throw new Error('Ed25519 public key must be 32 bytes');
  return raw;
}

// RFC 9421 §2.5 signature base: one line per covered component
//   "<lowercased-name>": <value>
// then the final line  "@signature-params": <signature-params-inner-list>
// Caller supplies already-canonicalized component values (zero network).
function buildSignatureBase(covered_components, signature_params) {
  const lines = covered_components.map(c => `"${String(c.name).toLowerCase()}": ${c.value}`);
  lines.push(`"@signature-params": ${signature_params}`);
  return lines.join('\n');
}

export function compute(pp) {
  const {
    covered_components = [], signature_params, signature_b64, public_key_jwk,
    expected_tag = 'web-bot-auth', alg, created, now_unix, max_age_s = 3600,
  } = pp;

  const alg_ok = alg === 'ed25519';
  const tag_ok = typeof signature_params === 'string' && signature_params.includes(`tag="${expected_tag}"`);
  const fresh = (typeof created === 'number' && typeof now_unix === 'number')
    ? (now_unix - created) <= max_age_s && (now_unix - created) >= -300  // small clock-skew tolerance
    : null;

  let signature_cryptographically_valid = false;
  if (alg_ok && public_key_jwk && signature_b64 && Array.isArray(covered_components) && signature_params) {
    try {
      const base = buildSignatureBase(covered_components, signature_params);
      const pub = ed25519PublicKeyFromJwk(public_key_jwk);
      signature_cryptographically_valid = ed25519.verify(
        b64ToBytes(signature_b64), new TextEncoder().encode(base), pub, { zip215: false }) === true;
    } catch { signature_cryptographically_valid = false; }
  }

  const verdict = (signature_cryptographically_valid && alg_ok && tag_ok && fresh !== false) ? 'ACCEPT' : 'REFUSE';
  const compliance_flags = [];
  compliance_flags.push('WEBBOTAUTH_SIGNATURE_ASSESSED');
  compliance_flags.push(verdict === 'ACCEPT' ? 'AGENT_SIGNATURE_VERIFIED' : 'AGENT_SIGNATURE_REFUSED');
  if (!alg_ok) compliance_flags.push('ALGORITHM_NOT_ED25519');
  if (!tag_ok) compliance_flags.push('TAG_MISMATCH');
  if (fresh === false) compliance_flags.push('SIGNATURE_STALE');

  return { output_payload: { signature_cryptographically_valid, alg_ok, tag_ok, fresh, verdict }, compliance_flags };
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
