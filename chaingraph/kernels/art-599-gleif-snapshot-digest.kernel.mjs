import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-599-gleif-snapshot-digest';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'digest_gleif_snapshot',
  mandate_type: 'cryptographic_mandate', gpu: false,
};

// Hash-pins a pasted GLEIF Golden Copy record (or file segment) as of a caller-stated capture
// time, so a later reader can tell whether the entity data in front of them is the same data a
// pack was built from. It does NOT assert the record is still current, and there is no recurring
// duty attached: one pin per invocation, no scheduler, no freshness promise.
//
// The digest is taken over the RAW pasted bytes -- never a parsed, trimmed, case-folded or
// re-serialized form. Normalization is where hand-rolled bugs hide, and a digest over a
// normalized form cannot be reproduced by anyone holding the original file.
//
// LEI reference data is PUBLIC registry data (GLEIF, gleif.org) -- no PII.
// Zero network: the Golden Copy URL below is NAMED for the reader, never fetched.

const SOURCE_URL = 'https://www.gleif.org/en/lei-data/gleif-golden-copy/download-the-golden-copy';
const LICENCE = 'CC0 1.0 Universal -- GLEIF Open Data (confirmed: gleif.org/en/meta/lei-data-terms-of-use)';
const VERIFICATION_PATH = 'Compare source_sha256 against a fresh GLEIF Golden Copy download for the same as-of date. GLEIF publishes three golden-copy sets plus four delta files daily, so re-derive the digest from the file itself rather than trusting this record.';
const SCOPE_NOTE = 'This records that these exact bytes were pinned at the stated capture time. It is not a statement that the record is still current, not a validation of the entity data, and carries no ongoing monitoring duty.';

// --- ISO 17442 LEI check-digit validation ------------------------------------------------------
// Reused verbatim from art-246-lei-payment-binding-linter (ISO 7064 Mod 97-10). Kernels are
// self-contained by construction (the zkVM guest has no module graph beyond _hash.mjs), so reuse
// here means the identical proven implementation, not a second algorithm. Do not re-derive it.
function charToDigits(c) {
  const code = c.charCodeAt(0);
  if (code >= 48 && code <= 57) return c;                 // '0'..'9'
  if (code >= 65 && code <= 90) return String(code - 55); // 'A'=10..'Z'=35
  return '';
}
function mod97(numStr) {
  let remainder = 0;
  for (let i = 0; i < numStr.length; i++) {
    remainder = (remainder * 10 + Number(numStr[i])) % 97;
  }
  return remainder;
}
function validateLEI(lei) {
  const clean = String(lei || '').trim().toUpperCase();
  if (clean.length === 0) return { valid: null, error: 'Not provided' };
  if (!/^[A-Z0-9]{20}$/.test(clean)) return { valid: false, error: 'LEI must be exactly 20 alphanumeric characters (ISO 17442 format). Got ' + clean.length + ' chars.' };
  const rem = mod97(clean.split('').map(charToDigits).join(''));
  if (rem !== 1) return { valid: false, error: 'ISO 17442 mod-97 check failed (remainder ' + rem + ', expected 1). LEI has invalid check digits.' };
  return { valid: true, error: null };
}

// --- Pure-JS SHA-256 (sync) --------------------------------------------------------------------
// Byte-identical to WebCrypto; inlined so compute() stays SYNCHRONOUS and runs in the zkVM guest,
// which has no crypto.subtle and no TextEncoder (the art-476 FIX-2 lesson: narrowing the import is
// not enough, inline it). Same _sha256 core proven live under ImageID a1a0bc89. _utf8Bytes
// reproduces WebCrypto's UTF-8 byte stream including surrogate pairs, so the hashed bytes match.
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

// LastUpdateDate is read ONLY from the unambiguous CDF XML element form. A Golden Copy CSV row
// carries the same value in a positional column, and guessing which column it is from a pasted
// fragment (with no header, quoted commas, and locale-dependent ordering) is exactly the kind of
// hand-rolled parse this tool refuses to do. For CSV input the caller states the value instead,
// and the output records WHICH of the two it came from.
function extractLastUpdateDate(text) {
  const m = String(text).match(/<(?:[A-Za-z0-9_.-]+:)?LastUpdateDate>\s*([^<]+?)\s*<\/(?:[A-Za-z0-9_.-]+:)?LastUpdateDate>/);
  return m ? m[1] : null;
}

const str = (v) => (typeof v === 'string' ? v : '');

export function compute(pp) {
  pp = pp || {};

  // NOTE: source_text is used EXACTLY as given. No trim, no case fold, no re-serialization --
  // the digest must be reproducible by anyone holding the same bytes.
  const source_text = str(pp.source_text);
  const lei = str(pp.lei).trim().toUpperCase();
  const captured_at = str(pp.captured_at).trim() || null;
  const source_format = ['xml', 'csv', 'other'].indexOf(str(pp.source_format).trim().toLowerCase()) >= 0
    ? str(pp.source_format).trim().toLowerCase() : 'other';
  const golden_copy_as_of = str(pp.golden_copy_as_of).trim() || null;
  const caller_last_update_date = str(pp.last_update_date).trim() || null;

  const leiCheck = validateLEI(lei);

  const extracted = extractLastUpdateDate(source_text);
  const last_update_date = extracted !== null ? extracted : caller_last_update_date;
  const last_update_date_source = extracted !== null ? 'record_xml'
    : (caller_last_update_date ? 'caller_supplied' : null);

  const has_bytes = source_text.length > 0;
  const source_sha256 = has_bytes ? sha256Hex(source_text) : null;
  const source_bytes = has_bytes ? _utf8Bytes(source_text).length : 0;

  const output_payload = {
    lei: lei.length > 0 ? lei : null,
    lei_checksum_valid: leiCheck.valid,
    lei_checksum_note: leiCheck.error,
    last_update_date,
    last_update_date_source,
    last_update_date_found: last_update_date !== null,
    source_sha256,
    source_bytes,
    source_format,
    golden_copy_as_of,
    captured_at,
    snapshot_captured: has_bytes,
    source_url: SOURCE_URL,
    licence: LICENCE,
    verification_path: VERIFICATION_PATH,
    scope_note: SCOPE_NOTE,
    pii_note: 'LEI reference data is PUBLIC registry data (GLEIF, gleif.org). This tool hashes the pasted bytes and reads no field other than LastUpdateDate. No PII processed -- use synthetic or public registry data only.',
  };

  const compliance_flags = [];
  if (has_bytes) compliance_flags.push('GLEIF_SNAPSHOT_CAPTURED');
  if (leiCheck.valid === false) compliance_flags.push('GLEIF_LEI_CHECKSUM_INVALID');

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
