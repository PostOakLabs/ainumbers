// OpenChainGraph shared Data Integrity signer/verifier — OCG Standard §16 (Proof Binding).
// SINGLE SOURCE OF TRUTH for §16 signature production/verification.
//
// W3C Data Integrity, cryptosuite eddsa-jcs-2022 (https://www.w3.org/TR/vc-di-eddsa/, Rec 2025-05),
// WHOLE-ARTIFACT. Reuses the §4 JCS canonicalizer from _hash.mjs — there is NO second
// canonicalization path here (the array-replacer forms FORBIDDEN by §4 stay forbidden).
// Ed25519 via globalThis.crypto.subtle: browsers, Cloudflare Workers, Node 18+.
//
// Pipeline (eddsa-jcs-2022): Transform(JCS) -> SHA-256 each of {proof options, document} ->
// sign the concatenation (proofConfigHash ++ documentHash) with Ed25519. Verification reverses it.
//
// HOME (NORMATIVE, §16): the proof object lives at artifact.audit_signature.proof — NOT artifact
// root (the frozen v0.4 schema is additionalProperties:false at the root, so a root `proof` would
// fail a v0.4 verifier) and NOT inside the DSSE-style audit_signature.signatures[] array.
//
// OPTIONAL + holder-chosen (§16.2): nothing here runs unless a caller passes a private key. Signing
// de-anonymizes a run; callers MUST surface that before signing.

import { cgCanon } from './_hash.mjs';

const CRYPTOSUITE = 'eddsa-jcs-2022';
const enc = (s) => new TextEncoder().encode(s);

// JCS canonical bytes (RFC 8785) — byte-identical canon to _hash.mjs (cgCanon + minimal JSON.stringify).
function jcsBytes(obj) { return enc(JSON.stringify(cgCanon(obj))); }

async function sha256(bytes) {
  const d = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(d);
}

// Secured document = artifact MINUS audit_signature.proof (a proof is never part of its own input).
function securedDocument(artifact) {
  const a = structuredClone(artifact);
  if (a && a.audit_signature && 'proof' in a.audit_signature) delete a.audit_signature.proof;
  return a;
}

// Proof options = the proof object without proofValue (eddsa-jcs-2022 proof configuration).
function proofOptions({ verificationMethod, created }) {
  return { type: 'DataIntegrityProof', cryptosuite: CRYPTOSUITE, verificationMethod, proofPurpose: 'assertionMethod', created };
}

// hashData = SHA-256(proofOptions JCS) ++ SHA-256(securedDocument JCS) — proofConfig hash first.
async function hashData(artifact, opts) {
  const optHash = await sha256(jcsBytes(opts));
  const docHash = await sha256(jcsBytes(securedDocument(artifact)));
  const cat = new Uint8Array(optHash.length + docHash.length);
  cat.set(optHash, 0); cat.set(docHash, optHash.length);
  return cat;
}

// ── multibase base58btc ('z') — minimal inline (CONTRACT: no external lib / no CDN) ──────────────
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58encode(bytes) {
  let zeros = 0; while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits = [0];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) { carry += digits[j] << 8; digits[j] = carry % 58; carry = (carry / 58) | 0; }
    while (carry) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  let out = ''; for (let k = 0; k < zeros; k++) out += '1';
  for (let q = digits.length - 1; q >= 0; q--) out += B58[digits[q]];
  return out;
}
function b58decode(str) {
  let zeros = 0; while (zeros < str.length && str[zeros] === '1') zeros++;
  const bytes = [0];
  for (let i = zeros; i < str.length; i++) {
    let carry = B58.indexOf(str[i]); if (carry < 0) throw new Error('bad base58 char');
    for (let j = 0; j < bytes.length; j++) { carry += bytes[j] * 58; bytes[j] = carry & 0xff; carry >>= 8; }
    while (carry) { bytes.push(carry & 0xff); carry >>= 8; }
  }
  const out = new Uint8Array(zeros + bytes.length);
  for (let k = 0; k < bytes.length; k++) out[zeros + bytes.length - 1 - k] = bytes[k];
  return out;
}

// ── did:key <-> raw Ed25519 public key (multicodec ed25519-pub = 0xed 0x01) ──────────────────────
const ED25519_MULTICODEC = [0xed, 0x01];
export async function rawPubkeyToDidKey(publicKey) {
  const raw = new Uint8Array(await globalThis.crypto.subtle.exportKey('raw', publicKey)); // 32 bytes
  const prefixed = new Uint8Array(ED25519_MULTICODEC.length + raw.length);
  prefixed.set(ED25519_MULTICODEC, 0); prefixed.set(raw, ED25519_MULTICODEC.length);
  return 'did:key:z' + b58encode(prefixed);
}
export async function didKeyToPublicKey(did) {
  if (!did.startsWith('did:key:z')) throw new Error('not a did:key z-form');
  const prefixed = b58decode(did.slice('did:key:z'.length));
  if (prefixed[0] !== 0xed || prefixed[1] !== 0x01) throw new Error('did:key is not Ed25519');
  const raw = prefixed.slice(2);
  return globalThis.crypto.subtle.importKey('raw', raw, { name: 'Ed25519' }, true, ['verify']);
}

/**
 * sign(artifact, { verificationMethod, created, privateKey }) -> new artifact with audit_signature.proof set.
 * privateKey: WebCrypto Ed25519 private CryptoKey. verificationMethod: did:key (z6Mk…).
 * created: ISO-8601 string supplied by the caller (determinism — NEVER Date.now() here).
 */
export async function sign(artifact, { verificationMethod, created, privateKey }) {
  if (!verificationMethod || !created || !privateKey) throw new Error('sign requires { verificationMethod, created, privateKey }');
  const opts = proofOptions({ verificationMethod, created });
  const sigBytes = new Uint8Array(await globalThis.crypto.subtle.sign('Ed25519', privateKey, await hashData(artifact, opts)));
  const proof = { ...opts, proofValue: 'z' + b58encode(sigBytes) };
  const out = structuredClone(artifact);
  out.audit_signature = { ...(out.audit_signature || {}), proof };
  return out;
}

/**
 * verify(artifact, publicKey) -> boolean. publicKey: WebCrypto Ed25519 public CryptoKey, resolved by the
 * caller from artifact.audit_signature.proof.verificationMethod (see didKeyToPublicKey). Predicate: returns
 * false on any structural/crypto problem rather than throwing.
 */
export async function verify(artifact, publicKey) {
  const proof = artifact?.audit_signature?.proof;
  if (!proof || proof.type !== 'DataIntegrityProof' || proof.cryptosuite !== CRYPTOSUITE) return false;
  if (proof.proofPurpose !== 'assertionMethod' || typeof proof.proofValue !== 'string' || proof.proofValue[0] !== 'z') return false;
  const opts = proofOptions({ verificationMethod: proof.verificationMethod, created: proof.created });
  try {
    const sig = b58decode(proof.proofValue.slice(1));
    return await globalThis.crypto.subtle.verify('Ed25519', publicKey, sig, await hashData(artifact, opts));
  } catch { return false; }
}

export const PROOF_CRYPTOSUITE = CRYPTOSUITE;
