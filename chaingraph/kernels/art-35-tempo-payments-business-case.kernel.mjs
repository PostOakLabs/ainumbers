/**
 * art-35-tempo-payments-business-case.kernel.mjs
 * Tempo Payments Business Case — CPN corridor cost model vs incumbent rails.
 * Pure decision kernel — no DOM, no window, no Date.now().
 */

export const meta = {
  tool_id:      'art-35-tempo-payments-business-case',
  mcp_name:     'model_tempo_payment_economics',
  mandate_type: 'treasury_mandate',
  version:      '1.0.0',
};

// Per-transaction fee tables for incumbent rails
const RAIL_FEES = {
  card:  { fixed: 0.10, pct: 0.015 },
  swift: { fixed: 18.00, pct: 0.001 },
  ach:   { fixed: 0.26,  pct: 0.000 },
  sepa:  { fixed: 0.087, pct: 0.000 },
};

// Tempo AMM fee by stablecoin
const AMM_PCT = {
  usdc:   0.000,
  usdt:   0.000,
  pathusd: 0.0005,
};

const TEMPO_FIXED = 0.0003; // $0.0003/tx flat

// Implementation cost rate (USD/month of professional services)
const IMPL_COST_PER_MONTH = 15_000;

// Verdict thresholds
const MIGRATE_MIN_ANNUAL = 50_000;
const MIGRATE_MAX_BREAKEVEN = 12;
const EVALUATE_MIN_ANNUAL = 5_000;
const EVALUATE_MAX_BREAKEVEN = 24;

export function compute(pp) {
  // pp: { rail, stablecoin, tx_amount_usd, monthly_volume, impl_months }
  const {
    rail = 'swift',
    stablecoin = 'usdc',
    tx_amount_usd,
    monthly_volume,
    impl_months = 3,
  } = pp;

  const txAmount  = Number(tx_amount_usd) || 0;
  const monthlyVol = Number(monthly_volume) || 0;
  const implMonths = Number(impl_months) || 3;

  const railFee = RAIL_FEES[rail] ?? RAIL_FEES.swift;
  const ammPct  = AMM_PCT[stablecoin] ?? 0;

  // Per-transaction costs
  const perTxIncumbent = railFee.fixed + txAmount * railFee.pct;
  const perTxTempo     = TEMPO_FIXED + txAmount * ammPct;
  const perTxSaving    = perTxIncumbent - perTxTempo;
  const savingBps      = txAmount > 0 ? (perTxSaving / txAmount) * 10_000 : 0;

  // Annual economics
  const monthlySaving  = perTxSaving * monthlyVol;
  const annualSaving   = monthlySaving * 12;
  const implCost       = implMonths * IMPL_COST_PER_MONTH;
  const breakEvenMonths = annualSaving > 0
    ? implCost / (annualSaving / 12)
    : Infinity;

  // Verdict
  let verdict;
  if (annualSaving > MIGRATE_MIN_ANNUAL && breakEvenMonths <= MIGRATE_MAX_BREAKEVEN) {
    verdict = 'MIGRATE';
  } else if (annualSaving > EVALUATE_MIN_ANNUAL && breakEvenMonths <= EVALUATE_MAX_BREAKEVEN) {
    verdict = 'EVALUATE';
  } else {
    verdict = 'HOLD';
  }

  const compliance_flags = [];
  if (verdict === 'MIGRATE') compliance_flags.push('TEMPO_MIGRATION_RECOMMENDED');
  else if (verdict === 'EVALUATE') compliance_flags.push('TEMPO_EVALUATION_RECOMMENDED');
  else compliance_flags.push('TEMPO_HOLD');

  return {
    verdict,
    rail,
    stablecoin,
    per_tx_incumbent_usd:    +perTxIncumbent.toFixed(6),
    per_tx_tempo_usd:        +perTxTempo.toFixed(6),
    per_tx_saving_usd:       +perTxSaving.toFixed(6),
    saving_bps:              +savingBps.toFixed(2),
    monthly_saving_usd:      +monthlySaving.toFixed(2),
    annual_saving_usd:       +annualSaving.toFixed(2),
    impl_cost_usd:           +implCost.toFixed(2),
    break_even_months:       isFinite(breakEvenMonths) ? +breakEvenMonths.toFixed(1) : null,
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
