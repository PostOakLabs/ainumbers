/**
 * art-81-allocation-affirmation-conformance.kernel.mjs
 * Allocation / confirmation evidence preflight.
 *
 * Classifies allocation, confirmation, receipt-confirmation and settlement-instruction
 * events against caller-declared rules. Pure decision kernel: no DOM, no window,
 * no Date.now(), no ambient clock, no timezone database lookup. Every deadline is
 * derived from inputs the caller declares, so a run is reproducible from its
 * policy_parameters alone.
 *
 * Authority: the clause paths, digests and retrieval dates live in node metadata
 * (chaingraph/graph/nodes/art-81-allocation-affirmation-conformance.json →
 * standards_basis + cited_clause_digest[]), pinned by board row T1-AUTHORITY-PIN-1
 * and crosswalked in research/t1/T1-AUTHORITY-CROSSWALK-2026-09-24.md. Each
 * classification also emits the rule it was evaluated under in rule_applied, so an
 * artifact carries its own citation without this file restating one.
 *
 * The adopted EU text says "23:00 CET" and never defines CET against CEST, so the
 * reading is a caller-declared input and is printed with every result. See the
 * crosswalk section 4.
 *
 * EDUCATIONAL: outputs are decision-support drafts, not regulatory findings.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-81-allocation-affirmation-conformance';
const TOOL_VERSION = '2.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'check_allocation_affirmation',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

// ── applicability waves (the three dates the amending act itself sets out) ──
const WAVE_PRE          = 'pre-amendment';
const WAVE_AMENDMENT    = '2026-12-07'; // allocation, confirmation and retail rules
const WAVE_FIELDS       = '2027-07-01'; // instruction-field changes
const WAVE_INSTRUCTIONS = '2027-10-11'; // settlement-instruction timing

const REGIME_UK = 'UK_AST';

const READING_LOCAL = 'CENTRAL_EUROPEAN_LOCAL';

const ZONE_FIXED = 'FIXED_PLUS_1';
const ZONE_EU    = 'EU_LOCAL';
const ZONE_UK    = 'UK_LOCAL';

const EVENT_TYPES  = ['allocation', 'confirmation', 'receipt_confirmation', 'settlement_instruction'];
const FORMATS      = ['structured', 'unstructured'];
const CLIENT_TYPES = ['professional', 'retail'];

const CLASS_ON_TIME        = 'on_time';
const CLASS_LATE           = 'late';
const CLASS_NOT_EVALUABLE  = 'not_evaluable';
const CLASS_MALFORMED      = 'malformed';
const CLASS_DUPLICATE      = 'duplicate';
const CLASS_MISSING_CONF   = 'missing_confirmation';
const CLASS_FORMAT_NONCONF = 'format_nonconforming';
const CLASS_RECEIPT_LATE   = 'receipt_confirmation_late';
const CLASS_RECEIPT_NEXT   = 'receipt_confirmation_next_day_ok';

const EVALUATED_CLASSES = [CLASS_ON_TIME, CLASS_LATE, CLASS_FORMAT_NONCONF, CLASS_RECEIPT_LATE, CLASS_RECEIPT_NEXT];
const CONFORMING_CLASSES = [CLASS_ON_TIME, CLASS_RECEIPT_NEXT];

// ── civil-date arithmetic (no Date object anywhere in this kernel) ──────────
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const pad2 = (n) => String(n).padStart(2, '0');
const pad4 = (n) => String(n).padStart(4, '0');

function validCivil(y, m, d) {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (m < 1 || m > 12 || d < 1) return false;
  const dim = m === 2 && isLeap(y) ? 29 : DAYS_IN_MONTH[m - 1];
  return d <= dim;
}

/** Day number of a proleptic Gregorian civil date, counted from the Unix epoch (Hinnant). */
function daysFromCivil(y, m, d) {
  const yy = y - (m <= 2 ? 1 : 0);
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Inverse of daysFromCivil (Hinnant). */
function civilFromDays(z) {
  const zz = z + 719468;
  const era = Math.floor(zz / 146097);
  const doe = zz - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const yr = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return { y: yr + (m <= 2 ? 1 : 0), m, d };
}

/** 0 = Sunday. */
const weekday = (days) => (((days + 4) % 7) + 7) % 7;

/** Monday to Friday. No public-holiday calendar is applied; that limit is disclosed. */
function nextBusinessDay(days) {
  let d = days + 1;
  let guard = 0;
  while ((weekday(d) === 0 || weekday(d) === 6) && guard < 8) { d += 1; guard += 1; }
  return d;
}

/**
 * EU summer-time window, Directive 2000/84/EC: from 01:00 UTC on the last Sunday
 * of March to 01:00 UTC on the last Sunday of October. The UK observes the same
 * two instants. Applied to both EU_LOCAL and UK_LOCAL readings.
 */
function lastSundayDays(y, month) {
  const days = daysFromCivil(y, month, 31);
  return days - weekday(days);
}
function inSummer(utcMinutes, y) {
  const start = lastSundayDays(y, 3) * 1440 + 60;
  const end   = lastSundayDays(y, 10) * 1440 + 60;
  return utcMinutes >= start && utcMinutes < end;
}

/** Offset in minutes east of UTC for a local wall-clock instant in the named zone. */
function zoneOffset(zone, civilMinutes, y) {
  if (zone === ZONE_FIXED) return 60;
  const std = zone === ZONE_UK ? 0 : 60;
  const summer = zone === ZONE_UK ? 60 : 120;
  return inSummer(civilMinutes - std, y) ? summer : std;
}

/** UTC minutes for a local wall-clock time on a given civil day. */
function localToUtcMinutes(zone, days, hh, mm) {
  const civil = days * 1440 + hh * 60 + mm;
  const { y } = civilFromDays(days);
  return civil - zoneOffset(zone, civil, y);
}

function isoFromUtcMinutes(min) {
  const days = Math.floor(min / 1440);
  const rem = min - days * 1440;
  const { y, m, d } = civilFromDays(days);
  return `${pad4(y)}-${pad2(m)}-${pad2(d)}T${pad2(Math.floor(rem / 60))}:${pad2(rem % 60)}:00Z`;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TS_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})$/;
const HHMM_RE = /^(\d{2}):(\d{2})$/;

/** Calendar date to days, or null when absent or not a real date. */
function parseCivilDate(value) {
  if (typeof value !== 'string') return null;
  const m = DATE_RE.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
  if (!validCivil(y, mo, d)) return null;
  return daysFromCivil(y, mo, d);
}

/** "HH:MM" to minutes since local midnight, or null. */
function parseHhMm(value) {
  if (typeof value !== 'string') return null;
  const m = HHMM_RE.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]); const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/**
 * ISO-8601 timestamp with a MANDATORY explicit offset, to UTC minutes.
 * Returns a reason code instead of a value when the string cannot be trusted.
 */
function parseTimestamp(value) {
  if (typeof value !== 'string' || value.trim() === '') return { code: 'TIMESTAMP_MISSING' };
  const m = TS_RE.exec(value.trim());
  if (!m) return { code: 'TIMESTAMP_NOT_ISO_WITH_EXPLICIT_OFFSET' };
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
  const hh = Number(m[4]); const mi = Number(m[5]);
  if (!validCivil(y, mo, d)) return { code: 'TIMESTAMP_INVALID_CALENDAR_DATE' };
  if (hh > 23 || mi > 59) return { code: 'TIMESTAMP_INVALID_CLOCK_TIME' };
  const off = m[7];
  const offMin = off === 'Z' ? 0 : (off[0] === '-' ? -1 : 1) * (Number(off.slice(1, 3)) * 60 + Number(off.slice(4, 6)));
  return { utc: daysFromCivil(y, mo, d) * 1440 + hh * 60 + mi - offMin };
}

const trimmed = (value) => (typeof value === 'string' ? value.trim() : '');

function waveFor(logicalDays) {
  if (logicalDays < daysFromCivil(2026, 12, 7)) return WAVE_PRE;
  if (logicalDays < daysFromCivil(2027, 7, 1)) return WAVE_AMENDMENT;
  if (logicalDays < daysFromCivil(2027, 10, 11)) return WAVE_FIELDS;
  return WAVE_INSTRUCTIONS;
}

const waveAtLeast = (wave, target) =>
  [WAVE_PRE, WAVE_AMENDMENT, WAVE_FIELDS, WAVE_INSTRUCTIONS].indexOf(wave) >=
  [WAVE_PRE, WAVE_AMENDMENT, WAVE_FIELDS, WAVE_INSTRUCTIONS].indexOf(target);

const sortedUnique = (list) => [...new Set(list)].sort();

export function compute(pp) {
  // Every input is read directly off pp so scripts/gen-input-schemas.mjs can
  // derive a real type for each one from this source. Do not destructure.
  const regime = pp.regime ?? 'EU_CSDR';
  // `null` is read as "not declared", exactly like an absent property (R4).
  const regimeKnown = pp.regime === undefined || pp.regime === null || pp.regime === 'EU_CSDR' || pp.regime === 'UK_AST';
  const reading = pp.cutoff_timezone_reading ?? 'CET_LITERAL_UTC_PLUS_1';
  const readingKnown = pp.cutoff_timezone_reading === undefined
    || pp.cutoff_timezone_reading === null
    || pp.cutoff_timezone_reading === 'CET_LITERAL_UTC_PLUS_1'
    || pp.cutoff_timezone_reading === 'CENTRAL_EUROPEAN_LOCAL';
  const events = Array.isArray(pp.events) ? pp.events : [];
  const logicalDateRaw = typeof pp.logical_date === 'string' ? pp.logical_date.trim() : '';
  const ruleVersion = typeof pp?.rule_version === 'string' ? pp?.rule_version.trim() : '';
  const sourceDigests = Array.isArray(pp?.source_digests) ? pp?.source_digests : [];
  const closeRaw = typeof pp?.firm_close_of_business === 'string' ? pp?.firm_close_of_business.trim() : '';
  const startRaw = typeof pp?.firm_start_of_business === 'string' ? pp?.firm_start_of_business.trim() : '';
  const earlyAllocationAgreement = pp?.early_allocation_agreement === true;

  const logicalDays = parseCivilDate(logicalDateRaw);
  const closeMins = parseHhMm(closeRaw);
  const startMins = parseHhMm(startRaw);
  const isUk = regime === REGIME_UK;
  const zone = isUk ? ZONE_UK : (reading === READING_LOCAL ? ZONE_EU : ZONE_FIXED);

  const runBlockers = [];
  if (!regimeKnown) runBlockers.push('RUN_UNKNOWN_REGIME');
  if (!isUk && !readingKnown) runBlockers.push('RUN_UNKNOWN_TIMEZONE_READING');
  if (logicalDays === null) runBlockers.push('RUN_LOGICAL_DATE_MISSING_OR_INVALID');
  if (events.length === 0) runBlockers.push('RUN_NO_EVENTS');
  if (closeRaw !== '' && closeMins === null) runBlockers.push('RUN_CLOSE_OF_BUSINESS_NOT_HH_MM');
  if (startRaw !== '' && startMins === null) runBlockers.push('RUN_START_OF_BUSINESS_NOT_HH_MM');

  const wave = logicalDays === null ? null : waveFor(logicalDays);
  const postAmendment = wave !== null && waveAtLeast(wave, WAVE_AMENDMENT);
  const instructionsApply = wave !== null && waveAtLeast(wave, WAVE_INSTRUCTIONS);
  const blocked = runBlockers.some((code) => code !== 'RUN_NO_EVENTS');

  // ── pass 1: per-event classification ──────────────────────────────────────
  const rows = [];
  const seenKeys = new Set();
  const sourcesByReference = new Map();

  events.forEach((ev, index) => {
    const source = ev && typeof ev === 'object' ? ev : {};
    const eventType = trimmed(source.event_type);
    const reference = trimmed(source.reference);
    const format = trimmed(source.format);
    const clientType = trimmed(source.client_type);
    const codes = [];
    const row = {
      index,
      event_type: eventType === '' ? null : eventType,
      reference: reference === '' ? null : reference,
      event_timestamp: typeof source.event_timestamp === 'string' ? source.event_timestamp : null,
      trade_date: typeof source.trade_date === 'string' ? source.trade_date : null,
      format: format === '' ? null : format,
      client_type: clientType === '' ? null : clientType,
      classification: CLASS_NOT_EVALUABLE,
      deadline_utc: null,
      minutes_from_deadline: null,
      rule_applied: null,
      reason_codes: codes,
    };
    rows.push(row);

    if (blocked) { codes.push('RUN_INDETERMINATE'); return; }

    if (!EVENT_TYPES.includes(eventType)) codes.push('UNKNOWN_EVENT_TYPE');
    if (clientType !== '' && !CLIENT_TYPES.includes(clientType)) codes.push('UNKNOWN_CLIENT_TYPE');
    const formatBearing = eventType === 'allocation' || eventType === 'confirmation';
    if (formatBearing && format !== '' && !FORMATS.includes(format)) codes.push('UNKNOWN_FORMAT');
    if (source.unavailability_documented === true && reference === '') codes.push('UNAVAILABILITY_WITHOUT_DOCUMENTATION_REFERENCE');

    const ts = parseTimestamp(source.event_timestamp);
    if (ts.code) codes.push(ts.code);
    if (codes.length > 0) { row.classification = CLASS_MALFORMED; return; }

    const tradeDays = parseCivilDate(source.trade_date);
    if (tradeDays === null) {
      codes.push('TRADE_DATE_MISSING_OR_INVALID');
      row.classification = CLASS_NOT_EVALUABLE;
      return;
    }

    const key = `${eventType}|${reference}|${row.event_timestamp}|${row.trade_date}`;
    if (seenKeys.has(key)) {
      codes.push('DUPLICATE_EVENT_KEY');
      row.classification = CLASS_DUPLICATE;
      return;
    }
    seenKeys.add(key);

    row.utc = ts.utc;
    row.trade_days = tradeDays;

    if (eventType === 'receipt_confirmation') return; // resolved in pass 2 against its source

    if (eventType === 'settlement_instruction') {
      if (!instructionsApply) {
        codes.push('SETTLEMENT_INSTRUCTION_RULE_NOT_YET_APPLICABLE');
        row.rule_applied = isUk ? 'UK-TCC SETT 02, applies from 2027-10-11' : 'C(2026) 4640 Art. 1(3)(b), new Art. 5(5), applies from 2027-10-11';
        row.classification = CLASS_NOT_EVALUABLE;
        return;
      }
      const deadline = isUk
        ? localToUtcMinutes(ZONE_UK, nextBusinessDay(tradeDays), 5, 59)
        : localToUtcMinutes(zone, tradeDays, 23, 59);
      row.rule_applied = isUk
        ? 'UK-TCC SETT 02: CSD settlement instructions by 05:59 prevailing UK time on T+1'
        : 'C(2026) 4640 Art. 1(3)(b), new Art. 5(5): settlement instructions where feasible by 23:59 CET on trade date';
      row.deadline_utc = isoFromUtcMinutes(deadline);
      row.minutes_from_deadline = ts.utc - deadline;
      codes.push('SETTLEMENT_INSTRUCTION_INFORMATIONAL');
      if (ts.utc > deadline) codes.push('SETTLEMENT_INSTRUCTION_AFTER_FEASIBILITY_TIME');
      row.classification = ts.utc > deadline ? CLASS_LATE : CLASS_ON_TIME;
      return;
    }

    // allocation / confirmation
    if (reference !== '') {
      if (!sourcesByReference.has(reference)) sourcesByReference.set(reference, []);
      sourcesByReference.get(reference).push(row);
    }

    let deadline;
    if (isUk) {
      deadline = localToUtcMinutes(ZONE_UK, tradeDays, 23, 59);
      row.rule_applied = 'UK-TCC SETT 01: allocation and confirmation complete by 23:59 prevailing UK time on trade date';
    } else if (!postAmendment) {
      deadline = localToUtcMinutes(zone, nextBusinessDay(tradeDays), 12, 0);
      row.rule_applied = 'Delegated Regulation (EU) 2018/1229 Art. 2 before the amendment: written allocations and confirmations by 12:00 CET on the business day after trade date';
      codes.push('PRE_AMENDMENT_RULE_APPLIED');
    } else if (clientType === 'retail') {
      deadline = localToUtcMinutes(zone, tradeDays, 23, 0);
      row.rule_applied = 'C(2026) 4640 Art. 1(2), replaced Art. 3: retail settlement information by 23:00 CET on trade date';
      codes.push('RETAIL_RULE_APPLIED');
    } else {
      deadline = localToUtcMinutes(zone, tradeDays, 23, 0);
      row.rule_applied = 'C(2026) 4640 Art. 1(1)(b), amended Art. 2(2): written allocations and confirmations received by 23:00 CET on trade date';
    }
    row.deadline_utc = isoFromUtcMinutes(deadline);
    row.minutes_from_deadline = ts.utc - deadline;

    const late = ts.utc > deadline;
    if (late) codes.push(eventType === 'allocation' ? 'LATE_ALLOCATION' : 'LATE_CONFIRMATION');

    // structured-format mandate, EU regime only, from 2026-12-07
    let formatNonConforming = false;
    if (!isUk && postAmendment) {
      if (format === 'unstructured') {
        if (source.unavailability_documented === true) {
          codes.push('UNSTRUCTURED_UNDER_DOCUMENTED_UNAVAILABILITY');
        } else {
          codes.push('FORMAT_NOT_STRUCTURED');
          formatNonConforming = true;
        }
      } else if (format === '') {
        codes.push('FORMAT_NOT_DECLARED');
        formatNonConforming = true;
      }
    }

    row.classification = late ? CLASS_LATE : (formatNonConforming ? CLASS_FORMAT_NONCONF : CLASS_ON_TIME);
  });

  // ── pass 2: receipt confirmations against their source events ─────────────
  const receiptDutyApplies = !isUk && postAmendment && !blocked;
  const matchedReferences = new Set();

  for (const row of rows) {
    if (row.event_type !== 'receipt_confirmation') continue;
    if (row.classification === CLASS_MALFORMED || row.classification === CLASS_DUPLICATE) continue;
    if (row.reason_codes.includes('RUN_INDETERMINATE') || row.reason_codes.includes('TRADE_DATE_MISSING_OR_INVALID')) continue;

    if (!receiptDutyApplies) {
      row.reason_codes.push(isUk ? 'RECEIPT_CONFIRMATION_RULE_NOT_IN_UK_REGIME' : 'RECEIPT_CONFIRMATION_RULE_NOT_YET_APPLICABLE');
      row.classification = CLASS_NOT_EVALUABLE;
      continue;
    }

    const candidates = (sourcesByReference.get(row.reference) || [])
      .filter((s) => typeof s.utc === 'number' && s.utc <= row.utc);
    if (candidates.length === 0) {
      row.reason_codes.push('RECEIPT_CONFIRMATION_WITHOUT_MATCHING_SOURCE_EVENT');
      row.classification = CLASS_NOT_EVALUABLE;
      continue;
    }
    const src = candidates.reduce((a, b) => (b.utc > a.utc ? b : a));
    matchedReferences.add(row.reference);

    // Receipt-confirmation rule: confirm receipt within two hours; if the source
    // arrived less than one hour before close of business, confirm within one hour
    // after the start of the next business day. A source arriving after the declared
    // close is treated the same way as one inside that last hour; the adopted text is
    // silent on it and the reading is disclosed in the output.
    let deadline = src.utc + 120;
    let rule = 'C(2026) 4640 Art. 1(1)(b), amended Art. 2(2): receipt confirmed within two hours';
    if (closeMins !== null) {
      const closeUtc = localToUtcMinutes(zone, src.trade_days, Math.floor(closeMins / 60), closeMins % 60);
      if (src.utc > closeUtc - 60) {
        if (startMins === null) {
          row.reason_codes.push('NEXT_BUSINESS_DAY_RULE_NEEDS_START_OF_BUSINESS');
          row.classification = CLASS_NOT_EVALUABLE;
          continue;
        }
        const nextStart = localToUtcMinutes(zone, nextBusinessDay(src.trade_days), Math.floor(startMins / 60), startMins % 60);
        deadline = nextStart + 60;
        rule = 'C(2026) 4640 Art. 1(1)(b), amended Art. 2(2): source received less than one hour before close of business, so receipt is confirmed within one hour after the start of the next business day';
        row.reason_codes.push(src.utc > closeUtc ? 'SOURCE_RECEIVED_AFTER_CLOSE_OF_BUSINESS' : 'SOURCE_RECEIVED_WITHIN_LAST_HOUR_BEFORE_CLOSE');
        row.deadline_utc = isoFromUtcMinutes(deadline);
        row.minutes_from_deadline = row.utc - deadline;
        row.rule_applied = rule;
        if (row.utc > deadline) {
          row.reason_codes.push('RECEIPT_CONFIRMATION_AFTER_NEXT_DAY_DEADLINE');
          row.classification = CLASS_RECEIPT_LATE;
        } else {
          row.classification = CLASS_RECEIPT_NEXT;
        }
        continue;
      }
    }
    row.deadline_utc = isoFromUtcMinutes(deadline);
    row.minutes_from_deadline = row.utc - deadline;
    row.rule_applied = rule;
    if (row.utc > deadline) {
      row.reason_codes.push('RECEIPT_CONFIRMATION_AFTER_TWO_HOURS');
      row.classification = CLASS_RECEIPT_LATE;
    } else {
      row.classification = CLASS_ON_TIME;
    }
  }

  // ── pass 3: sources with no receipt confirmation at all ───────────────────
  const unresolved = [];
  if (receiptDutyApplies && !earlyAllocationAgreement) {
    for (const row of rows) {
      if (row.event_type !== 'allocation' && row.event_type !== 'confirmation') continue;
      if (!EVALUATED_CLASSES.includes(row.classification)) continue;
      if (row.reference !== null && matchedReferences.has(row.reference)) continue;
      unresolved.push({
        classification: CLASS_MISSING_CONF,
        index: row.index,
        event_type: row.event_type,
        reference: row.reference,
        rule_applied: 'C(2026) 4640 Art. 1(1)(b), amended Art. 2(2): the firm confirms receipt of the allocation or confirmation',
        reason_codes: row.reference === null
          ? ['RECEIPT_CONFIRMATION_NOT_PRESENT', 'NO_REFERENCE_TO_MATCH_ON']
          : ['RECEIPT_CONFIRMATION_NOT_PRESENT'],
      });
    }
  }

  // ── counts, rate, issues ──────────────────────────────────────────────────
  const counts = {
    submitted: events.length,
    evaluated: 0,
    excluded: 0,
    on_time: 0,
    late: 0,
    format_nonconforming: 0,
    receipt_confirmation_late: 0,
    receipt_confirmation_next_day_ok: 0,
    malformed: 0,
    not_evaluable: 0,
    duplicate: 0,
    unresolved: unresolved.length,
  };
  for (const row of rows) {
    if (row.classification === CLASS_ON_TIME) counts.on_time += 1;
    else if (row.classification === CLASS_LATE) counts.late += 1;
    else if (row.classification === CLASS_FORMAT_NONCONF) counts.format_nonconforming += 1;
    else if (row.classification === CLASS_RECEIPT_LATE) counts.receipt_confirmation_late += 1;
    else if (row.classification === CLASS_RECEIPT_NEXT) counts.receipt_confirmation_next_day_ok += 1;
    else if (row.classification === CLASS_MALFORMED) counts.malformed += 1;
    else if (row.classification === CLASS_DUPLICATE) counts.duplicate += 1;
    else counts.not_evaluable += 1;
    if (EVALUATED_CLASSES.includes(row.classification)) counts.evaluated += 1;
    else counts.excluded += 1;
  }

  const conforming = counts.on_time + counts.receipt_confirmation_next_day_ok;
  const status = counts.evaluated > 0 ? 'evaluated' : 'indeterminate';
  const on_time_rate = status === 'evaluated' ? +((conforming / counts.evaluated) * 100).toFixed(1) : null;

  const issueCounts = new Map();
  for (const row of rows) for (const code of row.reason_codes) issueCounts.set(code, (issueCounts.get(code) || 0) + 1);
  for (const item of unresolved) for (const code of item.reason_codes) issueCounts.set(code, (issueCounts.get(code) || 0) + 1);
  for (const code of runBlockers) issueCounts.set(code, (issueCounts.get(code) || 0) + 1);
  const issues = [...issueCounts.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([code, count]) => ({ code, count }));

  // ── disclosures ───────────────────────────────────────────────────────────
  const disclosures = [];
  if (isUk) {
    disclosures.push('Deadlines are evaluated against prevailing UK time (GMT or BST), per UK-TCC footnote 15. The cutoff_timezone_reading input is not applied under the UK regime.');
  } else {
    disclosures.push(reading === READING_LOCAL
      ? 'Deadlines are evaluated against 23:00 Central European local time (CET in winter, CEST in summer). The regulation states "23:00 CET" and does not define CET against CEST; see T1-AUTHORITY-CROSSWALK-2026-09-24 section 4.'
      : 'Deadlines are evaluated against 23:00 read as a fixed UTC+1 offset all year. The regulation states "23:00 CET" and does not define CET against CEST; see T1-AUTHORITY-CROSSWALK-2026-09-24 section 4.');
  }
  disclosures.push('Business days are Monday to Friday. No public-holiday calendar is applied, so a next-business-day deadline that falls on a public holiday is not adjusted.');
  if (wave === WAVE_PRE) disclosures.push('logical_date falls before 2026-12-07, so allocation and confirmation events are classified under the rule in force before the amendment and are labelled accordingly. The amended rule is never applied early.');
  if (!isUk && postAmendment && earlyAllocationAgreement) disclosures.push('early_allocation_agreement is declared, so the written-agreement case in amended Art. 2(3) applies and no missing-confirmation finding is raised.');
  if (rows.some((r) => r.reason_codes.includes('UNSTRUCTURED_UNDER_DOCUMENTED_UNAVAILABILITY'))) disclosures.push('One or more unstructured events carry a caller-declared documented-unavailability flag with a documentation reference. The flag is never inferred, and this kernel does not test whether the documentation itself is adequate.');
  if (rows.some((r) => r.event_type === 'settlement_instruction')) disclosures.push('Settlement-instruction timing under new Art. 5(5) is stated as "where feasible", so it is reported for information and carries no conformance meaning.');
  if (rows.some((r) => r.reason_codes.includes('SOURCE_RECEIVED_AFTER_CLOSE_OF_BUSINESS'))) disclosures.push('One or more source events were received after the declared close of business. The adopted text addresses only the last hour before close, so these are evaluated under the next-business-day rule and the reading is declared here rather than implied.');
  if (ruleVersion === '') disclosures.push('No rule_version was declared, so the result cannot be tied to a pinned version of the rule text.');
  if (sourceDigests.length === 0) disclosures.push('No source_digests were declared, so the rule text behind this result is not bound to a pinned digest.');

  const compliance_flags = sortedUnique([
    ...(counts.late > 0 ? ['LATE_EVENTS'] : []),
    ...(counts.format_nonconforming > 0 ? ['FORMAT_NONCONFORMING'] : []),
    ...(counts.receipt_confirmation_late > 0 ? ['RECEIPT_CONFIRMATION_LATE'] : []),
    ...(unresolved.length > 0 ? ['MISSING_CONFIRMATION'] : []),
    ...(counts.malformed > 0 ? ['MALFORMED_EVENTS'] : []),
    ...(counts.duplicate > 0 ? ['DUPLICATE_EVENTS'] : []),
    ...(counts.not_evaluable > 0 ? ['NOT_EVALUABLE_EVENTS'] : []),
    ...(status === 'indeterminate' ? ['INDETERMINATE'] : []),
  ]);

  const output_payload = {
    status,
    on_time_rate,
    rate_basis: 'on-time and conforming events divided by evaluated events. Malformed, not-evaluable and duplicate events are excluded from both sides and reported separately. No rate is produced when nothing could be evaluated.',
    counts,
    events: rows.map((row) => ({
      index: row.index,
      event_type: row.event_type,
      reference: row.reference,
      event_timestamp: row.event_timestamp,
      trade_date: row.trade_date,
      format: row.format,
      client_type: row.client_type,
      classification: row.classification,
      deadline_utc: row.deadline_utc,
      minutes_from_deadline: row.minutes_from_deadline,
      rule_applied: row.rule_applied,
      reason_codes: row.reason_codes,
    })),
    unresolved,
    issues,
    regime,
    logical_date: logicalDateRaw === '' ? null : logicalDateRaw,
    applicability_wave: wave,
    applicability_dates: {
      allocation_confirmation_and_retail: '2026-12-07',
      instruction_fields: '2027-07-01',
      settlement_instructions: '2027-10-11',
    },
    cutoff_timezone_reading: isUk ? 'not_applicable_under_uk_regime' : reading,
    cutoff_disclosure: disclosures[0],
    rule_version: ruleVersion === '' ? null : ruleVersion,
    source_digests: sourceDigests,
    disclosures,
    evidence_labels: {
      rule_text_and_digests: 'hash_verified',
      event_classification: 'kernel_verified',
      event_timestamps_and_flags: 'connector_asserted',
      documented_unavailability: 'human_attested',
      receipt_confirmations: 'external_ack_captured',
    },
    note: 'DECISION-SUPPORT DRAFT, not a regulatory finding and not a certification. Deadlines come from caller-declared inputs; this kernel reads no clock and resolves no timezone database. It does not verify that the underlying records are complete or true.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    compute_mode:       'server',
    mandate_type:       meta.mandate_type,
    tool_id:            TOOL_ID,
    tool_version:       TOOL_VERSION,
    generated_at:       now ?? null,
    execution_hash:     hash,
    chain:              { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:  pp,
    output_payload,
    compliance_flags,
    audit_signature:    { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
