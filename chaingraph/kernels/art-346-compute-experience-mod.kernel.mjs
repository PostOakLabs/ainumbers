import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-346-compute-experience-mod';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_experience_mod',
  mandate_type: 'compliance_mandate', gpu: false,
};

// NCCI workers'-compensation experience rating modification formula
// (Experience Rating Plan Manual, published national formula):
//   Mod = (Ap + W*Ae + (1-W)*Ee + B) / (Ep + B)
// where Ap/Ae are actual primary/excess losses (split per claim at the
// state's per-claim split point), Ee = expected excess losses (expected
// losses minus expected primary losses), W = weighting (credibility)
// value, B = ballast value. The per-claim primary/excess split is the
// PUBLISHED part of the formula; the split-point dollar value, expected
// losses, expected primary losses, weighting value, and ballast value all
// come from NCCI/state rating tables and rating-bureau filings that are
// licensed -- this kernel takes them AS INPUTS (from the caller's NCCI
// experience rating worksheet) and never vendors or reproduces the tables.
//
// Pure ECMA-262 arithmetic only -- no Math.pow, no Date.now/new Date(),
// no Math.random. Mod rounded to 2 decimal places per NCCI convention.

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

export function compute(pp) {
  pp = pp || {};

  const claims = Array.isArray(pp.claims) ? pp.claims : [];
  const splitPoint = safeNum(pp.split_point, 0);
  const expectedLosses = safeNum(pp.expected_losses, 0);
  const expectedPrimaryLosses = safeNum(pp.expected_primary_losses, 0);
  const weightingValue = Math.min(1, Math.max(0, safeNum(pp.weighting_value, 0)));
  const ballastValue = safeNum(pp.ballast_value, 0);

  let actualPrimaryLosses = 0;
  let actualExcessLosses = 0;
  for (const claim of claims) {
    const incurred = Math.max(0, safeNum(claim && claim.incurred_losses, 0));
    actualPrimaryLosses += Math.min(incurred, splitPoint);
    actualExcessLosses += Math.max(incurred - splitPoint, 0);
  }
  actualPrimaryLosses = r2(actualPrimaryLosses);
  actualExcessLosses = r2(actualExcessLosses);
  const actualTotalLosses = r2(actualPrimaryLosses + actualExcessLosses);

  const expectedExcessLosses = r2(expectedLosses - expectedPrimaryLosses);
  const denominator = expectedPrimaryLosses + ballastValue;

  const compliance_flags = [];
  let mod = 0;
  let ratingClass = 'undetermined';
  if (denominator <= 0) {
    compliance_flags.push('EXPMOD_ZERO_DENOMINATOR');
  } else {
    const numerator = actualPrimaryLosses + (weightingValue * actualExcessLosses)
      + ((1 - weightingValue) * expectedExcessLosses) + ballastValue;
    mod = r2(numerator / denominator);
    ratingClass = mod > 1 ? 'debit' : (mod < 1 ? 'credit' : 'unity');
  }

  const output_payload = {
    mod,
    rating_class: ratingClass,
    actual_primary_losses: actualPrimaryLosses,
    actual_excess_losses: actualExcessLosses,
    actual_total_losses: actualTotalLosses,
    expected_losses: r2(expectedLosses),
    expected_primary_losses: r2(expectedPrimaryLosses),
    expected_excess_losses: expectedExcessLosses,
    split_point: r2(splitPoint),
    weighting_value: weightingValue,
    ballast_value: r2(ballastValue),
    claim_count: claims.length,
    regulatory_basis: 'NCCI Experience Rating Plan Manual (published national experience rating formula: Mod = (Ap + W×Ae + (1-W)×Ee + B) / (Ep + B))',
    note: 'Split point, expected losses, expected primary losses, weighting value, and ballast value are licensed NCCI/state rating-bureau table values supplied by the caller from their own NCCI experience rating worksheet -- this kernel never vendors or reproduces those tables, only the published per-claim split and mod formula.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
