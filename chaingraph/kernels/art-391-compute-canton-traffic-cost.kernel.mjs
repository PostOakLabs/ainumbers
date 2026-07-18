import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-391-compute-canton-traffic-cost';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_canton_traffic_cost',
  mandate_type: 'analytics_mandate', gpu: false,
};

// Canton Network synchronizer traffic-cost calculator (CIP-0042/CIP-0084 regime), per
// RC-CANTON build row #4 (future-wave-candidates-2026-07-02.md). Published formula:
//   usd_traffic_cost = envelope_mb x rate_usd_per_mb
//   cc_burned         = usd_traffic_cost / cc_usd_price
// CIP-0084 moved the Tokenomics-Committee-set rate to $60/MB (from the earlier ~$25/MB
// under CIP-0042), calibrated so a typical Canton Coin transfer costs roughly $1. CIP-0119
// (live June 2026) gives transfer preapprovals a free 90-day base duration -- traffic inside
// that window costs $0. rate_usd_per_mb, cc_usd_price, and protocol_version are ALWAYS
// caller-supplied and echoed with a source citation -- this kernel never bakes a fee or
// price in as a silent constant, because both move (CIP-0084 already moved the rate once;
// CC/USD is a market price). Sources: global-synchronizer-foundation CIPs repo (CIP-0042,
// CIP-0084, CIP-0119). Pure ECMA-262 arithmetic only -- no Math.pow, no Date.now/new Date(),
// no Math.random.

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }
function r6(v) { return Number.isFinite(v) ? Math.round(v * 1000000) / 1000000 : 0; }

const CIP0119_FREE_PERIOD_DAYS = 90;

export function compute(pp) {
  pp = pp || {};
  const envelopeMb = safeNum(pp.envelope_mb, 0);
  const rateUsdPerMb = safeNum(pp.rate_usd_per_mb, 60);
  const ccUsdPrice = safeNum(pp.cc_usd_price, 0);
  const protocolVersion = String(pp.protocol_version || '').trim();
  const isTransferPreapproval = Boolean(pp.is_transfer_preapproval);
  const preapprovalAgeDays = safeNum(pp.preapproval_age_days, 0);

  const compliance_flags = [];
  if (envelopeMb <= 0) compliance_flags.push('CANTON_NON_POSITIVE_ENVELOPE');
  if (ccUsdPrice <= 0) compliance_flags.push('CANTON_ZERO_CC_PRICE');
  if (!protocolVersion) compliance_flags.push('CANTON_PROTOCOL_VERSION_UNPINNED');

  const freePeriodApplies = isTransferPreapproval && preapprovalAgeDays >= 0 && preapprovalAgeDays <= CIP0119_FREE_PERIOD_DAYS;
  if (freePeriodApplies) compliance_flags.push('CANTON_CIP0119_FREE_PERIOD_APPLIES');

  const effectiveRateUsdPerMb = freePeriodApplies ? 0 : rateUsdPerMb;
  const usdTrafficCost = envelopeMb * effectiveRateUsdPerMb;
  const ccBurned = ccUsdPrice > 0 ? usdTrafficCost / ccUsdPrice : 0;

  const output_payload = {
    protocol_version: protocolVersion,
    envelope_mb: r6(envelopeMb),
    rate_usd_per_mb: rateUsdPerMb,
    cc_usd_price: ccUsdPrice,
    is_transfer_preapproval: isTransferPreapproval,
    preapproval_age_days: preapprovalAgeDays,
    free_period_applies: freePeriodApplies,
    free_period_days: CIP0119_FREE_PERIOD_DAYS,
    effective_rate_usd_per_mb: effectiveRateUsdPerMb,
    usd_traffic_cost: r2(usdTrafficCost),
    cc_burned: r6(ccBurned),
    rate_source: 'CIP-0084 (Tokenomics Committee authority): $60/MB, calibrated so a typical Canton Coin transfer costs approximately $1. Supersedes the earlier post-CIP-0042 ~$25/MB rate -- the rate moves under committee authority and is caller-supplied here, never hard-coded.',
    free_period_source: 'CIP-0119 (live since June 2026): transfer preapprovals get a free 90-day base duration before standard traffic cost applies.',
    disambiguation: 'Computes synchronizer traffic economics for a single message/envelope. For settlement/counterparty structure validation on Canton, see diagnose_canton_readiness (art-503), validate_canton_dvp_atomicity (art-507), and validate_canton_party_allowlist (art-509) -- those validate structure, this computes traffic cost.',
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
