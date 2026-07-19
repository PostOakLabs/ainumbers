import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-397-lint-trace-cat-reports';
const TOOL_VERSION = '1.0.0';
const RULES_VERSION = 'trace-6730-cat-lint-2026.1';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'lint_trace_cat_reports',
  mandate_type: 'compliance_mandate', gpu: false,
};

// TRACE (FINRA Rule 6730) trade-report timeliness lint plus a CAT (Consolidated Audit
// Trail) equity/option event structural format-lint. TRACE timeliness is computed against
// a CALLER-DECLARED trading calendar (weekend days + explicit holiday list) and trading
// hours window, per the band-wide versioned-constants rule -- there is no built-in market
// calendar. The CAT lint checks a representative subset of required event fields for
// equity and option order-lifecycle events; it is honestly scoped as a format/structure
// check against that subset, NOT a full implementation of the CAT Reporting Technical
// Specification, and does not validate against FINRA's CAT NMS Plan schema in full.
//
// Pure ECMA-262 arithmetic only -- no Date.now/argless new Date(), no Math.random. All
// dates/times are derived from caller-supplied ISO-8601 timestamp strings via Date.parse,
// which is a pure function of its input, never wall-clock time. Finite gate: a timestamp
// that fails to parse resolves to a null deadline/verdict rather than NaN, and every
// bounded search loop below has an explicit iteration cap so it can never hang.

const MS_DAY = 86400000;
const CALENDAR_SEARCH_CAP_DAYS = 30; // finite-gate bound on the next-trading-day search

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function arr(v) { return Array.isArray(v) ? v : []; }
function str(v) { return typeof v === 'string' ? v : ''; }

function parseCalendar(cal) {
  cal = cal || {};
  const weekendDays = new Set(Array.isArray(cal.weekend_days) ? cal.weekend_days.map((d) => Math.trunc(safeNum(d, -1))) : [0, 6]);
  const holidays = new Set(Array.isArray(cal.holidays) ? cal.holidays.filter((h) => typeof h === 'string') : []);
  return { weekendDays, holidays, calendar_version: str(cal.calendar_version) || 'unspecified' };
}

function isoDate(ms) { return new Date(ms).toISOString().slice(0, 10); }
function dayStartMs(ms) { return Math.floor(ms / MS_DAY) * MS_DAY; }
function isTradingDay(ms, cal) {
  const dow = new Date(ms).getUTCDay();
  if (cal.weekendDays.has(dow)) return false;
  if (cal.holidays.has(isoDate(ms))) return false;
  return true;
}

function nextTradingDayStart(fromMs, cal, hours) {
  let day = dayStartMs(fromMs) + MS_DAY;
  for (let i = 0; i < CALENDAR_SEARCH_CAP_DAYS; i++) {
    if (isTradingDay(day, cal)) return day + hours.startMin * 60000;
    day += MS_DAY;
  }
  return null; // calendar exhausted (pathological all-holiday input) -- finite gate: null, never NaN
}

function parseHours(h) {
  h = h || {};
  return { startMin: Math.trunc(safeNum(h.start_minutes_utc, 480)), endMin: Math.trunc(safeNum(h.end_minutes_utc, 1110)) };
}

function computeTraceDeadline(executionMs, cal, hours, windowMin) {
  const dStart = dayStartMs(executionMs);
  const tStart = dStart + hours.startMin * 60000;
  const tEnd = dStart + hours.endMin * 60000;
  const withinHours = isTradingDay(dStart, cal) && executionMs >= tStart && executionMs <= tEnd;

  if (withinHours) {
    const candidate = executionMs + windowMin * 60000;
    if (candidate <= tEnd) return candidate;
    return nextTradingDayStart(dStart, cal, hours) === null ? null : nextTradingDayStart(dStart, cal, hours) + windowMin * 60000;
  }
  const nextOpen = nextTradingDayStart(executionMs, cal, hours);
  return nextOpen === null ? null : nextOpen + windowMin * 60000;
}

function lintTrace(pp) {
  const cal = parseCalendar(pp.calendar);
  const hours = parseHours(pp.trading_hours);
  const windowMin = Math.max(0, safeNum(pp.report_window_minutes, 15));

  const execStr = str(pp.execution_timestamp);
  const repStr = str(pp.report_timestamp);
  const executionMs = Date.parse(execStr);
  const reportMs = Date.parse(repStr);

  if (!Number.isFinite(executionMs) || !Number.isFinite(reportMs)) {
    return {
      valid_timestamps: false, deadline_utc: null, timely: null, late_by_minutes: null,
      execution_timestamp: execStr || null, report_timestamp: repStr || null,
      calendar_version: cal.calendar_version, report_window_minutes: windowMin,
    };
  }

  const deadline = computeTraceDeadline(executionMs, cal, hours, windowMin);
  const timely = deadline === null ? null : reportMs <= deadline;
  const lateByMinutes = deadline === null ? null : Math.max(0, Math.round((reportMs - deadline) / 60000));

  return {
    valid_timestamps: true,
    execution_timestamp: new Date(executionMs).toISOString(),
    report_timestamp: new Date(reportMs).toISOString(),
    deadline_utc: deadline === null ? null : new Date(deadline).toISOString(),
    timely,
    late_by_minutes: lateByMinutes,
    calendar_version: cal.calendar_version,
    report_window_minutes: windowMin,
  };
}

const CAT_REQUIRED_EQUITY = ['event_type', 'event_timestamp', 'firm_designated_id', 'order_id', 'symbol', 'side', 'quantity'];
const CAT_REQUIRED_OPTION = ['event_type', 'event_timestamp', 'firm_designated_id', 'order_id', 'symbol', 'side', 'quantity', 'option_type', 'strike_price', 'expiration_date'];

function lintCatEvent(ev, idx) {
  ev = ev || {};
  const category = ev.event_category === 'option' ? 'option' : 'equity';
  const required = category === 'option' ? CAT_REQUIRED_OPTION : CAT_REQUIRED_EQUITY;
  const missing_fields = required.filter((f) => ev[f] === undefined || ev[f] === null || ev[f] === '');
  const type_errors = [];

  if (ev.quantity !== undefined && !(Number.isFinite(Number(ev.quantity)) && Number(ev.quantity) > 0)) {
    type_errors.push('quantity must be a positive number');
  }
  if (ev.event_timestamp !== undefined && !Number.isFinite(Date.parse(str(ev.event_timestamp)))) {
    type_errors.push('event_timestamp must be a parseable ISO-8601 string');
  }
  if (category === 'option' && ev.strike_price !== undefined && !(Number.isFinite(Number(ev.strike_price)) && Number(ev.strike_price) > 0)) {
    type_errors.push('strike_price must be a positive number');
  }

  return {
    index: idx, event_category: category,
    structurally_valid: missing_fields.length === 0 && type_errors.length === 0,
    missing_fields, type_errors,
  };
}

export function compute(pp) {
  pp = pp || {};
  const trace_result = lintTrace(pp);
  const cat_results = arr(pp.cat_events).map(lintCatEvent);
  const cat_valid_count = cat_results.filter((r) => r.structurally_valid).length;
  const cat_invalid = cat_results.filter((r) => !r.structurally_valid);

  const compliance_flags = [];
  if (trace_result.valid_timestamps === false) compliance_flags.push('TRACE_TIMESTAMPS_UNPARSEABLE');
  else if (trace_result.timely === null) compliance_flags.push('TRACE_DEADLINE_CALENDAR_EXHAUSTED');
  else compliance_flags.push(trace_result.timely ? 'TRACE_REPORT_TIMELY' : 'TRACE_REPORT_LATE');

  if (cat_results.length === 0) compliance_flags.push('CAT_NO_EVENTS_SUPPLIED');
  else compliance_flags.push(cat_invalid.length === 0 ? 'CAT_ALL_EVENTS_STRUCTURALLY_VALID' : 'CAT_STRUCTURAL_VIOLATIONS_FOUND');

  const output_payload = {
    trace_result,
    cat_events_checked: cat_results.length,
    cat_events_valid: cat_valid_count,
    cat_violations: cat_invalid,
    rules_version: RULES_VERSION,
    regulatory_basis: 'FINRA Rule 6730 (TRACE trade-reporting timeliness); CAT NMS Plan equity/option order-event structure (representative field subset, not the full CAT Reporting Technical Specification).',
    note: 'TRACE deadline computed against the caller-declared trading calendar and hours window -- there is no built-in market calendar. CAT check covers a representative subset of required event fields and is not a full CAT schema conformance check.',
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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
