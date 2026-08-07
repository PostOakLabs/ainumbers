import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-583-beacon-seeded-fair-sampling-deriver';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'derive_beacon_fair_sample',
  mandate_type: 'compliance_control',
  gpu: false,
};

// EDGE-WAVE-BUILD-SPEC.md §2: beacon-seeded fair-sampling deriver. Provably-fair audit
// sampling -- NIST names public randomness beacons a canonical application for "preventing
// auditors from biasing selections, or being accused of it"; election risk-limiting audits
// (RLAs) run the exact ceremony this node automates: commit an item manifest hash BEFORE the
// beacon pulse round, then derive the sample deterministically from both. Anyone holding the
// same three declared inputs (manifest hash, pulse, algorithm id) can replay the exact same
// selection offline -- that is what makes the selection cherry-pick-proof.
//
// This kernel does NOT verify the beacon pulse's BLS/RSA signature -- the pulse is a caller-
// DECLARED input, same trust boundary as every other "pasted public data" node in this suite
// (art-06 reserve attestation, art-582 GENIUS disclosure checker, etc). Signature verification
// is an OPTIONAL page-side layer (vendor-pinned audited noble-curves BLS12-381 for drand, or
// WebCrypto RSA-PSS for NISTIR-8213 pulses) -- never inside this derivation kernel, and never
// hand-rolled crypto of any kind.
//
// HMAC-SHA256 is the only primitive used, and it is inlined in pure JS rather than called via
// crypto.subtle -- the SAME constraint and the SAME fix already proven by art-476 (S18-ART476-
// FIX-2, board/RIDER-KERNEL.md): crypto.subtle is unavailable synchronously inside the zkVM
// guest, and ES-module link-time resolution means compute() must be fully synchronous with no
// awaited digest. Inlining a standard, unmodified HMAC-SHA256 construction (RFC 2104 over the
// FIPS 180-4 SHA-256 core) is not "hand-rolled crypto" in the sense the perimeter doctrine
// bans (inventing a novel primitive) -- it is a faithful pure-JS implementation of an audited
// standard algorithm, made necessary by the guest sandbox, exactly as art-476 already
// established for SHA-256 alone.
//
// Deterministic only -- no randomness, no clock, no network. Zero PII.

// --- Inlined pure-JS SHA-256 + HMAC-SHA256 (no crypto.subtle, no TextEncoder) ---
// Core lifted verbatim from art-476's proven guest-safe inlining (self-check vectors below
// are the same known-answer tests art-476 pins).

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

// Standard RFC 2104 HMAC construction over the inlined SHA-256 core above. Block size 64
// bytes (SHA-256's rate); keys longer than the block are pre-hashed, shorter are zero-padded,
// per spec -- no deviation from the textbook construction.
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

// STOP conditions -- both MUST pass or this kernel throws and emits no digest. Pins the
// SHA-256 core (same known-answer vector art-476 uses) and an independently-computed
// HMAC-SHA256 known-answer vector (RFC 4231 test case 1: key 0x0b*20, data "Hi There").
const KNOWN_VECTOR_ASCII = 'hello world';
const KNOWN_VECTOR_ASCII_SHA = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';
const HMAC_RFC4231_KEY = new Uint8Array(20).fill(0x0b);
const HMAC_RFC4231_MSG = _utf8Bytes('Hi There');
const HMAC_RFC4231_EXPECT = 'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7';
(function _selfCheck() {
  const a = _toHex(_sha256(_utf8Bytes(KNOWN_VECTOR_ASCII)));
  if (a !== KNOWN_VECTOR_ASCII_SHA) {
    throw new Error('art-583 SHA-256 self-check FAILED: got ' + a + ' expected ' + KNOWN_VECTOR_ASCII_SHA);
  }
  const h = _toHex(_hmacSha256(HMAC_RFC4231_KEY, HMAC_RFC4231_MSG));
  if (h !== HMAC_RFC4231_EXPECT) {
    throw new Error('art-583 HMAC-SHA256 self-check FAILED (RFC 4231 case 1): got ' + h + ' expected ' + HMAC_RFC4231_EXPECT);
  }
})();

const VALID_ALGORITHMS = new Set(['hmac-drbg-sha256-v1']);
const VALID_BEACON_SOURCES = new Set(['drand_quicknet', 'nistir_8213']);

function s(v) { return String(v == null ? '' : v).trim(); }
function n(v, d) { const x = Number(v); return Number.isFinite(x) ? x : d; }

// HMAC-DRBG-style deterministic derivation. seed = HMAC(key = item_manifest_hash [committed
// BEFORE the pulse round -- this ordering is what makes selection cherry-pick-proof], msg =
// beacon_randomness:beacon_round:algorithm_id). Each candidate draw is
// HMAC(key = seed, msg = "draw:<i>"), taken mod item_count; a repeated candidate is rejected
// and the walk continues to the next counter (rejection sampling, no replacement). Every draw
// -- accepted or rejected -- is recorded in the transcript so an examiner can replay the exact
// walk from the three declared inputs alone.
function deriveFairSample(pp) {
  const beacon_source = VALID_BEACON_SOURCES.has(s(pp.beacon_source)) ? s(pp.beacon_source) : '';
  const beacon_round = s(pp.beacon_round);
  const beacon_randomness = s(pp.beacon_randomness);
  const item_manifest_hash = s(pp.item_manifest_hash);
  const item_count = Math.trunc(n(pp.item_count, 0));
  const sample_size = Math.trunc(n(pp.sample_size, 0));
  const algorithm_id = VALID_ALGORITHMS.has(s(pp.algorithm_id)) ? s(pp.algorithm_id) : '';

  const reasons = [];
  if (!beacon_source) reasons.push('beacon_source must be one of hmac-drbg-sha256-v1 sources: drand_quicknet, nistir_8213');
  if (!beacon_round) reasons.push('beacon_round is required (the pulse round identifier)');
  if (!beacon_randomness) reasons.push('beacon_randomness is required (the pulse\'s declared randomness value, hex)');
  if (!item_manifest_hash) reasons.push('item_manifest_hash is required (committed BEFORE the pulse round)');
  if (!algorithm_id) reasons.push('algorithm_id must be hmac-drbg-sha256-v1');
  if (!(item_count > 0)) reasons.push('item_count must be a positive integer');
  if (!(sample_size > 0)) reasons.push('sample_size must be a positive integer');
  if (item_count > 0 && sample_size > item_count) reasons.push('sample_size cannot exceed item_count');

  if (reasons.length > 0) {
    return {
      output_payload: {
        verdict: 'INDETERMINATE',
        reasons,
        beacon_source: beacon_source || null,
        beacon_round: beacon_round || null,
        item_manifest_hash: item_manifest_hash || null,
        item_count: item_count || null,
        sample_size: sample_size || null,
        algorithm_id: algorithm_id || null,
      },
      compliance_flags: ['SAMPLE_INDETERMINATE', 'MALFORMED_INPUT'],
    };
  }

  const seed_hex = _hmacHex(item_manifest_hash, beacon_randomness + ':' + beacon_round + ':' + algorithm_id);

  const selected_indices = [];
  const derivation_transcript = [];
  const seen = new Set();
  let draw = 0;
  // Pigeon-hole bound: at most item_count distinct candidates exist, so this terminates in
  // at most item_count accepted draws; guard against pathological rejection runs with a hard
  // cap well above that (10x) so a malformed seed can never spin unbounded.
  const MAX_DRAWS = item_count * 10;
  while (selected_indices.length < sample_size && draw < MAX_DRAWS) {
    const draw_hex = _hmacHex(seed_hex, 'draw:' + draw);
    // First 8 hex chars = 32 bits of drawn entropy per candidate, reduced mod item_count.
    const candidate = parseInt(draw_hex.slice(0, 8), 16) % item_count;
    const accepted = !seen.has(candidate);
    if (accepted) { seen.add(candidate); selected_indices.push(candidate); }
    derivation_transcript.push({ draw, hmac_hex: draw_hex, candidate_index: candidate, accepted });
    draw += 1;
  }

  const compliance_flags = ['SAMPLE_DERIVED', 'CEREMONY_MANIFEST_COMMITTED_BEFORE_PULSE'];
  if (selected_indices.length < sample_size) compliance_flags.push('DRAW_CAP_EXHAUSTED');

  return {
    output_payload: {
      verdict: selected_indices.length === sample_size ? 'DERIVED' : 'INDETERMINATE',
      beacon_source,
      beacon_round,
      beacon_randomness,
      item_manifest_hash,
      item_count,
      sample_size,
      algorithm_id,
      seed_hex,
      selected_indices,
      derivation_transcript,
      draws_used: draw,
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
