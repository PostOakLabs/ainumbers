// _prng.bundle.mjs -- one audited shared PRNG bundle: xoshiro256**/splitmix64 (art-371
// bit-identical), a SHA-256 string-seed mode, the sampler-family HMAC-SHA256 DRBG stream,
// and exactly-unbiased integer draws (threshold rejection), partial Fisher-Yates sampling
// and shuffling. SHARED-PRNG-BUNDLE-1, anchored on ACCT-INFRA-KERNELS-BUILD-SPEC.md Sec.0.1
// (bundle + demonstrator shape) + Sec.4 (composition contract) + RIDER-KERNEL.md (SO #6)
// + SPEC.md Sec.24.6.2 (names xoshiro256** seeded through splitmix64 as the reference).
//
// ALGORITHM IDS AND SEED GRAMMAR (the receipt-facing contract of this bundle):
//   'xoshiro256ss-splitmix64-v1'        seed is a JS Number (integer; non-integers are
//                                        Math.trunc'd exactly as art-371 truncates its pp
//                                        seed, negatives wrap mod 2^64 like art-371). The
//                                        state is the first four splitmix64(seed) outputs
//                                        and the stream is BIT-IDENTICAL to art-371's
//                                        makeXoshiro256ss for the same seed: the splitmix64 /
//                                        rotl / makeXoshiro256ss functions below are a
//                                        byte-verbatim copy of art-371's proven generator,
//                                        and the art-77x property floor differentials
//                                        10,000 outputs over 20 seeds against art-371's own
//                                        source bytes (zero-diff acceptance gate).
//   'xoshiro256ss-splitmix64-sha256str-v1'
//                                        seed is a non-empty UTF-8 string of at most 256
//                                        bytes. state = the four big-endian 64-bit words of
//                                        SHA-256(utf8(seed)) via the inlined _sha256 bundle
//                                        (s0 = digest bytes 0..8, s1 = 8..16, s2 = 16..24,
//                                        s3 = 24..32). splitmix64 is NOT applied: the digest
//                                        words are the state directly. An all-zero state is
//                                        refused (unreachable by preimage resistance; the
//                                        refusal exists so the invariant is checked, not
//                                        assumed -- Vigna's reference requires a state that
//                                        is not everywhere zero). This settles plan open
//                                        decision 2 (seed grammar) as a NEW algorithm id, so
//                                        art-371's Number-seed stream and this string-seed
//                                        stream can never be confused in a receipt.
//   'hmac-drbg-sha256'                  seed is a derived seed_hex: exactly 64 lowercase hex
//                                        characters. The stream is the sampler family's DRBG
//                                        construction, byte-identical to art-774 (v2) and
//                                        art-583 (v1): draw i = HMAC-SHA256(key = utf8
//                                        seed_hex, message = utf8 'draw:' i), first 8 hex
//                                        characters = the 32 drawn bits. This is the estate's
//                                        own DRBG-style construction, NOT NIST SP 800-90A
//                                        HMAC_DRBG (no reseed/df machinery); the HMAC core
//                                        itself is RFC 2104/4231 and is vector-gated by the
//                                        art-751 floor. beaconSeedDerivation() reproduces
//                                        the family's seed derivation
//                                        HMAC(key = manifest_hash, message = randomness ':'
//                                        round ':' algorithm_id) with the algorithm id as a
//                                        parameter, so it matches both the v1 and v2 ids.
//
// UNBIASED INTEGER DRAWS: nextBelow(n) uses threshold rejection (Lemire-style): the accepted
// region is [0, floor(2^width / n) * n), an exact multiple of n, so every value in [0, n) is
// hit by exactly the same number of raw draws and uniformity is exact integer arithmetic,
// not a statistical claim. Rejected draws advance the draw counter, mirroring art-774.
// sample(n, k) walks a partial Fisher-Yates over a Uint32Array index array: exactly k
// ACCEPTED draws select k distinct indices, no duplicate-rejection and no draw cap exists
// (art-583 v1's cap and modulo bias are the defects this construction replaces). shuffle(n)
// is sample(n, n): a uniform permutation. Bounds: n <= MAX_INDEX_ARRAY (1,000,000, a
// 4,000,000-byte guest index array, the same ceiling art-774 commits to); total draws are
// structurally at most ~k * (1 + MAX_INDEX_ARRAY / 2^32) so no walk can run away.
//
// RECEIPT DISCIPLINE (SPEC Sec.24.6.2): every generator carries prng_algorithm, the seed
// (canonical string form), draw_count (ALL draws consumed, accepted + rejected),
// rejected_draws, and seed_commitment = 'sha256:' + SHA-256(utf8(canonical seed string)) via
// the inlined _sha256 bundle, so a receipt commits to the exact seed bytes without pinning a
// single canonical encoding of every grammar.
//
// GUEST SAFETY (GUEST-BUILTIN-GATE-1): no TextEncoder, no atob/btoa, no URL, no
// crypto.subtle, no Date, no Math.random anywhere. BigInt IS used by the xoshiro modes: the
// RISC0 guest's BigInt support is proven in-guest by art-371's own proven receipt (its
// generator and fixed-point path are all-BigInt). The DRBG path uses no BigInt, mirroring
// art-774. UTF-8 encoding is the inlined _sha256 bundle's validated ART595-ART590-UTF8-FIX-1
// encoder.
//
// COMPOSITION CONTRACT (build spec Sec.4.1): this bundle inlines the shared _sha256 bundle
// VERBATIM between sentinel comments (a bundle embedding another bundle, gated by the
// 'sha256-in-bundles' pair in scripts/inline-ssot-sync-manifest.json), and consumers paste
// THIS file verbatim between its own sentinel comments (gated by the 'prng' pair). NEVER
// `import` a bundle at runtime -- the RISC0 guest provides only `_hash`. This file is
// `_`-prefixed and exports NO `meta`/`compute` -- it must not be discovered as a node by
// check-kernel-exports.mjs / check-kernel-coverage.mjs. Proven nodes never adopt this
// bundle by editing: art-371 keeps its frozen inline copy, tied to this bundle's verbatim
// core by the 'prng-splitmix64-371' / 'prng-xoshiro256ss-371' equivalence pairs
// (equivalence, not import -- research/no-reprove-shared-bundle-design-2026-10-17.md
// option 1).
//
// Zero-import, zero-network, zero-dependency. Pure JS only.

/* ===== inlined _sha256 (RISC0 guest provides only _hash; bundle import is unavailable in-guest) ===== */
// _sha256.bundle.mjs -- one audited guest-safe SHA-256 / HMAC-SHA256, shared kernel infra.
// SHARED-SHA256-BUNDLE-1, anchored on ACCT-INFRA-KERNELS-BUILD-SPEC.md Sec.0.1 (bundle +
// demonstrator shape) + Sec.4 (composition contract) + RIDER-KERNEL.md (STANDING ORDER #6).
//
// PURPOSE: replace the ~45 hand-pasted SHA-256 copies in the kernels folder with ONE audited
// source of truth. This bundle replaces nothing yet; adoption is per-node, later.
//
// GUEST SAFETY (GUEST-BUILTIN-GATE-1, RIDER-KERNEL.md): the RISC0 guest has no TextEncoder, no
// atob/btoa, no URL, no crypto.subtle, and no BigInt is relied on here. The UTF-8 encoder is the
// validated pure-JS shape from ART595-ART590-UTF8-FIX-1 (byte-identical to TextEncoder across
// ASCII, 2/3/4-byte sequences, surrogate pairs and lone surrogates, which become U+FFFD).
//
// EXPORTS: sha256Hex(bytes), sha256HexUtf8(string), hmacSha256Hex(keyBytes, msgBytes), plus the
// raw-bytes primitives sha256Bytes / hmacSha256Bytes / utf8Bytes / hexToBytes and ALGORITHM_ID.
// Inputs are Uint8Array or plain arrays of integers 0..255; anything else is a named TypeError.
//
// COMPOSITION CONTRACT (build spec Sec.4.1): consumers paste this file VERBATIM between sentinel
// comments in their own .kernel.mjs and destructure what they need. NEVER `import` this module at
// runtime -- the RISC0 guest provides only `_hash`, so a bundle import is unavailable in-guest.
// This file is `_`-prefixed and exports NO `meta`/`compute` -- it must not be discovered as a node
// by check-kernel-exports.mjs / check-kernel-coverage.mjs.
//
// Zero-import, zero-network, zero-dependency. Pure JS only.

const _sha256 = (function () {
'use strict';

const ALGORITHM_ID = 'sha-256';
const BLOCK_BYTES = 64;

const K = [
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
];

// -- guest-safe UTF-8 encoder (no TextEncoder); lone surrogates become U+FFFD like TextEncoder --
function utf8Bytes(str) {
  const s = String(str);
  const bytes = [];
  for (let i = 0; i < s.length; i++) {
    let code = s.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = (code - 0xd800) * 0x400 + (next - 0xdc00) + 0x10000;
        i++;
      } else {
        code = 0xfffd;
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      code = 0xfffd;
    }
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return Uint8Array.from(bytes);
}

function _asBytes(x, what) {
  if (x instanceof Uint8Array) return x;
  if (Array.isArray(x)) {
    for (let i = 0; i < x.length; i++) {
      const v = x[i];
      if (typeof v !== 'number' || v !== Math.floor(v) || v < 0 || v > 255) {
        throw new TypeError('sha256: ' + what + ' must contain integers 0..255 (bad element at index ' + i + ')');
      }
    }
    return Uint8Array.from(x);
  }
  throw new TypeError('sha256: ' + what + ' must be a Uint8Array or an array of integers 0..255');
}

function _toHex(bytes) {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += hex[bytes[i] >> 4] + hex[bytes[i] & 15];
  return out;
}

function hexToBytes(hex) {
  const s = String(hex);
  if (s.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(s)) {
    throw new TypeError('sha256: hex input must be an even-length string of hex digits');
  }
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

// -- FIPS 180-4 SHA-256 core -------------------------------------------------------------------
function sha256Bytes(input) {
  const bytes = _asBytes(input, 'message');
  const n = bytes.length;
  const paddedLen = Math.ceil((n + 9) / BLOCK_BYTES) * BLOCK_BYTES;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[n] = 0x80;
  // 64-bit big-endian bit length from two 32-bit halves (no BigInt): n*8 may exceed 2^32.
  const bitsHi = Math.floor(n / 0x20000000);
  const bitsLo = (n * 8) >>> 0;
  padded[paddedLen - 8] = (bitsHi >>> 24) & 0xff;
  padded[paddedLen - 7] = (bitsHi >>> 16) & 0xff;
  padded[paddedLen - 6] = (bitsHi >>> 8) & 0xff;
  padded[paddedLen - 5] = bitsHi & 0xff;
  padded[paddedLen - 4] = (bitsLo >>> 24) & 0xff;
  padded[paddedLen - 3] = (bitsLo >>> 16) & 0xff;
  padded[paddedLen - 2] = (bitsLo >>> 8) & 0xff;
  padded[paddedLen - 1] = bitsLo & 0xff;

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const rotr = function (x, r) { return (x >>> r) | (x << (32 - r)); };
  const W = new Uint32Array(64);
  for (let cs = 0; cs < paddedLen; cs += BLOCK_BYTES) {
    for (let i = 0; i < 16; i++) {
      const j = cs + i * 4;
      W[i] = ((padded[j] << 24) | (padded[j + 1] << 16) | (padded[j + 2] << 8) | padded[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }
  const out = new Uint8Array(32);
  const hs = [h0, h1, h2, h3, h4, h5, h6, h7];
  for (let i = 0; i < 8; i++) {
    out[i * 4] = hs[i] >>> 24;
    out[i * 4 + 1] = (hs[i] >>> 16) & 0xff;
    out[i * 4 + 2] = (hs[i] >>> 8) & 0xff;
    out[i * 4 + 3] = hs[i] & 0xff;
  }
  return out;
}

function sha256Hex(bytes) { return _toHex(sha256Bytes(bytes)); }

function sha256HexUtf8(str) { return _toHex(sha256Bytes(utf8Bytes(str))); }

// -- HMAC-SHA256 (RFC 2104 / RFC 4231): key longer than the block is hashed first ---------------
function hmacSha256Bytes(keyBytes, msgBytes) {
  let key = _asBytes(keyBytes, 'key');
  const msg = _asBytes(msgBytes, 'message');
  if (key.length > BLOCK_BYTES) key = sha256Bytes(key);
  const inner = new Uint8Array(BLOCK_BYTES + msg.length);
  const outer = new Uint8Array(BLOCK_BYTES + 32);
  for (let i = 0; i < BLOCK_BYTES; i++) {
    const kb = i < key.length ? key[i] : 0;
    inner[i] = kb ^ 0x36;
    outer[i] = kb ^ 0x5c;
  }
  inner.set(msg, BLOCK_BYTES);
  outer.set(sha256Bytes(inner), BLOCK_BYTES);
  return sha256Bytes(outer);
}

function hmacSha256Hex(keyBytes, msgBytes) { return _toHex(hmacSha256Bytes(keyBytes, msgBytes)); }

return {
  ALGORITHM_ID: ALGORITHM_ID,
  utf8Bytes: utf8Bytes,
  hexToBytes: hexToBytes,
  sha256Bytes: sha256Bytes,
  sha256Hex: sha256Hex,
  sha256HexUtf8: sha256HexUtf8,
  hmacSha256Bytes: hmacSha256Bytes,
  hmacSha256Hex: hmacSha256Hex,
};
})();
const { utf8Bytes, sha256Bytes, sha256HexUtf8, hmacSha256Hex } = _sha256;
/* ===== END inlined _sha256 ===== */

const _prng = (function () {
'use strict';

// -- algorithm ids (the receipt-facing grammar; see the header for the full contract) -----------
const XOSHIRO256SS_SPLITMIX64_V1 = 'xoshiro256ss-splitmix64-v1';
const XOSHIRO256SS_SPLITMIX64_SHA256STR_V1 = 'xoshiro256ss-splitmix64-sha256str-v1';
const HMAC_DRBG_SHA256 = 'hmac-drbg-sha256';
const ALGORITHM_IDS = [XOSHIRO256SS_SPLITMIX64_V1, XOSHIRO256SS_SPLITMIX64_SHA256STR_V1, HMAC_DRBG_SHA256];

// Declared, enforced bounds. MAX_INDEX_ARRAY mirrors art-774's guest-memory ceiling (a
// Uint32Array of n entries; 4,000,000 bytes at the ceiling). MAX_SEED_STRING_BYTES bounds
// the hashed string-seed input. These are constants, never policy_parameters, so no loop
// bound in this bundle is input-driven.
const MAX_INDEX_ARRAY = 1000000;
const MAX_SEED_STRING_BYTES = 256;
const Z32 = 4294967296; // 2^32
const MASK64    = (1n << 64n) - 1n;

// ── splitmix64 (seed expansion) + xoshiro256** (integer-only PRNG) ───────────
// BYTE-VERBATIM from art-371-simulate-var-monte-carlo.kernel.mjs (lines 46-68 of the
// proven kernel). Equivalence to art-371's frozen inline copy is gated by the
// 'prng-splitmix64-371' and 'prng-xoshiro256ss-371' pairs in
// scripts/inline-ssot-sync-manifest.json (equivalence, not import: art-371 is proven and
// never adopts this bundle -- research/no-reprove-shared-bundle-design-2026-10-17.md
// option 1). art-371's rotl is byte-identical to the copy below as well; it is not a
// line-pair of its own because five unrelated kernels carry 32-bit rotl text, so rotl
// drift is covered by the 20-seed stream differential in the art-775 property floor.
function splitmix64(seed) {
  let z = seed & MASK64;
  return function next() {
    z = (z + 0x9E3779B97F4A7C15n) & MASK64;
    let x = z;
    x = ((x ^ (x >> 30n)) * 0xBF58476D1CE4E5B9n) & MASK64;
    x = ((x ^ (x >> 27n)) * 0x94D049BB133111EBn) & MASK64;
    x = x ^ (x >> 31n);
    return x & MASK64;
  };
}
/** @param {bigint} x @param {bigint} k @returns {bigint} */
function rotl(x, k) { return ((x << k) | (x >> (64n - k))) & MASK64; }
function makeXoshiro256ss(seed) {
  const sm = splitmix64(BigInt(seed) & MASK64);
  let s0 = sm(), s1 = sm(), s2 = sm(), s3 = sm();
  return function next() {
    const result = (rotl((s1 * 5n) & MASK64, 7n) * 9n) & MASK64;
    const t = (s1 << 17n) & MASK64;
    s2 ^= s0; s3 ^= s1; s1 ^= s2; s0 ^= s3; s2 ^= t;
    s3 = rotl(s3, 45n);
    return result;
  };
}

// xoshiro state set directly from four 64-bit words (the string-seed mode's construction:
// the SHA-256 digest words ARE the state; splitmix64 is not applied).
function makeXoshiro256ssFromWords(w0, w1, w2, w3) {
  let s0 = w0 & MASK64, s1 = w1 & MASK64, s2 = w2 & MASK64, s3 = w3 & MASK64;
  return function next() {
    const result = (rotl((s1 * 5n) & MASK64, 7n) * 9n) & MASK64;
    const t = (s1 << 17n) & MASK64;
    s2 ^= s0; s3 ^= s1; s1 ^= s2; s0 ^= s3; s2 ^= t;
    s3 = rotl(s3, 45n);
    return result;
  };
}

// -- generator object: one uniform surface over every mode --------------------------------------
// nextRaw is () => BigInt for 64-bit modes and () => Number for the 32-bit DRBG mode;
// width is 64n or 32. draw_count counts EVERY raw draw consumed (accepted + rejected),
// mirroring art-774's counter semantics; rejected_draws is the rejected subset.
function makeGenerator(algorithmId, seedEcho, nextRaw, widthBits) {
  let drawCount = 0;
  let rejectedDraws = 0;
  const seedCommitment = 'sha256:' + sha256HexUtf8(seedEcho);

  function nextU64() {
    if (widthBits !== 64n) throw new TypeError('prng: nextU64 is only defined for the 64-bit xoshiro modes');
    drawCount += 1;
    return nextRaw();
  }

  function nextU32() {
    if (widthBits !== 32) throw new TypeError('prng: nextU32 is only defined for the 32-bit hmac-drbg-sha256 mode');
    drawCount += 1;
    return nextRaw();
  }

  // Threshold rejection: the accepted region [0, limit) with limit = floor(2^width / n) * n
  // is an exact multiple of n, so every value in [0, n) is hit by exactly limit / n raw
  // draws. Rejected draws advance drawCount (and rejectedDraws), exactly like art-774.
  function nextBelow(n) {
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > MAX_INDEX_ARRAY) {
      throw new TypeError('prng: nextBelow bound must be an integer in [1, ' + MAX_INDEX_ARRAY + ']');
    }
    if (widthBits === 32) {
      const limit = Math.floor(Z32 / n) * n;
      for (;;) {
        drawCount += 1;
        const raw = nextRaw();
        if (raw < limit) return raw % n;
        rejectedDraws += 1;
      }
    }
    const limit = ((1n << 64n) / BigInt(n)) * BigInt(n);
    for (;;) {
      drawCount += 1;
      const raw = nextRaw();
      if (raw < limit) return Number(raw % BigInt(n));
      rejectedDraws += 1;
    }
  }

  // Partial Fisher-Yates: exactly k ACCEPTED draws, no duplicate rejection, no cap. Each
  // step i draws offset in [0, n - i) via nextBelow, swaps index[i]/index[i + offset], and
  // index[i] (post-swap) is the i-th selected item. k === n yields a uniform permutation.
  function sample(n, k) {
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > MAX_INDEX_ARRAY) {
      throw new TypeError('prng: sample n must be an integer in [1, ' + MAX_INDEX_ARRAY + ']');
    }
    if (typeof k !== 'number' || !Number.isInteger(k) || k < 1 || k > n) {
      throw new TypeError('prng: sample k must be an integer in [1, n]');
    }
    const index = new Uint32Array(n);
    for (let i = 0; i < n; i++) index[i] = i;
    const selected = [];
    for (let i = 0; i < k; i++) {
      const w = n - i;
      const j = i + nextBelow(w);
      const tmp = index[i];
      index[i] = index[j];
      index[j] = tmp;
      selected.push(index[i]);
    }
    return selected;
  }

  function shuffle(n) { return sample(n, n); }

  function receipt() {
    return {
      prng_algorithm: algorithmId,
      seed: seedEcho,
      seed_commitment: seedCommitment,
      draw_count: drawCount,
      rejected_draws: rejectedDraws,
    };
  }

  return {
    algorithmId: algorithmId,
    seed: seedEcho,
    seedCommitment: seedCommitment,
    nextU64: nextU64,
    nextU32: nextU32,
    nextBelow: nextBelow,
    sample: sample,
    shuffle: shuffle,
    receipt: receipt,
    get drawCount() { return drawCount; },
    get rejectedDraws() { return rejectedDraws; },
  };
}

// -- mode 1: xoshiro256ss-splitmix64-v1 (Number seed, art-371 bit-identical) --------------------
function xoshiro256ssSplitmix64(seed) {
  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    throw new TypeError('prng: xoshiro256ss-splitmix64-v1 seed must be a finite JS Number (art-371 Number-seed domain)');
  }
  const trunc = Math.trunc(seed); // mirrors art-371's Math.trunc of its pp seed
  const core = makeXoshiro256ss(trunc); // BigInt(trunc) & MASK64 inside; negatives wrap like art-371
  return makeGenerator(XOSHIRO256SS_SPLITMIX64_V1, String(trunc), core, 64n);
}

// -- mode 2: xoshiro256ss-splitmix64-sha256str-v1 (string seed -> SHA-256 state words) ----------
function xoshiro256ssFromString(seedStr) {
  if (typeof seedStr !== 'string' || seedStr.length === 0) {
    throw new TypeError('prng: xoshiro256ss-splitmix64-sha256str-v1 seed must be a non-empty string');
  }
  const seedBytes = utf8Bytes(seedStr);
  if (seedBytes.length > MAX_SEED_STRING_BYTES) {
    throw new TypeError('prng: string seed exceeds ' + MAX_SEED_STRING_BYTES + ' UTF-8 bytes');
  }
  const digest = sha256Bytes(seedBytes);
  if (digest.length !== 32) throw new TypeError('prng: sha256 digest length invariant broken');
  const words = [0n, 0n, 0n, 0n];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 8; j++) words[i] = (words[i] << 8n) | BigInt(digest[i * 8 + j]);
  }
  if ((words[0] | words[1] | words[2] | words[3]) === 0n) {
    throw new TypeError('prng: sha256 string-seed state is all zero (refused: xoshiro requires a non-zero state)');
  }
  const core = makeXoshiro256ssFromWords(words[0], words[1], words[2], words[3]);
  return makeGenerator(XOSHIRO256SS_SPLITMIX64_SHA256STR_V1, seedStr, core, 64n);
}

// -- mode 3: hmac-drbg-sha256 (the sampler family DRBG stream, art-774/art-583 identical) ------
const HEX64 = /^[0-9a-f]{64}$/;

function hmacDrbgSha256(seedHex) {
  if (typeof seedHex !== 'string' || !HEX64.test(seedHex)) {
    throw new TypeError('prng: hmac-drbg-sha256 seed must be exactly 64 lowercase hex characters');
  }
  let draw = 0;
  // draw i = HMAC-SHA256(key = utf8(seed_hex), message = utf8('draw:' i)); first 8 hex
  // characters are the 32 drawn bits. Byte-identical to art-774's and art-583's stream.
  function drawHmacHex(i) { return hmacSha256Hex(utf8Bytes(seedHex), utf8Bytes('draw:' + i)); }
  const nextRaw = function () {
    const hex = drawHmacHex(draw);
    draw += 1;
    return parseInt(hex.slice(0, 8), 16);
  };
  const g = makeGenerator(HMAC_DRBG_SHA256, seedHex, nextRaw, 32);
  g.drawHmacHex = drawHmacHex;
  return g;
}

// The sampler family's seed derivation: seed_hex = HMAC-SHA256(key = utf8(manifest hash),
// message = utf8(randomness ':' round ':' algorithm_id)). The algorithm id is a parameter so
// this reproduces art-583 ('hmac-drbg-sha256-v1') and art-774 ('hmac-drbg-sha256-v2') alike.
function beaconSeedDerivation(keyHex, randomnessHex, round, algorithmId) {
  if (typeof keyHex !== 'string' || !HEX64.test(keyHex)) {
    throw new TypeError('prng: beacon key (item_manifest_hash) must be exactly 64 lowercase hex characters');
  }
  if (typeof randomnessHex !== 'string' || !HEX64.test(randomnessHex)) {
    throw new TypeError('prng: beacon randomness must be exactly 64 lowercase hex characters');
  }
  if (typeof round !== 'string' || round.length === 0) {
    throw new TypeError('prng: beacon round must be a non-empty string');
  }
  if (typeof algorithmId !== 'string' || algorithmId.length === 0) {
    throw new TypeError('prng: algorithm id must be a non-empty string');
  }
  return hmacSha256Hex(utf8Bytes(keyHex), utf8Bytes(randomnessHex + ':' + round + ':' + algorithmId));
}

// -- known-answer self-check at load (art-583/art-774 discipline) -------------------------------
// Literals are the authors' reference outputs: Vigna's xoshiro256** / splitmix64 C
// (https://prng.di.unimi.it/xoshiro256starstar.c and splitmix64.c, retrieved 2026-10-21,
// pinned bytes sha256:01d518ab... / sha256:f8eef827... in the row's reference snapshot),
// cross-derived at authoring time by an independent Python port of the pinned C, plus the
// estate's standard SHA-256 known-answer. Any failure throws at load and nothing is emitted.
(function _selfCheck() {
  const sm = splitmix64(0n);
  const sm1 = sm();
  if (sm1 !== 0xe220a8397b1dcdafn) {
    throw new Error('prng self-check FAILED: splitmix64(0) first output ' + sm1.toString(16) + ' != e220a8397b1dcdaf');
  }
  const g0 = makeXoshiro256ss(0);
  const x1 = g0();
  if (x1 !== 0x99ec5f36cb75f2b4n) {
    throw new Error('prng self-check FAILED: xoshiro256**(splitmix64(0)) first output ' + x1.toString(16) + ' != 99ec5f36cb75f2b4');
  }
  const gW = makeXoshiro256ssFromWords(1n, 2n, 3n, 4n);
  const w1 = gW();
  if (w1 !== 0x2d00n) {
    throw new Error('prng self-check FAILED: xoshiro256** state (1,2,3,4) first output ' + w1.toString(16) + ' != 2d00');
  }
  const sha = sha256HexUtf8('hello world');
  if (sha !== 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9') {
    throw new Error('prng self-check FAILED: inlined sha256 known-answer mismatch: ' + sha);
  }
})();

return {
  XOSHIRO256SS_SPLITMIX64_V1: XOSHIRO256SS_SPLITMIX64_V1,
  XOSHIRO256SS_SPLITMIX64_SHA256STR_V1: XOSHIRO256SS_SPLITMIX64_SHA256STR_V1,
  HMAC_DRBG_SHA256: HMAC_DRBG_SHA256,
  ALGORITHM_IDS: ALGORITHM_IDS,
  MAX_INDEX_ARRAY: MAX_INDEX_ARRAY,
  MAX_SEED_STRING_BYTES: MAX_SEED_STRING_BYTES,
  splitmix64: splitmix64,
  rotl: rotl,
  makeXoshiro256ss: makeXoshiro256ss,
  makeXoshiro256ssFromWords: makeXoshiro256ssFromWords,
  xoshiro256ssSplitmix64: xoshiro256ssSplitmix64,
  xoshiro256ssFromString: xoshiro256ssFromString,
  hmacDrbgSha256: hmacDrbgSha256,
  beaconSeedDerivation: beaconSeedDerivation,
};
})();

export const XOSHIRO256SS_SPLITMIX64_V1 = _prng.XOSHIRO256SS_SPLITMIX64_V1;
export const XOSHIRO256SS_SPLITMIX64_SHA256STR_V1 = _prng.XOSHIRO256SS_SPLITMIX64_SHA256STR_V1;
export const HMAC_DRBG_SHA256 = _prng.HMAC_DRBG_SHA256;
export const ALGORITHM_IDS = _prng.ALGORITHM_IDS;
export const MAX_INDEX_ARRAY = _prng.MAX_INDEX_ARRAY;
export const MAX_SEED_STRING_BYTES = _prng.MAX_SEED_STRING_BYTES;
export const splitmix64 = _prng.splitmix64;
export const rotl = _prng.rotl;
export const makeXoshiro256ss = _prng.makeXoshiro256ss;
export const makeXoshiro256ssFromWords = _prng.makeXoshiro256ssFromWords;
export const xoshiro256ssSplitmix64 = _prng.xoshiro256ssSplitmix64;
export const xoshiro256ssFromString = _prng.xoshiro256ssFromString;
export const hmacDrbgSha256 = _prng.hmacDrbgSha256;
export const beaconSeedDerivation = _prng.beaconSeedDerivation;
export default _prng;
