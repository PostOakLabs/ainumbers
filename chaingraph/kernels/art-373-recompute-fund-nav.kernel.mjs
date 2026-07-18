// art-373 — Recompute Fund NAV: pure decision kernel.
//
// FN-1, first entry of the Funds/NAV family (FUNDS-NAV-BUILD-SPEC.md). Recomputes
// a fund's net-asset-value-per-share from SUPPLIED holdings, accruals, liabilities
// and shares outstanding, using fixed-point (BigInt) money math throughout — no
// float accumulation anywhere in the arithmetic path.
//
// HARD FENCE (receipt MUST record this, copy MUST lead with it): every price, FX
// rate, and accrual input here is SUPPLIED by the caller and merely ASSERTED —
// this kernel performs zero market-data lookups (zero-egress by contract, no
// network calls of any kind). It recomputes the ARITHMETIC over those declared
// inputs and attests THAT computation ran correctly. This is NEVER a fair-value
// opinion, NEVER an independent valuation, and NEVER live/real-time market data.
// A NAV receipt from this kernel proves "this arithmetic, over these declared
// inputs" — nothing about whether the declared prices are accurate.
//
// Fixed-point design: every money/quantity value is parsed from its DECIMAL
// STRING REPRESENTATION (never via floating multiplication) into a BigInt scaled
// by 10^SCALE_EXP. All arithmetic (multiply/add/subtract/divide) happens in that
// BigInt domain; only the final NAV-per-share is rounded to the fund's declared
// decimal_places using the fund's declared rounding mode. 40-Act/UCITS citations
// are informative only — this kernel makes no claim of compliance with either.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-373-recompute-fund-nav';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'recompute_fund_nav',
  mandate_type: 'attestation_mandate',
  gpu: false,
};

// ── fixed-point money math (BigInt, no floats) ──────────────────────────────
const SCALE_EXP = 8;
const SCALE = 10n ** BigInt(SCALE_EXP);

// Parses a decimal value (number OR string) into a BigInt scaled by SCALE,
// working entirely off its string digits — never via `value * 10**n` floating
// multiplication, which is the one class of float-accumulation bug this kernel
// exists to avoid.
function toFixed(value) {
  let s = String(value ?? 0).trim();
  let neg = false;
  if (s.startsWith('-')) { neg = true; s = s.slice(1); }
  else if (s.startsWith('+')) { s = s.slice(1); }
  if (!/^[0-9]*\.?[0-9]*$/.test(s) || s === '' || s === '.') s = '0';
  let [intPart, fracPart = ''] = s.split('.');
  if (intPart === '') intPart = '0';
  if (fracPart.length > SCALE_EXP) fracPart = fracPart.slice(0, SCALE_EXP); // truncate excess precision, never round up
  fracPart = fracPart.padEnd(SCALE_EXP, '0');
  let mag = BigInt(intPart + fracPart);
  if (neg) mag = -mag;
  return mag;
}

function mulFixed(a, b) {
  return (a * b) / SCALE;
}

function divFixed(a, b) {
  if (b === 0n) return 0n;
  return (a * SCALE) / b;
}

// Renders a SCALE-scaled BigInt back to a decimal string at `places` decimal
// digits, using the declared rounding mode. Never touches a JS float.
function roundFixedToString(value, places, mode) {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const divisor = 10n ** BigInt(SCALE_EXP - places);
  let q = abs / divisor;
  const r = abs % divisor;
  const twiceR = r * 2n;
  if (mode === 'truncate') {
    // q already truncated toward zero
  } else if (mode === 'half_even') {
    if (twiceR > divisor || (twiceR === divisor && q % 2n === 1n)) q += 1n;
  } else {
    // 'half_up' (default) — round half away from zero
    if (twiceR >= divisor) q += 1n;
  }
  let qs = q.toString();
  let result;
  if (places === 0) {
    result = qs;
  } else {
    qs = qs.padStart(places + 1, '0');
    result = `${qs.slice(0, -places)}.${qs.slice(-places)}`;
  }
  return (neg && q !== 0n) ? `-${result}` : result;
}

function fixedToPlainString(value, places) {
  return roundFixedToString(value, places, 'truncate');
}

// ── day-count denominators for accrual computation (declared, not assumed) ──
const DAY_COUNT_DENOMINATORS = {
  '30/360': 360,
  'actual/360': 360,
  'actual/365': 365,
  'actual/actual': 365, // approximation; caller may override via year_days
};

function computeAccrualAmount(item) {
  if (item.amount != null) return toFixed(item.amount);
  const principal = toFixed(item.principal ?? 0);
  const rate = toFixed(item.annual_rate ?? 0); // e.g. 0.05 for 5%
  const days = Number(item.days ?? 0);
  const convention = item.day_count_convention ?? '30/360';
  const yearDays = Number(item.year_days ?? DAY_COUNT_DENOMINATORS[convention] ?? 365);
  const daysFixed = toFixed(days);
  const yearDaysFixed = toFixed(yearDays);
  const dayFraction = divFixed(daysFixed, yearDaysFixed);
  return mulFixed(mulFixed(principal, rate), dayFraction);
}

function toBase(amountFixed, fxRateToBase) {
  return mulFixed(amountFixed, toFixed(fxRateToBase ?? 1));
}

const NOT_PROVEN = [
  { item: 'Price/FX accuracy', detail: 'Every price and FX rate is caller-supplied and asserted. This kernel performs no market-data lookups (zero-egress) and does not verify these values against any external source.' },
  { item: 'Fair value / independent valuation', detail: 'This is arithmetic recomputation over declared inputs, never an independent fair-value opinion or third-party valuation.' },
  { item: 'Live/real-time pricing', detail: 'All inputs are point-in-time as supplied by the caller; this kernel makes no claim about market conditions at any other moment.' },
  { item: 'Regulatory NAV filing compliance', detail: '40-Act/UCITS references are informative context only; this kernel makes no claim of compliance with either framework\'s NAV-computation or filing rules.' },
];

/**
 * compute(pp) — pure NAV recomputation kernel.
 * pp: {
 *   fund_id?: string,
 *   valuation_date?: string,
 *   base_currency: string,
 *   holdings: [{ security_id, quantity, price, currency, fx_rate_to_base }],
 *   accruals?: {
 *     income?: [{ description, amount? , principal?, annual_rate?, days?, day_count_convention?, year_days?, currency, fx_rate_to_base }],
 *     expense?: [ same shape ],
 *   },
 *   liabilities?: [{ description, amount, currency, fx_rate_to_base }],
 *   shares_outstanding: number|string,
 *   rounding: { decimal_places: number, mode: 'half_up'|'half_even'|'truncate' },
 * }
 */
export function compute(pp) {
  const baseCurrency = pp.base_currency ?? 'USD';
  const holdings = Array.isArray(pp.holdings) ? pp.holdings : [];
  const accrualsIncome = Array.isArray(pp.accruals?.income) ? pp.accruals.income : [];
  const accrualsExpense = Array.isArray(pp.accruals?.expense) ? pp.accruals.expense : [];
  const liabilities = Array.isArray(pp.liabilities) ? pp.liabilities : [];
  const rounding = pp.rounding ?? {};
  const decimalPlaces = Number.isInteger(rounding.decimal_places) ? rounding.decimal_places : 2;
  const roundingMode = ['half_up', 'half_even', 'truncate'].includes(rounding.mode) ? rounding.mode : 'half_up';

  const holdingLines = holdings.map((h) => {
    const qty = toFixed(h.quantity);
    const price = toFixed(h.price);
    const localValue = mulFixed(qty, price);
    const baseValue = toBase(localValue, h.fx_rate_to_base);
    return {
      security_id: h.security_id ?? null,
      currency: h.currency ?? baseCurrency,
      quantity: fixedToPlainString(qty, SCALE_EXP),
      price: fixedToPlainString(price, SCALE_EXP),
      local_value: fixedToPlainString(localValue, SCALE_EXP),
      base_value: fixedToPlainString(baseValue, SCALE_EXP),
    };
  });
  const holdingsValueFixed = holdingLines.reduce((acc, l) => acc + toFixed(l.base_value), 0n);

  function accrualLines(items) {
    return items.map((it) => {
      const amountFixed = computeAccrualAmount(it);
      const baseValue = toBase(amountFixed, it.fx_rate_to_base);
      return {
        description: it.description ?? null,
        currency: it.currency ?? baseCurrency,
        day_count_convention: it.day_count_convention ?? (it.amount != null ? null : '30/360'),
        amount: fixedToPlainString(amountFixed, SCALE_EXP),
        base_value: fixedToPlainString(baseValue, SCALE_EXP),
      };
    });
  }
  const incomeLines = accrualLines(accrualsIncome);
  const expenseLines = accrualLines(accrualsExpense);
  const accruedIncomeFixed = incomeLines.reduce((acc, l) => acc + toFixed(l.base_value), 0n);
  const accruedExpenseFixed = expenseLines.reduce((acc, l) => acc + toFixed(l.base_value), 0n);

  const liabilityLines = liabilities.map((l) => {
    const amountFixed = toFixed(l.amount);
    const baseValue = toBase(amountFixed, l.fx_rate_to_base);
    return {
      description: l.description ?? null,
      currency: l.currency ?? baseCurrency,
      amount: fixedToPlainString(amountFixed, SCALE_EXP),
      base_value: fixedToPlainString(baseValue, SCALE_EXP),
    };
  });
  const liabilitiesFixed = liabilityLines.reduce((acc, l) => acc + toFixed(l.base_value), 0n);

  const totalAssetsFixed = holdingsValueFixed + accruedIncomeFixed;
  const totalLiabilitiesFixed = liabilitiesFixed + accruedExpenseFixed;
  const netAssetsFixed = totalAssetsFixed - totalLiabilitiesFixed;

  const sharesOutstandingFixed = toFixed(pp.shares_outstanding);
  let navPerShareStr = null;
  let structuralError = null;
  if (sharesOutstandingFixed <= 0n) {
    structuralError = 'shares_outstanding must be a positive number.';
  } else {
    const navPerShareFixed = divFixed(netAssetsFixed, sharesOutstandingFixed);
    navPerShareStr = roundFixedToString(navPerShareFixed, decimalPlaces, roundingMode);
  }

  const compliance_flags = [];
  if (structuralError) compliance_flags.push('NAV_STRUCTURAL_ERROR');
  else compliance_flags.push('NAV_RECOMPUTED');
  if (netAssetsFixed < 0n) compliance_flags.push('NAV_NET_ASSETS_NEGATIVE');
  if (compliance_flags.length === 1 && compliance_flags[0] === 'NAV_RECOMPUTED') compliance_flags.push('NAV_INPUTS_SUPPLIED_NOT_VERIFIED');

  const output_payload = {
    fund_id: pp.fund_id ?? null,
    valuation_date: pp.valuation_date ?? null,
    base_currency: baseCurrency,
    structural_error: structuralError,
    components: {
      holdings: holdingLines,
      holdings_value: fixedToPlainString(holdingsValueFixed, SCALE_EXP),
      accrued_income: incomeLines,
      accrued_income_total: fixedToPlainString(accruedIncomeFixed, SCALE_EXP),
      accrued_expense: expenseLines,
      accrued_expense_total: fixedToPlainString(accruedExpenseFixed, SCALE_EXP),
      liabilities: liabilityLines,
      liabilities_total: fixedToPlainString(liabilitiesFixed, SCALE_EXP),
      total_assets: fixedToPlainString(totalAssetsFixed, SCALE_EXP),
      total_liabilities: fixedToPlainString(totalLiabilitiesFixed, SCALE_EXP),
      net_assets: fixedToPlainString(netAssetsFixed, SCALE_EXP),
      shares_outstanding: fixedToPlainString(sharesOutstandingFixed, SCALE_EXP),
    },
    rounding: { decimal_places: decimalPlaces, mode: roundingMode },
    nav_per_share: navPerShareStr,
    not_proven: NOT_PROVEN,
    fence: 'Pricing/FX inputs are SUPPLIED, asserted, and digested into this receipt. This kernel recomputes the ARITHMETIC over those declared inputs and attests THAT — never a fair-value opinion, never a valuation, never live market data (zero-egress by contract).',
    regulatory_framework: '40-Act/UCITS NAV-computation conventions referenced as informative context only; this kernel makes no compliance claim under either framework.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type:       meta.mandate_type,
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
