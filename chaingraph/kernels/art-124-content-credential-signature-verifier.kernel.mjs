import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-124-content-credential-signature-verifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'verify_content_credential_signature',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

const ALG_ALLOW = {
  Ed25519: { name: 'Ed25519' },
  ES256: { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' },
  ES384: { name: 'ECDSA', namedCurve: 'P-384', hash: 'SHA-384' },
  PS256: { name: 'RSA-PSS', hash: 'SHA-256', saltLength: 32 },
};

function b64ToBytes(b64) {
  const bin = (globalThis.atob ? globalThis.atob(b64)
             : Buffer.from(b64, 'base64').toString('binary'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Caller supplies the signer public key (JWK), the signed bytes, the signature,
// and its trust posture (anchor match / validity window / revocation). NO network:
// trust-list + OCSP/CRL are policy inputs, never fetched. Deterministic verify.
export async function compute(pp) {
  const { alg, signer_public_key_jwk, signed_bytes_b64, signature_b64,
          trust_anchor_match, cert_not_expired, revocation_status } = pp;

  const alg_allowed = typeof alg === 'string' && Object.prototype.hasOwnProperty.call(ALG_ALLOW, alg);
  let signature_cryptographically_valid = false;
  if (alg_allowed && signer_public_key_jwk && signed_bytes_b64 && signature_b64) {
    try {
      const params = ALG_ALLOW[alg];
      const key = await globalThis.crypto.subtle.importKey('jwk', signer_public_key_jwk, params, false, ['verify']);
      signature_cryptographically_valid = await globalThis.crypto.subtle.verify(
        params, key, b64ToBytes(signature_b64), b64ToBytes(signed_bytes_b64));
    } catch { signature_cryptographically_valid = false; }
  }

  const chain_trusted = trust_anchor_match === true
    && cert_not_expired !== false
    && revocation_status !== 'revoked';
  const verdict = (signature_cryptographically_valid && chain_trusted) ? 'ACCEPT' : 'REFUSE';

  const compliance_flags = { CONTENT_CREDENTIAL_SIGNATURE_ASSESSED: true };
  compliance_flags[verdict === 'ACCEPT' ? 'SIGNATURE_VERIFIED' : 'SIGNATURE_REFUSED'] = true;
  if (!alg_allowed) compliance_flags.ALGORITHM_NOT_ALLOWED = true;
  if (!chain_trusted) compliance_flags.CHAIN_NOT_TRUSTED = true;

  return {
    output_payload: {
      signature_cryptographically_valid,
      chain_trusted,
      alg: alg ?? null,
      alg_allowed,
      verdict,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = await compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
