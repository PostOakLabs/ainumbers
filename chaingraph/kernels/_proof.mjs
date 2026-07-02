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
// §16.5: for set/chain members the config MAY also carry `id` (so an endorsement can reference it)
// and `previousProof` (the id(s) this proof endorses) — both are part of the signed configuration.
function proofOptions({ verificationMethod, created, id, previousProof }) {
  const o = { type: 'DataIntegrityProof', cryptosuite: CRYPTOSUITE, verificationMethod, proofPurpose: 'assertionMethod', created };
  if (id !== undefined) o.id = id;
  if (previousProof !== undefined) o.previousProof = previousProof;
  return o;
}

// hashData over an explicit secured document (already stripped/augmented by the caller).
async function hashDataForDoc(doc, opts) {
  const optHash = await sha256(jcsBytes(opts));
  const docHash = await sha256(jcsBytes(doc));
  const cat = new Uint8Array(optHash.length + docHash.length);
  cat.set(optHash, 0); cat.set(docHash, optHash.length);
  return cat;
}

// hashData = SHA-256(proofOptions JCS) ++ SHA-256(securedDocument JCS) — proofConfig hash first.
async function hashData(artifact, opts) {
  return hashDataForDoc(securedDocument(artifact), opts);
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

// ── §16.5 Proof sets and endorsement chains (OCG v0.7) ──────────────────────────────────────────
// audit_signature.proof MAY be an array. A parallel proof SET member signs the document with ALL
// proofs removed (each signer independent — VC Data Integrity 1.0 proof-set semantics). An
// ENDORSEMENT (proof-chain member) carries previousProof = id(s) of the proof(s) it endorses; its
// secured input is the document with all proofs removed PLUS exactly the referenced previous
// proof(s) re-attached (in previousProof order), so the endorsement cryptographically covers what
// it approves. Verifiers MUST verify chained proofs in dependency order. eddsa-jcs-2022 throughout.

const asArray = (p) => (p == null ? [] : Array.isArray(p) ? p : [p]);
const prevIds = (proof) => asArray(proof.previousProof);

// Secured input for one set/chain member: strip every proof, then re-attach the endorsed ones.
function chainSecuredDocument(artifact, proof) {
  const doc = securedDocument(artifact);
  const refs = prevIds(proof);
  if (refs.length === 0) return doc;
  const all = asArray(artifact?.audit_signature?.proof);
  const byId = new Map(all.filter((p) => p && p.id !== undefined).map((p) => [p.id, p]));
  const attached = refs.map((id) => {
    const hit = byId.get(id);
    if (!hit) throw new Error(`previousProof "${id}" not found in the proof set`);
    return structuredClone(hit);
  });
  doc.audit_signature = { ...(doc.audit_signature || {}), proof: attached };
  return doc;
}

/**
 * addProof(artifact, { verificationMethod, created, privateKey, id?, previousProof? }) -> new artifact.
 * Appends a proof-set member (no previousProof) or an endorsement (previousProof = id(s) of proofs
 * already on the artifact). The result's audit_signature.proof is an array when it holds >1 proof.
 * created is caller-supplied ISO-8601 (determinism — NEVER Date.now() here).
 */
export async function addProof(artifact, { verificationMethod, created, privateKey, id, previousProof }) {
  if (!verificationMethod || !created || !privateKey) throw new Error('addProof requires { verificationMethod, created, privateKey }');
  const opts = proofOptions({ verificationMethod, created, id, previousProof });
  const probe = { ...opts };                      // chainSecuredDocument reads previousProof off the proof
  const doc = chainSecuredDocument(artifact, probe);
  const sigBytes = new Uint8Array(await globalThis.crypto.subtle.sign('Ed25519', privateKey, await hashDataForDoc(doc, opts)));
  const proof = { ...opts, proofValue: 'z' + b58encode(sigBytes) };
  const out = structuredClone(artifact);
  const existing = asArray(out.audit_signature?.proof);
  out.audit_signature = { ...(out.audit_signature || {}), proof: existing.length ? [...existing, proof] : proof };
  return out;
}

/**
 * verifyProofs(artifact, resolveKey) -> boolean. Verifies EVERY member of audit_signature.proof
 * (object or array) in dependency order: set members first, then endorsements whose previousProof
 * targets verified ids. resolveKey(verificationMethod) -> Ed25519 public CryptoKey (e.g.
 * didKeyToPublicKey). Predicate: false on any structural/crypto problem — a broken/missing/cyclic
 * previousProof reference fails the whole chain.
 */
export async function verifyProofs(artifact, resolveKey) {
  const proofs = asArray(artifact?.audit_signature?.proof);
  if (proofs.length === 0) return false;
  const ids = new Set(proofs.filter((p) => p && p.id !== undefined).map((p) => p.id));
  const verified = new Set();
  const pending = [...proofs];
  // dependency-ordered sweep: a proof runs once every previousProof id it names is verified
  while (pending.length) {
    const i = pending.findIndex((p) => prevIds(p).every((id) => verified.has(id)));
    if (i === -1) return false;                   // missing id or dependency cycle
    const proof = pending.splice(i, 1)[0];
    if (!proof || proof.type !== 'DataIntegrityProof' || proof.cryptosuite !== CRYPTOSUITE) return false;
    if (proof.proofPurpose !== 'assertionMethod' || typeof proof.proofValue !== 'string' || proof.proofValue[0] !== 'z') return false;
    if (prevIds(proof).some((id) => !ids.has(id))) return false;
    const opts = proofOptions({ verificationMethod: proof.verificationMethod, created: proof.created, id: proof.id, previousProof: proof.previousProof });
    try {
      const doc = chainSecuredDocument(artifact, proof);
      const sig = b58decode(proof.proofValue.slice(1));
      const publicKey = await resolveKey(proof.verificationMethod);
      if (!(await globalThis.crypto.subtle.verify('Ed25519', publicKey, sig, await hashDataForDoc(doc, opts)))) return false;
    } catch { return false; }
    if (proof.id !== undefined) verified.add(proof.id);
  }
  return true;
}

export const PROOF_CRYPTOSUITE = CRYPTOSUITE;
