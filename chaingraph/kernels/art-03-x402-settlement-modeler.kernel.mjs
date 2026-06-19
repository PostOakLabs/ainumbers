// art-03 — x402/Crypto-Rail Settlement Cost & Finality Modeler: pure decision kernel.
// Faithful port of the modelX402Settlement() logic in
//   repo/chaingraph/art-03-x402-settlement-modeler.html
// Pure: no DOM, no window, no network, no Date.now(), no randomness.
// policy_parameters carries all decision inputs so the execution_hash anchors them.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-03-x402-settlement-modeler';
const TOOL_VERSION = '1.0.0';

// Rail definitions — indicative as of mid-2025. Verify with provider.
const RAILS = [
  {
    id: 'x402', name: 'x402', full: 'x402 (HTTP Payment Protocol)',
    fee_fixed_usd: { low: 0.0001, medium: 0.0003, high: 0.002 },
    fee_pct: 0,
    finality_sec: { instant: 2, fast: 2, minutes: 2, hours: 2, days: 2 },
    min_amount_usd: 0.001, max_amount_usd: 10000,
    supports_cross_border: true, supports_micropayments: true,
    chargeback_risk: 'none',
    settlement_currency: 'USDC/crypto',
  },
  {
    id: 'stripe_usdc', name: 'Stripe USDC', full: 'Stripe USDC on Base',
    fee_fixed_usd: { low: 0, medium: 0, high: 0 },
    fee_pct: 0.015,
    finality_sec: { instant: 3, fast: 3, minutes: 3, hours: 3, days: 3 },
    min_amount_usd: 0.50, max_amount_usd: 100000,
    supports_cross_border: true, supports_micropayments: false,
    chargeback_risk: 'none',
    settlement_currency: 'USDC',
  },
  {
    id: 'card', name: 'Card (Visa/MC)', full: 'Card Rails (Visa / Mastercard)',
    fee_fixed_usd: { low: 0.10, medium: 0.15, high: 0.20 },
    fee_pct: 0.029,
    finality_sec: { instant: 3, fast: 3, minutes: 3, hours: 3, days: 3 },
    min_amount_usd: 0.50, max_amount_usd: 25000,
    supports_cross_border: true, supports_micropayments: false,
    chargeback_risk: 'medium_high',
    settlement_currency: 'USD/local',
  },
  {
    id: 'ach', name: 'ACH', full: 'ACH (Nacha Same-Day / Standard)',
    fee_fixed_usd: { low: 0.05, medium: 0.10, high: 0.25 },
    fee_pct: 0,
    finality_sec: { instant: null, fast: null, minutes: null, hours: 25200, days: 86400 },
    min_amount_usd: 1, max_amount_usd: 1000000,
    supports_cross_border: false, supports_micropayments: false,
    chargeback_risk: 'low',
    settlement_currency: 'USD',
  },
  {
    id: 'swift', name: 'SWIFT Wire', full: 'SWIFT Wire / SWIFT gpi',
    fee_fixed_usd: { low: 5, medium: 15, high: 35 },
    fee_pct: 0.001,
    finality_sec: { instant: null, fast: null, minutes: null, hours: null, days: 86400 },
    min_amount_usd: 100, max_amount_usd: 100000000,
    supports_cross_border: true, supports_micropayments: false,
    chargeback_risk: 'very_low',
    settlement_currency: 'multi-currency',
  },
];

function feeForRail(rail, amount, gasTier) {
  const fix = rail.fee_fixed_usd[gasTier] || rail.fee_fixed_usd.medium;
  return fix + amount * rail.fee_pct;
}

function finalityForRail(rail, finalityReq) {
  return rail.finality_sec[finalityReq] || rail.finality_sec.days || 86400;
}

/**
 * compute(pp) — pure settlement modeller.
 * pp: {
 *   amount_usd: number,          // transaction amount in USD
 *   monthly_volume: number,      // transactions / month
 *   payment_type: string,        // 'micropayment'|'retail'|'b2b'|'cross_border'
 *   finality_requirement: string,// 'instant'|'fast'|'minutes'|'hours'|'days'
 *   gas_tier: string,            // 'low'|'medium'|'high'
 *   chargeback_profile?: string, // 'low'|'medium'|'high' (optional, defaults 'medium')
 * }
 */
export function compute(pp) {
  const amount      = Number(pp.amount_usd)      || 250;
  const volume      = Number(pp.monthly_volume)  || 5000;
  const payType     = pp.payment_type            || 'retail';
  const finalReq    = pp.finality_requirement    || 'fast';
  const gasTier     = pp.gas_tier               || 'medium';
  const cbProfile   = pp.chargeback_profile     || 'medium';

  const results = RAILS.map(rail => {
    const perTxFee  = feeForRail(rail, amount, gasTier);
    const finality  = finalityForRail(rail, finalReq);
    const monthlyFee = perTxFee * volume;
    const feePct    = (perTxFee / amount) * 100;

    const amountOk  = amount >= rail.min_amount_usd && amount <= rail.max_amount_usd;
    const microOk   = payType !== 'micropayment' || rail.supports_micropayments;
    const crossOk   = payType !== 'cross_border' || rail.supports_cross_border;
    const finalityOk = finality !== null && (
      finalReq === 'instant' ? finality <= 5 :
      finalReq === 'fast'    ? finality <= 60 :
      finalReq === 'minutes' ? finality <= 600 :
      finalReq === 'hours'   ? finality <= 86400 : true
    );
    const eligible = amountOk && microOk && crossOk && finalityOk;

    let score = perTxFee * 10 + (finality || 86400) / 3600;
    if (!eligible) score += 10000;
    if (cbProfile === 'high' && rail.chargeback_risk === 'none') score -= 2;

    return { ...rail, perTxFee, monthlyFee, feePct, finality, eligible, score };
  });

  results.sort((a, b) => a.score - b.score);
  const winner = results.find(r => r.eligible) || results[0];

  const output_payload = {
    recommended_rail:  winner.id,
    per_tx_fee_usd:    Math.round(winner.perTxFee * 10000) / 10000,
    monthly_cost_usd:  Math.round(winner.monthlyFee * 100) / 100,
    finality_sec:      winner.finality,
    eligible_rails:    results.filter(r => r.eligible).map(r => r.id),
  };

  const compliance_flags = ['SETTLEMENT_ANALYSIS_COMPLETE'];

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': [
      'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
      'https://ainumbers.co/chaingraph/context/v0.3/iso20022-context.jsonld',
    ],
    chaingraph_version: '0.4.0',
    semantic_profile: 'iso20022:pacs.008-subset',
    'dct:conformsTo': ['https://ainumbers.co/chaingraph/profiles/iso20022/pacs008-subset.jsonld'],
    ap2_version: '1.0.0',
    mandate_type: 'settlement_mandate',
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

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, gpu: false, mandate_type: 'settlement_mandate' };
