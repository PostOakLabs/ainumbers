import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-405-check-private-student-loan-disclosures';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_private_student_loan_disclosures',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Private education loan disclosure-element checklist across the three
// Regulation F -- correction, Regulation Z -- 12 CFR 1026.46-48 stages
// (application/solicitation 1026.47(a), approval 1026.47(b), final
// 1026.47(c)), the HEOA self-certification-form presence requirement
// (1026.48(e)), and the 3-BUSINESS-DAY right-to-cancel window math
// (1026.48(d)) counted from a declared final-disclosure date, skipping
// weekends and any declared holiday dates. FEDERAL IDR CALCULATIONS ARE
// EXPLICITLY OUT OF SCOPE V1 -- those formulas change on an administration/
// policy cycle (a "constants churn" source distinct from the stable,
// long-standing 1026.46-48 element/timing requirements checked here), and are
// flagged as a future rider trigger rather than built.
// table_version: "REGZ-1026-46-48-PRIVATE-STUDENT-LOAN-CHECKLIST-V1"

const TABLE_VERSION = 'REGZ-1026-46-48-PRIVATE-STUDENT-LOAN-CHECKLIST-V1';
const TABLE_SOURCE = '12 CFR 1026.46-48 (Regulation Z private education loans); HEOA self-certification requirement (1026.48(e)); 3-business-day right-to-cancel (1026.48(d)).';

const REQUIRED_APPLICATION_ELEMENTS = [
  'interest-rate-or-range',
  'fees-and-default-charges',
  'repayment-terms',
  'cosigner-rights-disclosure',
  'estimated-total-cost',
];
const REQUIRED_APPROVAL_ELEMENTS = [
  'confirmed-interest-rate',
  'confirmed-fees',
  'confirmed-repayment-terms',
  'right-to-accept-30-days-disclosure',
  'rate-lock-period-disclosure',
];
const REQUIRED_FINAL_ELEMENTS = [
  'final-interest-rate',
  'final-fees',
  'final-repayment-schedule',
  'right-to-cancel-3-day-disclosure',
];

const MS_PER_DAY = 86400000;

function statusOf(map, key) { return map[key] || 'absent'; }

function toUtcMidnight(iso) {
  if (typeof iso !== 'string') return NaN;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return NaN;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(t) ? t : NaN;
}
// Civil-date-from-days-since-epoch (Howard Hinnant's algorithm) -- pure integer
// arithmetic, no Date object instantiation.
function civilFromDays(z) {
  z += 719468;
  const era = Math.floor((z >= 0 ? z : z - 146096) / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return [y + (m <= 2 ? 1 : 0), m, d];
}
function isoFromDayCount(totalDays) {
  const [y, m, d] = civilFromDays(totalDays);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function dayOfWeek(totalDays) {
  // 1970-01-01 (day 0) was a Thursday (4). 0=Sunday..6=Saturday.
  return ((totalDays % 7) + 7 + 4) % 7;
}

function checklistPass(elements, required) {
  const elementMap = {};
  for (const entry of elements) if (entry && entry.element) elementMap[entry.element] = entry.status;
  const element_status = {};
  const gaps = [];
  for (const el of required) {
    const status = statusOf(elementMap, el);
    element_status[el] = status;
    if (status !== 'complete') gaps.push(el);
  }
  return { element_status, gaps };
}

export function compute(pp) {
  pp = pp || {};
  const { inputs = {} } = pp;
  const {
    application_elements = [],
    approval_elements = [],
    final_elements = [],
    self_certification_present = false,
    final_disclosure_date = '',
    holiday_dates = [],
  } = inputs;

  const application = checklistPass(application_elements, REQUIRED_APPLICATION_ELEMENTS);
  const approval = checklistPass(approval_elements, REQUIRED_APPROVAL_ELEMENTS);
  const final = checklistPass(final_elements, REQUIRED_FINAL_ELEMENTS);

  const total_required = REQUIRED_APPLICATION_ELEMENTS.length + REQUIRED_APPROVAL_ELEMENTS.length + REQUIRED_FINAL_ELEMENTS.length;
  const total_gaps = application.gaps.length + approval.gaps.length + final.gaps.length;

  let completeness_grade;
  if (total_gaps === 0) completeness_grade = 'A';
  else if (total_gaps <= 1) completeness_grade = 'B';
  else if (total_gaps <= 3) completeness_grade = 'C';
  else if (total_gaps <= 6) completeness_grade = 'D';
  else completeness_grade = 'F';

  const compliance_flags = [];
  if (application.gaps.length > 0) compliance_flags.push('APPLICATION_DISCLOSURE_ELEMENTS_INCOMPLETE');
  if (approval.gaps.length > 0) compliance_flags.push('APPROVAL_DISCLOSURE_ELEMENTS_INCOMPLETE');
  if (final.gaps.length > 0) compliance_flags.push('FINAL_DISCLOSURE_ELEMENTS_INCOMPLETE');
  if (!self_certification_present) compliance_flags.push('SELF_CERTIFICATION_FORM_MISSING');

  // 3-business-day right-to-cancel window (1026.48(d)): counted from the day
  // AFTER the final disclosure is provided, skipping weekends and any
  // declared holiday. Disbursement is not permitted until the day after the
  // 3rd business day.
  const holidaySet = new Set((Array.isArray(holiday_dates) ? holiday_dates : []).map((h) => toUtcMidnight(h)).filter((t) => Number.isFinite(t)));
  const startMs = toUtcMidnight(final_disclosure_date);
  let rescission = null;
  if (Number.isFinite(startMs)) {
    const startDay = Math.floor(startMs / MS_PER_DAY);
    let day = startDay;
    let businessDaysCounted = 0;
    const businessDays = [];
    while (businessDaysCounted < 3) {
      day += 1;
      const dow = dayOfWeek(day);
      if (dow === 0 || dow === 6) continue; // Sunday, Saturday
      if (holidaySet.has(day * MS_PER_DAY)) continue;
      businessDaysCounted += 1;
      businessDays.push(isoFromDayCount(day));
    }
    rescission = {
      final_disclosure_date,
      third_business_day: businessDays[2],
      earliest_permitted_disbursement_date: isoFromDayCount(day + 1),
      note: 'Business-day count excludes Saturday/Sunday and any declared holiday_dates. Disbursement may not occur until the day AFTER the 3rd business day of the cancellation period (12 CFR 1026.48(d)(2)).',
    };
  } else {
    compliance_flags.push('FINAL_DISCLOSURE_DATE_UNPARSEABLE');
  }

  const output_payload = {
    compliant: total_gaps === 0 && self_certification_present,
    completeness_grade,
    elements_checked: total_required,
    gap_count: total_gaps,
    application_stage: application,
    approval_stage: approval,
    final_stage: final,
    self_certification_present: !!self_certification_present,
    rescission,
    federal_idr_out_of_scope: true,
    federal_idr_note: 'Federal Income-Driven Repayment (IDR) plan calculations are explicitly OUT OF SCOPE for this v1 kernel -- IDR formulas and constants change on an administration/policy cycle, a distinct churn source from the stable 12 CFR 1026.46-48 element/timing requirements checked here. Flagged as a future rider trigger, not built.',
    disambiguation: 'check_private_student_loan_disclosures checks that declared 12 CFR 1026.46-48 disclosure ELEMENTS are present and well-formed across the application/approval/final stages, that a self-certification form is declared present, and computes the 3-business-day cancellation-window math -- it does not verify the truth of any disclosed rate or fee.',
    table_version: TABLE_VERSION,
    table_source: TABLE_SOURCE,
    regulatory_basis: '12 CFR 1026.46-48 (Regulation Z private education loan disclosures); HEOA self-certification (1026.48(e)); 3-business-day right-to-cancel (1026.48(d)).',
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
