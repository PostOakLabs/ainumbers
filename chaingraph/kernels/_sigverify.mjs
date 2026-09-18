// _sigverify.mjs — one signature-verification call, two backends, one answer.
//
// WHY THIS FILE EXISTS (ART124-ACCEL-GUEST-PROVE-1). art-124 verifies a Content Credential's
// signature. In the browser twin that is WebCrypto. Inside the zkVM guest there is no WebCrypto, and
// a JS bignum implementation of Ed25519 / ECDSA / RSA-PSS interpreted by QuickJS on a proved RV32IM
// core is the most expensive thing the estate could ask a prover to do. So the accelerated guest
// (`methods/art124guest`, image `sha256:530a19ce…`) exposes four native verification host functions
// backed by RustCrypto and RISC Zero's precompiles, and this module is the single seam between them.
//
// THE CONTRACT: `verifySignature` returns the SAME boolean in both environments for the same inputs,
// including for malformed inputs, where both return `false` rather than throwing. Anything else would
// mean the proof and the page disagree, which is the one failure this tool cannot have.
//
// ⛔ NO NETWORK, NO STORAGE, NO PII — trust-list and revocation state are policy inputs decided by the
// caller; nothing here fetches, and nothing here is environment-sensitive beyond the backend probe.

// Base64 (standard, with or without padding) -> Uint8Array. Pure JS on purpose: the guest has neither
// `atob` nor `Buffer`, and reaching for either is how a kernel that works in the page silently fails
// inside the proof. The same decoder therefore runs in both places.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeB64(input, urlSafe) {
  if (typeof input !== 'string') return null;
  let s = input.replace(/\s+/g, '');
  if (urlSafe) s = s.replace(/-/g, '+').replace(/_/g, '/');
  s = s.replace(/=+$/, '');
  if (/[^A-Za-z0-9+/]/.test(s)) return null;
  const out = new Uint8Array((s.length * 3) >> 2);
  let acc = 0, bits = 0, o = 0;
  for (let i = 0; i < s.length; i++) {
    const v = B64.indexOf(s[i]);
    if (v < 0) return null;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) { bits -= 8; out[o++] = (acc >> bits) & 0xff; }
  }
  return out.subarray(0, o);
}

/** Standard base64 -> Uint8Array, or null if the input is not decodable. */
export function b64ToBytes(b64) { return decodeB64(b64, false); }

/** base64url (JWK field encoding, RFC 7515 §2) -> Uint8Array, or null. */
export function b64uToBytes(b64u) { return decodeB64(b64u, true); }

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
export async function verifySignature(alg, params, jwk, signature, message) {
  if (!alg || !params || !jwk || !(signature instanceof Uint8Array) || !(message instanceof Uint8Array)) {
    return false;
  }

  const host = globalThis.__ocg_sigverify_host;
  if (host) return verifyInGuest(host, alg, jwk, signature, message);

  // Browser / server twin: real WebCrypto.
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
function verifyInGuest(host, alg, jwk, signature, message) {
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
