// _car.mjs — OCG Agent Provenance Profile evidence-bundle CAR writer/reader (SPEC.md §APROV-1.2).
// Zero-dep, hand-rolled CARv1 (Content Addressable aRchive) constrained to the DASL simplified-CAR
// profile (dasl.ing): CIDv1 + raw(0x55) + sha2-256 blocks only. No js-car/multiformats dependency —
// site repo zero-dep is absolute.
//
// A CAR file is: varint(headerLen) + header (DAG-CBOR {version:1, roots:[CID]}) + repeated
// [ varint(blockLen) + block ], where each block = CID bytes (01 55 12 20 <32-byte digest>) followed
// by the raw block payload. This file hand-rolls ONLY the narrow DAG-CBOR shape the CARv1 header
// needs — not a general CBOR encoder/decoder — matching the _cid.mjs/_head.mjs precedent of
// hand-rolling only the slice a section actually uses.
//
// Every block key is a CID over a digest OCG already computes (execution_hash or head_hash) —
// §APROV-1.1 mints no new hash for export.

const VERSION = 0x01;      // CIDv1
const CODEC_RAW = 0x55;    // raw binary
const MH_SHA2_256 = 0x12;  // multihash function code
const MH_SIZE = 0x20;      // 32-byte digest
const CID_LEN = 4 + MH_SIZE; // 4 single-byte varint header fields (all < 0x80) + 32-byte digest

// ---- varint (unsigned LEB128 — CAR's own length-prefix encoding, distinct from CID's own header) ----
function varintEncode(n) {
  const out = [];
  while (n >= 0x80) { out.push((n & 0x7f) | 0x80); n = Math.floor(n / 128); }
  out.push(n);
  return out;
}
function varintDecode(bytes, offset) {
  let result = 0, shift = 0, i = offset;
  for (;;) {
    if (i >= bytes.length) throw new Error('_car: truncated varint — CAR file ends mid-length-prefix');
    const b = bytes[i++];
    result += (b & 0x7f) * 2 ** shift;
    if ((b & 0x80) === 0) break;
    shift += 7;
  }
  return { value: result, next: i };
}

function hexToBytes(hex) {
  const clean = hex.startsWith('sha256:') ? hex.slice('sha256:'.length) : hex;
  if (clean.length !== 64 || !/^[0-9a-f]{64}$/i.test(clean)) {
    throw new Error(`_car: expected a 32-byte (64 hex char) sha256 digest, got "${hex}"`);
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}
function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// CID bytes = CIDv1 raw+sha2-256 multihash header (§CID-1.0 shape) as raw bytes, not the base32 text
// form — a CAR block key is binary, never the b32 string _cid.mjs's toCid() produces.
function cidBytesFromDigestHex(digestHex) {
  const digest = hexToBytes(digestHex);
  return new Uint8Array([VERSION, CODEC_RAW, MH_SHA2_256, MH_SIZE, ...digest]);
}
function digestHexFromCidBytes(cidBytes) {
  if (cidBytes.length !== CID_LEN) throw new Error(`_car: malformed CID block key (expected ${CID_LEN} bytes, got ${cidBytes.length})`);
  if (cidBytes[0] !== VERSION) throw new Error(`_car: unsupported CID version 0x${cidBytes[0].toString(16)} (§CID-1 requires CIDv1)`);
  if (cidBytes[1] !== CODEC_RAW) throw new Error(`_car: unsupported codec 0x${cidBytes[1].toString(16)} (§CID-1 requires raw 0x55)`);
  if (cidBytes[2] !== MH_SHA2_256) throw new Error(`_car: unsupported multihash function 0x${cidBytes[2].toString(16)} (§CID-1 requires sha2-256 0x12)`);
  if (cidBytes[3] !== MH_SIZE) throw new Error(`_car: unsupported digest size ${cidBytes[3]} (§CID-1 requires 32 bytes)`);
  return 'sha256:' + bytesToHex(cidBytes.slice(4));
}

// ---- minimal DAG-CBOR encoder, scoped to exactly {version:1, roots:[CID...]} ----
function cborUintHead(major, n) {
  if (n < 24) return [(major << 5) | n];
  if (n < 256) return [(major << 5) | 24, n];
  if (n < 65536) return [(major << 5) | 25, (n >> 8) & 0xff, n & 0xff];
  throw new Error('_car: CARv1 header value out of the small-int range this hand-rolled CBOR encoder supports');
}
function cborTextString(s) {
  const bytes = new TextEncoder().encode(s);
  return [...cborUintHead(3, bytes.length), ...bytes];
}
function cborByteString(bytes) {
  return [...cborUintHead(2, bytes.length), ...bytes];
}
function cborTaggedCid(cidBytes) {
  // dag-cbor CID encoding: tag(42) wrapping a byte string whose first byte is the 0x00
  // identity-multibase prefix, followed by the raw CID bytes.
  return [...cborUintHead(6, 42), ...cborByteString(new Uint8Array([0x00, ...cidBytes]))];
}
function encodeCarHeader(rootDigestHexes) {
  const roots = rootDigestHexes.map(cidBytesFromDigestHex);
  return new Uint8Array([
    ...cborUintHead(5, 2), // map, 2 entries
    ...cborTextString('version'), ...cborUintHead(0, 1),
    ...cborTextString('roots'), ...cborUintHead(4, roots.length), ...roots.flatMap(cborTaggedCid),
  ]);
}
// Minimal decoder for exactly the shape encodeCarHeader() produces — not a general DAG-CBOR reader.
function decodeCarHeader(bytes) {
  let i = 0;
  const b = () => bytes[i++];
  // Mirrors cborUintHead()'s encoding in reverse: additional-info <24 is the value itself,
  // 24 means "one more byte", 25 means "two more bytes" (big-endian). No larger form is emitted
  // by this hand-rolled encoder, so none is accepted here either.
  const readLen = (head) => {
    const ai = head & 0x1f;
    if (ai < 24) return ai;
    if (ai === 24) return b();
    if (ai === 25) { const hi = b(), lo = b(); return (hi << 8) | lo; }
    throw new Error('_car: CAR header uses a CBOR length form this hand-rolled decoder does not support');
  };
  const mapHead = b();
  if ((mapHead >> 5) !== 5) throw new Error('_car: CAR header is not a CBOR map');
  const nEntries = readLen(mapHead);
  let version = null, roots = [];
  for (let e = 0; e < nEntries; e++) {
    const keyHead = b();
    if ((keyHead >> 5) !== 3) throw new Error('_car: CAR header map key is not a CBOR text string');
    const keyLen = readLen(keyHead);
    const key = new TextDecoder().decode(bytes.slice(i, i + keyLen)); i += keyLen;
    if (key === 'version') {
      const vHead = b();
      if ((vHead >> 5) !== 0) throw new Error('_car: CAR header "version" is not a CBOR unsigned int');
      version = readLen(vHead);
    } else if (key === 'roots') {
      const arrHead = b();
      if ((arrHead >> 5) !== 4) throw new Error('_car: CAR header "roots" is not a CBOR array');
      const nRoots = readLen(arrHead);
      for (let r = 0; r < nRoots; r++) {
        const tagHead = b();
        if ((tagHead >> 5) !== 6) throw new Error('_car: expected a CBOR tag for a header root CID');
        const tagValue = readLen(tagHead);
        if (tagValue !== 42) throw new Error(`_car: expected CID tag 42, got ${tagValue}`);
        const bsHead = b();
        if ((bsHead >> 5) !== 2) throw new Error('_car: expected a CBOR byte string for a header root CID');
        const bsLen = readLen(bsHead);
        const bs = bytes.slice(i, i + bsLen); i += bsLen;
        roots.push(digestHexFromCidBytes(bs.slice(1))); // drop the 0x00 identity-multibase prefix
      }
    } else {
      throw new Error(`_car: unexpected CAR header key "${key}"`);
    }
  }
  return { version, roots, headerLen: i };
}

/**
 * writeCar({ roots, blocks }) -> Uint8Array
 * roots:  array of digest hex/sha256:-prefixed strings (the evidence bundle's root artifact(s))
 * blocks: array of { digestHex, data: Uint8Array } — digestHex is the block's own content digest
 *         (the CID key); data is the raw block payload whose SHA-256 MUST equal digestHex.
 */
export function writeCar({ roots = [], blocks }) {
  if (!Array.isArray(blocks) || blocks.length === 0) throw new Error('_car: writeCar() requires at least one block');
  const header = encodeCarHeader(roots);
  const parts = [...varintEncode(header.length), ...header];
  for (const { digestHex, data } of blocks) {
    const cidBytes = cidBytesFromDigestHex(digestHex);
    const blockLen = cidBytes.length + data.length;
    parts.push(...varintEncode(blockLen), ...cidBytes, ...data);
  }
  return new Uint8Array(parts);
}

/**
 * readCar(bytes) -> { version, roots, blocks: [{ digestHex, data }] }
 * Structural parse only — does NOT verify block content against its digest; see verifyCar() for that.
 * Throws on truncation or a malformed header/CID (never silently partially parses).
 */
export function readCar(bytes) {
  const { value: headerLen, next: afterLenPrefix } = varintDecode(bytes, 0);
  if (afterLenPrefix + headerLen > bytes.length) throw new Error('_car: truncated CAR file — header length exceeds file size');
  const { version, roots } = decodeCarHeader(bytes.slice(afterLenPrefix, afterLenPrefix + headerLen));
  let offset = afterLenPrefix + headerLen;
  const blocks = [];
  while (offset < bytes.length) {
    const { value: blockLen, next: afterBlockLenPrefix } = varintDecode(bytes, offset);
    if (afterBlockLenPrefix + blockLen > bytes.length) throw new Error('_car: truncated CAR file — block length exceeds remaining bytes');
    const block = bytes.slice(afterBlockLenPrefix, afterBlockLenPrefix + blockLen);
    if (block.length < CID_LEN) throw new Error('_car: block shorter than a CID key — malformed CAR file');
    const digestHex = digestHexFromCidBytes(block.slice(0, CID_LEN));
    const data = block.slice(CID_LEN);
    blocks.push({ digestHex, data });
    offset = afterBlockLenPrefix + blockLen;
  }
  return { version, roots, blocks };
}

/**
 * verifyCar(bytes) -> { ok: boolean, blocks: [{ digestHex, ok, data }] }
 * §APROV-1.3 step (1)+(2): parses the bundle and, for every block, recomputes SHA-256(data) and
 * confirms it equals the digest encoded in that block's own CID key. Does NOT re-verify artifact
 * `execution_hash` or §HEAD-1 chain laws — those are caller-side checks over the returned blocks
 * (steps (3)/(4)/(5) of §APROV-1.3), since this module has no knowledge of artifact/head shape.
 */
export async function verifyCar(bytes) {
  const parsed = readCar(bytes);
  let ok = true;
  const blocks = [];
  for (const { digestHex, data } of parsed.blocks) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
    const recomputed = 'sha256:' + bytesToHex(new Uint8Array(digest));
    const wanted = digestHex.startsWith('sha256:') ? digestHex : 'sha256:' + digestHex;
    const blockOk = recomputed === wanted;
    if (!blockOk) ok = false;
    blocks.push({ digestHex: wanted, ok: blockOk, data });
  }
  return { ok, version: parsed.version, roots: parsed.roots, blocks };
}

export { cidBytesFromDigestHex, digestHexFromCidBytes };
