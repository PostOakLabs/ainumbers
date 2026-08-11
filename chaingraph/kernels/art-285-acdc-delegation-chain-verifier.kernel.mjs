// art-285 — ACDC Delegation Chain Verifier: pure decision kernel.
// Faithful port of compute() in
//   repo/chaingraph/art-285-acdc-delegation-chain-verifier.html
// Pure: no DOM, no window, no network. VERIFY-ONLY doctrine (GAP-C):
// verifies a supplied chain of Authentic Chained Data Containers (ACDC);
// never operates witness/registry infrastructure, never resolves a
// revocation registry over the network (report, don't resolve).
//
// Standards pin (2026-07-10): KERI / ACDC / CESR ratified by ToIP, Jan 2026.
//
// SCOPE NOTE (v1): SAID (self-addressing identifier) integrity is checked
// with the canonical _hash.mjs JCS canonicalizer + SHA-256 digest, matching
// this kernel's plain-hex `d` field convention — NOT full CESR multicodec
// SAIDs (which default to Blake3-256 in KERI; BLAKE3 is excluded per the
// OCG art-201 exec-check-friendly lesson). CESR binary streams are OUT of
// scope; JSON-serialized ACDCs only (noted on the node page).

import { executionHash } from './_hash.mjs';
// RISC0 guest loader stub for _hash.mjs exports only executionHash, not cgCanon.
// Byte-identical to _hash.mjs cgCanon — inlined so this kernel runs unmodified in-guest.
const cgCanon = (v) => Array.isArray(v) ? v.map(cgCanon) : (v && typeof v === 'object') ? Object.keys(v).sort().reduce((o, k) => (o[k] = cgCanon(v[k]), o), {}) : v;

const TOOL_ID = 'art-285-acdc-delegation-chain-verifier';
const TOOL_VERSION = '1.0.0';
const DEFAULT_MAX_DEPTH = 10;
const HARD_MAX_DEPTH = 50;

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'verify_acdc_delegation_chain',
  mandate_type: 'compliance_mandate', gpu: false,
};

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

function canonJson(v) { return JSON.stringify(cgCanon(v)); }

function computeSaid(cred) {
  const placeholder = '#'.repeat(typeof cred.d === 'string' ? cred.d.length : 64);
  const blanked = { ...cred, d: placeholder };
  return sha256Hex(canonJson(blanked));
}

function findEdgeTo(edges, targetSaid) {
  if (!edges || typeof edges !== 'object') return null;
  for (const key of Object.keys(edges)) {
    if (key === 'd') continue;
    const e = edges[key];
    if (e && typeof e === 'object' && e.n === targetSaid) return e;
  }
  return null;
}

export function compute(pp) {
  const credentials = Array.isArray(pp.credentials) ? pp.credentials : null;
  const expectedRootAid = pp.expected_root_aid ?? null;
  const maxChainDepth = Math.min(Number(pp.max_chain_depth ?? DEFAULT_MAX_DEPTH) || DEFAULT_MAX_DEPTH, HARD_MAX_DEPTH);

  const saidFailures = [];
  const edgeFailures = [];
  const revocationStatusReported = [];

  if (!credentials || credentials.length === 0) {
    return {
      output_payload: { valid: false, chain_depth: 0, root_aid_matched: false, said_failures: [{ index: -1, code: 'CREDENTIALS_MISSING' }], edge_failures: [] },
      compliance_flags: ['ACDC_CHAIN_INVALID'],
    };
  }

  const bounded = credentials.length > maxChainDepth ? credentials.slice(0, maxChainDepth) : credentials;
  if (credentials.length > maxChainDepth) {
    saidFailures.push({ index: maxChainDepth, code: 'CHAIN_DEPTH_EXCEEDED', detail: `chain has ${credentials.length} credentials, bound is ${maxChainDepth}` });
  }

  for (let i = 0; i < bounded.length; i++) {
    const cred = bounded[i] ?? {};
    if (typeof cred.d !== 'string' || !cred.d) {
      saidFailures.push({ index: i, code: 'SAID_MISSING', detail: 'credential has no d (SAID) field' });
      continue;
    }
    const computed = computeSaid(cred);
    if (computed !== cred.d.replace(/^0x/, '').toLowerCase()) {
      saidFailures.push({ index: i, code: 'SAID_MISMATCH', detail: `computed ${computed}` });
    }
    if (cred.schema_said_expected && cred.s !== cred.schema_said_expected) {
      saidFailures.push({ index: i, code: 'SCHEMA_SAID_SELF_MISMATCH', detail: 'credential declares a schema SAID inconsistent with schema_said_expected' });
    }
    if (cred.revocation_status !== undefined) {
      revocationStatusReported.push({ index: i, status: cred.revocation_status });
    }
  }

  for (let i = 0; i < bounded.length - 1; i++) {
    const child = bounded[i] ?? {};
    const parent = bounded[i + 1] ?? {};
    const edge = findEdgeTo(child.e, parent.d);
    if (!edge) {
      edgeFailures.push({ index: i, code: 'EDGE_BROKEN', detail: `no edge in credential[${i}] references credential[${i + 1}].d` });
      continue;
    }
    const parentIssuee = parent.a?.i ?? null;
    if (child.i !== parentIssuee) {
      edgeFailures.push({ index: i, code: 'ISSUER_ISSUEE_MISMATCH', detail: `credential[${i}].i (${child.i}) != credential[${i + 1}].a.i (${parentIssuee})` });
    }
    if (edge.s && parent.s && edge.s !== parent.s) {
      edgeFailures.push({ index: i, code: 'SCHEMA_SAID_MISMATCH', detail: `edge declares schema ${edge.s}, credential[${i + 1}].s is ${parent.s}` });
    }
  }

  const rootCred = bounded[bounded.length - 1] ?? {};
  const rootAidMatched = expectedRootAid != null && rootCred.i === expectedRootAid;
  if (expectedRootAid != null && !rootAidMatched) {
    edgeFailures.push({ index: bounded.length - 1, code: 'ROOT_AID_MISMATCH', detail: `root credential issuer ${rootCred.i} != expected_root_aid ${expectedRootAid}` });
  }

  const valid = saidFailures.length === 0 && edgeFailures.length === 0 && (expectedRootAid == null || rootAidMatched);
  const output_payload = {
    valid, chain_depth: bounded.length, root_aid_matched: rootAidMatched,
    said_failures: saidFailures, edge_failures: edgeFailures,
    revocation_status_reported: revocationStatusReported,
  };
  const compliance_flags = [valid ? 'ACDC_CHAIN_VALID' : 'ACDC_CHAIN_INVALID'];
  if (revocationStatusReported.length > 0) compliance_flags.push('REVOCATION_STATUS_PRESENT_UNRESOLVED');

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
