import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-180-solvency2-scr-ratio-calculator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'calculate_solvency2_scr_ratio',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Solvency II SCR coverage ratio calculator. Checks own-funds SCR tiering limits
// per Delegated Regulation (EU) 2015/35 82(1): eligible Tier 1 at least 50% of
// the SCR (82(1)(a)), Tier 3 less than 15% of the SCR (82(1)(b)), Tier 2 plus Tier 3
// at most 50% of the SCR (82(1)(c)), and the restricted share of total Tier 1 less
// than 20% (82(3)). An omitted capital.tier2 is treated as 0, which makes the
// Tier 2 plus Tier 3 test lenient. The 80% Tier 1 floor and the 20% Tier 2 cap are
// the Minimum Capital Requirement rule (82(2)) and are NOT applied to the SCR.
// DIFFERS 2026-10-27: the earlier test set (Tier-1 unrestricted >=50% SCR, Tier-1
// total >=80% SCR, Tier-3 <=15% SCR) did not follow 82(1): it applied the MCR
// 80% floor to the SCR, had no Tier 2 plus Tier 3 test, passed Tier 3 at exactly
// 15%, and added an unrestricted-only test with no basis in 82(1). Not modelled:
// MCR tiering limits (82(2), needs MCR-eligible amounts per tier), the
// 82(3)(d) 308b(9) transitional Tier 1 items, and eligible-amount
// reclassification. Tests use integer cross-multiplication, never decimal
// multipliers (0.15 * 3 is 0.44999999999999996 in IEEE-754). NaN-safe.
export function compute(pp) {
  const { capital = {} } = pp;

  const g = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
  const own_funds       = g(capital.eligible_own_funds);
  const t1_unrestricted = g(capital.tier1_unrestricted);
  const t1_restricted   = g(capital.tier1_restricted);
  const tier3           = g(capital.tier3);
  const scr             = g(capital.scr);
  const mcr             = g(capital.mcr);

  const scr_coverage_ratio = scr > 0 ? Math.round((own_funds / scr) * 10000) / 100 : 0;
  const mcr_coverage_ratio = mcr > 0 ? Math.round((own_funds / mcr) * 10000) / 100 : 0;

  const tier2            = g(capital.tier2);
  const t1_total = t1_unrestricted + t1_restricted;
  const t1_unrestricted_pct = scr > 0 ? Math.round((t1_unrestricted / scr) * 10000) / 100 : 0;
  const t1_total_pct        = scr > 0 ? Math.round((t1_total / scr) * 10000) / 100 : 0;
  const t2_tier3_pct        = scr > 0 ? Math.round(((tier2 + tier3) / scr) * 10000) / 100 : 0;
  const tier3_pct           = scr > 0 ? Math.round((tier3 / scr) * 10000) / 100 : 0;

  // 82(1)(a): eligible Tier 1 at least one half of the SCR.
  const t1_total_limit_ok = scr > 0 && t1_total * 2 >= scr;
  // 82(1)(b): eligible Tier 3 less than 15% of the SCR (exactly 15% fails).
  const tier3_limit_ok = scr > 0 ? tier3 * 100 < 15 * scr : true;
  // 82(1)(c): Tier 2 plus Tier 3 at most 50% of the SCR.
  const t2_tier3_limit_ok = scr > 0 ? (tier2 + tier3) * 2 <= scr : true;
  // 82(3): restricted Tier 1 items (69(a)(iii), 69(a)(v), 69(b); the
  // 308b(9) transitional item is not modelled) strictly under 20% of total Tier 1.
  const t1_restricted_share_ok = t1_total > 0 ? t1_restricted * 5 < t1_total : true;
  const t1_restricted_pct = t1_total > 0 ? Math.round((t1_restricted / t1_total) * 10000) / 100 : 0;

  const scr_breached = scr > 0 && scr_coverage_ratio < 100;
  const mcr_breached = mcr > 0 && mcr_coverage_ratio < 100;
  const tiering_ok   = t1_total_limit_ok && tier3_limit_ok && t2_tier3_limit_ok && t1_restricted_share_ok;

  const compliance_flags = [];
  compliance_flags.push('SII_SCR_RATIO_CALCULATED');
  if (scr_breached)                         compliance_flags.push('SII_SCR_BREACH');
  else if (scr > 0)                         compliance_flags.push('SII_SCR_COVERED');
  if (mcr_breached)                         compliance_flags.push('SII_MCR_BREACH');
  if (!t2_tier3_limit_ok)                   compliance_flags.push('SII_TIER2_TIER3_LIMIT_BREACH');
  if (!t1_total_limit_ok && scr > 0)        compliance_flags.push('SII_TIER1_TOTAL_LIMIT_BREACH');
  if (!tier3_limit_ok)                      compliance_flags.push('SII_TIER3_LIMIT_BREACH');
  if (!t1_restricted_share_ok)              compliance_flags.push('SII_TIER1_RESTRICTED_SHARE_BREACH');

  return {
    output_payload: {
      scr_coverage_ratio,
      mcr_coverage_ratio,
      scr_breached,
      mcr_breached,
      tiering_ok,
      tier1_unrestricted_pct_of_scr: t1_unrestricted_pct,
      tier1_total_pct_of_scr: t1_total_pct,
      tier3_pct_of_scr: tier3_pct,
      tier1_total_limit_ok: t1_total_limit_ok,
      tier3_limit_ok,
      tier2_tier3_pct_of_scr: t2_tier3_pct,
      tier2_tier3_limit_ok: t2_tier3_limit_ok,
      tier1_restricted_pct_of_tier1: t1_restricted_pct,
      tier1_restricted_share_ok: t1_restricted_share_ok,
      eligible_own_funds: own_funds,
      scr,
      mcr,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
