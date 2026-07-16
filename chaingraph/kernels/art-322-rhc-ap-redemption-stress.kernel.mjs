/**
 * art-322-rhc-ap-redemption-stress.kernel.mjs
 * AP Concentration + Redemption-Path Stress — Robinhood Chain stock tokens.
 * BBVI is the sole Authorised Participant at issuance; only APs may subscribe/redeem directly from
 * RHJ after KYB. Stress-tests the "1 token = 1 share economic exposure" claim against actual
 * redemption reachability. Not investment advice — enumerates structural dependency only.
 * Pure decision kernel — no DOM, no window, no Date.now().
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-322-rhc-ap-redemption-stress';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mandate_type: 'collateral_mandate',
  mcp_name:     'stress_test_ap_redemption_path',
  gpu:          false,
};

export function compute(pp) {
  const {
    authorised_participants = [],       // [{ name, active }]
    secondary_market_depth = {},         // { daily_volume_usd, bid_ask_spread_bps }
    issuer_credit = {},                  // { obligor, rating_available }
  } = pp;

  const active_aps = authorised_participants.filter(ap => ap && ap.active === true);
  const ap_count = active_aps.length;

  let concentration_risk;
  if (ap_count <= 1) concentration_risk = 'SINGLE_AP_CONCENTRATION';
  else if (ap_count <= 3) concentration_risk = 'ELEVATED';
  else concentration_risk = 'DIVERSIFIED';

  const redemption_path = 'secondary_market_only';
  const redemption_reachable_for_non_ap = false;
  const premium_discount_exposure = concentration_risk === 'SINGLE_AP_CONCENTRATION';

  const daily_volume_usd = typeof secondary_market_depth.daily_volume_usd === 'number' ? secondary_market_depth.daily_volume_usd : null;
  const liquidity_flag = daily_volume_usd !== null ? (daily_volume_usd < 100000 ? 'THIN' : 'ADEQUATE') : 'UNKNOWN';

  const issuer_credit_exposure_distinct = true; // RHJ obligor risk is distinct from underlying-equity exposure by construction

  const structural_dependencies = [];
  if (premium_discount_exposure) structural_dependencies.push('sole_AP_market_making_dependency');
  if (redemption_reachable_for_non_ap === false) structural_dependencies.push('non_AP_holders_cannot_redeem_directly_from_RHJ');
  structural_dependencies.push('issuer_credit_exposure_to_' + (issuer_credit.obligor ?? 'RHJ') + '_distinct_from_underlying_equity');
  if (liquidity_flag === 'THIN') structural_dependencies.push('thin_secondary_market_depth');

  const output_payload = {
    verdict: 'STRESS_ENUMERATED',
    ap_count,
    concentration_risk,
    redemption_path,
    redemption_reachable_for_non_ap,
    premium_discount_exposure,
    issuer_credit_exposure_distinct,
    liquidity_flag,
    structural_dependencies,
    not_investment_advice: 'This node enumerates structural dependency only. It does not recommend a position.',
  };

  const compliance_flags = ['RHC_AP_STRESS_ENUMERATED'];
  if (concentration_risk === 'SINGLE_AP_CONCENTRATION') compliance_flags.push('RHC_SINGLE_AP_CONCENTRATION');

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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
