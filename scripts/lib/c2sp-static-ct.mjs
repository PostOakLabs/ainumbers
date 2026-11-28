// c2sp-static-ct.mjs -- C2SP static-ct-api checkpoint and tile verification.
//
// Specs (C2SP, captured under research/clause-snapshots/static-ct/):
//   static-ct-api v1.1.0  checkpoint signature (type 0x05), tiles, data tiles,
//                         the leaf_index SCT extension
//   tlog-tiles v1.0.0     <L>/<N>[.p/<W>] tile paths, partial tiles
//   tlog-checkpoint v1.1.0
//   mtc-tlog v0.1.0       EDITOR'S COPY, a draft spec: kept behind `draft: true`
//
// Reuses the shared RFC 6962 / signed-note primitives from
// chaingraph/kernels/c2sp-tlog-verify.mjs, imported read-only. Nothing here
// duplicates the Merkle walk or the note framing.
//
// Pure functions of their arguments: zero fetch, zero network. The caller
// supplies every byte (checkpoint text, tile bytes, the log key). Runs in
// Node 18+ and browsers (WebCrypto, no Buffer).

import {
  parseSignedNote, verifyInclusion, hashLeafNode, hashInteriorNode, sha256,
  concatBytes, bytesEqual, bytesToHex, base64ToBytes,
} from '../../chaingraph/kernels/c2sp-tlog-verify.mjs';

export const TILE_WIDTH = 256;
export const HASH_LEN = 32;
export const SIG_TYPE_RFC6962 = 0x05;

// ---------------------------------------------------------------------------
// Checkpoint
// ---------------------------------------------------------------------------

// Strict parse. Throws on anything malformed: a checkpoint is the trust root of
// every later step, so a lenient reading would hide a bad input.
export function parseStaticCtCheckpoint(text) {
  if (typeof text !== 'string' || text.length === 0) throw new Error('checkpoint: empty input');
  const lines = text.split('\n');
  if (lines.length < 4) throw new Error('checkpoint: too few lines');
  if (!lines[0] || /\s/.test(lines[0])) throw new Error('checkpoint: origin line missing or contains whitespace');
  if (!/^(0|[1-9][0-9]*)$/.test(lines[1])) throw new Error('checkpoint: size line is not a canonical decimal integer');
  if (!/^[A-Za-z0-9+/]{43}=$/.test(lines[2])) throw new Error('checkpoint: root line is not a 32-byte base64 hash');
  let note;
  try { note = parseSignedNote(text); } catch (e) { throw new Error(`checkpoint: ${e.message}`); }
  if (note.extensionLines.some((l) => l.startsWith('— '))) throw new Error('checkpoint: signature line before the blank separator');
  if (!Number.isSafeInteger(note.size) || note.size < 1) throw new Error('checkpoint: size must be a positive safe integer');
  if (note.rootHash.length !== HASH_LEN) throw new Error('checkpoint: root hash is not 32 bytes');
  return note;
}

// DER ECDSA-Sig-Value to the raw r||s form WebCrypto verifies.
function derToRaw(der) {
  let i = 0;
  const need = (n) => { if (i + n > der.length) throw new Error('ecdsa: truncated DER'); };
  need(2);
  if (der[i++] !== 0x30) throw new Error('ecdsa: not a DER SEQUENCE');
  if (der[i++] !== der.length - 2) throw new Error('ecdsa: bad SEQUENCE length');
  const out = new Uint8Array(64);
  for (let k = 0; k < 2; k++) {
    need(2);
    if (der[i++] !== 0x02) throw new Error('ecdsa: not a DER INTEGER');
    const len = der[i++];
    need(len);
    let v = der.subarray(i, i + len);
    i += len;
    while (v.length > 32 && v[0] === 0) v = v.subarray(1);
    if (v.length > 32) throw new Error('ecdsa: integer too long');
    out.set(v, k * 32 + 32 - v.length);
  }
  if (i !== der.length) throw new Error('ecdsa: trailing bytes');
  return out;
}

// static-ct-api, Checkpoints: key ID = SHA-256(name || 0x0A || 0x05 || LogID)[:4].
export async function staticCtKeyId(name, logId) {
  const h = await sha256(new TextEncoder().encode(name), new Uint8Array([0x0a, SIG_TYPE_RFC6962]), logId);
  return bytesToHex(h.subarray(0, 4));
}

// Verify the type-0x05 RFC6962NoteSignature line against the log key. Lines with
// an unknown key ID are ignored (static-ct-api: clients MUST ignore them).
// `logKeySpki` is the log's DER SPKI (ECDSA P-256); `logId` is its 32-byte LogID.
export async function verifyStaticCtCheckpointSignature(cp, { logKeySpki, logId }) {
  if (cp.extensionLines.length) return { ok: false, reason: 'checkpoint carries extension lines, forbidden for this signature type' };
  if (!(logId instanceof Uint8Array) || logId.length !== HASH_LEN) return { ok: false, reason: 'logId must be 32 bytes' };
  const want = await staticCtKeyId(cp.origin, logId);
  const sigs = cp.cosignatures.filter((c) => c.name === cp.origin && c.keyIdHex === want);
  if (sigs.length === 0) return { ok: false, reason: 'no signature line with the expected key name and key ID' };
  const body = sigs[0].sigBytes;
  // uint64 timestamp || DigitallyTigned{hash(1), sig(1), len(2), sig}
  if (body.length < 8 + 4) return { ok: false, reason: 'signature body too short' };
  const dv = new DataView(body.buffer, body.byteOffset, body.byteLength);
  const timestamp = dv.getBigUint64(0);
  const hashAlg = body[8], sigAlg = body[9], sigLen = dv.getUint16(10);
  if (hashAlg !== 4 || sigAlg !== 3) return { ok: false, reason: 'signature algorithm is not sha256/ecdsa' };
  if (12 + sigLen !== body.length) return { ok: false, reason: 'signature length field mismatch' };
  let raw;
  try { raw = derToRaw(body.subarray(12)); } catch (e) { return { ok: false, reason: e.message }; }
  // TreeHeadSignature: version 0, signature_type tree_hash(1), timestamp, tree_size, root.
  const msg = new Uint8Array(2 + 8 + 8 + HASH_LEN);
  const mv = new DataView(msg.buffer);
  mv.setUint8(0, 0); mv.setUint8(1, 1);
  mv.setBigUint64(2, timestamp); mv.setBigUint64(10, BigInt(cp.size));
  msg.set(cp.rootHash, 18);
  const key = await globalThis.crypto.subtle.importKey('spki', logKeySpki, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const ok = await globalThis.crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, raw, msg);
  return { ok, timestamp: timestamp.toString(), reason: ok ? null : 'ECDSA signature does not verify' };
}

// ---------------------------------------------------------------------------
// Tile paths (tlog-tiles + static-ct-api)
// ---------------------------------------------------------------------------

// Index 1234067 -> "x001/x234/067"; all but the last element carry an x prefix.
export function encodeTileIndex(n) {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('tile index must be a non-negative integer');
  const groups = [];
  do { groups.unshift(String(n % 1000).padStart(3, '0')); n = Math.floor(n / 1000); } while (n > 0);
  return groups.map((g, i) => (i < groups.length - 1 ? `x${g}` : g)).join('/');
}

// Width of tile (level, index) in a tree of `size`: 256 for a full tile, the
// floor(size/256^L) mod 256 remainder for the rightmost, otherwise an error.
export function tileWidthForSize(size, level, index) {
  if (!Number.isInteger(level) || level < 0 || level > 5) throw new Error('tile level must be 0..5');
  const entries = Math.floor(size / 256 ** level);
  const full = Math.floor(entries / TILE_WIDTH);
  if (index < full) return TILE_WIDTH;
  if (index === full && entries % TILE_WIDTH > 0) return entries % TILE_WIDTH;
  throw new Error(`tile ${level}/${index} does not exist in a tree of size ${size}`);
}

function suffix(width) { return width === TILE_WIDTH ? '' : `.p/${width}`; }

export function hashTilePath(level, index, size) {
  return `tile/${level}/${encodeTileIndex(index)}${suffix(tileWidthForSize(size, level, index))}`;
}
export function dataTilePath(index, size) {
  return `tile/data/${encodeTileIndex(index)}${suffix(tileWidthForSize(size, 0, index))}`;
}

// Decode "tile/<L>/<N>[.p/<W>]" or "tile/data/<N>[.p/<W>]". Returns null if malformed.
export function parseTilePath(path) {
  const m = /^tile\/(data|[0-5])\/((?:x[0-9]{3}\/)*[0-9]{3})(?:\.p\/([1-9][0-9]{0,2}))?$/.exec(path);
  if (!m) return null;
  const index = Number(m[2].replace(/x/g, '').split('/').join(''));
  const width = m[3] === undefined ? TILE_WIDTH : Number(m[3]);
  if (width > 255 && m[3] !== undefined) return null;
  return { kind: m[1] === 'data' ? 'data' : 'hash', level: m[1] === 'data' ? 0 : Number(m[1]), index, width, partial: m[3] !== undefined };
}

export function splitHashTile(bytes, width) {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0 || bytes.length % HASH_LEN !== 0) throw new Error('hash tile length is not a multiple of 32');
  if (width !== undefined && bytes.length !== width * HASH_LEN) throw new Error(`hash tile is ${bytes.length / HASH_LEN} hashes wide, expected ${width}`);
  const out = [];
  for (let i = 0; i < bytes.length; i += HASH_LEN) out.push(bytes.subarray(i, i + HASH_LEN));
  return out;
}

// A getTile(level, tileIndex, width) backed by a { path: bytes } map.
export function tileReaderFromMap(map, size) {
  return (level, index) => map[hashTilePath(level, index, size)];
}

// ---------------------------------------------------------------------------
// Merkle hashes from tiles
// ---------------------------------------------------------------------------

function largestPow2Below(n) { let k = 1; while (k * 2 < n) k *= 2; return k; }
function isPow2(n) { return n > 0 && Number.isInteger(Math.log2(n)); }

// Hash of the aligned subtree of 2^h leaves at position j, read from the stored
// level h/8 tile when h is a multiple of 8, else rebuilt from the level below.
async function nodeHash(h, j, size, getTile) {
  if (h % 8 !== 0) {
    const l = await nodeHash(h - 1, 2 * j, size, getTile);
    const r = await nodeHash(h - 1, 2 * j + 1, size, getTile);
    return hashInteriorNode(l, r);
  }
  const level = h / 8;
  const tileIndex = Math.floor(j / TILE_WIDTH);
  const width = tileWidthForSize(size, level, tileIndex);
  const bytes = getTile(level, tileIndex, width);
  if (!bytes) throw new Error(`missing tile ${level}/${tileIndex} (width ${width})`);
  const hashes = splitHashTile(bytes, width);
  const off = j % TILE_WIDTH;
  if (off >= hashes.length) throw new Error('tile too narrow for the requested hash');
  return hashes[off];
}

// MTH over leaves [lo, lo+n) where lo is aligned the way RFC 6962 splits it.
async function mth(lo, n, size, getTile) {
  if (isPow2(n)) return nodeHash(Math.round(Math.log2(n)), lo / n, size, getTile);
  const k = largestPow2Below(n);
  return hashInteriorNode(await mth(lo, k, size, getTile), await mth(lo + k, n - k, size, getTile));
}

export async function rootFromTiles({ size, getTile }) {
  return mth(0, size, size, getTile);
}

// RFC 6962 inclusion proof for `index`, assembled from tiles alone.
export async function inclusionProofFromTiles({ size, index, getTile }) {
  if (!Number.isInteger(index) || index < 0 || index >= size) throw new Error('index out of range');
  const proof = [];
  const walk = async (m, lo, n) => {
    if (n === 1) return;
    const k = largestPow2Below(n);
    if (m < k) { await walk(m, lo, k); proof.push(await mth(lo + k, n - k, size, getTile)); }
    else { await walk(m - k, lo + k, n - k); proof.push(await mth(lo, k, size, getTile)); }
  };
  await walk(index, 0, size);
  const leafBytes = getTile(0, Math.floor(index / TILE_WIDTH), tileWidthForSize(size, 0, Math.floor(index / TILE_WIDTH)));
  if (!leafBytes) throw new Error('missing level-0 tile holding the leaf');
  const leafHash = splitHashTile(leafBytes)[index % TILE_WIDTH];
  if (!leafHash) throw new Error('level-0 tile too narrow for the leaf');
  return { proof, leafHash };
}

// ---------------------------------------------------------------------------
// Data tiles and the leaf_index extension
// ---------------------------------------------------------------------------

class Reader {
  constructor(b) { this.b = b; this.i = 0; }
  take(n) {
    if (this.i + n > this.b.length) throw new Error('data tile: truncated');
    const s = this.b.subarray(this.i, this.i + n); this.i += n; return s;
  }
  uint(n) { let v = 0; for (const x of this.take(n)) v = v * 256 + x; return v; }
  get done() { return this.i >= this.b.length; }
}

// CtExtensions: list of { uint8 type, uint16 length, data }. Type 0 = leaf_index,
// a big-endian uint40. Returns the index, or null when the extension is absent.
export function decodeLeafIndexExtension(ext) {
  const r = new Reader(ext);
  let found = null;
  const seen = new Set();
  while (!r.done) {
    const type = r.uint(1);
    const data = r.take(r.uint(2));
    if (seen.has(type)) throw new Error('extensions: duplicate extension type');
    seen.add(type);
    if (type === 0) {
      if (data.length !== 5) throw new Error('leaf_index extension must carry exactly 5 bytes');
      found = new DataView(data.buffer, data.byteOffset, 5).getUint8(0) * 2 ** 32 + new DataView(data.buffer, data.byteOffset + 1, 4).getUint32(0);
    }
  }
  return found;
}

// Split a data tile into TileLeaf entries. Each keeps the raw timestamped_entry
// bytes, because the leaf hash is SHA-256(0x00 || 0x00 0x00 || timestamped_entry).
export function parseDataTile(bytes) {
  const r = new Reader(bytes);
  const entries = [];
  while (!r.done) {
    const start = r.i;
    const ts = r.take(8);
    const timestampMs = new DataView(ts.buffer, ts.byteOffset, 8).getBigUint64(0).toString();
    const entryType = r.uint(2);
    if (entryType === 0) r.take(r.uint(3));
    else if (entryType === 1) { r.take(HASH_LEN); r.take(r.uint(3)); }
    else throw new Error(`data tile: unknown entry_type ${entryType}`);
    const extensions = r.take(r.uint(2));
    const timestampedEntry = bytes.subarray(start, r.i);
    if (entryType === 1) r.take(r.uint(3)); // pre_certificate
    const chain = r.take(r.uint(2)); // certificate_chain: list of 32-byte fingerprints
    if (chain.length % HASH_LEN !== 0) throw new Error('data tile: certificate_chain is not a list of 32-byte fingerprints');
    entries.push({ timestampMs, entryType, timestampedEntry, raw: bytes.subarray(start, r.i), extensions, leafIndex: decodeLeafIndexExtension(extensions) });
  }
  return entries;
}

export async function leafHashOfEntry(entry) {
  return hashLeafNode(concatBytes([new Uint8Array([0x00, 0x00]), entry.timestampedEntry]));
}

// ---------------------------------------------------------------------------
// End to end
// ---------------------------------------------------------------------------

// Verify one log entry against a checkpoint, from tiles only:
//   1. checkpoint parses (and, when a log key is given, its signature verifies)
//   2. the data-tile entry hashes to the level-0 tile hash at that position
//   3. its leaf_index extension equals the index
//   4. the root rebuilt from the tiles equals the checkpoint root
//   5. the proof assembled from the tiles verifies through the shared RFC 6962 walk
// Returns a report; every step is reported, never short-circuited by an exception.
export async function verifyStaticCtEntry({ checkpointText, index, tiles, entryBytes, logKeySpki, logId }) {
  const report = { checkpoint: null, signature: null, leafHashMatchesTile: null, leafIndexExtension: null, rootFromTiles: null, inclusion: null, proofLength: null, errors: [] };
  let cp;
  try { cp = parseStaticCtCheckpoint(checkpointText); report.checkpoint = { origin: cp.origin, size: cp.size, rootHex: bytesToHex(cp.rootHash) }; }
  catch (e) { report.errors.push(e.message); report.checkpoint = false; return report; }
  if (logKeySpki && logId) {
    try { report.signature = await verifyStaticCtCheckpointSignature(cp, { logKeySpki, logId }); }
    catch (e) { report.signature = { ok: false, reason: e.message }; }
  }
  const getTile = tileReaderFromMap(tiles, cp.size);
  try {
    let entry;
    if (entryBytes) {
      // A single TileLeaf cut out of its data tile, for callers that cannot hold a whole tile.
      const one = parseDataTile(entryBytes);
      if (one.length !== 1) throw new Error('entry input must hold exactly one TileLeaf');
      entry = one[0];
    } else {
      const dataBytes = tiles[dataTilePath(Math.floor(index / TILE_WIDTH), cp.size)];
      if (!dataBytes) throw new Error('missing data tile');
      entry = parseDataTile(dataBytes)[index % TILE_WIDTH];
      if (!entry) throw new Error('data tile has no entry at that position');
    }
    const { proof, leafHash } = await inclusionProofFromTiles({ size: cp.size, index, getTile });
    report.proofLength = proof.length;
    report.leafHashMatchesTile = bytesEqual(await leafHashOfEntry(entry), leafHash);
    report.leafIndexExtension = entry.leafIndex === index;
    report.rootFromTiles = bytesEqual(await rootFromTiles({ size: cp.size, getTile }), cp.rootHash);
    report.inclusion = await verifyInclusion({ leaf: leafHash, index, size: cp.size, root: cp.rootHash, path: proof });
  } catch (e) { report.errors.push(e.message); }
  report.ok = report.errors.length === 0 && report.leafHashMatchesTile === true && report.leafIndexExtension === true
    && report.rootFromTiles === true && report.inclusion === true && (report.signature === null || report.signature.ok === true);
  return report;
}

// ---------------------------------------------------------------------------
// mtc-tlog v0.1.0 -- DRAFT. The C2SP text is an editor's copy profiling an IETF
// draft that may change. Only naming rules are implemented, never signature or
// certificate validation. Never present this as stable.
// ---------------------------------------------------------------------------

const DOTTED = /^[0-9]+(\.[0-9]+)*$/;
export const mtcTlogDraft = Object.freeze({
  draft: true,
  spec: 'mtc-tlog v0.1.0 (editor copy, draft)',
  // Trust anchor ID 32473.1 -> "oid/1.3.6.1.4.1.32473.1"
  cosignerName(trustAnchorId) {
    if (!DOTTED.test(trustAnchorId)) throw new Error('trust anchor ID must be dotted decimal');
    return `oid/1.3.6.1.4.1.${trustAnchorId}`;
  },
  // CA 32473.2, log 42 -> origin "oid/1.3.6.1.4.1.32473.2.0.42"
  logOrigin(caId, logNumber) {
    if (!DOTTED.test(caId) || !Number.isSafeInteger(logNumber) || logNumber < 0) throw new Error('bad CA id or log number');
    return `oid/1.3.6.1.4.1.${caId}.0.${logNumber}`;
  },
  logPrefixUrl(caPrefixUrl, logNumber) {
    if (!Number.isSafeInteger(logNumber) || logNumber < 0) throw new Error('bad log number');
    return `${caPrefixUrl.replace(/\/+$/, '')}/${logNumber}`;
  },
});

export { base64ToBytes };
