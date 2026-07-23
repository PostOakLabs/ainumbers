import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-425-large-exposures-limit-check';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_large_exposures_limit',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Large exposures limit check (Basel III large exposures framework, BCBS 283; codified in the
// U.S. by Regulation YY / 12 CFR 252 Subpart H for banks subject to single-counterparty credit
// limits). Aggregates a counterparty's gross exposure net of eligible credit-risk-mitigation
// (CRM) per caller-supplied input flags, rolls up connected/economically-interdependent
// counterparties into one group exposure, then checks it against Tier 1 capital under the
// general 25% limit or the tighter 15% GSIB-to-GSIB limit. Deterministic point-in-time
// calculation from caller-supplied exposure/CRM/capital figures -- no market data fetch, no
// stochastic simulation.
//
// Pure ECMA-262 arithmetic only -- no Date.now/new Date(), no Math.random. Ratios and dollar
// figures rounded to 2 decimals (r2) only at declared output boundaries; a zero-denominator
// ratio is reported as null (finite gate: never NaN/Infinity).

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return (v === null || !Number.isFinite(v)) ? null : Math.round(v * 100) / 100; }
function arr(v) { return Array.isArray(v) ? v : []; }

function netExposure(item) {
  const gross = Math.max(0, safeNum(item && item.gross_exposure_musd, 0));
  const crmEligible = !!(item && item.crm_eligible);
  const crmValue = crmEligible ? Math.max(0, safeNum(item && item.crm_value_musd, 0)) : 0;
  const net = Math.max(0, gross - Math.min(crmValue, gross));
  return { gross, crmValue: crmEligible ? Math.min(crmValue, gross) : 0, net };
}

function computeCounterparty(cp) {
  const items = arr(cp && cp.exposures).map((item) => {
    const { gross, crmValue, net } = netExposure(item);
    return {
      label: (item && item.label) || '',
      gross_exposure_musd: r2(gross),
      crm_value_musd: r2(crmValue),
      net_exposure_musd: r2(net),
    };
  });
  const netTotal = items.reduce((s, i) => s + i.net_exposure_musd, 0);
  return {
    counterparty_id: (cp && cp.counterparty_id) || '',
    counterparty_name: (cp && cp.counterparty_name) || '',
    connected_group_id: (cp && cp.connected_group_id) || null,
    is_gsib: !!(cp && cp.is_gsib),
    exposures: items,
    net_exposure_total_musd: r2(netTotal),
  };
}

function groupKey(cp) {
  return cp.connected_group_id || ('__single__:' + cp.counterparty_id);
}

export function compute(pp) {
  pp = pp || {};

  const tier1CapitalMusd = Math.max(0, safeNum(pp.tier1_capital_musd, 0));
  const callerIsGsib = !!pp.caller_is_gsib;

  const counterparties = arr(pp.counterparties).map(computeCounterparty);

  const groups = new Map();
  for (const cp of counterparties) {
    const key = groupKey(cp);
    if (!groups.has(key)) {
      groups.set(key, {
        group_id: cp.connected_group_id,
        is_connected_group: !!cp.connected_group_id,
        member_counterparty_ids: [],
        member_is_gsib: false,
        net_exposure_total_musd: 0,
      });
    }
    const g = groups.get(key);
    g.member_counterparty_ids.push(cp.counterparty_id);
    g.member_is_gsib = g.member_is_gsib || cp.is_gsib;
    g.net_exposure_total_musd += cp.net_exposure_total_musd;
  }

  const breach_list = [];
  const groupResults = [];

  for (const g of groups.values()) {
    const gsibToGsib = callerIsGsib && g.member_is_gsib;
    const limitPct = gsibToGsib ? 15 : 25;
    const limitMusd = r2(tier1CapitalMusd * limitPct / 100);
    const exposurePct = tier1CapitalMusd > 0 ? r2((g.net_exposure_total_musd / tier1CapitalMusd) * 100) : null;
    const breached = exposurePct === null ? false : exposurePct > limitPct;

    const result = {
      group_id: g.group_id,
      is_connected_group: g.is_connected_group,
      member_counterparty_ids: g.member_counterparty_ids,
      gsib_to_gsib: gsibToGsib,
      applicable_limit_pct: limitPct,
      applicable_limit_musd: limitMusd,
      net_exposure_total_musd: r2(g.net_exposure_total_musd),
      exposure_pct_of_tier1: exposurePct,
      breached,
    };
    groupResults.push(result);
    if (breached) breach_list.push(result);
  }

  const compliance_flags = [];
  if (breach_list.length > 0) compliance_flags.push('LARGE_EXPOSURE_LIMIT_BREACHED');
  else compliance_flags.push('ALL_EXPOSURES_WITHIN_LIMIT');

  const output_payload = {
    tier1_capital_musd: r2(tier1CapitalMusd),
    caller_is_gsib: callerIsGsib,
    counterparties: counterparties.map((cp) => ({
      counterparty_id: cp.counterparty_id,
      counterparty_name: cp.counterparty_name,
      connected_group_id: cp.connected_group_id,
      is_gsib: cp.is_gsib,
      net_exposure_total_musd: cp.net_exposure_total_musd,
    })),
    groups: groupResults,
    breach_list,
    regulatory_basis: 'Basel III large exposures framework (BCBS 283); U.S. single-counterparty credit limits (Regulation YY, 12 CFR 252 Subpart H): 25% of Tier 1 capital general limit, 15% for GSIB-to-GSIB exposures.',
    note: 'Deterministic point calculation from caller-supplied gross exposure, eligible CRM, and connected-group rollup for a single reporting date.',
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
