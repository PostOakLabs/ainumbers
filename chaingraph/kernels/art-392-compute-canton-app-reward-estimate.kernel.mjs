import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-392-compute-canton-app-reward-estimate';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_canton_app_reward_estimate',
  mandate_type: 'analytics_mandate', gpu: false,
};

// Canton Network CIP-0104 traffic-based app-reward estimator (approved 2026-02-12), per
// RC-CANTON build row #5 (future-wave-candidates-2026-07-02.md). Featured-app markers are
// gone under CIP-0104: app rewards are proportional to the envelope bytes where an
// app-provider party appears as a confirmer, measured against that round's app-reward pool
// share of the CC minting curve. Published minting-curve app-reward pool share: 62% at
// launch, rising to 69% at year 5 and 75% at year 10 -- ALWAYS caller-supplied here (never
// hard-coded), because the share itself is a schedule, not a constant. Formula:
//   confirmed_share_of_traffic = confirmed_envelope_bytes / round_total_envelope_bytes
//   app_reward_pool_cc         = round_total_mint_cc x app_reward_pool_share
//   cc_reward_estimate         = confirmed_share_of_traffic x app_reward_pool_cc
// Source: global-synchronizer-foundation CIPs repo (CIP-0104). Pure ECMA-262 arithmetic
// only -- no Math.pow, no Date.now/new Date(), no Math.random.

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r6(v) { return Number.isFinite(v) ? Math.round(v * 1000000) / 1000000 : 0; }
function r8(v) { return Number.isFinite(v) ? Math.round(v * 100000000) / 100000000 : 0; }

export function compute(pp) {
  pp = pp || {};
  const confirmedEnvelopeBytes = safeNum(pp.confirmed_envelope_bytes, 0);
  const roundTotalEnvelopeBytes = safeNum(pp.round_total_envelope_bytes, 0);
  const roundTotalMintCc = safeNum(pp.round_total_mint_cc, 0);
  const appRewardPoolShare = safeNum(pp.app_reward_pool_share, 0.62);
  const protocolVersion = String(pp.protocol_version || '').trim();

  const compliance_flags = [];
  if (confirmedEnvelopeBytes < 0) compliance_flags.push('CANTON_NEGATIVE_CONFIRMED_ENVELOPE');
  if (roundTotalEnvelopeBytes <= 0) compliance_flags.push('CANTON_ZERO_ROUND_TRAFFIC');
  if (confirmedEnvelopeBytes > roundTotalEnvelopeBytes) compliance_flags.push('CANTON_CONFIRMED_EXCEEDS_ROUND_TOTAL');
  if (appRewardPoolShare < 0 || appRewardPoolShare > 1) compliance_flags.push('CANTON_INVALID_POOL_SHARE');
  if (!protocolVersion) compliance_flags.push('CANTON_PROTOCOL_VERSION_UNPINNED');

  const confirmedShareOfTraffic = roundTotalEnvelopeBytes > 0 ? confirmedEnvelopeBytes / roundTotalEnvelopeBytes : 0;
  const appRewardPoolCc = roundTotalMintCc * appRewardPoolShare;
  const ccRewardEstimate = confirmedShareOfTraffic * appRewardPoolCc;

  const output_payload = {
    protocol_version: protocolVersion,
    confirmed_envelope_bytes: confirmedEnvelopeBytes,
    round_total_envelope_bytes: roundTotalEnvelopeBytes,
    confirmed_share_of_traffic: r8(confirmedShareOfTraffic),
    round_total_mint_cc: roundTotalMintCc,
    app_reward_pool_share: appRewardPoolShare,
    app_reward_pool_cc: r6(appRewardPoolCc),
    cc_reward_estimate: r6(ccRewardEstimate),
    pool_share_source: 'CIP-0104 (approved 2026-02-12): featured-app markers removed, app rewards proportional to confirmed envelope bytes against the app-reward pool share of the minting curve. Published schedule: 62% at launch, rising to 69% at year 5 and 75% at year 10 -- this kernel never hard-codes a year-specific share; caller supplies the schedule point being estimated.',
    disambiguation: 'Estimates one app provider\'s CC reward share for one round from confirmed traffic. For synchronizer traffic COST (the fee side, not the reward side), see compute_canton_traffic_cost (art-391).',
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
