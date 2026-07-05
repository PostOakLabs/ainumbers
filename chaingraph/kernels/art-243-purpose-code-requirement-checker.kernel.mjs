import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-243-purpose-code-requirement-checker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_purpose_code_requirement',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Checks whether ExternalPurpose1Code (Purp/Cd) and/or ExternalCategoryPurpose1Code (CtgyPurp/Cd)
// are mandatory for the beneficiary corridor and whether the payment qualifies for SwiftGo.
// Jurisdiction mandate data per BIS CPMI d218 country profiles and SWIFT payment standards.
// SwiftGo eligibility: amount <= $12,500 USD and purpose category in accepted set.
// table_version: "ISO20022-PURPOSE-CODE-JURISDICTION-V1"
// Source: BIS CPMI d218 country payment profiles (bis.org/cpmi/publ/d218.htm);
//         SWIFT SwiftGo eligibility rules (swift.com/our-solutions/global-financial-messaging/swiftgo);
//         ISO 20022 External Code Set ExternalPurpose1Code + ExternalCategoryPurpose1Code.

const TABLE_VERSION = 'ISO20022-PURPOSE-CODE-JURISDICTION-V1';
const TABLE_SOURCE = 'BIS CPMI d218 country payment profiles (bis.org/cpmi/publ/d218.htm); SWIFT SwiftGo eligibility rules (swift.com/our-solutions/global-financial-messaging/swiftgo); ISO 20022 External Code Sets ExternalPurpose1Code and ExternalCategoryPurpose1Code';

// Jurisdictions requiring purpose code per CPMI d218 (beneficiary country alpha-2)
const PURPOSE_CODE_MANDATORY = {
  AE: { reason: 'UAE Central Bank requires PurpCd on all inbound cross-border payments.', code_types: ['PurpCd'] },
  IN: { reason: 'Reserve Bank of India mandates purpose code for all inward remittances (RBI FEMA).', code_types: ['PurpCd'] },
  BH: { reason: 'Central Bank of Bahrain requires purpose code per national FX regulation.', code_types: ['PurpCd'] },
  JO: { reason: 'Central Bank of Jordan requires purpose code on all inbound cross-border transfers.', code_types: ['PurpCd'] },
  CN: { reason: 'SAFE (State Administration of Foreign Exchange) requires purpose code for RMB cross-border payments.', code_types: ['PurpCd'] },
  MY: { reason: 'Bank Negara Malaysia requires purpose code on all cross-border receipts above threshold.', code_types: ['PurpCd'] },
};

// SwiftGo max amount in USD
const SWIFTGO_MAX_USD = 12500;

// ExternalCategoryPurpose1Code subset accepted for SwiftGo
const SWIFTGO_ACCEPTED_CATEGORY_CODES = ['SALA', 'PENS', 'TRAD', 'CORT', 'BEXP', 'SUPP', 'DIVI', 'BENE', 'OTHR', 'CHAR'];

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }
function safeNum(v) { const n = Number(v); return isFinite(n) ? n : 0; }

export function compute(pp) {
  pp = pp || {};

  const beneficiary_country   = safeStr(pp.beneficiary_country).toUpperCase();
  const payment_amount_usd    = safeNum(pp.payment_amount_usd);
  const purpose_code          = safeStr(pp.purpose_code).toUpperCase();
  const category_purpose_code = safeStr(pp.category_purpose_code).toUpperCase();

  const hasCountry = beneficiary_country.length === 2 && /^[A-Z]{2}$/.test(beneficiary_country);
  const issues = [];

  if (!hasCountry) {
    issues.push({ code: 'COUNTRY_INVALID', severity: 'ERROR', field: 'beneficiary_country', message: 'beneficiary_country must be a valid ISO 3166-1 alpha-2 country code.' });
  }

  const mandate = hasCountry ? (PURPOSE_CODE_MANDATORY[beneficiary_country] || null) : null;
  const jurisdiction_requires_purpose_code = mandate !== null;
  const required_code_types = mandate ? mandate.code_types : [];
  const jurisdiction_reason = mandate ? mandate.reason : 'No purpose code mandate identified in CPMI d218 country profiles for ' + (beneficiary_country || 'unknown') + '. Verify current CPMI d218 guidance as requirements evolve.';

  // Purpose code compliance
  const purpose_code_provided = purpose_code.length > 0;
  const purpose_format_valid = purpose_code_provided ? /^[A-Z0-9]{4}$/.test(purpose_code) : null;
  const category_code_provided = category_purpose_code.length > 0;

  let purpose_code_compliant = true;
  if (jurisdiction_requires_purpose_code && !purpose_code_provided) {
    purpose_code_compliant = false;
    issues.push({ code: 'PURPOSE_CODE_REQUIRED', severity: 'ERROR', field: 'Purp/Cd', message: 'Beneficiary country ' + beneficiary_country + ' requires ExternalPurpose1Code. ' + (mandate ? mandate.reason : '') });
  }
  if (purpose_code_provided && !purpose_format_valid) {
    purpose_code_compliant = false;
    issues.push({ code: 'PURPOSE_CODE_FORMAT_INVALID', severity: 'WARNING', field: 'Purp/Cd', message: 'Purpose code "' + purpose_code + '" not in 4-char alphanumeric ISO 20022 ExternalPurpose1Code format.' });
  }

  // SwiftGo eligibility
  const swiftgo_amount_ok = payment_amount_usd > 0 && payment_amount_usd <= SWIFTGO_MAX_USD;
  const swiftgo_category_ok = category_code_provided && SWIFTGO_ACCEPTED_CATEGORY_CODES.indexOf(category_purpose_code) !== -1;
  const swiftgo_eligible = swiftgo_amount_ok && swiftgo_category_ok;
  const swiftgo_notes = [];
  if (!swiftgo_amount_ok) {
    if (payment_amount_usd <= 0) swiftgo_notes.push('Amount not provided or zero -- SwiftGo eligibility cannot be determined.');
    else swiftgo_notes.push('Amount USD ' + payment_amount_usd.toFixed(2) + ' exceeds SwiftGo maximum of $' + SWIFTGO_MAX_USD + '.');
  }
  if (!swiftgo_category_ok) {
    if (!category_code_provided) swiftgo_notes.push('ExternalCategoryPurpose1Code (CtgyPurp/Cd) absent -- required for SwiftGo eligibility check.');
    else swiftgo_notes.push('Category purpose code "' + category_purpose_code + '" not in SwiftGo accepted set: ' + SWIFTGO_ACCEPTED_CATEGORY_CODES.join(', ') + '.');
  }

  const code_type_required = required_code_types.length === 0 ? 'none' : (required_code_types.indexOf('CtgyPurp') !== -1 && required_code_types.indexOf('PurpCd') !== -1 ? 'both' : required_code_types[0]);

  const output_payload = {
    jurisdiction_requires_purpose_code,
    jurisdiction_reason,
    required_code_types,
    code_type_required,
    purpose_code_compliant,
    purpose_code_provided,
    purpose_format_valid,
    category_purpose_code_provided: category_code_provided,
    swiftgo_eligible,
    swiftgo_amount_ok,
    swiftgo_category_ok,
    swiftgo_max_usd: SWIFTGO_MAX_USD,
    swiftgo_accepted_category_codes: SWIFTGO_ACCEPTED_CATEGORY_CODES,
    swiftgo_notes,
    issues,
    pii_note: 'Payment amount is used only for SwiftGo eligibility threshold check. No party PII processed. Use synthetic amounts for testing.',
    table_version: TABLE_VERSION,
    table_source: TABLE_SOURCE,
    regulatory_basis: 'BIS CPMI d218 country payment profiles; SWIFT SwiftGo eligibility criteria; ISO 20022 ExternalPurpose1Code and ExternalCategoryPurpose1Code (iso20022.org External Code Set)',
  };

  const compliance_flags = [];
  if (!purpose_code_compliant) compliance_flags.push('PURPOSE_CODE_NON_COMPLIANT');
  if (jurisdiction_requires_purpose_code && !purpose_code_provided) compliance_flags.push('MANDATORY_PURPOSE_CODE_MISSING');

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
