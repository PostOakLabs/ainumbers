import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-180-solvency2-scr-ratio-calculator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'calculate_solvency2_scr_ratio',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Solvency II SCR/MCR coverage ratio calculator. Checks own-funds tiering limits
// per Delegated Regulation (EU) 2015/35: Tier-1 unrestricted ≥50% SCR,
// Tier-1 total ≥80% SCR, Tier-3 ≤15% SCR. §16 proof candidate. NaN-safe.
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

  const t1_total = t1_unrestricted + t1_restricted;
  const t1_unrestricted_pct = scr > 0 ? Math.round((t1_unrestricted / scr) * 10000) / 100 : 0;
  const t1_total_pct        = scr > 0 ? Math.round((t1_total / scr) * 10000) / 100 : 0;
  const tier3_pct           = scr > 0 ? Math.round((tier3 / scr) * 10000) / 100 : 0;

  const t1_unrestricted_limit_ok = scr > 0 ? t1_unrestricted >= 0.5 * scr : false;
  const t1_total_limit_ok        = scr > 0 ? t1_total >= 0.8 * scr : false;
  const tier3_limit_ok           = scr > 0 ? tier3 <= 0.15 * scr : true;

  const scr_breached = scr > 0 && scr_coverage_ratio < 100;
  const mcr_breached = mcr > 0 && mcr_coverage_ratio < 100;
  const tiering_ok   = t1_unrestricted_limit_ok && t1_total_limit_ok && tier3_limit_ok;

  const compliance_flags = { SII_SCR_RATIO_CALCULATED: true };
  if (scr_breached)                         compliance_flags.SII_SCR_BREACH = true;
  else if (scr > 0)                         compliance_flags.SII_SCR_COVERED = true;
  if (mcr_breached)                         compliance_flags.SII_MCR_BREACH = true;
  if (!t1_unrestricted_limit_ok && scr > 0) compliance_flags.SII_TIER1_UNRESTRICTED_LIMIT_BREACH = true;
  if (!t1_total_limit_ok && scr > 0)        compliance_flags.SII_TIER1_TOTAL_LIMIT_BREACH = true;
  if (!tier3_limit_ok)                      compliance_flags.SII_TIER3_LIMIT_BREACH = true;

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
      tier1_unrestricted_limit_ok: t1_unrestricted_limit_ok,
      tier1_total_limit_ok: t1_total_limit_ok,
      tier3_limit_ok,
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
