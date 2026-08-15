// art-620 — Summa MST Inclusion Checker: pure decision kernel.
// SUMMA-MST-K-1, anchored on workspace-root SUMMA-MST-BUILD-SPEC.md §5a/§4/§3/§2.
// Pure: no DOM, no window, no network, no host crypto (SHA-256 is hand-rolled
// pure-JS, no TextEncoder/atob/btoa/URL — GUEST-BUILTIN-GATE-1, RIDER-KERNEL.md —
// same construction proven in art-199/200/206/210/280/584).
//
// Job (spec §5a): paste a published Merkle-sum-tree root + an inclusion proof
// for one leaf, verify (a) the leaf's inclusion (hash chain reaches the root)
// AND (b) local balance-sum consistency, entirely offline. Never a solvency
// or "reserves are sufficient" claim (spec §3 item4 / §7) — inclusion and
// local range-check consistency only.
//
// The hazard this kernel defends against (spec §3, Maxwell eprint 2022/043
// §4.1, the "broken MST"): a naive checker that only checks "does my leaf
// chain to the root" can be fooled by a tree with an inflated leaf offset by
// a hidden negative sibling that cancels it in the sum. This kernel therefore
// (1) rejects any negative balance/sum anywhere in the path, (2) rejects any
// balance/sum exceeding a declared MAX_BALANCE domain bound, and (3)
// independently recomputes BOTH the hash chain AND the sum chain from the
// leaf to the root — never trusting the pasted root as an oracle for itself
// (same independent-derivation principle as STANDING-ORDERS.md #34).

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-620-summa-mst-inclusion-checker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'verify_summa_mst_inclusion',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

// ── bounded-input limits (exec-check-friendly, art-201 lesson) ──────────
const MAX_PATH_DEPTH = 64; // generous ceiling for any realistic MST depth
// Spec §5a: "declared MAX_BALANCE domain constant... a verification
// parameter, not the thing being verified." 10^18 base units is the spec's
// own worked example — large enough to hold any realistic aggregate reserve
// figure denominated in integer base units (cents/sats/wei-like), while
// still catching a genuine overflow-shaped input.
const DEFAULT_MAX_BALANCE = '1000000000000000000';

const RESIDUAL_LIMITATION_NOTE =
  'This checks inclusion and local range-consistency of the ONE leaf and its proof path only. ' +
  'It does not and cannot prove every other leaf in the tree obeyed the same range check — only ' +
  'the tree operator\'s own construction process (or a full ZK proof over the whole tree, which ' +
  'this tool does not implement) can guarantee that globally. This is never a statement that the ' +
  'reserve is solvent.';

const VERIFY_ONLY_NOTE =
  'Verify-only: this tool reports "this leaf\'s inclusion in the published tree is verified" or ' +
  '"verification failed: <reason>" — never "reserves are sufficient", "solvent", or an audit opinion.';

// ── Inlined pure-JS SHA-256 (no crypto.subtle, no TextEncoder) ──────────
// Same implementation proven in art-199/200/206/210/280/584 crypto kernels.

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
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
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
  [h0,h1,h2,h3,h4,h5,h6,h7].forEach(function (v, i) { const j = i * 4; r[j] = v >>> 24; r[j+1] = (v >>> 16) & 0xff; r[j+2] = (v >>> 8) & 0xff; r[j+3] = v & 0xff; });
  return r;
}

function _sha256Hex(str) {
  return Array.from(_sha256(_utf8Bytes(str))).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function _stripHexPrefix(h) { return String(h ?? '').replace(/^(sha256:|0x)/i, '').toLowerCase(); }
function _isHex(s) { return typeof s === 'string' && s.length > 0 && /^[0-9a-f]+$/i.test(s); }

// Decimal-string -> BigInt, strict (no leading '+', no whitespace, no floats).
// Returns null on anything that is not a plain base-10 integer string.
function _parseDecimalBigInt(v) {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const s = String(v);
  if (!/^-?\d+$/.test(s)) return null;
  try { return BigInt(s); } catch (e) { return null; }
}

// ── MST node layout (spec §2) ────────────────────────────────────────────
// Leaf: hash = H(id, balance), sum = balance.
// Middle: hash = H(left.sum + right.sum, left.hash, right.hash), sum = left.sum + right.sum.

function _leafHash(id, balanceStr) { return _sha256Hex(id + '|' + balanceStr); }
function _middleHash(sumStr, hashLeft, hashRight) { return _sha256Hex(sumStr + '|' + hashLeft + '|' + hashRight); }

/**
 * compute(pp) — pure Summa-pattern MST inclusion + local range-consistency checker.
 * pp: {
 *   root?: { hash?: string, sum?: string },
 *   proof?: {
 *     leaf?: { id?: string, balance?: string },
 *     path?: [{ side?: 'left'|'right', sibling_hash?: string, sibling_sum?: string }],
 *   },
 *   max_balance?: string, // decimal string, verification parameter (spec §5a)
 * }
 */
export function compute(pp) {
  pp = pp || {};
  const proof = pp.proof || {};
  const leafIn = proof.leaf || {};
  const pathIn = Array.isArray(proof.path) ? proof.path : [];
  const rootIn = pp.root || {};

  const maxBalanceStrIn = typeof pp.max_balance === 'string' ? pp.max_balance : DEFAULT_MAX_BALANCE;
  const maxBalance = _parseDecimalBigInt(maxBalanceStrIn);

  const compliance_flags = { SUMMA_MST_VERIFY_ONLY: true };

  function finalize(verdict, reason, extra) {
    if (verdict === 'VERIFIED') compliance_flags.SUMMA_MST_INCLUSION_VERIFIED = true;
    else compliance_flags.SUMMA_MST_INCLUSION_NOT_VERIFIED = true;
    const output_payload = Object.assign({
      verdict,
      reason: reason ?? null,
      computed_root: null,
      declared_root: { hash: _stripHexPrefix(rootIn.hash), sum: rootIn.sum != null ? String(rootIn.sum) : null },
      leaf: { id: typeof leafIn.id === 'string' ? leafIn.id : null, balance: leafIn.balance != null ? String(leafIn.balance) : null },
      path_length: pathIn.length,
      max_balance_used: maxBalanceStrIn,
      residual_limitation_note: RESIDUAL_LIMITATION_NOTE,
      verify_only_note: VERIFY_ONLY_NOTE,
    }, extra || {});
    return { output_payload, compliance_flags };
  }

  // ── malformed-input checks (never trust shape) ──────────────────────
  if (maxBalance === null || maxBalance < 0n) return finalize('NOT_VERIFIED', 'malformed_proof: max_balance must be a non-negative decimal string');
  if (pathIn.length > MAX_PATH_DEPTH) return finalize('NOT_VERIFIED', `malformed_proof: path depth ${pathIn.length} exceeds the ${MAX_PATH_DEPTH}-level bound`);
  if (!_isHex(leafIn.id) || String(leafIn.id).length > 128) return finalize('NOT_VERIFIED', 'malformed_proof: leaf.id must be an opaque hex identifier');

  const leafBalance = _parseDecimalBigInt(leafIn.balance);
  if (leafBalance === null) return finalize('NOT_VERIFIED', 'malformed_proof: leaf.balance must be a decimal-string BigInt');

  const rootHashDeclared = _stripHexPrefix(rootIn.hash);
  const rootSumDeclared = _parseDecimalBigInt(rootIn.sum);
  if (!_isHex(rootHashDeclared) || rootSumDeclared === null) return finalize('NOT_VERIFIED', 'malformed_proof: root.hash/root.sum missing or malformed');

  for (const step of pathIn) {
    if (step == null || (step.side !== 'left' && step.side !== 'right')) return finalize('NOT_VERIFIED', 'malformed_proof: path step missing a valid side (left|right)');
    if (!_isHex(step.sibling_hash)) return finalize('NOT_VERIFIED', 'malformed_proof: path step sibling_hash missing or malformed');
    if (_parseDecimalBigInt(step.sibling_sum) === null) return finalize('NOT_VERIFIED', 'malformed_proof: path step sibling_sum must be a decimal-string BigInt');
  }

  // ── §3 mandatory mitigation, in order, before ANY addition happens ──
  // (1) reject negative balances outright, (2) reject balances outside the
  // declared MAX_BALANCE domain bound — for the leaf, every sibling on the
  // path, AND every recomputed intermediate/root sum (Summa's RangeCheckChip
  // discipline applied at every level, not just leaves).
  const balanceStr = leafIn.balance != null ? String(leafIn.balance) : '';

  if (leafBalance < 0n) return finalize('NOT_VERIFIED', 'negative_balance_at_path_index_0');
  if (leafBalance > maxBalance) return finalize('NOT_VERIFIED', 'balance_exceeds_max_balance_at_path_index_0');

  let current = { hash: _leafHash(leafIn.id, balanceStr), sum: leafBalance };

  for (let i = 0; i < pathIn.length; i++) {
    const idx = i + 1; // 1-based; index 0 is reserved for the leaf itself
    const step = pathIn[i];
    const siblingHash = _stripHexPrefix(step.sibling_hash);
    const siblingSum = _parseDecimalBigInt(step.sibling_sum);

    if (siblingSum < 0n) return finalize('NOT_VERIFIED', `negative_balance_at_path_index_${idx}`);
    if (siblingSum > maxBalance) return finalize('NOT_VERIFIED', `balance_exceeds_max_balance_at_path_index_${idx}`);

    // (3) recompute the entire chain independently — never trust an upstream
    // sum. hash-order per spec §4: `side` states which side the SIBLING sits
    // on, so H(sum, sibling, current) when the sibling is on the left, and
    // H(sum, current, sibling) when the sibling is on the right.
    const combinedSum = current.sum + siblingSum;
    const combinedHash = step.side === 'left'
      ? _middleHash(combinedSum.toString(), siblingHash, current.hash)
      : _middleHash(combinedSum.toString(), current.hash, siblingHash);

    if (combinedSum > maxBalance) return finalize('NOT_VERIFIED', `balance_exceeds_max_balance_at_path_index_${idx}`);

    current = { hash: combinedHash, sum: combinedSum };
  }

  const hashMatch = current.hash === rootHashDeclared;
  const sumMatch = current.sum === rootSumDeclared;

  const computed_root = { hash: current.hash, sum: current.sum.toString() };
  const declared_root = { hash: rootHashDeclared, sum: rootSumDeclared.toString() };

  if (!hashMatch) return finalize('NOT_VERIFIED', 'hash_mismatch', { computed_root, declared_root });
  if (!sumMatch) return finalize('NOT_VERIFIED', 'sum_mismatch', { computed_root, declared_root });

  return finalize('VERIFIED', null, { computed_root, declared_root });
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
