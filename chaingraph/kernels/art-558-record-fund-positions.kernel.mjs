// art-558 — Record Fund Positions: pure attestation kernel.
//
// First upstream node of the NAV Calc Receipt Chain lineage extension
// (NAV-LINEAGE-BUILD-SPEC.md §1, `research/VERTWU-SCOPE-1-2026-08-05.md`). The
// proven NAV chain (art-373/374/375) hashes its holdings internally; this node
// gives the DECLARED positions snapshot that fed a NAV calculation its own
// citable execution_hash, so `art-373-recompute-fund-nav` can cite it via an
// optional `positions_ref` (a separate WU, NAV-LIN-WIRE-1) instead of
// re-declaring the same holdings inside its own policy_parameters.
//
// HARD FENCE (receipt MUST record this, copy MUST lead with it): fund_id,
// valuation_date, every holding row, and shares_outstanding are all SUPPLIED
// by the caller and merely ASSERTED -- this kernel performs zero custodian,
// fund-administrator, or market-data lookups (zero-egress by contract, no
// network calls of any kind, never a live position feed). It attests THAT a
// declared positions snapshot exists exactly as stated for the given fund and
// date -- nothing about its accuracy against a custodian record. Fence matches
// art-373 and art-557: supplied and asserted, never verified.
//
// §25 PRIVATE-INPUTS JUDGEMENT (SPEC.md §25) -- RULED NOT APPLICABLE, STATED
// EXPLICITLY. Fund holdings are exactly the shape §25 warns about: often
// enumerable, and a real fund's exact portfolio is commercially sensitive. But
// this node's entire purpose, per NAV-LINEAGE-BUILD-SPEC.md §1, is the
// opposite of a §25 commitment: it echoes the declared holdings back in
// cleartext inside output_payload and mints `positions_digest` as nothing
// other than this artifact's own execution_hash (no second canonicalization,
// no parallel digest). A salted `sha256-salted@1` commitment over the holdings
// would defeat the node's stated function -- downstream lineage (NAV-LIN-WIRE-1)
// cites this artifact's execution_hash precisely so a reader can dereference
// it back to the declared snapshot content, not merely a commitment to it.
// §25 remains available to a CALLER who chooses to keep a real portfolio out
// of a public artifact entirely (by not calling this node, or by supplying a
// redacted/aggregated snapshot) -- that choice belongs to the caller, not to
// this kernel silently hiding data the spec requires it to echo.
//
// Corrections use the SPEC.md §1 top-level `supersedes` field (no bespoke
// status registry): a restated positions snapshot cites the prior artifact's
// execution_hash via the caller-supplied `supersedes` option to buildArtifact().

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-558-record-fund-positions';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'record_fund_positions',
  mandate_type: 'attestation_mandate',
  gpu: false,
};

const NOT_PROVEN = [
  { item: 'Custodian-record match', detail: 'This kernel attests that a declared positions snapshot exists exactly as stated for the given fund and valuation date. It does not itself verify the snapshot against any custodian, prime broker, or fund-administrator record.' },
  { item: 'Holdings-data accuracy', detail: 'Every security_id, quantity, and currency is caller-supplied and asserted. This kernel performs no custodian or market-data lookups (zero-egress) and does not verify these values against any external source.' },
  { item: 'Live position feed', detail: 'All inputs are point-in-time as supplied by the caller for the stated valuation_date; this kernel makes no claim about a live or real-time position feed and makes none of its own calls.' },
  { item: 'NAV or pricing computation', detail: 'This kernel records a positions snapshot only. It performs no pricing, valuation, or NAV-per-share arithmetic -- that is art-373-recompute-fund-nav, which may cite this artifact\'s execution_hash via a positions_ref rather than re-declaring holdings.' },
];

function normalizeHolding(h) {
  h = h || {};
  const quantity = typeof h.quantity === 'number' && Number.isFinite(h.quantity) ? h.quantity : null;
  return {
    security_id: h.security_id ?? null,
    quantity,
    currency: h.currency ?? null,
  };
}

/**
 * compute(pp) — pure positions-snapshot attestation kernel.
 * pp: {
 *   fund_id: string,
 *   valuation_date: string,
 *   holdings: [{ security_id, quantity, currency }],
 *   shares_outstanding: number,
 * }
 */
export function compute(pp) {
  pp = pp || {};
  const fundId = pp.fund_id ?? null;
  const valuationDate = pp.valuation_date ?? null;
  const holdingsRaw = Array.isArray(pp.holdings) ? pp.holdings : [];
  const holdings = holdingsRaw.map(normalizeHolding);
  const sharesOutstanding = typeof pp.shares_outstanding === 'number' && Number.isFinite(pp.shares_outstanding) && pp.shares_outstanding > 0
    ? pp.shares_outstanding : null;

  let structuralError = null;
  if (!fundId) structuralError = 'fund_id is required.';
  else if (!valuationDate) structuralError = 'valuation_date is required.';
  else if (holdings.length === 0) structuralError = 'holdings must be a non-empty array.';
  else if (sharesOutstanding === null) structuralError = 'shares_outstanding is required and must be a positive number.';

  const holdingCount = holdings.length;
  const missingSecurityIds = holdings.filter((h) => !h.security_id).length;
  const invalidQuantities = holdings.filter((h) => h.quantity === null).length;

  const compliance_flags = [];
  if (structuralError) compliance_flags.push('POSITIONS_STRUCTURAL_ERROR');
  else compliance_flags.push('POSITIONS_RECORDED');
  if (!structuralError && missingSecurityIds > 0) compliance_flags.push('POSITIONS_MISSING_SECURITY_ID');
  if (!structuralError && invalidQuantities > 0) compliance_flags.push('POSITIONS_QUANTITY_INVALID');
  if (!structuralError) compliance_flags.push('POSITIONS_INPUTS_SUPPLIED_NOT_VERIFIED');

  const output_payload = {
    fund_id: fundId,
    valuation_date: valuationDate,
    structural_error: structuralError,
    holdings,
    holding_count: holdingCount,
    shares_outstanding: sharesOutstanding,
    not_proven: NOT_PROVEN,
    fence: 'fund_id, valuation_date, every holding row, and shares_outstanding are SUPPLIED, asserted, and digested into this receipt. This kernel attests THAT a declared positions snapshot exists exactly as stated for the given fund and date -- never a verification against a custodian or fund-administrator record, never a live position feed (zero-egress by contract).',
    disclosure_note: 'Holdings are echoed here in cleartext by design (SPEC.md section 25 ruled not applicable, stated explicitly): this artifact\'s own execution_hash IS the positions_digest downstream lineage cites, never a second canonicalization or a salted commitment over the holdings. A caller who needs the snapshot itself kept out of a public artifact should not call this node, or should supply a redacted/aggregated snapshot -- that choice belongs to the caller.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0, supersedes } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  const artifact = {
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
  if (Array.isArray(supersedes) && supersedes.length > 0) {
    artifact.supersedes = supersedes;
  }
  return artifact;
}
