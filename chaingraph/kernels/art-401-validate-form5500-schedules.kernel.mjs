import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-401-validate-form5500-schedules';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_form5500_schedules',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Validates a Form 5500 schedule-applicability matrix (plan type/size -> required
// schedules), a Schedule H cross-schedule arithmetic tie (pure arithmetic), and
// the filing-deadline calculation (plan-year end + 7 months, +2.5-month Form
// 5558 extension). Public ERISA/DOL/IRS rule table -- Form 5500 and its
// instructions are themselves public federal filings, not a licensed spec.
//
// SHELF-ROW NOTE: this is FORM-LINT (structural schedule applicability and
// arithmetic), NOT retirement or plan-design advice. It falls squarely inside
// the RETIREMENT-1 options-shelf's "eligibility/compliance mechanics" lane, not
// the "which retirement vehicle should I use" advice lane that row fences off.
// table_version: "FORM5500-SCHEDULE-MATRIX-V1"

const TABLE_VERSION = 'FORM5500-SCHEDULE-MATRIX-V1';
const TABLE_SOURCE = 'DOL EBSA Form 5500 Instructions (dol.gov/agencies/ebsa); IRS Form 5500 series overview (irs.gov); ERISA Sec 103-104, 29 U.S.C. 1023-1024.';
const LARGE_PLAN_THRESHOLD = 100;
const TIE_TOLERANCE = 0.01;

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }
function safeNum(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function isIsoDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)); }

// Adds `months` calendar months to an ISO date, clamping to the last day of the
// target month if the source day-of-month overflows (deterministic, no locale).
function addCalendarMonths(isoDate, months, dayOfMonth) {
  const d = new Date(isoDate + 'T00:00:00Z');
  let y = d.getUTCFullYear();
  let m = d.getUTCMonth() + months;
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  const lastDayOfTarget = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const day = Math.min(dayOfMonth, lastDayOfTarget);
  return new Date(Date.UTC(y, m, day)).toISOString().slice(0, 10);
}

function lastDayOfMonth(isoDate, monthsAhead) {
  const d = new Date(isoDate + 'T00:00:00Z');
  let y = d.getUTCFullYear();
  let m = d.getUTCMonth() + monthsAhead;
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  return new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
}

export function compute(pp) {
  pp = pp || {};
  const plan_type = ['defined_benefit', 'defined_contribution', 'welfare'].includes(pp.plan_type) ? pp.plan_type : 'defined_contribution';
  const is_multiemployer = pp.is_multiemployer === true;
  const has_insurance_contracts = pp.has_insurance_contracts === true;
  const service_provider_comp_over_5000 = pp.service_provider_comp_over_5000 === true;
  const has_party_in_interest_transactions = pp.has_party_in_interest_transactions === true;
  const participant_count = safeNum(pp.participant_count);
  const plan_year_end = safeStr(pp.plan_year_end);
  const extension_filed = pp.extension_filed === true;

  const issues = [];
  if (participant_count === null || participant_count < 0) {
    issues.push({ code: 'PARTICIPANT_COUNT_INVALID', severity: 'ERROR', field: 'participant_count', message: 'Participant count absent, non-numeric, or negative.' });
  }
  const is_large_plan = (participant_count ?? 0) >= LARGE_PLAN_THRESHOLD;

  const required_schedules = [];
  if (is_large_plan) {
    required_schedules.push('H');
    if (service_provider_comp_over_5000) required_schedules.push('C');
    if (has_party_in_interest_transactions) required_schedules.push('G');
  } else {
    required_schedules.push('I');
  }
  if (has_insurance_contracts) required_schedules.push('A');
  if (plan_type === 'defined_benefit') {
    required_schedules.push(is_multiemployer ? 'MB' : 'SB');
    required_schedules.push('R');
  } else if (plan_type === 'defined_contribution') {
    required_schedules.push('R');
  }
  const required_schedules_sorted = [...new Set(required_schedules)].sort();

  // Cross-schedule arithmetic tie: Schedule H ending assets = beginning + net income - distributions.
  let arithmetic_tie = null;
  if (is_large_plan) {
    const beginning = safeNum(pp.schedule_h_beginning_assets);
    const net_income = safeNum(pp.schedule_h_net_income);
    const distributions = safeNum(pp.schedule_h_distributions);
    const ending = safeNum(pp.schedule_h_ending_assets);
    if (beginning === null || net_income === null || distributions === null || ending === null) {
      issues.push({ code: 'SCHEDULE_H_FIGURES_INCOMPLETE', severity: 'ERROR', field: 'schedule_h', message: 'Schedule H beginning/ending assets, net income, or distributions absent or non-numeric.' });
    } else {
      const expected_ending = +(beginning + net_income - distributions).toFixed(2);
      const ties = Math.abs(expected_ending - ending) <= TIE_TOLERANCE;
      arithmetic_tie = { expected_ending_assets: expected_ending, reported_ending_assets: ending, ties };
      if (!ties) {
        issues.push({ code: 'SCHEDULE_H_ARITHMETIC_MISMATCH', severity: 'ERROR', field: 'schedule_h', message: 'Schedule H ending assets (' + ending + ') do not equal beginning + net income - distributions (' + expected_ending + ').' });
      }
    }
  }

  // Filing deadline: last day of the 7th month after plan-year end; Form 5558
  // extension is 2.5 calendar months from that normal due date.
  let filing_deadline = null;
  let extended_filing_deadline = null;
  if (isIsoDate(plan_year_end)) {
    filing_deadline = lastDayOfMonth(plan_year_end, 7);
    // 2.5 months from the normal due date: +2 calendar months (clamped), then +15 days.
    const twoMonthsOn = addCalendarMonths(filing_deadline, 2, new Date(filing_deadline + 'T00:00:00Z').getUTCDate());
    const d = new Date(twoMonthsOn + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 15);
    extended_filing_deadline = d.toISOString().slice(0, 10);
  } else {
    issues.push({ code: 'PLAN_YEAR_END_INVALID', severity: 'ERROR', field: 'plan_year_end', message: 'Plan year end absent or not a valid ISO-8601 date.' });
  }
  const applicable_deadline = extension_filed ? extended_filing_deadline : filing_deadline;

  const error_count = issues.filter((i) => i.severity === 'ERROR').length;
  const warning_count = issues.filter((i) => i.severity === 'WARNING').length;
  const compliant = error_count === 0;

  const output_payload = {
    compliant,
    error_count,
    warning_count,
    is_large_plan,
    required_schedules: required_schedules_sorted,
    arithmetic_tie,
    filing_deadline,
    extended_filing_deadline,
    applicable_deadline,
    issues,
    disambiguation: 'validate_form5500_schedules checks the Form 5500 schedule-applicability matrix (plan type/size -> required schedules), the Schedule H arithmetic tie, and the filing-deadline calculation. It does not check schedule CONTENT beyond the presence of the tied figures.',
    shelf_note: 'This is FORM-LINT (structural schedule applicability and arithmetic), not retirement or plan-design advice -- it sits in the RETIREMENT-1 options-shelf compliance-mechanics lane, not the advice lane the shelf fences off.',
    table_version: TABLE_VERSION,
    table_source: TABLE_SOURCE,
    regulatory_basis: 'ERISA Sec 103-104 (29 U.S.C. 1023-1024); DOL EBSA Form 5500 Instructions; IRS Form 5500 series; Form 5558 (extension of time to file).',
  };

  const compliance_flags = [];
  if (!compliant) compliance_flags.push('FORM5500_SCHEDULE_NON_COMPLIANT');
  if (arithmetic_tie && arithmetic_tie.ties === false) compliance_flags.push('SCHEDULE_H_ARITHMETIC_MISMATCH');

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
