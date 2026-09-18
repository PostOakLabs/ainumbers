import { executionHash } from './_hash.mjs';
import { b64ToBytes, verifySignature } from './_sigverify.mjs';

const TOOL_ID = 'art-124-content-credential-signature-verifier';
const TOOL_VERSION = '1.2.0';

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

// The caller supplies the signer public key (JWK), the signed bytes, the signature, and the trust
// posture of the certificate chain (anchor match / validity window / revocation). The kernel performs
// the signature check ITSELF, through `_sigverify.mjs`: WebCrypto in the browser twin, and native
// accelerated verification inside the zkVM under the art-124 guest image. The check is therefore part
// of the proof, not an input to it — which is the whole difference between v1.1.0 and this version.
// Trust-list + OCSP/CRL stay policy inputs, never fetched: NO network.
export async function compute(pp) {
  const { alg, signer_public_key_jwk, signed_bytes_b64, signature_b64,
          trust_anchor_match, cert_not_expired, revocation_status } = pp;

  const alg_allowed = typeof alg === 'string' && Object.prototype.hasOwnProperty.call(ALG_ALLOW, alg);

  let signature_verified = false;
  if (alg_allowed && signer_public_key_jwk && signed_bytes_b64 && signature_b64) {
    const sig = b64ToBytes(signature_b64);
    const msg = b64ToBytes(signed_bytes_b64);
    if (sig && msg) {
      signature_verified = await verifySignature(
        alg, ALG_ALLOW[alg], signer_public_key_jwk, sig, msg) === true;
    }
  }

  const chain_trusted = trust_anchor_match === true
    && cert_not_expired !== false
    && revocation_status !== 'revoked';
  const verdict = (signature_verified === true && chain_trusted) ? 'ACCEPT' : 'REFUSE';

  const compliance_flags = [];
  compliance_flags.push('CONTENT_CREDENTIAL_SIGNATURE_ASSESSED');
  compliance_flags.push(verdict === 'ACCEPT' ? 'SIGNATURE_VERIFIED' : 'SIGNATURE_REFUSED');
  if (!alg_allowed) compliance_flags.push('ALGORITHM_NOT_ALLOWED');
  if (!chain_trusted) compliance_flags.push('CHAIN_NOT_TRUSTED');

  // Flag-mirror doctrine (AUTHORING-STANDARD): the caveat channel rides inside the hashed payload.
  // The v1.1.0 caller-attested caveat is GONE — it said the kernel had not checked the signature, and
  // now it has. Refusal reasons still append exactly when their conditional flags fire.
  const caveats = [];
  if (!alg_allowed) caveats.push('requested alg is outside the declared allowlist');
  if (!chain_trusted) caveats.push('trust chain untrusted');

  return {
    output_payload: {
      // Same key set as v1.1.0 so every downstream surface keeps reading the same fields; what
      // changed is that the value is now computed here rather than attested by the caller, and
      // `signature_verification` records which of those two it was.
      signature_verified,
      signature_verification: 'kernel_verified',
      caveats,
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
