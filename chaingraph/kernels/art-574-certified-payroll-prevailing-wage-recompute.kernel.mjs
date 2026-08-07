/**
 * art-574-certified-payroll-prevailing-wage-recompute.kernel.mjs
 *
 * RECOMP wave (RECOMP-WAVE-BUILD-SPEC.md §9, RECOMP-PWA-1) — recomputes, for
 * one stated payroll week, whether each worker on a caller-declared payroll
 * was paid at or above the wage-determination (WD) rate for their
 * classification, with Contract Work Hours and Safety Standards Act
 * (CWHSSA) overtime applied, then (optionally) compares the recomputed
 * figures against a submitted certified payroll and, in PWA mode, computes
 * the IRC Sec. 45(b)(7)-(8) correction payment and penalty for any
 * deficiency found.
 *
 * DUAL AUDIENCE. A prime contractor verifying a subcontractor's weekly
 * certified payroll, and a Sec. 6418 credit-transferee or tax-equity
 * investor diligencing a developer's prevailing-wage math before purchasing
 * transferred credits, run the identical arithmetic. Neither side is
 * privileged in the kernel.
 *
 * WHY THIS IS AN INDEPENDENT RECOMPUTATION. The recomputed required and
 * paid wages for every worker are derived HERE from the wage determination,
 * the worker's declared straight-time/overtime hours, and the rate/fringe
 * actually declared as paid. Nothing is lifted from a submitted certified
 * payroll; a difference against a submitted payroll is therefore a genuine
 * arithmetic finding, not a re-footing of a published figure.
 *
 * RATE COMPLIANCE (Davis-Bacon Act, 40 U.S.C. Sec. 3141 ff.; 29 CFR Part 5).
 * For each classification, the combined required rate is the wage
 * determination's base rate plus its fringe rate. A worker's combined paid
 * rate is their declared hourly base rate paid plus hourly fringe paid
 * (cash or bona-fide plan, not distinguished here -- see not_proven).
 * Combined paid rate must be >= combined required rate for every hour.
 *
 * CWHSSA OVERTIME (40 U.S.C. Sec. 3701 ff.; 29 CFR Part 5 contract clauses).
 * This kernel models the general Davis-Bacon/CWHSSA convention that the
 * time-and-a-half overtime premium applies to the BASIC HOURLY RATE only,
 * not to the fringe-benefit rate, which is due straight-time for every hour
 * worked. Required weekly gross = (ST hours x WD base) + (OT hours x WD
 * base x 1.5) + ((ST+OT hours) x WD fringe). Paid weekly gross mirrors the
 * same shape using the declared paid base and fringe rates. This is a
 * simplification of a fact-specific area (fringe-in-lieu-of-benefits
 * treatment, split-shift rules) and is named in not_proven.
 *
 * APPRENTICE RATIO (declared parameter, no bundled table). If an
 * apprentice_program is declared, the permitted apprentice count is
 * floor(actual_journeyman_count x permitted_ratio_per_journeyman). Excess
 * apprentices over that count are flagged; this kernel does NOT reassign
 * their hours to the journeyman rate (out of scope, named in not_proven).
 *
 * PWA MODE -- IRC Sec. 45(b)(7)-(8) CORRECTION AND PENALTY (re-verified
 * against primary text at build: IRC Sec. 45(b)(7)(B), 26 CFR Sec. 1.45-7,
 * The Tax Adviser Dec. 2024 summary of the final regs). For each worker
 * with a deficiency this period: the wage-differential component of the
 * correction is the deficiency itself, TRIPLED if intentional_disregard is
 * declared true (Sec. 45(b)(7)(B)(i)(I), x3 on intentional disregard).
 * Interest accrues on the (untripled) deficiency at the Sec. 6621
 * underpayment rate with 6 percentage points substituted for 3 (Sec.
 * 45(b)(7)(B)(i)(II)), applied here as simple interest over the
 * caller-declared number of underpayment days -- a simplification of
 * Sec. 6621's daily-compounding convention, named in not_proven. The
 * penalty is $5,000 per worker with a deficiency this period ($10,000 if
 * intentional_disregard is declared true), per Sec. 45(b)(7)(B)(i)(II)/(iii).
 * ⛔ Because this kernel is single-run and stateless, the penalty computed
 * here covers only the ONE stated period -- the statute aggregates by
 * calendar year across every period, and deduplicating a worker who
 * recurs across periods in the same year is the caller's responsibility
 * (named in not_proven).
 *
 * ⛔ WH-347 FORM SUNSET DATE DELIBERATELY NOT ENCODED. Research turned up
 * conflicting OMB-expiration dates for WH-347 (OMB Control No. 1235-0008)
 * across secondary sources; per the build spec this kernel omits any
 * specific expiration date rather than encode an unverified one. A reader
 * checking current WH-347 validity should consult dol.gov/agencies/whd/forms/wh347
 * directly.
 *
 * VERIFY MODE / INDETERMINATE (Common wave doctrine): the comparison
 * verdict is INDETERMINATE whenever the wage determination is empty, the
 * payroll is empty, a payroll row's classification is not found in the
 * wage determination, or no submitted_payroll was supplied to diff
 * against -- never guessed toward MATCHES.
 *
 * FIXED-POINT MONEY MATH. Every amount crosses the boundary as an INTEGER
 * NUMBER OF MINOR UNITS (cents). 2dp display strings come from integer
 * division plus string padding, never toFixed() on a float.
 *
 * FINITE GATE. An empty wage determination, an empty payroll, a payroll row
 * naming a classification absent from the wage determination, and zero
 * hours all resolve to a DEFINED result. No branch emits NaN, Infinity, or
 * an undefined state. A value that is not a usable integer is coerced to 0
 * AND named in rejected_inputs[], never silently dropped.
 *
 * THIS IS NOT TAX OR LEGAL ADVICE and is not a substitute for counsel, a
 * CPA, the Department of Labor, or the IRS. It is a wage/hour and Sec. 45
 * correction-arithmetic engine over caller-declared facts about one payroll
 * week. No debarment or 18 U.S.C. Sec. 1001 scare copy is stated; only the
 * cited text's own consequences are named.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: RECOMP-WAVE-BUILD-SPEC.md §9, §Common.
 * (comment-only retrigger: no functional change)
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-574-certified-payroll-prevailing-wage-recompute';
const TOOL_VERSION = '1.0.0';
export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'recompute_certified_payroll_pwa',
  mandate_type: 'analytics_mandate',
  gpu: false,
};

const CITATIONS = {
  davis_bacon_act: {
    source: '40 U.S.C. Sec. 3141 ff. (Davis-Bacon Act); 29 CFR Part 5',
    detail: 'Requires laborers and mechanics on covered federal construction contracts to be paid not less than the wage determination rate (base plus fringe) for their classification.',
  },
  cwhssa: {
    source: '40 U.S.C. Sec. 3701 ff. (Contract Work Hours and Safety Standards Act); 29 CFR Part 5 contract clauses',
    detail: 'Requires time-and-a-half overtime pay after 40 hours in a week. This kernel applies the premium to the basic hourly rate only, with fringe due straight-time for every hour -- the general convention, not an exhaustive rule for every fringe arrangement.',
  },
  irc_45b7_correction: {
    source: 'IRC Sec. 45(b)(7)(B)(i)(I); 26 CFR Sec. 1.45-7',
    detail: 'Correction payment = the wage deficiency (tripled on intentional disregard) plus interest at the Sec. 6621 underpayment rate with 6 percentage points substituted for 3. Re-verify against primary text before relying on it (research findings, not facts).',
  },
  irc_45b7_penalty: {
    source: 'IRC Sec. 45(b)(7)(B)(i)(II)/(iii); 26 CFR Sec. 1.45-7',
    detail: 'Penalty of $5,000 per laborer or mechanic paid below the prevailing wage for any period during the year ($10,000 on intentional disregard). This kernel computes the penalty for the ONE stated period only; annual aggregation and deduplication across periods is the caller’s responsibility.',
  },
  wh347: {
    source: 'DOL Form WH-347 (OMB Control No. 1235-0008)',
    detail: 'Certified payroll form referenced for the shape of a submitted-payroll comparison. No expiration/sunset date is encoded here -- verify current validity at dol.gov/agencies/whd/forms/wh347.',
  },
};

const NOT_PROVEN = [
  { item: 'Not tax or legal advice', detail: 'This kernel recomputes wage/hour and IRC Sec. 45 correction arithmetic from caller-declared facts about one payroll week. It is not a substitute for counsel, a CPA, the Department of Labor, or the IRS.' },
  { item: 'Wage determination match', detail: 'The wage determination rows and each payroll row’s classification are caller-declared and are not independently verified against the governing WD published for the project’s locality.' },
  { item: 'CWHSSA overtime convention', detail: 'Overtime premium is modelled on the basic hourly rate only, with fringe due straight-time for every hour. Fringe-in-lieu-of-benefits arrangements and split-shift rules are not modelled.' },
  { item: 'Apprentice ratio recompute', detail: 'An excess-apprentice count is flagged, but this kernel does not reassign excess apprentice hours to the journeyman rate or verify the declared ratio against the governing apprenticeship program.' },
  { item: 'Sec. 6621 interest approximation', detail: 'Interest on a deficiency is computed as simple interest over the caller-declared number of underpayment days at the declared annual rate, not the daily-compounding convention Sec. 6621 actually uses.' },
  { item: 'Annual penalty aggregation', detail: 'The Sec. 45(b)(7)(B) penalty aggregates by calendar year across every payroll period. This kernel is single-run and stateless and computes the penalty for the ONE stated period only; deduplicating a worker who recurs across periods in the same year is the caller’s responsibility.' },
  { item: 'WH-347 form currency', detail: 'No WH-347 OMB expiration/sunset date is encoded. Verify current form validity directly at dol.gov/agencies/whd/forms/wh347.' },
  { item: 'Input accuracy', detail: 'Hours, rates, fringe, and every submitted-payroll figure are caller-supplied and asserted, not independently verified against timecards or payroll records.' },
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
function toHours(v, where, rejected) {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
  if (v === undefined || v === null || v === '') { rejected.push({ where, reason: 'absent', supplied: null }); return 0; }
  rejected.push({ where, reason: 'expected a non-negative number of hours', supplied: typeof v === 'number' ? v : String(v) });
  return 0;
}
function display(minor) {
  const neg = minor < 0;
  const abs = neg ? -minor : minor;
  const whole = Math.trunc(abs / MINOR_SCALE);
  const frac = Math.round(abs - whole * MINOR_SCALE);
  return (neg ? '-' : '') + String(whole) + '.' + String(frac).padStart(MINOR_UNIT_EXPONENT, '0');
}
function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function str(v, fallback) { return isNonEmptyString(v) ? v.trim() : fallback; }
function arr(v) { return Array.isArray(v) ? v : []; }
function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  const project_ref = str(pp.project_ref, 'UNSTATED');
  const week_ending_label = str(pp.week_ending_label, 'UNSTATED');
  const currency = isNonEmptyString(pp.currency) ? pp.currency.trim().toUpperCase() : 'USD';
  const pwa_mode = pp.pwa_mode === true;
  const intentional_disregard = pwa_mode && pp.intentional_disregard === true;

  // ── Wage determination lookup table. ────────────────────────────────────
  const wdRowsIn = arr(pp.wage_determination);
  const wdByClass = {};
  const wage_determination = wdRowsIn.map((raw, i) => {
    const w = obj(raw);
    const classification = str(w.classification, `CLASS-${i + 1}`);
    const base_rate_minor_units = toMinorUnits(w.base_rate_minor_units, `wage_determination[${i}].base_rate_minor_units`, rejected_inputs);
    const fringe_rate_minor_units = toMinorUnits(w.fringe_rate_minor_units, `wage_determination[${i}].fringe_rate_minor_units`, rejected_inputs);
    const row = { classification, base_rate_minor_units, fringe_rate_minor_units, combined_rate_minor_units: base_rate_minor_units + fringe_rate_minor_units };
    wdByClass[classification] = row;
    return row;
  });

  // ── Payroll rows, recomputed against the wage determination. ───────────
  const payrollIn = arr(pp.payroll_rows);
  const payroll_rows = payrollIn.map((raw, i) => {
    const r = obj(raw);
    const worker_id = str(r.worker_id, `WORKER-${i + 1}`);
    const classification = str(r.classification, '');
    const st_hours = toHours(r.st_hours, `payroll_rows[${i}].st_hours`, rejected_inputs);
    const ot_hours = toHours(r.ot_hours, `payroll_rows[${i}].ot_hours`, rejected_inputs);
    const rate_paid_minor_units = toMinorUnits(r.rate_paid_minor_units, `payroll_rows[${i}].rate_paid_minor_units`, rejected_inputs);
    const fringe_paid_minor_units = toMinorUnits(r.fringe_paid_minor_units, `payroll_rows[${i}].fringe_paid_minor_units`, rejected_inputs);
    const combined_paid_rate_minor_units = rate_paid_minor_units + fringe_paid_minor_units;

    const wd = classification !== '' ? wdByClass[classification] : undefined;
    const wd_found = wd !== undefined;
    if (!wd_found) {
      rejected_inputs.push({ where: `payroll_rows[${i}].classification`, reason: classification === '' ? 'absent' : 'not found in the supplied wage determination', supplied: classification === '' ? null : classification });
    }

    let required_gross_minor_units = null;
    let paid_gross_minor_units = null;
    let deficiency_minor_units = null;
    let rate_meets_wd = null;

    if (wd_found) {
      required_gross_minor_units = st_hours * wd.base_rate_minor_units
        + ot_hours * wd.base_rate_minor_units * 1.5
        + (st_hours + ot_hours) * wd.fringe_rate_minor_units;
      required_gross_minor_units = Math.round(required_gross_minor_units);
      paid_gross_minor_units = st_hours * rate_paid_minor_units
        + ot_hours * rate_paid_minor_units * 1.5
        + (st_hours + ot_hours) * fringe_paid_minor_units;
      paid_gross_minor_units = Math.round(paid_gross_minor_units);
      deficiency_minor_units = Math.max(required_gross_minor_units - paid_gross_minor_units, 0);
      rate_meets_wd = combined_paid_rate_minor_units >= wd.combined_rate_minor_units;
    }

    return {
      worker_id, classification: classification === '' ? null : classification, wd_found,
      st_hours, ot_hours,
      rate_paid_minor_units, rate_paid_display: display(rate_paid_minor_units),
      fringe_paid_minor_units, fringe_paid_display: display(fringe_paid_minor_units),
      combined_paid_rate_minor_units, combined_paid_rate_display: display(combined_paid_rate_minor_units),
      wd_combined_rate_minor_units: wd_found ? wd.combined_rate_minor_units : null,
      wd_combined_rate_display: wd_found ? display(wd.combined_rate_minor_units) : null,
      rate_meets_wd,
      required_gross_minor_units, required_gross_display: required_gross_minor_units === null ? null : display(required_gross_minor_units),
      paid_gross_minor_units, paid_gross_display: paid_gross_minor_units === null ? null : display(paid_gross_minor_units),
      deficiency_minor_units, deficiency_display: deficiency_minor_units === null ? null : display(deficiency_minor_units),
    };
  });

  const deficient_rows = payroll_rows.filter((r) => r.wd_found && r.deficiency_minor_units > 0);
  const any_wd_unresolved = payroll_rows.some((r) => !r.wd_found);
  let total_deficiency_minor_units = 0;
  for (const r of deficient_rows) total_deficiency_minor_units += r.deficiency_minor_units;

  // ── Apprentice ratio (declared parameters only, no bundled table). ─────
  const apprenticeIn = pp.apprentice_program !== undefined && pp.apprentice_program !== null ? obj(pp.apprentice_program) : null;
  let apprentice_check = null;
  if (apprenticeIn !== null) {
    const permitted_ratio_per_journeyman = typeof apprenticeIn.permitted_ratio_per_journeyman === 'number' && Number.isFinite(apprenticeIn.permitted_ratio_per_journeyman) ? apprenticeIn.permitted_ratio_per_journeyman : 0;
    const actual_journeyman_count = typeof apprenticeIn.actual_journeyman_count === 'number' && Number.isFinite(apprenticeIn.actual_journeyman_count) ? apprenticeIn.actual_journeyman_count : 0;
    const actual_apprentice_count = typeof apprenticeIn.actual_apprentice_count === 'number' && Number.isFinite(apprenticeIn.actual_apprentice_count) ? apprenticeIn.actual_apprentice_count : 0;
    const permitted_apprentice_count = Math.floor(actual_journeyman_count * permitted_ratio_per_journeyman);
    const excess_apprentice_count = Math.max(actual_apprentice_count - permitted_apprentice_count, 0);
    apprentice_check = {
      permitted_ratio_per_journeyman, actual_journeyman_count, actual_apprentice_count,
      permitted_apprentice_count, excess_apprentice_count,
      ratio_exceeded: excess_apprentice_count > 0,
    };
  }

  // ── PWA mode: IRC Sec. 45(b)(7)-(8) correction and penalty. ────────────
  let pwa_result = null;
  if (pwa_mode) {
    const rateSupplied = typeof pp.irc_6621_underpayment_rate_percent === 'number' && Number.isFinite(pp.irc_6621_underpayment_rate_percent);
    const daysSupplied = typeof pp.underpayment_days === 'number' && Number.isFinite(pp.underpayment_days) && pp.underpayment_days >= 0;
    if (deficient_rows.length > 0 && (!rateSupplied || !daysSupplied)) {
      rejected_inputs.push({ where: 'irc_6621_underpayment_rate_percent / underpayment_days', reason: 'deficiencies were found but one or both interest inputs were absent; correction interest could not be computed', supplied: null });
    }
    const rate_percent = rateSupplied ? pp.irc_6621_underpayment_rate_percent : null;
    const underpayment_days = daysSupplied ? pp.underpayment_days : null;
    const can_compute_interest = rateSupplied && daysSupplied;

    const worker_corrections = deficient_rows.map((r) => {
      const wage_component_minor_units = intentional_disregard ? r.deficiency_minor_units * 3 : r.deficiency_minor_units;
      const interest_minor_units = can_compute_interest
        ? Math.round(r.deficiency_minor_units * (rate_percent / 100) * (underpayment_days / 365))
        : null;
      const correction_payment_minor_units = interest_minor_units === null ? null : wage_component_minor_units + interest_minor_units;
      return {
        worker_id: r.worker_id, classification: r.classification,
        deficiency_minor_units: r.deficiency_minor_units, deficiency_display: r.deficiency_display,
        wage_component_minor_units, wage_component_display: display(wage_component_minor_units),
        interest_minor_units, interest_display: interest_minor_units === null ? null : display(interest_minor_units),
        correction_payment_minor_units, correction_payment_display: correction_payment_minor_units === null ? null : display(correction_payment_minor_units),
      };
    });
    let total_correction_payment_minor_units = 0;
    let correction_computable = can_compute_interest;
    for (const w of worker_corrections) {
      if (w.correction_payment_minor_units === null) { correction_computable = false; continue; }
      total_correction_payment_minor_units += w.correction_payment_minor_units;
    }

    const per_worker_penalty_minor_units = intentional_disregard ? 1000000 : 500000; // $10,000 / $5,000
    const penalty_worker_count = deficient_rows.length;
    const total_penalty_minor_units = per_worker_penalty_minor_units * penalty_worker_count;

    pwa_result = {
      intentional_disregard,
      irc_6621_underpayment_rate_percent: rate_percent,
      underpayment_days,
      deficient_worker_count: deficient_rows.length,
      worker_corrections,
      correction_computable: deficient_rows.length === 0 ? true : correction_computable,
      total_correction_payment_minor_units: correction_computable ? total_correction_payment_minor_units : null,
      total_correction_payment_display: correction_computable ? display(total_correction_payment_minor_units) : null,
      per_worker_penalty_minor_units,
      per_worker_penalty_display: display(per_worker_penalty_minor_units),
      penalty_worker_count,
      total_penalty_minor_units,
      total_penalty_display: display(total_penalty_minor_units),
      penalty_scope: 'This penalty is computed for the ONE stated payroll period only. The statute aggregates by calendar year across every period; deduplicating a worker who recurs across periods in the same year is the caller’s responsibility.',
    };
  }

  // ── Diff vs a submitted certified payroll (WH-347-style), where supplied.
  const submittedSupplied = pp.submitted_payroll !== undefined && pp.submitted_payroll !== null && arr(pp.submitted_payroll).length > 0;
  const diff = [];
  if (submittedSupplied) {
    const submittedRows = arr(pp.submitted_payroll);
    const seen = [];
    const byWorker = {};
    for (const r of payroll_rows) byWorker[r.worker_id] = r;
    for (let i = 0; i < submittedRows.length; i++) {
      const s = obj(submittedRows[i]);
      const worker_id = str(s.worker_id, `SUBMITTED-${i + 1}`);
      seen.push(worker_id);
      const submitted_gross_minor_units = toMinorUnits(s.gross_minor_units, `submitted_payroll[${i}].gross_minor_units`, rejected_inputs);
      const match = byWorker[worker_id];
      if (match === undefined) {
        diff.push({
          worker_id, in_payroll: false,
          recomputed_gross_minor_units: null, recomputed_gross_display: null,
          submitted_gross_minor_units, submitted_gross_display: display(submitted_gross_minor_units),
          difference_minor_units: null, difference_display: null, agrees: false,
          detail: 'The submitted payroll names a worker who is not in the payroll rows supplied. It is carried here rather than dropped; the payroll may be incomplete.',
        });
      } else if (!match.wd_found) {
        diff.push({
          worker_id, in_payroll: true,
          recomputed_gross_minor_units: null, recomputed_gross_display: null,
          submitted_gross_minor_units, submitted_gross_display: display(submitted_gross_minor_units),
          difference_minor_units: null, difference_display: null, agrees: false,
          detail: 'This worker’s classification was not found in the supplied wage determination, so no recomputed gross could be compared.',
        });
      } else {
        const difference_minor_units = match.required_gross_minor_units - submitted_gross_minor_units;
        diff.push({
          worker_id, in_payroll: true,
          recomputed_gross_minor_units: match.required_gross_minor_units, recomputed_gross_display: match.required_gross_display,
          submitted_gross_minor_units, submitted_gross_display: display(submitted_gross_minor_units),
          difference_minor_units, difference_display: display(difference_minor_units),
          agrees: difference_minor_units === 0,
          detail: difference_minor_units === 0
            ? 'The independently recomputed required gross equals the amount the submitted certified payroll states for this worker.'
            : 'The independently recomputed required gross differs from the amount the submitted certified payroll states for this worker.',
        });
      }
    }
    for (const r of payroll_rows) {
      if (seen.indexOf(r.worker_id) === -1) {
        diff.push({
          worker_id: r.worker_id, in_payroll: true,
          recomputed_gross_minor_units: r.required_gross_minor_units, recomputed_gross_display: r.required_gross_display,
          submitted_gross_minor_units: null, submitted_gross_display: null,
          difference_minor_units: null, difference_display: null, agrees: false,
          detail: 'This worker is in the payroll rows but the submitted certified payroll names no gross figure for them, so there is nothing to compare against.',
        });
      }
    }
  }
  const disagreeing = diff.filter((d) => !d.agrees);

  // ── Verdict. INDETERMINATE takes priority over MATCHES/DIVERGES whenever a
  //    required input is absent -- never guessed, never defaulted. ────────
  let verdict;
  let indeterminate_reason;
  if (wage_determination.length === 0) {
    verdict = 'INDETERMINATE';
    indeterminate_reason = 'No wage determination was supplied, so no required rate could be established.';
  } else if (payroll_rows.length === 0) {
    verdict = 'INDETERMINATE';
    indeterminate_reason = 'No payroll rows were supplied, so nothing could be recomputed.';
  } else if (any_wd_unresolved) {
    verdict = 'INDETERMINATE';
    indeterminate_reason = 'At least one payroll row’s classification was not found in the supplied wage determination, so the payroll could not be fully recomputed.';
  } else if (!submittedSupplied) {
    verdict = 'INDETERMINATE';
    indeterminate_reason = 'No submitted certified payroll was supplied, so the recomputed payroll has nothing to compare against.';
  } else {
    verdict = disagreeing.length === 0 ? 'MATCHES' : 'DIVERGES';
    indeterminate_reason = null;
  }

  // ── Rationale. ───────────────────────────────────────────────────────────
  const rationale = [];
  rationale.push(`Certified payroll recomputed for project reference ${project_ref}, week ending ${week_ending_label}.`);
  rationale.push(`${wage_determination.length} wage-determination classification${wage_determination.length === 1 ? '' : 's'} and ${payroll_rows.length} payroll row${payroll_rows.length === 1 ? '' : 's'} were supplied.`);
  if (any_wd_unresolved) {
    rationale.push('One or more payroll rows named a classification absent from the wage determination; those rows could not be recomputed and are listed in rejected_inputs.');
  }
  rationale.push(deficient_rows.length === 0
    ? 'No worker’s recomputed required gross exceeded the recomputed paid gross; no deficiency was found.'
    : `${deficient_rows.length} worker${deficient_rows.length === 1 ? '' : 's'} had a recomputed deficiency totalling ${display(total_deficiency_minor_units)} ${currency}, applying Davis-Bacon rate compliance and CWHSSA overtime (time-and-a-half on the basic hourly rate, fringe due straight-time).`);
  if (apprentice_check !== null) {
    rationale.push(apprentice_check.ratio_exceeded
      ? `The declared apprentice program exceeds its permitted ratio by ${apprentice_check.excess_apprentice_count} apprentice(s); excess-apprentice hours were not reassigned to the journeyman rate (out of scope).`
      : 'The declared apprentice program is within its permitted ratio.');
  }
  if (pwa_mode) {
    rationale.push(pwa_result.deficient_worker_count === 0
      ? 'PWA mode was requested but no deficiency was found, so no IRC Sec. 45(b)(7)-(8) correction or penalty applies.'
      : pwa_result.correction_computable
        ? `PWA mode computed a total correction payment of ${pwa_result.total_correction_payment_display} ${currency} and a total penalty of ${pwa_result.total_penalty_display} ${currency} across ${pwa_result.deficient_worker_count} worker(s)${intentional_disregard ? ', tripled on the declared intentional disregard' : ''}, for THIS stated period only.`
        : 'PWA mode found deficiencies but could not compute the correction interest because the Sec. 6621 rate and/or underpayment-days inputs were absent; see rejected_inputs.');
  }
  rationale.push(verdict === 'INDETERMINATE'
    ? `Verdict is INDETERMINATE: ${indeterminate_reason}`
    : verdict === 'MATCHES'
      ? `The independently recomputed required gross agrees with every one of the ${diff.length} worker${diff.length === 1 ? '' : 's'} the submitted certified payroll states a figure for. The left-hand side was computed here from the wage determination and hours, not lifted from the submission.`
      : `The independently recomputed required gross diverges from the submitted certified payroll on ${disagreeing.length} of ${diff.length} worker${diff.length === 1 ? '' : 's'}. Each difference is listed with both figures. A divergence is an arithmetic finding about the wage determination and hours supplied here, not a legal or tax determination.`);
  if (rejected_inputs.length > 0) {
    rationale.push(`${rejected_inputs.length} supplied value${rejected_inputs.length === 1 ? ' was' : 's were'} not usable and ${rejected_inputs.length === 1 ? 'was' : 'were'} treated as zero, ignored, or left uncomputed. Each one is named in rejected_inputs rather than silently dropped.`);
  }
  rationale.push('This is not tax or legal advice. WH-347 is referenced only for the shape of a submitted-payroll comparison; no form expiration/sunset date is encoded here.');

  // ── Flags. ───────────────────────────────────────────────────────────────
  const compliance_flags = ['PWA_PAYROLL_RECOMPUTED'];
  compliance_flags.push(verdict === 'INDETERMINATE' ? 'PWA_VERDICT_INDETERMINATE' : verdict === 'MATCHES' ? 'PWA_VERDICT_MATCHES' : 'PWA_VERDICT_DIVERGES');
  if (deficient_rows.length > 0) compliance_flags.push('PWA_DEFICIENCY_FOUND');
  if (verdict === 'DIVERGES') compliance_flags.push('ESCALATION_RAISED');
  if (any_wd_unresolved) compliance_flags.push('PWA_WD_CLASSIFICATION_UNRESOLVED');
  if (apprentice_check !== null && apprentice_check.ratio_exceeded) compliance_flags.push('PWA_APPRENTICE_RATIO_EXCEEDED');
  if (pwa_mode) compliance_flags.push('PWA_MODE_ENABLED');
  if (pwa_mode && intentional_disregard) compliance_flags.push('PWA_INTENTIONAL_DISREGARD');
  if (pwa_mode && pwa_result.deficient_worker_count > 0 && !pwa_result.correction_computable) compliance_flags.push('PWA_CORRECTION_INTEREST_UNCOMPUTABLE');
  if (rejected_inputs.length > 0) compliance_flags.push('PWA_INPUTS_REJECTED');

  const output_payload = {
    project_ref, week_ending_label, currency, minor_unit_exponent: MINOR_UNIT_EXPONENT,
    wage_determination,
    payroll_rows,
    deficient_worker_count: deficient_rows.length,
    total_deficiency_minor_units, total_deficiency_display: display(total_deficiency_minor_units),
    apprentice_check,
    pwa_mode, pwa_result,
    submitted_supplied: submittedSupplied,
    comparison_basis: 'The recomputed side of every comparison is derived here from the wage determination and the caller-declared payroll hours. It is not read from a submitted certified payroll. A comparison is only meaningful because the two sides have independent provenance.',
    diff,
    verdict, indeterminate_reason,
    rejected_inputs,
    citations: CITATIONS,
    rationale,
    not_proven: NOT_PROVEN,
    fence: 'This is not tax or legal advice. Rate compliance and CWHSSA overtime are recomputed from a caller-declared wage determination and payroll hours. PWA-mode correction and penalty figures follow IRC Sec. 45(b)(7)-(8) as re-verified against primary text at build, computed for the ONE stated period only -- annual aggregation across periods is the caller’s responsibility. No WH-347 expiration date is encoded. A divergence against a submitted payroll is an arithmetic finding about the figures supplied here, never a legal or tax determination.',
    note: 'Deterministic certified-payroll and prevailing-wage recomputation for one stated payroll week. Single-run and stateless: it holds no records, runs on no schedule, and retains nothing.',
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
