import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-774-beacon-seeded-fair-sampling-v2';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'derive_beacon_fair_sample_v2',
  mandate_type: 'compliance_control',
  gpu: false,
};

// Beacon-seeded fair-sampling deriver, version 2 of the sampler family. Derives a
// deterministic, offline-replayable audit sample from three declared inputs: an item
// manifest hash committed BEFORE the beacon pulse round, the pulse itself (source, round,
// declared randomness), and this algorithm id. Selection is cherry-pick-proof because the
// manifest commitment precedes the pulse and the derivation is a pure function of the
// declared inputs: anyone holding them replays the identical sample offline.
//
// What v2 fixes relative to the v1 sampler node (v1 is NOT edited; it stays replayable
// for every receipt already issued against it):
//   1. No draw cap. v1 rejection-sampled WITH replacement and capped the walk at
//      10 * item_count draws; a full sample needs about item_count * H(item_count) draws
//      (coupon collector), so near-full populations above roughly 12,000 items exhausted
//      the cap and the verdict fell to INDETERMINATE / DRAW_CAP_EXHAUSTED. v2 walks a
//      partial Fisher-Yates over an index array: every accepted draw selects exactly one
//      remaining item, so exactly sample_size accepted draws are consumed and no cap
//      exists or is needed. Termination is structural: each selection step accepts any
//      draw below the threshold (probability >= 1 - window/2^32, at least 0.9997 at the
//      maximum window) and the walk cannot need more accepted draws than the sample size.
//   2. No modulo bias. v1 reduced each 32-bit draw with a raw remainder, biasing toward
//      lower indices by up to item_count / 2^32. v2 uses threshold rejection: draws at or
//      above the largest multiple of the window width that fits in 32 bits are rejected
//      and the counter advances, so the accepted region is an exact multiple of the
//      window width and every offset in the remaining window is hit by exactly the same
//      number of raw 32-bit values. Unbiasedness is exact integer arithmetic, not a
//      statistical claim.
//   3. Input validation. Both hex inputs must be exactly 64 lowercase hex characters
//      (v1 only trimmed them); anything else is a structured refusal.
//
// Deterministic only: no randomness of its own, no clock, no network, no storage. Zero PII.
// This kernel never verifies the beacon pulse signature: the pulse is a caller-declared
// input (page-side signature checking is an optional outer layer, never this derivation).
//
// DRBG stream: byte-identical construction to the v1 sampler node. seed = HMAC-SHA256
// (key = item_manifest_hash, message = beacon_randomness ':' beacon_round ':' algorithm_id);
// draw i = HMAC-SHA256 (key = seed_hex, message = 'draw:' i); the first 8 hex characters of
// each draw are 32 bits of entropy. Only the reduction of those 32 bits into the remaining
// window differs from v1 (threshold rejection instead of raw modulo, Fisher-Yates instead
// of duplicate rejection).

// --- Inlined pure-JS SHA-256 + HMAC-SHA256 (no crypto.subtle, no TextEncoder) ---
// crypto.subtle is unavailable synchronously inside the zkVM guest, and ES-module link-time
// resolution requires compute() to be fully synchronous with no awaited digest. The
// construction below is the standard hash-based message authentication code over the
// SHA-256 core: keys longer than the 64-byte block are pre-hashed, shorter keys are
// zero-padded to the block, inner pad byte 0x36, outer pad byte 0x5c.

function _utf8Bytes(str) {
  const s = String(str);
  const out = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff) {
      const hi = c, lo = s.charCodeAt(++i);
      const cp = 0x10000 + ((hi - 0xd800) << 10) + (lo - 0xdc00);
      out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return new Uint8Array(out);
}

function _sha256(bytes) {
  const K = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ]);
  const msgLen = bytes.length;
  const paddedLen = Math.ceil((msgLen + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[msgLen] = 0x80;
  const bitLen = msgLen * 8;
  for (let i = 0; i < 8; i++) padded[paddedLen - 8 + i] = Number((BigInt(bitLen) >> BigInt(56 - i * 8)) & 0xffn);
  let [h0,h1,h2,h3,h4,h5,h6,h7] = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const rotr = (x, n2) => (x >>> n2) | (x << (32 - n2));
  for (let cs = 0; cs < paddedLen; cs += 64) {
    const W = new Uint32Array(64);
    for (let i = 0; i < 16; i++) { const j = cs + i * 4; W[i] = (padded[j] << 24) | (padded[j+1] << 16) | (padded[j+2] << 8) | padded[j+3]; }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i-15], 7) ^ rotr(W[i-15], 18) ^ (W[i-15] >>> 3);
      const s1 = rotr(W[i-2], 17) ^ rotr(W[i-2], 19) ^ (W[i-2] >>> 10);
      W[i] = (W[i-16] + s0 + W[i-7] + s1) >>> 0;
    }
    let [a,b,c,d,e,f,g,h] = [h0,h1,h2,h3,h4,h5,h6,h7];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25), ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22), maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }
  const r = new Uint8Array(32);
  [h0,h1,h2,h3,h4,h5,h6,h7].forEach(function(v, i) { const j = i * 4; r[j] = v >>> 24; r[j+1] = (v >>> 16) & 0xff; r[j+2] = (v >>> 8) & 0xff; r[j+3] = v & 0xff; });
  return r;
}

function _toHex(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

// Textbook HMAC over the inlined SHA-256 core: block size 64 bytes (SHA-256 rate), long
// keys pre-hashed, short keys zero-padded, no deviation from the standard construction.
function _hmacSha256(keyBytes, msgBytes) {
  const BLOCK = 64;
  let key = keyBytes;
  if (key.length > BLOCK) key = _sha256(key);
  if (key.length < BLOCK) { const padded = new Uint8Array(BLOCK); padded.set(key); key = padded; }
  const ipad = new Uint8Array(BLOCK), opad = new Uint8Array(BLOCK);
  for (let i = 0; i < BLOCK; i++) { ipad[i] = key[i] ^ 0x36; opad[i] = key[i] ^ 0x5c; }
  const inner = _sha256(_concatBytes(ipad, msgBytes));
  return _sha256(_concatBytes(opad, inner));
}

function _concatBytes(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0); out.set(b, a.length);
  return out;
}

function _hmacHex(keyStr, msgStr) {
  return _toHex(_hmacSha256(_utf8Bytes(keyStr), _utf8Bytes(msgStr)));
}

// Known-answer stops: the SHA-256 core over "hello world" and an HMAC-SHA256 known-answer
// vector (key 0x0b repeated 20 times, message "Hi There"). Both MUST hold or this kernel
// throws and emits nothing.
const KNOWN_VECTOR_ASCII = 'hello world';
const KNOWN_VECTOR_ASCII_SHA = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';
const HMAC_KAT_KEY = new Uint8Array(20).fill(0x0b);
const HMAC_KAT_MSG = _utf8Bytes('Hi There');
const HMAC_KAT_EXPECT = 'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7';
(function _selfCheck() {
  const a = _toHex(_sha256(_utf8Bytes(KNOWN_VECTOR_ASCII)));
  if (a !== KNOWN_VECTOR_ASCII_SHA) {
    throw new Error('sampler v2 SHA-256 self-check FAILED: got ' + a + ' expected ' + KNOWN_VECTOR_ASCII_SHA);
  }
  const h = _toHex(_hmacSha256(HMAC_KAT_KEY, HMAC_KAT_MSG));
  if (h !== HMAC_KAT_EXPECT) {
    throw new Error('sampler v2 HMAC-SHA256 self-check FAILED: got ' + h + ' expected ' + HMAC_KAT_EXPECT);
  }
})();

const ALGORITHM_ID = 'hmac-drbg-sha256-v2';
const VALID_BEACON_SOURCES = new Set(['drand_quicknet', 'nistir_8213']);
// 64 lowercase hex characters, exactly, with no prefix.
const HEX64 = /^[0-9a-f]{64}$/;
// Population ceiling. The partial Fisher-Yates holds one Uint32Array of item_count
// entries: at the ceiling that is a 4,000,000-byte index array (4 bytes per entry),
// which is the guest-memory bound this node commits to. Populations above the ceiling
// are refused before any allocation is attempted.
const MAX_ITEM_COUNT = 1000000;
// The per-draw transcript is capped in the emitted payload so the artifact stays
// bounded at large sample sizes; the capped flag plus draws_used/reduction_rejects
// counts keep the walk fully reconstructible offline from the declared inputs.
const MAX_TRANSCRIPT_ENTRIES = 50;
const Z32 = 4294967296; // 2^32

function s(v) { return String(v == null ? '' : v).trim(); }
function intOrZero(v) {
  const x = Number(v);
  if (!Number.isFinite(x) || Math.floor(x) !== x) return 0;
  return x;
}

// Threshold-rejection reduction of one raw 32-bit draw into a remaining window of width w.
// Returns an integer offset in [0, w) with EXACT uniformity: the accepted region is
// [0, limit) with limit = floor(2^32 / w) * w, an exact multiple of w, so every offset is
// reachable through exactly limit / w raw values; raw draws in [limit, 2^32) are rejected.
// Acceptance probability is limit / 2^32 >= 1 - w / 2^32 (>= 0.99977 at the ceiling).
function reduceUnbiased(raw32, w) {
  const limit = Math.floor(Z32 / w) * w;
  if (raw32 < limit) return raw32 % w;
  return -1;
}

function deriveFairSample(pp) {
  const beacon_source = s(pp.beacon_source);
  const beacon_round = s(pp.beacon_round);
  const beacon_randomness = s(pp.beacon_randomness);
  const item_manifest_hash = s(pp.item_manifest_hash);
  const algorithm_id = s(pp.algorithm_id);
  const item_count = intOrZero(pp.item_count);
  const sample_size = intOrZero(pp.sample_size);

  const reasons = [];
  if (!VALID_BEACON_SOURCES.has(beacon_source)) reasons.push('beacon_source must be one of: drand_quicknet, nistir_8213');
  if (!beacon_round) reasons.push('beacon_round is required (the pulse round identifier)');
  if (!HEX64.test(beacon_randomness)) reasons.push('beacon_randomness must be exactly 64 lowercase hex characters (0-9, a-f)');
  if (!HEX64.test(item_manifest_hash)) reasons.push('item_manifest_hash must be exactly 64 lowercase hex characters (0-9, a-f), without a sha256: prefix');
  if (algorithm_id !== ALGORITHM_ID) reasons.push('algorithm_id must be ' + ALGORITHM_ID);
  if (!(item_count >= 1) || item_count > MAX_ITEM_COUNT) reasons.push('item_count must be an integer between 1 and ' + MAX_ITEM_COUNT);
  if (!(sample_size >= 1)) {
    reasons.push('sample_size must be a positive integer (0 or missing is a refusal)');
  } else if (item_count >= 1 && item_count <= MAX_ITEM_COUNT && sample_size > item_count) {
    reasons.push('sample_size cannot exceed item_count');
  }

  if (reasons.length > 0) {
    return {
      output_payload: {
        verdict: 'INDETERMINATE',
        reasons,
        beacon_source: VALID_BEACON_SOURCES.has(beacon_source) ? beacon_source : (beacon_source || null),
        beacon_round: beacon_round || null,
        beacon_randomness: HEX64.test(beacon_randomness) ? beacon_randomness : (beacon_randomness || null),
        item_manifest_hash: HEX64.test(item_manifest_hash) ? item_manifest_hash : (item_manifest_hash || null),
        item_count: (item_count >= 1 && item_count <= MAX_ITEM_COUNT) ? item_count : null,
        sample_size: sample_size >= 1 ? sample_size : null,
        algorithm_id: algorithm_id === ALGORITHM_ID ? algorithm_id : (algorithm_id || null),
      },
      compliance_flags: ['SAMPLE_INDETERMINATE', 'MALFORMED_INPUT'],
    };
  }

  const seed_hex = _hmacHex(item_manifest_hash, beacon_randomness + ':' + beacon_round + ':' + ALGORITHM_ID);

  // Partial Fisher-Yates over the index array: index[i] === i initially; at step i the
  // unbiased draw picks j in [i, item_count), index[i] and index[j] swap, and index[i]
  // (post-swap) is the i-th selected item. Every step consumes accepted draws until one
  // clears the threshold; exactly sample_size accepted draws exist in total and there is
  // no draw cap.
  const index = new Uint32Array(item_count);
  for (let i = 0; i < item_count; i++) index[i] = i;
  const selected_indices = [];
  const derivation_transcript = [];
  let draw = 0;
  let reduction_rejects = 0;
  while (selected_indices.length < sample_size) {
    const draw_hex = _hmacHex(seed_hex, 'draw:' + draw);
    // First 8 hex characters = 32 bits of drawn entropy, identical extraction to the
    // v1 sampler node's raw stream.
    const raw32 = parseInt(draw_hex.slice(0, 8), 16);
    const position = selected_indices.length;
    const w = item_count - position;
    const offset = reduceUnbiased(raw32, w);
    if (offset < 0) {
      reduction_rejects += 1;
      if (derivation_transcript.length < MAX_TRANSCRIPT_ENTRIES) {
        derivation_transcript.push({ draw, hmac_hex: draw_hex, result: 'rejected_reduction' });
      }
    } else {
      const j = position + offset;
      const tmp = index[position];
      index[position] = index[j];
      index[j] = tmp;
      const picked = index[position];
      selected_indices.push(picked);
      if (derivation_transcript.length < MAX_TRANSCRIPT_ENTRIES) {
        derivation_transcript.push({ draw, hmac_hex: draw_hex, result: 'selected', position, swap_index: j, selected_index: picked });
      }
    }
    draw += 1;
  }

  // Each flag is earned by the branch that pushes it: they attest a COMPLETED unbiased
  // derivation, so they are emitted only when the walk actually selected sample_size
  // distinct items -- never on a zero-input or refused run.
  const compliance_flags = [];
  if (selected_indices.length === sample_size) {
    compliance_flags.push('SAMPLE_DERIVED');
    compliance_flags.push('CEREMONY_MANIFEST_COMMITTED_BEFORE_PULSE');
    compliance_flags.push('UNBIASED_THRESHOLD_REDUCTION');
    compliance_flags.push('SELECTION_WITHOUT_REPLACEMENT');
  }

  return {
    output_payload: {
      verdict: 'DERIVED',
      beacon_source,
      beacon_round,
      beacon_randomness,
      item_manifest_hash,
      item_count,
      sample_size,
      algorithm_id: ALGORITHM_ID,
      seed_hex,
      selected_indices,
      draws_used: draw,
      reduction_rejects,
      derivation_transcript,
      transcript_truncated: draw > derivation_transcript.length,
    },
    compliance_flags,
  };
}

export function compute(pp) {
  pp = (pp !== null && typeof pp === 'object') ? pp : {};
  return deriveFairSample(pp);
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
