import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-228-build-adverse-action-notice';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'build_adverse_action_notice',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ─── Adverse Action Notice Composer ─────────────────────────────────────────
// Reg B §1002.9 (ECOA): compose a regulation-compliant adverse action notice
//   skeleton from SHAP-ranked factor codes + decision metadata. Output is a
//   structured notice skeleton + execution receipt suitable for §13.11 VC export.
// CFPB Circular 2022-03 / 2023-03: reasons must be specific, not vague checklist
//   items. SHAP-ranked factor codes are the encouraged approach for model-driven
//   decisions (CFPB Exam Procedures -- ECOA 2023 update).
// FCRA §615(a): if credit score used, include CRA info + consumer rights language.
// table_version: "REG-B-NOTICE-BUILDER-2024-CFPB-CIRC-2023-03"
//
// Disambiguation: build_adverse_action_notice COMPOSES a new notice skeleton.
//   To validate an existing completed notice, use validate_adverse_action_notice.
//
// Anchor tie-in: ECOA Reg B §1002.12 requires 25-month record retention for
//   credit applications. The execution receipt from this tool maps 1:1 to
//   anchor.ainumbers.co -- anchor the receipt hash for durable, verifiable
//   evidence that the notice was generated from a compliant kernel at a specific
//   point in time. The anchored timestamp satisfies the "reproduce at any time"
//   interpretation of Reg B §1002.12(b)(4).
//
// Note: applicant_name_placeholder must be a synthetic placeholder
//   (e.g., "Applicant", "Name on File") -- never enter real personal data.

// FICO reason code registry (public - myFICO.com / CFPB disclosures)
// Subset of most-used codes mapped to human-readable descriptions
const FICO_REASON_CODES = {
  '01': 'Amount owed on accounts is too high',
  '02': 'Level of delinquency on accounts',
  '03': 'Too few bank revolving accounts',
  '04': 'Too many bank or national revolving accounts',
  '05': 'Too many accounts with balances',
  '06': 'Too many consumer finance company accounts',
  '07': 'Account payment history is too new to rate',
  '08': 'Too many recent inquiries in the last 12 months',
  '09': 'Too many accounts recently opened',
  '10': 'Proportion of balances to credit limits too high on bank revolving or other revolving accounts',
  '11': 'Amount owed on revolving accounts is too high',
  '12': 'Length of time revolving accounts have been established',
  '13': 'Time since delinquency is too recent or unknown',
  '14': 'Length of time accounts have been established',
  '15': 'Lack of recent bank revolving information',
  '16': 'Lack of recent revolving account information',
  '17': 'No recent non-mortgage balance information',
  '18': 'Number of accounts with delinquency',
  '19': 'Too few accounts currently paid as agreed',
  '20': 'Length of time since derogatory public record or collection is too short',
  '21': 'Amount past due on accounts',
  '22': 'Serious delinquency, derogatory public record, or collection filed',
  '23': 'Number of bank or national revolving accounts with balances',
  '24': 'No recent revolving balances',
  '25': 'Length of time installment loans have been established',
  '26': 'Number of revolving accounts',
  '27': 'Number of established accounts',
  '28': 'Number of open accounts (installment, revolving, mortgage, consumer finance)',
  '29': 'No recent bankcard balances',
  '30': 'Time since most recent account opening is too short',
  '31': 'Too few accounts with recent payment information',
  '32': 'Lack of recent installment loan information',
  '33': 'Proportion of loan balances to loan amounts is too high',
  '34': 'Amount owed on delinquent accounts',
  '38': 'Serious delinquency',
  '39': 'Serious delinquency and public record or collection filed',
  '40': 'Derogatory public record or collection filed',
};

// VantageScore reason codes (public - vantagescore.com)
const VANTAGESCORE_REASON_CODES = {
  'VS001': 'The proportion of balances to credit limits on bank revolving or other revolving accounts is too high',
  'VS002': 'The proportion of balances to credit limits on revolving bank accounts is too high',
  'VS003': 'Payment history: delinquency',
  'VS004': 'Age/length of credit history is too short',
  'VS005': 'Too many accounts with recent delinquencies',
  'VS006': 'Too few accounts with no late payments',
  'VS007': 'Too many inquiries in the past 12 months',
  'VS008': 'Proportion of balance to high credit on bank card accounts',
  'VS009': 'Too many open accounts',
  'VS010': 'Amount owed on accounts is too high',
  'VS011': 'Time since most recent public record is too recent or unknown',
  'VS012': 'Accounts with derogatory status',
  'VS013': 'Number of recent inquiries',
  'VS014': 'Length of time since delinquency is too recent or unknown',
  'VS015': 'Number of accounts with delinquency',
};

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }
function safeBool(v, def) { return typeof v === 'boolean' ? v : def; }
function safeArr(v) { return Array.isArray(v) ? v : []; }
function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }

function resolveReasonDescription(code, source) {
  const c = safeStr(code);
  const src = safeStr(source).toLowerCase();
  if (src === 'fico' || src === '') {
    if (FICO_REASON_CODES[c]) return FICO_REASON_CODES[c];
  }
  if (src === 'vantagescore') {
    if (VANTAGESCORE_REASON_CODES[c]) return VANTAGESCORE_REASON_CODES[c];
  }
  return 'Reason code ' + c + ' (' + (src || 'unspecified source') + ')';
}

export function compute(pp) {
  pp = pp || {};

  const action_taken = safeStr(pp.action_taken || 'denied');
  const applicant_name_placeholder = safeStr(pp.applicant_name_placeholder || 'Applicant');
  const creditor_name = safeStr(pp.creditor_name || '[Creditor Name]');
  const date_of_action = safeStr(pp.date_of_action || '');
  const factor_codes = safeArr(pp.factor_codes).slice(0, 4); // max 4 per Reg B
  const credit_score_used = safeBool(pp.credit_score_used, false);
  const credit_score = safeNum(pp.credit_score, 0);
  const credit_score_source = safeStr(pp.credit_score_source || '');
  const score_range_low = safeNum(pp.score_range_low, 300);
  const score_range_high = safeNum(pp.score_range_high, 850);
  const credit_bureau_name = safeStr(pp.credit_bureau_name || '');
  const credit_bureau_address = safeStr(pp.credit_bureau_address || '');
  const credit_bureau_phone = safeStr(pp.credit_bureau_phone || '');

  // Resolve reason descriptions
  const resolved_reasons = factor_codes.map(function(f, i) {
    const code = safeStr(f.code || f);
    const source = safeStr(f.source || pp.reason_code_source || 'fico');
    const rank = safeNum(f.rank, i + 1);
    const shap_value = safeNum(f.shap_value, 0);
    return {
      rank,
      code,
      source,
      description: resolveReasonDescription(code, source),
      shap_value,
    };
  }).sort(function(a, b) { return a.rank - b.rank; });

  const compliance_flags = [];
  if (resolved_reasons.length === 0) {
    compliance_flags.push('NO_REASONS_PROVIDED');
  }
  if (resolved_reasons.length > 4) {
    compliance_flags.push('REASON_COUNT_EXCEEDS_MAX_4');
  }

  // Notice skeleton
  const notice_sections = {
    header: creditor_name + ' -- Adverse Action Notice',
    applicant: applicant_name_placeholder,
    date: date_of_action,
    action_statement: 'We have taken the following action on your application: ' + action_taken.toUpperCase(),
    reasons: resolved_reasons.map(function(r, i) {
      return { position: i + 1, code: r.code, source: r.source, description: r.description };
    }),
    ecoa_statement: 'The federal Equal Credit Opportunity Act prohibits creditors from discriminating against credit applicants on the basis of race, color, religion, national origin, sex, marital status, age, because all or part of the applicant\'s income derives from any public assistance program, or because the applicant has in good faith exercised any right under the Consumer Credit Protection Act. The federal agency that administers compliance with this law concerning this creditor is: [Insert applicable federal agency].',
  };

  if (credit_score_used) {
    notice_sections['credit_score_disclosure'] = {
      score: credit_score,
      score_source: credit_score_source,
      score_range: score_range_low + ' to ' + score_range_high,
      score_date: date_of_action,
      key_factors: resolved_reasons.slice(0, 4).map(function(r) { return r.description; }),
    };
    notice_sections['fcra_rights'] = {
      cra_name: credit_bureau_name,
      cra_address: credit_bureau_address,
      cra_phone: credit_bureau_phone,
      free_copy_statement: 'You have the right to obtain a free copy of your consumer report from the consumer reporting agency named above, if you request it no later than 60 days after you receive this notice.',
      dispute_statement: 'If you find that any information in the consumer report used in making this credit decision is inaccurate, you have the right to dispute the matter with the reporting agency.',
    };
  }

  // Receipt metadata for §13.11 VC / §16 eddsa-jcs-2022 export
  const receipt_metadata = {
    notice_type: 'adverse_action',
    action_taken,
    reason_count: resolved_reasons.length,
    reason_codes: resolved_reasons.map(function(r) { return r.code; }),
    credit_score_disclosed: credit_score_used,
    fcra_rights_included: credit_score_used && notice_sections['fcra_rights'] !== undefined,
    ecoa_rights_included: true,
    regulation: 'Reg B §1002.9 (12 CFR Part 1002); FCRA §615(a) (15 USC §1681m)',
    retention_requirement: 'ECOA Reg B §1002.12: 25-month record retention for credit application files',
    anchor_recommendation: 'Anchor this execution receipt at anchor.ainumbers.co to create durable, timestamped evidence per Reg B §1002.12(b)(4)',
  };

  const output_payload = {
    notice_sections,
    resolved_reasons,
    receipt_metadata,
    compliance_flags_raised: compliance_flags.length,
    regulatory_basis: 'Reg B §1002.9 (12 CFR Part 1002); ECOA 15 USC §1691c; FCRA §615(a) 15 USC §1681m; CFPB Circular 2022-03; CFPB Circular 2023-03',
    table_version: 'REG-B-NOTICE-BUILDER-2024-CFPB-CIRC-2023-03',
    table_source: 'CFPB Circular 2022-03 (Aug 2022); CFPB Circular 2023-03 (Sep 2023); FICO public reason codes (myFICO.com); VantageScore public reason codes (vantagescore.com)',
    pii_note: 'All inputs are processed locally in your browser. No data is transmitted. Use synthetic placeholders only.',
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
