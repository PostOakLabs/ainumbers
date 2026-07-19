import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-403-check-debt-validation-notice';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_debt_validation_notice',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Checks a debt-validation-notice content-element checklist against Regulation
// F, 12 CFR 1006.34 (the Model Form B-1 element set), and computes the 30-day
// validation-period response-window math from a declared mailing date under a
// declared mailing-to-receipt assumption. Same present/absent checklist shape
// as the shipped OS-completeness / Metro2 / X12 linters (art-400/398/399).
// table_version: "REGF-1006-34-VALIDATION-NOTICE-CHECKLIST-V1"

const TABLE_VERSION = 'REGF-1006-34-VALIDATION-NOTICE-CHECKLIST-V1';
const TABLE_SOURCE = '12 CFR 1006.34 (Regulation F validation information content requirements) and Model Form B-1 (Appendix B).';

const REQUIRED_ELEMENTS = [
  'debt-collector-name',
  'consumer-name',
  'account-number-or-reference',
  'itemization-date',
  'itemized-current-amount',
  'itemization-breakdown',
  'original-creditor-name-if-different',
  'statement-of-dispute-rights-30-day',
  'statement-of-right-to-original-creditor-info',
  'model-form-b1-tear-off',
];

const MS_PER_DAY = 86400000;

function statusOf(map, key) { return map[key] || 'absent'; }
function safeInt(v, def) { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? n : def; }

function toUtcMidnight(iso) {
  if (typeof iso !== 'string') return NaN;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return NaN;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(t) ? t : NaN;
}
// Civil-date-from-days-since-epoch (Howard Hinnant's algorithm) -- pure integer
// arithmetic, no Date object instantiation, so this stays deterministic even
// under a frozen/mocked global Date.
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
function addDaysIso(epochMs, days) {
  const totalDays = Math.floor(epochMs / MS_PER_DAY) + days;
  const [y, m, d] = civilFromDays(totalDays);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
export function compute(pp) {
  pp = pp || {};
  const { inputs = {} } = pp;
  const {
    notice_elements = [],
    notice_mailed_date = '',
    mailing_assumption_days = 5,
    itemization_date = '',
  } = inputs;

  const elementMap = {};
  for (const entry of notice_elements) {
    if (entry && entry.element) elementMap[entry.element] = entry.status;
  }

  const element_status = {};
  const gaps = [];
  for (const el of REQUIRED_ELEMENTS) {
    const status = statusOf(elementMap, el);
    element_status[el] = status;
    if (status !== 'complete') gaps.push(el);
  }

  const gap_count = gaps.length;
  let completeness_grade;
  if (gap_count === 0) completeness_grade = 'A';
  else if (gap_count <= 1) completeness_grade = 'B';
  else if (gap_count <= 3) completeness_grade = 'C';
  else if (gap_count <= 6) completeness_grade = 'D';
  else completeness_grade = 'F';
  const compliant = gap_count === 0;

  const compliance_flags = [];
  if (gap_count > 0) compliance_flags.push('VALIDATION_NOTICE_ELEMENTS_INCOMPLETE');

  // Response-period math: assumed-received date = mailed date + declared
  // mailing-assumption days; the 30-day 1006.34(c) validation period runs from
  // assumed receipt (not from the mailing date itself).
  const mailedMs = toUtcMidnight(notice_mailed_date);
  const itemizationMs = toUtcMidnight(itemization_date);
  let response_period = null;
  if (Number.isFinite(mailedMs)) {
    const mad = Math.max(0, safeInt(mailing_assumption_days, 5));
    const assumedReceivedMs = mailedMs + mad * MS_PER_DAY;
    const deadlineMs = assumedReceivedMs + 30 * MS_PER_DAY;
    response_period = {
      notice_mailed_date,
      mailing_assumption_days: mad,
      assumed_received_date: addDaysIso(mailedMs, mad),
      dispute_deadline_date: addDaysIso(mailedMs, mad + 30),
      validation_period_days: 30,
      note: 'assumed_received_date is a DECLARED mailing-to-receipt assumption, not a statutory presumption of receipt -- 1006.34(c) runs the 30-day period from actual receipt, which this tool cannot observe.',
    };
    if (Number.isFinite(itemizationMs) && itemizationMs > mailedMs) {
      compliance_flags.push('ITEMIZATION_DATE_AFTER_MAILING_DATE');
    }
  } else {
    compliance_flags.push('NOTICE_MAILED_DATE_UNPARSEABLE');
  }

  const output_payload = {
    compliant,
    completeness_grade,
    elements_checked: REQUIRED_ELEMENTS.length,
    gap_count,
    gaps,
    element_status,
    response_period,
    itemization_date_valid: Number.isFinite(itemizationMs) && Number.isFinite(mailedMs) ? itemizationMs <= mailedMs : null,
    disambiguation: 'check_debt_validation_notice checks that declared 12 CFR 1006.34 validation-notice ELEMENTS are present and well-formed, and computes response-period math off a DECLARED mailing-to-receipt assumption -- it does not verify the truth of any disclosed amount and does not establish the consumer\'s actual date of receipt.',
    asserted_note: '"asserted" labelling applies throughout: this checks that declared notice elements are PRESENT and well-formed, not that the underlying debt amounts or itemization are accurate.',
    table_version: TABLE_VERSION,
    table_source: TABLE_SOURCE,
    regulatory_basis: '12 CFR 1006.34 (validation information content) and Model Form B-1 (Appendix B); the 30-day dispute/validation period runs under 1006.34(c).',
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
