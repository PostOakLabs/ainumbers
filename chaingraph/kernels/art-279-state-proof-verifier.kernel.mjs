// art-279 — State-Proof Verifier (EIP-1186): pure decision kernel.
// Faithful port of compute() in
//   repo/chaingraph/art-279-state-proof-verifier.html
// Pure: no DOM, no window, no network, no host crypto (keccak-256 is hand-rolled
// pure-JS Keccak-f[1600] — cry-04-class, exec-check-provable per SPEC.md §18.5).
// Verifies an eth_getProof (EIP-1186) account + storage Merkle-Patricia-Trie proof
// against a SUPPLIED trusted state root. Zero egress: every input is a pasted
// artifact (proof bytes + root); this kernel never fetches an RPC endpoint.
// Bounded inputs only (art-201 lesson): proof arrays and node sizes are capped so
// keccak-256 runs over a small, finite, provable amount of data.
//
// VR-1 State-Proof Verifier — THE PRIMITIVE. Clean-room implementation; no code
// copied from @ethereumjs/mpt or any other MPT/RLP/Keccak library.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-279-state-proof-verifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'verify_eth_state_proof',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

// ── bounded-input limits (exec-check-friendly, art-201 lesson) ──────────────────
const MAX_PROOF_NODES = 32;       // trie depth never exceeds ~9 in practice; 32 is a hard ceiling
const MAX_NODE_HEX_LEN = 1200;    // 600 bytes hex — branch nodes top out well under this
const MAX_STORAGE_SLOTS = 8;
const MAX_STORAGE_PROOF_NODES = 16;

// ══════════════════════════════════════════════════════════════════════════════
// keccak-256 — pure-JS Keccak-f[1600] sponge (original Keccak padding, NOT NIST
// SHA3 domain separation — this is the Ethereum variant). Lanes stored as
// [lo,hi] uint32 pairs; state = 25 lanes, linear index = x + 5*y.
// ══════════════════════════════════════════════════════════════════════════════
const RC = [
  [0x00000001, 0x00000000], [0x00008082, 0x00000000], [0x0000808a, 0x80000000],
  [0x80008000, 0x80000000], [0x0000808b, 0x00000000], [0x80000001, 0x00000000],
  [0x80008081, 0x80000000], [0x00008009, 0x80000000], [0x0000008a, 0x00000000],
  [0x00000088, 0x00000000], [0x80008009, 0x00000000], [0x8000000a, 0x00000000],
  [0x8000808b, 0x00000000], [0x0000008b, 0x80000000], [0x00008089, 0x80000000],
  [0x00008003, 0x80000000], [0x00008002, 0x80000000], [0x00000080, 0x80000000],
  [0x0000800a, 0x00000000], [0x8000000a, 0x80000000], [0x80008081, 0x80000000],
  [0x00008080, 0x80000000], [0x80000001, 0x00000000], [0x80008008, 0x80000000],
];
// rotation offsets r[x][y] (Keccak rho step)
const ROT = [
  [0, 36, 3, 41, 18],
  [1, 44, 10, 45, 2],
  [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56],
  [27, 20, 39, 8, 14],
];

function rotl64(lo, hi, n) {
  n = n % 64;
  if (n === 0) return [lo >>> 0, hi >>> 0];
  if (n < 32) return [((lo << n) | (hi >>> (32 - n))) >>> 0, ((hi << n) | (lo >>> (32 - n))) >>> 0];
  if (n === 32) return [hi >>> 0, lo >>> 0];
  const m = n - 32;
  return [((hi << m) | (lo >>> (32 - m))) >>> 0, ((lo << m) | (hi >>> (32 - m))) >>> 0];
}

function keccakF1600(state) {
  for (let round = 0; round < 24; round++) {
    // theta
    const C = new Array(5);
    for (let x = 0; x < 5; x++) {
      let lo = 0, hi = 0;
      for (let y = 0; y < 5; y++) { lo ^= state[2 * (x + 5 * y)]; hi ^= state[2 * (x + 5 * y) + 1]; }
      C[x] = [lo >>> 0, hi >>> 0];
    }
    const D = new Array(5);
    for (let x = 0; x < 5; x++) {
      const cxm1 = C[(x + 4) % 5];
      const cxp1 = C[(x + 1) % 5];
      const [rlo, rhi] = rotl64(cxp1[0], cxp1[1], 1);
      D[x] = [(cxm1[0] ^ rlo) >>> 0, (cxm1[1] ^ rhi) >>> 0];
    }
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        const idx = 2 * (x + 5 * y);
        state[idx] = (state[idx] ^ D[x][0]) >>> 0;
        state[idx + 1] = (state[idx + 1] ^ D[x][1]) >>> 0;
      }
    }
    // rho + pi (combined), FIPS 202 §3.2.3: A'[x,y] = rotl(A[(x+3y)%5, x], r[(x+3y)%5, x])
    const B = new Array(50);
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        const sx = (x + 3 * y) % 5;
        const sy = x;
        const idxSrc = 2 * (sx + 5 * sy);
        const [rlo, rhi] = rotl64(state[idxSrc], state[idxSrc + 1], ROT[sx][sy]);
        const idxNew = 2 * (x + 5 * y);
        B[idxNew] = rlo; B[idxNew + 1] = rhi;
      }
    }
    // chi
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        const idx = 2 * (x + 5 * y);
        const idx1 = 2 * (((x + 1) % 5) + 5 * y);
        const idx2 = 2 * (((x + 2) % 5) + 5 * y);
        state[idx] = (B[idx] ^ ((~B[idx1]) & B[idx2])) >>> 0;
        state[idx + 1] = (B[idx + 1] ^ ((~B[idx1 + 1]) & B[idx2 + 1])) >>> 0;
      }
    }
    // iota
    state[0] = (state[0] ^ RC[round][0]) >>> 0;
    state[1] = (state[1] ^ RC[round][1]) >>> 0;
  }
  return state;
}

const KECCAK_RATE_BYTES = 136; // 1088 bits, for 256-bit output (512-bit capacity)

function keccak256(bytes) {
  const state = new Array(50).fill(0);
  const rate = KECCAK_RATE_BYTES;
  let offset = 0;
  // absorb full blocks
  while (bytes.length - offset >= rate) {
    for (let i = 0; i < rate / 4; i++) {
      const w = bytes[offset + 4 * i] | (bytes[offset + 4 * i + 1] << 8) |
                (bytes[offset + 4 * i + 2] << 16) | (bytes[offset + 4 * i + 3] << 24);
      state[i] = (state[i] ^ w) >>> 0;
    }
    keccakF1600(state);
    offset += rate;
  }
  // final padded block (original Keccak padding: 0x01 start bit, 0x80 end bit, ORed if same byte)
  const rem = bytes.length - offset;
  const block = new Uint8Array(rate);
  for (let i = 0; i < rem; i++) block[i] = bytes[offset + i];
  block[rem] ^= 0x01;
  block[rate - 1] ^= 0x80;
  for (let i = 0; i < rate / 4; i++) {
    const w = block[4 * i] | (block[4 * i + 1] << 8) | (block[4 * i + 2] << 16) | (block[4 * i + 3] << 24);
    state[i] = (state[i] ^ w) >>> 0;
  }
  keccakF1600(state);
  // squeeze first 32 bytes (4 lanes)
  const out = new Uint8Array(32);
  for (let i = 0; i < 4; i++) {
    const lo = state[2 * i], hi = state[2 * i + 1];
    const base = 8 * i;
    out[base] = lo & 0xff; out[base + 1] = (lo >>> 8) & 0xff; out[base + 2] = (lo >>> 16) & 0xff; out[base + 3] = (lo >>> 24) & 0xff;
    out[base + 4] = hi & 0xff; out[base + 5] = (hi >>> 8) & 0xff; out[base + 6] = (hi >>> 16) & 0xff; out[base + 7] = (hi >>> 24) & 0xff;
  }
  return out;
}

// ── hex / bytes utilities (no TextEncoder/Decoder per SPEC.md §17 kernel ban) ──
function hexToBytes(hex) {
  let h = String(hex ?? '');
  if (h.startsWith('0x') || h.startsWith('0X')) h = h.slice(2);
  if (h.length % 2 === 1) h = '0' + h;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = parseInt(h.substr(i * 2, 2), 16);
    if (Number.isNaN(byte)) return null;
    out[i] = byte;
  }
  return out;
}
function bytesToHex(bytes) {
  let s = '0x';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}
function bytesEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function bytesToNibbles(bytes) {
  const out = new Array(bytes.length * 2);
  for (let i = 0; i < bytes.length; i++) { out[2 * i] = bytes[i] >>> 4; out[2 * i + 1] = bytes[i] & 0x0f; }
  return out;
}

// ── RLP decode (bounded, exec-check-friendly) ──────────────────────────────────
// Decodes exactly one RLP item starting at offset; returns {value, next} where
// value is Uint8Array (string item) or Array (list item, entries recursively decoded).
function rlpDecodeItem(bytes, offset, maxItems) {
  if (offset >= bytes.length) return null;
  const b0 = bytes[offset];
  if (b0 < 0x80) return { value: bytes.subarray(offset, offset + 1), next: offset + 1 };
  if (b0 <= 0xb7) {
    const len = b0 - 0x80;
    const start = offset + 1;
    if (start + len > bytes.length) return null;
    return { value: bytes.subarray(start, start + len), next: start + len };
  }
  if (b0 <= 0xbf) {
    const lenOfLen = b0 - 0xb7;
    if (lenOfLen > 4) return null; // bounded: no absurd lengths
    const lenBytes = bytes.subarray(offset + 1, offset + 1 + lenOfLen);
    if (lenBytes.length < lenOfLen) return null;
    let len = 0;
    for (let i = 0; i < lenBytes.length; i++) len = (len << 8) | lenBytes[i];
    const start = offset + 1 + lenOfLen;
    if (start + len > bytes.length) return null;
    return { value: bytes.subarray(start, start + len), next: start + len };
  }
  if (b0 <= 0xf7) {
    const len = b0 - 0xc0;
    const start = offset + 1;
    const end = start + len;
    if (end > bytes.length) return null;
    return decodeList(bytes, start, end, maxItems);
  }
  const lenOfLen = b0 - 0xf7;
  if (lenOfLen > 4) return null;
  const lenBytes = bytes.subarray(offset + 1, offset + 1 + lenOfLen);
  if (lenBytes.length < lenOfLen) return null;
  let len = 0;
  for (let i = 0; i < lenBytes.length; i++) len = (len << 8) | lenBytes[i];
  const start = offset + 1 + lenOfLen;
  const end = start + len;
  if (end > bytes.length) return null;
  return decodeList(bytes, start, end, maxItems);
}
function decodeList(bytes, start, end, maxItems) {
  const items = [];
  let pos = start;
  while (pos < end) {
    if (items.length >= maxItems) return null; // bounded: reject oversized lists (branch node caps at 17)
    const dec = rlpDecodeItem(bytes, pos, maxItems);
    if (dec === null) return null;
    items.push(dec.value);
    pos = dec.next;
  }
  if (pos !== end) return null;
  return { value: items, next: end };
}
// decode a full trie node: MUST be exactly one top-level list item consuming all bytes
function decodeNode(raw) {
  const dec = rlpDecodeItem(raw, 0, 17);
  if (dec === null || dec.next !== raw.length || !Array.isArray(dec.value)) return null;
  return dec.value;
}

// ── hex-prefix (HP) decode for extension/leaf nibble paths ─────────────────────
function hpDecode(pathBytes) {
  if (pathBytes.length === 0) return { nibbles: [], isLeaf: false };
  const first = pathBytes[0];
  const isLeaf = (first & 0x20) !== 0;
  const isOdd = (first & 0x10) !== 0;
  const nibbles = [];
  if (isOdd) nibbles.push(first & 0x0f);
  for (let i = 1; i < pathBytes.length; i++) { nibbles.push(pathBytes[i] >>> 4); nibbles.push(pathBytes[i] & 0x0f); }
  return { nibbles, isLeaf };
}
function nibblesStartsWith(remaining, prefix) {
  if (prefix.length > remaining.length) return false;
  for (let i = 0; i < prefix.length; i++) if (remaining[i] !== prefix[i]) return false;
  return true;
}

// ── MPT walk: verify `path` (array of nibbles) against `root` using `proofNodes`
// (array of raw Uint8Array node encodings, root-to-leaf order). Returns
// { exists, value, reason } — never throws; a malformed proof yields exists:false
// with a reason string (total, terminating function).
function walkTrie(root, path, proofNodes, maxNodes) {
  if (proofNodes.length === 0) return { exists: false, value: null, reason: 'empty proof' };
  if (proofNodes.length > maxNodes) return { exists: false, value: null, reason: 'proof exceeds bounded node limit' };
  let expectedHash = root;
  let nibbleIdx = 0;
  for (let i = 0; i < proofNodes.length; i++) {
    const raw = proofNodes[i];
    const h = keccak256(raw);
    if (!bytesEqual(h, expectedHash)) return { exists: false, value: null, reason: `node ${i} hash mismatch (broken proof chain)` };
    const node = decodeNode(raw);
    if (node === null) return { exists: false, value: null, reason: `node ${i} is not a valid RLP node` };
    const remaining = path.slice(nibbleIdx);
    if (node.length === 17) {
      // branch node
      if (remaining.length === 0) {
        const term = node[16];
        return term && term.length > 0
          ? { exists: true, value: term, reason: null }
          : { exists: false, value: null, reason: 'no value at branch terminator' };
      }
      const nib = remaining[0];
      const child = node[nib];
      if (!child || child.length === 0) return { exists: false, value: null, reason: 'branch child empty (non-inclusion)' };
      nibbleIdx += 1;
      if (i === proofNodes.length - 1) {
        // last supplied node — child must be the value itself only if this is meant to terminate here;
        // proofs always supply the leaf/extension node too, so an empty next step is a malformed proof.
        return { exists: false, value: null, reason: 'proof truncated after branch (missing child node)' };
      }
      if (child.length !== 32) return { exists: false, value: null, reason: 'branch child not hash-referenced (unsupported embedded node)' };
      expectedHash = child;
      continue;
    }
    if (node.length === 2) {
      const { nibbles: hpNibbles, isLeaf } = hpDecode(node[0]);
      if (!nibblesStartsWith(remaining, hpNibbles)) return { exists: false, value: null, reason: 'leaf/extension path diverges (non-inclusion)' };
      nibbleIdx += hpNibbles.length;
      if (isLeaf) {
        if (nibbleIdx !== path.length) return { exists: false, value: null, reason: 'leaf reached before full key consumed' };
        return { exists: true, value: node[1], reason: null };
      }
      // extension node
      if (i === proofNodes.length - 1) return { exists: false, value: null, reason: 'proof truncated after extension (missing child node)' };
      const child = node[1];
      if (!child || child.length !== 32) return { exists: false, value: null, reason: 'extension child not hash-referenced' };
      expectedHash = child;
      continue;
    }
    return { exists: false, value: null, reason: `node ${i} has invalid arity (${node.length})` };
  }
  return { exists: false, value: null, reason: 'proof consumed without reaching a terminal node' };
}

// decode account leaf value: RLP list [nonce, balance, storageRoot, codeHash]
function decodeAccount(valueBytes) {
  const dec = rlpDecodeItem(valueBytes, 0, 4);
  if (dec === null || dec.next !== valueBytes.length || !Array.isArray(dec.value) || dec.value.length !== 4) return null;
  const [nonce, balance, storageRoot, codeHash] = dec.value;
  if (storageRoot.length !== 32 || codeHash.length !== 32) return null;
  return { nonce, balance, storageRoot, codeHash };
}
// decode storage leaf value: RLP string (big-endian minimal integer)
function decodeStorageValue(valueBytes) {
  const dec = rlpDecodeItem(valueBytes, 0, 1);
  if (dec === null || dec.next !== valueBytes.length || Array.isArray(dec.value)) return null;
  return dec.value;
}

/**
 * compute(pp) — pure EIP-1186 state-proof verifier.
 * pp: {
 *   block_state_root: string (0x + 64 hex),
 *   address:          string (0x + 40 hex),
 *   account_proof:    string[] (RLP-encoded trie nodes, root→leaf order, max 32),
 *   storage_slots?:   Array<{ slot: string (0x+64hex), expected_value?: string|null, proof: string[] (max 16) }> (max 8),
 * }
 */
export function compute(pp) {
  const limits = { max_account_proof_nodes: MAX_PROOF_NODES, max_node_hex_len: MAX_NODE_HEX_LEN, max_storage_slots: MAX_STORAGE_SLOTS, max_storage_proof_nodes: MAX_STORAGE_PROOF_NODES };
  const rootHex = pp.block_state_root ?? '';
  const addressHex = pp.address ?? '';
  const accountProofHex = Array.isArray(pp.account_proof) ? pp.account_proof : [];
  const storageSlotsIn = Array.isArray(pp.storage_slots) ? pp.storage_slots : [];

  const errors = [];
  const root = hexToBytes(rootHex);
  if (!root || root.length !== 32) errors.push('block_state_root must be 32 bytes hex');
  const address = hexToBytes(addressHex);
  if (!address || address.length !== 20) errors.push('address must be 20 bytes hex');
  if (accountProofHex.length === 0) errors.push('account_proof must be non-empty');
  if (accountProofHex.length > MAX_PROOF_NODES) errors.push(`account_proof exceeds bounded limit of ${MAX_PROOF_NODES} nodes`);
  for (const h of accountProofHex) if (String(h ?? '').length > MAX_NODE_HEX_LEN) errors.push('an account_proof node exceeds bounded byte-length limit');
  if (storageSlotsIn.length > MAX_STORAGE_SLOTS) errors.push(`storage_slots exceeds bounded limit of ${MAX_STORAGE_SLOTS} slots`);

  if (errors.length > 0) {
    return {
      output_payload: {
        verdict: 'INVALID_PROOF', address: addressHex, block_state_root: rootHex,
        account_exists: false, account: null, storage_results: [], proof_nodes_consumed: 0, diagnostic: null, errors, bounded_limits: limits,
        receipt_statement: null,
        regulatory_note: 'Consensus-proof (light-client header) verification is out of scope for this tool — the state root is a caller-supplied trust anchor, not independently verified against a beacon-chain header.',
      },
      compliance_flags: ['STATE_PROOF_INVALID_INPUT'],
    };
  }

  const accountProof = accountProofHex.map(hexToBytes);
  if (accountProof.some((b) => b === null)) {
    return {
      output_payload: {
        verdict: 'INVALID_PROOF', address: addressHex, block_state_root: rootHex,
        account_exists: false, account: null, storage_results: [], proof_nodes_consumed: 0, diagnostic: null, errors: ['account_proof contains non-hex node'], bounded_limits: limits,
        receipt_statement: null,
        regulatory_note: 'Consensus-proof (light-client header) verification is out of scope for this tool — the state root is a caller-supplied trust anchor, not independently verified against a beacon-chain header.',
      },
      compliance_flags: ['STATE_PROOF_INVALID_INPUT'],
    };
  }

  const accountKey = bytesToNibbles(keccak256(address));
  const walk = walkTrie(root, accountKey, accountProof, MAX_PROOF_NODES);

  let account = null, accountExists = false, verdict, receiptStatement = null, diagnostic = null;
  const storageResults = [];
  const complianceFlags = [];

  if (!walk.exists) {
    verdict = walk.reason && walk.reason.includes('non-inclusion') ? 'NOT_FOUND' : 'INVALID_PROOF';
    diagnostic = walk.reason;
    complianceFlags.push(verdict === 'NOT_FOUND' ? 'STATE_PROOF_ACCOUNT_NOT_FOUND' : 'STATE_PROOF_INVALID');
  } else {
    const decoded = decodeAccount(walk.value);
    if (decoded === null) {
      verdict = 'INVALID_PROOF';
      diagnostic = 'account leaf value is not a valid RLP [nonce,balance,storageRoot,codeHash] list';
      complianceFlags.push('STATE_PROOF_INVALID');
    } else {
      accountExists = true;
      account = {
        nonce_hex: bytesToHex(decoded.nonce),
        balance_hex: bytesToHex(decoded.balance),
        storage_root_hex: bytesToHex(decoded.storageRoot),
        code_hash_hex: bytesToHex(decoded.codeHash),
      };
      verdict = 'VERIFIED';
      complianceFlags.push('STATE_PROOF_VERIFIED');
      receiptStatement = `Address ${addressHex} verified under state root ${rootHex}: balance ${account.balance_hex}, nonce ${account.nonce_hex}.`;

      for (const s of storageSlotsIn.slice(0, MAX_STORAGE_SLOTS)) {
        const slotHex = s?.slot ?? '';
        const proofHex = Array.isArray(s?.proof) ? s.proof.slice(0, MAX_STORAGE_PROOF_NODES) : [];
        const slotBytes = hexToBytes(slotHex);
        if (!slotBytes || slotBytes.length !== 32 || proofHex.length === 0 || proofHex.length > MAX_STORAGE_PROOF_NODES) {
          storageResults.push({ slot: slotHex, exists: false, value_hex: null, matches_expected: null, reason: 'malformed storage slot input' });
          continue;
        }
        const proofBytes = proofHex.map(hexToBytes);
        if (proofBytes.some((b) => b === null)) {
          storageResults.push({ slot: slotHex, exists: false, value_hex: null, matches_expected: null, reason: 'non-hex storage proof node' });
          continue;
        }
        const storageKey = bytesToNibbles(keccak256(slotBytes));
        const sWalk = walkTrie(decoded.storageRoot, storageKey, proofBytes, MAX_STORAGE_PROOF_NODES);
        if (!sWalk.exists) {
          storageResults.push({ slot: slotHex, exists: false, value_hex: null, matches_expected: s?.expected_value == null ? null : false, reason: sWalk.reason });
          continue;
        }
        const val = decodeStorageValue(sWalk.value);
        if (val === null) {
          storageResults.push({ slot: slotHex, exists: false, value_hex: null, matches_expected: null, reason: 'malformed storage value RLP' });
          continue;
        }
        const valueHex = bytesToHex(val);
        const expected = s?.expected_value ?? null;
        const matches = expected == null ? null : bytesEqual(hexToBytes(expected), val);
        storageResults.push({ slot: slotHex, exists: true, value_hex: valueHex, matches_expected: matches, reason: null });
      }
      if (storageResults.some((r) => r.matches_expected === false)) complianceFlags.push('STATE_PROOF_STORAGE_MISMATCH');
    }
  }

  const output_payload = {
    verdict,
    address: addressHex,
    block_state_root: rootHex,
    account_exists: accountExists,
    account,
    storage_results: storageResults,
    proof_nodes_consumed: accountProof.length,
    diagnostic,
    errors: [],
    bounded_limits: limits,
    receipt_statement: receiptStatement,
    regulatory_note: 'Consensus-proof (light-client header) verification is out of scope for this tool — the state root is a caller-supplied trust anchor, not independently verified against a beacon-chain header. Persona: fund administrator or auditor confirming tokenized-MMF/deposit-token holdings without trusting an RPC provider.',
  };

  return { output_payload, compliance_flags: complianceFlags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type:       meta.mandate_type,
    tool_id:             TOOL_ID,
    tool_version:        TOOL_VERSION,
    generated_at:        now ?? null,
    execution_hash:      hash,
    chain:               { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:   pp,
    output_payload,
    compliance_flags,
    compute_mode:        'server',
    audit_signature:     { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
