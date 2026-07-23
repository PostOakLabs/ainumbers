import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-445-credit-concentration-topn-sector';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_credit_concentration_topn_sector',
  mandate_type: 'analytics_mandate', gpu: false,
};

// Credit-concentration top-N / sector kernel: takes a flat exposure list
// (name, sector, amount) and returns the top-N single-name exposures, a
// per-sector rollup, single-name and sector Herfindahl-Hirschman Index
// (0-10000 scale, share-of-portfolio squared and summed x10000 -- same
// scale banking supervisors use for market-concentration screens), and a
// breach list against caller-declared single-name / sector limit
// percentages (no baked-in regulatory threshold -- concentration limits
// are institution-specific policy, not a fixed statute number).
// Fixed-point money math (2dp rounding on every emitted percentage),
// finite gate (zero-exposure portfolio resolves to 0/empty, never NaN).
// NaN-safe inputs. Zero network, zero PII.

function g(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

export function compute(pp) {
  pp = pp || {};
  const rawExposures = Array.isArray(pp.exposures) ? pp.exposures : [];
  const top_n = Math.max(0, Math.trunc(g(pp.top_n) || 5));
  const singleNameLimitPct = g(pp.single_name_limit_pct) || 10;
  const sectorLimitPct = g(pp.sector_limit_pct) || 25;
  const compliance_flags = [];

  const exposures = rawExposures
    .map((e) => ({
      name: String((e && e.name) || '').trim(),
      sector: String((e && e.sector) || '').trim() || 'unclassified',
      amount: g(e && e.amount),
    }))
    .filter((e) => e.name);

  const portfolio_total = r2(exposures.reduce((s, e) => s + e.amount, 0));

  const pctOf = (amount) => (portfolio_total > 0 ? r2((amount / portfolio_total) * 100) : 0);

  const withPct = exposures.map((e) => ({ ...e, pct_of_portfolio: pctOf(e.amount) }));
  const sortedByAmount = [...withPct].sort((a, b) => b.amount - a.amount);
  const top_n_exposures = sortedByAmount.slice(0, top_n);

  const sectorMap = new Map();
  for (const e of exposures) {
    const cur = sectorMap.get(e.sector) || 0;
    sectorMap.set(e.sector, cur + e.amount);
  }
  const sector_totals = [...sectorMap.entries()]
    .map(([sector, amount]) => ({ sector, amount: r2(amount), pct_of_portfolio: pctOf(amount) }))
    .sort((a, b) => b.amount - a.amount);

  const hhi = (shares) => r2(shares.reduce((s, share) => s + share * share, 0) * 10000);
  const single_name_hhi = portfolio_total > 0 ? hhi(exposures.map((e) => e.amount / portfolio_total)) : 0;
  const sector_hhi = portfolio_total > 0 ? hhi(sector_totals.map((s) => s.amount / portfolio_total)) : 0;

  const single_name_breaches = sortedByAmount
    .filter((e) => e.pct_of_portfolio > singleNameLimitPct)
    .map((e) => ({ name: e.name, pct_of_portfolio: e.pct_of_portfolio }));
  const sector_breaches = sector_totals
    .filter((s) => s.pct_of_portfolio > sectorLimitPct)
    .map((s) => ({ sector: s.sector, pct_of_portfolio: s.pct_of_portfolio }));

  const worst_single_name = sortedByAmount.length ? sortedByAmount[0].name : null;
  const worst_sector = sector_totals.length ? sector_totals[0].sector : null;

  compliance_flags.push('CONC_CALCULATED');
  if (portfolio_total === 0) compliance_flags.push('CONC_EMPTY_PORTFOLIO');
  if (single_name_breaches.length > 0) compliance_flags.push('CONC_SINGLE_NAME_LIMIT_BREACH');
  if (sector_breaches.length > 0) compliance_flags.push('CONC_SECTOR_LIMIT_BREACH');

  return {
    output_payload: {
      portfolio_total,
      top_n,
      single_name_limit_pct: singleNameLimitPct,
      sector_limit_pct: sectorLimitPct,
      top_n_exposures,
      sector_totals,
      single_name_hhi,
      sector_hhi,
      single_name_breaches,
      sector_breaches,
      worst_single_name,
      worst_sector,
    },
    compliance_flags,
  };
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
