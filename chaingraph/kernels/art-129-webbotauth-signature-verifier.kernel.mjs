import { executionHash } from './_hash.mjs';

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

// RFC 9421 §2.5 signature base: one line per covered component
//   "<lowercased-name>": <value>
// then the final line  "@signature-params": <signature-params-inner-list>
// Caller supplies already-canonicalized component values (zero network).
function buildSignatureBase(covered_components, signature_params) {
  const lines = covered_components.map(c => `"${String(c.name).toLowerCase()}": ${c.value}`);
  lines.push(`"@signature-params": ${signature_params}`);
  return lines.join('\n');
}

export async function compute(pp) {
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
      // Strip 'alg' from JWK — CF Workers requires OKP alg='EdDSA', callers may supply 'Ed25519'
      const jwk = Object.assign({}, public_key_jwk);
      delete jwk.alg;
      const key = await globalThis.crypto.subtle.importKey('jwk', jwk, { name: 'Ed25519' }, false, ['verify']);
      signature_cryptographically_valid = await globalThis.crypto.subtle.verify(
        { name: 'Ed25519' }, key, b64ToBytes(signature_b64), new TextEncoder().encode(base));
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
