import { executionHash } from './_hash.mjs';

// _sigverify.mjs — SSOT for art-124's signature verification. One call, two backends, one answer.
//
// ⚠ THIS MODULE IS NOT IMPORTED BY THE KERNEL. Like `_detmath.bundle.mjs` and `_amort.bundle.mjs`
// before it, the inlinable body below is PASTED verbatim into the consuming kernel between the
// sentinel comments, because the RISC0 guest provides only `_hash` and a module import is
// unavailable in-guest — and because `chaingraph/vm/kernel-vm.mjs` strips every ESM import before
// running a kernel, so an imported binding is simply undefined under the VM-to-worker parity gate.
// This file is the source of truth and the drift gate's anchor; the kernel carries the copy.
// Pair `sigverify` in `scripts/inline-ssot-sync-manifest.json` (INLINESYNC-1, wholeFileBlock mode,
// scanExt `.kernel.mjs`) makes a byte-different copy a RED, which is the whole point of keeping the
// SSOT as a real file rather than a comment.
//
// WHY IT EXISTS (ART124-ACCEL-GUEST-PROVE-1). art-124 verifies a Content Credential's signature. In
// the browser twin that is WebCrypto. Inside the zkVM guest there is no WebCrypto, and a JS bignum
// implementation of Ed25519 / ECDSA / RSA-PSS interpreted by QuickJS on a proved RV32IM core is the
// most expensive thing the estate could ask a prover to do. So the accelerated guest
// (`methods/art124guest`) exposes four native verification host functions backed by RustCrypto and
// RISC Zero's precompiles, and this module is the single seam between them.
//
// THE CONTRACT: `verifySignature` returns the SAME boolean in all three environments — page,
// kernel VM, and guest — for the same inputs, including for malformed inputs, where every backend
// returns `false` rather than throwing. Anything else would mean the proof and the page disagree,
// which is the one failure this tool cannot have.
//
// ⛔ NO NETWORK, NO STORAGE, NO PII — trust-list and revocation state are policy inputs decided by
// the caller; nothing here fetches, and nothing here is environment-sensitive beyond the backend probe.

/* ===== inlined _sigverify (RISC0 guest provides only _hash; module import is unavailable in-guest) ===== */
// Base64 (standard, with or without padding) -> Uint8Array. Pure JS on purpose: the guest has neither
// `atob` nor `Buffer`, and reaching for either is how a kernel that works in the page silently fails
// inside the proof. The same decoder therefore runs everywhere.
const OCG_B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function ocgDecodeB64(input, urlSafe) {
  if (typeof input !== 'string') return null;
  let s = input.replace(/\s+/g, '');
  if (urlSafe) s = s.replace(/-/g, '+').replace(/_/g, '/');
  s = s.replace(/=+$/, '');
  if (/[^A-Za-z0-9+/]/.test(s)) return null;
  const out = new Uint8Array((s.length * 3) >> 2);
  let acc = 0, bits = 0, o = 0;
  for (let i = 0; i < s.length; i++) {
    const v = OCG_B64.indexOf(s[i]);
    if (v < 0) return null;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) { bits -= 8; out[o++] = (acc >> bits) & 0xff; }
  }
  return out.subarray(0, o);
}

/** Standard base64 -> Uint8Array, or null if the input is not decodable. */
function b64ToBytes(b64) { return ocgDecodeB64(b64, false); }

/** base64url (the JWK field encoding used by JOSE) -> Uint8Array, or null. */
function b64uToBytes(b64u) { return ocgDecodeB64(b64u, true); }

/**
 * Verify a signature over `message` with the JWK public key `jwk` under the named algorithm.
 *
 * @param {string} alg      one of the kernel's ALG_ALLOW keys: Ed25519 | ES256 | ES384 | PS256
 * @param {object} params   the WebCrypto algorithm parameters the kernel declares for `alg`
 * @param {object} jwk      the signer's public key as a JWK
 * @param {Uint8Array} signature  raw signature bytes (ECDSA: r||s, fixed width — WebCrypto "raw")
 * @param {Uint8Array} message    the signed bytes
 * @returns {Promise<boolean>} true only on a cryptographically valid signature
 */
async function verifySignature(alg, params, jwk, signature, message) {
  if (!alg || !params || !jwk || !(signature instanceof Uint8Array) || !(message instanceof Uint8Array)) {
    return false;
  }

  const host = globalThis.__ocg_sigverify_host;
  if (host) return ocgVerifyInGuest(host, alg, jwk, signature, message);

  // Page, Node and the kernel VM: real WebCrypto, bridged to the host in the VM's case.
  try {
    // Strip the non-standard 'alg' field before importKey — CF Workers follows RFC 8037 strictly
    // (an OKP 'alg' must read 'EdDSA', not 'Ed25519'), and callers supply either, both or neither.
    const clean = Object.assign({}, jwk);
    delete clean.alg;
    const key = await globalThis.crypto.subtle.importKey('jwk', clean, params, false, ['verify']);
    return await globalThis.crypto.subtle.verify(params, key, signature, message) === true;
  } catch {
    return false;
  }
}

// In-guest path. Each branch hands the host function RAW key material decoded from the JWK — no DER,
// no ASN.1 — because the decode is cheap here and a parser in the guest would be both a new attack
// surface and a new cycle cost. A missing or wrong-width field returns false, never throws: the
// WebCrypto path answers `false` for the same input (importKey throws, the catch swallows it), and
// the two paths must not diverge.
function ocgVerifyInGuest(host, alg, jwk, signature, message) {
  if (alg === 'Ed25519') {
    const x = b64uToBytes(jwk.x);
    if (!x) return false;
    return host.Ed25519(x, message, signature) === true;
  }

  if (alg === 'ES256' || alg === 'ES384') {
    const width = alg === 'ES256' ? 32 : 48;
    const x = b64uToBytes(jwk.x);
    const y = b64uToBytes(jwk.y);
    if (!x || !y || x.length !== width || y.length !== width) return false;
    // WebCrypto's "raw" ECDSA signature is r||s, each padded to the coordinate width.
    if (signature.length !== width * 2) return false;
    const r = signature.subarray(0, width);
    const s = signature.subarray(width);
    const fn = alg === 'ES256' ? host.ES256 : host.ES384;
    return fn(x, y, message, r, s) === true;
  }

  if (alg === 'PS256') {
    const n = b64uToBytes(jwk.n);
    const e = b64uToBytes(jwk.e);
    if (!n || !e || n.length === 0 || e.length === 0) return false;
    return host.PS256(n, e, message, signature) === true;
  }

  return false;
}
/* ===== end inlined _sigverify ===== */

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
// the signature check ITSELF, through the inlined `_sigverify` body above: WebCrypto in the browser
// twin, and native accelerated verification inside the zkVM under the art-124 guest image. The check
// is therefore part of the proof, not an input to it — which is the whole difference between v1.1.0
// and this version. Trust-list + OCSP/CRL stay policy inputs, never fetched: NO network.
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
