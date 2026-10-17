import { executionHash } from './_hash.mjs';

// art-751-sha256-hmac-digest-demonstrator -- demonstrator node for the shared _sha256 bundle
// (SHARED-SHA256-BUNDLE-1). It digests a caller-supplied UTF-8 string or hex byte string with
// SHA-256, or computes HMAC-SHA256 over it under a caller-supplied hex key, and echoes the
// algorithm id. It exists so the bundle has an execution_hash surface, a fixture set, a property
// floor and a proof surface; it carries no policy and decides nothing.
//
// The bundle is pasted VERBATIM between the sentinels below (composition contract, never imported:
// the RISC0 guest provides only _hash). The inlined region is byte-identical to
// chaingraph/kernels/_sha256.bundle.mjs up to its ES export tail, and is drift-gated by the
// `sha256` pair in scripts/inline-ssot-sync-manifest.json.
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
const { ALGORITHM_ID, hexToBytes, utf8Bytes, sha256Hex, hmacSha256Hex } = _sha256;
/* ===== END inlined _sha256 ===== */

const TOOL_ID = 'art-751-sha256-hmac-digest-demonstrator';
const TOOL_VERSION = '1.0.0';

// Declared bound: the guest cost of a digest is linear in the input, so the input is capped.
const MAX_INPUT_BYTES = 65536;
const MODES = ['sha256', 'hmac_sha256'];
const INPUT_ENCODINGS = ['utf8', 'hex'];

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_sha256_hmac_digest_demonstrator',
  mandate_type: 'compliance_control', gpu: false,
};

function _reject(mode, reason) {
  return {
    status: 'rejected',
    rejection_reason: reason,
    algorithm_id: ALGORITHM_ID,
    mode: mode,
    input_byte_length: null,
    key_byte_length: null,
    digest_hex: null,
  };
}

/**
 * compute(pp) -- pure digest kernel.
 * pp: { mode?: 'sha256'|'hmac_sha256', input: string, input_encoding?: 'utf8'|'hex', key_hex?: string }
 * @returns {{ output_payload: object, compliance_flags: object }}
 */
export function compute(pp) {
  pp = pp || {};
  const mode = pp.mode === undefined ? 'sha256' : pp.mode;
  const encoding = pp.input_encoding === undefined ? 'utf8' : pp.input_encoding;
  let result;
  if (MODES.indexOf(mode) < 0) {
    result = _reject(typeof mode === 'string' ? mode : null, 'MODE_UNSUPPORTED');
  } else if (INPUT_ENCODINGS.indexOf(encoding) < 0) {
    result = _reject(mode, 'INPUT_ENCODING_UNSUPPORTED');
  } else if (typeof pp.input !== 'string') {
    result = _reject(mode, 'INPUT_NOT_STRING');
  } else if (pp.input.length > MAX_INPUT_BYTES * 2) {
    result = _reject(mode, 'INPUT_TOO_LARGE');
  } else {
    let bytes = null;
    let reason = null;
    if (encoding === 'hex') {
      if (pp.input.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(pp.input)) reason = 'INPUT_NOT_HEX';
      else bytes = hexToBytes(pp.input);
    } else {
      bytes = utf8Bytes(pp.input);
    }
    if (reason === null && bytes.length > MAX_INPUT_BYTES) reason = 'INPUT_TOO_LARGE';
    let key = null;
    if (reason === null && mode === 'hmac_sha256') {
      if (typeof pp.key_hex !== 'string' || pp.key_hex.length === 0) reason = 'KEY_MISSING';
      else if (pp.key_hex.length > MAX_INPUT_BYTES * 2 || pp.key_hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(pp.key_hex)) reason = 'KEY_NOT_HEX';
      else key = hexToBytes(pp.key_hex);
    }
    if (reason !== null) {
      result = _reject(mode, reason);
    } else {
      result = {
        status: 'ok',
        rejection_reason: null,
        algorithm_id: ALGORITHM_ID,
        mode: mode,
        input_byte_length: bytes.length,
        key_byte_length: key === null ? null : key.length,
        digest_hex: mode === 'hmac_sha256' ? hmacSha256Hex(key, bytes) : sha256Hex(bytes),
      };
    }
  }
  const compliance_flags = {};
  if (result.status === 'ok') compliance_flags.DIGEST_COMPUTED = true;
  else compliance_flags.DIGEST_INPUT_REJECTED = true;
  return { output_payload: result, compliance_flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
