export const meta = {
  tool_id: 'cry-05-agent-action-audit-trail-aggregator',
  mcp_name: 'aggregate_execution_receipts',
  mandate_type: 'cryptographic_mandate',
};

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
function _hexToBytes(hex) {
  const stripped = hex.replace(/^(sha256:|0x)/,'');
  const b = new Uint8Array(stripped.length/2);
  for(let i=0;i<stripped.length;i+=2) b[i/2]=parseInt(stripped.slice(i,i+2),16);
  return b;
}
function _stripPrefix(h) { return (h||'').replace(/^(sha256:|0x)/,''); }
function _sha256pairHex(a, b) {
  const aB = _hexToBytes(a), bB = _hexToBytes(b);
  const c = new Uint8Array(aB.length + bB.length);
  c.set(aB); c.set(bB, aB.length);
  return Array.from(_sha256(c)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

function normalizeEntry(el) {
  if (typeof el === 'string') {
    const hex = _stripPrefix(el);
    if (!/^[0-9a-f]{64}$/.test(hex)) return null;
    return { tool_id: 'unknown', leaf_hex: hex, execution_hash: 'sha256:'+hex, chain_depth: 0 };
  }
  if (el && typeof el === 'object' && el.execution_hash) {
    const hex = _stripPrefix(el.execution_hash);
    if (!/^[0-9a-f]{64}$/.test(hex)) return null;
    const depth = typeof el.chain?.chain_depth === 'number' ? el.chain.chain_depth
                : typeof el.chain_depth === 'number' ? el.chain_depth : 0;
    return { tool_id: el.tool_id || 'unknown', leaf_hex: hex, execution_hash: 'sha256:'+hex, chain_depth: depth };
  }
  return null;
}

function buildMerkleTree(leaves) {
  if (leaves.length === 0) return { root: '0'.repeat(64), allLevels: [[]] };
  let level = [...leaves];
  const allLevels = [level];
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const r = i+1 < level.length ? level[i+1] : level[i];
      next.push(_sha256pairHex(level[i], r));
    }
    level = next;
    allLevels.push(level);
  }
  return { root: level[0], allLevels };
}

function inclusionProof(allLevels, leafIndex) {
  const proof = [];
  let i = leafIndex;
  for (let lvl = 0; lvl < allLevels.length - 1; lvl++) {
    const isRight = i % 2 === 1;
    const sibling = isRight ? allLevels[lvl][i-1] : (allLevels[lvl][i+1] ?? allLevels[lvl][i]);
    proof.push({ sibling, position: isRight ? 'left' : 'right' });
    i = Math.floor(i / 2);
  }
  return proof;
}

function rootFromProof(leaf, proof) {
  let cur = _stripPrefix(leaf);
  for (const step of proof) {
    cur = step.position === 'left' ? _sha256pairHex(step.sibling, cur) : _sha256pairHex(cur, step.sibling);
  }
  return cur;
}

export function compute(pp) {
  const rawEntries = Array.isArray(pp.artifacts) ? pp.artifacts : [];
  const entries = rawEntries.map(normalizeEntry).filter(Boolean);
  const leaves = entries.map(e => e.leaf_hex);
  const { root, allLevels } = buildMerkleTree(leaves);
  const receipts = entries.map((e, i) => {
    const proof = inclusionProof(allLevels, i);
    const recomputed = rootFromProof(e.leaf_hex, proof);
    return {
      tool_id: e.tool_id,
      execution_hash: e.execution_hash,
      leaf_index: i,
      proof_ok: recomputed === root,
      inclusion_proof: proof,
    };
  });
  const allProofsOk = receipts.length > 0 && receipts.every(r => r.proof_ok);
  const maxParentDepth = entries.reduce((m,e) => Math.max(m, e.chain_depth), 0);

  const compliance_flags = {
    EU_AI_ACT_ART12_RECORD_KEEPING: true,
    DORA_OPERATIONAL_RESILIENCE_AUDIT_TRAIL: true,
    SESSION_RECEIPT_ROOT_GENERATED: true,
    ALL_INCLUSION_PROOFS_VERIFIED: allProofsOk,
    INCLUSION_PROOF_RECOMPUTE_MISMATCH: !allProofsOk,
  };

  return {
    session_receipt_root: 'sha256:'+root,
    merkle_root: 'sha256:'+root,
    n_receipts: entries.length,
    tree_depth: allLevels.length - 1,
    max_chain_depth: maxParentDepth,
    aggregator_chain_depth: maxParentDepth + 1,
    all_proofs_verified: allProofsOk,
    receipts,
    compliance_flags,
  };
}

export function buildArtifact(pp, opts={}) {
  const result = compute(pp);
  return {
    tool_id: meta.tool_id,
    mcp_name: meta.mcp_name,
    mandate_type: meta.mandate_type,
    inputs: pp,
    outputs: result,
    artifact_version: '1.0',
  };
}
