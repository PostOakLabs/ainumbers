import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-328-tvm-breakeven';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_breakeven',
  mandate_type: 'analytics_mandate', gpu: false,
};

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }
function r4(v) { return Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : 0; }

// Standard cost-volume-profit breakeven identity: unit_contribution = price - variable_cost_per_unit;
// breakeven_units = fixed_costs / unit_contribution; breakeven_revenue = breakeven_units * price;
// contribution_margin_ratio = unit_contribution / price; margin_of_safety uses a caller-supplied
// current/forecast volume or revenue figure (optional).
export function compute(pp) {
  pp = pp || {};
  const fixedCosts = safeNum(pp.fixed_costs, 0);
  const pricePerUnit = safeNum(pp.price_per_unit, 0);
  const variableCostPerUnit = safeNum(pp.variable_cost_per_unit, 0);
  const currentUnits = pp.current_units !== undefined ? safeNum(pp.current_units, null) : null;

  const unitContribution = pricePerUnit - variableCostPerUnit;

  const compliance_flags = [];
  let breakevenUnits = 0, breakevenRevenue = 0, contributionMarginRatio = 0;
  if (unitContribution <= 0) {
    compliance_flags.push('NON_POSITIVE_UNIT_CONTRIBUTION');
  } else {
    breakevenUnits = fixedCosts / unitContribution;
    breakevenRevenue = breakevenUnits * pricePerUnit;
    contributionMarginRatio = pricePerUnit !== 0 ? unitContribution / pricePerUnit : 0;
  }
  if (pricePerUnit === 0) compliance_flags.push('ZERO_PRICE_PER_UNIT');

  let marginOfSafetyUnits = null, marginOfSafetyPct = null;
  if (currentUnits !== null && Number.isFinite(currentUnits) && unitContribution > 0) {
    marginOfSafetyUnits = r2(currentUnits - breakevenUnits);
    marginOfSafetyPct = currentUnits !== 0 ? r4(((currentUnits - breakevenUnits) / currentUnits) * 100) : null;
    if (currentUnits < breakevenUnits) compliance_flags.push('CURRENT_VOLUME_BELOW_BREAKEVEN');
  }

  const output_payload = {
    breakeven_units: r2(breakevenUnits),
    breakeven_revenue: r2(breakevenRevenue),
    unit_contribution: r4(unitContribution),
    contribution_margin_ratio: r4(contributionMarginRatio),
    fixed_costs: r2(fixedCosts),
    price_per_unit: r2(pricePerUnit),
    variable_cost_per_unit: r2(variableCostPerUnit),
    margin_of_safety_units: marginOfSafetyUnits,
    margin_of_safety_pct: marginOfSafetyPct,
    regulatory_basis: 'Standard cost-volume-profit (CVP) breakeven analysis, textbook definition (managerial accounting)',
    note: 'breakeven_units = fixed_costs / (price_per_unit - variable_cost_per_unit). margin_of_safety fields populate only when current_units is supplied and unit_contribution is positive.',
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
