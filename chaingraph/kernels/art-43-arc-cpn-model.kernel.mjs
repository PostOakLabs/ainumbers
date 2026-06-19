/**
 * art-43-arc-cpn-model.kernel.mjs
 * Arc CPN Corridor Economics Model — cost vs SWIFT/ACH/SEPA/card/RTP.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Benchmarks:
 *   WorldBank Q4 2024: SWIFT/correspondent avg 5.5% remittance (global)
 *   Nacha 2024: ACH $0.26 fixed
 *   EBA 2024: SEPA Credit Transfer €0.087 avg
 *   Card interchange: $0.10 + 1.5% (Visa/MC typical card-not-present)
 *   RTP (The Clearing House): $0.045 + 0.05%
 *   CPN (Circle): $0.01 flat (adjustable, near-zero FX spread via Arc)
 */

export const meta = {
  tool_id:      'art-43-arc-cpn-model',
  mcp_name:     'model_arc_cpn_economics',
  mandate_type: 'treasury_mandate',
  version:      '1.0.0',
};

// Incumbent rail fee table: { fixed_usd, pct_of_notional }
const RAIL_FEES = {
  swift: { fixed: 18.00, pct: 0.0010 },  // $18 fixed + 0.10% fees (excl. FX spread)
  ach:   { fixed:  0.26, pct: 0.0000 },
  sepa:  { fixed:  0.09, pct: 0.0000 },
  card:  { fixed:  0.10, pct: 0.0150 },
  rtp:   { fixed:  0.045, pct: 0.0005 },
};

const CPN_FIXED = 0.01; // $0.01/tx flat (Circle estimate; user-adjustable via cpn_fee_usd)

// FX spread benchmark by rail (bps of notional)
const RAIL_FX_SPREAD_BPS = {
  swift: 150,  // typical correspondent bank FX margin
  ach:   0,    // domestic only — no FX
  sepa:  0,    // EUR zone — no FX for EUR corridors
  card:  100,  // card network FX (dynamic currency conversion)
  rtp:   0,    // domestic USD
};

const IMPL_COST_PER_MONTH = 12_000; // $12k/month professional services

// Verdict thresholds
const MIGRATE_MIN_ANNUAL   = 60_000;
const MIGRATE_MAX_BREAKEVEN = 12;
const EVALUATE_MIN_ANNUAL  = 10_000;
const EVALUATE_MAX_BREAKEVEN = 24;

export function compute(pp) {
  const {
    rail           = 'swift',
    notional_usd,
    monthly_volume,
    fx_spread_bps,
    impl_months    = 3,
    cpn_fee_usd,
  } = pp;

  const txAmount   = Number(notional_usd)   || 0;
  const monthlyVol = Number(monthly_volume)  || 0;
  const implMonths = Number(impl_months)     || 3;
  const cpnFee     = cpn_fee_usd !== undefined ? Number(cpn_fee_usd) : CPN_FIXED;

  const railFee = RAIL_FEES[rail] ?? RAIL_FEES.swift;

  // Incumbent FX spread
  const defaultFxBps     = RAIL_FX_SPREAD_BPS[rail] ?? 0;
  const effectiveFxBps   = fx_spread_bps !== undefined ? Number(fx_spread_bps) : defaultFxBps;
  const fxCostIncumbent  = txAmount * (effectiveFxBps / 10_000);

  // Per-transaction costs
  const perTxIncumbent = railFee.fixed + txAmount * railFee.pct + fxCostIncumbent;
  const perTxCPN       = cpnFee; // Arc provides near-zero FX spread on Arc
  const perTxSaving    = perTxIncumbent - perTxCPN;
  const savingBps      = txAmount > 0 ? (perTxSaving / txAmount) * 10_000 : 0;

  // Annual economics
  const monthlySaving   = perTxSaving * monthlyVol;
  const annualSaving    = monthlySaving * 12;
  const implCost        = implMonths * IMPL_COST_PER_MONTH;
  const breakEvenMonths = annualSaving > 0
    ? implCost / (annualSaving / 12)
    : Infinity;

  // 3-year NPV (undiscounted for simplicity; discount rate = 0)
  const npv3yr = annualSaving * 3 - implCost;

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
  if (verdict === 'MIGRATE')   compliance_flags.push('ARC_CPN_MIGRATION_RECOMMENDED');
  else if (verdict === 'EVALUATE') compliance_flags.push('ARC_CPN_EVALUATION_RECOMMENDED');
  else                         compliance_flags.push('ARC_CPN_HOLD');
  // CPMI PFMI P4 cross-border payment efficiency flag
  if (effectiveFxBps > 100)   compliance_flags.push('PFMI_P4_FX_COST_HIGH');

  return {
    verdict,
    rail,
    per_tx_incumbent_usd:  +perTxIncumbent.toFixed(6),
    per_tx_cpn_usd:        +perTxCPN.toFixed(6),
    per_tx_saving_usd:     +perTxSaving.toFixed(6),
    saving_bps:            +savingBps.toFixed(2),
    fx_spread_bps_applied: effectiveFxBps,
    monthly_saving_usd:    +monthlySaving.toFixed(2),
    annual_saving_usd:     +annualSaving.toFixed(2),
    npv_3yr_usd:           +npv3yr.toFixed(2),
    impl_cost_usd:         +implCost.toFixed(2),
    break_even_months:     isFinite(breakEvenMonths) ? +breakEvenMonths.toFixed(1) : null,
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
