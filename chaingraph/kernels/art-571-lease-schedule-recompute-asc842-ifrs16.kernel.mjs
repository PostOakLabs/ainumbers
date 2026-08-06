import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-571-lease-schedule-recompute-asc842-ifrs16';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'recompute_lease_schedule_asc842_ifrs16',
  mandate_type: 'compliance_control', gpu: false,
};

// Lease schedule recompute -- ASC 842 / IFRS 16, side by side (art-571).
//
// WHAT IT DOES. Given a payment schedule and a declared discount rate, recomputes the present
// value of lease payments, the initial lease liability and right-of-use (ROU) asset, and the
// full effective-interest amortization schedule for BOTH regimes at once: ASC 842 (which draws a
// finance-vs-operating classification line and amortizes an operating-lease ROU as a plug so the
// total lease cost is straight-line) and IFRS 16 (which applies a single on-balance-sheet lessee
// model with no operating/finance distinction). Optionally diffs the ASC 842 or IFRS 16 closing
// liability at each payment date against a counterparty/preparer schedule.
//
// CLASSIFICATION INPUTS ARE DECLARED, NEVER DEFAULTED. Two of the five ASC 842 classification
// criteria -- ownership transfer and a purchase option reasonably certain of exercise -- are
// always caller-declared booleans; specialized-asset is likewise always declared. The remaining
// two (major part of remaining economic life; present value substantially all of fair value) are
// judgment calls UNLESS the caller elects the common 75%/90% bright-line convention, in which case
// they are computed. An election is always labeled as such in the output -- a computed bright-line
// result is never presented as if it were the caller's own judgment, and a caller who has not
// elected a bright-line must declare the criterion directly; it is never silently defaulted.
//
// DISCOUNT RATE IS DECLARED, NEVER DERIVED. This kernel does not infer an incremental borrowing
// rate or estimate a rate implicit in the lease -- the annual discount rate is a required input.
//
// ARITHMETIC ONLY. Every payment amount, initial direct cost, lease incentive, and preparer
// comparison balance is an integer minor unit (cents) so every operation is exact integer
// arithmetic wherever no discounting is involved; discounting itself uses IEEE-754 double
// arithmetic (ACT/365 daily compounding from the commencement date) and is deterministic --
// the same inputs always produce the same schedule.
//
// SCOPE. Performs arithmetic and a documented classification test over caller-declared lease
// terms only. It does not source a discount rate, does not determine what qualifies as a
// specialized asset, and does not reproduce FASB or IASB standard text -- citations are to
// paragraph numbers only.
//
// CLAUSE. ASC 842 (Leases), FASB ASC Topic 842, effective for public entities since fiscal years
// beginning after 2018-12-15 and all other entities since fiscal years beginning after
// 2021-12-15. IFRS 16 (Leases), effective 2019-01-01. Classification test paragraphs:
// ASC 842-10-25-2 through 25-3 (finance lease criteria); IFRS 16 does not classify lessee leases.
//
// Deterministic arithmetic only -- no clock, no randomness, no network, no PII.

const MAX_PAYMENTS = 240;
const MAX_PREPARER_ROWS = 240;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function s(v) { return String(v == null ? '' : v).trim(); }
function isDate(v) { return typeof v === 'string' && DATE_RE.test(v); }

function minorInt(v) {
  if (typeof v === 'number' && Number.isSafeInteger(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isSafeInteger(n)) return n;
  }
  return null;
}

function positiveNumber(v) {
  const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function boolOrNull(v) { return typeof v === 'boolean' ? v : null; }

function dayDiff(fromDate, toDate) {
  const a = Date.parse(fromDate + 'T00:00:00Z');
  const b = Date.parse(toDate + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

const SCOPE_NOTE = 'Performs arithmetic and a documented classification test over caller-declared lease terms, payment schedule, and discount rate only. Does not source a discount rate, does not determine what qualifies as a specialized asset, and does not reproduce ASC 842 or IFRS 16 standard text.';
const CLAUSE_NOTE = 'ASC 842 (Leases), FASB ASC Topic 842 -- classification criteria at ASC 842-10-25-2 through 25-3. IFRS 16 (Leases), effective 2019-01-01, applies a single on-balance-sheet lessee model and does not classify leases as finance or operating. Confirm the current standard text for the applicable reporting framework.';

function emptyResult(reason, rejected_inputs) {
  return {
    output_payload: {
      decision: { gate_policy: 'review_required', execution_state: 'did_not_run', reason },
      verdict: 'INDETERMINATE',
      asc842: null,
      ifrs16: null,
      elections: [],
      diff: null,
      findings: [],
      rejected_inputs,
      scope_note: SCOPE_NOTE,
      clause_note: CLAUSE_NOTE,
    },
    compliance_flags: ['LEASE_REQUIRED_INPUTS_INCOMPLETE'],
  };
}

// ACT/365 daily-compounding discount factor for a payment `days` after commencement.
function pv(amount_minor, days, annualRate) {
  const periodicRate = Math.pow(1 + annualRate, days / 365) - 1;
  return amount_minor / (1 + periodicRate);
}

function buildSchedule(payments, commencement_date, annualRate, initial_liability_minor, initial_rou_minor, term_days, mode) {
  // mode: 'finance' (ASC 842 finance, or IFRS 16) -- ROU straight-line by elapsed days.
  // mode: 'operating' (ASC 842 operating) -- total lease cost straight-line, ROU is the plug.
  const schedule = [];
  let openingLiability = initial_liability_minor;
  let prevDate = commencement_date;
  let roundedRouAllocated = 0;
  const totalPaymentsMinor = payments.reduce((acc, p) => acc + p.amount_minor, 0);
  const totalCostMinor = totalPaymentsMinor; // initial direct costs / incentives already folded into initial_rou_minor
  const dailyCost = term_days > 0 ? totalCostMinor / term_days : 0;

  for (let i = 0; i < payments.length; i++) {
    const p = payments[i];
    const periodDays = dayDiff(prevDate, p.date);
    const periodicRate = Math.pow(1 + annualRate, periodDays / 365) - 1;
    const interest_minor = Math.round(openingLiability * periodicRate);
    const principal_minor = p.amount_minor - interest_minor;
    const closing_liability_minor = openingLiability - principal_minor;

    let rou_amortization_minor;
    if (mode === 'finance') {
      const isLast = i === payments.length - 1;
      const share = term_days > 0 ? Math.round((initial_rou_minor * periodDays) / term_days) : 0;
      rou_amortization_minor = isLast ? (initial_rou_minor - roundedRouAllocated) : share;
      roundedRouAllocated += rou_amortization_minor;
    } else {
      const period_lease_cost_minor = Math.round(dailyCost * periodDays);
      rou_amortization_minor = period_lease_cost_minor - interest_minor;
    }

    const rou_opening_minor = i === 0 ? initial_rou_minor : schedule[i - 1].rou_closing_balance_minor;
    const rou_closing_balance_minor = rou_opening_minor - rou_amortization_minor;

    schedule.push({
      date: p.date,
      period_days: periodDays,
      opening_liability_minor: openingLiability,
      payment_minor: p.amount_minor,
      interest_minor,
      principal_minor,
      closing_liability_minor,
      rou_opening_minor,
      rou_amortization_minor,
      rou_closing_balance_minor,
    });

    openingLiability = closing_liability_minor;
    prevDate = p.date;
  }
  return schedule;
}

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  // -- Discount rate: declared, never derived.
  const discount_rate_annual = positiveNumber(pp.discount_rate_annual) !== null || pp.discount_rate_annual === 0
    ? (typeof pp.discount_rate_annual === 'number' ? pp.discount_rate_annual : Number(pp.discount_rate_annual))
    : null;
  const rateDeclared = pp.discount_rate_annual !== undefined && pp.discount_rate_annual !== null && pp.discount_rate_annual !== '';
  if (!rateDeclared || !Number.isFinite(discount_rate_annual) || discount_rate_annual < 0) {
    rejected_inputs.push({ where: 'discount_rate_annual', reason: 'absent or not a non-negative number -- the discount rate must be declared, never derived', supplied: rateDeclared ? pp.discount_rate_annual : null });
  }

  // -- Lease term.
  const termIn = (pp.lease_term && typeof pp.lease_term === 'object') ? pp.lease_term : {};
  const commencement_date = isDate(termIn.commencement_date) ? termIn.commencement_date : null;
  const end_date = isDate(termIn.end_date) ? termIn.end_date : null;
  if (!commencement_date) rejected_inputs.push({ where: 'lease_term.commencement_date', reason: 'absent or not YYYY-MM-DD', supplied: termIn.commencement_date === undefined ? null : s(termIn.commencement_date) });
  if (!end_date) rejected_inputs.push({ where: 'lease_term.end_date', reason: 'absent or not YYYY-MM-DD', supplied: termIn.end_date === undefined ? null : s(termIn.end_date) });
  if (commencement_date && end_date && commencement_date >= end_date) rejected_inputs.push({ where: 'lease_term', reason: 'commencement_date must be before end_date', supplied: commencement_date + '..' + end_date });
  const termValid = !!(commencement_date && end_date && commencement_date < end_date);
  const term_days = termValid ? dayDiff(commencement_date, end_date) : null;

  // -- Payment schedule.
  const paymentsIn = Array.isArray(pp.payment_schedule) ? pp.payment_schedule.slice(0, MAX_PAYMENTS) : [];
  const payments = [];
  for (let i = 0; i < paymentsIn.length; i++) {
    const row = paymentsIn[i] || {};
    const date = isDate(row.date) ? row.date : null;
    const amount_minor = minorInt(row.amount_minor);
    if (!date || amount_minor === null || amount_minor <= 0) {
      rejected_inputs.push({ where: 'payment_schedule[' + i + ']', reason: 'date must be YYYY-MM-DD and amount_minor a positive integer number of minor units', supplied: row.date === undefined ? null : s(row.date) });
      continue;
    }
    if (commencement_date && date <= commencement_date) {
      rejected_inputs.push({ where: 'payment_schedule[' + i + ']', reason: 'payment date must be after lease_term.commencement_date', supplied: date });
      continue;
    }
    payments.push({ date, amount_minor });
  }
  payments.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (paymentsIn.length > MAX_PAYMENTS) rejected_inputs.push({ where: 'payment_schedule', reason: 'more than ' + MAX_PAYMENTS + ' payments supplied', supplied: paymentsIn.length });
  if (payments.length === 0) rejected_inputs.push({ where: 'payment_schedule', reason: 'absent or empty -- at least one payment is required', supplied: null });

  // -- Initial direct costs / incentives (additive economics, not judgment-shaped -- absence is 0).
  const idcIn = pp.initial_direct_costs_minor;
  const initial_direct_costs_minor = (idcIn === undefined || idcIn === null || idcIn === '') ? 0 : minorInt(idcIn);
  if (initial_direct_costs_minor === null) rejected_inputs.push({ where: 'initial_direct_costs_minor', reason: 'not an integer number of minor units', supplied: idcIn });
  const incIn = pp.lease_incentives_minor;
  const lease_incentives_minor = (incIn === undefined || incIn === null || incIn === '') ? 0 : minorInt(incIn);
  if (lease_incentives_minor === null) rejected_inputs.push({ where: 'lease_incentives_minor', reason: 'not an integer number of minor units', supplied: incIn });

  // -- Classification inputs (ASC 842 five-criteria test).
  const ci = (pp.classification_inputs && typeof pp.classification_inputs === 'object') ? pp.classification_inputs : {};
  const ownership_transfers = boolOrNull(ci.ownership_transfers);
  if (ownership_transfers === null) rejected_inputs.push({ where: 'classification_inputs.ownership_transfers', reason: 'absent -- must be declared true/false, never defaulted', supplied: null });
  const purchase_option_reasonably_certain = boolOrNull(ci.purchase_option_reasonably_certain);
  if (purchase_option_reasonably_certain === null) rejected_inputs.push({ where: 'classification_inputs.purchase_option_reasonably_certain', reason: 'absent -- must be declared true/false, never defaulted', supplied: null });
  const specialized_asset = boolOrNull(ci.specialized_asset);
  if (specialized_asset === null) rejected_inputs.push({ where: 'classification_inputs.specialized_asset', reason: 'absent -- must be declared true/false, never defaulted', supplied: null });

  const majorPartElected = boolOrNull(ci.major_part_bright_line_elected);
  if (majorPartElected === null) rejected_inputs.push({ where: 'classification_inputs.major_part_bright_line_elected', reason: 'absent -- must be declared true/false', supplied: null });
  let major_part_met = null, major_part_source = null, economic_life_years = null, term_years = null;
  if (majorPartElected === true) {
    economic_life_years = positiveNumber(ci.economic_life_years);
    if (economic_life_years === null) rejected_inputs.push({ where: 'classification_inputs.economic_life_years', reason: 'absent or not a positive number -- required when the 75% bright line is elected', supplied: null });
    if (termValid) term_years = term_days / 365;
    if (economic_life_years !== null && term_years !== null) { major_part_met = (term_years / economic_life_years) >= 0.75; major_part_source = 'computed_75pct_bright_line'; }
  } else if (majorPartElected === false) {
    major_part_met = boolOrNull(ci.major_part_declared);
    major_part_source = 'declared_judgment';
    if (major_part_met === null) rejected_inputs.push({ where: 'classification_inputs.major_part_declared', reason: 'absent -- required judgment declaration when the 75% bright line is not elected', supplied: null });
  }

  const substAllElected = boolOrNull(ci.substantially_all_bright_line_elected);
  if (substAllElected === null) rejected_inputs.push({ where: 'classification_inputs.substantially_all_bright_line_elected', reason: 'absent -- must be declared true/false', supplied: null });
  let substantially_all_met = null, substantially_all_source = null, fair_value_minor = null;
  if (substAllElected === true) {
    fair_value_minor = minorInt(ci.fair_value_minor);
    if (fair_value_minor === null || fair_value_minor <= 0) rejected_inputs.push({ where: 'classification_inputs.fair_value_minor', reason: 'absent or not a positive integer -- required when the 90% bright line is elected', supplied: null });
  } else if (substAllElected === false) {
    substantially_all_met = boolOrNull(ci.substantially_all_declared);
    substantially_all_source = 'declared_judgment';
    if (substantially_all_met === null) rejected_inputs.push({ where: 'classification_inputs.substantially_all_declared', reason: 'absent -- required judgment declaration when the 90% bright line is not elected', supplied: null });
  }

  // -- Optional preparer diff.
  const diffRequested = pp.preparer_schedule !== undefined && pp.preparer_schedule !== null;
  let compare_regime = null, diff_tolerance_minor = null, preparerRows = [];
  if (diffRequested) {
    compare_regime = (pp.compare_regime === 'asc842' || pp.compare_regime === 'ifrs16') ? pp.compare_regime : null;
    if (!compare_regime) rejected_inputs.push({ where: 'compare_regime', reason: 'must be "asc842" or "ifrs16" when preparer_schedule is supplied', supplied: pp.compare_regime === undefined ? null : s(pp.compare_regime) });
    const tolDeclared = pp.diff_tolerance_minor !== undefined && pp.diff_tolerance_minor !== null && pp.diff_tolerance_minor !== '';
    diff_tolerance_minor = tolDeclared ? minorInt(pp.diff_tolerance_minor) : null;
    if (!tolDeclared || diff_tolerance_minor === null || diff_tolerance_minor < 0) rejected_inputs.push({ where: 'diff_tolerance_minor', reason: 'absent or not a non-negative integer -- required when preparer_schedule is supplied, never defaulted', supplied: tolDeclared ? pp.diff_tolerance_minor : null });
    const rowsIn = Array.isArray(pp.preparer_schedule) ? pp.preparer_schedule.slice(0, MAX_PREPARER_ROWS) : [];
    for (let i = 0; i < rowsIn.length; i++) {
      const row = rowsIn[i] || {};
      const date = isDate(row.date) ? row.date : null;
      const liability_balance_minor = minorInt(row.liability_balance_minor);
      if (!date || liability_balance_minor === null) { rejected_inputs.push({ where: 'preparer_schedule[' + i + ']', reason: 'date must be YYYY-MM-DD and liability_balance_minor an integer', supplied: row.date === undefined ? null : s(row.date) }); continue; }
      preparerRows.push({ date, liability_balance_minor });
    }
    if (rowsIn.length > MAX_PREPARER_ROWS) rejected_inputs.push({ where: 'preparer_schedule', reason: 'more than ' + MAX_PREPARER_ROWS + ' rows supplied', supplied: rowsIn.length });
  }

  const requiredMissing = discount_rate_annual === null || !Number.isFinite(discount_rate_annual) || discount_rate_annual < 0
    || !termValid || payments.length === 0
    || initial_direct_costs_minor === null || lease_incentives_minor === null
    || ownership_transfers === null || purchase_option_reasonably_certain === null || specialized_asset === null
    || majorPartElected === null || major_part_met === null
    || substAllElected === null || substantially_all_met === null && substAllElected === false
    || (diffRequested && (compare_regime === null || diff_tolerance_minor === null));

  // substantially-all bright-line result depends on PV, computed further below; recheck after PV if elected true.
  if (requiredMissing && !(substAllElected === true)) {
    return emptyResult('required_inputs_incomplete', rejected_inputs);
  }

  // -- Present value of payments (ACT/365, daily compounding from commencement).
  let pv_of_payments_minor = 0;
  for (const p of payments) {
    const days = dayDiff(commencement_date, p.date);
    pv_of_payments_minor += pv(p.amount_minor, days, discount_rate_annual);
  }
  pv_of_payments_minor = Math.round(pv_of_payments_minor);

  if (substAllElected === true) {
    if (fair_value_minor !== null) { substantially_all_met = (pv_of_payments_minor / fair_value_minor) >= 0.90; substantially_all_source = 'computed_90pct_bright_line'; }
    if (requiredMissing || substantially_all_met === null) {
      return emptyResult('required_inputs_incomplete', rejected_inputs);
    }
  }

  const initial_liability_minor = pv_of_payments_minor;
  const initial_rou_minor = initial_liability_minor + initial_direct_costs_minor - lease_incentives_minor;

  const classification_criteria = {
    ownership_transfers: { met: ownership_transfers, source: 'declared_judgment' },
    purchase_option_reasonably_certain: { met: purchase_option_reasonably_certain, source: 'declared_judgment' },
    major_part_of_economic_life: { met: major_part_met, source: major_part_source, economic_life_years, term_years },
    substantially_all_of_fair_value: { met: substantially_all_met, source: substantially_all_source, fair_value_minor, pv_of_payments_minor },
    specialized_asset: { met: specialized_asset, source: 'declared_judgment' },
  };
  const anyMet = ownership_transfers || purchase_option_reasonably_certain || major_part_met || substantially_all_met || specialized_asset;
  const classification = anyMet ? 'FINANCE' : 'OPERATING';

  const asc842Schedule = buildSchedule(payments, commencement_date, discount_rate_annual, initial_liability_minor, initial_rou_minor, term_days, classification === 'FINANCE' ? 'finance' : 'operating');
  const ifrs16Schedule = buildSchedule(payments, commencement_date, discount_rate_annual, initial_liability_minor, initial_rou_minor, term_days, 'finance');

  const elections = [];
  if (majorPartElected === true) elections.push('major_part_75pct_bright_line');
  if (substAllElected === true) elections.push('substantially_all_90pct_bright_line');

  const findings = [];
  if (asc842Schedule.length && Math.abs(asc842Schedule[asc842Schedule.length - 1].closing_liability_minor) > payments.length) {
    findings.push({ code: 'ASC842_LIABILITY_RESIDUAL_LARGE', severity: 'warning', message: 'ASC 842 liability does not fully amortize to zero within a residual proportional to the number of payments -- check the payment schedule against the discount rate.' });
  }

  let diff = null, verdict = 'INDETERMINATE';
  if (!diffRequested) {
    diff = { requested: false, compare_regime: null, tolerance_minor: null, mismatches: [], compared_count: 0 };
    verdict = 'INDETERMINATE';
  } else {
    const regimeSchedule = compare_regime === 'ifrs16' ? ifrs16Schedule : asc842Schedule;
    const byDate = new Map(regimeSchedule.map((row) => [row.date, row]));
    const mismatches = [];
    let unmatched = 0;
    for (const row of preparerRows) {
      const computedRow = byDate.get(row.date);
      if (!computedRow) { mismatches.push({ date: row.date, reason: 'date_not_in_computed_schedule', preparer_liability_balance_minor: row.liability_balance_minor, computed_liability_balance_minor: null }); unmatched++; continue; }
      const delta = row.liability_balance_minor - computedRow.closing_liability_minor;
      if (Math.abs(delta) > diff_tolerance_minor) mismatches.push({ date: row.date, reason: 'liability_balance_out_of_tolerance', preparer_liability_balance_minor: row.liability_balance_minor, computed_liability_balance_minor: computedRow.closing_liability_minor, delta_minor: delta });
    }
    diff = { requested: true, compare_regime, tolerance_minor: diff_tolerance_minor, mismatches, compared_count: preparerRows.length };
    if (unmatched > 0) verdict = 'INDETERMINATE';
    else verdict = mismatches.length === 0 ? 'MATCHES' : 'DIVERGES';
    if (verdict === 'DIVERGES') findings.push({ code: 'PREPARER_SCHEDULE_DIVERGES', severity: 'high', message: mismatches.length + ' preparer balance(s) fall outside the declared tolerance.' });
    if (verdict === 'INDETERMINATE' && diffRequested) findings.push({ code: 'PREPARER_SCHEDULE_DATES_UNMATCHED', severity: 'warning', message: unmatched + ' preparer date(s) do not appear in the computed payment schedule.' });
  }

  const compliance_flags = ['LEASE_SCHEDULE_RECOMPUTED', 'LEASE_CLASSIFICATION_' + classification];
  if (elections.length) compliance_flags.push('LEASE_BRIGHT_LINE_ELECTED');
  if (diffRequested) compliance_flags.push('LEASE_PREPARER_DIFF_' + verdict);
  if (rejected_inputs.length > 0) compliance_flags.push('LEASE_INPUTS_REJECTED');

  return {
    output_payload: {
      decision: { gate_policy: verdict === 'DIVERGES' ? 'review_required' : 'auto_pass', execution_state: 'ran', reason: null },
      verdict,
      asc842: {
        pv_of_payments_minor,
        initial_lease_liability_minor: initial_liability_minor,
        initial_rou_asset_minor: initial_rou_minor,
        classification,
        classification_criteria,
        schedule: asc842Schedule,
      },
      ifrs16: {
        pv_of_payments_minor,
        initial_lease_liability_minor: initial_liability_minor,
        initial_rou_asset_minor: initial_rou_minor,
        ifrs16_note: 'IFRS 16 applies a single on-balance-sheet lessee model; no operating/finance classification is made.',
        schedule: ifrs16Schedule,
      },
      elections,
      diff,
      findings,
      rejected_inputs,
      scope_note: SCOPE_NOTE,
      clause_note: CLAUSE_NOTE,
    },
    compliance_flags,
  };
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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
