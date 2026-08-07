// art-584 — Proof-of-Reserves Verifier: pure decision kernel.
// Faithful port of compute() in
//   repo/chaingraph/art-584-proof-of-reserves-verifier.html
// Pure: no DOM, no window, no network, no host crypto (SHA-256 is hand-rolled
// pure-JS — same inlined implementation proven in art-199/200/206/210/280
// crypto kernels; crypto.subtle is banned in the zkVM guest).
//
// EDGE-POR-1 — EDGE-WAVE-BUILD-SPEC.md §3. Independent verifier for an
// exchange/custodian's PUBLISHED PoR data: recomputes (a) a single-leaf
// Merkle-sum inclusion proof, (b) a liability-side Merkle-sum branch
// aggregation, and (c) a coverage ratio from the two recomputed sums plus a
// caller-declared published reserve figure. Verdict per check + an overall
// CONSISTENT | INCONSISTENT | INDETERMINATE — never a solvency claim (see
// NOT_PROVEN below and the in-page guard text).
//
// Mirror of the shipped art-540 por-liabilities-composer (composes an art-280
// inclusion result with a caller-asserted liabilities total) and art-280
// reserve-proof-verifier (single-leaf Merkle-sum inclusion). This node is
// NOT a composer — it independently recomputes BOTH the reserve inclusion
// path and the liability aggregation branch from raw Merkle-sum path data,
// rather than taking a pre-verified boolean as a soft dependency.
//
// ⛔ GENERIC SCHEMA ONLY (EDGE-WAVE-BUILD-SPEC.md §3 guard) — no per-exchange
// adapter code. Named-exchange field-name differences are documented as a
// static mapping reference in the page copy, which the user applies before
// pasting data in. This is a deliberate divergence from art-280's runtime
// per-exchange `normalizeProof` switch: that pattern creates a standing
// maintenance duty every time an exchange revises its export schema, which
// this row's guard explicitly rules out.
//
// Bounded inputs only (art-201 lesson): Merkle path depth on both trees is
// capped so SHA-256 runs over a small, finite, provable amount of data.
//
// HARD NON-CLAIM (receipt MUST record this): CONSISTENT means the recomputed
// inclusion path, the recomputed liability branch, and the caller-declared
// reserve figure are arithmetically and structurally consistent with each
// other — never that the exchange is solvent, that the published data is
// truthful, or that the liability set is complete. The data's truth is the
// attestor's problem; this kernel only checks internal consistency of what
// was published.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-584-proof-of-reserves-verifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'verify_proof_of_reserves_consistency',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

// ── bounded-input limits (exec-check-friendly, art-201 lesson) ──────────
const MAX_PATH_DEPTH = 40; // log2(N) for N up to ~1 trillion leaves; hard ceiling
const COVERAGE_TOLERANCE_PCT = 0.01; // reserve-figure vs recomputed-root-sum cross-check tolerance

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

// ── Merkle-sum-tree machinery (clean-room; RFC 6962 pattern, NOT code, reused
//    from the anchor evidence-worker merkle.mjs — this kernel is a fresh,
//    independent implementation; same construction proven in art-280) ──────

function leafNode(label, sum) {
  const s = Number(sum ?? 0);
  return { hash: _sha256Hex(`${label ?? ''}|${s}`), sum: s };
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

// ── GENERIC schema normalization only (EDGE-WAVE-BUILD-SPEC.md §3 guard —
//    ⛔ no per-exchange adapters). raw is already expected in the canonical
//    {leaf_user_id_hash, leaf_balance, path:[{hash,sum,position}], root:{hash,sum}}
//    shape; the page ships a static field-mapping reference for named
//    exchange export formats that the user applies before pasting. ─────────

function normalizeReserveProof(raw) {
  raw = raw ?? {};
  const path = (raw.path ?? []).map((p) => ({
    hash: p.hash,
    sum: Number(p.sum ?? 0),
    position: p.position === 'left' ? 'left' : 'right',
  }));
  return {
    leaf: leafNode(raw.leaf_user_id_hash, raw.leaf_balance),
    path,
    root: { hash: String(raw.root?.hash ?? ''), sum: Number(raw.root?.sum ?? 0) },
  };
}

function normalizeLiabilityBranch(raw) {
  raw = raw ?? {};
  const path = (raw.path ?? []).map((p) => ({
    hash: p.hash,
    sum: Number(p.sum ?? 0),
    position: p.position === 'left' ? 'left' : 'right',
  }));
  return {
    leaf: leafNode(raw.leaf_label ?? 'liability-branch-leaf', raw.leaf_sum),
    path,
    root: { hash: String(raw.root?.hash ?? ''), sum: Number(raw.root?.sum ?? 0) },
  };
}

const NOT_PROVEN = [
  { item: 'Total liabilities completeness', detail: 'A single liability-branch aggregation proves that branch\'s subtotal sums correctly; it cannot detect an issuer omitting accounts from the liability tree entirely.' },
  { item: 'Off-balance-sheet encumbrances', detail: 'Pledges, rehypothecation, or liens against reserve assets are not visible in a Merkle-sum inclusion or aggregation proof.' },
  { item: 'Continuous solvency', detail: 'This is a point-in-time snapshot at attestation time, not a continuous or real-time solvency guarantee.' },
  { item: 'Data truthfulness', detail: 'This tool checks internal consistency of the published data (do the recomputed sums and hashes match what was declared). Whether the underlying published figures are themselves true is the attestor\'s problem, not something this recomputation can determine.' },
  { item: 'PCAOB audit opinion', detail: 'This tool performs no audit and carries no PCAOB or other audit-firm opinion; it is a cryptographic consistency check only.' },
];

/**
 * compute(pp) — pure EDGE-POR-1 proof-of-reserves verifier.
 * pp: {
 *   reserve_proof?: { leaf_user_id_hash?: string, leaf_balance?: number,
 *                      path?: [{hash,sum,position}], root?: {hash,sum} } | null,
 *   liability_branch?: { leaf_label?: string, leaf_sum?: number,
 *                         path?: [{hash,sum,position}], root?: {hash,sum} } | null,
 *   published_reserve_figures?: { total_reserves_usd?: number, as_of?: string, source?: string } | null,
 * }
 */
export function compute(pp) {
  const reserveProofRaw = pp.reserve_proof ?? null;
  const liabilityBranchRaw = pp.liability_branch ?? null;
  const publishedFigures = pp.published_reserve_figures ?? null;

  const findings = [];

  // ── Check 1: reserve inclusion (single-leaf Merkle-sum path) ────────────
  let inclusionVerdict, inclusionDetail, computedReserveRoot = null, declaredReserveRoot = null;
  let inclusionVerified = false;
  if (!reserveProofRaw) {
    inclusionVerdict = 'INDETERMINATE';
    inclusionDetail = 'No reserve_proof supplied. Inclusion cannot be checked.';
  } else {
    const proof = normalizeReserveProof(reserveProofRaw);
    declaredReserveRoot = proof.root;
    if (proof.path.length > MAX_PATH_DEPTH) {
      inclusionVerdict = 'INDETERMINATE';
      inclusionDetail = `Reserve Merkle path depth ${proof.path.length} exceeds the ${MAX_PATH_DEPTH}-level bound.`;
    } else {
      computedReserveRoot = walkMerkleSumPath(proof.leaf, proof.path);
      const rootHashMatch = computedReserveRoot.hash === proof.root.hash && proof.root.hash !== '';
      const sumMatch = computedReserveRoot.sum === proof.root.sum;
      inclusionVerified = rootHashMatch && sumMatch;
      if (inclusionVerified) {
        inclusionVerdict = 'CONSISTENT';
        inclusionDetail = `Recomputed inclusion path reaches the declared root (hash match, sum ${computedReserveRoot.sum}).`;
      } else {
        inclusionVerdict = 'INCONSISTENT';
        inclusionDetail = `Recomputed root ${rootHashMatch ? 'hash matches' : 'hash does NOT match'} the declared root; sum ${sumMatch ? 'matches' : `computed ${computedReserveRoot.sum} vs declared ${proof.root.sum}`}.`;
      }
    }
  }
  findings.push({ check: 'reserve_inclusion', verdict: inclusionVerdict, detail: inclusionDetail });

  // ── Check 2: liability aggregation (Merkle-sum branch) ──────────────────
  let liabilityVerdict, liabilityDetail, computedLiabilityRoot = null, declaredLiabilityRoot = null;
  let liabilityVerified = false;
  if (!liabilityBranchRaw) {
    liabilityVerdict = 'INDETERMINATE';
    liabilityDetail = 'No liability_branch supplied. Liability aggregation cannot be checked.';
  } else {
    const branch = normalizeLiabilityBranch(liabilityBranchRaw);
    declaredLiabilityRoot = branch.root;
    if (branch.path.length > MAX_PATH_DEPTH) {
      liabilityVerdict = 'INDETERMINATE';
      liabilityDetail = `Liability Merkle path depth ${branch.path.length} exceeds the ${MAX_PATH_DEPTH}-level bound.`;
    } else {
      computedLiabilityRoot = walkMerkleSumPath(branch.leaf, branch.path);
      const rootHashMatch = computedLiabilityRoot.hash === branch.root.hash && branch.root.hash !== '';
      const sumMatch = computedLiabilityRoot.sum === branch.root.sum;
      liabilityVerified = rootHashMatch && sumMatch;
      if (liabilityVerified) {
        liabilityVerdict = 'CONSISTENT';
        liabilityDetail = `Recomputed liability branch reaches the declared branch root (hash match, aggregated sum ${computedLiabilityRoot.sum}).`;
      } else {
        liabilityVerdict = 'INCONSISTENT';
        liabilityDetail = `Recomputed liability branch root ${rootHashMatch ? 'hash matches' : 'hash does NOT match'} the declared root; sum ${sumMatch ? 'matches' : `computed ${computedLiabilityRoot.sum} vs declared ${branch.root.sum}`}.`;
      }
    }
  }
  findings.push({ check: 'liability_aggregation', verdict: liabilityVerdict, detail: liabilityDetail });

  // ── Check 3: coverage ratio (recomputed reserve sum vs recomputed
  //    liability sum), plus a cross-check against a caller-declared
  //    published reserve figure if supplied ───────────────────────────────
  let coverageVerdict, coverageDetail, coverageRatioPct = null, reserveFigureCrossCheck = null;
  const haveReserveSum = computedReserveRoot !== null && inclusionVerdict !== 'INDETERMINATE';
  const haveLiabilitySum = computedLiabilityRoot !== null && liabilityVerdict !== 'INDETERMINATE';
  if (!haveReserveSum || !haveLiabilitySum) {
    coverageVerdict = 'INDETERMINATE';
    coverageDetail = 'Coverage ratio requires both a recomputed reserve sum and a recomputed liability sum; at least one is missing or malformed.';
  } else {
    const reserveSum = computedReserveRoot.sum;
    const liabilitySum = computedLiabilityRoot.sum;
    if (liabilitySum <= 0) {
      coverageVerdict = 'INDETERMINATE';
      coverageDetail = 'Recomputed liability sum is zero or negative. Coverage ratio is undefined.';
    } else {
      coverageRatioPct = parseFloat(((reserveSum / liabilitySum) * 100).toFixed(4));
      coverageVerdict = 'CONSISTENT';
      coverageDetail = `Recomputed reserves (${reserveSum}) are ${coverageRatioPct.toFixed(2)}% of recomputed liabilities (${liabilitySum}). Consistent with the published data, not an independent solvency determination.`;
    }

    if (publishedFigures && publishedFigures.total_reserves_usd != null) {
      const published = Number(publishedFigures.total_reserves_usd);
      const deltaPct = reserveSum > 0
        ? parseFloat((Math.abs(published - reserveSum) / reserveSum * 100).toFixed(4))
        : (published === 0 ? 0 : null);
      const withinTolerance = deltaPct !== null && deltaPct <= COVERAGE_TOLERANCE_PCT;
      reserveFigureCrossCheck = {
        published_total_reserves_usd: published,
        recomputed_reserve_sum: reserveSum,
        delta_pct: deltaPct,
        within_tolerance: withinTolerance,
        as_of: publishedFigures.as_of ?? null,
        source: publishedFigures.source ?? null,
      };
      if (!withinTolerance) {
        coverageVerdict = coverageVerdict === 'CONSISTENT' ? 'INCONSISTENT' : coverageVerdict;
        coverageDetail += ` Published reserve figure (${published}) diverges from the recomputed reserve sum by ${deltaPct === null ? 'n/a' : deltaPct + '%'}, exceeding the ${COVERAGE_TOLERANCE_PCT}% tolerance.`;
      }
    }
  }
  findings.push({ check: 'coverage_ratio', verdict: coverageVerdict, detail: coverageDetail });

  const verdicts = findings.map((f) => f.verdict);
  let overall_determination;
  if (verdicts.includes('INCONSISTENT')) overall_determination = 'INCONSISTENT';
  else if (verdicts.includes('INDETERMINATE')) overall_determination = 'INDETERMINATE';
  else overall_determination = 'CONSISTENT';

  const compliance_flags = [];
  if (overall_determination === 'INCONSISTENT') compliance_flags.push('POR_INCONSISTENT');
  if (overall_determination === 'INDETERMINATE') compliance_flags.push('POR_INDETERMINATE');
  if (inclusionVerdict === 'INCONSISTENT') compliance_flags.push('RESERVE_INCLUSION_MISMATCH');
  if (liabilityVerdict === 'INCONSISTENT') compliance_flags.push('LIABILITY_AGGREGATION_MISMATCH');
  if (reserveFigureCrossCheck && !reserveFigureCrossCheck.within_tolerance) compliance_flags.push('PUBLISHED_FIGURE_DIVERGENCE');
  if (overall_determination === 'CONSISTENT') compliance_flags.push('POR_CONSISTENT_WITH_PUBLISHED_DATA');

  const output_payload = {
    overall_determination,
    findings,
    computed_reserve_root: computedReserveRoot,
    declared_reserve_root: declaredReserveRoot,
    computed_liability_root: computedLiabilityRoot,
    declared_liability_root: declaredLiabilityRoot,
    coverage_ratio_pct: coverageRatioPct,
    reserve_figure_cross_check: reserveFigureCrossCheck,
    not_proven: NOT_PROVEN,
    determination_note: 'Verdict language describes internal consistency of the published PoR data only, never a solvency claim or an audit opinion. The truth of the underlying published figures is the attestor\'s responsibility.',
    regulatory_framework: 'Voluntary Merkle-sum PoR attestation (Summa report structure); not a GENIUS Act §4 filing (see art-582/art-275/art-06) and not a PCAOB audit.',
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
