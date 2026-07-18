import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-368-compute-fx-netting-positions';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_fx_netting_positions',
  mandate_type: 'analytics_mandate', gpu: false,
};

// Multilateral FX netting (ports tools/105-fx-netting-simulator.html recalc()
// into a kernel, per TOOLIFY-1-BUILD-SPEC.md TF-2): net per currency first (in
// FCY), then convert to USD at the caller-supplied effective rate (spot with an
// optional forward-points adjustment in bps).
//   effective_rate = spot x (1 + fwd_bps / 10000)
//   pay_usd = pay x effective_rate ; rec_usd = rec x effective_rate
//   net_fcy = rec - pay ; net_usd = net_fcy x effective_rate
//   gross_usd = sum(pay_usd + rec_usd) ; net_usd_total = sum(abs(net_usd))
//   netting_efficiency_pct = (1 - net_usd_total / gross_usd) x 100
//   settlement_savings = tx_saved x avg_cost_per_tx  where tx_saved = max(0,
//     2*n_currencies - count(|net_usd| > 1000))
//   var_approx = abs(net_usd) x vol_30d x 1.65   (95% confidence, caller-supplied vol)
// Spot rates, 30-day vol, and hedge-instrument recommendations are caller-supplied
// reference data -- this kernel never vendors a live FX-rate feed or a vol surface.
// Pure ECMA-262 arithmetic only -- no Math.pow, no Date.now/new Date(), no Math.random.

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

const AVG_COST_PER_TX_USD = 30; // SWIFT mid-range, per source tool

export function compute(pp) {
  pp = pp || {};
  const positions = Array.isArray(pp.positions) ? pp.positions : [];
  const compliance_flags = [];

  const ccyData = positions.map((p) => {
    p = p || {};
    const ccy = String(p.ccy || '').trim().toUpperCase();
    const pay = Math.max(0, safeNum(p.pay, 0));
    const rec = Math.max(0, safeNum(p.rec, 0));
    const spot = safeNum(p.spot, 1);
    const fwdBps = safeNum(p.fwd_bps, 0);
    const vol30d = safeNum(p.vol_30d, 0.04);
    if (spot <= 0) compliance_flags.push(`FXNET_NON_POSITIVE_SPOT:${ccy || 'UNKNOWN'}`);
    const effectiveRate = spot * (1 + fwdBps / 10000);
    const payUsd = pay * effectiveRate;
    const recUsd = rec * effectiveRate;
    const netFcy = rec - pay;
    const netUsd = netFcy * effectiveRate;
    return { ccy, pay, rec, spot, fwd_bps: fwdBps, effective_rate: effectiveRate, pay_usd: payUsd, rec_usd: recUsd, net_fcy: netFcy, net_usd: netUsd, vol_30d: vol30d };
  });

  const grossUsd = ccyData.reduce((s, d) => s + d.pay_usd + d.rec_usd, 0);
  const netUsdTotal = ccyData.reduce((s, d) => s + Math.abs(d.net_usd), 0);
  const efficiencyPct = grossUsd > 0 ? (1 - netUsdTotal / grossUsd) * 100 : 0;

  const grossTxCount = ccyData.length * 2;
  const netTxCount = ccyData.filter((d) => Math.abs(d.net_usd) > 1000).length;
  const txSaved = Math.max(0, grossTxCount - netTxCount);
  const settlementSavings = txSaved * AVG_COST_PER_TX_USD;

  const positionsOut = ccyData.map((d) => ({
    ccy: d.ccy,
    net_fcy: r2(d.net_fcy),
    net_usd: r2(d.net_usd),
    var_approx_usd: r2(Math.abs(d.net_usd) * d.vol_30d * 1.65),
  }));

  const output_payload = {
    gross_volume_usd: r2(grossUsd),
    net_volume_usd: r2(netUsdTotal),
    netting_efficiency_pct: r2(efficiencyPct),
    estimated_settlement_savings_usd: r2(settlementSavings),
    currency_count: ccyData.length,
    positions: positionsOut,
    regulatory_basis: 'Settlement cost estimate uses SWIFT-wire mid-range per-transaction cost; VaR uses a 95% one-tailed normal approximation (z=1.65) against caller-supplied 30-day volatility. Spot rates, forward points, and volatility inputs are caller-supplied reference data, never vendored.',
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
