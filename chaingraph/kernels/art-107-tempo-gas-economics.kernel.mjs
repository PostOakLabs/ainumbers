/**
 * art-107-tempo-gas-economics.kernel.mjs
 * Tempo Fee-Sponsorship & Gas-AMM Economics.
 * Models blended gas cost via Tempo's enshrined AMM + server-paid fee sponsorship,
 * vs card/SWIFT/ACH baselines. DISTINCT from art-46 Arc Paymaster/ERC-4337.
 * Pure decision kernel — no DOM, no window, no Date.now().
 */
import { executionHash } from './_hash.mjs';

// Deterministic en-US number format — exact pure-JS replica of (n).toLocaleString('en-US') default options
// (group-3 integer digits, 0..3 fraction digits, halfExpand rounding). Used instead of toLocaleString so the
// OCG runner-guest (QuickJS-ng, no ICU) produces output byte-identical to V8. Verified vs V8 over 105k+ values.
function fmtEnUS(n) {
  n = Number(n);
  if (Number.isNaN(n)) return 'NaN';
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '-∞';
  const sign = (n < 0) ? '-' : '';
  let s = Math.abs(n).toString();
  if (s.includes('e') || s.includes('E')) return sign + s;
  let [intPart, fracPart = ''] = s.split('.');
  if (fracPart.length > 3) {
    const keep = fracPart.slice(0, 3);
    const nextDigit = fracPart.charCodeAt(3) - 48;
    const digits = (intPart + keep).split('').map((c) => c.charCodeAt(0) - 48);
    if (nextDigit >= 5) {
      let i = digits.length - 1;
      for (; i >= 0; i--) { if (digits[i] === 9) { digits[i] = 0; } else { digits[i]++; break; } }
      if (i < 0) digits.unshift(1);
    }
    const all = digits.join('');
    intPart = all.slice(0, all.length - keep.length) || '0';
    fracPart = all.slice(all.length - keep.length);
  }
  fracPart = fracPart.replace(/0+$/, '');
  intPart = intPart.replace(/^0+(?=\d)/, '');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sign + grouped + (fracPart ? '.' + fracPart : '');
}

const TOOL_ID = 'art-107-tempo-gas-economics';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'model_tempo_gas_economics',
  mandate_type: 'treasury_mandate',
  gpu:          false,
};

// Tempo enshrined AMM: any-stablecoin fees via protocol AMM. No native gas token.
const TEMPO_BASE_USD = 0.0003; // $0.0003/tx flat (Tempo payment lane)
const IMPL_COST_PER_MONTH = 15_000;

const BASELINE_RAILS = {
  swift: { fixed: 18.00, pct: 0.001 },
  card:  { fixed: 0.10,  pct: 0.015 },
  ach:   { fixed: 0.26,  pct: 0.000 },
};

export function compute(pp) {
  const {
    monthly_volume = 100000,
    fee_mix        = { USDC: 1.0 },
    amm_slippage   = { USDC: 0 },
    server_paid_pct = 0,
    baseline_rail  = 'swift',
    tx_amount_usd  = 1000,
    impl_months    = 3,
  } = pp;

  const vol      = Number(monthly_volume) || 0;
  const srvPct   = Number(server_paid_pct) || 0;
  const txAmt    = Number(tx_amount_usd) || 0;
  const implMo   = Number(impl_months) || 3;
  const rail     = BASELINE_RAILS[baseline_rail] ?? BASELINE_RAILS.swift;

  // Weighted AMM slippage across fee-stablecoins
  const tokens = Object.keys(fee_mix);
  let weightedSlippageBps = 0;
  for (const t of tokens) {
    weightedSlippageBps += (fee_mix[t] || 0) * (amm_slippage[t] || 0);
  }

  const blended_gas_cost    = +(TEMPO_BASE_USD * (1 + weightedSlippageBps / 10_000)).toFixed(8);
  const subsidy_per_tx      = +(srvPct * blended_gas_cost).toFixed(8);
  const effective_cost      = +((1 - srvPct) * blended_gas_cost).toFixed(8);
  const baseline_fee        = +(rail.fixed + txAmt * rail.pct).toFixed(6);
  const per_tx_saving       = +(baseline_fee - effective_cost).toFixed(6);
  const annual_saving       = +(per_tx_saving * vol * 12).toFixed(2);
  const impl_cost           = implMo * IMPL_COST_PER_MONTH;
  const sponsorship_breakeven_tx = (srvPct > 0 && subsidy_per_tx > 0)
    ? Math.round(impl_cost / subsidy_per_tx)
    : null;

  const compliance_flags = ['TEMPO_GAS_AMM_MODELLED'];
  if (per_tx_saving > baseline_fee * 0.9) compliance_flags.push('TEMPO_COST_ADVANTAGE_STRONG');
  if (srvPct > 0) compliance_flags.push('SPONSORSHIP_SUBSIDY_ACTIVE');

  const cfo_memo = `Tempo effective gas $${effective_cost.toFixed(6)}/tx (${(srvPct*100).toFixed(0)}% server-paid via enshrined AMM). Saves $${per_tx_saving.toFixed(4)}/tx vs ${baseline_rail.toUpperCase()} ($${baseline_fee.toFixed(4)}/tx). Annual saving: $${(annual_saving/1e6).toFixed(2)}M on ${fmtEnUS(vol)} tx/mo. NOTE: Tempo has no native gas token and uses an enshrined protocol AMM — not ERC-4337/Paymaster (art-46).`;

  const output_payload = {
    blended_gas_cost,
    amm_slippage_bps:          +weightedSlippageBps.toFixed(4),
    server_paid_pct:           srvPct,
    effective_cost,
    baseline_fee,
    per_tx_saving,
    annual_saving,
    sponsorship_breakeven_tx,
    cfo_memo,
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
