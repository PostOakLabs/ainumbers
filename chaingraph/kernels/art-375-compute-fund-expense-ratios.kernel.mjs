// art-375 — Compute Fund Expense Ratios: pure decision kernel.
//
// FN-3, Funds/NAV family (FUNDS-NAV-BUILD-SPEC.md), rides FN-1 (art-373)
// accrual conventions: gross expense components may be declared as a flat
// `amount` or as an accrual (principal/annual_rate/days/day_count_convention),
// using the identical toFixed/computeAccrualAmount arithmetic as FN-1 so the
// two nodes never diverge on what "an accrual" means.
//
// HARD FENCE (receipt MUST record this, copy MUST lead with it): every
// expense component, average-net-assets figure, and waiver term here is
// SUPPLIED by the caller and merely ASSERTED — this kernel performs zero
// market-data or fund-administrator lookups (zero-egress by contract). It
// recomputes the ARITHMETIC over those declared inputs, in the DECLARED
// waiver-application order, and attests THAT computation ran correctly. This
// is NEVER a fair-value opinion, NEVER a determination that a fund's reported
// expenses are accurate, and NEVER a compliance determination.
//
// WAIVER ORDERING IS THE SUBSTANCE: the order in which fee waivers/caps apply
// changes the net expense ratio whenever more than one waiver interacts with
// a shared remaining-expense base (e.g. a fixed-dollar cap applied before vs
// after a percent-of-remaining reimbursement). The order is therefore a
// DECLARED INPUT (`waivers[].order`), never an implicit house convention —
// this kernel applies waivers strictly by ascending declared `order`, and the
// full running-balance ledger is returned so the effect of order is auditable
// line-by-line, not just in the final number.
//
// Fixed-point design: identical to FN-1 — every money/rate value is parsed
// from its DECIMAL STRING REPRESENTATION (never via floating multiplication)
// into a BigInt scaled by 10^SCALE_EXP. All arithmetic happens in that BigInt
// domain; only the final ratios are rounded to the fund's declared
// decimal_places using the fund's declared rounding mode.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-375-compute-fund-expense-ratios';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'compute_fund_expense_ratios',
  mandate_type: 'attestation_mandate',
  gpu: false,
};

// ── fixed-point money math (BigInt, no floats) — byte-identical to FN-1 ─────
const SCALE_EXP = 8;
const SCALE = 10n ** BigInt(SCALE_EXP);

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

// ── day-count denominators for accrual-style expense components — same
//    table and computeAccrualAmount shape as FN-1 (art-373), so a fund's
//    accrual convention is identical whether it appears in the NAV kernel or
//    here. ────────────────────────────────────────────────────────────────
const DAY_COUNT_DENOMINATORS = {
  '30/360': 360,
  'actual/360': 360,
  'actual/365': 365,
  'actual/actual': 365, // approximation; caller may override via year_days
};

function computeAccrualAmount(item) {
  if (item.amount != null) return toFixed(item.amount);
  const principal = toFixed(item.principal ?? 0);
  const rate = toFixed(item.annual_rate ?? 0); // e.g. 0.0075 for 75bps
  const days = Number(item.days ?? 0);
  const convention = item.day_count_convention ?? '30/360';
  const yearDays = Number(item.year_days ?? DAY_COUNT_DENOMINATORS[convention] ?? 365);
  const daysFixed = toFixed(days);
  const yearDaysFixed = toFixed(yearDays);
  const dayFraction = divFixed(daysFixed, yearDaysFixed);
  return mulFixed(mulFixed(principal, rate), dayFraction);
}

const NOT_PROVEN = [
  { item: 'Expense accuracy', detail: 'Every gross expense component, average-net-assets figure, and waiver term is caller-supplied and asserted. This kernel performs no fund-administrator or market-data lookups (zero-egress) and does not verify these figures against any external source.' },
  { item: 'Waiver economic substance / permissibility', detail: 'This kernel applies declared waiver terms arithmetically in the declared order. It makes no judgment on whether a waiver is contractually valid, economically reasonable, or permitted under a fund\'s governing documents.' },
  { item: 'Regulatory NAV/expense filing compliance', detail: '40-Act/UCITS references are informative context only; this kernel makes no claim of compliance with either framework\'s expense-ratio disclosure or filing rules.' },
  { item: 'Total Expense Ratio scope completeness', detail: 'TER here equals the gross expense ratio over the declared gross_expense_components. If acquired-fund fees, transaction costs, or other components belong in a fund\'s reported TER, they must be declared as gross_expense_components — this kernel cannot infer omissions.' },
];

const WAIVER_METHODS = new Set(['fixed_amount', 'percent_of_remaining', 'cap_to_rate']);

/**
 * compute(pp) — pure fund expense-ratio kernel.
 * pp: {
 *   fund_id?: string,
 *   period_start?: string,
 *   period_end?: string,
 *   average_net_assets: number|string,
 *   gross_expense_components: [{ description, amount? , principal?, annual_rate?, days?, day_count_convention?, year_days? }],
 *   waivers?: [{ description, order: number, method: 'fixed_amount'|'percent_of_remaining'|'cap_to_rate', amount?, percent?, cap_rate? }],
 *   rounding?: { decimal_places: number, mode: 'half_up'|'half_even'|'truncate' },
 * }
 */
export function compute(pp) {
  const grossComponentsIn = Array.isArray(pp.gross_expense_components) ? pp.gross_expense_components : [];
  const waiversIn = Array.isArray(pp.waivers) ? pp.waivers : [];
  const rounding = pp.rounding ?? {};
  const decimalPlaces = Number.isInteger(rounding.decimal_places) ? rounding.decimal_places : 4;
  const roundingMode = ['half_up', 'half_even', 'truncate'].includes(rounding.mode) ? rounding.mode : 'half_up';

  const averageNetAssetsFixed = toFixed(pp.average_net_assets);

  const componentLines = grossComponentsIn.map((it) => {
    const amountFixed = computeAccrualAmount(it);
    return {
      description: it.description ?? null,
      day_count_convention: it.day_count_convention ?? (it.amount != null ? null : '30/360'),
      amount: fixedToPlainString(amountFixed, SCALE_EXP),
    };
  });
  const grossExpenseFixed = componentLines.reduce((acc, l) => acc + toFixed(l.amount), 0n);

  let structuralError = null;
  if (averageNetAssetsFixed <= 0n) {
    structuralError = 'average_net_assets must be a positive number.';
  }

  // Waivers apply STRICTLY in ascending declared `order` — never input array
  // order, never insertion order. Ties keep their relative input order
  // (stable sort), which is itself part of the declared convention.
  const orderedWaivers = waiversIn
    .map((w, idx) => ({ w, idx }))
    .sort((a, b) => (Number(a.w.order ?? 0) - Number(b.w.order ?? 0)) || (a.idx - b.idx))
    .map(({ w }) => w);

  const waiverLines = [];
  let remainingFixed = grossExpenseFixed;
  if (!structuralError) {
    for (const w of orderedWaivers) {
      const method = WAIVER_METHODS.has(w.method) ? w.method : null;
      const before = remainingFixed;
      let reductionFixed = 0n;
      let waiverError = null;
      if (!method) {
        waiverError = `unknown waiver method: ${String(w.method)}`;
      } else if (method === 'fixed_amount') {
        const amt = toFixed(w.amount);
        reductionFixed = amt > remainingFixed ? remainingFixed : (amt < 0n ? 0n : amt);
      } else if (method === 'percent_of_remaining') {
        const pct = toFixed(w.percent);
        reductionFixed = mulFixed(remainingFixed, pct);
      } else if (method === 'cap_to_rate') {
        const capRate = toFixed(w.cap_rate);
        const capExpenseFixed = mulFixed(averageNetAssetsFixed, capRate);
        reductionFixed = remainingFixed > capExpenseFixed ? (remainingFixed - capExpenseFixed) : 0n;
      }
      if (reductionFixed < 0n) reductionFixed = 0n;
      remainingFixed = before - reductionFixed;
      waiverLines.push({
        description: w.description ?? null,
        order: Number(w.order ?? 0),
        method: w.method ?? null,
        error: waiverError,
        remaining_before: fixedToPlainString(before, SCALE_EXP),
        reduction: fixedToPlainString(reductionFixed, SCALE_EXP),
        remaining_after: fixedToPlainString(remainingFixed, SCALE_EXP),
      });
    }
  }
  const netExpenseFixed = remainingFixed;

  const grossExpenseRatioFixed = structuralError ? 0n : divFixed(grossExpenseFixed, averageNetAssetsFixed);
  const netExpenseRatioFixed = structuralError ? 0n : divFixed(netExpenseFixed, averageNetAssetsFixed);
  const terFixed = grossExpenseRatioFixed; // TER == gross ratio over declared components; see NOT_PROVEN scope note.

  const compliance_flags = [];
  if (structuralError) compliance_flags.push('EXPENSE_STRUCTURAL_ERROR');
  else compliance_flags.push('EXPENSE_RATIOS_COMPUTED');
  if (waiverLines.some((l) => l.error)) compliance_flags.push('EXPENSE_WAIVER_METHOD_UNKNOWN');
  if (orderedWaivers.length > 0) compliance_flags.push('EXPENSE_WAIVER_ORDER_DECLARED');
  if (compliance_flags.length === 1 && compliance_flags[0] === 'EXPENSE_RATIOS_COMPUTED') compliance_flags.push('EXPENSE_INPUTS_SUPPLIED_NOT_VERIFIED');

  const output_payload = {
    fund_id: pp.fund_id ?? null,
    period_start: pp.period_start ?? null,
    period_end: pp.period_end ?? null,
    structural_error: structuralError,
    components: {
      average_net_assets: fixedToPlainString(averageNetAssetsFixed, SCALE_EXP),
      gross_expense_components: componentLines,
      gross_expense_total: fixedToPlainString(grossExpenseFixed, SCALE_EXP),
      waivers_applied: waiverLines,
      net_expense_total: fixedToPlainString(netExpenseFixed, SCALE_EXP),
    },
    rounding: { decimal_places: decimalPlaces, mode: roundingMode },
    gross_expense_ratio: structuralError ? null : roundFixedToString(grossExpenseRatioFixed, decimalPlaces, roundingMode),
    net_expense_ratio: structuralError ? null : roundFixedToString(netExpenseRatioFixed, decimalPlaces, roundingMode),
    total_expense_ratio: structuralError ? null : roundFixedToString(terFixed, decimalPlaces, roundingMode),
    not_proven: NOT_PROVEN,
    fence: 'Expense components, average net assets, and waiver terms are SUPPLIED, asserted, and digested into this receipt. This kernel recomputes the ARITHMETIC over those declared inputs, applying waivers strictly in the DECLARED order, and attests THAT — never an opinion on expense accuracy, never a compliance determination.',
    regulatory_framework: '40-Act/UCITS expense-ratio disclosure conventions referenced as informative context only; this kernel makes no compliance claim under either framework.',
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
