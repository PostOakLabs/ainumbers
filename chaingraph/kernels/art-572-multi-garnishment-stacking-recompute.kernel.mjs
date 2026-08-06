/**
 * art-572-multi-garnishment-stacking-recompute.kernel.mjs
 *
 * RECOMP wave (RECOMP-WAVE-BUILD-SPEC.md §7, RECOMP-GARNISH-1) — recomputes
 * how much of an employee's disposable earnings each garnishment order in a
 * caller-declared stack may lawfully withhold for ONE STATED PAY PERIOD, then
 * (optionally) compares the recomputed per-order withholding against what a
 * garnishment notice states was withheld.
 *
 * DUAL AUDIENCE. Both sides of a garnishment stack can run the same
 * arithmetic: an employer/payroll team computing what to withhold, and an
 * employee or legal-aid clinic recomputing a notice they received to see
 * whether it undercounts a statutory protection. Neither side is privileged
 * in the kernel -- the same statutory-cap engine runs regardless of who
 * supplies the inputs.
 *
 * WHY THIS IS AN INDEPENDENT RECOMPUTATION. The recomputed withholding for
 * every order is derived HERE from disposable earnings, the order's declared
 * type and attributes, and the stack's declared priority order (the order
 * the caller lists the orders[] array in). It is never lifted from a notice.
 * A difference against a supplied noticed amount is therefore a genuine
 * arithmetic finding, not a re-footing of a published figure.
 *
 * STATUTORY CAPS MODELLED (spec §7, re-verify at build against primary text):
 *   - child_support: CCPA Title III tiers (15 U.S.C. §1673(b)) -- 50% (no
 *     >12-week arrears, supporting another spouse/child), 60% (no arrears,
 *     not supporting another family), 55% (arrears >12wk, supporting another
 *     family), 65% (arrears >12wk, not supporting another family).
 *   - federal_tax_levy: 26 U.S.C. §6334 / CCPA §303(b) exempts a federal tax
 *     levy from the CCPA percentage limitations that bind every other order
 *     type here. This kernel does NOT compute the IRS Publication 1494
 *     exempt-amount table (a wage-bracket/filing-status lookup, out of
 *     scope) -- it caps a federal_tax_levy order only at remaining
 *     disposable earnings and flags GARNISH_TAX_LEVY_NOT_CCPA_CAPPED so a
 *     reader knows the true IRS-table exempt amount was NOT recomputed here.
 *   - state_levy: CAPPED BY A DECLARED PARAMETER ONLY -- state_overlay may
 *     supply state_levy_cap_percent. Absent that declaration, this kernel
 *     falls back to the general CCPA 25% / 30x-federal-minimum-wage floor
 *     (the same rule as creditor/other), flagged
 *     GARNISH_STATE_LEVY_DEFAULTED_TO_CCPA. ⛔ NO 50-state table is bundled
 *     (standing-data-duty trap, Common wave doctrine) -- the state's own
 *     percentage is the caller's to supply.
 *   - hea_awg: 34 CFR Part 34 caps Administrative Wage Garnishment at 15% of
 *     disposable earnings, AND (DOL Fact Sheet 30) withholding may not
 *     reduce weekly pay below 30x the federal minimum wage -- both floors
 *     apply and the more protective one binds.
 *   - creditor / other: general CCPA 25% of disposable earnings, or the
 *     amount by which disposable earnings exceed 30x the federal minimum
 *     wage, whichever is LESS (29 CFR Part 870).
 *
 * AGGREGATE CEILING. Orders are withheld in the priority order the caller
 * supplies them in (this kernel infers no priority from order type, exactly
 * as art-568's tier list is processed in the order supplied). The combined
 * withholding across every order in the stack is additionally capped at the
 * SINGLE HIGHEST individual statutory cap present in the stack -- the
 * documented DOL Fact Sheet 30 pattern where a support order's percentage
 * functions as the aggregate ceiling once support is present. This is a
 * deliberate simplification of a genuinely fact-specific area of law and is
 * named as such in not_proven[]; it is not a substitute for counsel.
 *
 * FEDERAL MINIMUM WAGE. A dated, labeled prefill (federal_minimum_wage_cents
 * = 725, i.e. $7.25/hour, unchanged since 2009-07-24) is used ONLY when the
 * caller does not override it. The caller may always override it, and the
 * artifact echoes whichever figure was actually used plus whether it was the
 * prefill or a caller override, so a later minimum-wage change dates an old
 * receipt rather than falsifying it.
 *
 * VERIFY MODE / INDETERMINATE (Common wave doctrine): whenever noticed
 * withholding amounts needed for the comparison are absent, the verdict is
 * INDETERMINATE, never guessed toward MATCHES. Likewise an empty orders[]
 * list or non-positive disposable earnings resolves to INDETERMINATE.
 *
 * FIXED-POINT MONEY MATH. Every amount crosses the boundary as an INTEGER
 * NUMBER OF MINOR UNITS (cents). Allocation, capping, and shortfall are
 * integer operations; 2dp display strings come from integer division plus
 * string padding, never toFixed() on a float.
 *
 * FINITE GATE. Zero disposable earnings, an empty orders[] list, and an
 * order naming a type this kernel does not recognise each resolve to a
 * DEFINED result. No branch can emit NaN, Infinity, or an undefined state. A
 * value that is not a usable integer amount is coerced to 0 AND named in
 * rejected_inputs[], never silently dropped.
 *
 * THIS IS NOT LEGAL ADVICE and is not a substitute for counsel or a state's
 * own wage-garnishment statute. It is a statutory-cap arithmetic engine over
 * caller-declared facts about one pay period.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: RECOMP-WAVE-BUILD-SPEC.md §7, §Common.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-572-multi-garnishment-stacking-recompute';
const TOOL_VERSION = '1.0.0';
export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'recompute_garnishment_stack',
  mandate_type: 'analytics_mandate',
  gpu: false,
};

const ORDER_TYPES = ['child_support', 'federal_tax_levy', 'state_levy', 'hea_awg', 'creditor', 'other'];
const FEDERAL_MINIMUM_WAGE_CENTS_PREFILL = 725; // $7.25/hr, dated 2009-07-24, unchanged as of this build.
const FEDERAL_MINIMUM_WAGE_PREFILL_DATED = '2009-07-24';

const CITATIONS = {
  ccpa_support_tiers: {
    source: 'Consumer Credit Protection Act Title III, 15 U.S.C. Sec. 1673(b)',
    detail: 'Support-order withholding tiers of 50/55/60/65% of disposable earnings, keyed on whether the obligor supports another spouse/child and whether arrears exceed 12 weeks. Re-verify against primary text before relying on it (research findings, not facts).',
  },
  ccpa_general_cap: {
    source: '29 CFR Part 870 / CCPA Sec. 303',
    detail: 'General garnishment ceiling of 25% of disposable earnings, or the amount by which disposable earnings exceed 30 times the federal minimum wage, whichever is less.',
  },
  federal_tax_levy_exemption: {
    source: '26 U.S.C. Sec. 6334; CCPA Sec. 303(b)',
    detail: 'A federal tax levy is exempt from the CCPA percentage limitations that bind every other order type modelled here. The IRS Publication 1494 wage-bracket exempt-amount table is NOT computed by this kernel.',
  },
  hea_awg: {
    source: '34 CFR Part 34 (Administrative Wage Garnishment); DOL Fact Sheet 30',
    detail: 'Administrative Wage Garnishment on defaulted federal student loans is capped at 15% of disposable earnings, and may not reduce weekly pay below 30 times the federal minimum wage.',
  },
  dol_fact_sheet_30: {
    source: 'U.S. DOL Wage and Hour Division, Fact Sheet 30',
    detail: 'General guidance on Title III of the CCPA, cited for the aggregate-ceiling pattern this kernel applies across a multi-order stack.',
  },
};

const NOT_PROVEN = [
  { item: 'Not legal advice', detail: 'This kernel recomputes statutory-cap arithmetic from caller-declared facts about one pay period. It is not a substitute for counsel, a state agency, or the employer\'s own legal review.' },
  { item: 'Federal tax levy exempt amount', detail: 'A federal_tax_levy order is capped only at remaining disposable earnings, not at the IRS Publication 1494 wage-bracket exempt-amount table, which this kernel does not compute.' },
  { item: 'State levy percentage', detail: 'No 50-state table is bundled. A state_levy order uses the caller-declared state_overlay.state_levy_cap_percent where supplied; absent that, it defaults to the general CCPA cap, which may not be the correct figure for the governing state.' },
  { item: 'Aggregate-ceiling simplification', detail: 'The combined cap across every order in the stack is modelled here as the single highest individual statutory cap present. This is a documented simplification of a fact-specific area of law, not a comprehensive multi-order interaction rule for every jurisdiction.' },
  { item: 'Priority ordering', detail: 'Orders are withheld in the order the caller lists orders[] in. This kernel infers no priority from order type and does not verify that the supplied order matches the governing statute or a court\'s instructions.' },
  { item: 'Input accuracy', detail: 'Gross earnings, legally-required deductions, and every order\'s claimed amount are caller-supplied and asserted, not independently verified against payroll records or a court order.' },
];

const MINOR_UNIT_EXPONENT = 2;
const MINOR_SCALE = 100;

function isSafeIntAmount(v) { return typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v); }
function toMinorUnits(v, where, rejected) {
  if (isSafeIntAmount(v)) return v;
  if (v === undefined || v === null || v === '') { rejected.push({ where, reason: 'absent', supplied: null }); return 0; }
  rejected.push({
    where,
    reason: typeof v === 'number' ? 'not a safe integer number of minor units' : `expected an integer number of minor units, got ${typeof v}`,
    supplied: typeof v === 'number' && Number.isFinite(v) ? v : String(v),
  });
  return 0;
}
function display(minor) {
  const neg = minor < 0;
  const abs = neg ? -minor : minor;
  const whole = Math.trunc(abs / MINOR_SCALE);
  const frac = abs - whole * MINOR_SCALE;
  return (neg ? '-' : '') + String(whole) + '.' + String(frac).padStart(MINOR_UNIT_EXPONENT, '0');
}
function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function str(v, fallback) { return isNonEmptyString(v) ? v.trim() : fallback; }
function arr(v) { return Array.isArray(v) ? v : []; }
function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
function pctOf(minor, pct) { return Math.round((minor * pct) / 100); }

function capForOrder(order, disposable, floorMinorUnits, state_overlay, rejected, idx) {
  const nonNegFloor = Math.max(disposable - floorMinorUnits, 0);
  const generalCcpaCap = Math.min(pctOf(disposable, 25), nonNegFloor);

  if (order.type === 'child_support') {
    const pct = order.arrears_over_12wk
      ? (order.second_family ? 55 : 65)
      : (order.second_family ? 50 : 60);
    return { cap_minor_units: pctOf(disposable, pct), cap_basis: `CCPA Title III support tier: ${pct}% of disposable earnings (arrears>12wk=${order.arrears_over_12wk === true}, second_family=${order.second_family === true}).`, ccpa_capped: true };
  }
  if (order.type === 'federal_tax_levy') {
    return { cap_minor_units: disposable, cap_basis: 'Federal tax levy: exempt from the CCPA percentage limitations; capped here only at remaining disposable earnings. The IRS exempt-amount table is not computed by this kernel.', ccpa_capped: false };
  }
  if (order.type === 'state_levy') {
    const overlayPct = state_overlay && typeof state_overlay.state_levy_cap_percent === 'number' && Number.isFinite(state_overlay.state_levy_cap_percent)
      ? state_overlay.state_levy_cap_percent : null;
    if (overlayPct !== null) {
      return { cap_minor_units: pctOf(disposable, overlayPct), cap_basis: `Declared state overlay: ${overlayPct}% of disposable earnings (caller-supplied state_levy_cap_percent).`, ccpa_capped: true };
    }
    rejected.push({ where: `orders[${idx}] (state_levy)`, reason: 'no state_overlay.state_levy_cap_percent declared; defaulted to the general CCPA cap, which may not be the governing state figure', supplied: null });
    return { cap_minor_units: generalCcpaCap, cap_basis: 'No state_overlay.state_levy_cap_percent was declared; defaulted to the general CCPA 25% / 30x-floor cap. This is not necessarily the governing state\'s figure.', ccpa_capped: true };
  }
  if (order.type === 'hea_awg') {
    const awgPct = Math.min(pctOf(disposable, 15), nonNegFloor);
    return { cap_minor_units: awgPct, cap_basis: 'HEA Administrative Wage Garnishment: lesser of 15% of disposable earnings and the amount by which disposable earnings exceed 30x the federal minimum wage.', ccpa_capped: true };
  }
  // creditor | other
  return { cap_minor_units: generalCcpaCap, cap_basis: 'General CCPA cap: lesser of 25% of disposable earnings and the amount by which disposable earnings exceed 30x the federal minimum wage.', ccpa_capped: true };
}

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  const employee_ref = str(pp.employee_ref, 'UNSTATED');
  const period_label = str(pp.period_label, 'UNSTATED');
  const currency = isNonEmptyString(pp.currency) ? pp.currency.trim().toUpperCase() : 'USD';

  const gross_minor_units = toMinorUnits(pp.gross_minor_units, 'gross_minor_units', rejected_inputs);
  const deductionsIn = arr(pp.legally_required_deductions);
  const deductions = deductionsIn.map((raw, i) => {
    const d = obj(raw);
    return {
      label: str(d.label, `DEDUCTION-${i + 1}`),
      amount_minor_units: toMinorUnits(d.amount_minor_units, `legally_required_deductions[${i}].amount_minor_units`, rejected_inputs),
    };
  });
  let total_deductions_minor_units = 0;
  for (const d of deductions) total_deductions_minor_units += d.amount_minor_units;

  const disposable_raw_minor_units = gross_minor_units - total_deductions_minor_units;
  const disposable_negative = disposable_raw_minor_units < 0;
  if (disposable_negative) {
    rejected_inputs.push({ where: 'disposable_earnings', reason: 'legally-required deductions exceed gross earnings; disposable earnings floored at zero', supplied: disposable_raw_minor_units });
  }
  const disposable_earnings_minor_units = disposable_negative ? 0 : disposable_raw_minor_units;

  const fedMinWageSupplied = pp.federal_minimum_wage_minor_units !== undefined && pp.federal_minimum_wage_minor_units !== null;
  const federal_minimum_wage_minor_units = fedMinWageSupplied
    ? toMinorUnits(pp.federal_minimum_wage_minor_units, 'federal_minimum_wage_minor_units', rejected_inputs)
    : FEDERAL_MINIMUM_WAGE_CENTS_PREFILL;
  const federal_minimum_wage_source = fedMinWageSupplied
    ? { kind: 'caller_override', dated: str(pp.federal_minimum_wage_dated, 'UNSTATED') }
    : { kind: 'dated_prefill', dated: FEDERAL_MINIMUM_WAGE_PREFILL_DATED };
  const ccpa_floor_minor_units = 30 * federal_minimum_wage_minor_units;

  const state_overlay = obj(pp.state_overlay);

  const ordersIn = arr(pp.orders);
  const orders = [];
  for (let i = 0; i < ordersIn.length; i++) {
    const o = obj(ordersIn[i]);
    const order_id = str(o.order_id, `ORDER-${i + 1}`);
    const typeSupplied = str(o.type, '');
    const type = ORDER_TYPES.indexOf(typeSupplied) !== -1 ? typeSupplied : null;
    if (type === null) {
      rejected_inputs.push({
        where: `orders[${i}].type`,
        reason: typeSupplied === '' ? 'absent' : 'not one of child_support, federal_tax_levy, state_levy, hea_awg, creditor, other',
        supplied: typeSupplied === '' ? null : typeSupplied,
      });
    }
    const claimed_amount_minor_units = toMinorUnits(o.claimed_amount_minor_units, `orders[${i}].claimed_amount_minor_units`, rejected_inputs);
    orders.push({
      order_id,
      label: str(o.label, order_id),
      type,
      arrears_over_12wk: type === 'child_support' ? o.arrears_over_12wk === true : null,
      second_family: type === 'child_support' ? o.second_family === true : null,
      claimed_amount_minor_units,
    });
  }

  // ── Per-order statutory caps and the stack's aggregate ceiling. ────────────
  let aggregate_cap_minor_units = 0;
  const capped = orders.map((o, i) => {
    if (o.type === null) return { ...o, cap_minor_units: 0, cap_basis: 'Unrecognised order type; treated as zero cap.', ccpa_capped: true };
    const c = capForOrder(o, disposable_earnings_minor_units, ccpa_floor_minor_units, state_overlay, rejected_inputs, i);
    if (c.cap_minor_units > aggregate_cap_minor_units) aggregate_cap_minor_units = c.cap_minor_units;
    return { ...o, ...c };
  });

  // ── Withhold in the priority order supplied, honouring each order's own
  //    cap AND the stack's aggregate ceiling. ─────────────────────────────────
  let remaining_disposable = disposable_earnings_minor_units;
  let remaining_aggregate = aggregate_cap_minor_units;
  let first_uncapped_shortfall = null;
  const withheld_orders = capped.map((o) => {
    const order_cap = o.cap_minor_units > 0 ? o.cap_minor_units : 0;
    const claim = o.claimed_amount_minor_units > 0 ? o.claimed_amount_minor_units : 0;
    const allowedByOrder = Math.min(claim, order_cap);
    const allowedByStack = Math.min(allowedByOrder, remaining_disposable, remaining_aggregate);
    const withheld_minor_units = allowedByStack > 0 ? allowedByStack : 0;
    const shortfall_minor_units = claim - withheld_minor_units;
    remaining_disposable -= withheld_minor_units;
    remaining_aggregate -= withheld_minor_units;
    if (first_uncapped_shortfall === null && shortfall_minor_units > 0) first_uncapped_shortfall = o.order_id;
    return {
      order_id: o.order_id,
      label: o.label,
      type: o.type,
      arrears_over_12wk: o.arrears_over_12wk,
      second_family: o.second_family,
      claimed_amount_minor_units: o.claimed_amount_minor_units,
      claimed_display: display(o.claimed_amount_minor_units),
      cap_minor_units: o.cap_minor_units,
      cap_display: display(o.cap_minor_units),
      cap_basis: o.cap_basis,
      ccpa_capped: o.ccpa_capped,
      withheld_minor_units,
      withheld_display: display(withheld_minor_units),
      shortfall_minor_units: shortfall_minor_units > 0 ? shortfall_minor_units : 0,
      shortfall_display: display(shortfall_minor_units > 0 ? shortfall_minor_units : 0),
      fully_withheld: shortfall_minor_units <= 0,
    };
  });

  let total_withheld_minor_units = 0;
  for (const o of withheld_orders) total_withheld_minor_units += o.withheld_minor_units;
  const employee_net_minor_units = disposable_earnings_minor_units - total_withheld_minor_units;

  // ── Verify mode: diff against noticed withholding amounts, where supplied. ─
  const noticedSupplied = pp.noticed_amounts !== undefined && pp.noticed_amounts !== null && arr(pp.noticed_amounts).length > 0;
  const diff = [];
  if (noticedSupplied) {
    const noticedRows = arr(pp.noticed_amounts);
    const seen = [];
    for (let i = 0; i < noticedRows.length; i++) {
      const r = obj(noticedRows[i]);
      const order_id = str(r.order_id, `NOTICED-${i + 1}`);
      seen.push(order_id);
      const noticed_minor_units = toMinorUnits(r.amount_minor_units, `noticed_amounts[${i}].amount_minor_units`, rejected_inputs);
      const match = withheld_orders.filter((o) => o.order_id === order_id)[0];
      if (match === undefined) {
        diff.push({
          order_id, in_order_stack: false,
          recomputed_minor_units: null, recomputed_display: null,
          noticed_minor_units, noticed_display: display(noticed_minor_units),
          difference_minor_units: null, difference_display: null, agrees: false,
          detail: 'The notice names an order that is not in the order stack supplied. It is carried here rather than dropped; the stack may be incomplete.',
        });
      } else {
        const difference_minor_units = match.withheld_minor_units - noticed_minor_units;
        diff.push({
          order_id, in_order_stack: true,
          recomputed_minor_units: match.withheld_minor_units, recomputed_display: match.withheld_display,
          noticed_minor_units, noticed_display: display(noticed_minor_units),
          difference_minor_units, difference_display: display(difference_minor_units),
          agrees: difference_minor_units === 0,
          detail: difference_minor_units === 0
            ? 'The independently recomputed withholding equals the amount the notice states for this order.'
            : 'The independently recomputed withholding differs from the amount the notice states for this order.',
        });
      }
    }
    for (const o of withheld_orders) {
      if (seen.indexOf(o.order_id) === -1) {
        diff.push({
          order_id: o.order_id, in_order_stack: true,
          recomputed_minor_units: o.withheld_minor_units, recomputed_display: o.withheld_display,
          noticed_minor_units: null, noticed_display: null,
          difference_minor_units: null, difference_display: null, agrees: false,
          detail: 'The order stack has this order but the notice names no figure for it, so there is nothing to compare against.',
        });
      }
    }
  }
  const disagreeing = diff.filter((d) => !d.agrees);

  // ── Verdict. INDETERMINATE takes priority over MATCHES/DIVERGES whenever a
  //    required input is absent -- never guessed, never defaulted. ───────────
  let verdict;
  let indeterminate_reason;
  if (orders.length === 0) {
    verdict = 'INDETERMINATE';
    indeterminate_reason = 'No garnishment orders were supplied, so no stack could be recomputed.';
  } else if (disposable_earnings_minor_units === 0 && !disposable_negative && gross_minor_units === 0) {
    verdict = 'INDETERMINATE';
    indeterminate_reason = 'No gross earnings were supplied, so disposable earnings could not be established.';
  } else if (!noticedSupplied) {
    verdict = 'INDETERMINATE';
    indeterminate_reason = 'No noticed withholding amounts were supplied, so the recomputed stack has nothing to compare against.';
  } else {
    verdict = disagreeing.length === 0 ? 'MATCHES' : 'DIVERGES';
    indeterminate_reason = null;
  }

  // ── Rationale. ───────────────────────────────────────────────────────────
  const rationale = [];
  rationale.push(`Garnishment stack recomputed for period ${period_label} on employee reference ${employee_ref}.`);
  rationale.push(`Disposable earnings of ${display(disposable_earnings_minor_units)} ${currency} were derived from gross earnings of ${display(gross_minor_units)} ${currency} less ${display(total_deductions_minor_units)} ${currency} of legally-required deductions.`);
  if (disposable_negative) {
    rationale.push('Legally-required deductions exceeded gross earnings; disposable earnings were floored at zero rather than allowed to go negative.');
  }
  rationale.push(`The federal minimum wage figure used was ${display(federal_minimum_wage_minor_units)} ${currency}/hour (${federal_minimum_wage_source.kind === 'dated_prefill' ? `a dated prefill from ${federal_minimum_wage_source.dated}` : `a caller override dated ${federal_minimum_wage_source.dated}`}), giving a 30x weekly floor of ${display(ccpa_floor_minor_units)} ${currency}.`);
  rationale.push(`${orders.length} order${orders.length === 1 ? '' : 's'} were withheld in the priority order supplied, subject to each order's own statutory cap and an aggregate ceiling of ${display(aggregate_cap_minor_units)} ${currency} (the single highest individual cap present in the stack).`);
  rationale.push(first_uncapped_shortfall === null
    ? 'Every order was withheld in full against its own claimed amount, subject to its statutory cap.'
    : `The stack ran out of capacity at order ${first_uncapped_shortfall}, the first order whose claimed amount could not be withheld in full within its cap and the remaining disposable earnings and aggregate ceiling.`);
  rationale.push(`Total withheld across the stack is ${display(total_withheld_minor_units)} ${currency}, leaving the employee ${display(employee_net_minor_units)} ${currency} of disposable earnings for the period.`);
  rationale.push(verdict === 'INDETERMINATE'
    ? `Verdict is INDETERMINATE: ${indeterminate_reason}`
    : verdict === 'MATCHES'
      ? `The independently recomputed withholding agrees with every one of the ${diff.length} order${diff.length === 1 ? '' : 's'} the notice states a figure for. The left-hand side was computed here from the order stack, not lifted from the notice.`
      : `The independently recomputed withholding diverges from the notice on ${disagreeing.length} of ${diff.length} order${diff.length === 1 ? '' : 's'}. Each difference is listed with both figures. A divergence is an arithmetic finding about the order stack and figures supplied here, not a legal determination.`);
  if (rejected_inputs.length > 0) {
    rationale.push(`${rejected_inputs.length} supplied value${rejected_inputs.length === 1 ? ' was' : 's were'} not usable and ${rejected_inputs.length === 1 ? 'was' : 'were'} treated as zero, ignored, or defaulted. Each one is named in rejected_inputs rather than silently dropped.`);
  }
  rationale.push('This is not legal advice. The statutory caps modelled here (CCPA support tiers, the general CCPA cap, the HEA AWG cap, and the federal-tax-levy CCPA exemption) are a simplification of a fact-specific area of law; a state\'s own wage-garnishment statute, a court\'s instructions, or counsel govern over this arithmetic.');

  // ── Flags. ───────────────────────────────────────────────────────────────
  const compliance_flags = ['GARNISH_STACK_RECOMPUTED'];
  compliance_flags.push(verdict === 'INDETERMINATE' ? 'GARNISH_STACK_INDETERMINATE' : verdict === 'MATCHES' ? 'GARNISH_STACK_MATCHES' : 'GARNISH_STACK_DIVERGES');
  if (first_uncapped_shortfall !== null) compliance_flags.push('GARNISH_STACK_SHORTFALL');
  if (verdict === 'DIVERGES') compliance_flags.push('ESCALATION_RAISED');
  if (disposable_negative) compliance_flags.push('GARNISH_DISPOSABLE_NEGATIVE');
  if (orders.length === 0) compliance_flags.push('GARNISH_ORDER_STACK_EMPTY');
  if (orders.some((o) => o.type === 'federal_tax_levy')) compliance_flags.push('GARNISH_TAX_LEVY_NOT_CCPA_CAPPED');
  if (orders.some((o) => o.type === 'state_levy') && (state_overlay.state_levy_cap_percent === undefined || state_overlay.state_levy_cap_percent === null)) compliance_flags.push('GARNISH_STATE_LEVY_DEFAULTED_TO_CCPA');
  if (rejected_inputs.length > 0) compliance_flags.push('GARNISH_STACK_INPUTS_REJECTED');

  const output_payload = {
    employee_ref,
    period_label,
    currency,
    minor_unit_exponent: MINOR_UNIT_EXPONENT,
    gross_minor_units,
    gross_display: display(gross_minor_units),
    legally_required_deductions: deductions.map((d) => ({ label: d.label, amount_minor_units: d.amount_minor_units, amount_display: display(d.amount_minor_units) })),
    total_deductions_minor_units,
    total_deductions_display: display(total_deductions_minor_units),
    disposable_earnings_minor_units,
    disposable_earnings_display: display(disposable_earnings_minor_units),
    disposable_earnings_floored_at_zero: disposable_negative,
    federal_minimum_wage_minor_units,
    federal_minimum_wage_display: display(federal_minimum_wage_minor_units),
    federal_minimum_wage_source,
    ccpa_floor_minor_units,
    ccpa_floor_display: display(ccpa_floor_minor_units),
    state_overlay,
    order_count: orders.length,
    aggregate_cap_minor_units,
    aggregate_cap_display: display(aggregate_cap_minor_units),
    orders: withheld_orders,
    first_uncapped_shortfall,
    total_withheld_minor_units,
    total_withheld_display: display(total_withheld_minor_units),
    employee_net_minor_units,
    employee_net_display: display(employee_net_minor_units),
    noticed_supplied: noticedSupplied,
    comparison_basis: 'The recomputed side of every comparison is derived here from disposable earnings and the caller-declared order stack, allocated in the order the orders[] array was supplied. It is not read from a garnishment notice. A comparison is only meaningful because the two sides have independent provenance.',
    diff,
    verdict,
    indeterminate_reason,
    rejected_inputs,
    citations: CITATIONS,
    rationale,
    not_proven: NOT_PROVEN,
    fence: 'This is not legal advice. Orders are withheld in the priority order the caller supplies, subject to each order\'s own statutory cap and an aggregate ceiling equal to the single highest individual cap present in the stack. A federal tax levy is capped only at remaining disposable earnings, not the IRS exempt-amount table. A state levy uses a caller-declared percentage where supplied, otherwise the general CCPA cap. No 50-state table is bundled. A divergence against a supplied notice is an arithmetic finding about the figures supplied here, never a legal determination.',
    note: 'Deterministic multi-garnishment stacking recomputation for one stated pay period. Single-run and stateless: it holds no records, runs on no schedule, and retains nothing. It performs no payroll processing and makes no assertion that any order is valid, enforceable, or correctly served.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
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
