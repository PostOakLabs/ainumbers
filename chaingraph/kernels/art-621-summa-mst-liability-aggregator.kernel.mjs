import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-621-summa-mst-liability-aggregator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'aggregate_summa_mst_liabilities',
  mandate_type: 'cryptographic_mandate',
  gpu: false,
};

// Hard cap per SUMMA-MST-BUILD-SPEC.md §5b: fixture tree size is a spec-declared bound, not
// user-supplied input. A caller passing more than 16 leaves gets a declared-invalid-input error,
// never a larger tree computed anyway.
const MAX_LEAVES = 16;
const DEFAULT_MAX_BALANCE = 1000000000000000n; // 10^15 base units, overridable via policy_parameters.max_balance

// --- pure sync SHA-256 over bytes, no WebCrypto/crypto.subtle (compute() must stay fully
// synchronous -- RIDER-KERNEL.md's art-476 lesson: a kernel awaiting a crypto digest inside
// compute() fails proving even when everything else is correct). Byte-identical implementation
// to chaingraph/kernels/cry-04-merkle-batch-verifier.kernel.mjs's _sha256, not hand-edited.
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

// Pure-JS UTF-8 encoder, validated byte-identical to TextEncoder.encode (ART595-ART590-UTF8-FIX-1
// -2026-08-13). The zkVM guest does not reliably provide TextEncoder -- GUEST-BUILTIN-GATE-1
// (RIDER-KERNEL.md) requires this inline replacement, never a bare `new TextEncoder()` in compute().
function utf8ToBytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) { code = (code - 0xd800) * 0x400 + (next - 0xdc00) + 0x10000; i++; }
      else code = 0xfffd;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      code = 0xfffd;
    }
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return Uint8Array.from(bytes);
}

function sha256Hex(bytes) { return Array.from(_sha256(bytes)).map(b => b.toString(16).padStart(2, '0')).join(''); }

// This kernel's own declared hash function (SUMMA-MST-BUILD-SPEC.md §2: "must declare its own
// hash function explicitly" -- this is a plain SHA-256 MST, not the Poseidon hash Summa's
// production ZK circuit uses). A one-byte domain tag (0x00 leaf / 0x01 node) prefixes every
// preimage so a leaf hash can never collide with a middle-node hash for the same bytes.
function leafHash(id, balanceStr) {
  const body = utf8ToBytes(id + '|' + balanceStr);
  const tagged = new Uint8Array(body.length + 1); tagged[0] = 0x00; tagged.set(body, 1);
  return sha256Hex(tagged);
}
function nodeHash(sumStr, leftHashHex, rightHashHex) {
  const body = utf8ToBytes(sumStr + '|' + leftHashHex + '|' + rightHashHex);
  const tagged = new Uint8Array(body.length + 1); tagged[0] = 0x01; tagged.set(body, 1);
  return sha256Hex(tagged);
}

const PAD_LEAF_ID = '__SUMMA_MST_PAD__';
const DECIMAL_RE = /^-?\d+$/;

function nextPow2(n) { let p = 1; while (p < n) p *= 2; return p; }

// SUMMA-MST-BUILD-SPEC.md §3, the mandatory mitigation for Maxwell's "broken MST" hazard,
// applied on the INPUT side: reject negative/out-of-range balances before any tree is built, so
// this kernel never becomes the source of an unrange-checked tree that SUMMA-MST-K-1's checker
// would then have to catch.
function validateInput(pp) {
  const rawLeaves = pp.leaves;
  let maxBalance = DEFAULT_MAX_BALANCE;
  if (pp.max_balance !== undefined) {
    if (typeof pp.max_balance !== 'string' || !DECIMAL_RE.test(pp.max_balance) || BigInt(pp.max_balance) <= 0n) {
      return { error: 'invalid_max_balance', error_index: null, maxBalance: DEFAULT_MAX_BALANCE };
    }
    maxBalance = BigInt(pp.max_balance);
  }
  if (!Array.isArray(rawLeaves)) return { error: 'leaves_not_array', error_index: null, maxBalance };
  if (rawLeaves.length < 1) return { error: 'no_leaves', error_index: null, maxBalance };
  if (rawLeaves.length > MAX_LEAVES) return { error: 'too_many_leaves', error_index: null, maxBalance };

  const leaves = [];
  for (let i = 0; i < rawLeaves.length; i++) {
    const l = rawLeaves[i] || {};
    if (typeof l.id !== 'string' || l.id.length < 1 || l.id.length > 128) {
      return { error: 'invalid_leaf_id', error_index: i, maxBalance };
    }
    if (typeof l.balance !== 'string' || !DECIMAL_RE.test(l.balance)) {
      return { error: 'invalid_leaf_balance', error_index: i, maxBalance };
    }
    const balance = BigInt(l.balance);
    if (balance < 0n) return { error: 'negative_balance', error_index: i, maxBalance };
    if (balance > maxBalance) return { error: 'balance_exceeds_max_balance', error_index: i, maxBalance };
    leaves.push({ id: l.id, balance });
  }
  return { error: null, error_index: null, maxBalance, leaves };
}

// Builds the full MST (SUMMA-MST-BUILD-SPEC.md §2: leaf hash=H(id,balance) sum=balance; middle
// hash=H(left.sum+right.sum,left.hash,right.hash) sum=left.sum+right.sum) over `leaves` padded
// with zero-balance sentinel leaves up to the next power of two (depth-4 max at the 16-leaf cap).
// Every level is retained so a per-real-leaf inclusion path (§4 shape) can be read back off it.
function buildTree(leaves) {
  const padded = nextPow2(leaves.length);
  const level0 = [];
  for (let i = 0; i < padded; i++) {
    if (i < leaves.length) {
      const { id, balance } = leaves[i];
      level0.push({ hash: leafHash(id, balance.toString()), sum: balance });
    } else {
      level0.push({ hash: leafHash(PAD_LEAF_ID, '0'), sum: 0n });
    }
  }
  const levels = [level0];
  while (levels[levels.length - 1].length > 1) {
    const cur = levels[levels.length - 1];
    const next = [];
    for (let i = 0; i < cur.length; i += 2) {
      const l = cur[i], r = cur[i + 1];
      const sum = l.sum + r.sum;
      next.push({ hash: nodeHash(sum.toString(), l.hash, r.hash), sum });
    }
    levels.push(next);
  }
  return { levels, padded, depth: levels.length - 1 };
}

function proofFor(levels, leafIndex, rootNode) {
  const path = [];
  let pos = leafIndex;
  for (let L = 0; L < levels.length - 1; L++) {
    const level = levels[L];
    const siblingPos = pos % 2 === 0 ? pos + 1 : pos - 1;
    const sibling = level[siblingPos];
    path.push({ side: pos % 2 === 0 ? 'right' : 'left', sibling_hash: sibling.hash, sibling_sum: sibling.sum.toString() });
    pos = Math.floor(pos / 2);
  }
  return { path, root: { hash: rootNode.hash, sum: rootNode.sum.toString() } };
}

const SCOPE_NOTE = 'This kernel commits to whatever leaf balances it is given. It never claims those balances reflect real reserves. Inclusion and local range-check passing means the emitted proofs are internally consistent, non-negative, and chain to the emitted root; it is not a statement that a reserve is solvent, that the leaf set is complete, or that any identifier corresponds to a real account.';

export function compute(pp) {
  pp = pp || {};
  const v = validateInput(pp);
  const max_balance = v.maxBalance.toString();

  if (v.error) {
    const output_payload = {
      valid: false,
      error: v.error,
      error_index: v.error_index,
      leaf_count: Array.isArray(pp.leaves) ? pp.leaves.length : null,
      max_balance,
      root: null,
      proofs: [],
      verify_note: 'invalid input: no tree was built (reason: ' + v.error + ')',
      scope_note: SCOPE_NOTE,
    };
    return { output_payload, compliance_flags: { SUMMA_MST_AGGREGATION: true, INVALID_INPUT: true, RANGE_CHECK_ENFORCED: true } };
  }

  const { leaves } = v;
  const { levels, padded, depth } = buildTree(leaves);
  const rootNode = levels[levels.length - 1][0];
  const root = { hash: rootNode.hash, sum: rootNode.sum.toString() };

  const proofs = leaves.map((l, i) => {
    const { path } = proofFor(levels, i, rootNode);
    return { leaf: { id: l.id, balance: l.balance.toString() }, path, root };
  });

  const output_payload = {
    valid: true,
    error: null,
    error_index: null,
    leaf_count: leaves.length,
    padded_leaf_count: padded,
    tree_depth: depth,
    max_balance,
    root,
    proofs,
    verify_note: 'tree built; ' + leaves.length + ' inclusion proof(s) generated over a depth-' + depth + ' tree (padded to ' + padded + ' leaves)',
    scope_note: SCOPE_NOTE,
  };

  return { output_payload, compliance_flags: { SUMMA_MST_AGGREGATION: true, RANGE_CHECK_ENFORCED: true } };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.4/context.jsonld',
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
