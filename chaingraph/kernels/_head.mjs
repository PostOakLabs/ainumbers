// _head.mjs — OCG head-commit primitive (SPEC.md §HEAD-1). Zero-dep, Node 18+ / browser / Worker.
//
// A head-commit is the mutable-tip object OCG otherwise lacks: a signed, sequence-numbered pointer
// at a `stream` naming which artifact is currently "current" for that stream (ATProto-commit shape).
// JCS-canonical, self-contained:
//   { head_version, stream, signer, seq, prev_head_hash, root, root_cid?, timestamp, proof }
//
// head_hash = JCS-SHA-256 over the object MINUS `proof` — the one canonical hash path (cgCanon from
// _hash.mjs, the SAME canonicalizer §4/§16/§CID-1 already use). There is no second canonicalization
// here. The proof itself is a §16 eddsa-jcs-2022 Data Integrity proof, secured over the same
// proof-stripped document — this file reimplements that small pipeline (not import it from
// _proof.mjs) only because _proof.mjs's sign()/verify() hardcode the proof's home at
// `artifact.audit_signature.proof`; a head-commit's proof lives at the object's own top-level
// `.proof`. The did:key <-> raw Ed25519 conversion IS reused from _proof.mjs — that part is
// object-shape-agnostic.

import { cgCanon } from './_hash.mjs';
import { rawPubkeyToDidKey, didKeyToPublicKey } from './_proof.mjs';

export { rawPubkeyToDidKey, didKeyToPublicKey };

const CRYPTOSUITE = 'eddsa-jcs-2022';
const enc = (s) => new TextEncoder().encode(s);
const jcsBytes = (obj) => enc(JSON.stringify(cgCanon(obj)));
async function sha256Hex(bytes) {
  const d = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function sha256Bytes(bytes) {
  return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
}

// Secured document for a head-commit = the head object minus `proof` (a proof is never part of its
// own input). Unlike _proof.mjs's securedDocument(), there is no audit_signature wrapper to strip.
function securedHead(head) {
  const h = { ...head };
  delete h.proof;
  return h;
}

/**
 * headHash(head) -> "sha256:<hex>". Accepts a head object with or without `.proof` attached — the
 * proof is always stripped first, so signing a head does not move its own head_hash. This is the
 * value a SUBSEQUENT head's `prev_head_hash` must equal to chain onto this one.
 */
export async function headHash(head) {
  return 'sha256:' + (await sha256Hex(jcsBytes(securedHead(head))));
}

/**
 * buildHead(fields) -> unsigned head object (no `.proof`). Optional members (`root_cid`,
 * `rotates_to`) are omitted entirely when absent rather than set to null/undefined, so a head with
 * no rotation and no CID canonicalizes identically to the minimal §HEAD-1.0 shape.
 * `prev_head_hash` MUST be null (not omitted) at genesis — its presence with a null value is itself
 * the genesis marker checked by verifyChain().
 */
export function buildHead({ head_version = '1', stream, signer, seq, prev_head_hash, root, root_cid, timestamp, rotates_to }) {
  if (typeof stream !== 'string' || !stream) throw new Error('buildHead: stream is required');
  if (typeof signer !== 'string' || !signer.startsWith('did:key:')) throw new Error('buildHead: signer must be a did:key');
  if (!Number.isInteger(seq) || seq < 0) throw new Error('buildHead: seq must be a non-negative integer');
  if (prev_head_hash !== null && typeof prev_head_hash !== 'string') throw new Error('buildHead: prev_head_hash must be null (genesis) or a "sha256:" string');
  if (typeof root !== 'string' || !root.startsWith('sha256:')) throw new Error('buildHead: root must be a "sha256:"-prefixed digest');
  if (typeof timestamp !== 'string' || !timestamp) throw new Error('buildHead: timestamp (RFC3339) is required');
  const head = { head_version, stream, signer, seq, prev_head_hash, root, timestamp };
  if (root_cid !== undefined) head.root_cid = root_cid;
  if (rotates_to !== undefined) head.rotates_to = rotates_to;
  return head;
}

function proofOptions({ verificationMethod, created }) {
  return { type: 'DataIntegrityProof', cryptosuite: CRYPTOSUITE, verificationMethod, proofPurpose: 'assertionMethod', created };
}
async function hashData(head, opts) {
  const optHash = await sha256Bytes(jcsBytes(opts));
  const docHash = await sha256Bytes(jcsBytes(securedHead(head)));
  const cat = new Uint8Array(optHash.length + docHash.length);
  cat.set(optHash, 0); cat.set(docHash, optHash.length);
  return cat;
}
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

/**
 * signHead(head, { verificationMethod, created, privateKey }) -> new head object with `.proof` set.
 * `verificationMethod` MUST equal `head.signer` (a head is self-attesting: the signer named in the
 * payload is the same did:key that produces the proof). `created`: caller-supplied ISO-8601 —
 * NEVER Date.now() here (determinism).
 */
export async function signHead(head, { verificationMethod, created, privateKey }) {
  if (!verificationMethod || !created || !privateKey) throw new Error('signHead requires { verificationMethod, created, privateKey }');
  if (verificationMethod !== head.signer) throw new Error('signHead: verificationMethod must equal head.signer — a head is self-attesting');
  const opts = proofOptions({ verificationMethod, created });
  const sigBytes = new Uint8Array(await globalThis.crypto.subtle.sign('Ed25519', privateKey, await hashData(head, opts)));
  const proof = { ...opts, proofValue: 'z' + b58encode(sigBytes) };
  return { ...securedHead(head), proof };
}

/**
 * verifyHeadProof(head, publicKey) -> boolean. publicKey: WebCrypto Ed25519 public CryptoKey
 * resolved from head.proof.verificationMethod (didKeyToPublicKey). Predicate: false on any
 * structural/crypto problem, never throws.
 */
export async function verifyHeadProof(head, publicKey) {
  const proof = head?.proof;
  if (!proof || proof.type !== 'DataIntegrityProof' || proof.cryptosuite !== CRYPTOSUITE) return false;
  if (proof.proofPurpose !== 'assertionMethod' || typeof proof.proofValue !== 'string' || proof.proofValue[0] !== 'z') return false;
  if (proof.verificationMethod !== head.signer) return false; // self-attestation, §HEAD-1.2
  const opts = proofOptions({ verificationMethod: proof.verificationMethod, created: proof.created });
  try {
    const sig = b58decode(proof.proofValue.slice(1));
    return await globalThis.crypto.subtle.verify('Ed25519', publicKey, sig, await hashData(head, opts));
  } catch { return false; }
}

/**
 * verifyChain(heads, { resolveKey }) -> { valid, length, headHashes, errors[] }.
 * heads: array of head objects (each carrying `.proof`), in seq order.
 * resolveKey: optional async (did) -> CryptoKey — when omitted, proof signatures are NOT
 * cryptographically verified and only the structural/chain laws below run (useful for a UI that
 * has no key resolver wired up yet; callers that skip it get `errors` entries saying so, never a
 * silent pass).
 *
 * Verification laws (§HEAD-1.2):
 *  - genesis: heads[0].prev_head_hash === null and heads[0].seq === 0.
 *  - seq strictly increasing across the array.
 *  - prev_head_hash chains: heads[i].prev_head_hash === headHash(heads[i-1]).
 *  - signer continuity: heads[i].signer === heads[i-1].signer, UNLESS heads[i-1] carries
 *    `rotates_to === heads[i].signer` (an explicit rotation head — the OLD key signs a head whose
 *    payload names the new key; KERI pre-rotation is the cited design lineage, not imported code).
 */
export async function verifyChain(heads, { resolveKey } = {}) {
  const errors = [];
  const headHashes = [];
  if (!Array.isArray(heads) || heads.length === 0) return { valid: false, length: 0, headHashes: [], errors: ['empty chain'] };

  if (heads[0].prev_head_hash !== null) errors.push('genesis: heads[0].prev_head_hash must be null');
  if (heads[0].seq !== 0) errors.push('genesis: heads[0].seq must be 0');

  for (let i = 0; i < heads.length; i++) {
    const h = heads[i];
    headHashes.push(await headHash(h));
    if (i > 0) {
      const prev = heads[i - 1];
      if (!(h.seq > prev.seq)) errors.push(`seq not strictly increasing at index ${i} (${prev.seq} -> ${h.seq})`);
      if (h.prev_head_hash !== headHashes[i - 1]) errors.push(`prev_head_hash mismatch at index ${i}: expected ${headHashes[i - 1]}, got ${h.prev_head_hash}`);
      const rotated = prev.rotates_to !== undefined && prev.rotates_to === h.signer;
      if (h.signer !== prev.signer && !rotated) errors.push(`signer discontinuity at index ${i}: ${prev.signer} -> ${h.signer} with no matching rotates_to on the prior head`);
    }
    if (resolveKey) {
      try {
        const pub = await resolveKey(h.signer);
        if (!pub || !(await verifyHeadProof(h, pub))) errors.push(`proof verification failed at index ${i} (signer ${h.signer})`);
      } catch (e) {
        errors.push(`proof verification threw at index ${i}: ${e.message}`);
      }
    } else {
      errors.push(`proof NOT cryptographically verified at index ${i} — no resolveKey supplied (structural checks only)`);
    }
  }
  return { valid: errors.length === 0, length: heads.length, headHashes, errors };
}

/**
 * detectEquivocation(headA, headB) -> the portable misbehavior evidence: two heads for the SAME
 * (stream, seq), both validly self-attested, but with different content — the signer claimed two
 * different tips at the same sequence number. Backing-ladder honesty note (§HEAD-1.3): a head FILE
 * alone (ocg-head-file@1) can only ever prove "the signer claimed this tip" — detecting that the
 * signer claimed TWO tips requires collecting both files (or the ocg-head-tlog@1 witness-cosigned
 * batch already surfacing a fork). This function is the comparison once you have both.
 */
export async function detectEquivocation(headA, headB) {
  if (headA.stream !== headB.stream || headA.seq !== headB.seq) return { equivocation: false, reason: 'different (stream, seq) — not comparable' };
  const [ha, hb] = [await headHash(headA), await headHash(headB)];
  if (ha === hb) return { equivocation: false, reason: 'identical head — same claim, not a conflict' };
  if (headA.signer !== headB.signer) return { equivocation: false, reason: 'different signers at the same (stream, seq) — a signer dispute, not equivocation by one signer' };
  return { equivocation: true, reason: `signer ${headA.signer} produced two different heads at stream=${headA.stream} seq=${headA.seq}`, headHashA: ha, headHashB: hb };
}
