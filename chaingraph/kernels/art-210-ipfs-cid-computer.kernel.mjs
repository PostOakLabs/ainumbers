import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-210-ipfs-cid-computer';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_ipfs_cid',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Computes a CIDv1 content address for provided text or pre-encoded bytes.
// Algorithm: multihash(sha2-256 fn=0x12, len=0x20, digest) + multicodec (raw 0x55)
// + multibase base32 lowercase ('b' prefix). RFC 4648 base32, no padding.
//
// Use to verify what tokenURI resolves to pre-mint. Metadata-scale inputs only
// (text/JSON, not large binary assets -- large inputs are unprovable in zkVM).
//
// STOP: if the known test vector ("hello world" -> bafkreifzjut3te2nhyekklss27nh3k72ysco7y32koao5eei66wof36n5e)
// mismatches, this kernel MUST NOT emit any CID -- it will throw.
//
// crypto.subtle is BANNED in the zkVM guest. Pure-JS SHA-256 is inlined below
// (same implementation proven in art-199/200/206 crypto kernels).
// _utf8Bytes replicates TextEncoder.encode (TextEncoder also banned in guest).

// --- Inlined pure-JS SHA-256 (no crypto.subtle, no TextEncoder) ---

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
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
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

// --- CIDv1 construction ---

const BASE32_ALPHA = 'abcdefghijklmnopqrstuvwxyz234567';

function _base32Encode(bytes) {
  let bits = 0, value = 0, out = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i]; bits += 8;
    while (bits >= 5) { bits -= 5; out += BASE32_ALPHA[(value >>> bits) & 0x1f]; }
  }
  if (bits > 0) out += BASE32_ALPHA[(value << (5 - bits)) & 0x1f];
  return out;
}

function _toHex(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

// CIDv1 bytes: [0x01 version, codecByte, 0x12 sha2-256, 0x20 len=32, ...digest]
function _buildCIDv1(digest, codecByte) {
  const cidBytes = new Uint8Array(2 + 2 + 32);
  cidBytes[0] = 0x01; cidBytes[1] = codecByte; cidBytes[2] = 0x12; cidBytes[3] = 0x20;
  cidBytes.set(digest, 4);
  return cidBytes;
}

// Known-vector self-check. MUST pass or kernel throws (STOP condition).
const KNOWN_VECTOR_INPUT = 'hello world';
const KNOWN_VECTOR_CID   = 'bafkreifzjut3te2nhyekklss27nh3k72ysco7y32koao5eei66wof36n5e';
(function _selfCheck() {
  const digest = _sha256(_utf8Bytes(KNOWN_VECTOR_INPUT));
  const cidBytes = _buildCIDv1(digest, 0x55);
  const cid = 'b' + _base32Encode(cidBytes);
  if (cid !== KNOWN_VECTOR_CID) {
    throw new Error('art-210 CIDv1 self-check FAILED: got ' + cid + ' expected ' + KNOWN_VECTOR_CID);
  }
})();

const VALID_CODECS = { 'raw': 0x55, 'dag-pb': 0x70 };

export function compute(pp) {
  pp = pp || {};

  const text   = typeof pp.text === 'string' ? pp.text : '';
  const codec  = (typeof pp.codec === 'string' && VALID_CODECS[pp.codec]) ? pp.codec : 'raw';
  const codecByte = VALID_CODECS[codec];

  // Empty-input mode: CID of empty string
  const input = text;
  const inputBytes = _utf8Bytes(input);
  const byteLength = inputBytes.length;

  const digest   = _sha256(inputBytes);
  const cidBytes = _buildCIDv1(digest, codecByte);
  const cid      = 'b' + _base32Encode(cidBytes);
  const digestHex = _toHex(digest);
  const cidBytesHex = _toHex(cidBytes);

  const output_payload = {
    cid: cid,
    codec: codec,
    codec_code: '0x' + codecByte.toString(16).padStart(2, '0'),
    multihash_fn: 'sha2-256',
    multihash_fn_code: '0x12',
    digest_length: 32,
    digest_hex: digestHex,
    cid_bytes_hex: cidBytesHex,
    byte_length: byteLength,
    known_vector_verified: true,
    disclaimer: 'Not legal advice. CID is computed from your input text only. No pinning, no network. Verify against ipfs add --cid-version=1 for your codec before use.',
  };

  const compliance_flags = [];
  compliance_flags.push('IPFS_CID_COMPUTED');
  compliance_flags.push('CIDV1_FORMAT');
  compliance_flags.push('NO_NETWORK_CALL');
  compliance_flags.push('KNOWN_VECTOR_VERIFIED');

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
