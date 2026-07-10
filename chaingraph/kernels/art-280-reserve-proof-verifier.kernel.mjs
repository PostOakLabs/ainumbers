// art-280 — Reserve Proof Verifier: pure decision kernel.
// Faithful port of compute() in
//   repo/chaingraph/art-280-reserve-proof-verifier.html
// Pure: no DOM, no window, no network, no host crypto (SHA-256 is hand-rolled
// pure-JS — same inlined implementation proven in art-199/200/206/210 crypto
// kernels; crypto.subtle is banned in the zkVM guest).
//
// VR-2 Reserve Proof Verifier — part 2 of the Reserve Verification Family
// (successor-in-family to art-275 GENIUS Act Monthly Reserve Disclosure
// Checker). Two independent checks over a caller-supplied artifact:
//   (a) Merkle-sum Proof-of-Reserves inclusion verifier — recomputes a
//       customer leaf from a disclosed balance + opaque user-id hash and
//       walks a supplied Merkle-sum path to a declared root. CLEAN-ROOM:
//       no code copied from the Gate.io GPLv3 verifier or any other PoR
//       library; this is an independent implementation of the well-known
//       Merkle-sum-tree construction (Summa report structure — SHAPE only,
//       never its prover).
//   (b) Chainlink PoR / NAVLink aggregator-round staleness + deviation
//       checker. Composes (soft dep, stub-and-note) with VR-1's on-chain
//       storage proof when supplied.
//
// Bounded inputs only (art-201 lesson): Merkle path depth and per-exchange
// raw-proof field counts are capped so SHA-256 runs over a small, finite,
// provable amount of data.
//
// HARD NON-CLAIM (receipt MUST record this): a single-leaf inclusion proof
// verifies that ONE customer's balance is included in the committed root and
// that the root's total sum matches the declared total reserves. It does
// NOT prove liabilities completeness (an issuer could omit accounts from the
// tree), does NOT see off-balance-sheet encumbrances/rehypothecation, and is
// POINT-IN-TIME only. Never oversell this as an audit or a PCAOB opinion.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-280-reserve-proof-verifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'verify_reserve_proof',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

// ── bounded-input limits (exec-check-friendly, art-201 lesson) ──────────
const MAX_PATH_DEPTH = 40; // log2(N) for N up to ~1 trillion leaves; hard ceiling

// ── Inlined pure-JS SHA-256 (no crypto.subtle, no TextEncoder) ──────────
// Same implementation proven in art-199/200/206/210 crypto kernels.

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
  [h0,h1,h2,h3,h4,h5,h6,h7].forEach(function(v, i) { const j = i * 4; r[j] = v >>> 24; r[j+1] = (v >>> 16) & 0xff; r[j+2] = (v >>> 8) & 0xff; r[j+3] = v & 0xff; });
  return r;
}

function _sha256Hex(str) {
  return Array.from(_sha256(_utf8Bytes(str))).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Merkle-sum-tree machinery (clean-room; RFC 6962 pattern, NOT code, reused
//    from the anchor evidence-worker merkle.mjs — this kernel is a fresh,
//    independent implementation) ────────────────────────────────────────────

function leafNode(userIdHash, balance) {
  const sum = Number(balance ?? 0);
  return { hash: _sha256Hex(`${userIdHash ?? ''}|${sum}`), sum };
}

function combineNodes(left, right) {
  return {
    hash: _sha256Hex(`${left.hash}|${left.sum}|${right.hash}|${right.sum}`),
    sum: left.sum + right.sum,
  };
}

function walkMerkleSumPath(leaf, path) {
  let current = leaf;
  for (const step of path) {
    const sibling = { hash: String(step.hash ?? ''), sum: Number(step.sum ?? 0) };
    current = step.position === 'left'
      ? combineNodes(sibling, current)
      : combineNodes(current, sibling);
  }
  return current;
}

// ── Multi-format normalization — OKX / Binance / Gate / Kraken published PoR
//    proof-export shapes (per each provider's public PoR documentation as of
//    2026-07; field names are best-effort and may need re-verification if a
//    provider revises its export schema) → the canonical {leaf, path, root}
//    shape. 'generic' passes an already-canonical proof through unchanged. ──

function normalizeProof(exchange, raw) {
  raw = raw ?? {};
  switch (exchange) {
    case 'okx': {
      const path = (raw.merklePath ?? []).map((p) => ({ hash: p.siblingHash, sum: Number(p.siblingSum ?? 0), position: p.isLeft ? 'left' : 'right' }));
      return {
        leaf: leafNode(raw.userId, raw.balance),
        path,
        root: { hash: String(raw.merkleRoot?.hash ?? ''), sum: Number(raw.merkleRoot?.sum ?? 0) },
      };
    }
    case 'binance': {
      const path = (raw.proofs ?? []).map((p) => ({ hash: p.sibling, sum: Number(p.sum ?? 0), position: p.direction === 'left' ? 'left' : 'right' }));
      return {
        leaf: leafNode(raw.uid, raw.amount),
        path,
        root: { hash: String(raw.root?.rootHash ?? ''), sum: Number(raw.root?.rootSum ?? 0) },
      };
    }
    case 'gate': {
      const path = (raw.path ?? []).map((p) => ({ hash: p.hash, sum: Number(p.sum ?? 0), position: p.left ? 'left' : 'right' }));
      return {
        leaf: leafNode(raw.user_id, raw.balance),
        path,
        root: { hash: String(raw.root_hash ?? ''), sum: Number(raw.root_sum ?? 0) },
      };
    }
    case 'kraken': {
      const path = (raw.merkle_branch ?? []).map((p) => ({ hash: p.node_hash, sum: Number(p.node_sum ?? 0), position: p.side === 'left' ? 'left' : 'right' }));
      return {
        leaf: leafNode(raw.account_hash, raw.verified_balance),
        path,
        root: { hash: String(raw.published_root?.hash ?? ''), sum: Number(raw.published_root?.sum ?? 0) },
      };
    }
    default: { // 'generic' — already-canonical shape
      const path = (raw.path ?? []).map((p) => ({ hash: p.hash, sum: Number(p.sum ?? 0), position: p.position === 'left' ? 'left' : 'right' }));
      return {
        leaf: leafNode(raw.leaf_user_id_hash, raw.leaf_balance),
        path,
        root: { hash: String(raw.root?.hash ?? ''), sum: Number(raw.root?.sum ?? 0) },
      };
    }
  }
}

const NOT_PROVEN = [
  { item: 'Total liabilities completeness', detail: 'Only the audited customer set is provable from a single-leaf inclusion proof. An issuer could omit accounts from the tree entirely and this proof cannot detect the omission.' },
  { item: 'Off-balance-sheet encumbrances', detail: 'Pledges, rehypothecation, or liens against reserve assets are not visible in a Merkle-sum inclusion proof.' },
  { item: 'Continuous solvency', detail: 'This is a point-in-time snapshot at attestation time, not a continuous or real-time solvency guarantee.' },
  { item: 'PCAOB audit opinion', detail: 'This tool performs no audit and carries no PCAOB or other audit-firm opinion; it is a cryptographic inclusion check only.' },
];

/**
 * compute(pp) — pure VR-2 reserve-proof verifier.
 * pp: {
 *   exchange?: 'okx'|'binance'|'gate'|'kraken'|'generic',
 *   merkle_proof?: <exchange-shaped raw proof object>,
 *   por_round?: {
 *     round_id?: string,
 *     updated_at_seconds?: number,
 *     current_timestamp_seconds?: number,
 *     max_staleness_seconds?: number,
 *     reserves_reported_usd?: number,
 *     deviation_bound_pct?: number,
 *   },
 *   storage_proof_composition?: { verified: boolean, source?: string } | null,
 * }
 */
export function compute(pp) {
  const exchange = pp.exchange ?? 'generic';
  const rawProof = pp.merkle_proof ?? {};

  let structuralError = null;
  const proof = normalizeProof(exchange, rawProof);

  if (proof.path.length > MAX_PATH_DEPTH) {
    structuralError = `Merkle path depth ${proof.path.length} exceeds the ${MAX_PATH_DEPTH}-level bound.`;
  }

  let computedRoot = null;
  let rootHashMatch = false;
  let sumVerified = false;
  let inclusionVerified = false;

  if (!structuralError) {
    computedRoot = walkMerkleSumPath(proof.leaf, proof.path);
    rootHashMatch = computedRoot.hash === proof.root.hash && proof.root.hash !== '';
    sumVerified = computedRoot.sum === proof.root.sum;
    inclusionVerified = rootHashMatch && sumVerified;
  }

  // (b) Chainlink PoR / NAVLink aggregator-round staleness + deviation check
  const round = pp.por_round ?? null;
  let porRoundResult = null;
  if (round) {
    const updatedAt = Number(round.updated_at_seconds ?? 0);
    const now = Number(round.current_timestamp_seconds ?? 0);
    const maxStaleness = Number(round.max_staleness_seconds ?? 86400);
    const stalenessSeconds = Math.max(0, now - updatedAt);
    const isStale = stalenessSeconds > maxStaleness;

    let deviationPct = null;
    let deviationBreach = false;
    if (round.reserves_reported_usd != null && computedRoot) {
      const reported = Number(round.reserves_reported_usd);
      const bound = Number(round.deviation_bound_pct ?? 5);
      deviationPct = computedRoot.sum > 0
        ? parseFloat((Math.abs(reported - computedRoot.sum) / computedRoot.sum * 100).toFixed(4))
        : (reported === 0 ? 0 : null);
      deviationBreach = deviationPct !== null && deviationPct > bound;
    }

    porRoundResult = {
      round_id: round.round_id ?? null,
      staleness_seconds: stalenessSeconds,
      max_staleness_seconds: maxStaleness,
      is_stale: isStale,
      deviation_pct: deviationPct,
      deviation_bound_pct: round.deviation_bound_pct ?? null,
      deviation_breach: deviationBreach,
    };
  }

  // Soft-dep composition hook with VR-1 (State-Proof Verifier) — stub-and-note
  // if the caller hasn't supplied a verified on-chain storage proof result.
  const compositionInput = pp.storage_proof_composition ?? null;
  const composition = (compositionInput && compositionInput.verified === true)
    ? { composed: true, source: compositionInput.source ?? 'vr-1', note: 'Composed with an on-chain storage-proof result (VR-1 State-Proof Verifier).' }
    : { composed: false, source: null, note: 'Composition hook stubbed, no on-chain storage-proof result supplied (VR-1 composes here once available); the inclusion result above is self-contained and does not depend on this.' };

  let determination;
  if (structuralError) determination = 'STRUCTURAL_ERROR';
  else if (!inclusionVerified) determination = 'FAIL';
  else if ((porRoundResult && (porRoundResult.is_stale || porRoundResult.deviation_breach))) determination = 'WARN';
  else determination = 'PASS';

  const compliance_flags = [];
  if (structuralError) compliance_flags.push('RESERVE_PROOF_STRUCTURAL_ERROR');
  if (!structuralError && inclusionVerified) compliance_flags.push('RESERVE_PROOF_INCLUSION_VERIFIED');
  if (!structuralError && !inclusionVerified) compliance_flags.push('RESERVE_PROOF_INCLUSION_FAILED');
  if (porRoundResult && porRoundResult.is_stale) compliance_flags.push('POR_ROUND_STALE');
  if (porRoundResult && porRoundResult.deviation_breach) compliance_flags.push('POR_DEVIATION_BREACH');
  if (!composition.composed) compliance_flags.push('STORAGE_PROOF_COMPOSITION_STUBBED');
  if (compliance_flags.length === 1 && compliance_flags[0] === 'RESERVE_PROOF_INCLUSION_VERIFIED') compliance_flags.push('RESERVE_PROOF_CLEAN');

  const output_payload = {
    reserve_proof_determination: determination,
    exchange,
    inclusion_verified: inclusionVerified,
    root_hash_match: rootHashMatch,
    sum_verified: sumVerified,
    computed_leaf_hash: proof.leaf.hash,
    computed_root: computedRoot,
    declared_root: proof.root,
    structural_error: structuralError,
    por_round: porRoundResult,
    storage_proof_composition: composition,
    not_proven: NOT_PROVEN,
    regulatory_framework: 'Voluntary Merkle-sum PoR attestation (Summa report structure) + Chainlink PoR/NAVLink round data; not a GENIUS Act §4 filing (see art-275) and not a PCAOB audit.',
  };

  return { output_payload, compliance_flags };
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
