import { executionHash } from './_hash.mjs';

const TOOL_ID = '733-servicing-compliance-clock';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'servicing_compliance_clock',
  mandate_type: 'consumer_finance', gpu: false,
};

// Servicing-compliance clock -- compute servicer-compliance due dates and clock
// states from EVENT DATES + loan values, one obligation per requested rule,
// every output carrying its paragraph citation.
//
// METHOD (per-rule date arithmetic over the deadlines the node metadata's
// regulatory_basis cites -- each deadline re-implemented locally from the
// pinned paragraph text, no kernel imports):
//   1. The caller submits an `events` array; each event names a rule id and a
//      trigger date (strict ISO YYYY-MM-DD) plus any rule-specific parameters.
//   2. For each event the kernel computes the due date (and, for window-style
//      rules, the window-start date) on the rule's own day basis:
//      business days (legal public holidays, Saturdays and Sundays excluded,
//      U.S. federal-holiday observed calendar -- a NAMED assumption carried on
//      every output, never implicit) or plain calendar days.
//   3. When the caller supplies the servicer's action date the kernel classifies
//      the clock: met (action on or before the deadline / inside the window) or
//      breached (action after the deadline / outside the window). Without an
//      action date the clock is still running and the state is `within`.
//   4. Boundary rules (the 37-day pre-sale threshold, the 120-day pre-foreclosure
//      bar, the no-duplicate check) emit the measured day count and whether the
//      obligation is owed at all.
//
// CLOSED REFUSAL SET (each refusal has a reachable path + fixture):
//   - events missing or over the bounded 32-event corpus
//   - unknown rule id
//   - a rule id whose governing paragraph was REMOVED from the regulation
//     (the COVID-19 forbearance request branch was rescinded by the 2025 interim
//     final rule effective 2025-07-15; the kernel refuses it rather than
//     computing against rescinded text)
//   - an invalid or ambiguous date (not a strict valid ISO YYYY-MM-DD calendar
//     date, or outside the bounded 1970-2099 horizon)
//   - a missing required rule-specific date parameter
//   - an invalid rule-specific enum (e.g. an error category outside 1-11)
//
// BOUNDS: at most 32 events per run; every due-date search loop is bounded by a
// 400-day step guard (the longest single rule span is 240 days plus holiday
// shifts), so the whole run is bounded well under 13k day-steps.
//
// DOMAIN EXCLUSIONS (declared, not computed; named refusals where inputs would
// smuggle them in): no state-law overlays, no bankruptcy stays, no HELOC
// open-edge cases -- see the node shard description.
//
// Pure ECMA-262 arithmetic only -- no Date object, no Date.now, no
// Math.random. All civil-date arithmetic runs on a pure day-count integer
// over the proleptic Gregorian calendar (the days_from_civil / civil_from_days
// algorithms; epoch day 0 = 1970-01-01).

const MAX_EVENTS = 32;
const MAX_STEP_GUARD = 400; // per-deadline day-step guard (longest span 240 days + holiday shifts)
const MIN_YEAR = 1970;
const MAX_YEAR = 2099;

// ---------------------------------------------------------------- civil dates

// days-from-civil (Hinnant): Gregorian ordinal day count from 1970-01-01.
function daysFromCivil(y, m, d) {
  const y2 = m <= 2 ? y - 1 : y;
  const era = Math.floor(y2 / 400);
  const yoe = y2 - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

// civil-from-days (Hinnant): inverse of daysFromCivil.
function civilFromDays(z) {
  const z2 = z + 719468;
  const era = Math.floor(z2 / 146097);
  const doe = z2 - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return { y: y + (m <= 2 ? 1 : 0), m, d };
}

function isoOf(z) {
  const c = civilFromDays(z);
  const pad = (n) => (n < 10 ? '0' + String(n) : String(n));
  return String(c.y) + '-' + pad(c.m) + '-' + pad(c.d);
}

// Strict ISO YYYY-MM-DD parse -> day count, or null when invalid/ambiguous.
function parseIso(s) {
  if (typeof s !== 'string') return null;
  const hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!hit) return null;
  const y = Number(hit[1]); const m = Number(hit[2]); const d = Number(hit[3]);
  if (y < MIN_YEAR || y > MAX_YEAR) return null;
  if (m < 1 || m > 12) return null;
  const dim = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  if (d < 1 || d > dim) return null;
  return daysFromCivil(y, m, d);
}

// weekday: 0=Sunday .. 6=Saturday (1970-01-01 was a Thursday = 4).
function weekday(z) { return ((z % 7) + 11) % 7; }

// ------------------------------------------------- U.S. federal holiday calendar
// Legal public holidays under 5 U.S.C. 6103, with the Saturday->Friday /
// Sunday->Monday observance shift. This calendar is a NAMED assumption carried
// on every business-day output (never implicit).

function nthWeekday(zYear, month, dow, n) {
  const first = daysFromCivil(zYear, month, 1);
  const shift = (dow - weekday(first) + 7) % 7;
  return first + shift + (n - 1) * 7;
}

function lastWeekday(zYear, month, dow) {
  const last = daysFromCivil(zYear, month + 1, 1) - 1;
  return last - ((weekday(last) - dow + 7) % 7);
}

function fixedObserved(zYear, month, day) {
  const z = daysFromCivil(zYear, month, day);
  const w = weekday(z);
  if (w === 6) return z - 1; // Saturday -> observed Friday
  if (w === 0) return z + 1; // Sunday -> observed Monday
  return z;
}

const holidayCache = Object.create(null);

function federalHolidays(zYear) {
  if (holidayCache[zYear]) return holidayCache[zYear];
  const set = Object.create(null);
  const add = (z) => { set[z] = true; };
  add(fixedObserved(zYear, 1, 1));            // New Year's Day
  add(nthWeekday(zYear, 1, 1, 3));            // Birthday of Martin Luther King, Jr. (3rd Monday Jan)
  add(nthWeekday(zYear, 2, 1, 3));            // Washington's Birthday (3rd Monday Feb)
  add(lastWeekday(zYear, 5, 1));              // Memorial Day (last Monday May)
  add(fixedObserved(zYear, 6, 19));           // Juneteenth
  add(fixedObserved(zYear, 7, 4));            // Independence Day
  add(nthWeekday(zYear, 9, 1, 1));            // Labor Day (1st Monday Sep)
  add(nthWeekday(zYear, 10, 1, 2));           // Columbus Day (2nd Monday Oct)
  add(fixedObserved(zYear, 11, 11));          // Veterans Day
  add(nthWeekday(zYear, 11, 4, 4));           // Thanksgiving (4th Thursday Nov)
  add(fixedObserved(zYear, 12, 25));          // Christmas Day
  holidayCache[zYear] = set;
  return set;
}

function isBusinessDay(z) {
  const w = weekday(z);
  if (w === 0 || w === 6) return false;
  return !federalHolidays(civilFromDays(z).y)[z];
}

// Add n business days to a business-day anchor (a trigger date that is itself a
// non-business day starts the count at the next business day).
function addBusinessDays(z, n) {
  let cur = z;
  let left = n;
  for (let guard = 0; guard <= MAX_STEP_GUARD; guard++) {
    if (guard === MAX_STEP_GUARD) return null; // bound refusal, never silent
    if (!isBusinessDay(cur)) { cur += 1; continue; }
    if (left === 0) return cur;
    cur += 1;
    left -= 1;
  }
  return null;
}

function addCalendarDays(z, n) { return z + n; }

// ---------------------------------------------------------------- rule catalog
// Policy-provenance constants: each citation IS the rule that travels with the
// output (the KERNEL-CITATION-CLASS policy_parameters exception, art-220
// precedent) -- the deadlines below are the paragraph text re-implemented.

const BASIS_BD = 'business_days_excluding_legal_public_holidays_saturdays_sundays';
const BASIS_CAL = 'calendar_days';
const CALENDAR_NAME = 'us_federal_holidays_observed';

const CITE = {
  error_acknowledgment: '12 CFR 1024.35(d)',
  error_investigation_30: '12 CFR 1024.35(e)(3)(i)(C)',
  error_investigation_7: '12 CFR 1024.35(e)(3)(i)(A)',
  error_investigation_sale: '12 CFR 1024.35(e)(3)(i)(B)',
  error_investigation_ext: '12 CFR 1024.35(e)(3)(ii)',
  info_request_acknowledgment: '12 CFR 1024.36(c)',
  info_request_owner: '12 CFR 1024.36(d)(2)(i)(A)',
  info_request_other: '12 CFR 1024.36(d)(2)(i)(B)',
  info_request_ext: '12 CFR 1024.36(d)(2)(ii)',
  loss_mit_acknowledgment: '12 CFR 1024.41(b)(2)(i)(B)',
  loss_mit_acknowledgment_scope: '12 CFR 1024.41(b)(2)(i)',
  loss_mit_evaluation: '12 CFR 1024.41(c)(1)',
  presale_37day_boundary: '12 CFR 1024.41(c)(1); 12 CFR 1024.41(g)',
  foreclosure_referral_120day: '12 CFR 1024.41(f)(1)(i)',
  no_duplicate_processing: '12 CFR 1024.41(i)',
  fpi_initial_notice: '12 CFR 1024.37(c)(1)(i)',
  fpi_reminder_notice: '12 CFR 1024.37(d)(1)',
  fpi_cancel_refund: '12 CFR 1024.37(g)',
  payment_credit_date_of_receipt: '12 CFR 1026.36(c)(1)(i)',
  nonconforming_payment_credit: '12 CFR 1026.36(c)(1)(iii)',
  payoff_statement: '12 CFR 1026.36(c)(3)',
  arm_payment_change_notice: '12 CFR 1026.20(c)(2)',
  arm_initial_adjustment_notice: '12 CFR 1026.20(d)',
};

const KNOWN_RULES = [
  'error_acknowledgment', 'error_investigation',
  'info_request_acknowledgment', 'info_request_response',
  'loss_mit_acknowledgment', 'loss_mit_evaluation', 'presale_37day_boundary',
  'foreclosure_referral_120day', 'no_duplicate_processing',
  'fpi_initial_notice', 'fpi_reminder_notice', 'fpi_cancel_refund',
  'payment_credit_date_of_receipt', 'nonconforming_payment_credit',
  'payoff_statement', 'arm_payment_change_notice', 'arm_initial_adjustment_notice',
];

// The COVID-19 forbearance-request branch lived in section 1024.39(e) until the
// 2025 interim final rule (90 FR 20791/20792, effective 2025-07-15) rescinded it
// (the retrieved 1024.41 section's own amendment trail carries 90 FR 20792,
// May 16, 2025). Computing against rescinded text is prohibited: the id is a
// named refusal with a fixture, never a computed clock.
const REMOVED_RULE_IDS = ['covid_forbearance_request'];

function refusalPayload(flag, because, extra) {
  const payload = {
    verdict: 'refused',
    refused_because: because,
    obligations: [],
    evidence: {
      record_type: 'servicing_compliance_clock', tool_id: TOOL_ID,
      tool_version: TOOL_VERSION, refused: true,
    },
    manual_review_required: true,
  };
  const keys = Object.keys(extra || {});
  for (let i = 0; i < keys.length; i++) payload[keys[i]] = extra[keys[i]];
  return payload;
}

function fmtDue(z, basis) {
  if (z === null) return null;
  return isoOf(z);
}

function obligation(rule, cite, basis, calendar, triggerIso, dueZ, actionIso, state, stateReason, extra) {
  const o = {
    rule,
    cited_paragraph: cite,
    basis,
    calendar,
    trigger_date: triggerIso,
    due_date: fmtDue(dueZ),
    action_date: actionIso === undefined || actionIso === null ? null : actionIso,
    state,
  };
  if (stateReason) o.state_reason = stateReason;
  const keys = Object.keys(extra || {});
  for (let i = 0; i < keys.length; i++) o[keys[i]] = extra[keys[i]];
  return o;
}

function classify(dueZ, actionIso) {
  if (actionIso === undefined || actionIso === null || actionIso === '') return 'within';
  const a = parseIso(actionIso);
  if (a === null) return null; // signal refusal upstream
  return a <= dueZ ? 'met' : 'breached';
}

// Floor test: the action is lawful only ON OR AFTER the earliest date, the
// inverse of the deadline test in classify().
function classifyFloor(earliestZ, actionIso) {
  if (actionIso === undefined || actionIso === null || actionIso === '') return 'within';
  const a = parseIso(actionIso);
  if (a === null) return null; // signal refusal upstream
  return a >= earliestZ ? 'met' : 'breached';
}

// ---------------------------------------------------------------- compute()

export function compute(pp) {
  pp = pp || {};
  const compliance_flags = [];

  // -- Refusal: events missing or over the bounded corpus.
  const events = Array.isArray(pp.events) ? pp.events : null;
  if (!events || events.length === 0) {
    compliance_flags.push('EVENTS_MISSING_REFUSED');
    return { output_payload: refusalPayload('EVENTS_MISSING_REFUSED', 'events_array_missing_or_empty'), compliance_flags };
  }
  if (events.length > MAX_EVENTS) {
    compliance_flags.push('EVENTS_EXCEED_BOUNDED_32_REFUSED');
    return {
      output_payload: refusalPayload('EVENTS_EXCEED_BOUNDED_32_REFUSED', 'events_exceed_bounded_32', {
        events_supplied: events.length, max_events: MAX_EVENTS,
      }),
      compliance_flags,
    };
  }

  // -- Per-event validation pass (closed refusal set, located per event).
  for (let i = 0; i < events.length; i++) {
    const ev = events[i] || {};
    const rule = ev.rule;
    if (typeof rule !== 'string') {
      compliance_flags.push('UNKNOWN_RULE_REFUSED');
      return {
        output_payload: refusalPayload('UNKNOWN_RULE_REFUSED', 'unknown_rule_id', { event_index: i }),
        compliance_flags,
      };
    }
    if (REMOVED_RULE_IDS.indexOf(rule) !== -1) {
      compliance_flags.push('RULE_REMOVED_BY_2025_IFR_REFUSED');
      return {
        output_payload: refusalPayload('RULE_REMOVED_BY_2025_IFR_REFUSED', 'rule_removed_from_regulation_by_2025_interim_final_rule', {
          event_index: i, removed_rule: 'covid_forbearance_request (former 12 CFR 1024.39(e), rescinded by 90 FR 20791/20792, effective 2025-07-15)',
        }),
        compliance_flags,
      };
    }
    if (KNOWN_RULES.indexOf(rule) === -1) {
      compliance_flags.push('UNKNOWN_RULE_REFUSED');
      return {
        output_payload: refusalPayload('UNKNOWN_RULE_REFUSED', 'unknown_rule_id', { event_index: i, rule_supplied: rule }),
        compliance_flags,
      };
    }
    if (parseIso(ev.trigger_date) === null) {
      compliance_flags.push('INVALID_OR_AMBIGUOUS_DATE_REFUSED');
      return {
        output_payload: refusalPayload('INVALID_OR_AMBIGUOUS_DATE_REFUSED', 'invalid_or_ambiguous_iso_date', {
          event_index: i, rule, field: 'trigger_date', expected: 'strict YYYY-MM-DD calendar date within 1970-2099',
        }),
        compliance_flags,
      };
    }
    if (ev.action_date !== undefined && ev.action_date !== null && ev.action_date !== '' && parseIso(ev.action_date) === null) {
      compliance_flags.push('INVALID_OR_AMBIGUOUS_DATE_REFUSED');
      return {
        output_payload: refusalPayload('INVALID_OR_AMBIGUOUS_DATE_REFUSED', 'invalid_or_ambiguous_iso_date', {
          event_index: i, rule, field: 'action_date', expected: 'strict YYYY-MM-DD calendar date within 1970-2099',
        }),
        compliance_flags,
      };
    }
  }

  // -- Obligation computation.
  const obligations = [];

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const rule = ev.rule;
    const T = parseIso(ev.trigger_date);
    const Tiso = ev.trigger_date;
    const act = ev.action_date === undefined || ev.action_date === null || ev.action_date === '' ? null : ev.action_date;

    const needDate = (name) => {
      const z = parseIso(ev[name]);
      if (z === null) {
        compliance_flags.push('MISSING_REQUIRED_DATE_REFUSED');
        return { refused: true, payload: refusalPayload('MISSING_REQUIRED_DATE_REFUSED', 'missing_or_invalid_required_date_parameter', { event_index: i, rule, parameter: name }) };
      }
      return { refused: false, z };
    };

    let out = null;

    if (rule === 'error_acknowledgment') {
      const due = addBusinessDays(T, 5);
      const st = classify(due, act);
      out = obligation(rule, CITE.error_acknowledgment, BASIS_BD, CALENDAR_NAME, Tiso, due, act, st, null, { days_allowed: 5 });

    } else if (rule === 'error_investigation') {
      const cat = ev.error_category;
      if (!Number.isInteger(cat) || cat < 1 || cat > 11) {
        compliance_flags.push('INVALID_PARAMETER_REFUSED');
        return {
          output_payload: refusalPayload('INVALID_PARAMETER_REFUSED', 'invalid_error_category', { event_index: i, rule, expected: 'integer 1-11 (the eleven enumerated categories)' }),
          compliance_flags,
        };
      }
      let cite; let days;
      let saleZ = null;
      if (cat === 6) { cite = CITE.error_investigation_7; days = 7; }
      else if (cat === 9 || cat === 10) {
        cite = CITE.error_investigation_sale; days = 30;
        if (ev.foreclosure_sale_date !== undefined && ev.foreclosure_sale_date !== null && ev.foreclosure_sale_date !== '') {
          const s = needDate('foreclosure_sale_date');
          if (s.refused) return { output_payload: s.payload, compliance_flags };
          saleZ = s.z;
        }
      } else { cite = CITE.error_investigation_30; days = 30; }
      let due = addBusinessDays(T, days);
      let saleBound = false;
      if (saleZ !== null) {
        // earlier of the foreclosure sale date (action must occur PRIOR to the
        // sale, i.e. on or before saleZ - 1) or the 30-day deadline
        const saleBoundDue = saleZ - 1;
        if (saleBoundDue < due) { due = saleBoundDue; saleBound = true; }
      }
      const extendable = cat !== 6 && cat !== 9 && cat !== 10;
      let extended = false;
      if (extendable && ev.extension_notice_given === true) {
        const extDue = addBusinessDays(due, 15);
        if (extDue !== null) { due = extDue; extended = true; }
      }
      const st = classify(due, act);
      out = obligation(rule, extended ? CITE.error_investigation_ext : cite, BASIS_BD, CALENDAR_NAME, Tiso, due, act, st, null, {
        error_category: cat, days_allowed: extended ? days + 15 : days,
        extension_notice_given: ev.extension_notice_given === true,
        deadline_bound_by_foreclosure_sale: saleBound,
      });

    } else if (rule === 'info_request_acknowledgment') {
      const due = addBusinessDays(T, 5);
      out = obligation(rule, CITE.info_request_acknowledgment, BASIS_BD, CALENDAR_NAME, Tiso, due, act, classify(due, act), null, { days_allowed: 5 });

    } else if (rule === 'info_request_response') {
      const type = ev.request_type;
      if (type !== 'owner_identity' && type !== 'other') {
        compliance_flags.push('INVALID_PARAMETER_REFUSED');
        return {
          output_payload: refusalPayload('INVALID_PARAMETER_REFUSED', 'invalid_request_type', { event_index: i, rule, expected: 'owner_identity | other' }),
          compliance_flags,
        };
      }
      const owner = type === 'owner_identity';
      let due = addBusinessDays(T, owner ? 10 : 30);
      let extended = false;
      if (!owner && ev.extension_notice_given === true) {
        const extDue = addBusinessDays(due, 15);
        if (extDue !== null) { due = extDue; extended = true; }
      }
      out = obligation(rule, owner ? CITE.info_request_owner : (extended ? CITE.info_request_ext : CITE.info_request_other), BASIS_BD, CALENDAR_NAME, Tiso, due, act, classify(due, act), null, {
        request_type: type, days_allowed: extended ? (owner ? 10 : 45) : (owner ? 10 : 30),
        extension_notice_given: ev.extension_notice_given === true,
      });

    } else if (rule === 'loss_mit_acknowledgment') {
      // The (b)(2)(i) acknowledgment duty applies when the application is
      // received 45 days or more before a foreclosure sale.
      let inScope = true;
      let saleZ = null;
      if (ev.foreclosure_sale_date !== undefined && ev.foreclosure_sale_date !== null && ev.foreclosure_sale_date !== '') {
        const s = needDate('foreclosure_sale_date');
        if (s.refused) return { output_payload: s.payload, compliance_flags };
        saleZ = s.z;
        inScope = (saleZ - T) >= 45;
      }
      if (!inScope) {
        out = obligation(rule, CITE.loss_mit_acknowledgment_scope, BASIS_BD, CALENDAR_NAME, Tiso, null, act, 'met', 'application_received_less_than_45_days_before_sale_no_acknowledgment_duty', {
          obligation_owed: false, days_before_sale: saleZ - T,
        });
      } else {
        const due = addBusinessDays(T, 5);
        out = obligation(rule, CITE.loss_mit_acknowledgment, BASIS_BD, CALENDAR_NAME, Tiso, due, act, classify(due, act), null, {
          obligation_owed: true, days_allowed: 5,
          days_before_sale: saleZ === null ? null : saleZ - T,
        });
      }

    } else if (rule === 'loss_mit_evaluation') {
      // (c)(1): within 30 days of the complete application, when received more
      // than 37 days before a foreclosure sale. The 37-day gate needs the sale
      // date; without it the 30-day clock is computed and the gate reported open.
      let saleZ = null;
      if (ev.foreclosure_sale_date !== undefined && ev.foreclosure_sale_date !== null && ev.foreclosure_sale_date !== '') {
        const s = needDate('foreclosure_sale_date');
        if (s.refused) return { output_payload: s.payload, compliance_flags };
        saleZ = s.z;
      }
      const daysBeforeSale = saleZ === null ? null : saleZ - T;
      const inScope = saleZ === null ? true : daysBeforeSale > 37;
      const due = addCalendarDays(T, 30);
      if (!inScope) {
        out = obligation(rule, CITE.loss_mit_evaluation, BASIS_CAL, null, Tiso, null, act, 'met', 'complete_application_37_days_or_less_before_sale_outside_evaluation_duty', {
          obligation_owed: false, days_before_sale: daysBeforeSale,
        });
      } else {
        out = obligation(rule, CITE.loss_mit_evaluation, BASIS_CAL, null, Tiso, due, act, classify(due, act), null, {
          obligation_owed: true, days_allowed: 30,
          days_before_sale: daysBeforeSale,
        });
      }

    } else if (rule === 'presale_37day_boundary') {
      // Boundary check: more than 37 days before sale => inside the section's
      // protections; 37 days or fewer => outside (the boundary the section text
      // fixes at (c)(1) with the (g) sale prohibition).
      const s = needDate('foreclosure_sale_date');
      if (s.refused) return { output_payload: s.payload, compliance_flags };
      const daysBefore = s.z - T;
      const inScope = daysBefore > 37;
      out = obligation(rule, CITE.presale_37day_boundary, BASIS_CAL, null, Tiso, null, act, inScope ? 'within' : 'breached',
        inScope ? null : 'complete_application_received_37_days_or_less_before_sale_outside_1024_41', {
        boundary_kind: '37_day_presale_threshold', days_before_sale: daysBefore,
        obligation_owed: inScope,
      });

    } else if (rule === 'foreclosure_referral_120day') {
      // (f)(1)(i): no first notice or filing until the obligation is more than
      // 120 days delinquent. Day-count convention (named): days delinquent on a
      // date D = D - delinquency_date in calendar days, so the earliest lawful
      // first-notice/filing date is delinquency_date + 121 days.
      const earliest = addCalendarDays(T, 121);
      const st = classifyFloor(earliest, act);
      out = obligation(rule, CITE.foreclosure_referral_120day, BASIS_CAL, null, Tiso, earliest, act,
        st === 'met' ? 'met' : st, // on/after earliest = lawful referral
        st === 'met' ? null : 'first_notice_or_filing_before_120_day_delinquency_bar_expired', {
        boundary_kind: '120_day_pre_foreclosure_bar', days_delinquent_required_more_than: 120,
        earliest_lawful_first_notice_date: isoOf(earliest),
      });
      // normalize: 'within' (no action yet) stays the running bar
      if (out.state === 'within') out.state_reason = null;

    } else if (rule === 'no_duplicate_processing') {
      // (i): the section applies to a new application unless the servicer has
      // previously complied for a complete application and the borrower has been
      // delinquent at all times since.
      const prior = ev.prior_complete_application_date;
      const delinquent = ev.continuously_delinquent_since;
      if (parseIso(prior) === null || typeof delinquent !== 'boolean') {
        compliance_flags.push('INVALID_PARAMETER_REFUSED');
        return {
          output_payload: refusalPayload('INVALID_PARAMETER_REFUSED', 'invalid_no_duplicate_parameters', { event_index: i, rule, expected: 'prior_complete_application_date (ISO) + continuously_delinquent_since (boolean)' }),
          compliance_flags,
        };
      }
      const duplicative = parseIso(prior) !== null && delinquent === true;
      out = obligation(rule, CITE.no_duplicate_processing, BASIS_CAL, null, Tiso, null, act,
        duplicative ? 'met' : 'within',
        duplicative ? 'prior_complete_application_with_continuous_delinquency_duties_not_re_owed' : null, {
        obligation_owed: !duplicative,
        prior_complete_application_date: prior,
        continuously_delinquent_since: delinquent,
      });

    } else if (rule === 'fpi_initial_notice') {
      // (c)(1)(i): written notice at least 45 days before the charge.
      const c = needDate('charge_date');
      if (c.refused) return { output_payload: c.payload, compliance_flags };
      const due = addCalendarDays(c.z, -45);
      out = obligation(rule, CITE.fpi_initial_notice, BASIS_CAL, null, Tiso, due, act, classify(due, act), null, {
        charge_date: ev.charge_date, days_before_charge_required: 45,
      });

    } else if (rule === 'fpi_reminder_notice') {
      // (d)(1): reminder at least 15 days before the charge, and not delivered
      // until at least 30 days after the initial notice.
      const c = needDate('charge_date');
      if (c.refused) return { output_payload: c.payload, compliance_flags };
      const init = needDate('initial_notice_date');
      if (init.refused) return { output_payload: init.payload, compliance_flags };
      const latest = addCalendarDays(c.z, -15);
      const earliest = addCalendarDays(init.z, 30);
      if (act === null) {
        out = obligation(rule, CITE.fpi_reminder_notice, BASIS_CAL, null, Tiso, latest, act, 'within', null, {
          charge_date: ev.charge_date, initial_notice_date: ev.initial_notice_date,
          window_start_date: isoOf(earliest), days_before_charge_required: 15,
        });
      } else {
        const a = parseIso(act);
        const inWindow = a >= earliest && a <= latest;
        out = obligation(rule, CITE.fpi_reminder_notice, BASIS_CAL, null, Tiso, latest, act, inWindow ? 'met' : 'breached',
          inWindow ? null : (a < earliest ? 'reminder_delivered_less_than_30_days_after_initial_notice' : 'reminder_delivered_less_than_15_days_before_charge'), {
          charge_date: ev.charge_date, initial_notice_date: ev.initial_notice_date,
          window_start_date: isoOf(earliest), days_before_charge_required: 15,
        });
      }

    } else if (rule === 'fpi_cancel_refund') {
      // (g): within 15 days of receiving coverage evidence, cancel and refund.
      const due = addCalendarDays(T, 15);
      out = obligation(rule, CITE.fpi_cancel_refund, BASIS_CAL, null, Tiso, due, act, classify(due, act), null, { days_allowed: 15 });

    } else if (rule === 'payment_credit_date_of_receipt') {
      // (c)(1)(i): a conforming periodic payment is credited as of the date of
      // receipt; the deadline IS the receipt date.
      out = obligation(rule, CITE.payment_credit_date_of_receipt, BASIS_CAL, null, Tiso, T, act, classify(T, act), null, {
        crediting_rule: 'as_of_date_of_receipt',
      });

    } else if (rule === 'nonconforming_payment_credit') {
      // (c)(1)(iii): a non-conforming payment the servicer accepted is credited
      // as of five days after receipt.
      const due = addCalendarDays(T, 5);
      out = obligation(rule, CITE.nonconforming_payment_credit, BASIS_CAL, null, Tiso, due, act, classify(due, act), null, {
        days_after_receipt: 5,
      });

    } else if (rule === 'payoff_statement') {
      // (c)(3): accurate payoff statement within seven business days of the
      // written request (the paragraph's own phrase).
      const due = addBusinessDays(T, 7);
      out = obligation(rule, CITE.payoff_statement, BASIS_BD, CALENDAR_NAME, Tiso, due, act, classify(due, act), null, {
        days_allowed: 7,
      });

    } else if (rule === 'arm_payment_change_notice') {
      // (c)(2): base window at least 60 but no more than 120 days before the
      // first payment at the adjusted level; 25-day floor for uniformly
      // scheduled adjustments every 60 days or more frequently and for
      // pre-2015-01-10 contracts using an index figure less than 45 days old;
      // and as soon as practicable but not less than 25 days when the first
      // adjustment hits within 60 days of consummation on an estimated rate.
      const p = needDate('first_adjusted_payment_date');
      if (p.refused) return { output_payload: p.payload, compliance_flags };
      const pay = p.z;
      const freq = ev.adjustment_frequency_days;
      if (freq !== undefined && freq !== null && (!Number.isInteger(freq) || freq < 1)) {
        compliance_flags.push('INVALID_PARAMETER_REFUSED');
        return {
          output_payload: refusalPayload('INVALID_PARAMETER_REFUSED', 'invalid_adjustment_frequency', { event_index: i, rule, expected: 'positive integer days' }),
          compliance_flags,
        };
      }
      const fastCycle = (Number.isInteger(freq) && freq <= 60) ||
        (ev.originated_before_2015_01_10 === true && ev.index_figure_lt_45_days === true);
      const estimatedRateCase = ev.first_adjustment_within_60_days_of_consummation === true && ev.disclosed_rate_was_estimate === true;
      let earliestZ; let latestZ;
      if (estimatedRateCase) {
        earliestZ = null; // "as soon as practicable" -- no fixed window floor
        latestZ = addCalendarDays(pay, -25);
      } else {
        latestZ = addCalendarDays(pay, fastCycle ? -25 : -60);
        earliestZ = addCalendarDays(pay, -120);
      }
      const cite = CITE.arm_payment_change_notice;
      if (act === null) {
        out = obligation(rule, cite, BASIS_CAL, null, Tiso, latestZ, act, 'within', null, {
          first_adjusted_payment_date: ev.first_adjusted_payment_date,
          window_start_date: earliestZ === null ? null : isoOf(earliestZ),
          window_variant: estimatedRateCase ? 'estimated_rate_consummation_case' : (fastCycle ? 'fast_cycle_25_day_floor' : 'standard_60_120'),
        });
      } else {
        const a = parseIso(act);
        let ok; let why = null;
        if (estimatedRateCase) { ok = a <= latestZ; if (!ok) why = 'disclosed_less_than_25_days_before_first_adjusted_payment'; }
        else { ok = a >= earliestZ && a <= latestZ; if (!ok) why = a < earliestZ ? 'disclosed_more_than_120_days_before_first_adjusted_payment' : 'disclosed_after_window_closed'; }
        out = obligation(rule, cite, BASIS_CAL, null, Tiso, latestZ, act, ok ? 'met' : 'breached', why, {
          first_adjusted_payment_date: ev.first_adjusted_payment_date,
          window_start_date: earliestZ === null ? null : isoOf(earliestZ),
          window_variant: estimatedRateCase ? 'estimated_rate_consummation_case' : (fastCycle ? 'fast_cycle_25_day_floor' : 'standard_60_120'),
        });
      }

    } else if (rule === 'arm_initial_adjustment_notice') {
      // (d): at least 210 but no more than 240 days before the first payment at
      // the adjusted level; if that first payment is due within the first 210
      // days after consummation, the disclosures are provided at consummation.
      const p = needDate('first_adjusted_payment_date');
      if (p.refused) return { output_payload: p.payload, compliance_flags };
      const pay = p.z;
      const cons = needDate('consummation_date');
      if (cons.refused) return { output_payload: cons.payload, compliance_flags };
      const atConsummation = pay - cons.z <= 210;
      let earliestZ; let latestZ;
      if (atConsummation) { earliestZ = cons.z; latestZ = cons.z; }
      else { earliestZ = addCalendarDays(pay, -240); latestZ = addCalendarDays(pay, -210); }
      if (act === null) {
        out = obligation(rule, CITE.arm_initial_adjustment_notice, BASIS_CAL, null, Tiso, latestZ, act, 'within', null, {
          first_adjusted_payment_date: ev.first_adjusted_payment_date,
          consummation_date: ev.consummation_date,
          window_start_date: isoOf(earliestZ),
          window_variant: atConsummation ? 'at_consummation_disclosure_case' : 'standard_210_240',
        });
      } else {
        const a = parseIso(act);
        const ok = a >= earliestZ && a <= latestZ;
        out = obligation(rule, CITE.arm_initial_adjustment_notice, BASIS_CAL, null, Tiso, latestZ, act, ok ? 'met' : 'breached',
          ok ? null : (a < earliestZ ? 'disclosed_more_than_240_days_before_first_adjusted_payment' : (atConsummation ? 'not_disclosed_at_consummation' : 'disclosed_after_window_closed')), {
          first_adjusted_payment_date: ev.first_adjusted_payment_date,
          consummation_date: ev.consummation_date,
          window_start_date: isoOf(earliestZ),
          window_variant: atConsummation ? 'at_consummation_disclosure_case' : 'standard_210_240',
        });
      }
    }

    if (out !== null) obligations.push(out);
  }

  if (obligations.length > 0) compliance_flags.push('CLOCK_COMPUTED');

  const breached = obligations.filter((o) => o.state === 'breached').length;
  const evidence = {
    record_type: 'servicing_compliance_clock',
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    method: 'per_rule_due_date_arithmetic_over_pinned_paragraphs',
    events_computed: obligations.length,
    clocks_breached: breached,
    business_day_calendar: CALENDAR_NAME,
    computed_from: 'event_dates_and_loan_values_only',
    pii_carried: false,
    refusal_free: compliance_flags.indexOf('CLOCK_COMPUTED') !== -1,
  };

  const output_payload = {
    verdict: 'completed',
    obligations,
    evidence,
    manual_review_required: breached > 0,
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
