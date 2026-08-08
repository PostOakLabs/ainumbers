import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-588-docket-deadline-sweep';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'sweep_docket_deadlines',
  mandate_type: 'compliance_control', gpu: false,
};

// Docket deadline sweep (art-588).
//
// WHAT IT DOES. Every practice already keeps its deadlines somewhere -- a spreadsheet, a calendar,
// a practice-management export -- as a flat list of {date, action, type, source, done} records
// (the structured shape CounselOS's deadline tracker proves practitioners already keep, generalized
// here). This kernel sweeps that list against an as-of date and bands every record OVERDUE, DUE_SOON,
// SCHEDULED, DONE, or INDETERMINATE, showing the weekend/holiday roll derivation step by step for each
// record's actual due date, and flags any two records that name the same action on different dates as
// a conflict worth a human look. The output is a receipt: what was known, as of when, from which
// records, and how each rolled date was derived -- a re-derivable "we ran the docket check on date X"
// artifact, not a live calendar.
//
// ROLL RULES ARE CALLER-DECLARED, NEVER OURS. This kernel ships no jurisdiction rules table: which
// dates are holidays and whether a deadline falling on a weekend or holiday rolls forward or backward
// is a declared input every time, with labeled defaults (roll_weekends off, roll_direction forward,
// no holidays) rather than an encoded ruleset. Baking in a jurisdiction's court-rules calendar would be
// a standing-data-duty trap (the table goes stale) and UPL-adjacent (asserting we know a jurisdiction's
// current computation-of-time rule). FRCP 6(a)(1)(C) is cited in-page only as a dated, structural
// EXAMPLE of what a roll rule looks like -- never as an encoded ruleset for any jurisdiction.
//
// NEVER DELETE A RECORD. A record marked done:true is retained and reported as DONE, never dropped --
// the sweep is a receipt over the full declared docket, not a filtered view of what's still open.
//
// SCOPE. Not legal advice, not a calendaring system of record, and not a reminder/scheduling service --
// it recomputes bands and roll derivations over a caller-declared snapshot of records at one as-of
// moment. It does not source, generate, or independently verify a deadline; every record, and the
// as-of date, are caller-declared inputs.
//
// Deterministic date arithmetic only -- no clock, no randomness, no network, no PII.

const MAX_RECORDS = 500;
const MAX_HOLIDAYS = 500;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_DUE_SOON_DAYS = 7;
const DEFAULT_ROLL_WEEKENDS = false;
const DEFAULT_ROLL_DIRECTION = 'forward';

function s(v) { return String(v == null ? '' : v).trim(); }

function isDate(v) { return typeof v === 'string' && DATE_RE.test(v); }

function dayDiff(fromDate, toDate) {
  const a = Date.parse(fromDate + 'T00:00:00Z');
  const b = Date.parse(toDate + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

function addDays(date, n) {
  const t = Date.parse(date + 'T00:00:00Z') + n * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

function isWeekend(date) {
  const dow = new Date(date + 'T00:00:00Z').getUTCDay();
  return dow === 0 || dow === 6;
}

const SCOPE_NOTE = 'Recomputes bands and roll derivations over a caller-declared snapshot of deadline records at one as-of moment. Does not source, generate, or independently verify a deadline; every record and the as-of date are caller-declared inputs. Not a calendaring system of record and not a reminder or scheduling service.';
const CLAUSE_NOTE = 'FRCP 6(a)(1)(C) (computing time: if the last day is a Saturday, Sunday, or legal holiday, the period continues to run until the next day that is not one) is cited here as a dated, structural EXAMPLE of what a roll rule looks like. This kernel does not encode FRCP 6 or any jurisdiction’s current computation-of-time rule -- roll_weekends, roll_direction, and holiday_dates are declared inputs every time.';
const NOT_LEGAL_ADVICE_NOTE = 'Not legal advice. Not a calendaring system of record. Does not send reminders or perform scheduling.';

function emptyResult(reason, extra, flags) {
  return {
    output_payload: {
      decision: { gate_policy: 'review_required', execution_state: 'did_not_run', reason },
      as_of_date: (extra && extra.as_of_date) || null,
      due_soon_days_threshold: (extra && typeof extra.due_soon_days_threshold === 'number') ? extra.due_soon_days_threshold : null,
      due_soon_days_threshold_is_default: (extra && typeof extra.due_soon_days_threshold_is_default === 'boolean') ? extra.due_soon_days_threshold_is_default : null,
      roll_rule: (extra && extra.roll_rule) || null,
      record_count: (extra && typeof extra.record_count === 'number') ? extra.record_count : 0,
      records: [],
      conflicts: [],
      sweep_summary: null,
      rejected_inputs: (extra && extra.rejected_inputs) || [],
      scope_note: SCOPE_NOTE,
      clause_note: CLAUSE_NOTE,
      not_legal_advice_note: NOT_LEGAL_ADVICE_NOTE,
    },
    compliance_flags: flags,
  };
}

// Rolls a date forward/backward off weekends and declared holidays, one calendar day at a time,
// recording every check so the derivation is a checkable transcript rather than a black box.
function rollDate(originalDate, holidaySet, rollWeekends, rollDirection) {
  const step_days = rollDirection === 'backward' ? -1 : 1;
  const steps = [];
  let current = originalDate;
  let guard = 0;
  while (guard < 400) {
    const onWeekend = isWeekend(current);
    const onHoliday = holidaySet.has(current);
    const needsRoll = rollWeekends && (onWeekend || onHoliday);
    steps.push({ checked_date: current, is_weekend: onWeekend, is_holiday: onHoliday, rolled: needsRoll });
    if (!needsRoll) break;
    current = addDays(current, step_days);
    guard++;
  }
  return { rolled_date: current, rolled: current !== originalDate, steps };
}

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  // -- as-of date: required, never defaulted (the sweep's own anchor).
  const as_of_date = isDate(pp.as_of_date) ? pp.as_of_date : null;
  if (!as_of_date) {
    rejected_inputs.push({ where: 'as_of_date', reason: 'absent or not YYYY-MM-DD', supplied: pp.as_of_date === undefined ? null : s(pp.as_of_date) });
    return emptyResult('as_of_date_not_declared', { rejected_inputs }, ['DOCKET_AS_OF_DATE_NOT_DECLARED']);
  }

  // -- due-soon threshold: declared param with a labeled default.
  const thresholdDeclared = pp.due_soon_days_threshold !== undefined && pp.due_soon_days_threshold !== null && pp.due_soon_days_threshold !== '';
  let due_soon_days_threshold = DEFAULT_DUE_SOON_DAYS;
  let due_soon_days_threshold_is_default = true;
  if (thresholdDeclared) {
    const n = Number(pp.due_soon_days_threshold);
    if (Number.isSafeInteger(n) && n >= 0) { due_soon_days_threshold = n; due_soon_days_threshold_is_default = false; }
    else rejected_inputs.push({ where: 'due_soon_days_threshold', reason: 'not a non-negative safe integer number of days -- default ' + DEFAULT_DUE_SOON_DAYS + ' used instead', supplied: s(pp.due_soon_days_threshold) });
  }

  // -- roll rule: declared params, labeled defaults, never a jurisdiction table of ours.
  const rollIn = (pp.roll_rule && typeof pp.roll_rule === 'object') ? pp.roll_rule : {};
  const roll_weekends = typeof rollIn.roll_weekends === 'boolean' ? rollIn.roll_weekends : DEFAULT_ROLL_WEEKENDS;
  const roll_weekends_is_default = typeof rollIn.roll_weekends !== 'boolean';
  const roll_direction = rollIn.roll_direction === 'backward' ? 'backward' : rollIn.roll_direction === 'forward' ? 'forward' : DEFAULT_ROLL_DIRECTION;
  const roll_direction_is_default = rollIn.roll_direction !== 'forward' && rollIn.roll_direction !== 'backward';

  const holidaysIn = Array.isArray(rollIn.holiday_dates) ? rollIn.holiday_dates.slice(0, MAX_HOLIDAYS) : [];
  const holiday_dates = [];
  const holidaySet = new Set();
  for (let i = 0; i < holidaysIn.length; i++) {
    const h = holidaysIn[i];
    if (isDate(h)) { if (!holidaySet.has(h)) { holidaySet.add(h); holiday_dates.push(h); } }
    else rejected_inputs.push({ where: 'roll_rule.holiday_dates[' + i + ']', reason: 'not YYYY-MM-DD', supplied: h === undefined ? null : s(h) });
  }
  if (Array.isArray(rollIn.holiday_dates) && rollIn.holiday_dates.length > MAX_HOLIDAYS) {
    rejected_inputs.push({ where: 'roll_rule.holiday_dates', reason: 'more than ' + MAX_HOLIDAYS + ' holiday dates supplied', supplied: rollIn.holiday_dates.length });
  }
  holiday_dates.sort();

  const roll_rule = {
    roll_weekends, roll_weekends_is_default,
    roll_direction, roll_direction_is_default,
    holiday_dates,
  };

  // -- records: never deleted, done:true retained.
  const recordsIn = Array.isArray(pp.records) ? pp.records : [];
  const records = [];
  const seenActionDates = new Map(); // normalized action -> first record's {date, index}

  for (let i = 0; i < recordsIn.length && records.length < MAX_RECORDS; i++) {
    const row = recordsIn[i] || {};
    const date = isDate(row.date) ? row.date : null;
    const action = s(row.action);
    const type = s(row.type) || 'deadline';
    const source = s(row.source);
    const done = row.done === true;

    if (!action) { rejected_inputs.push({ where: 'records[' + i + '].action', reason: 'absent', supplied: null }); continue; }
    if (!date) {
      records.push({
        record_id: 'rec-' + i, date: row.date === undefined ? null : s(row.date), action, type, source, done,
        status: 'INDETERMINATE', rolled_date: null, days_remaining: null, roll: null,
      });
      rejected_inputs.push({ where: 'records[' + i + '].date', reason: 'absent or not YYYY-MM-DD -- record recorded as INDETERMINATE, not dropped', supplied: row.date === undefined ? null : s(row.date) });
      continue;
    }

    const roll = rollDate(date, holidaySet, roll_weekends, roll_direction);
    const rolled_date = roll.rolled_date;
    const days_remaining = dayDiff(as_of_date, rolled_date);

    let status;
    if (done) status = 'DONE';
    else if (days_remaining < 0) status = 'OVERDUE';
    else if (days_remaining <= due_soon_days_threshold) status = 'DUE_SOON';
    else status = 'SCHEDULED';

    records.push({
      record_id: 'rec-' + i,
      date, action, type, source, done,
      status, rolled_date, days_remaining,
      roll: { rolled: roll.rolled, steps: roll.steps },
    });

    const key = action.toLowerCase();
    if (!seenActionDates.has(key)) seenActionDates.set(key, []);
    seenActionDates.get(key).push({ index: i, date, record_id: 'rec-' + i });
  }
  if (recordsIn.length > MAX_RECORDS) rejected_inputs.push({ where: 'records', reason: 'more than ' + MAX_RECORDS + ' records supplied', supplied: recordsIn.length });
  if (records.length === 0 && recordsIn.length === 0) rejected_inputs.push({ where: 'records', reason: 'absent or empty -- at least one deadline record is required for a sweep', supplied: null });

  // -- duplicate/conflict detection: same action, different dates.
  const conflicts = [];
  for (const [action, entries] of seenActionDates.entries()) {
    const distinctDates = new Set(entries.map((e) => e.date));
    if (distinctDates.size > 1) {
      conflicts.push({
        action,
        record_ids: entries.map((e) => e.record_id),
        dates: Array.from(distinctDates).sort(),
      });
    }
  }
  conflicts.sort((a, b) => (a.action < b.action ? -1 : a.action > b.action ? 1 : 0));

  if (records.length === 0) {
    return emptyResult('no_usable_records', {
      as_of_date, due_soon_days_threshold, due_soon_days_threshold_is_default, roll_rule, record_count: 0, rejected_inputs,
    }, ['DOCKET_NO_USABLE_RECORDS']);
  }

  const counts = { OVERDUE: 0, DUE_SOON: 0, SCHEDULED: 0, DONE: 0, INDETERMINATE: 0 };
  for (const r of records) counts[r.status]++;

  const sweep_summary = {
    as_of_date,
    record_count: records.length,
    overdue_count: counts.OVERDUE,
    due_soon_count: counts.DUE_SOON,
    scheduled_count: counts.SCHEDULED,
    done_count: counts.DONE,
    indeterminate_count: counts.INDETERMINATE,
    conflict_count: conflicts.length,
  };

  const needsReview = counts.OVERDUE > 0 || counts.INDETERMINATE > 0 || conflicts.length > 0;
  const gate_policy = needsReview ? 'review_required' : 'auto_pass';

  const compliance_flags = ['DOCKET_SWEEP_EVALUATED'];
  if (counts.OVERDUE > 0) compliance_flags.push('DOCKET_OVERDUE_PRESENT');
  if (counts.DUE_SOON > 0) compliance_flags.push('DOCKET_DUE_SOON_PRESENT');
  if (conflicts.length > 0) compliance_flags.push('DOCKET_CONFLICT_PRESENT');
  if (counts.INDETERMINATE > 0) compliance_flags.push('DOCKET_INDETERMINATE_PRESENT');
  if (rejected_inputs.length > 0) compliance_flags.push('DOCKET_INPUTS_REJECTED');

  return {
    output_payload: {
      decision: { gate_policy, execution_state: 'ran', reason: null },
      as_of_date,
      due_soon_days_threshold, due_soon_days_threshold_is_default,
      roll_rule,
      record_count: records.length,
      records,
      conflicts,
      sweep_summary,
      rejected_inputs,
      scope_note: SCOPE_NOTE,
      clause_note: CLAUSE_NOTE,
      not_legal_advice_note: NOT_LEGAL_ADVICE_NOTE,
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
