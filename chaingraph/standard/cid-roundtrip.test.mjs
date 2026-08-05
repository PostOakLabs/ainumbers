// cid-roundtrip.test.mjs — §CID-1 GATE (SPEC.md §CID-1, additive slug section).
// Proves: toCid()/fromCid() round-trip bijectively over §4-shaped sha256 digests; toCid() matches
// independently-derived cross-check vectors (never a self-referential proof); fromCid() rejects any
// codec/multihash/version outside the DASL profile (raw 0x55 / sha2-256 / CIDv1); both bare-hex and
// "sha256:"-prefixed input forms are accepted.
// Node 18+, zero npm deps.
// Run:  node chaingraph/standard/cid-roundtrip.test.mjs
import { toCid, fromCid } from '../kernels/_cid.mjs';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

// ---- Cross-check vector 1 — sourced from multiformats/cid README.md (github.com/multiformats/cid),
// the "cidv1 - raw - sha2-256" example: digest 6e6ff795...245c95, base58btc form
// "zb2rhe5P4gXftAwvA4eXQ5HJwsER2owDyS9sKaQRRVQPn93bA". Independently base58btc-decoded (not via this
// module — a hand pass in Python) to confirm the underlying CID bytes are
// 01 55 12 20 <digest>, then re-encoded to base32-lower here — so this is a THIRD-PARTY vector, not a
// self-referential round-trip of this file's own encoder.
const VEC1_DIGEST = '6e6ff7950a36187a801613426e858dce686cd7d7e3c0fc42ee0330072d245c95';
const VEC1_CID = 'bafkreidon73zkcrwdb5iafqtijxildoonbwnpv7dyd6ef3qdgads2jc4su';

// ---- Cross-check vector 2 — SHA-256(empty string), a well-known published constant
// (e3b0c442...b855), re-derived through the same 01 55 12 20 <digest> byte layout.
const VEC2_DIGEST = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const VEC2_CID = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku';

ok(toCid(VEC1_DIGEST) === VEC1_CID, 'toCid() matches the multiformats/cid README cross-check vector');
ok(fromCid(VEC1_CID) === 'sha256:' + VEC1_DIGEST, 'fromCid() recovers the cross-check digest as sha256:<hex>');
ok(toCid(VEC2_DIGEST) === VEC2_CID, 'toCid() matches the SHA-256(empty) cross-check vector');
ok(fromCid(VEC2_CID) === 'sha256:' + VEC2_DIGEST, 'fromCid() recovers the SHA-256(empty) digest as sha256:<hex>');

// ---- §CID-1.0 round-trip law: cid -> digest -> sha256:<hex> MUST be bijective, over arbitrary digests ----
const RANDOM_DIGESTS = [
  '0'.repeat(64),
  'f'.repeat(64),
  '0123456789abcdef'.repeat(4),
  'deadbeef'.repeat(8),
];
for (const hex of RANDOM_DIGESTS) {
  const cid = toCid(hex);
  ok(cid[0] === 'b', `toCid(${hex.slice(0, 8)}...) produces a base32-lower "b..." CID text form`);
  ok(fromCid(cid) === 'sha256:' + hex, `round-trip is bijective for digest ${hex.slice(0, 8)}...`);
}

// ---- §4 prefix-insensitive input: bare hex and "sha256:"-prefixed both accepted, same CID out ----
{
  const hex = 'a1'.repeat(32);
  ok(toCid(hex) === toCid('sha256:' + hex), 'toCid() treats bare hex and "sha256:"-prefixed input identically');
}

// ---- fromCid() rejects anything outside the DASL profile (CIDv1 + raw 0x55 + sha2-256 + 32-byte) ----
function b32(bytes) {
  const A = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += A[(value >>> (bits - 5)) & 0x1f]; bits -= 5; }
  }
  if (bits > 0) out += A[(value << (5 - bits)) & 0x1f];
  return out;
}
const digestBytes = Buffer.from(VEC1_DIGEST, 'hex');

// wrong codec: dag-cbor (0x71) instead of raw (0x55) — §CID-1 explicitly forbids re-canonicalizing into dag-cbor
{
  const bytes = Buffer.concat([Buffer.from([0x01, 0x71, 0x12, 0x20]), digestBytes]);
  let threw = false;
  try { fromCid('b' + b32(bytes)); } catch (e) { threw = /codec/.test(e.message); }
  ok(threw, 'fromCid() rejects a dag-cbor (0x71) codec — §CID-1 requires raw 0x55');
}
// wrong CID version (CIDv0-shaped prefix simulated as version byte 0x00)
{
  const bytes = Buffer.concat([Buffer.from([0x00, 0x55, 0x12, 0x20]), digestBytes]);
  let threw = false;
  try { fromCid('b' + b32(bytes)); } catch (e) { threw = /version/.test(e.message); }
  ok(threw, 'fromCid() rejects a non-CIDv1 version byte');
}
// wrong multihash function (sha1 0x11 instead of sha2-256 0x12)
{
  const bytes = Buffer.concat([Buffer.from([0x01, 0x55, 0x11, 0x20]), digestBytes]);
  let threw = false;
  try { fromCid('b' + b32(bytes)); } catch (e) { threw = /multihash/.test(e.message); }
  ok(threw, 'fromCid() rejects a non-sha2-256 multihash function code');
}
// wrong digest size (16 bytes instead of 32)
{
  const bytes = Buffer.concat([Buffer.from([0x01, 0x55, 0x12, 0x10]), digestBytes.slice(0, 16)]);
  let threw = false;
  try { fromCid('b' + b32(bytes)); } catch (e) { threw = /digest size/.test(e.message); }
  ok(threw, 'fromCid() rejects a multihash size other than 32 bytes');
}

// ---- toCid() rejects a malformed digest (not 64 hex chars) ----
{
  let threw = false;
  try { toCid('deadbeef'); } catch (e) { threw = /64 hex/.test(e.message); }
  ok(threw, 'toCid() rejects a digest that is not 32 bytes / 64 hex chars');
}

console.log(fail ? `\n${fail} failure(s).` : '\nAll §CID-1 round-trip checks passed.');
process.exit(fail ? 1 : 0);
