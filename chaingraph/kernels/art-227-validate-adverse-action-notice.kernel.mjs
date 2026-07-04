import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-227-validate-adverse-action-notice';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_adverse_action_notice',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ─── Adverse Action Notice Validation ────────────────────────────────────────
// Reg B §1002.9 (ECOA): creditor must notify applicant within 30 days; notice
//   must state specific reasons (max 4 principal reasons). CFPB Circular 2022-03
//   (Aug 2022) + CFPB Circular 2023-03 (Sep 2023): no vague checklist reasons
//   from complex/opaque models; each reason must be intelligible and specific.
// FCRA §615(a): if adverse action is based on consumer report, notice must include
//   consumer reporting agency name/address, agency phone number, right to free
//   copy within 60 days, right to dispute inaccurate information.
// table_version: "REG-B-ADVERSE-ACTION-2024-CFPB-CIRC-2023-03"
//
// Disambiguation: validate_adverse_action_notice checks an EXISTING notice for
//   regulatory completeness. To COMPOSE a new compliant notice, use
//   build_adverse_action_notice. Inputs are structural/synthetic only -- zero PII.
//
// FICO reason code set (public, from myFICO and CFPB disclosures):
//   https://www.myfico.com/credit-education/credit-score-key-factors
// VantageScore reason code set (public):
//   https://www.vantagescore.com/resources/reason-codes
// ReasonCode.org reference: https://reasoncode.org

const VALID_REASON_CODE_SOURCES = ['fico', 'vantagescore', 'ecoa_regulatory', 'proprietary_documented'];

// Known vague/prohibited reason codes per CFPB Circular 2023-03
const PROHIBITED_VAGUE_CODES = [
  'z_other', 'other', 'z9', 'z099', 'z9_other',
  'unable_to_verify', 'no_reason_given', 'insufficient_data',
];

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }
function safeBool(v, def) { return typeof v === 'boolean' ? v : def; }
function safeArr(v) { return Array.isArray(v) ? v : []; }
function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r4(v) { return Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : 0; }

export function compute(pp) {
  pp = pp || {};

  const reasons = safeArr(pp.reasons).slice(0, 8);
  const action_taken = safeStr(pp.action_taken || 'denied');
  const reason_code_source = safeStr(pp.reason_code_source || 'fico');
  const credit_score_used = safeBool(pp.credit_score_used, false);
  const notice_includes_creditor_name = safeBool(pp.notice_includes_creditor_name, false);
  const notice_includes_action_taken = safeBool(pp.notice_includes_action_taken, false);
  const notice_includes_date = safeBool(pp.notice_includes_date, false);
  const notice_includes_fcra_rights = safeBool(pp.notice_includes_fcra_rights, false);
  const notice_includes_credit_bureau_info = safeBool(pp.notice_includes_credit_bureau_info, false);
  const notice_includes_right_to_copy = safeBool(pp.notice_includes_right_to_copy, false);
  const notice_includes_dispute_right = safeBool(pp.notice_includes_dispute_right, false);

  const violations = [];
  const warnings = [];

  // ── Reg B §1002.9(a)(2) reason-count check ────────────────────────────────
  const reason_count = reasons.length;
  if (reason_count === 0) {
    violations.push({ code: 'REGB_NO_REASONS', rule: 'Reg B §1002.9(a)(2)', message: 'Notice must state specific reasons for adverse action.' });
  }
  if (reason_count > 4) {
    violations.push({ code: 'REGB_REASON_COUNT_EXCEEDED', rule: 'Reg B §1002.9(a)(2)', message: 'Maximum of 4 principal reasons may be stated; notice lists ' + reason_count + '.' });
  }

  // ── Reg B + CFPB Circular 2023-03 vague-reason check ─────────────────────
  reasons.forEach(function(r, i) {
    const code = safeStr(r.code || r).toLowerCase();
    if (PROHIBITED_VAGUE_CODES.indexOf(code) >= 0) {
      violations.push({ code: 'CFPB_CIRC_2023_03_VAGUE_REASON', rule: 'CFPB Circular 2023-03', message: 'Reason code \'' + code + '\' at position ' + (i + 1) + ' is a prohibited vague/checklist code under CFPB Circular 2023-03.' });
    }
    const src = safeStr(r.source || reason_code_source).toLowerCase();
    if (VALID_REASON_CODE_SOURCES.indexOf(src) < 0) {
      warnings.push({ code: 'REASON_SOURCE_UNKNOWN', message: 'Reason at position ' + (i + 1) + ' has unrecognized source \'' + src + '\'; confirm it maps to a public reason-code registry.' });
    }
  });

  // ── Required content checks (Reg B §1002.9(a)(2)(i)) ─────────────────────
  if (!notice_includes_creditor_name) {
    violations.push({ code: 'REGB_MISSING_CREDITOR_NAME', rule: 'Reg B §1002.9(a)(2)(i)', message: 'Notice must include creditor name and address.' });
  }
  if (!notice_includes_action_taken) {
    violations.push({ code: 'REGB_MISSING_ACTION_TAKEN', rule: 'Reg B §1002.9(a)(2)(i)', message: 'Notice must state the action taken.' });
  }
  if (!notice_includes_date) {
    violations.push({ code: 'REGB_MISSING_DATE', rule: 'Reg B §1002.9(a)(2)(i)', message: 'Notice must include the date of the action.' });
  }

  // ── FCRA §615(a) checks (if credit report used) ───────────────────────────
  const fcra_required = credit_score_used;
  let fcra_violations = 0;
  if (fcra_required) {
    if (!notice_includes_credit_bureau_info) {
      violations.push({ code: 'FCRA_615A_MISSING_CRA_INFO', rule: 'FCRA §615(a)', message: 'Credit report was used; notice must include CRA name, address, and phone number.' });
      fcra_violations++;
    }
    if (!notice_includes_right_to_copy) {
      violations.push({ code: 'FCRA_615A_MISSING_FREE_COPY_RIGHT', rule: 'FCRA §615(a)', message: 'Credit report was used; notice must state right to free copy within 60 days.' });
      fcra_violations++;
    }
    if (!notice_includes_dispute_right) {
      violations.push({ code: 'FCRA_615A_MISSING_DISPUTE_RIGHT', rule: 'FCRA §615(a)', message: 'Credit report was used; notice must state right to dispute inaccurate information with CRA.' });
      fcra_violations++;
    }
  }

  const compliant = violations.length === 0;
  const compliance_score = reason_count > 0
    ? r4(1 - violations.length / Math.max(1, violations.length + 3))
    : 0;

  const output_payload = {
    compliant,
    violation_count: violations.length,
    warning_count: warnings.length,
    violations,
    warnings,
    reason_count,
    reason_count_valid: reason_count >= 1 && reason_count <= 4,
    fcra_required,
    fcra_violations,
    action_taken,
    credit_score_used,
    compliance_score,
    regulatory_basis: 'Reg B §1002.9(a)(2)(i) (12 CFR Part 1002); ECOA 15 USC §1691c; FCRA §615(a) 15 USC §1681m; CFPB Circular 2022-03; CFPB Circular 2023-03',
    table_version: 'REG-B-ADVERSE-ACTION-2024-CFPB-CIRC-2023-03',
    table_source: 'CFPB Circular 2022-03 (Aug 2022); CFPB Circular 2023-03 (Sep 2023); 12 CFR §1002.9; 15 USC §1681m',
    pii_note: 'All inputs are processed locally in your browser. No data is transmitted. Do not enter real personal data.',
  };

  return { output_payload, compliance_flags: violations };
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
