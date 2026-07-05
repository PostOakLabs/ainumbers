import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-269-validate-w8-series-structural';
const TOOL_VERSION = '1.0.0';

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mandate_type: 'compliance_mandate', gpu: false };

// W-8 series structural consistency kernel.
// Chapter 3 (withholding) vs Chapter 4 (FATCA) consistency + treaty rate table + 3-year validity.
// SYNTHETIC inputs only. NEVER real TINs, names, addresses, or personal data.
// Source: IRS W-8 series Instructions (Rev. Oct 2021 / Jan 2023); Treas. Reg. §1.1441; FATCA §1471-1474.

// Ch.3 status codes per IRS W-8BEN-E instructions
const CHAPTER3_STATUSES = new Set([
  'Individual', 'Corporation', 'Disregarded_entity', 'Partnership',
  'Simple_trust', 'Grantor_trust', 'Complex_trust', 'Estate',
  'Government', 'Central_bank', 'Tax_exempt_organization',
  'Private_foundation', 'International_organization',
  'Foreign_government', 'U.S. branch',
]);

// Ch.4 FATCA status codes
const CHAPTER4_STATUSES = new Set([
  'NFFE_Active', 'NFFE_Passive', 'FFI', 'Deemed_compliant_FFI',
  'Exempt_beneficial_owner', 'Nonparticipating_FFI', 'Owner_documented_FFI',
  'Certified_deemed_compliant_FFI', 'Participating_FFI',
  'Registered_deemed_compliant_FFI', 'Sponsoring_entity', 'Territory_FI',
  'Excepted_NFFE', 'Direct_reporting_NFFE',
]);

// Form type to valid Ch.3 status mapping (structural rule)
const FORM_CH3_MAP = {
  'W-8BEN':   new Set(['Individual']),
  'W-8BEN-E': new Set(['Corporation','Disregarded_entity','Partnership','Simple_trust','Grantor_trust',
                        'Complex_trust','Estate','Government','Central_bank','Tax_exempt_organization',
                        'Private_foundation','International_organization','Foreign_government']),
  'W-8ECI':   new Set(['Individual','Corporation','Partnership','Simple_trust','Grantor_trust','Complex_trust',
                        'Estate','Government','Central_bank','Tax_exempt_organization','Private_foundation']),
  'W-8EXP':   new Set(['Government','Central_bank','Tax_exempt_organization','Private_foundation',
                        'International_organization']),
  'W-8IMY':   new Set(['Partnership','Simple_trust','Grantor_trust','Complex_trust','Estate',
                        'FFI','Territory_FI','U.S. branch']),
};

// Treaty rate lookup stub: representative rates for US-XX treaty on dividend income
// Source: IRS Publication 901 (US Tax Treaties); IRS Table 1 treaty withholding rates.
// This is a structural/educational table. Verify against current IRS Pub 901 for binding rates.
const TREATY_DIV_RATES = {
  'AU': 15, 'AT': 15, 'BE': 15, 'CA': 25, 'CN': 10, 'CZ': 15, 'DK': 15,
  'FI': 15, 'FR': 15, 'DE': 15, 'GR': 30, 'HU': 15, 'IS': 15, 'IE': 15,
  'IL': 25, 'IT': 15, 'JP': 10, 'KZ': 15, 'LU': 15, 'MX': 10, 'NL': 15,
  'NZ': 15, 'NO': 15, 'PL': 15, 'PT': 15, 'RO': 10, 'RU': 10, 'SK': 15,
  'SI': 15, 'ZA': 15, 'ES': 15, 'SE': 15, 'CH': 15, 'TR': 20, 'UA': 15,
  'GB': 15,
};

// US statutory withholding rate (no treaty)
const STATUTORY_RATE = 30;

export function compute(policy_parameters) {
  const {
    form_type = '',
    chapter3_status = '',
    chapter4_fatca_status = '',
    treaty_country = null,
    treaty_rate_pct = null,
    income_type = null,
    form_date = '',
    reference_date = '',
  } = policy_parameters;

  const violations = [];

  // Form type validity
  const valid_form_types = ['W-8BEN', 'W-8BEN-E', 'W-8ECI', 'W-8EXP', 'W-8IMY'];
  if (!valid_form_types.includes(form_type)) {
    violations.push({ code: 'INVALID_FORM_TYPE', message: `form_type "${form_type}" not in W-8 series` });
  }

  // Ch.3 status validity
  const ch3Valid = CHAPTER3_STATUSES.has(chapter3_status);
  if (!ch3Valid) {
    violations.push({ code: 'INVALID_CH3_STATUS', message: `chapter3_status "${chapter3_status}" not recognized` });
  }

  // Ch.4 FATCA status validity (required for W-8BEN-E; optional for W-8BEN individual)
  let ch4Valid = true;
  if (form_type === 'W-8BEN-E' || form_type === 'W-8ECI') {
    if (!CHAPTER4_STATUSES.has(chapter4_fatca_status)) {
      ch4Valid = false;
      violations.push({ code: 'INVALID_CH4_STATUS', message: `chapter4_fatca_status "${chapter4_fatca_status}" not recognized for ${form_type}` });
    }
  }

  // Form vs Ch.3 compatibility
  let form_ch3_compatible = true;
  const allowedCh3 = FORM_CH3_MAP[form_type];
  if (allowedCh3 && !allowedCh3.has(chapter3_status)) {
    form_ch3_compatible = false;
    violations.push({
      code: 'FORM_CH3_MISMATCH',
      message: `${form_type} requires Ch.3 status in {${[...allowedCh3].join(', ')}}, got "${chapter3_status}"`,
    });
  }

  // Ch.3 vs Ch.4 structural consistency
  let ch3_ch4_consistent = true;
  if (chapter3_status === 'Individual' && chapter4_fatca_status && !['NFFE_Active','NFFE_Passive','Excepted_NFFE'].includes(chapter4_fatca_status)) {
    if (form_type === 'W-8BEN-E') {
      // W-8BEN-E + Individual is structurally inconsistent (W-8BEN for individuals)
      ch3_ch4_consistent = false;
      violations.push({ code: 'CH3_CH4_INCONSISTENT', message: 'W-8BEN-E is for entities; Individual Ch.3 status should use W-8BEN' });
    }
  }
  if (['FFI','Participating_FFI','Nonparticipating_FFI'].includes(chapter4_fatca_status) &&
      ['Individual','Estate'].includes(chapter3_status)) {
    ch3_ch4_consistent = false;
    violations.push({ code: 'CH3_CH4_INCONSISTENT', message: `FFI Ch.4 status is incompatible with ${chapter3_status} Ch.3 status` });
  }

  // 3-year validity window (IRS Rev. Proc. guidance: generally 3 calendar years after year of signing)
  let validity_window_ok = false;
  let validity_expiry_date = null;
  let days_until_expiry = null;

  if (form_date && reference_date) {
    // Parse dates as YYYY-MM-DD
    const fd = form_date.split('-').map(Number);
    const rd = reference_date.split('-').map(Number);
    if (fd.length === 3 && rd.length === 3) {
      const formYear = fd[0];
      const refYear = rd[0], refMonth = rd[1], refDay = rd[2];
      // Expiry: Dec 31 of the third calendar year following the year of signing
      const expiryYear = formYear + 3;
      validity_expiry_date = `${expiryYear}-12-31`;
      validity_window_ok = (refYear < expiryYear) ||
        (refYear === expiryYear && (refMonth < 12 || (refMonth === 12 && refDay <= 31)));
      // Days until expiry (approximate: no transcendentals needed)
      const expiryDays = expiryYear * 365 + 12 * 30 + 31;
      const refDays = refYear * 365 + refMonth * 30 + refDay;
      days_until_expiry = expiryDays - refDays;
    }
  }

  if (!validity_window_ok && form_date && reference_date) {
    violations.push({ code: 'VALIDITY_EXPIRED', message: `W-8 form dated ${form_date} expired on ${validity_expiry_date}; re-collect from payee` });
  }

  // Treaty rate structural check
  let treaty_rate_valid = null;
  let treaty_rate_expected = null;
  if (treaty_country && treaty_rate_pct !== null) {
    treaty_rate_expected = TREATY_DIV_RATES[treaty_country.toUpperCase()] || null;
    if (treaty_rate_expected !== null) {
      treaty_rate_valid = treaty_rate_pct <= treaty_rate_expected;
      if (!treaty_rate_valid) {
        violations.push({
          code: 'TREATY_RATE_EXCEEDS_EXPECTED',
          message: `treaty_rate_pct ${treaty_rate_pct}% for ${treaty_country} exceeds IRS Pub 901 dividend rate ${treaty_rate_expected}% (verify income type)`,
        });
      }
    } else {
      treaty_rate_valid = null; // Country not in treaty table; cannot validate
    }
  } else if (treaty_country && treaty_rate_pct === null) {
    violations.push({ code: 'TREATY_RATE_MISSING', message: `treaty_country ${treaty_country} specified but treaty_rate_pct not provided` });
  }

  const is_structurally_valid = violations.length === 0;

  return {
    is_structurally_valid,
    form_type,
    chapter3_status,
    chapter4_fatca_status,
    form_ch3_compatible,
    ch3_ch4_consistent,
    treaty_country: treaty_country || null,
    treaty_rate_pct: treaty_rate_pct || null,
    treaty_rate_expected,
    treaty_rate_valid,
    validity_window_ok,
    validity_expiry_date,
    days_until_expiry,
    violation_count: violations.length,
    violations,
    statutory_withholding_rate_pct: STATUTORY_RATE,
    table_version: 'IRS-W8-SERIES-CH3-CH4-2024',
    table_source: 'IRS W-8BEN Instructions (Rev. Oct 2021); IRS W-8BEN-E Instructions (Rev. Oct 2021); IRS W-8ECI, W-8EXP, W-8IMY Instructions; IRS Publication 901 US Tax Treaties dividend rates; Treas. Reg. §1.1441-1(e)(4)(ii) 3-year validity window.',
    regulatory_basis: 'Treas. Reg. §1.1441: withholding on US-source income to foreign persons. §1.1441-1(e)(4)(ii): W-8 valid 3 calendar years after signing year. FATCA §§1471-1474 Chapter 4 status requirements for W-8BEN-E. IRS Pub 901 treaty rates. ZERO PII: structural form-type/status/treaty codes only.',
    pii_note: 'ZERO PII: structural form type, Ch.3/Ch.4 status codes, treaty country code, and dates only. No TIN, EIN, name, address, or real beneficial-owner data enters this kernel.',
    not_legal_advice: 'Not tax or legal advice. W-8 structural analysis requires review by qualified tax counsel; consult current IRS instructions and your withholding agent policies before certifying beneficial ownership.',
  };
}

export async function buildArtifact(policy_parameters, opts = {}) {
  const output_payload = compute(policy_parameters);
  const execution_hash = await executionHash(policy_parameters, output_payload);
  return {
    chaingraph_version: '0.4.0',
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    policy_parameters,
    output_payload,
    execution_hash,
  };
}
