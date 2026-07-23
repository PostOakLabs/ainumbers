import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-432-call-report-rc-balance-sheet';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'map_call_report_schedule_rc',
  mandate_type: 'regulatory_reporting', gpu: false,
};

// FFIEC Call Report (FFIEC 031, consolidated bank) Schedule RC -- Balance
// Sheet -- mapping and identity-check kernel, per BANKING-OCG-BUILD-SPEC.md
// §4.1. Sums caller-supplied Schedule RC line items (asset side, liability
// side, equity capital side) into the Schedule totals and checks the RC
// balance-sheet identity: Total assets == Total liabilities + Total equity
// capital. Concept identifiers are real, public MDRM (Micro Data Reference
// Manual) item codes -- RCON2170 (Total assets), RCON2948 (Total
// liabilities), RCON3210 (Total equity capital) -- the same three codes
// already used by the §13.13 xBRL-JSON Annex 1 sample fixture, so this
// node's output maps directly onto that export profile's concept namespace.
// BOUNDARY: line-item VALUES are caller-declared (from the institution's own
// books); this kernel performs only the arithmetic aggregation and the
// balance identity check -- it does not derive, estimate, or audit any
// individual line item. 041/051 report forms are structurally compatible
// with this same schedule mapping (§4.1 scope note); this kernel targets 031
// only for the initial build, per the 2026-06-30 FFIEC 031 item revisions
// (eSLR-related schedule changes land in Schedule RC-R, not RC -- see
// art-433). Pure ECMA-262 arithmetic only -- no Math.pow, no
// Date.now/new Date(), no Math.random, no Intl/toLocaleString.

const ASSET_ITEMS = [
  { key: 'cash_and_due_from_usd', mdrm: 'RCON0071', label: 'Cash and balances due from depository institutions' },
  { key: 'securities_htm_usd', mdrm: 'RCON1754', label: 'Held-to-maturity securities' },
  { key: 'securities_afs_usd', mdrm: 'RCON1773', label: 'Available-for-sale securities' },
  { key: 'loans_and_leases_net_usd', mdrm: 'RCON2122', label: 'Total loans and leases, net of unearned income and allowance' },
  { key: 'bank_premises_usd', mdrm: 'RCON2145', label: 'Bank premises and fixed assets' },
  { key: 'other_assets_usd', mdrm: 'RCON2160', label: 'Other assets' },
];
const LIABILITY_ITEMS = [
  { key: 'total_deposits_usd', mdrm: 'RCON2200', label: 'Total deposits' },
  { key: 'borrowings_usd', mdrm: 'RCON2800', label: 'Total borrowings' },
  { key: 'other_liabilities_usd', mdrm: 'RCON2930', label: 'Other liabilities' },
];
const EQUITY_ITEMS = [
  { key: 'common_stock_usd', mdrm: 'RCON3230', label: 'Common stock' },
  { key: 'surplus_usd', mdrm: 'RCON3839', label: 'Surplus' },
  { key: 'retained_earnings_usd', mdrm: 'RCON3632', label: 'Retained earnings' },
  { key: 'aoci_usd', mdrm: 'RCON3216', label: 'Accumulated other comprehensive income' },
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
  if (!entityId) compliance_flags.push('CALLRC_ENTITY_ID_MISSING');
  if (!reportingPeriod) compliance_flags.push('CALLRC_REPORTING_PERIOD_MISSING');

  const assets = sumItems(ASSET_ITEMS, pp);
  const liabilities = sumItems(LIABILITY_ITEMS, pp);
  const equity = sumItems(EQUITY_ITEMS, pp);

  const totalAssetsUsd = assets.total;
  const totalLiabilitiesUsd = liabilities.total;
  const totalEquityUsd = equity.total;
  const totalLiabilitiesAndEquityUsd = r2(totalLiabilitiesUsd + totalEquityUsd);
  const identityDeltaUsd = r2(totalAssetsUsd - totalLiabilitiesAndEquityUsd);
  const identityBalanced = Math.abs(identityDeltaUsd) <= roundingToleranceUsd;
  if (!identityBalanced) compliance_flags.push('CALLRC_BALANCE_IDENTITY_FAILED');

  const output_payload = {
    entity_id: entityId,
    reporting_period: reportingPeriod,
    report_form: 'FFIEC 031',
    schedule: 'RC',
    assets: assets.rows,
    total_assets_usd: totalAssetsUsd,
    total_assets_mdrm: 'RCON2170',
    liabilities: liabilities.rows,
    total_liabilities_usd: totalLiabilitiesUsd,
    total_liabilities_mdrm: 'RCON2948',
    equity: equity.rows,
    total_equity_capital_usd: totalEquityUsd,
    total_equity_capital_mdrm: 'RCON3210',
    total_liabilities_and_equity_usd: totalLiabilitiesAndEquityUsd,
    identity_delta_usd: identityDeltaUsd,
    identity_balanced: identityBalanced,
    rounding_tolerance_usd: roundingToleranceUsd,
    boundary_note: 'Line-item values are caller-declared from the institution\'s own books; this kernel performs only the arithmetic aggregation into Schedule RC totals and the Total assets == Total liabilities + Total equity capital identity check. It does not derive, estimate, or audit any individual line item.',
    xbrl_json_annex1_note: 'MDRM concept codes above (RCON2170/RCON2948/RCON3210) align with the §13.13 xBRL-JSON export profile\'s Annex 1 FFIEC Call Report mapping; rendering to that profile is a separate exporter work unit, not performed by this kernel.',
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
