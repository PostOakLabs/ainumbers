import { executionHash } from './_hash.mjs';

// ── art-608 -- ERC-2981 Royalty Calculator: pure decision kernel. ─────────────────────────
// ETHMATH-RIDERS-1 (board WU), anchored on ETHMATH-WAVE-BUILD-SPEC.md section 6 item 3.
//
// ERC-2981 (https://eips.ethereum.org/EIPS/eip-2981) defines royaltyInfo(tokenId, salePrice)
// -> (receiver, royaltyAmount) as a voluntary, off-chain-enforced convention -- marketplaces
// are not required to honor it. This kernel recomputes the royalty amount from a caller-
// declared sale_price and royalty_fraction_bps using the same integer-division convention as
// the OpenZeppelin reference implementation (royaltyAmount = (salePrice * bps) / 10000,
// floored), using BigInt throughout so a sale_price beyond Number.MAX_SAFE_INTEGER never loses
// precision. Zero network calls: this tool never queries a contract's actual royaltyInfo()
// return value -- sale_price, royalty_fraction_bps, and receiver are all caller-declared.
//
// Cross-links (informational, output-only, never fused into the verdict): 528-nft-metadata-
// validator and 521-cant-be-evil-nft-license-picker cover adjacent NFT-standard surfaces this
// tool does not -- metadata shape and license terms respectively.

const FEE_DENOMINATOR = 10000n;

const RELATED_TOOLS = [
  { tool_id: '528-nft-metadata-validator', relation: 'Validates the token metadata JSON this royalty figure would accompany.' },
  { tool_id: '521-cant-be-evil-nft-license-picker', relation: 'Picks the license terms a royalty-bearing NFT is minted under.' },
];

// Non-negative base-10 integer string only -- royalty math is exact integer arithmetic per the
// EIP-2981 reference pattern; a decimal or signed value is rejected rather than coerced, since
// silently truncating a caller's actual sale_price would be the kind of transcription bug this
// tool exists to catch, not commit.
function _parseNonNegativeIntString(v) {
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v < 0 || !Number.isInteger(v)) return null;
    return BigInt(v);
  }
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!/^\d+$/.test(s)) return null;
  return BigInt(s);
}

const SCOPE_NOTE = 'Recomputes an ERC-2981 royalty amount as floor(sale_price * royalty_fraction_bps / 10000), the same integer-division convention the OpenZeppelin reference ERC2981 implementation uses. Zero network calls -- this tool never queries a contract\'s actual royaltyInfo() return value; sale_price, royalty_fraction_bps, and receiver are all caller-declared. ERC-2981 royalty payment is a voluntary off-chain convention: most marketplaces are not required to honor it, and this tool makes no claim that any marketplace will actually pay the computed amount.';

const NOT_PROVEN = [
  { item: 'On-chain royaltyInfo() response', detail: 'This tool never calls a contract\'s royaltyInfo(tokenId, salePrice). sale_price and royalty_fraction_bps are caller-declared, not read from chain state.' },
  { item: 'Marketplace enforcement', detail: 'ERC-2981 is a voluntary signalling standard. A computed royalty amount is what the formula yields, not a guarantee any marketplace will pay it.' },
  { item: 'Per-token royalty override correctness', detail: 'Many ERC-2981 implementations allow a per-token royalty that overrides a contract default. This tool has no way to know which one governs a given tokenId -- royalty_fraction_bps is exactly what the caller declares.' },
];

/**
 * compute(pp) -- pure calculate_erc2981_royalty kernel.
 * pp: {
 *   sale_price: string|number,             -- required, non-negative integer (any base unit)
 *   royalty_fraction_bps: string|number,   -- required, integer basis points (10000 = 100%)
 *   claimed_royalty_amount?: string|number,-- optional, to compare against the recompute
 *   receiver?: string,                     -- optional, echoed only (no cryptographic check in this kernel)
 * }
 */
export function compute(pp) {
  pp = (pp !== null && typeof pp === 'object') ? pp : {};
  const reasons = [];

  const salePrice = _parseNonNegativeIntString(pp.sale_price);
  if (pp.sale_price === undefined || pp.sale_price === null || String(pp.sale_price).trim() === '') {
    reasons.push('sale_price is required');
  } else if (salePrice === null) {
    reasons.push('sale_price must be a non-negative integer (string or number)');
  }

  const bpsRaw = pp.royalty_fraction_bps;
  const bps = _parseNonNegativeIntString(bpsRaw);
  if (bpsRaw === undefined || bpsRaw === null || String(bpsRaw).trim() === '') {
    reasons.push('royalty_fraction_bps is required');
  } else if (bps === null) {
    reasons.push('royalty_fraction_bps must be a non-negative integer (string or number)');
  }

  const claimedRaw = pp.claimed_royalty_amount;
  const claimedHasValue = claimedRaw !== undefined && claimedRaw !== null && String(claimedRaw).trim() !== '';
  let claimedAmount = null;
  if (claimedHasValue) {
    claimedAmount = _parseNonNegativeIntString(claimedRaw);
    if (claimedAmount === null) reasons.push('claimed_royalty_amount must be a non-negative integer (string or number) if supplied');
  }

  const receiverRaw = (typeof pp.receiver === 'string' && pp.receiver.trim() !== '') ? pp.receiver.trim() : null;

  if (reasons.length > 0) {
    return {
      output_payload: {
        overall_determination: 'INDETERMINATE',
        findings: [{ check: 'input_validation', verdict: 'INDETERMINATE', detail: reasons.join('; ') }],
        sale_price: salePrice !== null ? salePrice.toString() : null,
        royalty_fraction_bps: bps !== null ? bps.toString() : null,
        effective_royalty_pct: null,
        computed_royalty_amount: null,
        claimed_royalty_amount: claimedAmount !== null ? claimedAmount.toString() : null,
        receiver: receiverRaw,
        related_tools: RELATED_TOOLS,
        not_proven: NOT_PROVEN,
        scope_note: SCOPE_NOTE,
      },
      compliance_flags: ['ERC2981_INDETERMINATE', 'ERC2981_MALFORMED_INPUT'],
    };
  }

  const computedRoyaltyAmount = (salePrice * bps) / FEE_DENOMINATOR;
  const effectivePct = (Number(bps) / 100).toString() + '%';

  const rangeVerdict = bps <= FEE_DENOMINATOR ? 'CONSISTENT' : 'INCONSISTENT';
  const rangeDetail = bps <= FEE_DENOMINATOR
    ? 'royalty_fraction_bps (' + bps.toString() + ') is within the 0-10000 (0-100%) range the OpenZeppelin reference ERC2981 implementation enforces.'
    : 'royalty_fraction_bps (' + bps.toString() + ') exceeds 10000 (100%) -- the OpenZeppelin reference ERC2981 implementation reverts on this value ("ERC2981: royalty fee will exceed salePrice"). The recompute below still reports the raw arithmetic.';

  let matchVerdict, matchDetail;
  if (claimedAmount === null) {
    matchVerdict = 'INDETERMINATE';
    matchDetail = 'No claimed_royalty_amount was supplied to compare against.';
  } else if (claimedAmount === computedRoyaltyAmount) {
    matchVerdict = 'CONSISTENT';
    matchDetail = 'claimed_royalty_amount matches the recomputed value.';
  } else {
    matchVerdict = 'INCONSISTENT';
    matchDetail = 'claimed_royalty_amount (' + claimedAmount.toString() + ') does NOT match the recomputed value (' + computedRoyaltyAmount.toString() + ').';
  }

  const findings = [
    { check: 'bps_range_validity', verdict: rangeVerdict, detail: rangeDetail },
    { check: 'claimed_amount_match', verdict: matchVerdict, detail: matchDetail },
  ];
  const verdicts = findings.map((f) => f.verdict);
  const overall_determination = verdicts.includes('INCONSISTENT') ? 'INCONSISTENT' : (verdicts.includes('INDETERMINATE') ? 'INDETERMINATE' : 'CONSISTENT');

  const compliance_flags = [];
  if (rangeVerdict === 'CONSISTENT') compliance_flags.push('ERC2981_BPS_IN_RANGE');
  if (rangeVerdict === 'INCONSISTENT') compliance_flags.push('ERC2981_BPS_OUT_OF_RANGE');
  if (matchVerdict === 'CONSISTENT') compliance_flags.push('ERC2981_CLAIMED_MATCH');
  if (matchVerdict === 'INCONSISTENT') compliance_flags.push('ERC2981_CLAIMED_MISMATCH');
  if (matchVerdict === 'INDETERMINATE') compliance_flags.push('ERC2981_NO_CLAIM');

  const output_payload = {
    overall_determination,
    findings,
    sale_price: salePrice.toString(),
    royalty_fraction_bps: bps.toString(),
    effective_royalty_pct: effectivePct,
    computed_royalty_amount: computedRoyaltyAmount.toString(),
    claimed_royalty_amount: claimedAmount !== null ? claimedAmount.toString() : null,
    receiver: receiverRaw,
    related_tools: RELATED_TOOLS,
    not_proven: NOT_PROVEN,
    scope_note: SCOPE_NOTE,
  };

  return { output_payload, compliance_flags };
}

const TOOL_ID = 'art-608-erc2981-royalty-calculator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'calculate_erc2981_royalty',
  mandate_type: 'payment_policy',
  gpu: false,
};

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
    compute_proof_ready: 'deferred',
    audit_signature:     { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
