/**
 * art-44-arc-stablefx-model.kernel.mjs
 * Arc StableFX RFQ Economics Model — Herstatt elimination + FX spread savings.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Methodology:
 *   BIS (Allsopp et al. 1996) — Herstatt credit cost ≈ counterparty credit spread
 *     applied to intraday FX exposure (half the trade notional, 4h avg intraday window).
 *   PFMI P12 — atomic PvP eliminates settlement risk; Arc StableFX: 24/7 continuous.
 *   BIS FX Global Code P35 — netting/PvP risk mitigation.
 *   CLS baseline: 5 settlement windows/day, 07:00–12:00 UTC.
 */

export const meta = {
  tool_id:      'art-44-arc-stablefx-model',
  mcp_name:     'model_arc_stablefx_rfq',
  mandate_type: 'treasury_mandate',
  version:      '1.0.0',
};

const TRADING_DAYS_DEFAULT = 250;

// Herstatt credit cost: BIS proxy — expected credit loss on intraday exposure
// Exposure = 50% of notional (avg intraday); window = 4h / 24h = 1/6 day
// Cost = notional × 0.5 × (1/6) × counterparty_spread_bps/10000
function herstattDailyCredit(dailyNotional, spreadBps) {
  return dailyNotional * 0.50 * (4 / 24) * (spreadBps / 10_000);
}

// Verdict thresholds (annual savings)
const MIGRATE_MIN    = 100_000;
const MIGRATE_BEVEN  = 18;
const EVALUATE_MIN   = 20_000;
const EVALUATE_BEVEN = 36;

const IMPL_COST_PER_MONTH = 15_000;

export function compute(pp) {
  const {
    daily_fx_volume_usd,
    herstatt_spread_bps     = 2.5,   // BIS Allsopp proxy: 2.5 bps credit cost
    non_cls_bilateral_bps   = 8,     // bilateral settlement spread vs CLS baseline
    cls_annual_fee_usd      = 100_000, // CLS direct member fixed annual cost
    stablefx_fee_bps        = 1.5,   // Arc StableFX quoted spread
    trading_days            = TRADING_DAYS_DEFAULT,
    impl_months             = 3,
  } = pp;

  const dailyVol   = Number(daily_fx_volume_usd)   || 0;
  const hBps       = Number(herstatt_spread_bps);
  const bilBps     = Number(non_cls_bilateral_bps);
  const clsFeeAnn  = Number(cls_annual_fee_usd);
  const sfxBps     = Number(stablefx_fee_bps);
  const tradDays   = Number(trading_days) || TRADING_DAYS_DEFAULT;
  const implMonths = Number(impl_months) || 3;

  // INCUMBENT (non-CLS bilateral)
  const incumbentSpreadDailyUsd = dailyVol * (bilBps / 10_000);
  const herstattDailyUsd        = herstattDailyCredit(dailyVol, hBps);
  const incumbentDailyUsd       = incumbentSpreadDailyUsd + herstattDailyUsd;
  const incumbentAnnualUsd      = incumbentDailyUsd * tradDays;

  // CLS BASELINE (for reference; not the incumbent being replaced)
  // CLS eliminates Herstatt but not spread; fixed annual membership cost applies
  const clsSpreadDailyUsd = dailyVol * (bilBps / 10_000) * 0.30; // CLS netting reduces gross ~70%
  const clsAnnualUsd      = clsSpreadDailyUsd * tradDays + clsFeeAnn;

  // ARC STABLEFX: flat fee, 24/7, zero Herstatt
  const stablefxDailyUsd   = dailyVol * (sfxBps / 10_000);
  const stablefxAnnualUsd  = stablefxDailyUsd * tradDays;

  // Savings vs incumbent (the primary comparison)
  const annualSavingVsIncumbent = incumbentAnnualUsd - stablefxAnnualUsd;
  const annualSavingVsCls       = clsAnnualUsd - stablefxAnnualUsd;
  const herstattEliminatedAnn   = herstattDailyUsd * tradDays; // saved by PvP

  // Herstatt saving as % of total saving
  const herstattSharePct = annualSavingVsIncumbent > 0
    ? Math.round((herstattEliminatedAnn / annualSavingVsIncumbent) * 100)
    : 0;

  // Implementation
  const implCost        = implMonths * IMPL_COST_PER_MONTH;
  const breakEvenMonths = annualSavingVsIncumbent > 0
    ? implCost / (annualSavingVsIncumbent / 12)
    : Infinity;

  // Verdict (vs incumbent)
  let verdict;
  if (annualSavingVsIncumbent >= MIGRATE_MIN && breakEvenMonths <= MIGRATE_BEVEN) {
    verdict = 'MIGRATE';
  } else if (annualSavingVsIncumbent >= EVALUATE_MIN && breakEvenMonths <= EVALUATE_BEVEN) {
    verdict = 'EVALUATE';
  } else {
    verdict = 'HOLD';
  }

  const compliance_flags = [];
  if (verdict === 'MIGRATE')        compliance_flags.push('ARC_STABLEFX_MIGRATION_RECOMMENDED');
  else if (verdict === 'EVALUATE')  compliance_flags.push('ARC_STABLEFX_EVALUATION_RECOMMENDED');
  else                              compliance_flags.push('ARC_STABLEFX_HOLD');
  if (herstattEliminatedAnn > 0)   compliance_flags.push('PFMI_P12_HERSTATT_ELIMINATED');
  if (sfxBps < bilBps)             compliance_flags.push('BIS_FX_GLOBAL_CODE_P35_NETTING_BENEFIT');

  return {
    verdict,
    daily_fx_volume_usd:         +dailyVol.toFixed(2),
    incumbent_annual_usd:        +incumbentAnnualUsd.toFixed(2),
    cls_annual_usd:              +clsAnnualUsd.toFixed(2),
    stablefx_annual_usd:         +stablefxAnnualUsd.toFixed(2),
    annual_saving_vs_incumbent:  +annualSavingVsIncumbent.toFixed(2),
    annual_saving_vs_cls:        +annualSavingVsCls.toFixed(2),
    herstatt_eliminated_ann_usd: +herstattEliminatedAnn.toFixed(2),
    herstatt_share_pct:          herstattSharePct,
    impl_cost_usd:               +implCost.toFixed(2),
    break_even_months:           isFinite(breakEvenMonths) ? +breakEvenMonths.toFixed(1) : null,
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
