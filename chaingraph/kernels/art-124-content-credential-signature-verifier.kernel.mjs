import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-124-content-credential-signature-verifier';
const TOOL_VERSION = '1.1.0';

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

// Deterministic policy core over a caller-attested signature result. The caller
// performs the signature check over the manifest bytes with the declared alg
// (browser twin: real WebCrypto importKey/verify in the page runner; server
// callers: their own host crypto) and attests the outcome as the REQUIRED
// `signature_verified` boolean input. The kernel does not re-verify, touches
// no async primitive, and is therefore sync end to end — which is what makes
// the policy zkVM-provable in the FAST cycle class. Trust-list + OCSP/CRL stay
// policy inputs, never fetched: NO network.
export function compute(pp) {
  const { alg, signature_verified, trust_anchor_match, cert_not_expired, revocation_status } = pp;

  const alg_allowed = typeof alg === 'string' && Object.prototype.hasOwnProperty.call(ALG_ALLOW, alg);
  const chain_trusted = trust_anchor_match === true
    && cert_not_expired !== false
    && revocation_status !== 'revoked';
  const verdict = (signature_verified === true && chain_trusted) ? 'ACCEPT' : 'REFUSE';

  const compliance_flags = [];
  compliance_flags.push('CONTENT_CREDENTIAL_SIGNATURE_ASSESSED');
  compliance_flags.push(verdict === 'ACCEPT' ? 'SIGNATURE_VERIFIED' : 'SIGNATURE_REFUSED');
  if (!alg_allowed) compliance_flags.push('ALGORITHM_NOT_ALLOWED');
  if (!chain_trusted) compliance_flags.push('CHAIN_NOT_TRUSTED');

  // Flag-mirror doctrine (AUTHORING-STANDARD): the caveat channel rides inside
  // the hashed payload. The caller-attested caveat is present on every run;
  // refusal reasons append exactly when their conditional flags fire.
  const caveats = ['signature verification is caller-attested'];
  if (!alg_allowed) caveats.push('requested alg is outside the declared allowlist');
  if (!chain_trusted) caveats.push('trust chain untrusted');

  return {
    output_payload: {
      // Echo of the caller's attested boolean, plus the caller_attested marker
      // so the caveat lives inside the hashed output_payload, not only on the page.
      signature_verified: signature_verified === true,
      signature_verification: 'caller_attested',
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
  const { output_payload, compliance_flags } = compute(pp);
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
