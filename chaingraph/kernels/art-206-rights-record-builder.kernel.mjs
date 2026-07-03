import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-206-rights-record-builder';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'build_rights_record',
  mandate_type: 'compliance_mandate', gpu: false,
};

// IP3-style normalized rights-portfolio row builder.
// Produces a canonical rights record (licensor / licensee / territory / term /
// rights-vector / renewal) with a deterministic record_hash over the JCS-canonical row.
// record_hash = SHA-256 over JSON.stringify(JCS-canonical(rights_row)).
//
// Pure-JS SHA-256 inlined (no crypto.subtle — zkVM guest has no WebCrypto).
// Byte-identical to the WebCrypto output for the ASCII/UTF-8 subset used here
// (proven in art-200 / art-199 which use the same implementation).
// _utf8Bytes reproduces the WebCrypto TextEncoder.encode UTF-8 byte stream.

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
  const r = new Uint8Array(32);
  [h0,h1,h2,h3,h4,h5,h6,h7].forEach(function(v,i){ const j=i*4; r[j]=v>>>24; r[j+1]=(v>>>16)&0xff; r[j+2]=(v>>>8)&0xff; r[j+3]=v&0xff; });
  return r;
}

function sha256Hex(str) {
  const bytes = _sha256(_utf8Bytes(String(str)));
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

const _cgCanon = function(v) {
  if (Array.isArray(v)) return v.map(_cgCanon);
  if (v && typeof v === 'object') {
    const keys = Object.keys(v).sort();
    const o = {};
    for (let i = 0; i < keys.length; i++) o[keys[i]] = _cgCanon(v[keys[i]]);
    return o;
  }
  return v;
};

// Canonical rights vector fields (IP3-normalized)
const RIGHTS_VECTOR_FIELDS = ['copy', 'display', 'commercial', 'exclusive', 'modify', 'sublicense', 'share_alike', 'attribution', 'revocable'];

function toBool(v) {
  if (v === true || v === 1 || v === '1' || v === 'true') return true;
  if (v === false || v === 0 || v === '0' || v === 'false') return false;
  return false;
}

function sanitizeStr(v) {
  if (typeof v !== 'string') return '';
  return v.trim();
}

export function compute(pp) {
  pp = pp || {};

  const licensor   = sanitizeStr(pp.licensor);
  const licensee   = sanitizeStr(pp.licensee);
  const territory  = sanitizeStr(pp.territory)  || 'Worldwide';
  const term_years = typeof pp.term_years === 'number' ? pp.term_years : (parseInt(String(pp.term_years || ''), 10) || 0);
  const license_id = sanitizeStr(pp.license_id);
  const asset_ref  = sanitizeStr(pp.asset_ref);

  // Rights vector — each field defaults false
  const rv_input = (pp.rights_vector && typeof pp.rights_vector === 'object' && !Array.isArray(pp.rights_vector))
    ? pp.rights_vector : {};
  const rights_vector = {};
  for (let i = 0; i < RIGHTS_VECTOR_FIELDS.length; i++) {
    const f = RIGHTS_VECTOR_FIELDS[i];
    rights_vector[f] = Object.prototype.hasOwnProperty.call(rv_input, f) ? toBool(rv_input[f]) : false;
  }

  const renewal = typeof pp.renewal === 'string' ? pp.renewal.trim() : (pp.renewal ? String(pp.renewal) : 'none');

  // Build the canonical rights row
  const rights_row = {
    asset_ref:    asset_ref  || null,
    licensor:     licensor   || null,
    licensee:     licensee   || null,
    license_id:   license_id || null,
    territory:    territory,
    term_years:   term_years,
    rights_vector: rights_vector,
    renewal:      renewal,
  };

  // record_hash = SHA-256 over JCS-canonical rights_row
  const record_hash = sha256Hex(JSON.stringify(_cgCanon(rights_row)));

  const checks = [];
  const licensorOk = licensor !== '';
  const licenseeOk = licensee !== '';
  const assetOk    = asset_ref !== '';
  const licenseOk  = license_id !== '';
  const termOk     = term_years > 0;

  checks.push({ check: 'licensor_present', pass: licensorOk, detail: licensorOk ? 'licensor: ' + licensor : 'licensor is empty (empty-input mode)' });
  checks.push({ check: 'licensee_present', pass: licenseeOk, detail: licenseeOk ? 'licensee: ' + licensee : 'licensee is empty (empty-input mode)' });
  checks.push({ check: 'asset_ref_present', pass: assetOk,   detail: assetOk   ? 'asset_ref: ' + asset_ref : 'asset_ref not provided (optional)' });
  checks.push({ check: 'license_id_present', pass: licenseOk, detail: licenseOk ? 'license_id: ' + license_id : 'license_id not provided (optional)' });
  checks.push({ check: 'term_years_positive', pass: termOk,  detail: termOk    ? 'term_years: ' + term_years : 'term_years is 0 or not provided (empty-input mode)' });

  const all_checks_pass = licensorOk && licenseeOk && termOk;

  const output_payload = {
    record_hash: record_hash,
    rights_row: rights_row,
    checks: checks,
    all_checks_pass: all_checks_pass,
    disclaimer: 'Not legal advice. This record documents the stated parameters only. No enforcement, no on-chain registration. Consult a licensed attorney for your jurisdiction.',
  };

  const compliance_flags = {
    RIGHTS_RECORD_BUILT: true,
    RECORD_HASH_COMPUTED: true,
    IP3_NORMALIZED: true,
  };
  if (!all_checks_pass) compliance_flags.RECORD_INCOMPLETE = true;

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
