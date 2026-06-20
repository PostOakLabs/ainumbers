/**
 * art-46-arc-paymaster-model.kernel.mjs
 * Arc Paymaster Economics Model — ERC-4337 gas cost comparison.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Arc advantage: USDC-as-native-gas — no ETH required for account operations.
 * ERC-4337 UserOperation (UOp): bundled AA transaction; Paymaster sponsors gas.
 * Reference: EIP-4337 spec; Circle Paymaster docs; Arc testnet data (Oct 2025).
 */

import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-46-arc-paymaster-model';
const TOOL_VERSION = '1.0.0';

const IMPL_COST_PER_MONTH    = 12_000;
const MIGRATE_MIN_ANNUAL     = 50_000;
const MIGRATE_MAX_BREAKEVEN  = 12;
const EVALUATE_MIN_ANNUAL    = 10_000;
const EVALUATE_MAX_BREAKEVEN = 24;

export function compute(pp) {
  const {
    gas_per_uop              = 150_000,
    gas_price_gwei           = 30,
    eth_price_usd            = 3_500,
    arc_usdc_per_gas_unit    = 0.000_001,
    monthly_uops             = 10_000,
    merchant_sponsorship_pct = 0,
    impl_months              = 3,
  } = pp;

  const gasPerUop   = Number(gas_per_uop);
  const gasPrGwei   = Number(gas_price_gwei);
  const ethPrUsd    = Number(eth_price_usd);
  const arcPrGas    = Number(arc_usdc_per_gas_unit);
  const monthlyUops = Number(monthly_uops);
  const sponsPct    = Math.min(100, Math.max(0, Number(merchant_sponsorship_pct)));
  const implMonths  = Number(impl_months) || 3;

  const ethCostPerUop         = gasPerUop * gasPrGwei * 1e-9 * ethPrUsd;
  const arcCostPerUopFull     = gasPerUop * arcPrGas;
  const userPortionPct        = (100 - sponsPct) / 100;
  const arcCostPerUopUser     = arcCostPerUopFull * userPortionPct;
  const arcCostPerUopMerchant = arcCostPerUopFull * (sponsPct / 100);
  const arcTotalPerUop        = arcCostPerUopFull;
  const savingPerUop          = ethCostPerUop - arcTotalPerUop;
  const savingBps             = ethCostPerUop > 0
    ? (savingPerUop / ethCostPerUop) * 10_000
    : 0;

  const monthlyEthCost = ethCostPerUop * monthlyUops;
  const monthlyArcCost = arcCostPerUopFull * monthlyUops;
  const monthlySaving  = monthlyEthCost - monthlyArcCost;
  const annualSaving   = monthlySaving * 12;

  const implCost        = implMonths * IMPL_COST_PER_MONTH;
  const breakEvenMonths = annualSaving > 0
    ? implCost / (annualSaving / 12)
    : Infinity;

  let verdict;
  if (annualSaving >= MIGRATE_MIN_ANNUAL && breakEvenMonths <= MIGRATE_MAX_BREAKEVEN) {
    verdict = 'MIGRATE';
  } else if (annualSaving >= EVALUATE_MIN_ANNUAL && breakEvenMonths <= EVALUATE_MAX_BREAKEVEN) {
    verdict = 'EVALUATE';
  } else {
    verdict = 'HOLD';
  }

  const compliance_flags = [];
  if (verdict === 'MIGRATE')        compliance_flags.push('ARC_PAYMASTER_MIGRATION_RECOMMENDED');
  else if (verdict === 'EVALUATE')  compliance_flags.push('ARC_PAYMASTER_EVALUATION_RECOMMENDED');
  else                              compliance_flags.push('ARC_PAYMASTER_HOLD');
  if (sponsPct > 0)                compliance_flags.push('ERC4337_MERCHANT_SPONSORSHIP_ACTIVE');
  if (arcCostPerUopUser === 0)     compliance_flags.push('ZERO_GAS_USER_EXPERIENCE');

  const output_payload = {
    verdict,
    eth_cost_per_uop_usd:          +ethCostPerUop.toFixed(6),
    arc_cost_per_uop_full_usd:     +arcCostPerUopFull.toFixed(6),
    arc_cost_per_uop_user_usd:     +arcCostPerUopUser.toFixed(6),
    arc_cost_per_uop_merchant_usd: +arcCostPerUopMerchant.toFixed(6),
    saving_per_uop_usd:            +savingPerUop.toFixed(6),
    saving_bps:                    +savingBps.toFixed(2),
    monthly_saving_usd:            +monthlySaving.toFixed(2),
    annual_saving_usd:             +annualSaving.toFixed(2),
    impl_cost_usd:                 +implCost.toFixed(2),
    break_even_months:             isFinite(breakEvenMonths) ? +breakEvenMonths.toFixed(1) : null,
    compliance_flags,
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type:       'treasury_mandate',
    tool_id:            TOOL_ID,
    tool_version:       TOOL_VERSION,
    generated_at:       now ?? null,
    execution_hash:     hash,
    chain:              { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:  pp,
    output_payload,
    compliance_flags,
    compute_mode:       'server',
    audit_signature:    { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, gpu: false, mandate_type: 'treasury_mandate' };
