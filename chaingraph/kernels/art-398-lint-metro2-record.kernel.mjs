import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-398-lint-metro2-record';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'lint_metro2_record',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Lints a Metro 2 credit-reporting base-segment record: field presence/format,
// account-status and payment-rating code validity (public subset), and DOFD
// (date of first delinquency) cross-field consistency per FCRA 15 U.S.C. Sec 1681c.
//
// SUBSET NOTE: the CDIA Credit Reporting Resource Guide (CRRG) is a licensed
// proprietary document -- this kernel derives its field table and code lists
// ONLY from public sources (CFPB, CDIA's public Metro 2 overview, and the FCRA
// statute itself), and does NOT implement the full CRRG. J1/J2 (associated
// consumer) and K1-K4 (specialty) segments are checked as PRESENCE FLAGS only --
// full field-level validation of those segments is out of scope of this subset.
// table_version: "METRO2-PUBLIC-SUBSET-V1"

const TABLE_VERSION = 'METRO2-PUBLIC-SUBSET-V1';
const TABLE_SOURCE = 'CFPB "Key Dimensions and Processes in the U.S. Credit Reporting System" (Dec 2012, consumerfinance.gov); CDIA public Metro 2 Format overview (cdiaonline.org); FCRA 15 U.S.C. Sec 1681c(a)(4)-(5); Federal Reserve Regulation V (12 CFR Part 1022).';
const SUBSET_COVERAGE_STATEMENT = 'This lints a PUBLIC SUBSET of Metro 2 Format base-segment fields and the statutory DOFD/obsolescence rule. It does not implement the CDIA Credit Reporting Resource Guide (CRRG), a licensed document -- J1/J2/K1-K4 segments are checked as presence flags only.';

// Account-status codes drawn from CFPB's public consumer-facing glossary of
// Metro 2 status codes (not the full CRRG code list).
const CURRENT_STATUS_CODES = new Set(['11', '13', '61', '62', '63', '64', '65', '71']);
const DELINQUENT_STATUS_CODES = new Set(['78', '80', '82', '83', '84', '88', '89', '93', '94', '95', '96', '97']);
const KNOWN_STATUS_CODES = new Set([...CURRENT_STATUS_CODES, ...DELINQUENT_STATUS_CODES]);
const KNOWN_PAYMENT_RATINGS = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'G', 'L']);

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const FCRA_OBSOLESCENCE_DAYS = 7 * 365 + 180; // 15 U.S.C. 1681c(a)(4)-(5): 7 years + 180 days from DOFD

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }
function safeNum(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function isIsoDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)); }
function daysBetween(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / MS_PER_DAY); }

export function compute(pp) {
  pp = pp || {};

  const account_type      = safeStr(pp.account_type);
  const date_opened       = safeStr(pp.date_opened);
  const date_reported     = safeStr(pp.date_reported);
  const dofd              = safeStr(pp.date_of_first_delinquency);
  const account_status    = safeStr(pp.account_status);
  const payment_rating    = safeStr(pp.payment_rating).toUpperCase();
  const current_balance   = pp.current_balance;
  const amount_past_due   = pp.amount_past_due;
  const has_j1_segment    = pp.has_j1_segment === true;
  const has_j2_segment    = pp.has_j2_segment === true;
  const has_k_segment     = pp.has_k_segment === true;

  const issues = [];

  // Base-segment presence
  if (account_type.length === 0) issues.push({ code: 'ACCOUNT_TYPE_ABSENT', severity: 'ERROR', field: 'account_type', message: 'Account type code absent from base segment.' });
  if (!isIsoDate(date_opened)) issues.push({ code: 'DATE_OPENED_INVALID', severity: 'ERROR', field: 'date_opened', message: 'Date opened absent or not a valid ISO-8601 date.' });
  const date_reported_valid = isIsoDate(date_reported);
  if (!date_reported_valid) issues.push({ code: 'DATE_REPORTED_INVALID', severity: 'ERROR', field: 'date_reported', message: 'Date reported absent or not a valid ISO-8601 date.' });

  const balance_num = safeNum(current_balance);
  if (balance_num === null || balance_num < 0) issues.push({ code: 'CURRENT_BALANCE_INVALID', severity: 'ERROR', field: 'current_balance', message: 'Current balance absent, non-numeric, or negative.' });
  const past_due_num = safeNum(amount_past_due);
  if (past_due_num !== null && past_due_num < 0) issues.push({ code: 'AMOUNT_PAST_DUE_NEGATIVE', severity: 'ERROR', field: 'amount_past_due', message: 'Amount past due cannot be negative.' });

  // Account status code validity
  const status_present = account_status.length > 0;
  const status_valid = status_present ? KNOWN_STATUS_CODES.has(account_status) : false;
  if (!status_present) {
    issues.push({ code: 'ACCOUNT_STATUS_ABSENT', severity: 'ERROR', field: 'account_status', message: 'Account status code absent from base segment.' });
  } else if (!status_valid) {
    issues.push({ code: 'INVALID_ACCOUNT_STATUS_CODE', severity: 'ERROR', field: 'account_status', message: 'Account status code "' + account_status + '" is not in the public-subset known-code table.' });
  }
  const is_delinquent_status = status_valid && DELINQUENT_STATUS_CODES.has(account_status);

  // Payment rating validity
  const rating_present = payment_rating.length > 0;
  const rating_valid = rating_present ? KNOWN_PAYMENT_RATINGS.has(payment_rating) : true;
  if (rating_present && !rating_valid) {
    issues.push({ code: 'INVALID_PAYMENT_RATING', severity: 'WARNING', field: 'payment_rating', message: 'Payment rating "' + payment_rating + '" is not in the public-subset known-code table.' });
  }

  // DOFD cross-field consistency (FCRA 15 U.S.C. 1681c)
  const dofd_present = dofd.length > 0;
  const dofd_valid = dofd_present ? isIsoDate(dofd) : true;
  let dofd_age_days = null;
  let obsolete_per_fcra = false;

  if (is_delinquent_status && !dofd_present) {
    issues.push({ code: 'DOFD_MISSING_FOR_DELINQUENT_STATUS', severity: 'ERROR', field: 'date_of_first_delinquency', message: 'Account status "' + account_status + '" indicates delinquency; DOFD is required (FCRA Sec 1681c(a)(4)-(5)).' });
  }
  if (dofd_present && !dofd_valid) {
    issues.push({ code: 'DOFD_FORMAT_INVALID', severity: 'ERROR', field: 'date_of_first_delinquency', message: 'DOFD present but not a valid ISO-8601 date.' });
  }
  if (dofd_present && dofd_valid && date_reported_valid) {
    if (Date.parse(dofd) > Date.parse(date_reported)) {
      issues.push({ code: 'DOFD_AFTER_DATE_REPORTED', severity: 'ERROR', field: 'date_of_first_delinquency', message: 'DOFD is after date reported -- DOFD must precede or equal the reporting date.' });
    } else {
      dofd_age_days = daysBetween(dofd, date_reported);
      obsolete_per_fcra = dofd_age_days > FCRA_OBSOLESCENCE_DAYS;
      if (obsolete_per_fcra) {
        issues.push({ code: 'OBSOLETE_PER_FCRA_605C', severity: 'WARNING', field: 'date_of_first_delinquency', message: 'Record is ' + dofd_age_days + ' days past DOFD, exceeding the FCRA 7-year-plus-180-day obsolescence period -- should not be furnished further.' });
      }
    }
  }
  if (!is_delinquent_status && dofd_present) {
    issues.push({ code: 'DOFD_PRESENT_FOR_NON_DELINQUENT_STATUS', severity: 'WARNING', field: 'date_of_first_delinquency', message: 'DOFD present but account status "' + account_status + '" does not indicate delinquency -- verify status is current.' });
  }

  const error_count = issues.filter((i) => i.severity === 'ERROR').length;
  const warning_count = issues.filter((i) => i.severity === 'WARNING').length;
  const compliant = error_count === 0;

  const field_status = {
    account_type: { present: account_type.length > 0 },
    date_opened: { present: date_opened.length > 0, valid: isIsoDate(date_opened) },
    date_reported: { present: date_reported.length > 0, valid: date_reported_valid },
    current_balance: { present: current_balance !== undefined && current_balance !== null && current_balance !== '', valid: balance_num !== null && balance_num >= 0 },
    account_status: { present: status_present, valid: status_valid },
    payment_rating: { present: rating_present, valid: rating_valid },
    date_of_first_delinquency: { present: dofd_present, valid: dofd_valid, age_days: dofd_age_days },
    j1_segment_present: has_j1_segment,
    j2_segment_present: has_j2_segment,
    k_segment_present: has_k_segment,
  };

  const output_payload = {
    compliant,
    error_count,
    warning_count,
    metro2_subset_score: Math.max(0, 100 - error_count * 20 - warning_count * 5),
    is_delinquent_status,
    obsolete_per_fcra,
    field_status,
    issues,
    disambiguation: 'lint_metro2_record checks Metro 2 base-segment field presence/format, account-status and payment-rating code validity, and DOFD/obsolescence cross-field consistency, all from a PUBLIC SUBSET of the format (not the licensed CRRG).',
    pii_note: 'Operates on structural codes, dates, and amounts only. No consumer name, SSN, or address fields exist in this schema -- use synthetic or anonymised account data.',
    subset_coverage_statement: SUBSET_COVERAGE_STATEMENT,
    table_version: TABLE_VERSION,
    table_source: TABLE_SOURCE,
    regulatory_basis: 'Metro 2 Format (CDIA); FCRA 15 U.S.C. Sec 1681c(a)(4)-(5) (obsolescence); Federal Reserve Regulation V, 12 CFR Part 1022.',
  };

  const compliance_flags = [];
  if (!compliant) compliance_flags.push('METRO2_SUBSET_NON_COMPLIANT');
  if (obsolete_per_fcra) compliance_flags.push('FCRA_OBSOLESCENCE_EXCEEDED');
  if (status_present && !status_valid) compliance_flags.push('ACCOUNT_STATUS_CODE_UNKNOWN');

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
