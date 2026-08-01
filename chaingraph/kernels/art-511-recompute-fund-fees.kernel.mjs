// art-511 — Recompute Fund Fees: pure decision kernel.
//
// FUND-FEE-RECOMPUTE-BUILD-SPEC.md §1-§2. Recomputes a fund's management fee
// and performance fee (against a hurdle, a high-water mark, and a declared
// crystallisation policy) from the terms the investor already holds — the fee
// statement and the fund agreement — and diffs the result against what was
// actually charged, when supplied.
//
// DISTINCT FROM TWO SHIPPED NODES (state this on the page too):
//   art-373-recompute-fund-nav        recomputes NAV per share. This family
//                                      CONSUMES a NAV; it does not recompute one.
//   art-375-compute-fund-expense-ratios computes gross/net expense ratio and
//                                      TER. A ratio cannot detect a misapplied
//                                      high-water-mark reset.
//
// HARD FENCE (receipt MUST record this, copy MUST lead with it): the fee
// rate, hurdle rate/type, high-water mark, crystallisation policy, accrual
// basis and day count are every one of them a caller input TRANSCRIBED from
// the fund agreement. This kernel ships no rate table, no fund library, no
// term database — zero market-data or fund-administrator lookups
// (zero-egress by contract). `agreement_ref` + `terms_version` are pinned in
// the artifact and visible on screen, so a later side letter makes an old
// receipt DATED, not wrong.
//
// THE ERROR THIS NODE EXISTS TO CATCH: hard vs soft hurdle. A HARD hurdle
// charges only on the excess return ABOVE the hurdle; a SOFT hurdle charges
// on the FULL return once the hurdle is cleared. Conflating the two is the
// single most common failure mode in performance-fee recomputation, so
// `hurdle_type` carries NO default — absent or unrecognised, the run raises
// `judgment_required` naming the field, never guesses.
//
// HIGH-WATER MARK: a loss carry-forward is NOT cleared by a fee period
// ending unless the caller explicitly declares `loss_carryforward: false`
// (an atypical reset-each-period structure). Default behaviour keeps the
// mark at max(closing_nav, prior_high_water_mark) across periods, exactly as
// a high-water mark is defined to work.
//
// Fixed-point design: identical convention to FN-1/FN-3 (art-373, art-375) —
// every money/rate value is parsed from its DECIMAL STRING REPRESENTATION
// (never via floating multiplication) into a BigInt scaled by 10^SCALE_EXP.
// All arithmetic happens in that BigInt domain; only the final figures are
// rounded to the fund's declared decimal_places using the fund's declared
// rounding mode. Copied verbatim from art-375's pattern per
// FUND-FEE-RECOMPUTE-BUILD-SPEC.md §0 ("reuse, do not reimplement") — kernels
// are self-contained files and do not cross-import each other's arithmetic.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-511-recompute-fund-fees';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'recompute_fund_fees',
  mandate_type: 'analytics_mandate',
  gpu: false,
};

// ── fixed-point money math (BigInt, no floats) — byte-identical convention
//    to FN-1/FN-3 (art-373 / art-375) ────────────────────────────────────
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

function maxFixed(a, b) { return a > b ? a : b; }
function minFixed(a, b) { return a < b ? a : b; }
function zeroFloor(a) { return a < 0n ? 0n : a; }

// ── day-count denominators for accrual-style management-fee bases — same
//    table as FN-1/FN-3, so a fund's accrual convention reads identically
//    across every node that touches it. ─────────────────────────────────
const DAY_COUNT_DENOMINATORS = {
  '30/360': 360,
  'actual/360': 360,
  'actual/365': 365,
  'actual/actual': 365, // approximation; caller may override via year_days
};

function computeAccrualAmount(principal, annualRateStr, days, dayCountConvention, yearDaysOverride) {
  const principalFixed = toFixed(principal);
  const rateFixed = toFixed(annualRateStr ?? 0);
  const yearDays = Number(yearDaysOverride ?? DAY_COUNT_DENOMINATORS[dayCountConvention] ?? 365);
  const daysFixed = toFixed(days);
  const yearDaysFixed = toFixed(yearDays);
  const dayFraction = divFixed(daysFixed, yearDaysFixed);
  return mulFixed(mulFixed(principalFixed, rateFixed), dayFraction);
}

const HURDLE_TYPES = new Set(['hard', 'soft', 'none']);
const CRYSTALLISATION_MODES = new Set(['period', 'realisation']);

const NOT_PROVEN = [
  { item: 'Fee rate and term accuracy', detail: 'The management-fee rate, hurdle rate/type, high-water mark, crystallisation policy, accrual basis, and day count are every one of them caller-supplied and asserted. This kernel performs no fund-administrator or market-data lookups (zero-egress) and does not verify these terms against the underlying fund agreement.' },
  { item: 'NAV accuracy', detail: 'The opening and closing NAV figures are caller-supplied. Recomputing the NAV itself is the scope of art-373-recompute-fund-nav, a separate node this kernel consumes rather than reimplements.' },
  { item: 'Charged-amount provenance', detail: 'Where supplied, charged_amounts is asserted, taken as given from the fee statement being checked. This kernel does not verify that the statement itself was correctly transcribed from the manager\'s books.' },
  { item: 'Manager overcharge / wrongdoing', detail: 'A diff is a finding that the recomputation disagrees with the charged figure on the supplied terms — never an allegation that the manager overcharged. Every disagreement can equally originate from a term this run had wrong.' },
];

/**
 * compute(pp) — pure fund fee-recomputation kernel.
 * pp: {
 *   fund_id?, agreement_ref, terms_version, as_of,
 *   period_start?, period_end?, period_days,
 *   nav: { opening, closing, fee_base, fee_base_basis? },
 *   management_fee: { rate, accrual_frequency?, day_count? },
 *   performance_fee: {
 *     rate, hurdle_rate, hurdle_type: 'hard'|'soft'|'none'|undefined,
 *     high_water_mark?: number|string|null,
 *     crystallisation: 'period'|'realisation',
 *     loss_carryforward?: boolean,        // default true
 *     realisation_triggered?: boolean,    // only read when crystallisation === 'realisation'
 *   },
 *   charged_amounts?: { management_fee?, performance_fee_crystallised?, performance_fee_accrued? },
 *   rounding?: { decimal_places: number, mode: 'half_up'|'half_even'|'truncate' },
 * }
 */
export function compute(pp) {
  const rounding = pp.rounding ?? {};
  const decimalPlaces = Number.isInteger(rounding.decimal_places) ? rounding.decimal_places : 2;
  const roundingMode = ['half_up', 'half_even', 'truncate'].includes(rounding.mode) ? rounding.mode : 'half_up';

  const nav = pp.nav ?? {};
  const mf = pp.management_fee ?? {};
  const pf = pp.performance_fee ?? {};

  const openingFixed = toFixed(nav.opening);
  const closingFixed = toFixed(nav.closing);
  const feeBaseFixed = toFixed(nav.fee_base);
  const periodDays = Number(pp.period_days ?? NaN);

  const compliance_flags = [];
  let judgment_required = null;

  // ── finite gate #1: zero/negative period ────────────────────────────
  const periodPositive = Number.isFinite(periodDays) && periodDays > 0;
  if (!periodPositive) compliance_flags.push('FEE_PERIOD_NOT_POSITIVE');

  // ── finite gate #2: zero fee base ───────────────────────────────────
  const feeBasePositive = feeBaseFixed > 0n;
  if (!feeBasePositive) compliance_flags.push('FEE_BASE_ZERO_OR_NEGATIVE');

  // ── management fee: accrual on the declared base, day-count honoured
  //    exactly as declared. Zero/negative period or zero base resolves to
  //    a defined 0, never NaN. ─────────────────────────────────────────
  const managementFeeFixed = (periodPositive && feeBasePositive)
    ? computeAccrualAmount(nav.fee_base, mf.rate, periodDays, mf.day_count, mf.year_days)
    : 0n;

  // ── hurdle_type: NO default. Absent or unrecognised is judgment_required,
  //    not a guess. ────────────────────────────────────────────────────
  const hurdleTypeRaw = pf.hurdle_type;
  const hurdleTypeValid = HURDLE_TYPES.has(hurdleTypeRaw);
  if (!hurdleTypeValid) {
    judgment_required = {
      field: 'performance_fee.hurdle_type',
      reason: 'hurdle_type must be one of "hard", "soft", or "none" and carries no default — a hard hurdle charges only the excess above the hurdle, a soft hurdle charges the full return once cleared, and conflating them is the single most common performance-fee error. Supply hurdle_type explicitly from the fund agreement.',
      supplied: hurdleTypeRaw ?? null,
    };
    compliance_flags.push('ESCALATION_RAISED');
  }

  // ── period return, hurdle test ───────────────────────────────────────
  const periodReturnPct = openingFixed > 0n ? divFixed(closingFixed - openingFixed, openingFixed) : 0n;
  const hurdleRateFixed = toFixed(pf.hurdle_rate ?? 0);
  const hurdleCleared = hurdleTypeValid && hurdleTypeRaw !== 'none'
    ? periodReturnPct > hurdleRateFixed
    : (hurdleTypeValid && hurdleTypeRaw === 'none' ? periodReturnPct > 0n : false);
  if (hurdleTypeValid && hurdleTypeRaw !== 'none' && !hurdleCleared) compliance_flags.push('FEE_HURDLE_NOT_MET');

  // hurdle-implied return percentage eligible for a fee, per hurdle_type —
  // hard = excess ABOVE the hurdle only; soft = the FULL return once cleared;
  // none = the full return whenever positive.
  let hurdleExcessReturnPct = 0n;
  if (hurdleTypeValid) {
    if (hurdleTypeRaw === 'hard') {
      hurdleExcessReturnPct = hurdleCleared ? zeroFloor(periodReturnPct - hurdleRateFixed) : 0n;
    } else if (hurdleTypeRaw === 'soft') {
      hurdleExcessReturnPct = hurdleCleared ? zeroFloor(periodReturnPct) : 0n;
    } else {
      hurdleExcessReturnPct = hurdleCleared ? zeroFloor(periodReturnPct) : 0n;
    }
  }
  const hurdleExcessAmountFixed = mulFixed(hurdleExcessReturnPct, openingFixed);

  // ── high-water mark. finite gate #3: first period with no prior HWM —
  //    baseline defaults to opening NAV (there is nothing to have exceeded
  //    yet), never NaN and never a silent zero. ──────────────────────────
  const hwmSupplied = pf.high_water_mark !== undefined && pf.high_water_mark !== null;
  const firstPeriod = !hwmSupplied;
  if (firstPeriod) compliance_flags.push('FEE_HWM_FIRST_PERIOD');
  const priorHwmFixed = hwmSupplied ? toFixed(pf.high_water_mark) : openingFixed;

  const navGainAboveHwmFixed = zeroFloor(closingFixed - priorHwmFixed);
  const hwmExceeded = navGainAboveHwmFixed > 0n;
  if (!hwmExceeded) compliance_flags.push('FEE_HWM_NOT_EXCEEDED');

  // loss_carryforward: NOT cleared by a period ending unless the caller
  // explicitly declares it false (an atypical reset-each-period structure).
  const lossCarryforward = pf.loss_carryforward !== false;
  const newHighWaterMarkFixed = lossCarryforward ? maxFixed(closingFixed, priorHwmFixed) : closingFixed;

  // ── performance-fee base: the SMALLER of what the hurdle test allows and
  //    what the high-water mark allows — a fee period must clear BOTH. ────
  const eligibleGainFixed = (hurdleTypeValid && hurdleCleared && hwmExceeded)
    ? minFixed(navGainAboveHwmFixed, zeroFloor(hurdleExcessAmountFixed))
    : 0n;
  const performanceFeeRateFixed = toFixed(pf.rate ?? 0);
  const performanceFeeFixed = hurdleTypeValid ? mulFixed(eligibleGainFixed, performanceFeeRateFixed) : 0n;

  // ── crystallisation: what is payable now vs accrued-but-uncrystallised.
  //    NEVER summed into one figure — one is payable, the other is not. ───
  const crystallisationMode = CRYSTALLISATION_MODES.has(pf.crystallisation) ? pf.crystallisation : 'period';
  if (!CRYSTALLISATION_MODES.has(pf.crystallisation)) compliance_flags.push('FEE_CRYSTALLISATION_MODE_DEFAULTED_PERIOD');
  let performanceFeeCrystallisedFixed = 0n;
  let performanceFeeAccruedFixed = 0n;
  if (crystallisationMode === 'period') {
    performanceFeeCrystallisedFixed = performanceFeeFixed;
  } else {
    const realisationTriggered = pf.realisation_triggered === true;
    if (realisationTriggered) performanceFeeCrystallisedFixed = performanceFeeFixed;
    else performanceFeeAccruedFixed = performanceFeeFixed;
  }

  // ── diff against charged_amounts, where supplied ─────────────────────
  const charged = pp.charged_amounts ?? null;
  const recomputeOnly = charged == null;
  const diff = [];
  if (!recomputeOnly) {
    const pairs = [
      ['management_fee', managementFeeFixed, charged.management_fee],
      ['performance_fee_crystallised', performanceFeeCrystallisedFixed, charged.performance_fee_crystallised],
      ['performance_fee_accrued', performanceFeeAccruedFixed, charged.performance_fee_accrued],
    ];
    for (const [label, computedFixed, chargedRaw] of pairs) {
      if (chargedRaw === undefined) continue;
      const chargedFixed = toFixed(chargedRaw);
      const deltaFixed = computedFixed - chargedFixed;
      diff.push({
        component: label,
        computed: fixedToPlainString(computedFixed, decimalPlaces),
        charged: fixedToPlainString(chargedFixed, decimalPlaces),
        delta: fixedToPlainString(deltaFixed, decimalPlaces),
        matches: deltaFixed === 0n,
      });
    }
  }
  const anyDiffers = diff.some((d) => !d.matches);

  if (recomputeOnly) compliance_flags.push('FEE_RECOMPUTE_ONLY');
  else if (anyDiffers) compliance_flags.push('FEE_DIFFERS');
  else compliance_flags.push('FEE_MATCHES');
  compliance_flags.push('FEE_RECOMPUTED');

  const rationale = [];
  rationale.push(periodPositive
    ? `Management fee accrued over ${periodDays} declared days on a fee base of ${fixedToPlainString(feeBaseFixed, decimalPlaces)}.`
    : 'Period is zero or negative days — management fee resolves to 0 by the finite gate, not by omission.');
  if (!hurdleTypeValid) {
    rationale.push('hurdle_type was absent or unrecognised — no performance fee was computed; judgment_required names the resolving input.');
  } else {
    rationale.push(hurdleTypeRaw === 'hard'
      ? 'Hard hurdle: performance fee, if any, applies only to the return in excess of the hurdle rate.'
      : hurdleTypeRaw === 'soft'
        ? 'Soft hurdle: once cleared, performance fee applies to the full period return, not merely the excess.'
        : 'No hurdle declared: performance fee, if any, applies to the full positive period return.');
    rationale.push(firstPeriod
      ? 'No prior high-water mark was supplied — this is treated as the first period and the opening NAV is the baseline nothing has yet exceeded.'
      : `High-water mark carried forward from ${fixedToPlainString(priorHwmFixed, decimalPlaces)}; ${lossCarryforward ? 'a prior loss is NOT cleared by this period ending' : 'the mark resets each period by explicit caller declaration'}.`);
    rationale.push(hwmExceeded
      ? `Closing NAV exceeds the high-water mark by ${fixedToPlainString(navGainAboveHwmFixed, decimalPlaces)}.`
      : 'Closing NAV does not exceed the high-water mark — no performance fee is chargeable regardless of the hurdle test.');
  }
  rationale.push(crystallisationMode === 'period'
    ? 'Crystallisation is period-based — the full computed performance fee is payable now.'
    : `Crystallisation is realisation-based — ${pf.realisation_triggered === true ? 'a realisation event was declared, so the fee is payable now' : 'no realisation event was declared, so the fee is accrued but not yet payable'}.`);
  rationale.push(recomputeOnly
    ? 'No charged_amounts were supplied — this run is recompute-only, not a match/mismatch determination.'
    : anyDiffers
      ? 'One or more recomputed components disagree with the charged figures on the terms supplied — a finding, not an allegation of overcharge.'
      : 'Every recomputed component matches the charged figures on the terms supplied.');

  const output_payload = {
    fund_id: pp.fund_id ?? null,
    agreement_ref: pp.agreement_ref ?? null,
    terms_version: pp.terms_version ?? null,
    as_of: pp.as_of ?? null,
    period_start: pp.period_start ?? null,
    period_end: pp.period_end ?? null,
    period_days: Number.isFinite(periodDays) ? periodDays : null,
    rounding: { decimal_places: decimalPlaces, mode: roundingMode },
    judgment_required,
    management_fee_computed: fixedToPlainString(managementFeeFixed, decimalPlaces),
    performance_fee: {
      hurdle_type: hurdleTypeValid ? hurdleTypeRaw : null,
      hurdle_rate: hurdleTypeValid ? roundFixedToString(hurdleRateFixed, decimalPlaces + 2, roundingMode) : null,
      period_return_pct: roundFixedToString(periodReturnPct, decimalPlaces + 2, roundingMode),
      hurdle_cleared: hurdleTypeValid ? hurdleCleared : null,
      hurdle_excess_amount: hurdleTypeValid ? fixedToPlainString(zeroFloor(hurdleExcessAmountFixed), decimalPlaces) : null,
      prior_high_water_mark: fixedToPlainString(priorHwmFixed, decimalPlaces),
      first_period_no_prior_hwm: firstPeriod,
      loss_carryforward: lossCarryforward,
      new_high_water_mark: fixedToPlainString(newHighWaterMarkFixed, decimalPlaces),
      hwm_exceeded: hwmExceeded,
      gain_above_hwm: fixedToPlainString(navGainAboveHwmFixed, decimalPlaces),
      eligible_gain: fixedToPlainString(eligibleGainFixed, decimalPlaces),
      performance_fee_crystallised: fixedToPlainString(performanceFeeCrystallisedFixed, decimalPlaces),
      performance_fee_accrued: fixedToPlainString(performanceFeeAccruedFixed, decimalPlaces),
      crystallisation: crystallisationMode,
    },
    recompute_only: recomputeOnly,
    diff,
    rationale,
    not_proven: NOT_PROVEN,
    fence: 'Fee rate, hurdle rate/type, high-water mark, crystallisation policy, accrual basis and day count are every one of them a caller input transcribed from the fund agreement — this kernel ships no rate table, no fund library, no term database (zero-egress by contract). agreement_ref + terms_version are pinned so a later side letter makes an old receipt dated, not wrong.',
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
