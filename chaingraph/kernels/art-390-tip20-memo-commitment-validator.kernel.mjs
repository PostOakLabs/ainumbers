// art-390 — TIP-20 Memo/Commitment Validator.
// Pure decision kernel -- no DOM, no window, no Date.now(), no network.
//
// TIP-20 TransferWithMemo carries a 32-byte memo (docs.tempo.xyz/guide/payments/
// transfer-memos), which the docs prescribe using as a hash-or-locator
// commitment for larger or PII-bearing off-chain payloads. This kernel
// validates the memo's length/hex form and, when the caller supplies the
// off-chain payload (or an invoice ID under a declared locator template),
// recomputes the SHA-256 commitment and checks it against the memo.
//
// Distinct from screen_tip20_transfer_batch (art-38, AML/Travel Rule
// screening of a transfer batch): this kernel is integrity-only -- it never
// screens sanctions/AML, it only checks whether a memo commitment matches
// its claimed preimage.
//
// compute() is async because a real SHA-256 digest requires globalThis.crypto.
// subtle (the same primitive _hash.mjs uses), which is only available as an
// awaited call -- this mirrors the pattern already used by art-284/art-285.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-390-tip20-memo-commitment-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'validate_tip20_memo_commitment',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

const MEMO_BYTE_LENGTH = 32;
const MEMO_HEX_LENGTH = MEMO_BYTE_LENGTH * 2;
const DEFAULT_INVOICE_LOCATOR_TEMPLATE = 'invoice:{invoice_id}';

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Synchronous, WebCrypto-free SHA-256 (ASYNC-VACUOUS-REMEDIATE-1).
// Transcribed from the proven art-476 block. compute() MUST be synchronous: the zkVM
// guest and the host verifier both call compute(pp) directly, and an async compute
// returns a Promise that canonicalizes to {} -- a groth16 seal over an empty journal.
// The digest VALUES are unchanged from the WebCrypto path, so fixtures, golden hashes
// and execution_hash all stay identical; the self-check below pins that byte-for-byte.

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
  [h0,h1,h2,h3,h4,h5,h6,h7].forEach(function (v, i) { const j = i * 4; r[j] = v >>> 24; r[j+1] = (v >>> 16) & 0xff; r[j+2] = (v >>> 8) & 0xff; r[j+3] = v & 0xff; });
  return r;
}

function _toHex(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

// STOP conditions. Both MUST pass or this kernel throws and emits no digest.
// KNOWN_VECTOR_ASCII pins the SHA-256 core. KNOWN_VECTOR_UTF8 pins _utf8Bytes against
// the host TextEncoder byte-for-byte: the fixtures are pure ASCII and cannot catch a
// multi-byte divergence, so a non-ASCII vector is pinned explicitly. It covers 2-byte
// (e-acute), 3-byte (euro, CJK) and 4-byte surrogate-pair (emoji) encodings.
const KNOWN_VECTOR_ASCII = 'hello world';
const KNOWN_VECTOR_ASCII_SHA = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';
const KNOWN_VECTOR_UTF8 = 'é€中🌍';
const KNOWN_VECTOR_UTF8_BYTES = 'c3a9e282ace4b8adf09f8c8d';
const KNOWN_VECTOR_UTF8_SHA = 'a0ce5afdae3fe5735aafeb2e6e0fc183133f3c47776e74fc85aedcc0cf7f1b6a';
(function _shaSelfCheck() {
  const a = _toHex(_sha256(_utf8Bytes(KNOWN_VECTOR_ASCII)));
  if (a !== KNOWN_VECTOR_ASCII_SHA) {
    throw new Error('SHA-256 self-check FAILED: got ' + a + ' expected ' + KNOWN_VECTOR_ASCII_SHA);
  }
  const encoded = _toHex(_utf8Bytes(KNOWN_VECTOR_UTF8));
  if (encoded !== KNOWN_VECTOR_UTF8_BYTES) {
    throw new Error('UTF-8 encoder self-check FAILED: got ' + encoded + ' expected ' + KNOWN_VECTOR_UTF8_BYTES);
  }
  const u = _toHex(_sha256(_utf8Bytes(KNOWN_VECTOR_UTF8)));
  if (u !== KNOWN_VECTOR_UTF8_SHA) {
    throw new Error('non-ASCII digest self-check FAILED: got ' + u + ' expected ' + KNOWN_VECTOR_UTF8_SHA);
  }
})();

function sha256Hex(text) {
  return _toHex(_sha256(_utf8Bytes(text)));
}

function normalizeHex(s) {
  return typeof s === 'string' ? s.trim().replace(/^0x/i, '').toLowerCase() : '';
}

export function compute(pp) {
  pp = pp || {};
  const memo_hex = normalizeHex(pp.memo_hex);
  const payload = typeof pp.payload === 'string' ? pp.payload : null;
  const invoice_id = typeof pp.invoice_id === 'string' && pp.invoice_id ? pp.invoice_id : null;
  const invoice_locator_template = typeof pp.invoice_locator_template === 'string' && pp.invoice_locator_template
    ? pp.invoice_locator_template
    : DEFAULT_INVOICE_LOCATOR_TEMPLATE;

  const memo_length_valid = memo_hex.length === MEMO_HEX_LENGTH;
  const memo_hex_valid = memo_length_valid && /^[0-9a-f]{64}$/.test(memo_hex);

  const compliance_flags = [];
  if (!memo_length_valid) compliance_flags.push('MEMO_LENGTH_INVALID');
  else if (!memo_hex_valid) compliance_flags.push('MEMO_NOT_HEX');

  let payload_commitment = null;
  let payload_commitment_match = null;
  if (payload !== null) {
    payload_commitment = sha256Hex(payload);
    payload_commitment_match = memo_hex_valid && payload_commitment === memo_hex;
    if (payload_commitment_match === false) compliance_flags.push('PAYLOAD_COMMITMENT_MISMATCH');
  }

  let invoice_locator = null;
  let invoice_locator_commitment = null;
  let invoice_locator_match = null;
  if (invoice_id !== null) {
    invoice_locator = invoice_locator_template.replace('{invoice_id}', invoice_id);
    invoice_locator_commitment = sha256Hex(invoice_locator);
    invoice_locator_match = memo_hex_valid && invoice_locator_commitment === memo_hex;
    if (invoice_locator_match === false) compliance_flags.push('INVOICE_LOCATOR_COMMITMENT_MISMATCH');
  }

  const commitment_source_supplied = payload !== null || invoice_id !== null;
  if (!commitment_source_supplied) compliance_flags.push('NO_COMMITMENT_SOURCE_SUPPLIED');

  const overall_valid = memo_hex_valid && (
    !commitment_source_supplied
      ? true
      : (payload_commitment_match === true || invoice_locator_match === true)
  );

  const output_payload = {
    memo_hex: memo_hex || null,
    memo_length_valid,
    memo_hex_valid,
    payload_commitment,
    payload_commitment_match,
    invoice_locator,
    invoice_locator_commitment,
    invoice_locator_match,
    commitment_source_supplied,
    overall_valid,
    note: 'Integrity check only -- distinct from screen_tip20_transfer_batch (art-38 AML/Travel Rule screening). Memo is a fixed 32-byte hash-or-locator commitment per docs.tempo.xyz/guide/payments/transfer-memos.',
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
