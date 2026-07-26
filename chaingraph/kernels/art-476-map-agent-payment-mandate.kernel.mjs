import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-476-map-agent-payment-mandate';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'map_agent_payment_mandate',
  mandate_type: 'compliance_control',
  gpu: false,
};

// AGENTPAY-INTEROP-BUILD-SPEC §AI-2: cross-protocol translation receipt.
// Verify/translate-only -- this kernel moves no value and settles nothing. It re-expresses a
// payment mandate declared under one agentic-payment protocol (AP2 / x402 / ACP) in the field
// vocabulary of another, pivoting through one internal canonical schema so every protocol pair
// needs only one mapping direction in and one out (a "rosetta row"), not N^2 pairwise tables.
// Field-name sourcing: AP2 fields verified against art-01/art-62 (AP2 v0.2 mandate-chain
// validator + payment-receipt verifier, both live). x402 fields verified against art-26 (x402
// payload decoder). ACP's public checkout-session schema was NOT independently confirmed at
// build time (2026-07-24) -- its profile is marked DRAFT-GENERIC per the same disclosure
// discipline as art-288's ISO-20022-to-EVM binding table; re-verify before any conformance claim.

const ALL_CANONICAL_FIELDS = [
  'mandate_id', 'payer_ref', 'payee_ref', 'amount', 'currency',
  'max_amount', 'issued_at', 'expires_at', 'human_not_present', 'purpose',
];

const MAPPING_TABLE_VERSION = 'AI2-MAP-V1-2026-07-24';

// --- Inlined pure-JS SHA-256 (no crypto.subtle, no TextEncoder) ---
//
// crypto.subtle and TextEncoder are BANNED in the zkVM guest. This kernel needs a
// digest INSIDE compute(), so the hash core is inlined here -- the same shape proven
// in art-210/art-194/cry-04.
//
// MEASURED, 2026-07-25 (S18-ART476-FIX-2): the runq-gpu guest _hash.mjs stub
// (IMAGE_ID sha256:a1a0bc89...) exports ONLY executionHash. Two probe kernels settled it --
// importing { executionHash } links and returns a real journal; adding cgCanon fails
// eagerly at link time with ocg_run code -3 / msg "undefined", exactly as
// policyParametersHash did. ES-module linking validates named bindings before compute()
// runs, so ANY extra named import from _hash.mjs is fatal here regardless of use.
// (art-413/414/415 do import cgCanon, but they execute under the separate runq_privin
// binary and its guest image -- that is not evidence about this one.)
// The canonicalizer is therefore inlined too, pinned by a self-check vector below and
// verified host-side against _hash.mjs cgCanon over every fixture: same key-sort,
// same array-order preservation, same JSON.stringify. Not a second canon -- a
// guest-side transcription of the one canon, held to it by test.
//
// _jcsDigest(x) is byte-for-byte policyParametersHash(x):
//   hex(sha256(utf8(JSON.stringify(cgCanon(x))))), with the same I-JSON assertion.
// The digest VALUES are therefore unchanged from the WebCrypto path -- fixtures,
// golden hashes and execution_hash all stay identical.

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

// Same I-JSON guard _hash.mjs applies before canonicalizing, inlined so the guest
// never links a binding it may not export. Behaviour is identical: fail loud rather
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
// but synchronous and WebCrypto-free so it can run inside the zkVM guest.
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
    throw new Error('art-476 SHA-256 self-check FAILED: got ' + a + ' expected ' + KNOWN_VECTOR_ASCII_SHA);
  }
  const encoded = _toHex(_utf8Bytes(KNOWN_VECTOR_UTF8));
  if (encoded !== KNOWN_VECTOR_UTF8_BYTES) {
    throw new Error('art-476 UTF-8 encoder self-check FAILED: got ' + encoded + ' expected ' + KNOWN_VECTOR_UTF8_BYTES);
  }
  const u = _toHex(_sha256(_utf8Bytes(KNOWN_VECTOR_UTF8)));
  if (u !== KNOWN_VECTOR_UTF8_SHA) {
    throw new Error('art-476 non-ASCII digest self-check FAILED: got ' + u + ' expected ' + KNOWN_VECTOR_UTF8_SHA);
  }
  // Canonicalizer pin: keys sorted by code point at every depth, array order preserved.
  const canon = JSON.stringify(_cgCanon({ b: 1, a: { d: [3, 1, 2], c: null }, 'A': 'z' }));
  if (canon !== KNOWN_VECTOR_CANON) {
    throw new Error('art-476 cgCanon self-check FAILED: got ' + canon + ' expected ' + KNOWN_VECTOR_CANON);
  }
})();

function n(v) { return v === undefined ? null : v; }

const PROTOCOL_PROFILES = {
  ap2: {
    protocol_version: 'AP2 v0.2 (per art-01/art-62 field usage, live 2026-07-18)',
    // AP2 payment mandate -> canonical pivot.
    to_canonical(m) {
      const scope = (m.scope && typeof m.scope === 'object') ? m.scope : {};
      return {
        mandate_id: n(m.mandate_id),
        payer_ref: null, // AP2 payment mandates do not carry an explicit payer identifier field.
        payee_ref: n(m.merchant_id),
        amount: n(m.amount),
        currency: n(m.currency),
        max_amount: n(scope.max_amount),
        issued_at: n(m.issued_at),
        expires_at: n(m.expires_at),
        human_not_present: (m.human_not_present === true || m.human_not_present === false) ? m.human_not_present : null,
        purpose: Array.isArray(scope.merchant_ids) ? scope.merchant_ids.join(',') : null,
      };
    },
    // canonical pivot -> AP2 payment mandate.
    from_canonical(c) {
      return {
        mandate_id: c.mandate_id,
        mandate_type: 'payment',
        merchant_id: c.payee_ref,
        amount: c.amount,
        currency: c.currency,
        issued_at: c.issued_at,
        expires_at: c.expires_at,
        human_not_present: c.human_not_present,
        scope: { max_amount: c.max_amount },
      };
    },
    required_canonical_fields: ['mandate_id', 'amount', 'currency', 'issued_at', 'expires_at'],
    // Canonical fields this protocol's schema can actually carry (matches from_canonical above).
    supported_canonical_fields: ['mandate_id', 'payee_ref', 'amount', 'currency', 'max_amount', 'issued_at', 'expires_at', 'human_not_present'],
  },
  x402: {
    protocol_version: 'x402 (Coinbase, scheme=exact; per art-26 field usage, live 2026-07-18)',
    // x402 PaymentPayload (scheme:exact) -> canonical pivot.
    to_canonical(m) {
      const auth = (m.payload && m.payload.authorization && typeof m.payload.authorization === 'object') ? m.payload.authorization : {};
      return {
        mandate_id: n(auth.nonce),
        payer_ref: n(auth.from),
        payee_ref: n(auth.to !== undefined ? auth.to : m.payTo),
        amount: n(auth.value !== undefined ? auth.value : m.maxAmountRequired),
        currency: n(m.asset),
        max_amount: n(m.maxAmountRequired),
        issued_at: n(auth.validAfter),
        expires_at: n(auth.validBefore),
        human_not_present: null, // x402 carries no human-presence flag.
        purpose: n(m.resource),
      };
    },
    // canonical pivot -> x402 PaymentPayload (scheme:exact).
    from_canonical(c) {
      return {
        x402Version: 1,
        scheme: 'exact',
        maxAmountRequired: c.max_amount !== null ? c.max_amount : c.amount,
        resource: c.purpose,
        payTo: c.payee_ref,
        asset: c.currency,
        payload: {
          authorization: {
            from: c.payer_ref,
            to: c.payee_ref,
            value: c.amount,
            validAfter: c.issued_at,
            validBefore: c.expires_at,
            nonce: c.mandate_id,
          },
        },
      };
    },
    required_canonical_fields: ['payer_ref', 'payee_ref', 'amount', 'expires_at'],
    supported_canonical_fields: ['mandate_id', 'payer_ref', 'payee_ref', 'amount', 'currency', 'max_amount', 'issued_at', 'expires_at', 'purpose'],
  },
  acp: {
    // DRAFT-GENERIC: ACP's public checkout-session field shape was not independently confirmed
    // at build time -- this is a draft generic profile, not a claim of ACP spec conformance.
    protocol_version: 'ACP DRAFT-GENERIC-2026-07-24 (unconfirmed public schema; re-verify before conformance claims)',
    to_canonical(m) {
      return {
        mandate_id: n(m.checkout_session_id),
        payer_ref: n(m.buyer_id),
        payee_ref: n(m.merchant_id),
        amount: n(m.total_amount),
        currency: n(m.currency),
        max_amount: null,
        issued_at: n(m.created_at),
        expires_at: n(m.expires_at),
        human_not_present: null,
        purpose: n(m.line_item_summary),
      };
    },
    from_canonical(c) {
      return {
        checkout_session_id: c.mandate_id,
        buyer_id: c.payer_ref,
        merchant_id: c.payee_ref,
        total_amount: c.amount,
        currency: c.currency,
        created_at: c.issued_at,
        expires_at: c.expires_at,
      };
    },
    required_canonical_fields: ['mandate_id', 'amount', 'currency'],
    supported_canonical_fields: ['mandate_id', 'payer_ref', 'payee_ref', 'amount', 'currency', 'issued_at', 'expires_at'],
  },
};

const VALID_PROTOCOLS = Object.keys(PROTOCOL_PROFILES);

// Pure structural transform: source-protocol mandate -> canonical pivot -> target-protocol mandate.
// Digests (source_digest/target_digest) use the same JCS-SHA-256 canonicalization as every other
// kernel's execution_hash -- cgCanon from _hash.mjs, never an ad-hoc canonicalization. The hash
// core is the inlined pure-JS SHA-256 above rather than crypto.subtle, so compute() is fully
// synchronous and runs unchanged in the zkVM guest. Digest values are unaffected.
export function compute(pp) {
  pp = (pp !== null && typeof pp === 'object') ? pp : {};
  const sourceProtocol = pp.source_protocol;
  const targetProtocol = pp.target_protocol;
  const sourceMandate = (pp.source_mandate !== null && typeof pp.source_mandate === 'object') ? pp.source_mandate : {};

  if (!VALID_PROTOCOLS.includes(sourceProtocol) || !VALID_PROTOCOLS.includes(targetProtocol)) {
    return {
      output_payload: {
        error: 'unknown_protocol',
        detail: `source_protocol and target_protocol must each be one of ${VALID_PROTOCOLS.join(', ')}.`,
        source_protocol: sourceProtocol,
        target_protocol: targetProtocol,
      },
      compliance_flags: ['MAPPING_REJECTED'],
    };
  }
  if (sourceProtocol === targetProtocol) {
    return {
      output_payload: {
        error: 'same_protocol_mapping',
        detail: 'source_protocol and target_protocol are the same protocol -- no translation to perform.',
        source_protocol: sourceProtocol,
        target_protocol: targetProtocol,
      },
      compliance_flags: ['MAPPING_REJECTED'],
    };
  }

  const source = PROTOCOL_PROFILES[sourceProtocol];
  const target = PROTOCOL_PROFILES[targetProtocol];

  const canonical_pivot = source.to_canonical(sourceMandate);
  const translated_mandate = target.from_canonical(canonical_pivot);

  const missing_required_target_fields = target.required_canonical_fields.filter((f) => canonical_pivot[f] === null || canonical_pivot[f] === undefined);
  const lossy_fields = ALL_CANONICAL_FIELDS.filter((f) => canonical_pivot[f] !== null && canonical_pivot[f] !== undefined && !target.supported_canonical_fields.includes(f));
  const mapping_ok = missing_required_target_fields.length === 0;

  const source_digest = _jcsDigest(sourceMandate);
  const target_digest = _jcsDigest(translated_mandate);

  const output_payload = {
    source_protocol: sourceProtocol,
    target_protocol: targetProtocol,
    mapping_table_version: MAPPING_TABLE_VERSION,
    protocol_versions: { [sourceProtocol]: source.protocol_version, [targetProtocol]: target.protocol_version },
    canonical_pivot,
    translated_mandate,
    mapping_receipt: {
      source_digest,
      target_digest,
      mapping_table_version: MAPPING_TABLE_VERSION,
      lossy_fields,
    },
    missing_required_target_fields,
    mapping_ok,
  };

  const compliance_flags = [];
  compliance_flags.push(mapping_ok ? 'MAPPING_COMPLETE' : 'MAPPING_INCOMPLETE');
  if (lossy_fields.length > 0) compliance_flags.push('FIELDS_DROPPED_NOT_SILENT');
  if (!mapping_ok) compliance_flags.push('ESCALATION_RAISED');

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
