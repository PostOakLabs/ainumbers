// _cid.mjs — OCG CID profile (SPEC.md §CID-1). Zero-dep hand-rolled CIDv1 codec.
// ocg_cid(digest) = CIDv1( codec=raw(0x55), multihash=sha2-256(0x12,0x20,digest) ), base32-lower text
// form (DASL profile: CIDv1 + sha2-256 + base32 only — dasl.ing). The CID wraps the exact 32 raw bytes
// of the execution_hash we already mint; it never re-canonicalizes OCG JSON into dag-cbor.
// No npm — varint + base32 are ~20 lines each; multiformats/js-cid would be the only dependency reason.

const VERSION = 0x01;      // CIDv1
const CODEC_RAW = 0x55;    // raw binary
const MH_SHA2_256 = 0x12;  // multihash function code
const MH_SIZE = 0x20;      // 32-byte digest

// unsigned LEB128 varint — all four header bytes here are < 0x80 so each is one byte,
// but this stays general so a future non-raw codec or non-sha256 multihash still round-trips.
function varintEncode(n) {
  const out = [];
  while (n >= 0x80) { out.push((n & 0x7f) | 0x80); n >>>= 7; }
  out.push(n);
  return out;
}
function varintDecode(bytes, offset) {
  let result = 0, shift = 0, i = offset;
  for (;;) {
    const b = bytes[i++];
    result |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) break;
    shift += 7;
  }
  return { value: result >>> 0, next: i };
}

const B32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

function base32Encode(bytes) {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 0x1f];
  return out; // no padding — DASL/RFC4648 lower, unpadded
}

function base32Decode(str) {
  let bits = 0, value = 0;
  const out = [];
  for (const ch of str) {
    const idx = B32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error(`ocg_cid: invalid base32 character "${ch}"`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

function hexToBytes(hex) {
  if (hex.length !== 64 || !/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error(`ocg_cid: expected a 32-byte (64 hex char) sha256 digest, got ${hex.length} chars`);
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}
function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * toCid(hexOrSha256Prefixed) -> "b..." CIDv1 raw+sha2-256 base32-lower string.
 * Accepts either bare 64-char hex or a "sha256:"-prefixed digest — the two forms §4 execution_hash uses.
 */
export function toCid(hexOrSha256Prefixed) {
  const hex = hexOrSha256Prefixed.startsWith('sha256:')
    ? hexOrSha256Prefixed.slice('sha256:'.length)
    : hexOrSha256Prefixed;
  const digest = hexToBytes(hex);
  const header = [...varintEncode(VERSION), ...varintEncode(CODEC_RAW), ...varintEncode(MH_SHA2_256), ...varintEncode(MH_SIZE)];
  const bytes = new Uint8Array([...header, ...digest]);
  return 'b' + base32Encode(bytes);
}

/**
 * fromCid(cid) -> "sha256:<hex>" — the round-trip law cid -> digest -> sha256:<hex> is bijective.
 * Rejects any codec/multihash/version other than the DASL profile (raw / sha2-256 / CIDv1).
 */
export function fromCid(cid) {
  if (typeof cid !== 'string' || cid[0] !== 'b') {
    throw new Error('ocg_cid: expected a base32-lower CID string starting with "b"');
  }
  const bytes = base32Decode(cid.slice(1));
  let off = 0;
  const version = varintDecode(bytes, off); off = version.next;
  const codec = varintDecode(bytes, off); off = codec.next;
  const mhFn = varintDecode(bytes, off); off = mhFn.next;
  const mhSize = varintDecode(bytes, off); off = mhSize.next;
  if (version.value !== VERSION) throw new Error(`ocg_cid: unsupported CID version ${version.value} (§CID-1 requires CIDv1)`);
  if (codec.value !== CODEC_RAW) throw new Error(`ocg_cid: unsupported codec 0x${codec.value.toString(16)} (§CID-1 requires raw 0x55 — never dag-cbor)`);
  if (mhFn.value !== MH_SHA2_256) throw new Error(`ocg_cid: unsupported multihash function 0x${mhFn.value.toString(16)} (§CID-1 requires sha2-256 0x12)`);
  if (mhSize.value !== MH_SIZE) throw new Error(`ocg_cid: unsupported digest size ${mhSize.value} (§CID-1 requires 32 bytes)`);
  const digest = bytes.slice(off, off + MH_SIZE);
  if (digest.length !== MH_SIZE) throw new Error('ocg_cid: truncated CID — digest shorter than declared multihash size');
  return 'sha256:' + bytesToHex(digest);
}
