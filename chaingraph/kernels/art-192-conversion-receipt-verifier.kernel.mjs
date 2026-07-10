import { executionHash } from './_hash.mjs';
// JCS key-sort, inlined so compute() is self-contained in the zkVM guest (the guest's ./_hash.mjs
// stub exports only executionHash, not cgCanon). Byte-identical to _hash.mjs cgCanon -> output-preserving.
const _cgCanon = (v) => Array.isArray(v) ? v.map(_cgCanon) : (v && typeof v === 'object') ? Object.keys(v).sort().reduce((o, k) => (o[k] = _cgCanon(v[k]), o), {}) : v;

const TOOL_ID = 'art-192-conversion-receipt-verifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'verify_conversion_receipt',
  mandate_type: 'cryptographic_mandate', gpu: false,
};

// Re-verifies an art-191 conversion receipt: recomputes binding_sha256 over the
// JCS-canonical receipt (minus binding_sha256) and compares, checks structure and
// hex fields, and optionally compares digests re-hashed from the actual files.
// Distinct from verify_execution_hash (a utility that verifies the §4 artifact
// ENVELOPE); this verifies the domain receipt INSIDE the artifact. Zero network,
// zero PII.

const HEX64 = /^[0-9a-f]{64}$/;

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
  let receipt = pp?.receipt;
  const checks = [];
  const push = (check, pass, detail) => checks.push({ check, pass, detail });

  // Accept either an object or a pasted JSON string.
  if (typeof receipt === 'string') {
    try { receipt = JSON.parse(receipt); }
    catch { receipt = null; }
  }

  const structOk = !!receipt && typeof receipt === 'object' && !Array.isArray(receipt) &&
    receipt.receipt_version === '1.0' &&
    receipt.input && typeof receipt.input === 'object' &&
    receipt.output && typeof receipt.output === 'object' &&
    receipt.converter && typeof receipt.converter === 'object' &&
    typeof receipt.binding_sha256 === 'string';

  push('receipt_structure_and_version', structOk,
    structOk ? 'receipt_version 1.0 with input/output/converter/binding present' : 'missing or malformed receipt structure');

  if (!structOk) {
    return {
      output_payload: { verdict: 'malformed', binding_ok: false, checks },
      compliance_flags: ['CONVERSION_RECEIPT_VERIFIED', 'RECEIPT_MALFORMED'],
    };
  }

  const inHex = String(receipt.input.sha256 || '').toLowerCase();
  const outHex = String(receipt.output.sha256 || '').toLowerCase();
  push('input_sha256_is_64_hex', HEX64.test(inHex),
    HEX64.test(inHex) ? 'valid' : 'input.sha256 is not 64 hex');
  push('output_sha256_is_64_hex', HEX64.test(outHex),
    HEX64.test(outHex) ? 'valid' : 'output.sha256 is not 64 hex');

  const identityComplete = !!receipt.converter.name && !!receipt.converter.version;
  push('converter_identity_complete', identityComplete,
    identityComplete ? 'name and version present' : 'converter name and/or version missing');

  // Recompute the binding over the receipt minus binding_sha256, byte-identical to art-191.
  const { binding_sha256, ...core } = receipt;
  const recomputed = sha256Hex(JSON.stringify(_cgCanon(core)));
  const binding_ok = recomputed === String(binding_sha256).toLowerCase();
  push('binding_sha256_matches', binding_ok,
    binding_ok ? 'recomputed binding equals stored binding' : `recomputed ${recomputed} != stored ${binding_sha256}`);

  // Optional: compare digests re-hashed from the actual files on the page.
  let digest_ok = true;
  const recIn = pp?.recomputed_input_sha256 ? String(pp.recomputed_input_sha256).toLowerCase() : null;
  const recOut = pp?.recomputed_output_sha256 ? String(pp.recomputed_output_sha256).toLowerCase() : null;
  if (recIn !== null) {
    const ok = recIn === inHex;
    digest_ok = digest_ok && ok;
    push('recomputed_input_digest_matches', ok,
      ok ? 'rehashed input matches receipt' : `rehashed input ${recIn} != receipt ${inHex}`);
  }
  if (recOut !== null) {
    const ok = recOut === outHex;
    digest_ok = digest_ok && ok;
    push('recomputed_output_digest_matches', ok,
      ok ? 'rehashed output matches receipt' : `rehashed output ${recOut} != receipt ${outHex}`);
  }

  let verdict;
  if (!binding_ok) verdict = 'binding_mismatch';
  else if (!digest_ok) verdict = 'digest_mismatch';
  else verdict = 'valid';

  const compliance_flags = [];
  compliance_flags.push('CONVERSION_RECEIPT_VERIFIED');
  compliance_flags.push('RECEIPT_' + verdict.toUpperCase());

  return {
    output_payload: { verdict, binding_ok, digest_ok, checks },
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
