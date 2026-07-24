import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-455-globe-sbie-topup';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_globe_sbie_topup',
  mandate_type: 'compliance_control', gpu: false,
};

// GloBE substance-based income exclusion (SBIE) + jurisdictional top-up tax
// kernel (OECD Pillar Two Model Rules Art 5.3, published/public-domain
// arithmetic). Pure arithmetic only -- election choices and GloBE-income
// adjustments are HUMAN JUDGMENT and happen upstream (art-454); this node
// consumes art-454's jurisdictional GloBE income + top-up-tax-percentage
// output shape directly rather than recomputing an ETR itself, so it also
// works standalone when the caller already has those two figures.
//
// SBIE = (payroll_costs * payroll_rate_for_year) + (tangible_asset_carrying_value * tangible_asset_rate_for_year).
// The payroll/tangible-asset rate pair is looked up from a caller-supplied
// transition-year policy_parameter table ({year, payroll_rate,
// tangible_asset_rate}[]) keyed by target_year -- OECD's actual declining
// annual percentages are NOT hardcoded here; only the lookup+multiply logic
// is. Excess profit = max(0, globe_income - SBIE). Top-up tax = excess_profit
// * top_up_tax_percentage. QDMTT offset: final jurisdictional top-up =
// max(0, top_up_tax - qdmtt_paid); an over-collection (qdmtt_paid >
// top_up_tax) is flagged informationally only, never clamped negative.
// NaN-safe. Zero network, zero PII.

function n(v, d) { const x = Number(v); return Number.isFinite(x) ? x : d; }
function nonNeg(v, d) { const x = n(v, d); return x < 0 ? d : x; }

function rateRowFor(table, targetYear) {
  if (!Array.isArray(table)) return null;
  for (const row of table) {
    if (row && Number(row.year) === Number(targetYear)) {
      return {
        year: Number(row.year),
        payroll_rate: nonNeg(row.payroll_rate, 0),
        tangible_asset_rate: nonNeg(row.tangible_asset_rate, 0),
      };
    }
  }
  return null;
}

export function compute(pp) {
  pp = pp || {};
  const payroll_costs = nonNeg(pp.payroll_costs, 0);
  const tangible_asset_carrying_value = nonNeg(pp.tangible_asset_carrying_value, 0);
  const target_year = n(pp.target_year, 0);
  const policy_rate_table = Array.isArray(pp.policy_rate_table) ? pp.policy_rate_table : [];
  const globe_income = n(pp.globe_income, 0); // may legitimately be negative (a jurisdictional loss)
  const top_up_tax_percentage = nonNeg(pp.top_up_tax_percentage, 0);
  const qdmtt_paid = nonNeg(pp.qdmtt_paid, 0);

  const compliance_flags = [];

  const rate_row = rateRowFor(policy_rate_table, target_year);
  const rate_row_found = rate_row !== null;
  if (!rate_row_found) compliance_flags.push('SBIE_RATE_YEAR_NOT_FOUND');
  const payroll_rate = rate_row ? rate_row.payroll_rate : 0;
  const tangible_asset_rate = rate_row ? rate_row.tangible_asset_rate : 0;

  const payroll_component = payroll_costs * payroll_rate;
  const tangible_asset_component = tangible_asset_carrying_value * tangible_asset_rate;
  const sbie = payroll_component + tangible_asset_component;

  const excess_profit = Math.max(0, globe_income - sbie);
  if (excess_profit === 0 && globe_income <= sbie) compliance_flags.push('SBIE_FULLY_OFFSETS_INCOME');

  const top_up_tax = excess_profit * top_up_tax_percentage;

  const qdmtt_over_collection = qdmtt_paid > top_up_tax;
  if (qdmtt_over_collection) compliance_flags.push('SBIE_QDMTT_OVER_COLLECTION');

  const jurisdictional_top_up = Math.max(0, top_up_tax - qdmtt_paid);
  if (jurisdictional_top_up === 0 && top_up_tax > 0) compliance_flags.push('SBIE_TOPUP_FULLY_OFFSET_BY_QDMTT');
  if (jurisdictional_top_up > 0) compliance_flags.push('SBIE_TOPUP_DUE');

  compliance_flags.push('SBIE_COMPUTED');

  return {
    output_payload: {
      target_year,
      rate_row_found,
      payroll_rate,
      tangible_asset_rate,
      payroll_component,
      tangible_asset_component,
      sbie,
      globe_income,
      excess_profit,
      top_up_tax_percentage,
      top_up_tax,
      qdmtt_paid,
      qdmtt_over_collection,
      jurisdictional_top_up,
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
