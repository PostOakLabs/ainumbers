/**
 * art-63-agent-service-metering-modeler.kernel.mjs
 * Wave 14 — Agent-Service Metering & Marketplace Economics Modeler (W-D).
 * Models the metering and unit economics of an agent-consumed service paid via x402:
 * per-call pricing, metered usage, settlement cost (batched vs per-request), take-rate,
 * marketplace infrastructure cost, net margin, break-even, and batch savings.
 *
 * EDUCATIONAL ESTIMATOR — not pricing, legal, or financial advice.
 * Mark educational clearly in every display surface.
 *
 * Template: art-03 (x402 settlement economics) + Arc/Tempo economics modelers.
 *
 * Pure decision kernel — no DOM, no window, no Date.now().
 * Citations (verify against current primary sources):
 *   x402 V2 batch-settlement cost mechanics:
 *     https://github.com/x402-foundation/x402
 *   Agent-service marketplace public pricing — verify any outward-facing figures.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-63-agent-service-metering-modeler';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'model_agent_service_metering',
  mandate_type: 'payment_policy',
  gpu:          false,
};

export function compute(pp) {
  const {
    pricing      = {},
    usage        = {},
    settlement   = {},
    marketplace  = {},
  } = pp;

  // Pricing
  const {
    model           = 'per-call',  // 'per-call' | 'per-token' | 'subscription' | 'tiered'
    unit_price_minor = 100,         // price per call/token/period in minor currency units (e.g. µUSDC)
    currency         = 'USDC',
  } = pricing;

  // Usage
  const {
    calls_per_day     = 10000,
    avg_units_per_call = 1,          // relevant for per-token model
  } = usage;

  // Settlement
  const {
    rail               = 'x402-v2',  // 'x402-v2' | 'x402-v1'
    batch              = true,        // true = amortise per_tx_cost across batch_size
    per_tx_cost_minor  = 50,          // cost per onchain transaction (minor units)
    batch_size         = 1000,        // vouchers redeemed per onchain tx
  } = settlement;

  // Marketplace
  const {
    take_rate_pct      = 2.5,         // percentage taken by marketplace operator
    infra_cost_per_day_minor = 100000, // fixed infra/ops cost per day
  } = marketplace;

  // --- Revenue ---
  const units_per_day = model === 'per-token'
    ? calls_per_day * avg_units_per_call
    : calls_per_day;

  const gross_revenue_day = units_per_day * unit_price_minor;

  // --- Settlement cost ---
  let settlement_cost_day;
  let batch_savings_pct = 0;

  if (batch && batch_size > 1) {
    // Batched: one onchain tx per batch_size vouchers → cost amortised
    const onchain_txs_per_day   = Math.ceil(calls_per_day / batch_size);
    const batched_cost_day      = onchain_txs_per_day * per_tx_cost_minor;
    const unbatched_cost_day    = calls_per_day * per_tx_cost_minor;
    settlement_cost_day = batched_cost_day;
    batch_savings_pct = unbatched_cost_day > 0
      ? +((1 - batched_cost_day / unbatched_cost_day) * 100).toFixed(1)
      : 0;
  } else {
    // Per-request (x402 V1): every call → one onchain tx
    settlement_cost_day = calls_per_day * per_tx_cost_minor;
  }

  // --- Marketplace economics ---
  const take_amount_day       = gross_revenue_day * (take_rate_pct / 100);
  const take_and_infra_day    = take_amount_day + infra_cost_per_day_minor;
  const net_margin_day        = gross_revenue_day - settlement_cost_day - take_and_infra_day;
  const net_margin_pct        = gross_revenue_day > 0
    ? +((net_margin_day / gross_revenue_day) * 100).toFixed(2)
    : 0;

  // --- Break-even ---
  // gross_revenue = settlement_cost_per_call * n + take_rate * price * n + infra
  // n * price * (1 - take_rate) - n * settlement_cost_per_call = infra
  const settlement_cost_per_call = settlement_cost_day / (calls_per_day || 1);
  const revenue_net_take_per_call = unit_price_minor * (1 - take_rate_pct / 100);
  const margin_per_call = revenue_net_take_per_call - settlement_cost_per_call;
  const breakeven_calls_day = margin_per_call > 0
    ? Math.ceil(infra_cost_per_day_minor / margin_per_call)
    : null; // infinite if margin per call is negative

  // --- Sensitivity: batch size vs net margin ---
  const sensitivity = [];
  for (const bs of [1, 10, 100, 500, 1000, 5000, 10000]) {
    if (bs > calls_per_day * 2 && bs > 1000) continue;
    const txs   = Math.ceil(calls_per_day / bs);
    const scost = txs * per_tx_cost_minor;
    const tak   = gross_revenue_day * (take_rate_pct / 100) + infra_cost_per_day_minor;
    const nm    = gross_revenue_day - scost - tak;
    const nmp   = gross_revenue_day > 0 ? +((nm / gross_revenue_day) * 100).toFixed(1) : 0;
    sensitivity.push({ batch_size: bs, settlement_cost_day: scost, net_margin_day: nm, net_margin_pct: nmp });
  }

  const compliance_flags = [];
  if (!pp.pricing || !pp.pricing.unit_price_minor) compliance_flags.push('UNMETERED_USAGE');
  if (net_margin_pct < 0) compliance_flags.push('NEGATIVE_UNIT_MARGIN');

  const output_payload = {
    gross_revenue_day,
    settlement_cost_day,
    take_and_infra_day,
    net_margin_day,
    net_margin_pct,
    breakeven_calls_day,
    batch_savings_pct,
    sensitivity,
    rail,
    batch,
    batch_size,
    currency,
    model,
    unit_price_minor,
    note: 'EDUCATIONAL ESTIMATOR — not pricing, legal, or financial advice. Models the unit economics of an agent-service micropayment marketplace under x402 V2 batch settlement. All figures are illustrative; verify x402 V2 settlement cost mechanics against current Linux Foundation x402 Foundation primary sources. Agent-service marketplace pricing is market-dependent — verify any outward-facing figures. (2026-06-20)',
    status_asof: '2026-06-20 — verify x402 V2 cost mechanics: https://github.com/x402-foundation/x402',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':          'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version:  '0.4.0',
    mandate_type:        meta.mandate_type,
    tool_id:             TOOL_ID,
    tool_version:        TOOL_VERSION,
    generated_at:        now ?? null,
    execution_hash:      hash,
    chain:               { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:   pp,
    output_payload,
    compliance_flags,
    compute_mode:        'server',
    audit_signature:     { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
