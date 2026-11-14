import { executionHash } from './_hash.mjs';

// art-842-soc-report-coverage-gap — recomputes coverage and gap arithmetic from DECLARED values: which
// declared complementary user entity control ids have no declared mapped control, which declared
// subservice organisation ids are carved out, and how many whole days lie between the declared report
// period end and the declared fiscal year-end. Dates are strict ISO calendar dates handled as integer
// day numbers (no clock, no locale parsing). It does not read the report, does not assess whether any
// control is effective, and is not an audit opinion. Ids and dates only, no free text.
//
// DETERMINISM: compute() is a pure function of pp (no clock, no randomness, no I/O, no TextEncoder).

const TOOL_ID = 'art-842-soc-report-coverage-gap';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_soc_report_coverage_gap',
  mandate_type: 'compliance_control', gpu: false,
};

const MAX_CUECS = 256;
const MAX_SUBSERVICE = 64;
const MAX_EXCEPTIONS = 1000000;
const STALE_DAYS = 365;
const ID_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const REPORT_TYPES = ['type1', 'type2'];
const OPINIONS = ['unmodified', 'qualified', 'adverse', 'disclaimer'];
const TREATMENTS = ['carved_out', 'inclusive'];

// Days from the civil date (proleptic Gregorian) to 1970-01-01. Pure integer arithmetic.
function dayNumber(y, m, d) {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const mp = (m + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function daysInMonth(y, m) {
  if (m === 2) return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
  return m === 4 || m === 6 || m === 9 || m === 11 ? 30 : 31;
}

// Strict ISO date to a day number; null for any other shape or an impossible date.
function parseIsoDate(v) {
  if (typeof v !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v)) return null;
  const y = Number(v.slice(0, 4));
  const m = Number(v.slice(5, 7));
  const d = Number(v.slice(8, 10));
  if (y < 1970 || y > 2200 || m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return dayNumber(y, m, d);
}

// Refusal code for an id-like string: an email-like or name-like value gets its own code.
function idRefusal(v) {
  if (typeof v !== 'string') return 'ID_NOT_A_STRING';
  if (ID_RE.test(v)) return null;
  if (v.includes('@')) return 'ID_EMAIL_LIKE';
  if (/[A-Z ]/.test(v)) return 'ID_NAME_LIKE';
  return 'ID_PATTERN_INVALID';
}

function emptyPayload(pp, code, missing) {
  return {
    report_type: REPORT_TYPES.includes(pp.report_type) ? pp.report_type : null,
    covers_fiscal_year_end: null,
    bridge_gap_days: null,
    days_since_period_end: null,
    cuec_total: null,
    cuec_mapped_count: null,
    cuec_uncovered_count: null,
    uncovered_cuec_ids: [],
    carved_out_subservice_ids: [],
    carved_out_count: null,
    opinion_or_exception_flag: null,
    indeterminate: missing.length > 0 && !code,
    refusal_code: code,
    missing_facts: missing,
    warnings: [],
  };
}

function refuse(pp, code, missing) {
  const compliance_flags = [...(code ? ['INPUT_REFUSED', code] : []), ...(!code && missing.length ? ['INDETERMINATE'] : [])];
  const output_payload = emptyPayload(pp, code, missing);
  output_payload.warnings = compliance_flags.slice();
  return { output_payload, compliance_flags };
}

/**
 * compute(pp) — pure coverage and gap kernel.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  let code = null;
  const missing = [];
  const setCode = (c) => { if (code === null) code = c; };

  // ---- scalar facts: absent => missing, present but malformed => refused ----
  if (pp.report_type == null) missing.push('report_type');
  else if (!REPORT_TYPES.includes(pp.report_type)) setCode('REPORT_TYPE_INVALID');
  if (pp.opinion_type == null) missing.push('opinion_type');
  else if (!OPINIONS.includes(pp.opinion_type)) setCode('OPINION_TYPE_INVALID');
  if (pp.exception_count == null) missing.push('exception_count');
  else if (!Number.isSafeInteger(pp.exception_count) || pp.exception_count < 0 || pp.exception_count > MAX_EXCEPTIONS) setCode('EXCEPTION_COUNT_INVALID');

  const dateFields = ['period_start', 'period_end', 'fiscal_year_end', 'as_of_date'];
  const days = {};
  for (const f of dateFields) {
    if (pp[f] == null) { missing.push(f); continue; }
    const dn = parseIsoDate(pp[f]);
    if (dn === null) setCode('DATE_INVALID');
    else days[f] = dn;
  }

  // ---- lists ----
  const seenCuec = new Set();
  const cuecs = [];
  if (pp.cuecs == null) missing.push('cuecs');
  else if (!Array.isArray(pp.cuecs) || pp.cuecs.length > MAX_CUECS) setCode('CUEC_LIST_INVALID');
  else {
    for (const c of pp.cuecs) {
      if (c == null || typeof c !== 'object') { setCode('CUEC_ENTRY_INVALID'); continue; }
      const r = idRefusal(c.id);
      if (r) { setCode(r); continue; }
      if (seenCuec.has(c.id)) { setCode('DUPLICATE_ID'); continue; }
      seenCuec.add(c.id);
      if (!Object.prototype.hasOwnProperty.call(c, 'mapped_control_id')) {
        if (!missing.includes('cuecs.mapped_control_id')) missing.push('cuecs.mapped_control_id');
        continue;
      }
      if (c.mapped_control_id !== null) {
        const mr = idRefusal(c.mapped_control_id);
        if (mr) { setCode(mr); continue; }
      }
      cuecs.push({ id: c.id, mapped: c.mapped_control_id !== null });
    }
  }
  const seenSub = new Set();
  const subs = [];
  if (pp.subservice_orgs == null) missing.push('subservice_orgs');
  else if (!Array.isArray(pp.subservice_orgs) || pp.subservice_orgs.length > MAX_SUBSERVICE) setCode('SUBSERVICE_LIST_INVALID');
  else {
    for (const s of pp.subservice_orgs) {
      if (s == null || typeof s !== 'object') { setCode('SUBSERVICE_ENTRY_INVALID'); continue; }
      const r = idRefusal(s.id);
      if (r) { setCode(r); continue; }
      if (seenSub.has(s.id)) { setCode('DUPLICATE_ID'); continue; }
      seenSub.add(s.id);
      if (s.treatment == null) {
        if (!missing.includes('subservice_orgs.treatment')) missing.push('subservice_orgs.treatment');
        continue;
      }
      if (!TREATMENTS.includes(s.treatment)) { setCode('TREATMENT_INVALID'); continue; }
      subs.push({ id: s.id, carved: s.treatment === 'carved_out' });
    }
  }

  // ---- cross-field date rules (only when all four dates parsed) ----
  if (code === null && missing.length === 0) {
    if (days.period_end < days.period_start) setCode('PERIOD_ORDER_INVALID');
    else if (days.as_of_date < days.period_end) setCode('AS_OF_BEFORE_PERIOD_END');
  }
  if (code !== null || missing.length > 0) return refuse(pp, code, missing);

  // ---- arithmetic ----
  const covers = days.period_start <= days.fiscal_year_end && days.fiscal_year_end <= days.period_end;
  const gap = days.fiscal_year_end > days.period_end ? days.fiscal_year_end - days.period_end : 0;
  const sinceEnd = days.as_of_date - days.period_end;
  const uncovered = cuecs.filter((c) => !c.mapped).map((c) => c.id).sort();
  const carved = subs.filter((s) => s.carved).map((s) => s.id).sort();
  const mappedCount = cuecs.length - uncovered.length;
  const reviewFlag = pp.opinion_type !== 'unmodified' || pp.exception_count > 0;

  const flags = [];
  if (pp.report_type === 'type1') flags.push('TYPE1_POINT_IN_TIME_ONLY');
  if (gap > 0) flags.push('BRIDGE_GAP_PRESENT');
  if (days.fiscal_year_end < days.period_start) flags.push('YEAR_END_BEFORE_PERIOD');
  if (uncovered.length > 0) flags.push('UNCOVERED_CUEC');
  if (carved.length > 0) flags.push('CARVE_OUT_NEEDS_OWN_REPORT');
  if (pp.opinion_type !== 'unmodified') flags.push('OPINION_NOT_UNMODIFIED');
  if (pp.exception_count > 0) flags.push('EXCEPTIONS_PRESENT');
  if (sinceEnd > STALE_DAYS) flags.push('REPORT_PERIOD_END_OVER_365_DAYS_BEFORE_AS_OF');

  const compliance_flags = flags.slice();
  const output_payload = {
    report_type: pp.report_type,
    covers_fiscal_year_end: covers,
    bridge_gap_days: gap,
    days_since_period_end: sinceEnd,
    cuec_total: cuecs.length,
    cuec_mapped_count: mappedCount,
    cuec_uncovered_count: uncovered.length,
    uncovered_cuec_ids: uncovered,
    carved_out_subservice_ids: carved,
    carved_out_count: carved.length,
    opinion_or_exception_flag: reviewFlag,
    indeterminate: false,
    refusal_code: null,
    missing_facts: [],
    warnings: compliance_flags.slice(),
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
