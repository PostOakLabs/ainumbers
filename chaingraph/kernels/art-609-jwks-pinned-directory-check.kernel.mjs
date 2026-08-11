import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-609-jwks-pinned-directory-check';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'check_jwks_pinned_directory',
  mandate_type: 'compliance_control',
  gpu: false,
};

// SPEC-BOTAUTH-NONCE-VISA-1 §3: confirm a caller-supplied JWKS directory document is the
// SAME document the caller pinned out-of-band at onboarding time, before art-130 trusts its
// internal shape. Chains BEFORE art-130 in `visa-tap-agent-verification` (pin-verify first,
// so a substituted directory fails before its shape is even checked) -- art-130 itself is
// unmodified (SPEC §5: any byte change to a proven kernel stales its compute_proof receipt).
//
// ⛔⛔ HARD RAIL (SPEC §3/§6, restated per the row's explicit instruction): this kernel NEVER
// fetches, stores, serves, or redistributes anyone's keys. Both `directory_jwks` (the document)
// and `pinned_digest` (the digest the caller computed and stored out-of-band) are caller-supplied
// inputs -- zero network, every time. Pinning a digest of someone else's published keys is
// verification; caching or serving "the current directory" for others to fetch from us would be
// key-directory hosting, and that is out of scope permanently.
//
// §6(b) canonicalization decision (this WU's own scope, flagged unresolved by the spec --
// decided and documented here, not deferred): `canonicalize(directory_jwks)` means the SAME
// JCS/RFC-8785 canon the rest of this codebase already uses for every other digest --
// cgCanon (recursive key-sort by Unicode code point, array order preserved) -> JSON.stringify
// -> UTF-8 bytes -> SHA-256 -> lowercase hex, no "sha256:" prefix. This is byte-for-byte
// `_hash.mjs` `policyParametersHash()`, applied to `directory_jwks` alone instead of the full
// `policy_parameters` object. Reusing the one canon path (rather than inventing a second) is
// exactly what `_hash.mjs`'s own module comment and CONTRACT.md's "canonical execution_hash
// only" rule require, and it is the only format every other digest field in this codebase uses
// -- hex, not base64 -- so two honest callers hashing the same logical document can never land
// on different encodings of the same bytes. `pinned_digest` MUST be supplied as that same
// lowercase-hex SHA-256 form; comparison is case-insensitive on the caller's input but the
// computed side is always emitted lowercase.

// --- Inlined pure-JS SHA-256 (no crypto.subtle, no TextEncoder) ---
// crypto.subtle and TextEncoder are BANNED in the zkVM guest; this kernel needs a digest
// INSIDE compute(), so the hash core is inlined -- the proven shape from art-476/art-210/
// art-194/cry-04. Guest-side transcription of `_hash.mjs` cgCanon, held to it by a self-check
// vector below and by golden-parity/kernel-contract over every fixture.

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

function _assertIJson(v) {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`Non-finite number (${v}) is not valid I-JSON; cannot canonicalize for hashing (RFC 8785 3.2.2.3).`);
    if (Number.isInteger(v) && !Number.isSafeInteger(v)) throw new Error(`Integer ${v} exceeds 2^53 and is not safe I-JSON; pass it as a string (RFC 7493).`);
  } else if (Array.isArray(v)) {
    v.forEach(_assertIJson);
  } else if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) _assertIJson(v[k]);
  }
}

const _cgCanon = (v) =>
  Array.isArray(v) ? v.map(_cgCanon)
  : (v && typeof v === 'object')
    ? Object.keys(v).sort().reduce((o, k) => (o[k] = _cgCanon(v[k]), o), {})
    : v;

// JCS-SHA-256 over the value alone -- identical output to `_hash.mjs` `policyParametersHash()`,
// but synchronous and WebCrypto-free so it can run inside the zkVM guest. This IS the §6(b)
// canonicalization decision: `canonicalize(x) = cgCanon(x)`, hashed as `hex(sha256(utf8(JSON.stringify(...))))`.
function _jcsDigest(value) {
  _assertIJson(value);
  return _toHex(_sha256(_utf8Bytes(JSON.stringify(_cgCanon(value)))));
}

const KNOWN_VECTOR_ASCII = 'hello world';
const KNOWN_VECTOR_ASCII_SHA = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';
const KNOWN_VECTOR_UTF8 = 'é€中🌍';
const KNOWN_VECTOR_UTF8_BYTES = 'c3a9e282ace4b8adf09f8c8d';
const KNOWN_VECTOR_UTF8_SHA = 'a0ce5afdae3fe5735aafeb2e6e0fc183133f3c47776e74fc85aedcc0cf7f1b6a';
const KNOWN_VECTOR_CANON = '{"A":"z","a":{"c":null,"d":[3,1,2]},"b":1}';
(function _selfCheck() {
  const a = _toHex(_sha256(_utf8Bytes(KNOWN_VECTOR_ASCII)));
  if (a !== KNOWN_VECTOR_ASCII_SHA) {
    throw new Error('art-609 SHA-256 self-check FAILED: got ' + a + ' expected ' + KNOWN_VECTOR_ASCII_SHA);
  }
  const encoded = _toHex(_utf8Bytes(KNOWN_VECTOR_UTF8));
  if (encoded !== KNOWN_VECTOR_UTF8_BYTES) {
    throw new Error('art-609 UTF-8 encoder self-check FAILED: got ' + encoded + ' expected ' + KNOWN_VECTOR_UTF8_BYTES);
  }
  const u = _toHex(_sha256(_utf8Bytes(KNOWN_VECTOR_UTF8)));
  if (u !== KNOWN_VECTOR_UTF8_SHA) {
    throw new Error('art-609 non-ASCII digest self-check FAILED: got ' + u + ' expected ' + KNOWN_VECTOR_UTF8_SHA);
  }
  const canon = JSON.stringify(_cgCanon({ b: 1, a: { d: [3, 1, 2], c: null }, 'A': 'z' }));
  if (canon !== KNOWN_VECTOR_CANON) {
    throw new Error('art-609 cgCanon self-check FAILED: got ' + canon + ' expected ' + KNOWN_VECTOR_CANON);
  }
})();

const HEX64_RE = /^[0-9a-f]{64}$/i;

export function compute(pp) {
  pp = (pp !== null && typeof pp === 'object') ? pp : {};
  const directory_jwks = (pp.directory_jwks !== null && typeof pp.directory_jwks === 'object') ? pp.directory_jwks : {};
  const pinned_digest_raw = pp.pinned_digest;
  const keys = Array.isArray(directory_jwks.keys) ? directory_jwks.keys : [];

  const computed_digest = _jcsDigest(directory_jwks);

  const pinned_digest_present = typeof pinned_digest_raw === 'string' && pinned_digest_raw.length > 0;
  const pinned_digest_well_formed = pinned_digest_present && HEX64_RE.test(pinned_digest_raw);
  const pinned_digest_normalized = pinned_digest_well_formed ? pinned_digest_raw.toLowerCase() : null;

  const digest_match = pinned_digest_well_formed && pinned_digest_normalized === computed_digest;

  const compliance_flags = ['JWKS_PINNED_DIGEST_ASSESSED'];
  if (!pinned_digest_present) {
    compliance_flags.push('PINNED_DIGEST_MISSING');
  } else if (!pinned_digest_well_formed) {
    compliance_flags.push('PINNED_DIGEST_MALFORMED');
  }
  compliance_flags.push(digest_match ? 'JWKS_PINNED_DIGEST_MATCH' : 'JWKS_PINNED_DIGEST_MISMATCH');

  const output_payload = {
    computed_digest,
    pinned_digest: pinned_digest_present ? pinned_digest_raw : null,
    pinned_digest_well_formed,
    digest_match,
    key_count: keys.length,
  };

  return { output_payload, compliance_flags };
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
