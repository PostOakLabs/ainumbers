import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-336-compute-ltv-ratios';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_ltv_ratios',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Loan-to-value ratio family per Fannie Mae Selling Guide B2-1.1-03
// (Loan-to-Value, Combined LTV, HCLTV Ratios) and Freddie Mac Single-Family
// Seller/Servicer Guide 5401.1 (LTV/TLTV/HTLTV ratios). LTV, CLTV (combined,
// closed-end subordinate financing), and HCLTV (home-equity combined,
// including undrawn HELOC lines) against the lesser-of-value-or-price rule
// for purchases and appraised value for refinances. Feeds
// art-222-agency-eligibility-matrix (ltv/cltv/hcltv inputs).
//
// Pure ECMA-262 arithmetic only -- no Math.pow, no Date.now/new Date(),
// no Math.random. Percent values rounded to 2 decimal places (r2).

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

export function compute(pp) {
  pp = pp || {};

  const appraisedValue = safeNum(pp.appraised_value, 0);
  const salesPrice = safeNum(pp.sales_price, 0);
  const firstLienAmount = safeNum(pp.first_lien_amount, 0);
  const subordinateLienAmount = safeNum(pp.subordinate_lien_amount, 0);
  const helocCreditLimit = safeNum(pp.heloc_credit_limit, 0);
  const transactionType = pp.transaction_type === 'refinance' ? 'refinance' : 'purchase';

  // Lesser-of-value-or-price rule (B2-1.1-03): purchases use the lesser of
  // appraised value and sales price; refinances use appraised value only.
  let valueUsed;
  if (transactionType === 'purchase') {
    valueUsed = salesPrice > 0 ? Math.min(appraisedValue, salesPrice) : appraisedValue;
  } else {
    valueUsed = appraisedValue;
  }

  const compliance_flags = [];
  const zeroValue = valueUsed <= 0;
  if (zeroValue) compliance_flags.push('LTV_ZERO_VALUE');

  let ltvPct = 0, cltvPct = 0, hcltvPct = 0;
  if (!zeroValue) {
    ltvPct = r2((firstLienAmount / valueUsed) * 100);
    cltvPct = r2(((firstLienAmount + subordinateLienAmount) / valueUsed) * 100);
    hcltvPct = r2(((firstLienAmount + subordinateLienAmount + helocCreditLimit) / valueUsed) * 100);
  }

  const output_payload = {
    ltv_pct: ltvPct,
    cltv_pct: cltvPct,
    hcltv_pct: hcltvPct,
    value_used: r2(valueUsed),
    appraised_value: r2(appraisedValue),
    sales_price: r2(salesPrice),
    first_lien_amount: r2(firstLienAmount),
    subordinate_lien_amount: r2(subordinateLienAmount),
    heloc_credit_limit: r2(helocCreditLimit),
    transaction_type: transactionType,
    regulatory_basis: 'Fannie Mae Selling Guide B2-1.1-03 (LTV, CLTV, HCLTV Ratios); Freddie Mac Single-Family Seller/Servicer Guide 5401.1 (LTV/TLTV/HTLTV ratios)',
    note: 'CLTV includes closed-end subordinate financing at the drawn balance. HCLTV includes the full HELOC credit limit whether or not fully drawn, per B2-1.1-03. Value used is the lesser of appraised value and sales price for purchases; appraised value only for refinances. Not check_agency_eligibility_matrix (art-222), which consumes these ratios as inputs to its own LTV/CLTV/HCLTV eligibility checks.',
  };

  return { output_payload, compliance_flags };
}

// --- Inlined pure-JS SHA-256 (no crypto.subtle, no TextEncoder) ---
//
// MEASURED, 2026-07-25 (S18-ART336-FIX-1): a dynamic `import('./_hash.mjs')` inside
// buildArtifact() -- host-only, never reached by the guest's compute() -- links and
// executes fine against the pinned runq-gpu guest (IMAGE_ID sha256:a1a0bc89...). But
// the local VM-parity sandbox (SPEC.md §24, chaingraph/kernels/vm-parity-gate.mjs)
// replays buildArtifact() itself inside the same QuickJS-ng eager-linking runtime and
// rejects the dynamic import ("could not load module '_hash.mjs'"), so the shape this
// row preferred does not clear preflight. Falling back to S18-ART476-FIX-2's inlined
// pattern (art-210/art-194/cry-04 lineage): the hash core lives in the kernel itself,
// synchronous, so no import of any kind is needed at the point policy_parameters_hash
// is computed. Pinned by a self-check vector, verified against _hash.mjs's own cgCanon.
//
// _jcsDigest(x) is byte-for-byte policyParametersHash(x):
//   hex(sha256(utf8(JSON.stringify(cgCanon(x))))), with the same I-JSON assertion.
// The digest VALUE is therefore unchanged from the WebCrypto path.

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

// Same I-JSON guard _hash.mjs applies before canonicalizing, inlined so nothing here
// ever links a binding it may not export. Behaviour is identical: fail loud rather
// than emit an unstable hash (RFC 8785 3.2.2.3 / RFC 7493).
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

// Guest-side transcription of _hash.mjs cgCanon (OCG Standard 6 / RFC 8785): recursively
// sort object keys by Unicode code point, preserve array order, leave scalars alone.
// Byte-parity with the imported cgCanon is asserted over every fixture by
// golden-parity/kernel-contract; divergence changes execution_hash and fails loudly.
const _cgCanon = (v) =>
  Array.isArray(v) ? v.map(_cgCanon)
  : (v && typeof v === 'object')
    ? Object.keys(v).sort().reduce((o, k) => (o[k] = _cgCanon(v[k]), o), {})
    : v;

// JCS-SHA-256 over the value alone -- identical output to _hash.mjs policyParametersHash,
// but synchronous and WebCrypto-free so it runs unchanged in the zkVM guest / VM sandbox.
function _jcsDigest(value) {
  _assertIJson(value);
  return _toHex(_sha256(_utf8Bytes(JSON.stringify(_cgCanon(value)))));
}

// STOP conditions. Both MUST pass or this kernel throws and emits no digest.
// KNOWN_VECTOR_ASCII pins the SHA-256 core. KNOWN_VECTOR_UTF8 pins _utf8Bytes against
// host TextEncoder byte-for-byte: the fixtures are pure ASCII and cannot catch a
// multi-byte divergence, so a non-ASCII vector is pinned explicitly. It covers 2-byte
// (e-acute), 3-byte (euro, CJK) and 4-byte surrogate-pair (emoji) encodings.
const KNOWN_VECTOR_ASCII = 'hello world';
const KNOWN_VECTOR_ASCII_SHA = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';
const KNOWN_VECTOR_UTF8 = 'é€中🌍';
const KNOWN_VECTOR_UTF8_BYTES = 'c3a9e282ace4b8adf09f8c8d';
const KNOWN_VECTOR_UTF8_SHA = 'a0ce5afdae3fe5735aafeb2e6e0fc183133f3c47776e74fc85aedcc0cf7f1b6a';
// Derived from _hash.mjs cgCanon itself, not hand-written.
const KNOWN_VECTOR_CANON = '{"A":"z","a":{"c":null,"d":[3,1,2]},"b":1}';
(function _selfCheck() {
  const a = _toHex(_sha256(_utf8Bytes(KNOWN_VECTOR_ASCII)));
  if (a !== KNOWN_VECTOR_ASCII_SHA) {
    throw new Error('art-336 SHA-256 self-check FAILED: got ' + a + ' expected ' + KNOWN_VECTOR_ASCII_SHA);
  }
  const encoded = _toHex(_utf8Bytes(KNOWN_VECTOR_UTF8));
  if (encoded !== KNOWN_VECTOR_UTF8_BYTES) {
    throw new Error('art-336 UTF-8 encoder self-check FAILED: got ' + encoded + ' expected ' + KNOWN_VECTOR_UTF8_BYTES);
  }
  const u = _toHex(_sha256(_utf8Bytes(KNOWN_VECTOR_UTF8)));
  if (u !== KNOWN_VECTOR_UTF8_SHA) {
    throw new Error('art-336 non-ASCII digest self-check FAILED: got ' + u + ' expected ' + KNOWN_VECTOR_UTF8_SHA);
  }
  // Canonicalizer pin: keys sorted by code point at every depth, array order preserved.
  const canon = JSON.stringify(_cgCanon({ b: 1, a: { d: [3, 1, 2], c: null }, 'A': 'z' }));
  if (canon !== KNOWN_VECTOR_CANON) {
    throw new Error('art-336 cgCanon self-check FAILED: got ' + canon + ' expected ' + KNOWN_VECTOR_CANON);
  }
})();

// OCG Standard §PPH-1 reference emitter (PPH1-CODE-1): this is the ONE kernel wired to emit
// policy_parameters_hash, demonstrating the shared hash path end to end. Computed from `pp`
// alone and never passed to executionHash(), so it cannot reach the §4 preimage — execution_hash
// stays byte-identical to every other kernel's (and to this kernel's own pinned goldens).
export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  const policy_parameters_hash = _jcsDigest(pp);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    policy_parameters_hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
