import { executionHash } from './_hash.mjs';
// JCS key-sort, inlined so compute() is self-contained in the zkVM guest (the guest's ./_hash.mjs
// stub exports only executionHash, not cgCanon). Byte-identical to _hash.mjs cgCanon -> output-preserving.
const _cgCanon = (v) => Array.isArray(v) ? v.map(_cgCanon) : (v && typeof v === 'object') ? Object.keys(v).sort().reduce((o, k) => (o[k] = _cgCanon(v[k]), o), {}) : v;

const TOOL_ID = 'art-191-conversion-receipt-builder';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'build_conversion_receipt',
  mandate_type: 'cryptographic_mandate', gpu: false,
};

// Binds one file-conversion event into a canonical receipt: input digest ->
// converter identity -> parameters -> output digest. binding_sha256 is SHA-256
// over the JCS-canonical form of the receipt with binding_sha256 removed. This
// binds a TRANSFORMATION EDGE between two digests, which is distinct from
// anchor_document_integrity (art-121, existence + timestamp of ONE document) and
// from verify_merkle_batch (cry-04, Merkle proofs). Any external converter,
// including the heavy WASM Conversion Lab tools, can feed it digests. It is also
// the documented hand-off point for BrowserChain anchoring. Zero network, zero PII.

const HEX64 = /^[0-9a-f]{64}$/;
const PII_KEYS = ['name', 'email', 'address', 'phone', 'ssn', 'dob'];

// Names only, never paths: strip everything up to the last / or \.
function basename(v) {
  const s = String(v || '');
  const cut = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
  return cut >= 0 ? s.slice(cut + 1) : s;
}

// Pure-JS SHA-256 (sync). Byte-identical to WebCrypto (verified vs NIST vectors + every fixture),
// but runs in the zkVM guest which has no crypto.subtle and no TextEncoder. The _sha256 core is the
// same one proven live in cry-04/cry-05/ml-01/ml-03 under ImageID a1a0bc89; the swap is output-preserving
// so execution_hash is unchanged (OCG SPEC Sec 18.5 deterministic guest-equivalent). _utf8Bytes reproduces
// WebCrypto's UTF-8 byte stream (incl. surrogate pairs) so the hashed bytes are identical.
function _utf8Bytes(str) {
  const s = String(str), out = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c >= 0xd800 && c <= 0xdbff) {
      const c2 = s.charCodeAt(++i);
      const cp = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
      out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
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
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ]);
  const msgLen = bytes.length;
  const paddedLen = Math.ceil((msgLen + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[msgLen] = 0x80;
  const bitLen = msgLen * 8;
  for (let i = 0; i < 8; i++) padded[paddedLen - 8 + i] = Number((BigInt(bitLen) >> BigInt(56 - i * 8)) & 0xffn);
  let [h0,h1,h2,h3,h4,h5,h6,h7] = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const rotr = (x,n) => (x>>>n)|(x<<(32-n));
  for (let cs = 0; cs < paddedLen; cs += 64) {
    const W = new Uint32Array(64);
    for (let i = 0; i < 16; i++) { const j=cs+i*4; W[i]=(padded[j]<<24)|(padded[j+1]<<16)|(padded[j+2]<<8)|padded[j+3]; }
    for (let i = 16; i < 64; i++) {
      const s0=rotr(W[i-15],7)^rotr(W[i-15],18)^(W[i-15]>>>3);
      const s1=rotr(W[i-2],17)^rotr(W[i-2],19)^(W[i-2]>>>10);
      W[i]=(W[i-16]+s0+W[i-7]+s1)>>>0;
    }
    let [a,b,c,d,e,f,g,h]=[h0,h1,h2,h3,h4,h5,h6,h7];
    for (let i = 0; i < 64; i++) {
      const S1=rotr(e,6)^rotr(e,11)^rotr(e,25), ch=(e&f)^(~e&g);
      const t1=(h+S1+ch+K[i]+W[i])>>>0;
      const S0=rotr(a,2)^rotr(a,13)^rotr(a,22), maj=(a&b)^(a&c)^(b&c);
      const t2=(S0+maj)>>>0;
      h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
    }
    h0=(h0+a)>>>0;h1=(h1+b)>>>0;h2=(h2+c)>>>0;h3=(h3+d)>>>0;
    h4=(h4+e)>>>0;h5=(h5+f)>>>0;h6=(h6+g)>>>0;h7=(h7+h)>>>0;
  }
  const r=new Uint8Array(32);
  [h0,h1,h2,h3,h4,h5,h6,h7].forEach((v,i)=>{const j=i*4;r[j]=v>>>24;r[j+1]=(v>>>16)&0xff;r[j+2]=(v>>>8)&0xff;r[j+3]=v&0xff;});
  return r;
}
function sha256Hex(str) {
  return Array.from(_sha256(_utf8Bytes(String(str)))).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function compute(pp) {
  const input_sha256 = String(pp?.input_sha256 || '').trim().toLowerCase();
  const output_sha256 = String(pp?.output_sha256 || '').trim().toLowerCase();
  const source_format = typeof pp?.source_format === 'string' ? pp.source_format : '';
  const target_format = typeof pp?.target_format === 'string' ? pp.target_format : '';
  const converterIn = (pp && typeof pp.converter === 'object' && pp.converter) ? pp.converter : {};
  const parameters = (pp && typeof pp.parameters === 'object' && pp.parameters && !Array.isArray(pp.parameters))
    ? pp.parameters : {};

  const converter = { name: String(converterIn.name || ''), version: String(converterIn.version || '') };
  if (typeof converterIn.engine_sha256 === 'string' && HEX64.test(converterIn.engine_sha256.toLowerCase())) {
    converter.engine_sha256 = converterIn.engine_sha256.toLowerCase();
  }
  if (typeof converterIn.url === 'string' && converterIn.url) converter.url = converterIn.url;

  const checks = [];
  const push = (check, pass, detail) => checks.push({ check, pass, detail });

  push('input_sha256_is_64_hex', HEX64.test(input_sha256),
    HEX64.test(input_sha256) ? 'valid' : 'input_sha256 is not a 64-character lowercase hex digest');
  push('output_sha256_is_64_hex', HEX64.test(output_sha256),
    HEX64.test(output_sha256) ? 'valid' : 'output_sha256 is not a 64-character lowercase hex digest');

  const identityComplete = converter.name !== '' && converter.version !== '';
  push('converter_identity_complete', identityComplete,
    identityComplete ? 'name and version present' : 'converter name and/or version missing');

  const selfConversion = HEX64.test(input_sha256) && input_sha256 === output_sha256;
  push('not_self_conversion', !selfConversion,
    selfConversion ? 'input and output digests are identical (self-conversion)' : 'input and output digests differ');

  // PII-carrier keys at the top level of parameters -> warning, never silent.
  const piiHits = Object.keys(parameters).filter((k) => PII_KEYS.includes(k.toLowerCase()));
  push('parameters_free_of_pii_keys', piiHits.length === 0,
    piiHits.length ? `parameter key(s) look like PII carriers: ${piiHits.join(', ')}` : 'no PII-carrier keys detected');

  const input = { sha256: input_sha256, format: source_format };
  if (pp?.input_filename) input.filename = basename(pp.input_filename);
  const output = { sha256: output_sha256, format: target_format };
  if (pp?.output_filename) output.filename = basename(pp.output_filename);

  const receiptCore = {
    receipt_version: '1.0',
    input, output, converter, parameters,
  };
  // binding_sha256 = SHA-256 over the JCS-canonical form of the receipt minus itself.
  const binding_sha256 = sha256Hex(JSON.stringify(_cgCanon(receiptCore)));
  const receipt = { ...receiptCore, binding_sha256 };

  const all_checks_pass = checks.every((c) => c.pass);
  const compliance_flags = { CONVERSION_RECEIPT_BUILT: true };
  compliance_flags[all_checks_pass ? 'RECEIPT_CHECKS_PASS' : 'RECEIPT_CHECKS_HAVE_WARNINGS'] = true;
  if (selfConversion) compliance_flags.SELF_CONVERSION_FLAGGED = true;
  if (piiHits.length) compliance_flags.PII_CARRIER_KEYS_FLAGGED = true;

  return {
    output_payload: { receipt, checks, all_checks_pass },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = await compute(pp);
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
