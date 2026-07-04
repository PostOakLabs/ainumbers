// _anchor-testutil.mjs — shared zero-npm-dep helpers for the §20 Anchor Binding gate
// (anchor-binding.test.mjs) and its fixture generator (_regen-anchor-fixtures.mjs).
// Node 18+ builtins only (node:crypto). NOT a gate itself.
//
// Contents: minimal DER reader/writer (RFC 3161/CMS structures), minimal CBOR codec
// (COSE_Sign1 receipts, RFC 9942), RFC 6962/9162 Merkle tree + inclusion-proof math,
// and C2SP signed-note / checkpoint / cosignature-v1 primitives (c2sp.org/tlog-checkpoint,
// c2sp.org/tlog-cosignature, c2sp.org/signed-note — formats verified 2026-07-02).

import { createHash, createPublicKey, sign as edSign, verify as edVerify } from 'node:crypto';

export const sha256 = (b) => createHash('sha256').update(b).digest();

// ── DER (subset: definite lengths only — all RFC 3161/CMS producers use them) ────────────────────
export function derRead(buf, off = 0) {
  const tag = buf[off];
  let len = buf[off + 1];
  let hdr = 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + buf[off + 2 + i];
    hdr = 2 + n;
  }
  return { tag, start: off + hdr, end: off + hdr + len, header: hdr, content: buf.subarray(off + hdr, off + hdr + len), raw: buf.subarray(off, off + hdr + len) };
}
// Children iterator over a node's content — absolute offsets into the same buffer.
export function derChildrenOf(buf, node) {
  const out = [];
  let off = node.start;
  while (off < node.end) { const c = derRead(buf, off); out.push(c); off = c.end; }
  return out;
}
export function derOidToString(content) {
  const out = [Math.floor(content[0] / 40), content[0] % 40];
  let v = 0;
  for (let i = 1; i < content.length; i++) {
    v = v * 128 + (content[i] & 0x7f);
    if (!(content[i] & 0x80)) { out.push(v); v = 0; }
  }
  return out.join('.');
}
export function derOidFromString(oid) {
  const parts = oid.split('.').map(Number);
  const bytes = [parts[0] * 40 + parts[1]];
  for (const p of parts.slice(2)) {
    const stack = [p & 0x7f];
    let v = Math.floor(p / 128);
    while (v > 0) { stack.push((v & 0x7f) | 0x80); v = Math.floor(v / 128); }
    bytes.push(...stack.reverse());
  }
  return Buffer.from(bytes);
}
export function derEnc(tag, content) {
  const len = content.length;
  let lenBytes;
  if (len < 0x80) lenBytes = Buffer.from([len]);
  else {
    const bs = [];
    let v = len;
    while (v > 0) { bs.unshift(v & 0xff); v >>>= 8; }
    lenBytes = Buffer.from([0x80 | bs.length, ...bs]);
  }
  return Buffer.concat([Buffer.from([tag]), lenBytes, content]);
}
export const derSeq = (...parts) => derEnc(0x30, Buffer.concat(parts));
export const derOid = (oid) => derEnc(0x06, derOidFromString(oid));
export const derNull = () => Buffer.from([0x05, 0x00]);
export const derOctet = (b) => derEnc(0x04, b);
export const derBool = (v) => Buffer.from([0x01, 0x01, v ? 0xff : 0x00]);
export const derInt = (n) => {
  let bs = [];
  let v = BigInt(n);
  if (v === 0n) bs = [0];
  while (v > 0n) { bs.unshift(Number(v & 0xffn)); v >>= 8n; }
  if (bs[0] & 0x80) bs.unshift(0);
  return derEnc(0x02, Buffer.from(bs));
};

// ── CBOR (subset: uint, negint, bstr, tstr, array, map, null, tag) ──────────────────────────────
export class CborTag { constructor(tag, value) { this.tag = tag; this.value = value; } }
export function cborEncode(v) {
  if (v instanceof CborTag) return Buffer.concat([head(6, v.tag), cborEncode(v.value)]);
  if (v === null) return Buffer.from([0xf6]);
  if (typeof v === 'number' || typeof v === 'bigint') {
    const n = BigInt(v);
    return n >= 0n ? head(0, n) : head(1, -1n - n);
  }
  if (Buffer.isBuffer(v) || v instanceof Uint8Array) return Buffer.concat([head(2, BigInt(v.length)), Buffer.from(v)]);
  if (typeof v === 'string') { const b = Buffer.from(v, 'utf8'); return Buffer.concat([head(3, BigInt(b.length)), b]); }
  if (Array.isArray(v)) return Buffer.concat([head(4, BigInt(v.length)), ...v.map(cborEncode)]);
  if (v instanceof Map) {
    const parts = [head(5, BigInt(v.size))];
    for (const [k, val] of v) { parts.push(cborEncode(k), cborEncode(val)); }
    return Buffer.concat(parts);
  }
  throw new Error('cborEncode: unsupported ' + typeof v);
}
function head(major, n) {
  n = BigInt(n);
  const m = major << 5;
  if (n < 24n) return Buffer.from([m | Number(n)]);
  if (n < 256n) return Buffer.from([m | 24, Number(n)]);
  if (n < 65536n) { const b = Buffer.alloc(3); b[0] = m | 25; b.writeUInt16BE(Number(n), 1); return b; }
  if (n < 4294967296n) { const b = Buffer.alloc(5); b[0] = m | 26; b.writeUInt32BE(Number(n), 1); return b; }
  const b = Buffer.alloc(9); b[0] = m | 27; b.writeBigUInt64BE(n, 1); return b;
}
export function cborDecode(buf) { const [v, off] = dec(buf, 0); if (off !== buf.length) throw new Error('cbor: trailing bytes'); return v; }
export function cborDecodePrefix(buf) { return dec(buf, 0); }
function dec(buf, off) {
  const ib = buf[off];
  const major = ib >> 5;
  let ai = ib & 0x1f;
  let n = 0n;
  let p = off + 1;
  if (ai < 24) n = BigInt(ai);
  else if (ai === 24) { n = BigInt(buf[p]); p += 1; }
  else if (ai === 25) { n = BigInt(buf.readUInt16BE(p)); p += 2; }
  else if (ai === 26) { n = BigInt(buf.readUInt32BE(p)); p += 4; }
  else if (ai === 27) { n = buf.readBigUInt64BE(p); p += 8; }
  else if (major === 7 && ai === 22) return [null, p];
  else throw new Error('cbor: unsupported additional info ' + ai);
  switch (major) {
    case 0: return [n <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(n) : n, p];
    case 1: { const v = -1n - n; return [v >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(v) : v, p]; }
    case 2: return [Buffer.from(buf.subarray(p, p + Number(n))), p + Number(n)];
    case 3: return [buf.subarray(p, p + Number(n)).toString('utf8'), p + Number(n)];
    case 4: { const arr = []; for (let i = 0; i < Number(n); i++) { const [v, np] = dec(buf, p); arr.push(v); p = np; } return [arr, p]; }
    case 5: { const m = new Map(); for (let i = 0; i < Number(n); i++) { const [k, kp] = dec(buf, p); const [v, vp] = dec(buf, kp); m.set(k, v); p = vp; } return [m, p]; }
    case 6: { const [v, np] = dec(buf, p); return [new CborTag(Number(n), v), np]; }
    case 7: if (ai === 22) return [null, p]; throw new Error('cbor: unsupported simple value');
    default: throw new Error('cbor: bad major ' + major);
  }
}

// ── RFC 6962 / RFC 9162 Merkle tree ──────────────────────────────────────────────────────────────
export const leafHash = (data) => sha256(Buffer.concat([Buffer.from([0x00]), data]));
export const nodeHash = (l, r) => sha256(Buffer.concat([Buffer.from([0x01]), l, r]));
// Merkle Tree Hash over leaf hashes (RFC 6962 §2.1) — for the small fixed trees the fixtures use.
export function mth(leafHashes) {
  const n = leafHashes.length;
  if (n === 1) return leafHashes[0];
  let k = 1;
  while (k * 2 < n) k *= 2;
  return nodeHash(mth(leafHashes.slice(0, k)), mth(leafHashes.slice(k)));
}
// Audit path for leaf m in tree of n leaf hashes (RFC 6962 §2.1.1).
export function auditPath(m, leafHashes) {
  const n = leafHashes.length;
  if (n === 1) return [];
  let k = 1;
  while (k * 2 < n) k *= 2;
  if (m < k) return [...auditPath(m, leafHashes.slice(0, k)), mth(leafHashes.slice(k))];
  return [...auditPath(m - k, leafHashes.slice(k)), mth(leafHashes.slice(0, k))];
}
// Root reconstruction from an inclusion path (RFC 9162 §2.1.3.2). Returns Buffer or null.
export function rootFromInclusion(leaf, index, size, path) {
  if (index >= size) return null;
  let fn = BigInt(index), sn = BigInt(size) - 1n;
  let r = leaf;
  for (const v of path) {
    if (sn === 0n) return null;
    if ((fn & 1n) === 1n || fn === sn) {
      r = nodeHash(v, r);
      if ((fn & 1n) === 0n) { while (fn !== 0n && (fn & 1n) === 0n) { fn >>= 1n; sn >>= 1n; } }
    } else {
      r = nodeHash(r, v);
    }
    fn >>= 1n; sn >>= 1n;
  }
  return sn === 0n ? r : null;
}

// ── §20 merkle_inclusion verifier (OCG Standard §20, v0.8) ────────────────────────────────────────
// OPTIONAL member on rfc3161-tst / opentimestamps bindings. When present, the artifact's
// execution_hash is a LEAF of an RFC 6962 (RFC 9162) Merkle tree whose ROOT is the value the
// timestamp service anchored (so ONE timestamp covers many artifacts — batch anchoring). Verifier:
//   1. mi.leaf MUST equal the artifact execution_hash (bare 64-hex);
//   2. reconstruct the root from leafHash(<32-byte exec hash>) + mi.path via rootFromInclusion;
//   3. the reconstructed root MUST equal the binding anchored_hash.
// Reuses the SAME leafHash/nodeHash/rootFromInclusion the c2sp/scitt verifiers use — no second
// Merkle implementation. Throws on any failure; returns { rootHex } on success.
export function verifyMerkleInclusion(mi, { anchoredHashHex, execHashHex }) {
  if (!mi || typeof mi !== 'object') throw new Error('merkle_inclusion must be an object');
  if (mi.algorithm !== 'rfc6962') throw new Error('merkle_inclusion.algorithm must be "rfc6962"');
  const leafHex = String(mi.leaf).replace(/^sha256:/, '');
  if (!/^[0-9a-f]{64}$/.test(leafHex)) throw new Error('merkle_inclusion.leaf must be a 64-hex digest');
  if (leafHex !== execHashHex) throw new Error('merkle_inclusion.leaf != artifact execution_hash');
  if (!Number.isInteger(mi.index) || mi.index < 0) throw new Error('merkle_inclusion.index must be a non-negative integer');
  if (!Number.isInteger(mi.tree_size) || mi.tree_size <= 0) throw new Error('merkle_inclusion.tree_size must be a positive integer');
  if (!Array.isArray(mi.path)) throw new Error('merkle_inclusion.path must be an array');
  const L = leafHash(Buffer.from(leafHex, 'hex'));
  const path = mi.path.map((h) => Buffer.from(String(h).replace(/^sha256:/, ''), 'hex'));
  const root = rootFromInclusion(L, mi.index, mi.tree_size, path);
  if (!root) throw new Error('merkle_inclusion path does not reconstruct a root (index/size/path inconsistent)');
  const rootHex = root.toString('hex');
  if (rootHex !== String(anchoredHashHex).replace(/^sha256:/, '')) throw new Error('reconstructed Merkle root != anchored_hash');
  return { rootHex };
}

// ── Ed25519 raw-key plumbing (node:crypto) ───────────────────────────────────────────────────────
const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
export const rawToPublicKey = (raw32) => createPublicKey({ key: Buffer.concat([SPKI_ED25519_PREFIX, raw32]), format: 'der', type: 'spki' });
export const publicKeyToRaw = (keyObj) => Buffer.from(keyObj.export({ format: 'der', type: 'spki' })).subarray(-32);
export const ed25519Sign = (msg, privateKey) => edSign(null, msg, privateKey);
export const ed25519Verify = (msg, sig, publicKey) => { try { return edVerify(null, msg, publicKey, sig); } catch { return false; } };

// ── C2SP signed note / checkpoint / cosignature v1 ───────────────────────────────────────────────
// Key ID = first 4 bytes of SHA-256(key name || 0x0A || type byte || 32-byte Ed25519 public key).
// Type 0x01 = log Ed25519 signature over the note text; type 0x04 = cosignature/v1.
export const NOTE_SIG_TYPE_ED25519 = 0x01;
export const NOTE_SIG_TYPE_COSIG_V1 = 0x04;
export function noteKeyId(name, typeByte, rawPub32) {
  return sha256(Buffer.concat([Buffer.from(name, 'utf8'), Buffer.from([0x0a, typeByte]), rawPub32])).subarray(0, 4);
}
// Signature line: EM DASH (U+2014), space, key name, space, base64(keyID(4) || sig bytes).
export function noteSigLine(name, blob) { return `— ${name} ${blob.toString('base64')}`; }
export function signNote(body, name, privateKey, rawPub32) {
  const sig = ed25519Sign(Buffer.from(body, 'utf8'), privateKey);
  return noteSigLine(name, Buffer.concat([noteKeyId(name, NOTE_SIG_TYPE_ED25519, rawPub32), sig]));
}
// Cosignature/v1 signs: "cosignature/v1\n" + "time <unix>\n" + note body. Blob carries the
// timestamp: base64(keyID(4) || uint64-BE timestamp || Ed25519 sig(64)).
export function cosignV1(body, name, privateKey, rawPub32, unixTime) {
  const msg = Buffer.from(`cosignature/v1\ntime ${unixTime}\n` + body, 'utf8');
  const ts = Buffer.alloc(8);
  ts.writeBigUInt64BE(BigInt(unixTime));
  const sig = ed25519Sign(msg, privateKey);
  return noteSigLine(name, Buffer.concat([noteKeyId(name, NOTE_SIG_TYPE_COSIG_V1, rawPub32), ts, sig]));
}
// Parse a signed note into { body (incl. final newline), sigs: [{name, blob}] }.
export function parseNote(text) {
  const idx = text.indexOf('\n\n');
  if (idx === -1) throw new Error('signed note: no blank-line separator');
  const body = text.slice(0, idx + 1);
  const sigs = [];
  for (const line of text.slice(idx + 2).split('\n')) {
    if (!line) continue;
    const m = line.match(/^— (\S+) (\S+)$/);
    if (!m) throw new Error('signed note: malformed signature line');
    sigs.push({ name: m[1], blob: Buffer.from(m[2], 'base64') });
  }
  return { body, sigs };
}
export function verifyNoteSig(body, name, rawPub32, blob) {
  if (blob.length !== 4 + 64) return false;
  if (!blob.subarray(0, 4).equals(noteKeyId(name, NOTE_SIG_TYPE_ED25519, rawPub32))) return false;
  return ed25519Verify(Buffer.from(body, 'utf8'), blob.subarray(4), rawToPublicKey(rawPub32));
}
export function verifyCosigV1(body, name, rawPub32, blob) {
  if (blob.length !== 4 + 8 + 64) return false;
  if (!blob.subarray(0, 4).equals(noteKeyId(name, NOTE_SIG_TYPE_COSIG_V1, rawPub32))) return false;
  const ts = blob.readBigUInt64BE(4);
  const msg = Buffer.from(`cosignature/v1\ntime ${ts}\n` + body, 'utf8');
  return ed25519Verify(msg, blob.subarray(12), rawToPublicKey(rawPub32));
}
