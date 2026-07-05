import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-250-model-stablecoin-corridor-economics';
const TOOL_VERSION = '1.0.0';

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mandate_type: 'analytics_mandate', gpu: false };

// Generic stablecoin remittance corridor all-in cost model.
// Models USDC-based corridor economics: on-ramp + chain fee + off-ramp/local rail + FX spread +
// pre-funding float saved vs correspondent (2-7%) --> all-in bps + break-even vs traditional MTO.
// Rail-agnostic: parameterizes the Felix/Circle/Bitso pattern but is NOT tied to a specific protocol.
//
// DISAMBIGUATE:
//   model_x402_settlement    -- x402 HTTP payment protocol settlement economics (protocol-specific)
//   model_tempo_payment_economics -- Tempo Network protocol payment economics (protocol-specific)
//   model_arc_cpn_economics  -- Arc Protocol CPN staking/spread (protocol-specific)
//   model_stablecoin_corridor_economics (THIS) -- GENERIC USDC corridor all-in cost (on-ramp+chain+off-ramp+FX+float savings)
//
// Source: Felix/Circle case study (Stripe, 2024); World Bank RPW Q1 2026; industry on-ramp/off-ramp benchmarks.

const TABLE_VERSION = 'STABLECOIN-CORRIDOR-ECON-V1-2026';
const TABLE_SOURCE  = 'Felix/Circle USDC corridor case study (Stripe, 2024); World Bank RPW Q1 2026 global avg 6.36%; industry on-ramp benchmark 0.5-2%; off-ramp/local-rail benchmark 0.3-1.5%; correspondent pre-funding float benchmark 2-7% annually on float balance.';

export function compute(params) {
  const p = params || {};

  // --- Inputs ---
  const send_amount_usd        = _finite(p.send_amount_usd, 1000);    // USD sent
  const on_ramp_fee_pct        = _finite(p.on_ramp_fee_pct, 1.0);     // % USD -> USDC (typical 0.5-2%)
  const chain_fee_usd          = _finite(p.chain_fee_usd, 0.01);      // flat chain / gas fee USD (~0 on Stellar/Solana/L2)
  const off_ramp_fee_pct       = _finite(p.off_ramp_fee_pct, 0.8);    // % USDC -> local fiat (typical 0.3-1.5%)
  const fx_spread_pct          = _finite(p.fx_spread_pct, 0.5);       // % FX spread on destination leg (stablecoin rails compress this)
  const float_savings_rate_pct = _finite(p.float_savings_rate_pct, 4.0); // annual % saved by avoiding nostro pre-funding (typical 2-7%)
  const float_days             = _finite(p.float_days, 0);            // days of float avoided (pre-funding released)
  const correspondent_cost_pct = _finite(p.correspondent_cost_pct, 6.0); // traditional MTO/correspondent all-in % (benchmark)

  // --- Stablecoin corridor cost components ---
  const on_ramp_fee_usd   = _round2((on_ramp_fee_pct  / 100) * send_amount_usd);
  const off_ramp_fee_usd  = _round2((off_ramp_fee_pct / 100) * send_amount_usd);
  const fx_spread_usd     = _round2((fx_spread_pct    / 100) * send_amount_usd);

  // Float savings: annual_rate * (days/365) * send_amount
  const float_savings_usd = float_days > 0
    ? _round2((float_savings_rate_pct / 100) * (float_days / 365) * send_amount_usd)
    : 0;

  // Total stablecoin corridor cost (before float credit)
  const gross_stablecoin_cost_usd = _round2(on_ramp_fee_usd + chain_fee_usd + off_ramp_fee_usd + fx_spread_usd);

  // Net stablecoin cost (after float savings if applicable)
  const net_stablecoin_cost_usd = _round2(Math.max(0, gross_stablecoin_cost_usd - float_savings_usd));

  // All-in cost in bps and %
  const gross_cost_pct = send_amount_usd > 0 ? _round4((gross_stablecoin_cost_usd / send_amount_usd) * 100) : 0;
  const net_cost_pct   = send_amount_usd > 0 ? _round4((net_stablecoin_cost_usd   / send_amount_usd) * 100) : 0;
  const gross_cost_bps = _round2(gross_cost_pct * 100);
  const net_cost_bps   = _round2(net_cost_pct   * 100);

  // --- Traditional MTO benchmark ---
  const correspondent_cost_usd = _round2((correspondent_cost_pct / 100) * send_amount_usd);
  const savings_vs_traditional_usd = _round2(correspondent_cost_usd - gross_stablecoin_cost_usd);
  const savings_vs_traditional_pct = _round4(correspondent_cost_pct - gross_cost_pct);

  // Break-even analysis: at what send amount does the stablecoin corridor become cheaper than traditional?
  // gross_stablecoin = (on_ramp+off_ramp+fx_spread)/100 * S + chain_fee
  // traditional = correspondent_cost_pct/100 * S
  // Break-even: S * (trad - stablecoin_variable)/100 = chain_fee
  const stablecoin_variable_pct = on_ramp_fee_pct + off_ramp_fee_pct + fx_spread_pct;
  let break_even_usd = null;
  const cost_pct_diff = correspondent_cost_pct - stablecoin_variable_pct;
  if (cost_pct_diff > 0) {
    break_even_usd = _round2((chain_fee_usd * 100) / cost_pct_diff);
  } else if (cost_pct_diff <= 0) {
    // Stablecoin always cheaper if variable costs >= traditional
    break_even_usd = 0;
  }

  // Meets SDG 3% target?
  const sdg_target_pct = 3.0;
  const meets_sdg_target = gross_cost_pct <= sdg_target_pct;

  // FX markup as share of total traditional cost (research finding: ~35% of traditional corridor cost is FX markup)
  const fx_markup_share_of_traditional = correspondent_cost_pct > 0
    ? _round4((fx_spread_pct / correspondent_cost_pct) * 100) : null;

  return {
    send_amount_usd,
    // Cost components
    on_ramp_fee_usd,
    chain_fee_usd,
    off_ramp_fee_usd,
    fx_spread_usd,
    float_savings_usd,
    // Totals
    gross_stablecoin_cost_usd,
    net_stablecoin_cost_usd,
    gross_cost_pct,
    net_cost_pct,
    gross_cost_bps,
    net_cost_bps,
    // Traditional comparison
    correspondent_cost_pct,
    correspondent_cost_usd,
    savings_vs_traditional_usd,
    savings_vs_traditional_pct,
    break_even_usd,
    // SDG
    sdg_target_pct,
    meets_sdg_target,
    // FX share analysis
    fx_markup_share_of_traditional,
    // Disambiguation
    disambiguation: 'model_stablecoin_corridor_economics models GENERIC USDC remittance corridor all-in cost (on-ramp+chain+off-ramp+FX+float savings) and break-even vs traditional MTO. It is rail-agnostic. For protocol-specific economics use: model_x402_settlement (x402 protocol), model_tempo_payment_economics (Tempo Network), model_arc_cpn_economics (Arc Protocol CPN). For cross-corridor cost benchmarking against World Bank RPW data use compare_corridor_cost.',
    table_version:    TABLE_VERSION,
    table_source:     TABLE_SOURCE,
    regulatory_basis: 'Generic USDC corridor model; World Bank RPW Q1 2026 global average (6.36%); SDG 10.c 3% target; Felix/Circle case study benchmarks (Stripe 2024)',
    pii_note: 'ZERO PII: amounts, rates, fee percentages only. No sender, recipient, or account data enters this kernel.'
  };
}

function _finite(v, def) {
  const n = Number(v);
  return (isFinite(n) && !isNaN(n)) ? n : def;
}

function _round4(v) { return Math.round(v * 10000) / 10000; }
function _round2(v) { return Math.round(v * 100) / 100; }

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const output_payload = compute(pp);
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
    compliance_flags: [],
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
