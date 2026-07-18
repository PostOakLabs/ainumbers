import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-357-basel-2023-vs-2026-capital-delta-comparator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compare_basel_2023_vs_2026',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Capital-delta comparator: runs the SAME portfolio through the 2023 Basel III Endgame
// NPR risk-weight framework and the 2026 reproposal (2026-03-19, three NPRs) framework,
// then reports the RWA/capital delta -- the "reproduce the $87.7bn relief story on OUR
// book" tool. Representative asset-class risk-weight buckets, NOT an exhaustive
// regulatory table -- rule_status:"proposed" until ~Q4 2026 finalization (re-pin WU
// pre-authorized then). Reuses BT-1 (compute_rwa_erba_2026, art-355) / BT-2
// (compute_oprisk_sma_2026, art-356) by tool_id reference for future chain wiring;
// standalone pinned constants here since this WU builds in parallel with BT-1/BT-2.
// BASEL-TAKE2-BUILD-SPEC.md §BT-3.

const CONSTANTS_VERSION = 'BASEL-2023-VS-2026-DELTA-2026-07-17-V1';
const SOURCE = 'Basel III Endgame 2023 NPR (88 Fed. Reg. 64028, 2023-09-18) vs 2026 reproposal (three NPRs, 2026-03-19, comments closed 2026-06-18) -- representative credit-risk RW buckets + simplified operational-risk SMA business-indicator coefficient (BI <=1bn bucket, ILM neutralized both years pending US-variant confirmation). rule_status: proposed.';

// asset_class -> { rw_2023, rw_2026 } representative standardized/ERBA risk weights.
const CREDIT_RW_TABLE = {
  residential_mortgage_low_ltv:  { rw_2023: 0.40, rw_2026: 0.20 },
  residential_mortgage_high_ltv: { rw_2023: 0.75, rw_2026: 0.50 },
  corporate_investment_grade:    { rw_2023: 0.65, rw_2026: 0.50 },
  corporate_unrated:             { rw_2023: 1.00, rw_2026: 0.85 },
  retail_revolving:              { rw_2023: 0.75, rw_2026: 0.75 },
  retail_other:                  { rw_2023: 1.00, rw_2026: 0.85 },
  off_balance_sheet_commitment:  { rw_2023: 0.75, rw_2026: 0.40 },
};
const DEFAULT_RW = { rw_2023: 1.00, rw_2026: 1.00 };

const OPRISK_MARGINAL_COEFF_2023 = 0.12;
const OPRISK_MARGINAL_COEFF_2026 = 0.09;
const RWA_CAPITAL_MULTIPLIER = 12.5; // RWA = capital / 8%
const MIN_CAPITAL_RATIO = 0.08;

function g(v) { return Number.isFinite(Number(v)) ? Number(v) : 0; }
function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }

export function compute(pp) {
  pp = pp || {};
  const exposures = Array.isArray(pp.exposures) ? pp.exposures : [];
  const business_indicator = g(pp.business_indicator);

  const by_class = {};
  let credit_rwa_2023 = 0;
  let credit_rwa_2026 = 0;
  let unrecognized_asset_class = false;

  for (const exp of exposures) {
    const asset_class = safeStr(exp && exp.asset_class);
    const amount = g(exp && exp.amount);
    const table_entry = CREDIT_RW_TABLE[asset_class];
    if (!table_entry) unrecognized_asset_class = true;
    const { rw_2023, rw_2026 } = table_entry || DEFAULT_RW;

    const rwa_2023 = amount * rw_2023;
    const rwa_2026 = amount * rw_2026;
    credit_rwa_2023 += rwa_2023;
    credit_rwa_2026 += rwa_2026;

    const key = asset_class || 'unclassified';
    if (!by_class[key]) {
      by_class[key] = { asset_class: key, amount: 0, rw_2023, rw_2026, rwa_2023: 0, rwa_2026: 0 };
    }
    by_class[key].amount += amount;
    by_class[key].rwa_2023 += rwa_2023;
    by_class[key].rwa_2026 += rwa_2026;
  }

  const op_capital_2023 = business_indicator * OPRISK_MARGINAL_COEFF_2023;
  const op_capital_2026 = business_indicator * OPRISK_MARGINAL_COEFF_2026;
  const op_rwa_2023 = op_capital_2023 * RWA_CAPITAL_MULTIPLIER;
  const op_rwa_2026 = op_capital_2026 * RWA_CAPITAL_MULTIPLIER;

  const total_rwa_2023 = credit_rwa_2023 + op_rwa_2023;
  const total_rwa_2026 = credit_rwa_2026 + op_rwa_2026;
  const total_capital_2023 = total_rwa_2023 * MIN_CAPITAL_RATIO;
  const total_capital_2026 = total_rwa_2026 * MIN_CAPITAL_RATIO;

  const delta_rwa = total_rwa_2026 - total_rwa_2023;
  const delta_capital = total_capital_2026 - total_capital_2023;
  const delta_capital_pct = total_capital_2023 > 0 ? delta_capital / total_capital_2023 : 0;

  const direction = delta_capital < 0 ? 'NET_RELIEF_2026_VS_2023'
    : delta_capital > 0 ? 'NET_INCREASE_2026_VS_2023'
    : 'NO_CHANGE';

  const output_payload = {
    portfolio_summary: Object.values(by_class),
    credit_rwa_2023, credit_rwa_2026,
    business_indicator, op_capital_2023, op_capital_2026, op_rwa_2023, op_rwa_2026,
    total_rwa_2023, total_rwa_2026, total_capital_2023, total_capital_2026,
    delta_rwa, delta_capital, delta_capital_pct, direction,
    unrecognized_asset_class,
    rule_status: 'proposed',
    constants_version: CONSTANTS_VERSION,
    source: SOURCE,
    referenced_tool_ids: { erba_2026: 'compute_rwa_erba_2026', oprisk_sma_2026: 'compute_oprisk_sma_2026' },
    disambiguation: 'compare_basel_2023_vs_2026 is a representative-bucket credit + operational-risk capital-delta comparator, NOT an exhaustive regulatory RWA engine. rule_status:"proposed" -- final rule expected ~Q4 2026; this tool will be re-pinned at finalization. It does NOT replace compute_rwa_erba_2026 (art-355, exposure-level ERBA) or compute_oprisk_sma_2026 (art-356, full SMA) for production-grade single-rule-set computation.',
  };

  const compliance_flags = ['BASEL_2023_VS_2026_DELTA_COMPUTED', direction, 'BASEL_2026_REPROPOSAL_RULE_STATUS_PROPOSED'];
  if (unrecognized_asset_class) compliance_flags.push('BASEL_DELTA_UNRECOGNIZED_ASSET_CLASS_DEFAULTED');

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
