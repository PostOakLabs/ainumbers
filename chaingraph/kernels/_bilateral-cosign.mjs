// _bilateral-cosign.mjs — OCG bilateral-cosign backing-ladder type (SPEC.md §HEAD-1.3
// `ocg-head-bilateral-cosign@1`). Zero-dep, Node 18+ / browser / Worker.
//
// A named-role counterpart to the §20.2 witness-cosignature construction: instead of "≥k of n
// anonymous witnesses cosign a Merkle batch root," this is "the counterparty(ies) a §HEAD-1
// signer has agreed to be cosigned by sign this specific head_hash." Reuses the C2SP
// tlog-checkpoint signed-note text format byte-for-byte (pinned `signed-note/v1.0.0`,
// `tlog-cosignature/v1.0.1` — the SAME pins art-424-witness-cosignature-verifier.kernel.mjs's
// §20.2 implementation uses), narrowed to a 2-line header (origin + the head_hash being
// cosigned) instead of §20.2's 3-line origin/size/root tlog-checkpoint header — a bilateral
// cosign anchors one head_hash, not a batch root. Hand-rolled here rather than imported from
// the art-424 kernel or a shared module, matching the `_car.mjs`/§APROV-1.2 precedent of one
// narrowly-scoped file per format instead of a general-purpose library.
//
// ⛔ Liveness-duty note (memory `project-ainumbers-corda-tripwires`, restated as binding spec
// text in SPEC.md's equivocation corollary below §HEAD-1.3): every function here is a pure,
// offline verification/signing primitive. Nothing in this file operates, mirrors, or serves
// anything — org A's Helm produces a note, sends it out of band, org B signs and returns it,
// org A attaches the binding to its head. No party of ours is anywhere in that loop.
//
// ⛔ A cosigned head-commit ATTESTS — it is evidence two parties agreed a tip existed at a point
// in time — it never FINALIZES. This file never picks a winner between two conflicting heads;
// see detectEquivocation() in ./_head.mjs for the (unmodified) equivocation check this binding
// type adds evidentiary weight to, not a new check.

import { headHash, didKeyToPublicKey } from './_head.mjs';

export const BINDING_TYPE = 'ocg-head-bilateral-cosign@1';

// Go sumdb note package's assigned Ed25519 algorithm byte — the SAME constant
// art-424-witness-cosignature-verifier.kernel.mjs uses for its §20.2 witness cosignatures.
// §HEAD-1 signers are always Ed25519 (`signer: "did:key:<ed25519>"`, §HEAD-1.0), so no
// algorithm-selection branch is needed here the way art-424's multi-algorithm witness set has.
const ED25519_NOTE_ALG = 0x01;

const enc = new TextEncoder();

function b64encode(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function b64decode(s) {
  const bin = atob(String(s || '').trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function concatBytes(...arrays) {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}
function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
async function sha256(bytes) {
  return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
}
function writeUint64BE(msSinceEpoch) {
  const out = new Uint8Array(8);
  let v = BigInt(Math.trunc(msSinceEpoch));
  for (let i = 7; i >= 0; i--) { out[i] = Number(v & 0xffn); v >>= 8n; }
  return out;
}
function readUint64BE(bytes) {
  let v = 0n;
  for (let i = 0; i < 8; i++) v = (v << 8n) | BigInt(bytes[i]);
  return v; // BigInt — timestamps stay exact past 2^53
}
async function rawPubkeyFromDidKey(didKeyStr) {
  const key = await didKeyToPublicKey(didKeyStr);
  return new Uint8Array(await globalThis.crypto.subtle.exportKey('raw', key));
}
async function cosignKeyId(didKeyStr, rawPubKey) {
  const msg = concatBytes(enc.encode(didKeyStr + '\n'), Uint8Array.of(ED25519_NOTE_ALG), rawPubKey);
  return (await sha256(msg)).slice(0, 4);
}

/**
 * buildNoteText(logOrigin, anchoredHash) -> the C2SP signed-note HEADER text (origin line +
 * head_hash line, newline-terminated) a caller signs cosignature lines against. `anchoredHash`
 * MUST be the "sha256:"-prefixed §HEAD-1.1 head_hash of the head being cosigned.
 */
export function buildNoteText(logOrigin, anchoredHash) {
  if (typeof logOrigin !== 'string' || !logOrigin) throw new Error('buildNoteText: logOrigin is required');
  if (typeof anchoredHash !== 'string' || !anchoredHash.startsWith('sha256:')) throw new Error('buildNoteText: anchoredHash must be a "sha256:"-prefixed digest');
  return `${logOrigin}\n${anchoredHash}\n`;
}

/**
 * parseNote(text) -> { origin, anchoredHash, noteText, sigLines } | { error }.
 * Parses "<origin>\n<anchored_hash>\n", a blank line, then zero or more
 * "— <did:key cosigner name> <base64 cosignature/v1 blob>" lines — the same C2SP signed-note
 * shape SPEC.md §20.2 defines, applied to this binding's 2-line header instead of §20.2's
 * 3-line origin/size/root tlog-checkpoint header.
 */
export function parseNote(text) {
  const raw = typeof text === 'string' ? text : '';
  const sep = raw.indexOf('\n\n');
  if (sep < 0) return { error: 'note has no header/signature separator (blank line)' };
  const header = raw.slice(0, sep);
  const sigBlock = raw.slice(sep + 2);
  const headerLines = header.split('\n').filter((l) => l.length > 0);
  if (headerLines.length < 2) return { error: 'note header needs an origin line and an anchored_hash line' };
  const [origin, anchoredHash] = headerLines;
  if (!anchoredHash.startsWith('sha256:')) return { error: 'note anchored_hash line must be "sha256:"-prefixed' };
  const noteText = header + '\n';
  const sigLines = sigBlock.split('\n')
    .filter((l) => l.startsWith('— ') || l.startsWith('- '))
    .map((l) => {
      const body = l.slice(2);
      const spaceAt = body.indexOf(' ');
      if (spaceAt < 0) return null;
      return { name: body.slice(0, spaceAt), blob_b64: body.slice(spaceAt + 1).trim() };
    })
    .filter(Boolean);
  return { origin, anchoredHash, noteText, sigLines };
}

/**
 * signCosignLine(noteText, { didKey, privateKey, timestampMs }) -> "— <didKey> <base64 blob>".
 * blob = keyid[4] + timestamp[8, BE ms-since-epoch] + Ed25519 signature[64] — the same
 * cosignature/v1 blob shape §20.2 already defines. `didKey` is both the cosigner's identity
 * (the note's "keyname") and the source of its own public key (via didKeyToPublicKey) — a
 * bilateral relationship has no separate witness-name-to-key registry (SPEC.md §HEAD-1.3's
 * no-registry note). `timestampMs` is caller-supplied — NEVER Date.now() here (determinism).
 */
export async function signCosignLine(noteText, { didKey, privateKey, timestampMs }) {
  if (!didKey || !privateKey || !Number.isFinite(timestampMs)) throw new Error('signCosignLine requires { didKey, privateKey, timestampMs }');
  const rawPubKey = await rawPubkeyFromDidKey(didKey);
  const keyId = await cosignKeyId(didKey, rawPubKey);
  const timestampBytes = writeUint64BE(timestampMs);
  const timestamp = readUint64BE(timestampBytes).toString();
  const msg = enc.encode('cosignature/v1\n' + timestamp + '\n' + noteText);
  const sig = new Uint8Array(await globalThis.crypto.subtle.sign('Ed25519', privateKey, msg));
  const blob = concatBytes(keyId, timestampBytes, sig);
  return `— ${didKey} ${b64encode(blob)}`;
}

async function verifyOneCosigner(didKey, sigLine, noteText) {
  if (!sigLine) return { name: didKey, present: false, valid: false, keyid_match: false };

  let blob;
  try { blob = b64decode(sigLine.blob_b64); } catch { return { name: didKey, present: true, valid: false, keyid_match: false, error: 'signature blob is not valid base64' }; }
  if (blob.length < 13) return { name: didKey, present: true, valid: false, keyid_match: false, error: 'cosignature/v1 blob too short (need keyid[4] + timestamp[8] + signature)' };

  let publicKey, rawPubKey;
  try { publicKey = await didKeyToPublicKey(didKey); rawPubKey = new Uint8Array(await globalThis.crypto.subtle.exportKey('raw', publicKey)); }
  catch { return { name: didKey, present: true, valid: false, keyid_match: false, error: 'cosigner_keys entry is not a resolvable Ed25519 did:key' }; }

  const keyId = blob.slice(0, 4);
  const timestampBytes = blob.slice(4, 12);
  const sig = blob.slice(12);
  const expectedKeyId = await cosignKeyId(didKey, rawPubKey);
  const keyid_match = bytesEqual(keyId, expectedKeyId);
  const timestamp = readUint64BE(timestampBytes).toString();
  if (!keyid_match) return { name: didKey, present: true, valid: false, keyid_match: false, timestamp };

  const msg = enc.encode('cosignature/v1\n' + timestamp + '\n' + noteText);
  let valid = false;
  try { valid = await globalThis.crypto.subtle.verify('Ed25519', publicKey, sig, msg); } catch { valid = false; }
  return { name: didKey, present: true, valid, keyid_match: true, timestamp };
}

/**
 * buildBilateralCosignBinding(head, cosigners, { logOrigin, timestampMs, threshold }) ->
 * a full `anchor_bindings[]` entry per SPEC.md §HEAD-1.3's `ocg-head-bilateral-cosign@1` shape.
 * `head` is the head object being cosigned (its head_hash is recomputed here, never trusted
 * from the caller). `cosigners`: array of { didKey, privateKey } — every entry signs the SAME
 * note text. `threshold`: OPTIONAL k-of-n; omitted means n-of-n (ALL cosigner_keys required).
 */
export async function buildBilateralCosignBinding(head, cosigners, { logOrigin, timestampMs, threshold } = {}) {
  const anchoredHash = await headHash(head);
  const noteText = buildNoteText(logOrigin, anchoredHash);
  const lines = [];
  for (const c of cosigners) lines.push(await signCosignLine(noteText, { didKey: c.didKey, privateKey: c.privateKey, timestampMs }));
  const binding = {
    type: BINDING_TYPE,
    anchored_hash: anchoredHash,
    log_origin: logOrigin,
    proof: noteText + '\n' + lines.join('\n') + '\n',
    cosigner_keys: cosigners.map((c) => c.didKey),
  };
  if (Number.isInteger(threshold)) binding.threshold = threshold;
  return binding;
}

/**
 * verifyBilateralCosignBinding(binding, head) -> { valid, skipped?, anchored_hash_match,
 * origin_match, valid_witness_count, threshold, cosignatures[], errors[] }.
 *
 * §HEAD-1.3 unknown-type forward-compat: a `binding.type` other than BINDING_TYPE is SKIPPED
 * (`skipped: true`, `valid: false`, one explanatory error) rather than treated as a hard parse
 * failure — mirrors how any unrecognized §20 anchor-binding type must already be skippable by
 * an older verifier without failing overall head-chain verification (§HEAD-1.2's chain laws,
 * checked separately by verifyChain() in ./_head.mjs, are entirely unaffected by this — a
 * binding is never part of the head object's own hashed shape).
 *
 * Threshold is explicit per binding: absent binding.threshold, ALL of cosigner_keys are
 * required (n-of-n). Only cosigner_keys named in the binding are ever counted toward the
 * threshold — a syntactically valid cosignature line from a key NOT in cosigner_keys is never
 * looked up and so can never silently inflate the count (§5 vector 5).
 */
export async function verifyBilateralCosignBinding(binding, head) {
  if (!binding || binding.type !== BINDING_TYPE) {
    return { valid: false, skipped: true, anchored_hash_match: false, origin_match: false, valid_witness_count: 0, threshold: 0, cosignatures: [], errors: ['unrecognized anchor_bindings[] type — skipped, not a chain-verification failure'] };
  }

  const errors = [];
  const cosignerKeys = Array.isArray(binding.cosigner_keys) ? binding.cosigner_keys : [];
  const threshold = Number.isInteger(binding.threshold) ? binding.threshold : cosignerKeys.length;
  if (cosignerKeys.length === 0) errors.push('cosigner_keys must name at least one counterparty key');
  if (threshold < 1 || threshold > cosignerKeys.length) errors.push('threshold must be between 1 and cosigner_keys.length');

  const parsed = parseNote(binding.proof);
  if (parsed.error) return { valid: false, skipped: false, anchored_hash_match: false, origin_match: false, valid_witness_count: 0, threshold, cosignatures: [], errors: [parsed.error, ...errors] };

  const actualHeadHash = await headHash(head);
  const anchored_hash_match = binding.anchored_hash === actualHeadHash && parsed.anchoredHash === actualHeadHash;
  if (!anchored_hash_match) errors.push(`anchored_hash mismatch: binding names ${binding.anchored_hash}, note names ${parsed.anchoredHash}, the head's OWN recomputed head_hash is ${actualHeadHash}`);

  const origin_match = !binding.log_origin || parsed.origin === binding.log_origin;
  if (!origin_match) errors.push('note origin line does not match binding.log_origin');

  const byName = new Map(parsed.sigLines.map((l) => [l.name, l]));
  const cosignatures = [];
  let valid_witness_count = 0;
  for (const didKey of cosignerKeys) {
    const r = await verifyOneCosigner(didKey, byName.get(didKey), parsed.noteText);
    cosignatures.push(r);
    if (r.valid) valid_witness_count++;
  }
  const threshold_met = valid_witness_count >= threshold;
  if (!threshold_met) errors.push(`${valid_witness_count} of ${threshold} required valid cosignature(s)`);

  return { valid: errors.length === 0, skipped: false, anchored_hash_match, origin_match, valid_witness_count, threshold, cosignatures, errors };
}
