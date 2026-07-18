import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-366-price-embedded-insurance';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'price_embedded_insurance',
  mandate_type: 'analytics_mandate', gpu: false,
};

// Embedded-insurance unit economics (ports tools/446-embedded-insurance-pricing-modeller.html
// compute() into a kernel, per TOOLIFY-1-BUILD-SPEC.md TF-2):
//   per_tx_premium = item_value x (premium_pct / 100)
//   monthly_gwp    = per_tx_premium x (attach_rate / 100) x monthly_tx
//   annual_gwp     = monthly_gwp x 12
//   nwp            = annual_gwp x (1 - reins_pct / 100)
//   expected_losses    = nwp x (loss_ratio_pct / 100)
//   commission_cost    = annual_gwp x (commission_pct / 100)
//   opex_cost          = annual_gwp x (opex_pct / 100)
//   uw_profit          = nwp - expected_losses - commission_cost - opex_cost
//   combined_ratio     = loss_ratio_pct + commission_pct + opex_pct   (simplified, per source tool)
//   expense_ratio      = commission_pct + opex_pct
//   breakeven_loss_ratio_pct = (nwp - commission_cost - opex_cost) / nwp x 100   (0 if nwp <= 0)
// Losses apply against net written premium (post-reinsurance); commission and
// opex apply against gross written premium -- this asymmetry is the source
// tool's own simplification and is ported as-is, not corrected.
// Pure ECMA-262 arithmetic only -- no Math.pow, no Date.now/new Date(), no Math.random.

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

export function compute(pp) {
  pp = pp || {};
  const itemValue = safeNum(pp.item_value, 0);
  const premiumPct = safeNum(pp.premium_pct, 0);
  const attachRate = safeNum(pp.attach_rate_pct, 0);
  const monthlyTx = safeNum(pp.monthly_tx, 0);
  const lossRatioPct = safeNum(pp.loss_ratio_pct, 0);
  const commissionPct = safeNum(pp.commission_pct, 0);
  const opexPct = safeNum(pp.opex_pct, 0);
  const reinsPct = safeNum(pp.reins_pct, 0);

  const compliance_flags = [];
  if (itemValue < 0 || premiumPct < 0 || attachRate < 0 || monthlyTx < 0) {
    compliance_flags.push('EMBI_NEGATIVE_INPUT');
  }

  const perTxPremium = itemValue * (premiumPct / 100);
  const monthlyGwp = perTxPremium * (attachRate / 100) * monthlyTx;
  const annualGwp = monthlyGwp * 12;
  const reinsFactor = 1 - (reinsPct / 100);
  const nwp = annualGwp * reinsFactor;
  const expectedLosses = nwp * (lossRatioPct / 100);
  const commissionCost = annualGwp * (commissionPct / 100);
  const opexCost = annualGwp * (opexPct / 100);
  const uwProfit = nwp - expectedLosses - commissionCost - opexCost;
  const combinedRatio = lossRatioPct + commissionPct + opexPct;
  const expenseRatio = commissionPct + opexPct;
  const breakevenLossRatioPct = nwp > 0 ? ((nwp - commissionCost - opexCost) / nwp) * 100 : 0;

  if (uwProfit < 0) compliance_flags.push('EMBI_UNDERWRITING_LOSS');

  const output_payload = {
    per_tx_premium: r2(perTxPremium),
    monthly_gwp: r2(monthlyGwp),
    annual_gwp: r2(annualGwp),
    net_written_premium: r2(nwp),
    expected_losses: r2(expectedLosses),
    commission_cost: r2(commissionCost),
    opex_cost: r2(opexCost),
    underwriting_profit: r2(uwProfit),
    combined_ratio_pct: r2(combinedRatio),
    expense_ratio_pct: r2(expenseRatio),
    breakeven_loss_ratio_pct: r2(breakevenLossRatioPct),
    note: 'Losses apply against net written premium (post-reinsurance); commission and opex apply against gross written premium, matching the source tool simplification.',
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
