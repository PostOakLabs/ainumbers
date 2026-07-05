import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-242-pacs008-party-completeness-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_pacs008_party_completeness',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Validates BIS CPMI d218 harmonised data requirements for pacs.008 party fields:
// UETR (UUIDv4 format), debtor/creditor names, BIC format, LEI format (presence + format only;
// full mod-97 check handled by lint_lei_payment_binding art-246), and purpose code presence.
// table_version: "BIS-CPMI-D218-PARTY-COMPLETENESS-V1"
// Source: BIS CPMI Paper d218 "Harmonised ISO 20022 data requirements for cross-border payments"
//         (bis.org/cpmi/publ/d218.htm); ISO 20022 External Code Set (ExternalPurpose1Code).
// Disambiguates from: check_iso20022_pqc_readiness (art-87) = ML-DSA/PQC crypto readiness only;
//   lint_cbpr_structured_address (art-241) = per-message PostalAddress24 lint.

const TABLE_VERSION = 'BIS-CPMI-D218-PARTY-COMPLETENESS-V1';
const TABLE_SOURCE = 'BIS CPMI Paper d218 "Harmonised ISO 20022 data requirements for cross-border payments" (bis.org/cpmi/publ/d218.htm); ISO 20022 External Code Set ExternalPurpose1Code (iso20022.org)';

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }

function isUUIDv4(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function isValidBIC(s) {
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(s.toUpperCase());
}

function isLEIFormat(s) {
  return /^[A-Z0-9]{20}$/.test(s.toUpperCase());
}

export function compute(pp) {
  pp = pp || {};

  const uetr             = safeStr(pp.uetr);
  const debtor_name      = safeStr(pp.debtor_name);
  const creditor_name    = safeStr(pp.creditor_name);
  const debtor_agent_bic = safeStr(pp.debtor_agent_bic).toUpperCase();
  const creditor_agent_bic = safeStr(pp.creditor_agent_bic).toUpperCase();
  const debtor_lei       = safeStr(pp.debtor_lei).toUpperCase();
  const creditor_lei     = safeStr(pp.creditor_lei).toUpperCase();
  const purpose_code     = safeStr(pp.purpose_code).toUpperCase();

  const issues = [];

  // UETR check
  const uetr_present = uetr.length > 0;
  const uetr_valid = isUUIDv4(uetr);
  if (!uetr_present) {
    issues.push({ code: 'UETR_ABSENT', severity: 'WARNING', field: 'UETR', message: 'UETR not provided. SWIFT GPI and CPMI d218 both require a UUIDv4 UETR per payment instruction.' });
  } else if (!uetr_valid) {
    issues.push({ code: 'UETR_NOT_UUIDV4', severity: 'ERROR', field: 'UETR', message: 'UETR present but not a valid UUIDv4 (8-4-4-4-12 hex, version nibble=4, variant nibble in {8,9,a,b}).' });
  }

  // Party name checks
  if (debtor_name.length === 0) {
    issues.push({ code: 'DEBTOR_NAME_ABSENT', severity: 'ERROR', field: 'Dbtr/Nm', message: 'Debtor name (Dbtr/Nm) absent. CPMI d218 requires structured debtor party data.' });
  }
  if (creditor_name.length === 0) {
    issues.push({ code: 'CREDITOR_NAME_ABSENT', severity: 'ERROR', field: 'Cdtr/Nm', message: 'Creditor name (Cdtr/Nm) absent. CPMI d218 requires structured creditor party data.' });
  }

  // BIC checks
  const debtor_bic_present = debtor_agent_bic.length > 0;
  const creditor_bic_present = creditor_agent_bic.length > 0;
  const debtor_bic_valid = debtor_bic_present ? isValidBIC(debtor_agent_bic) : null;
  const creditor_bic_valid = creditor_bic_present ? isValidBIC(creditor_agent_bic) : null;
  if (debtor_bic_present && !debtor_bic_valid) {
    issues.push({ code: 'DEBTOR_BIC_INVALID_FORMAT', severity: 'ERROR', field: 'DbtrAgt/BICFI', message: 'Debtor agent BIC "' + debtor_agent_bic + '" is not valid ISO 9362 format (4+2+2+optional 3 alphanumeric).' });
  }
  if (creditor_bic_present && !creditor_bic_valid) {
    issues.push({ code: 'CREDITOR_BIC_INVALID_FORMAT', severity: 'ERROR', field: 'CdtrAgt/BICFI', message: 'Creditor agent BIC "' + creditor_agent_bic + '" is not valid ISO 9362 format.' });
  }

  // LEI format checks (format only -- full mod-97 is lint_lei_payment_binding art-246)
  const debtor_lei_present = debtor_lei.length > 0;
  const creditor_lei_present = creditor_lei.length > 0;
  const debtor_lei_format_valid = debtor_lei_present ? isLEIFormat(debtor_lei) : null;
  const creditor_lei_format_valid = creditor_lei_present ? isLEIFormat(creditor_lei) : null;
  if (debtor_lei_present && !debtor_lei_format_valid) {
    issues.push({ code: 'DEBTOR_LEI_FORMAT_INVALID', severity: 'ERROR', field: 'Dbtr/Id/LEI', message: 'Debtor LEI "' + debtor_lei + '" is not 20 alphanumeric chars (ISO 17442 format). For full check-digit validation use lint_lei_payment_binding (art-246).' });
  }
  if (creditor_lei_present && !creditor_lei_format_valid) {
    issues.push({ code: 'CREDITOR_LEI_FORMAT_INVALID', severity: 'ERROR', field: 'Cdtr/Id/LEI', message: 'Creditor LEI "' + creditor_lei + '" is not 20 alphanumeric chars (ISO 17442 format). For full check-digit validation use lint_lei_payment_binding (art-246).' });
  }

  // Purpose code check (format: 4 alpha per ISO 20022 ExternalPurpose1Code)
  const purpose_present = purpose_code.length > 0;
  const purpose_format_valid = purpose_present ? /^[A-Z0-9]{4}$/.test(purpose_code) : null;
  if (!purpose_present) {
    issues.push({ code: 'PURPOSE_CODE_ABSENT', severity: 'WARNING', field: 'Purp/Cd', message: 'Purpose code (Purp/Cd) absent. Mandatory in several CPMI d218 jurisdictions (UAE, India, Bahrain, Jordan, China, Malaysia). Use check_purpose_code_requirement (art-243) to verify corridor requirement.' });
  } else if (!purpose_format_valid) {
    issues.push({ code: 'PURPOSE_CODE_FORMAT_INVALID', severity: 'WARNING', field: 'Purp/Cd', message: 'Purpose code "' + purpose_code + '" is not 4 alphanumeric chars (ISO 20022 ExternalPurpose1Code format).' });
  }

  // CPMI d218 required field scoring (PRESENCE only)
  const cpmi_fields = ['uetr', 'debtor_name', 'creditor_name', 'debtor_agent_bic', 'creditor_agent_bic'];
  const cpmi_present_map = {
    uetr: uetr_present,
    debtor_name: debtor_name.length > 0,
    creditor_name: creditor_name.length > 0,
    debtor_agent_bic: debtor_bic_present,
    creditor_agent_bic: creditor_bic_present,
  };
  const cpmi_present = cpmi_fields.filter(function(f) { return cpmi_present_map[f]; }).length;
  const cpmi_d218_score = Math.round((cpmi_present / cpmi_fields.length) * 100);

  const error_count = issues.filter(function(i) { return i.severity === 'ERROR'; }).length;
  const warning_count = issues.filter(function(i) { return i.severity === 'WARNING'; }).length;
  const compliant = error_count === 0;

  const field_status = {
    uetr: { present: uetr_present, valid: uetr_valid, value_note: uetr.length > 0 ? uetr.slice(0, 8) + '...' : 'absent' },
    debtor_name: { present: debtor_name.length > 0 },
    creditor_name: { present: creditor_name.length > 0 },
    debtor_agent_bic: { present: debtor_bic_present, valid: debtor_bic_valid },
    creditor_agent_bic: { present: creditor_bic_present, valid: creditor_bic_valid },
    debtor_lei: { present: debtor_lei_present, valid: debtor_lei_format_valid },
    creditor_lei: { present: creditor_lei_present, valid: creditor_lei_format_valid },
    purpose_code: { present: purpose_present, valid: purpose_format_valid },
  };

  const output_payload = {
    compliant,
    error_count,
    warning_count,
    cpmi_d218_score,
    field_status,
    issues,
    disambiguation: 'validate_pacs008_party_completeness checks CPMI d218 structural completeness of pacs.008 party data (UETR UUIDv4, names, BIC format, LEI format). For full LEI mod-97 check-digit validation and Wolfsberg transparency scoring use lint_lei_payment_binding (art-246). For ML-DSA/PQC crypto readiness use check_iso20022_pqc_readiness (art-87). For PostalAddress24 structure use lint_cbpr_structured_address (art-241).',
    pii_note: 'Operates on structural identifiers (UETR, BIC, LEI) and party name length only. No real PII processed -- use synthetic or anonymised party data.',
    table_version: TABLE_VERSION,
    table_source: TABLE_SOURCE,
    regulatory_basis: 'BIS CPMI d218 "Harmonised ISO 20022 data requirements for cross-border payments"; SWIFT CBPR+ November 2026 mandate; ISO 9362 BIC; ISO 17442 LEI',
  };

  const compliance_flags = [];
  if (!compliant) compliance_flags.push('CPMI_D218_NON_COMPLIANT');
  if (!uetr_valid && uetr.length > 0) compliance_flags.push('UETR_INVALID');
  if ((debtor_lei_present && !debtor_lei_format_valid) || (creditor_lei_present && !creditor_lei_format_valid)) compliance_flags.push('LEI_FORMAT_INVALID');

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
