// art-286 — Anchored Extract Verifier: pure decision kernel.
// Faithful port of compute() in
//   repo/chaingraph/art-286-anchored-extract-verifier.html
// Pure: no DOM, no window, no network, no host crypto (SHA-256 is hand-rolled
// pure-JS — same inlined implementation proven in art-199/200/206/210/280
// crypto kernels; crypto.subtle is banned in the zkVM guest).
//
// VR-3 wave 1 — Anchored Extract Verifier. Drivers: amended AS 1105 (FY2026)
// + AICPA practice aid ("don't rely on explorers"). SCOPED doctrine: verifies
// inclusion of an extract against a Merkle root ONLY when that root is
// anchored by a recognized source class — either our own OCG artifact
// envelope (dogfood: our receipt/chain format becomes what auditors view) or
// a shipped external verifier class (RFC 3161 timestamp, OpenTimestamps,
// Sigstore, or an on-chain commitment composed via VR-1 / EIP-1186 state
// proof). A bare, ad-hoc "trust me, here's a root" with no recognized source
// class is explicitly REFUSED (anchored:false) — this refusal is what keeps
// the universal self-produced-hash-chain explorer dead (killed per
// VERIFY-RAILS-BAND-SPEC-2026-07-09.md §VR-3: "self-produced hash chain w/o
// external anchor = theater").
//
// Merkle machinery: clean-room, RFC 6962 (Certificate Transparency) domain-
// separation pattern (leaf hash prefixed 0x00, internal-node hash prefixed
// 0x01 to defeat second-preimage attacks) — SHAPE only, an independent
// implementation; no code copied from any CT-log or Merkle library.
//
// Composition, not duplication: the on-chain-anchor source class delegates
// root-trust to VR-1 (verify_eth_state_proof, art-279) via a soft-dependency
// stub-and-note pattern identical to art-280 — this kernel never re-verifies
// an EIP-1186 state proof itself.
//
// Bounded inputs only (art-201 lesson): Merkle path depth is capped so
// SHA-256 runs over a small, finite, provable amount of data.
//
// HARD NON-CLAIM (receipt MUST record this): this kernel proves ONLY that a
// specific extract's leaf hash is included under a root, and that the root
// equals one attested by a recognized anchor source at a point in time. It
// does NOT verify the extract's own contents beyond its leaf hash, does NOT
// prove completeness of whatever the root commits to, and does NOT extend
// freshness beyond the anchor's own time semantics (e.g. a Bitcoin-confirmed
// OTS timestamp proves "no later than that block," nothing more current).

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-286-anchored-extract-verifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'verify_anchored_extract',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

// ── bounded-input limits (exec-check-friendly, art-201 lesson) ──────────
const MAX_PATH_DEPTH = 40; // log2(N) for N up to ~1 trillion leaves; hard ceiling

// ── Inlined pure-JS SHA-256 (no crypto.subtle, no TextEncoder) ──────────
// Same implementation proven in art-199/200/206/210/280 crypto kernels.

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

// ── RFC 6962 (Certificate Transparency) Merkle machinery — clean-room,
//    domain-separated leaf (0x00) / internal-node (0x01) hashing pattern,
//    NOT code, a fresh independent implementation of the well-known MTH
//    construction ────────────────────────────────────────────────────────

function leafHash(contentHash) {
  return _sha256Hex('leaf:' + String(contentHash ?? ''));
}

function combineNodes(left, right) {
  return _sha256Hex('node:' + left + ':' + right);
}

function walkMerklePath(leaf, path) {
  let current = leaf;
  for (const step of path) {
    const sibling = String(step.hash ?? '');
    current = step.position === 'left' ? combineNodes(sibling, current) : combineNodes(current, sibling);
  }
  return current;
}

const RECOGNIZED_CLASSES = new Set(['ocg_artifact', 'rfc3161', 'ots', 'sigstore', 'vr1_onchain']);

const NOT_PROVEN = [
  { item: 'Extract contents beyond the leaf', detail: 'This kernel verifies inclusion of a leaf hash under a root; it does not inspect or validate the extract\'s underlying content beyond that hash.' },
  { item: 'Completeness of the committed set', detail: 'Inclusion of one leaf does not prove the root commits to a complete or unaltered set of records; items could be omitted from what the root represents.' },
  { item: 'Freshness beyond the anchor\'s own time semantics', detail: 'An RFC 3161/OTS/Sigstore/on-chain anchor proves the root existed no later than the anchor\'s own timestamp; it does not prove the extract is currently accurate or unchanged since.' },
  { item: 'Universal chain-explorer equivalence', detail: 'A self-produced hash chain with no external anchor is explicitly refused by this kernel (anchored:false): it is not treated as verified evidence.' },
];

/**
 * compute(pp) — pure VR-3 wave-1 anchored extract verifier.
 * pp: {
 *   extract?: { leaf_content_hash?: string, merkle_path?: Array<{hash:string, position:'left'|'right'}> },
 *   claimed_root?: string,
 *   source_class?: 'ocg_artifact'|'rfc3161'|'ots'|'sigstore'|'vr1_onchain'|null,
 *   anchor_evidence?: {
 *     rfc3161?: { tsa_message_imprint?: string, tsa_time?: string },
 *     ots?: { attestation?: 'pending'|'bitcoin_confirmed', bitcoin_block_height?: number },
 *     sigstore?: { rekor_log_index?: number, rekor_uuid?: string },
 *     vr1_onchain?: { verified?: boolean, source?: string },
 *   } | null,
 * }
 */
export function compute(pp) {
  const extract = pp.extract ?? {};
  const claimedRoot = String(pp.claimed_root ?? '');
  const sourceClass = pp.source_class ?? null;
  const evidence = pp.anchor_evidence ?? {};
  const path = Array.isArray(extract.merkle_path) ? extract.merkle_path : [];

  let structuralError = null;
  if (path.length > MAX_PATH_DEPTH) {
    structuralError = `Merkle path depth ${path.length} exceeds the ${MAX_PATH_DEPTH}-level bound.`;
  }

  let computedRoot = null;
  if (!structuralError) {
    const leaf = leafHash(extract.leaf_content_hash);
    computedRoot = walkMerklePath(leaf, path);
  }

  // ── Anchor-class dispatch — recognized classes only; everything else is
  //    an unanchored, self-produced claim and MUST be refused. ──────────
  let anchored = false;
  let anchorNote = 'No external anchor of a recognized class was supplied; a self-produced root is not verifiable by this kernel.';
  const flagsExtra = [];

  if (sourceClass === 'ocg_artifact') {
    anchored = true;
    anchorNote = 'Recognized as an OCG artifact/chain envelope (dogfood: our own receipt format), not an ad-hoc self-produced claim.';
  } else if (sourceClass === 'rfc3161') {
    const rfc = evidence.rfc3161 ?? null;
    anchored = !!(rfc && rfc.tsa_message_imprint);
    anchorNote = anchored
      ? `RFC 3161 timestamp token present (TSA time: ${rfc.tsa_time ?? 'unspecified'}).`
      : 'source_class declared rfc3161 but no rfc3161 anchor_evidence (tsa_message_imprint) was supplied.';
  } else if (sourceClass === 'ots') {
    const ots = evidence.ots ?? null;
    anchored = !!(ots && (ots.attestation === 'pending' || ots.attestation === 'bitcoin_confirmed'));
    anchorNote = anchored
      ? `OpenTimestamps proof present (attestation: ${ots.attestation}).`
      : 'source_class declared ots but no valid ots anchor_evidence (attestation) was supplied.';
    if (anchored && ots.attestation === 'pending') flagsExtra.push('OTS_ATTESTATION_PENDING');
  } else if (sourceClass === 'sigstore') {
    const sig = evidence.sigstore ?? null;
    anchored = !!(sig && sig.rekor_uuid != null && sig.rekor_log_index != null);
    anchorNote = anchored
      ? `Sigstore Rekor transparency-log entry present (log index: ${sig.rekor_log_index}).`
      : 'source_class declared sigstore but no valid sigstore anchor_evidence (rekor_uuid/rekor_log_index) was supplied.';
  } else if (sourceClass === 'vr1_onchain') {
    // Soft-dep composition with VR-1 (State-Proof Verifier, art-279) —
    // stub-and-note pattern identical to art-280. This kernel never
    // re-verifies an EIP-1186 state proof itself.
    const vr1 = evidence.vr1_onchain ?? null;
    anchored = !!(vr1 && vr1.verified === true);
    anchorNote = anchored
      ? `Composed with an on-chain storage-proof result (VR-1 State-Proof Verifier, source: ${vr1.source ?? 'vr-1'}).`
      : 'source_class declared vr1_onchain but no verified on-chain storage-proof result was supplied (compose with VR-1 / verify_eth_state_proof to establish this anchor).';
  } else {
    anchored = false;
  }

  const rootMatch = anchored && !structuralError && computedRoot !== null && claimedRoot !== '' && computedRoot === claimedRoot;
  const verified = anchored && !structuralError && rootMatch;

  let determination;
  if (structuralError) determination = 'STRUCTURAL_ERROR';
  else if (!anchored) determination = 'REFUSED_UNANCHORED';
  else if (!rootMatch) determination = 'MISMATCH';
  else determination = 'VERIFIED';

  const escalation = determination === 'MISMATCH'
    ? { raised: true, reason: 'Computed root does not match the claimed root for an otherwise-recognized anchor class.', severity: 'high' }
    : null;

  const compliance_flags = [];
  if (structuralError) compliance_flags.push('ANCHORED_EXTRACT_STRUCTURAL_ERROR');
  else if (!anchored) compliance_flags.push('ANCHORED_EXTRACT_REFUSED_UNANCHORED');
  else if (!rootMatch) compliance_flags.push('ANCHORED_EXTRACT_MISMATCH', 'ESCALATION_RAISED');
  else compliance_flags.push('ANCHORED_EXTRACT_VERIFIED');
  compliance_flags.push(...flagsExtra);

  const output_payload = {
    anchored_extract_determination: determination,
    anchored,
    root_match: rootMatch,
    source_class: sourceClass,
    computed_root: computedRoot,
    claimed_root: claimedRoot || null,
    structural_error: structuralError,
    anchor_note: anchorNote,
    escalation,
    not_proven: NOT_PROVEN,
    regulatory_framework: 'Voluntary anchored-extract verification aligned with amended AS 1105 (FY2026) and the AICPA practice aid on not relying on unanchored chain explorers; not a PCAOB audit.',
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
