import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-435-bhc-schedule-hc-balance-sheet';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'map_bhc_schedule_hc',
  mandate_type: 'regulatory_reporting', gpu: false,
};

// FR Y-9C (Financial Statements for Holding Companies) Schedule HC --
// Consolidated Balance Sheet -- mapping and identity-check kernel, per
// BANKING-OCG-BUILD-SPEC.md §4.2. Mirrors the art-432 Call Report Schedule
// RC kernel 1:1: sums caller-supplied Schedule HC line items into Schedule
// totals and checks the balance-sheet identity (Total assets == Total
// liabilities + Total equity capital). Concept identifiers use the BHCK
// (consolidated bank holding company) MDRM prefix -- BHCK2170 (Total
// assets), BHCK2948 (Total liabilities), BHCK3210 (Total equity capital) --
// the same underlying MDRM item numbers as the Call Report RC schedule
// (art-432), differing only by report-entity prefix (RCON vs BHCK), per the
// shared FFIEC/Fed MDRM item numbering convention. NO public XBRL edit
// taxonomy exists for Y-9C (§0.2) -- this mapping is hand-encoded from FR
// Y-9C instruction text, not derived from a machine-readable taxonomy.
// Y-9C reporting panel = top-tier bank holding companies with total
// consolidated assets >= $3B. BOUNDARY: line-item VALUES are
// caller-declared (from the holding company's own consolidated books); this
// kernel performs only the arithmetic aggregation and the balance identity
// check -- it does not derive, estimate, or audit any individual line item.
// Pure ECMA-262 arithmetic only -- no Math.pow, no Date.now/new Date(), no
// Math.random, no Intl/toLocaleString.

const ASSET_ITEMS = [
  { key: 'cash_and_due_from_usd', mdrm: 'BHCK0071', label: 'Cash and balances due from depository institutions' },
  { key: 'securities_htm_usd', mdrm: 'BHCK1754', label: 'Held-to-maturity securities' },
  { key: 'securities_afs_usd', mdrm: 'BHCK1773', label: 'Available-for-sale securities' },
  { key: 'loans_and_leases_net_usd', mdrm: 'BHCK2122', label: 'Total loans and leases, net of unearned income and allowance' },
  { key: 'bank_premises_usd', mdrm: 'BHCK2145', label: 'Bank premises and fixed assets' },
  { key: 'other_assets_usd', mdrm: 'BHCK2160', label: 'Other assets' },
];
const LIABILITY_ITEMS = [
  { key: 'total_deposits_usd', mdrm: 'BHCK2200', label: 'Total deposits' },
  { key: 'borrowings_usd', mdrm: 'BHCK2800', label: 'Total borrowings' },
  { key: 'other_liabilities_usd', mdrm: 'BHCK2930', label: 'Other liabilities' },
];
const EQUITY_ITEMS = [
  { key: 'common_stock_usd', mdrm: 'BHCK3230', label: 'Common stock' },
  { key: 'surplus_usd', mdrm: 'BHCK3839', label: 'Surplus' },
  { key: 'retained_earnings_usd', mdrm: 'BHCK3632', label: 'Retained earnings' },
  { key: 'aoci_usd', mdrm: 'BHCK3216', label: 'Accumulated other comprehensive income' },
];

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

function sumItems(items, source) {
  const rows = items.map((it) => {
    const value = r2(safeNum(source[it.key], 0));
    return { key: it.key, mdrm: it.mdrm, label: it.label, value_usd: value };
  });
  const total = rows.reduce((a, r) => a + r.value_usd, 0);
  return { rows, total: r2(total) };
}

export function compute(pp) {
  pp = pp || {};
  const entityId = String(pp.entity_id || '').trim();
  const reportingPeriod = String(pp.reporting_period || '').trim();
  const roundingToleranceUsd = Math.max(0, safeNum(pp.rounding_tolerance_usd, 1));

  const compliance_flags = [];
  if (!entityId) compliance_flags.push('BHCHC_ENTITY_ID_MISSING');
  if (!reportingPeriod) compliance_flags.push('BHCHC_REPORTING_PERIOD_MISSING');

  const assets = sumItems(ASSET_ITEMS, pp);
  const liabilities = sumItems(LIABILITY_ITEMS, pp);
  const equity = sumItems(EQUITY_ITEMS, pp);

  const totalAssetsUsd = assets.total;
  const totalLiabilitiesUsd = liabilities.total;
  const totalEquityUsd = equity.total;
  const totalLiabilitiesAndEquityUsd = r2(totalLiabilitiesUsd + totalEquityUsd);
  const identityDeltaUsd = r2(totalAssetsUsd - totalLiabilitiesAndEquityUsd);
  const identityBalanced = Math.abs(identityDeltaUsd) <= roundingToleranceUsd;
  if (!identityBalanced) compliance_flags.push('BHCHC_BALANCE_IDENTITY_FAILED');

  const output_payload = {
    entity_id: entityId,
    reporting_period: reportingPeriod,
    report_form: 'FR Y-9C',
    schedule: 'HC',
    assets: assets.rows,
    total_assets_usd: totalAssetsUsd,
    total_assets_mdrm: 'BHCK2170',
    liabilities: liabilities.rows,
    total_liabilities_usd: totalLiabilitiesUsd,
    total_liabilities_mdrm: 'BHCK2948',
    equity: equity.rows,
    total_equity_capital_usd: totalEquityUsd,
    total_equity_capital_mdrm: 'BHCK3210',
    total_liabilities_and_equity_usd: totalLiabilitiesAndEquityUsd,
    identity_delta_usd: identityDeltaUsd,
    identity_balanced: identityBalanced,
    rounding_tolerance_usd: roundingToleranceUsd,
    boundary_note: 'Line-item values are caller-declared from the holding company\'s own consolidated books; this kernel performs only the arithmetic aggregation into Schedule HC totals and the Total assets == Total liabilities + Total equity capital identity check. It does not derive, estimate, or audit any individual line item.',
    taxonomy_note: 'No public XBRL edit taxonomy exists for FR Y-9C (§0.2); this mapping is hand-encoded from FR Y-9C instruction text, not sourced from a machine-readable taxonomy. Panel: top-tier bank holding companies, total consolidated assets >= $3B.',
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
