import { executionHash } from './_hash.mjs';

// art-805-agt-audit-chain-verifier — offline verifier for the open-source
// agent-governance-toolkit audit-log hash chain (MIT), recomputed from the
// exported entries alone. Upstream pinned at commit 3433fa7; snapshots and
// pin note: research/AGT-AUDIT-FORMAT-PIN-2026-10-29.md (workspace).
//
// SUBJECT serialisation (pinned, delta.py lines 54-65):
//   python json.dumps({delta_id, turn_id, session_id, agent_did,
//     timestamp: <iso>, parent_hash: parent_hash or "", changes: [...]},
//     sort_keys=True)
//   — default separators (", " / ": "), ensure_ascii=True, sort_keys on
//   object keys only (list order preserved). NOT RFC 8785. Hash:
//   sha256(serialised.encode('utf-8')).hexdigest(); chain root = LAST link
//   hash (delta.py compute_hash_chain_root), not a Merkle tree. Verification
//   order per upstream verify_chain (delta.py 114-127): per-entry hash
//   recompute, then parent linkage (entry 0 parent must be null).
//
// Our own execution_hash still goes ONLY through chaingraph/kernels/_hash.mjs
// (buildArtifact below). The subject serialiser is never mixed into it.
//
// DETERMINISM: compute() is a PURE function of pp — no Date.now(),
// Math.random(), network, filesystem. Guest-safe: no TextEncoder/atob/btoa/URL.

function utf8ToBytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = (code - 0xd800) * 0x400 + (next - 0xdc00) + 0x10000;
        i++;
      } else {
        code = 0xfffd; // unpaired high surrogate
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      code = 0xfffd; // lone low surrogate
    }
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return Uint8Array.from(bytes);
}

// Pure-JS SHA-256 (same in-kernel pattern as cry-05; QuickJS-ng guest safe).
function _sha256Bytes(bytes) {
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
  for (let i = 0; i < 8; i++) {
    padded[paddedLen - 8 + i] = Number((BigInt(bitLen) >> BigInt(56 - i * 8)) & 0xffn);
  }
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

function _sha256Hex(str) {
  return Array.from(_sha256Bytes(utf8ToBytes(str))).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---- SUBJECT serialiser: Python json.dumps(obj, sort_keys=True) ----
// ensure_ascii=True, default separators (", " / ": "), object keys sorted,
// list order preserved. Covers exactly the pinned schema's value types:
// str, int, null, list, object. Floats and booleans are schema-rejected
// upstream (turn_id is the only number, an int), so the serialiser refuses
// them rather than guessing Python's repr.
function _pyEscape(s) {
  let out = '"';
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (ch === '"') out += '\\"';
    else if (ch === '\\') out += '\\\\';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (ch === '\b') out += '\\b';
    else if (ch === '\f') out += '\\f';
    else if (c < 0x20) out += '\\u' + c.toString(16).padStart(4, '0');
    else if (c < 0x7f) out += ch;
    else if (c <= 0xffff) out += '\\u' + c.toString(16).padStart(4, '0');
    else {
      const v = c - 0x10000;
      const hi = 0xd800 + (v >> 10), lo = 0xdc00 + (v & 0x3ff);
      out += '\\u' + hi.toString(16).padStart(4, '0') + '\\u' + lo.toString(16).padStart(4, '0');
    }
  }
  return out + '"';
}

function pyJsonDumps(obj) {
  if (obj === null) return 'null';
  if (typeof obj === 'string') return _pyEscape(obj);
  if (typeof obj === 'number') {
    if (!Number.isInteger(obj)) throw new Error('pyJsonDumps: non-integer number is outside the pinned schema');
    return String(obj);
  }
  if (Array.isArray(obj)) return '[' + obj.map(pyJsonDumps).join(', ') + ']';
  if (typeof obj === 'object') {
    const keys = Object.keys(obj).sort();
    return '{' + keys.map(k => _pyEscape(k) + ': ' + pyJsonDumps(obj[k])).join(', ') + '}';
  }
  throw new Error('pyJsonDumps: value type outside the pinned schema: ' + typeof obj);
}

// Serialise one entry exactly as delta.py _build_hash_input does
// (delta.py 43-65): fixed key set, parent_hash null coalesced to "".
// Exported so golden fixtures are built by the SAME pinned port compute()
// verifies with — never by a second implementation.
function hashInputFor(e) {
  return pyJsonDumps({
    delta_id: e.delta_id,
    turn_id: e.turn_id,
    session_id: e.session_id,
    agent_did: e.agent_did,
    timestamp: e.timestamp,
    parent_hash: e.parent_hash === null || e.parent_hash === undefined ? '' : e.parent_hash,
    changes: (e.changes || []).map(c => ({
      path: c.path,
      operation: c.operation,
      content_hash: c.content_hash === undefined ? null : c.content_hash,
      previous_hash: c.previous_hash === undefined ? null : c.previous_hash,
      agent_did: c.agent_did === undefined ? null : c.agent_did,
    })),
  });
}

const TOP_KEYS = ['delta_id', 'turn_id', 'session_id', 'agent_did', 'timestamp', 'parent_hash', 'delta_hash', 'changes'];
const CHANGE_KEYS = ['path', 'operation', 'content_hash', 'previous_hash', 'agent_did'];
const HEX64 = /^[0-9a-f]{64}$/;
const ISO_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}:\d{2}|Z)$/;

function isStr(v) { return typeof v === 'string'; }
function isInt(v) { return typeof v === 'number' && Number.isInteger(v); }
function isNull(v) { return v === null; }

// Strict schema validation; fail-closed naming every rejected field.
// Any field outside the pinned schema is refused, so no free-form payload
// can pass and no entry content is ever echoed into the output.
function validateEntries(entries) {
  const rejected = [];
  if (!Array.isArray(entries)) return ['entries'];
  entries.forEach((e, i) => {
    const at = `entries[${i}]`;
    if (e === null || typeof e !== 'object' || Array.isArray(e)) { rejected.push(at); return; }
    for (const k of Object.keys(e)) if (!TOP_KEYS.includes(k)) rejected.push(`${at}.${k}`);
    for (const k of TOP_KEYS) if (!(k in e)) rejected.push(`${at}.${k}(missing)`);
    if ('delta_id' in e && !isStr(e.delta_id)) rejected.push(`${at}.delta_id`);
    if ('turn_id' in e && !isInt(e.turn_id)) rejected.push(`${at}.turn_id`);
    if ('session_id' in e && !isStr(e.session_id)) rejected.push(`${at}.session_id`);
    if ('agent_did' in e && !isStr(e.agent_did)) rejected.push(`${at}.agent_did`);
    if ('timestamp' in e && !(isStr(e.timestamp) && ISO_TS.test(e.timestamp))) rejected.push(`${at}.timestamp`);
    if ('parent_hash' in e && !(isNull(e.parent_hash) || (isStr(e.parent_hash) && HEX64.test(e.parent_hash)))) rejected.push(`${at}.parent_hash`);
    if ('delta_hash' in e && !(isStr(e.delta_hash) && HEX64.test(e.delta_hash))) rejected.push(`${at}.delta_hash`);
    if ('changes' in e) {
      if (!Array.isArray(e.changes)) { rejected.push(`${at}.changes`); return; }
      e.changes.forEach((c, j) => {
        const cat = `${at}.changes[${j}]`;
        if (c === null || typeof c !== 'object' || Array.isArray(c)) { rejected.push(cat); return; }
        for (const k of Object.keys(c)) if (!CHANGE_KEYS.includes(k)) rejected.push(`${cat}.${k}`);
        if ('path' in c && !isStr(c.path)) rejected.push(`${cat}.path`);
        if ('operation' in c && !isStr(c.operation)) rejected.push(`${cat}.operation`);
        for (const k of ['content_hash', 'previous_hash', 'agent_did']) {
          if (k in c && !(isNull(c[k]) || isStr(c[k]))) rejected.push(`${cat}.${k}`);
        }
      });
    }
  });
  return rejected;
}

const TOOL_ID = 'art-805-agt-audit-chain-verifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'verify_agent_governance_audit_chain',
  mandate_type: 'compliance_control', gpu: false,
};

// Pinned subject-format link hash: sha256(pyJsonDumps(hashInputFor(e))).hexdigest().
// Exported for fixture/proptest authoring ONLY — our own execution_hash never
// passes through here (that is _hash.mjs's executionHash, in buildArtifact).
export function subjectHash(e) {
  return _sha256Hex(hashInputFor(e));
}

function baseOutput() {
  return {
    entry_count: 0,
    chain_intact: false,
    first_break_index: null,
    breaks: [],
    recomputed_root: null,
    claimed_root_match: null,
    signature_status: 'no_keyed_signature_field_in_pinned_schema',
    rejected: false,
    rejected_fields: [],
  };
}

/**
 * compute(pp) — pure decision kernel.
 * pp.entries: exported audit entries, values only, as the upstream emits them.
 * pp.claimed_root: optional claimed chain root (hex, optional sha256:/0x prefix).
 */
export function compute(pp) {
  pp = pp || {};
  const out = baseOutput();

  // Fail-closed on anything malformed, naming each rejected field.
  const rejectedFields = [];
  const extraTop = Object.keys(pp).filter(k => k !== 'entries' && k !== 'claimed_root');
  for (const k of extraTop) rejectedFields.push(k);
  if ('claimed_root' in pp && pp.claimed_root !== null && !isStr(pp.claimed_root)) rejectedFields.push('claimed_root');
  const entryRejections = validateEntries(pp.entries);
  for (const r of entryRejections) rejectedFields.push(r);
  if (rejectedFields.length > 0) {
    out.rejected = true;
    out.rejected_fields = rejectedFields;
    out.chain_intact = false;
    out.breaks = [];
    return { output_payload: out, compliance_flags: ['AGT_AUDIT_INPUT_REJECTED_SCHEMA'] };
  }

  const entries = pp.entries;
  out.entry_count = entries.length;

  // Recompute every link hash and check parent linkage, upstream
  // verify_chain order (delta.py 114-127): hash first, then linkage.
  const breaks = [];
  let previousHash = null;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    let recomputed = null;
    try {
      recomputed = _sha256Hex(hashInputFor(e));
    } catch (err) {
      breaks.push({ index: i, reason: 'SERIALISATION_REFUSED' });
      continue;
    }
    if (recomputed !== e.delta_hash) breaks.push({ index: i, reason: 'HASH_MISMATCH' });
    if ((e.parent_hash ?? null) !== previousHash) {
      // upstream message: "Entry {i} chain broken"
      breaks.push({ index: i, reason: 'CHAIN_BROKEN' });
    }
    previousHash = e.delta_hash;
  }

  out.breaks = breaks;
  out.chain_intact = entries.length === 0 || breaks.length === 0; // upstream: empty chain verifies
  out.first_break_index = breaks.length > 0 ? breaks[0].index : null;

  // Root = last link hash (delta.py compute_hash_chain_root), reported from
  // the stored delta_hash values the recomputation just checked.
  if (entries.length > 0) out.recomputed_root = entries[entries.length - 1].delta_hash;

  if ('claimed_root' in pp && isStr(pp.claimed_root)) {
    const stripped = pp.claimed_root.replace(/^(sha256:|0x)/, '').toLowerCase();
    out.claimed_root_match = out.recomputed_root !== null && stripped === out.recomputed_root;
  }

  const flags = [];
  if (out.chain_intact) flags.push('AGT_AUDIT_CHAIN_INTACT');
  else flags.push('AGT_AUDIT_CHAIN_BREAK_DETECTED');
  if (out.claimed_root_match === false) flags.push('AGT_AUDIT_CLAIMED_ROOT_MISMATCH');
  return { output_payload: out, compliance_flags: flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
