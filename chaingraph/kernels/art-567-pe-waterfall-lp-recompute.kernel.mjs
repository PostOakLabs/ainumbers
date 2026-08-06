// art-567 — PE Distribution Waterfall LP-Side Recompute: pure decision kernel.
//
// RECOMP wave, §2 of RECOMP-WAVE-BUILD-SPEC.md. ILPA's own reporting-template
// guidance states it "was not designed for verifying any of the GP's
// calculations" — this kernel is the receiving-side (LP) recompute ILPA does
// not provide. Recomputes a standard 4-tier PE distribution waterfall (return
// of capital -> preferred return -> GP catch-up -> residual carry split) over
// caller-DECLARED dated cashflows and a caller-DECLARED waterfall
// parameterization, then diffs the recomputed per-tier LP/GP allocation
// against the caller-supplied GP-reported allocation.
//
// HARD FENCE: every cashflow, rate, and the GP-reported allocation itself are
// SUPPLIED by the caller and merely ASSERTED — this kernel performs zero
// document parsing and zero data lookups (zero-egress by contract). It
// recomputes the ARITHMETIC over declared inputs and attests THAT. This is
// NEVER an opinion on whether the underlying LPA authorizes the declared
// terms, and it is NEVER ILPA-endorsed or "ILPA-compliant" — ILPA's guidance
// is cited only as dated gap evidence that the LP side goes unverified today.
//
// Fixed-point design: mirrors art-373-recompute-fund-nav.kernel.mjs — every
// money value is parsed from its DECIMAL STRING REPRESENTATION into a BigInt
// scaled by 10^SCALE_EXP; all arithmetic happens in that BigInt domain.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-567-pe-waterfall-lp-recompute';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'recompute_pe_waterfall_lp',
  mandate_type: 'attestation_mandate',
  gpu: false,
};

// ── fixed-point money math (BigInt, no floats) — mirror of art-373 ─────────
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
  if (fracPart.length > SCALE_EXP) fracPart = fracPart.slice(0, SCALE_EXP);
  fracPart = fracPart.padEnd(SCALE_EXP, '0');
  let mag = BigInt(intPart + fracPart);
  if (neg) mag = -mag;
  return mag;
}
function mulFixed(a, b) { return (a * b) / SCALE; }
function divFixed(a, b) { return b === 0n ? 0n : (a * SCALE) / b; }
function fixedToPlainString(value, places) {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const divisor = 10n ** BigInt(SCALE_EXP - places);
  const q = abs / divisor;
  let qs = q.toString();
  let result;
  if (places === 0) result = qs;
  else { qs = qs.padStart(places + 1, '0'); result = `${qs.slice(0, -places)}.${qs.slice(-places)}`; }
  return (neg && q !== 0n) ? `-${result}` : result;
}

const DAY_COUNT_DENOMINATORS = { '30/360': 360, 'actual/360': 360, 'actual/365': 365, 'actual/actual': 365 };
const MS_PER_DAY = 86400000;

function daysBetween(a, b) {
  const da = Date.parse(a);
  const db = Date.parse(b);
  if (Number.isNaN(da) || Number.isNaN(db)) return 0;
  return Math.max(0, Math.round((db - da) / MS_PER_DAY));
}

const TIER_STRUCTURES = ['european_whole_fund', 'american_deal_by_deal'];
const CASHFLOW_TYPES = ['contribution', 'distribution'];
const TIER_NAMES = ['return_of_capital', 'preferred_return', 'gp_catchup', 'carry_residual'];

const NOT_PROVEN = [
  { item: 'Cashflow accuracy', detail: 'Every dated cashflow is caller-supplied and asserted. This kernel performs no document parsing or fund-administrator data lookups (zero-egress) and does not verify these values against any external source.' },
  { item: 'LPA authorization', detail: 'This kernel recomputes arithmetic under a DECLARED waterfall parameterization; it makes no finding on whether that parameterization is what the governing limited partnership agreement actually specifies.' },
  { item: 'ILPA endorsement or compliance', detail: 'ILPA reporting-template guidance is cited only as dated context that GP-side verification tooling is not designed to check the GP\'s own math. This kernel is not endorsed by, and makes no claim of compliance with, ILPA.' },
  { item: 'GP-reported allocation source', detail: 'The GP-reported allocation compared against is exactly what the caller typed in; this kernel does not verify it was transcribed correctly from the GP\'s capital account statement.' },
];

// Runs the 4-tier waterfall over one ordered list of {type, amount_fixed, days_from_first}
// events for a single pool (whole-fund or one deal). Returns per-tier LP/GP fixed amounts
// plus the running ledger, never touching a JS float.
function runWaterfallOverEvents(events, prefRateFixed, compoundingBasis, dayCountConvention) {
  const yearDays = DAY_COUNT_DENOMINATORS[dayCountConvention] ?? 365;
  const yearDaysFixed = toFixed(yearDays);

  let unreturnedCapital = 0n; // contributed, not yet returned as ROC
  let accruedPref = 0n;       // preferred return accrued, not yet paid
  let lastEventDays = null;

  const tierTotals = { return_of_capital: 0n, preferred_return: 0n, gp_catchup: 0n, carry_residual: 0n };
  const tierTotalsGP = { return_of_capital: 0n, preferred_return: 0n, gp_catchup: 0n, carry_residual: 0n };
  const ledger = [];

  for (const ev of events) {
    if (lastEventDays !== null && unreturnedCapital > 0n) {
      const elapsedDays = Math.max(0, ev.days_from_first - lastEventDays);
      const elapsedFixed = toFixed(elapsedDays);
      const periodFraction = divFixed(elapsedFixed, yearDaysFixed);
      const periodInterest = mulFixed(mulFixed(unreturnedCapital, prefRateFixed), periodFraction);
      accruedPref += periodInterest;
      if (compoundingBasis === 'annual') unreturnedCapital += periodInterest; // compound: interest joins principal base
    }
    lastEventDays = ev.days_from_first;

    if (ev.type === 'contribution') {
      unreturnedCapital += ev.amount_fixed;
      ledger.push({ ...ev, tier_allocations: null });
      continue;
    }

    // distribution: waterfall through the four tiers in order
    let remaining = ev.amount_fixed;
    const alloc = { return_of_capital: 0n, preferred_return: 0n, gp_catchup: 0n, carry_residual_lp: 0n, carry_residual_gp: 0n };

    if (remaining > 0n && unreturnedCapital > 0n) {
      const roc = remaining < unreturnedCapital ? remaining : unreturnedCapital;
      alloc.return_of_capital = roc;
      unreturnedCapital -= roc;
      remaining -= roc;
    }
    if (remaining > 0n && accruedPref > 0n) {
      const pref = remaining < accruedPref ? remaining : accruedPref;
      alloc.preferred_return = pref;
      accruedPref -= pref;
      remaining -= pref;
    }
    ev.__prefPaidThisEvent = alloc.preferred_return;
    ledger.push({ ...ev, tier_allocations: alloc, remaining_before_catchup: remaining });
  }

  return { unreturnedCapital, accruedPref, ledger };
}

// Second pass: distribute the post-pref "remaining" pool of every distribution event
// through GP catch-up then residual carry, using a SINGLE running catch-up target
// computed over the whole event stream (catch-up target = cumulative pref paid to LP
// times carry_pct/(1-carry_pct), reached via gp_catchup_pct of every catch-up dollar).
function applyCatchupAndCarry(ledger, gpCatchupPctFixed, carryPctFixed) {
  const oneMinusCarry = SCALE - carryPctFixed;
  const catchupTargetRatio = oneMinusCarry > 0n ? divFixed(carryPctFixed, oneMinusCarry) : 0n;

  let cumulativePrefPaid = 0n;
  let cumulativeGpCatchup = 0n;
  let lpTotal = { return_of_capital: 0n, preferred_return: 0n, gp_catchup: 0n, carry_residual: 0n };
  let gpTotal = { return_of_capital: 0n, preferred_return: 0n, gp_catchup: 0n, carry_residual: 0n };
  const distributionLines = [];

  for (const ev of ledger) {
    if (!ev.tier_allocations) continue; // contribution event
    const a = ev.tier_allocations;
    lpTotal.return_of_capital += a.return_of_capital;
    lpTotal.preferred_return += a.preferred_return;
    cumulativePrefPaid += a.preferred_return;

    let remaining = ev.remaining_before_catchup;
    const catchupTarget = mulFixed(cumulativePrefPaid, catchupTargetRatio);
    if (remaining > 0n && cumulativeGpCatchup < catchupTarget && gpCatchupPctFixed > 0n) {
      const catchupDollarsNeeded = divFixed(catchupTarget - cumulativeGpCatchup, gpCatchupPctFixed);
      const catchupTier = remaining < catchupDollarsNeeded ? remaining : catchupDollarsNeeded;
      const gpShare = mulFixed(catchupTier, gpCatchupPctFixed);
      const lpShare = catchupTier - gpShare;
      a.gp_catchup = gpShare;
      a.lp_catchup = lpShare;
      cumulativeGpCatchup += gpShare;
      gpTotal.gp_catchup += gpShare;
      lpTotal.gp_catchup += lpShare;
      remaining -= catchupTier;
    } else {
      a.gp_catchup = 0n; a.lp_catchup = 0n;
    }

    if (remaining > 0n) {
      const gpCarry = mulFixed(remaining, carryPctFixed);
      const lpCarry = remaining - gpCarry;
      a.carry_residual_gp = gpCarry;
      a.carry_residual_lp = lpCarry;
      gpTotal.carry_residual += gpCarry;
      lpTotal.carry_residual += lpCarry;
    }
    distributionLines.push(ev);
  }

  return { lpTotal, gpTotal, distributionLines };
}

function runPool(cashflows, waterfall) {
  const prefRateFixed = toFixed(waterfall.pref_rate);
  const gpCatchupPctFixed = toFixed(waterfall.gp_catchup_pct);
  const carryPctFixed = toFixed(waterfall.carry_pct);
  const dayCountConvention = waterfall.day_count_convention ?? 'actual/365';

  const sorted = [...cashflows].sort((x, y) => (Date.parse(x.date) || 0) - (Date.parse(y.date) || 0));
  const firstDate = sorted.length ? sorted[0].date : null;
  const events = sorted.map((cf) => ({
    date: cf.date,
    type: cf.type,
    amount_fixed: toFixed(cf.amount),
    days_from_first: firstDate ? daysBetween(firstDate, cf.date) : 0,
    deal_id: cf.deal_id ?? null,
  }));

  const { unreturnedCapital, accruedPref, ledger } = runWaterfallOverEvents(events, prefRateFixed, waterfall.compounding_basis, dayCountConvention);
  const { lpTotal, gpTotal, distributionLines } = applyCatchupAndCarry(ledger, gpCatchupPctFixed, carryPctFixed);

  return { lpTotal, gpTotal, unreturnedCapital, accruedPref, distributionLines };
}

function sumTierTotals(pools, side) {
  const out = { return_of_capital: 0n, preferred_return: 0n, gp_catchup: 0n, carry_residual: 0n };
  for (const p of pools) for (const t of TIER_NAMES) out[t] += p[side][t];
  return out;
}

function computeClawback(recomputedGpTiers, cashflows) {
  let contributed = 0n; let distributed = 0n;
  for (const cf of cashflows) {
    const amt = toFixed(cf.amount);
    if (cf.type === 'contribution') contributed += amt; else if (cf.type === 'distribution') distributed += amt;
  }
  const totalProfit = distributed > contributed ? distributed - contributed : 0n;
  const gpCarryReceived = recomputedGpTiers.gp_catchup + recomputedGpTiers.carry_residual;
  // Entitled GP amount, at the declared carry_pct, over realized profit above return of capital.
  return { totalProfit, gpCarryReceived };
}

/**
 * compute(pp) — pure PE distribution waterfall LP-side recompute kernel.
 * pp: {
 *   fund_id?: string, deal_id?: string, as_of_date?: string,
 *   waterfall: {
 *     pref_rate: number|string, compounding_basis: 'annual'|'simple',
 *     day_count_convention?: string, gp_catchup_pct: number|string,
 *     carry_pct: number|string, tier_structure: 'european_whole_fund'|'american_deal_by_deal',
 *     clawback_flag?: boolean,
 *   },
 *   cashflows: [{ date, type: 'contribution'|'distribution', amount, deal_id? }],
 *   gp_reported_allocation: { tiers: [{ tier, lp_amount, gp_amount }] } | null,
 * }
 */
export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];
  const w = (pp.waterfall && typeof pp.waterfall === 'object') ? pp.waterfall : {};

  const prefRateOk = w.pref_rate !== undefined && w.pref_rate !== null && w.pref_rate !== '';
  if (!prefRateOk) rejected_inputs.push({ where: 'waterfall.pref_rate', reason: 'absent -- the preferred return rate must be declared, never defaulted', supplied: null });

  const compoundingBasis = ['annual', 'simple'].includes(w.compounding_basis) ? w.compounding_basis : null;
  if (!compoundingBasis) rejected_inputs.push({ where: 'waterfall.compounding_basis', reason: 'absent or not one of "annual"/"simple"', supplied: w.compounding_basis ?? null });

  const gpCatchupOk = w.gp_catchup_pct !== undefined && w.gp_catchup_pct !== null && w.gp_catchup_pct !== '';
  if (!gpCatchupOk) rejected_inputs.push({ where: 'waterfall.gp_catchup_pct', reason: 'absent -- the GP catch-up percentage must be declared, never defaulted', supplied: null });

  const carryOk = w.carry_pct !== undefined && w.carry_pct !== null && w.carry_pct !== '';
  if (!carryOk) rejected_inputs.push({ where: 'waterfall.carry_pct', reason: 'absent -- the carry percentage must be declared, never defaulted', supplied: null });

  const tierStructure = TIER_STRUCTURES.includes(w.tier_structure) ? w.tier_structure : null;
  if (!tierStructure) rejected_inputs.push({ where: 'waterfall.tier_structure', reason: 'absent or not one of "european_whole_fund"/"american_deal_by_deal"', supplied: w.tier_structure ?? null });

  const clawbackFlag = w.clawback_flag === true;

  const cashflowsIn = Array.isArray(pp.cashflows) ? pp.cashflows : [];
  if (cashflowsIn.length === 0) rejected_inputs.push({ where: 'cashflows', reason: 'absent or empty -- at least one dated cashflow is required', supplied: null });
  const validatedCashflows = [];
  cashflowsIn.forEach((cf, i) => {
    const c = cf && typeof cf === 'object' ? cf : {};
    const dateOk = typeof c.date === 'string' && !Number.isNaN(Date.parse(c.date));
    if (!dateOk) rejected_inputs.push({ where: `cashflows[${i}].date`, reason: 'absent or unparseable', supplied: c.date ?? null });
    const typeOk = CASHFLOW_TYPES.includes(c.type);
    if (!typeOk) rejected_inputs.push({ where: `cashflows[${i}].type`, reason: 'absent or not one of "contribution"/"distribution"', supplied: c.type ?? null });
    const amountOk = c.amount !== undefined && c.amount !== null && c.amount !== '';
    if (!amountOk) rejected_inputs.push({ where: `cashflows[${i}].amount`, reason: 'absent', supplied: null });
    if (tierStructure === 'american_deal_by_deal' && !c.deal_id) {
      rejected_inputs.push({ where: `cashflows[${i}].deal_id`, reason: 'absent -- required when tier_structure is "american_deal_by_deal" so each cashflow can be assigned to its deal pool', supplied: null });
    }
    if (dateOk && typeOk && amountOk) validatedCashflows.push({ date: c.date, type: c.type, amount: c.amount, deal_id: c.deal_id ?? null });
  });

  const gpReportedIn = pp.gp_reported_allocation && typeof pp.gp_reported_allocation === 'object' ? pp.gp_reported_allocation : null;
  const gpReportedTiers = Array.isArray(gpReportedIn?.tiers) ? gpReportedIn.tiers : null;
  if (!gpReportedTiers || gpReportedTiers.length === 0) rejected_inputs.push({ where: 'gp_reported_allocation.tiers', reason: 'absent or empty -- the GP-reported allocation to diff against is required', supplied: null });

  const structuralOk = prefRateOk && compoundingBasis && gpCatchupOk && carryOk && tierStructure && validatedCashflows.length > 0 && gpReportedTiers && gpReportedTiers.length > 0;

  if (!structuralOk) {
    const output_payload = {
      fund_id: pp.fund_id ?? null,
      deal_id: pp.deal_id ?? null,
      as_of_date: pp.as_of_date ?? null,
      verdict: 'INDETERMINATE',
      reason: 'One or more required parameters are missing -- see rejected_inputs. Never defaulted, never guessed.',
      recomputed_allocation: null,
      gp_reported_allocation: gpReportedIn,
      tier_deltas: [],
      per_deal: null,
      clawback: null,
      rejected_inputs,
      not_proven: NOT_PROVEN,
      fence: 'Cashflows and the waterfall parameterization are SUPPLIED, asserted, and digested into this receipt. This kernel recomputes ARITHMETIC over declared inputs and attests THAT -- never an opinion on LPA authorization, never ILPA-endorsed.',
    };
    return { output_payload, compliance_flags: ['PE_WATERFALL_INDETERMINATE', 'PE_WATERFALL_INPUTS_REJECTED'] };
  }

  const waterfallParams = {
    pref_rate: w.pref_rate,
    compounding_basis: compoundingBasis,
    day_count_convention: w.day_count_convention ?? 'actual/365',
    gp_catchup_pct: w.gp_catchup_pct,
    carry_pct: w.carry_pct,
  };

  let pools = [];
  let perDeal = null;
  if (tierStructure === 'european_whole_fund') {
    pools = [runPool(validatedCashflows, waterfallParams)];
  } else {
    const dealIds = [...new Set(validatedCashflows.map((c) => c.deal_id))];
    perDeal = dealIds.map((dealId) => {
      const dealCashflows = validatedCashflows.filter((c) => c.deal_id === dealId);
      const pool = runPool(dealCashflows, waterfallParams);
      return { deal_id: dealId, ...renderPoolTotals(pool) };
    });
    pools = dealIds.map((dealId) => runPool(validatedCashflows.filter((c) => c.deal_id === dealId), waterfallParams));
  }

  const lpTotals = sumTierTotals(pools, 'lpTotal');
  const gpTotals = sumTierTotals(pools, 'gpTotal');

  const recomputedAllocation = TIER_NAMES.map((tier) => ({
    tier,
    lp_amount: fixedToPlainString(lpTotals[tier], SCALE_EXP),
    gp_amount: fixedToPlainString(gpTotals[tier], SCALE_EXP),
  }));

  const reportedByTier = new Map(gpReportedTiers.map((t) => [t.tier, t]));
  const tier_deltas = TIER_NAMES.map((tier) => {
    const reported = reportedByTier.get(tier);
    const reportedLp = reported && reported.lp_amount !== undefined ? toFixed(reported.lp_amount) : null;
    const reportedGp = reported && reported.gp_amount !== undefined ? toFixed(reported.gp_amount) : null;
    const lpDelta = reportedLp === null ? null : fixedToPlainString(lpTotals[tier] - reportedLp, SCALE_EXP);
    const gpDelta = reportedGp === null ? null : fixedToPlainString(gpTotals[tier] - reportedGp, SCALE_EXP);
    return {
      tier,
      recomputed_lp_amount: fixedToPlainString(lpTotals[tier], SCALE_EXP),
      recomputed_gp_amount: fixedToPlainString(gpTotals[tier], SCALE_EXP),
      gp_reported_lp_amount: reported && reported.lp_amount !== undefined ? String(reported.lp_amount) : null,
      gp_reported_gp_amount: reported && reported.gp_amount !== undefined ? String(reported.gp_amount) : null,
      lp_delta: lpDelta,
      gp_delta: gpDelta,
      matches: lpDelta === '0.00000000' && gpDelta === '0.00000000',
    };
  });

  const anyMissingReported = tier_deltas.some((d) => d.gp_reported_lp_amount === null || d.gp_reported_gp_amount === null);
  const anyDiverges = tier_deltas.some((d) => !d.matches);
  const verdict = anyMissingReported ? 'INDETERMINATE' : (anyDiverges ? 'DIVERGES' : 'MATCHES');

  let clawback = null;
  const compliance_flags = ['PE_WATERFALL_RECOMPUTED'];
  if (clawbackFlag) {
    const { totalProfit, gpCarryReceived } = computeClawback(gpTotals, validatedCashflows);
    const entitled = mulFixed(totalProfit, toFixed(w.carry_pct));
    const clawbackAmountFixed = gpCarryReceived > entitled ? gpCarryReceived - entitled : 0n;
    clawback = {
      clawback_flag_declared: true,
      total_realized_profit: fixedToPlainString(totalProfit, SCALE_EXP),
      gp_carry_and_catchup_received: fixedToPlainString(gpCarryReceived, SCALE_EXP),
      gp_entitled_at_carry_pct: fixedToPlainString(entitled, SCALE_EXP),
      clawback_amount: fixedToPlainString(clawbackAmountFixed, SCALE_EXP),
      note: 'Aggregate check only: does cumulative GP catch-up + carry exceed carry_pct of cumulative realized profit (distributions minus contributions) at this as-of date. Not a fund-level clawback provision recompute -- the governing LPA clawback mechanics (interim vs final, tax-effected or gross, escrow terms) are not modeled here.',
    };
    if (clawbackAmountFixed > 0n) compliance_flags.push('PE_WATERFALL_CLAWBACK_EXPOSURE_DETECTED');
    else compliance_flags.push('PE_WATERFALL_CLAWBACK_NONE_DETECTED');
  }

  compliance_flags.push(verdict === 'MATCHES' ? 'PE_WATERFALL_MATCHES' : verdict === 'DIVERGES' ? 'PE_WATERFALL_DIVERGES' : 'PE_WATERFALL_INDETERMINATE');
  if (rejected_inputs.length > 0) compliance_flags.push('PE_WATERFALL_SOME_INPUTS_REJECTED');

  const output_payload = {
    fund_id: pp.fund_id ?? null,
    deal_id: pp.deal_id ?? null,
    as_of_date: pp.as_of_date ?? null,
    verdict,
    tier_structure: tierStructure,
    waterfall: waterfallParams,
    recomputed_allocation: recomputedAllocation,
    gp_reported_allocation: gpReportedIn,
    tier_deltas,
    per_deal: perDeal,
    clawback,
    rejected_inputs,
    not_proven: NOT_PROVEN,
    fence: 'Cashflows and the waterfall parameterization are SUPPLIED, asserted, and digested into this receipt. This kernel recomputes ARITHMETIC over declared inputs and attests THAT -- never an opinion on LPA authorization, never ILPA-endorsed or ILPA-compliant.',
    ilpa_context: 'ILPA reporting-template guidance states it was not designed for verifying any of the GP\'s calculations (cited as dated gap evidence, not as an endorsement of this tool).',
  };

  return { output_payload, compliance_flags };
}

function renderPoolTotals(pool) {
  const out = {};
  for (const t of TIER_NAMES) {
    out[`lp_${t}`] = fixedToPlainString(pool.lpTotal[t], SCALE_EXP);
    out[`gp_${t}`] = fixedToPlainString(pool.gpTotal[t], SCALE_EXP);
  }
  return out;
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
