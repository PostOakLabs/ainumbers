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

import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-43-arc-cpn-model';
const TOOL_VERSION = '1.0.0';

const RAIL_FEES = {
  swift: { fixed: 18.00,  pct: 0.0010 },
  ach:   { fixed:  0.26,  pct: 0.0000 },
  sepa:  { fixed:  0.09,  pct: 0.0000 },
  card:  { fixed:  0.10,  pct: 0.0150 },
  rtp:   { fixed:  0.045, pct: 0.0005 },
};

const CPN_FIXED = 0.01;

const RAIL_FX_SPREAD_BPS = {
  swift: 150,
  ach:   0,
  sepa:  0,
  card:  100,
  rtp:   0,
};

const IMPL_COST_PER_MONTH    = 12_000;
const MIGRATE_MIN_ANNUAL     = 60_000;
const MIGRATE_MAX_BREAKEVEN  = 12;
const EVALUATE_MIN_ANNUAL    = 10_000;
const EVALUATE_MAX_BREAKEVEN = 24;

export function compute(pp) {
  const {
    rail        = 'swift',
    notional_usd,
    monthly_volume,
    fx_spread_bps,
    impl_months = 3,
    cpn_fee_usd,
  } = pp;

  const txAmount   = Number(notional_usd)  || 0;
  const monthlyVol = Number(monthly_volume) || 0;
  const implMonths = Number(impl_months)    || 3;
  const cpnFee     = cpn_fee_usd !== undefined ? Number(cpn_fee_usd) : CPN_FIXED;

  const railFee = RAIL_FEES[rail] ?? RAIL_FEES.swift;

  const defaultFxBps    = RAIL_FX_SPREAD_BPS[rail] ?? 0;
  const effectiveFxBps  = fx_spread_bps !== undefined ? Number(fx_spread_bps) : defaultFxBps;
  const fxCostIncumbent = txAmount * (effectiveFxBps / 10_000);

  const perTxIncumbent  = railFee.fixed + txAmount * railFee.pct + fxCostIncumbent;
  const perTxCPN        = cpnFee;
  const perTxSaving     = perTxIncumbent - perTxCPN;
  const savingBps       = txAmount > 0 ? (perTxSaving / txAmount) * 10_000 : 0;

  const monthlySaving   = perTxSaving * monthlyVol;
  const annualSaving    = monthlySaving * 12;
  const implCost        = implMonths * IMPL_COST_PER_MONTH;
  const breakEvenMonths = annualSaving > 0
    ? implCost / (annualSaving / 12)
    : Infinity;
  const npv3yr = annualSaving * 3 - implCost;

  let verdict;
  if (annualSaving >= MIGRATE_MIN_ANNUAL && breakEvenMonths <= MIGRATE_MAX_BREAKEVEN) {
    verdict = 'MIGRATE';
  } else if (annualSaving >= EVALUATE_MIN_ANNUAL && breakEvenMonths <= EVALUATE_MAX_BREAKEVEN) {
    verdict = 'EVALUATE';
  } else {
    verdict = 'HOLD';
  }

  const compliance_flags = [];
  if (verdict === 'MIGRATE')        compliance_flags.push('ARC_CPN_MIGRATION_RECOMMENDED');
  else if (verdict === 'EVALUATE')  compliance_flags.push('ARC_CPN_EVALUATION_RECOMMENDED');
  else                              compliance_flags.push('ARC_CPN_HOLD');
  if (effectiveFxBps > 100)        compliance_flags.push('PFMI_P4_FX_COST_HIGH');

  const output_payload = {
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

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    ap2_version:        '1.0.0',
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
