/**
 * art-46-arc-paymaster-model.kernel.mjs
 * Arc Paymaster Economics Model — ERC-4337 gas cost comparison.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Arc advantage: USDC-as-native-gas — no ETH required for account operations.
 * ERC-4337 UserOperation (UOp): bundled AA transaction; Paymaster sponsors gas.
 * Reference: EIP-4337 spec; Circle Paymaster docs; Arc testnet data (Oct 2025).
 */

export const meta = {
  tool_id:      'art-46-arc-paymaster-model',
  mcp_name:     'model_arc_paymaster_economics',
  mandate_type: 'treasury_mandate',
  version:      '1.0.0',
};

const IMPL_COST_PER_MONTH = 12_000;

// Verdict thresholds
const MIGRATE_MIN_ANNUAL    = 50_000;
const MIGRATE_MAX_BREAKEVEN = 12;
const EVALUATE_MIN_ANNUAL   = 10_000;
const EVALUATE_MAX_BREAKEVEN = 24;

export function compute(pp) {
  const {
    gas_per_uop               = 150_000, // typical ERC-4337 UOp gas (~150k units)
    gas_price_gwei            = 30,      // Ethereum L1 gas price (gwei)
    eth_price_usd             = 3_500,   // ETH/USD
    arc_usdc_per_gas_unit     = 0.000_001, // Arc USDC cost per gas unit (testnet estimate)
    monthly_uops              = 10_000,  // UserOperations per month
    merchant_sponsorship_pct  = 0,       // % of UOps the merchant sponsors via Paymaster
    impl_months               = 3,
  } = pp;

  const gasPerUop    = Number(gas_per_uop);
  const gasPrGwei    = Number(gas_price_gwei);
  const ethPrUsd     = Number(eth_price_usd);
  const arcPrGas     = Number(arc_usdc_per_gas_unit);
  const monthlyUops  = Number(monthly_uops);
  const sponsPct     = Math.min(100, Math.max(0, Number(merchant_sponsorship_pct)));
  const implMonths   = Number(impl_months) || 3;

  // ETH L1: gas_per_uop × gas_price_gwei × 1e-9 × eth_price_usd
  const ethCostPerUop = gasPerUop * gasPrGwei * 1e-9 * ethPrUsd;

  // Arc without Paymaster (user pays USDC gas directly)
  const arcCostPerUopFull = gasPerUop * arcPrGas;

  // Arc with Paymaster sponsorship (user portion)
  const userPortionPct        = (100 - sponsPct) / 100;
  const arcCostPerUopUser     = arcCostPerUopFull * userPortionPct;

  // Merchant sponsorship cost (paid by merchant for the sponsored fraction)
  const arcCostPerUopMerchant = arcCostPerUopFull * (sponsPct / 100);

  // Saving vs ETH L1 (merchant+user combined vs ETH L1)
  const arcTotalPerUop  = arcCostPerUopFull; // total chain cost is the same; just who pays differs
  const savingPerUop    = ethCostPerUop - arcTotalPerUop;
  const savingBps       = ethCostPerUop > 0
    ? (savingPerUop / ethCostPerUop) * 10_000
    : 0;

  // Monthly / annual economics
  const monthlyEthCost  = ethCostPerUop * monthlyUops;
  const monthlyArcCost  = arcCostPerUopFull * monthlyUops;
  const monthlySaving   = monthlyEthCost - monthlyArcCost;
  const annualSaving    = monthlySaving * 12;

  // Implementation
  const implCost        = implMonths * IMPL_COST_PER_MONTH;
  const breakEvenMonths = annualSaving > 0
    ? implCost / (annualSaving / 12)
    : Infinity;

  // Verdict
  let verdict;
  if (annualSaving >= MIGRATE_MIN_ANNUAL && breakEvenMonths <= MIGRATE_MAX_BREAKEVEN) {
    verdict = 'MIGRATE';
  } else if (annualSaving >= EVALUATE_MIN_ANNUAL && breakEvenMonths <= EVALUATE_MAX_BREAKEVEN) {
    verdict = 'EVALUATE';
  } else {
    verdict = 'HOLD';
  }

  const compliance_flags = [];
  if (verdict === 'MIGRATE')       compliance_flags.push('ARC_PAYMASTER_MIGRATION_RECOMMENDED');
  else if (verdict === 'EVALUATE') compliance_flags.push('ARC_PAYMASTER_EVALUATION_RECOMMENDED');
  else                             compliance_flags.push('ARC_PAYMASTER_HOLD');
  if (sponsPct > 0)                compliance_flags.push('ERC4337_MERCHANT_SPONSORSHIP_ACTIVE');
  if (arcCostPerUopUser === 0)     compliance_flags.push('ZERO_GAS_USER_EXPERIENCE');

  return {
    verdict,
    eth_cost_per_uop_usd:         +ethCostPerUop.toFixed(6),
    arc_cost_per_uop_full_usd:    +arcCostPerUopFull.toFixed(6),
    arc_cost_per_uop_user_usd:    +arcCostPerUopUser.toFixed(6),
    arc_cost_per_uop_merchant_usd: +arcCostPerUopMerchant.toFixed(6),
    saving_per_uop_usd:           +savingPerUop.toFixed(6),
    saving_bps:                   +savingBps.toFixed(2),
    monthly_saving_usd:           +monthlySaving.toFixed(2),
    annual_saving_usd:            +annualSaving.toFixed(2),
    impl_cost_usd:                +implCost.toFixed(2),
    break_even_months:            isFinite(breakEvenMonths) ? +breakEvenMonths.toFixed(1) : null,
    compliance_flags,
  };
}

export function buildArtifact(pp, opts = {}) {
  const r = compute(pp);
  return {
    tool_id:      meta.tool_id,
    mandate_type: meta.mandate_type,
    ...r,
    inputs: pp,
  };
}
