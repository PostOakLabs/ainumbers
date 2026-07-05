import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-256-validate-openids-homeowners-record';
const TOOL_VERSION = '1.0.0';

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mandate_type: 'compliance_mandate', gpu: false };

// openIDS Homeowners v1.0 data record validation.
// Standard: openIDS Homeowners Data Standard v1.0 (AAIS / Linux Foundation, November 2025)
// This is the first FREE open insurance data standard. Not ACORD XML/AL3.
// NEVER build an "ACORD validator" or embed ACORD schema (membership-licensed).
// ZERO PII: structural/field validation only. No policyholder personal data.

const STANDARD_VERSION = 'openIDS-Homeowners-v1.0';
const TABLE_SOURCE     = 'openIDS Homeowners Data Standard v1.0, AAIS / Linux Foundation, November 2025. Available at openids.org. Apache-2.0 licensed.';

// Required top-level sections per openIDS Homeowners v1.0 schema
const REQUIRED_SECTIONS = [
  'policy',
  'insured_location',
  'coverage',
  'premium',
];

// Required fields per section (subset for structural validation)
const SECTION_REQUIRED_FIELDS = {
  policy: ['policy_number', 'effective_date', 'expiration_date', 'policy_type'],
  insured_location: ['street_address', 'city', 'state', 'zip_code', 'construction_type'],
  coverage: ['dwelling_limit', 'other_structures_limit', 'personal_property_limit', 'liability_limit'],
  premium: ['annual_premium', 'payment_plan'],
};

// Allowed coverage types per openIDS Homeowners v1.0
const VALID_POLICY_TYPES = ['HO-1','HO-2','HO-3','HO-4','HO-5','HO-6','HO-7','HO-8','DP-1','DP-2','DP-3'];
const VALID_PAYMENT_PLANS = ['annual','semi-annual','quarterly','monthly','escrow'];
const VALID_CONSTRUCTION_TYPES = ['frame','masonry','superior','mixed','manufactured','modular'];

export function compute(params) {
  const p = params || {};
  const record = typeof p.record === 'object' && p.record !== null ? p.record : {};

  const errors   = [];
  const warnings = [];
  const section_results = {};

  // 1. Check required top-level sections
  for (const section of REQUIRED_SECTIONS) {
    const present = Object.prototype.hasOwnProperty.call(record, section) &&
                    record[section] !== null &&
                    typeof record[section] === 'object';
    section_results[section] = { present, field_errors: [] };
    if (!present) {
      errors.push(`Missing required section: ${section}`);
      continue;
    }

    // 2. Check required fields within section
    const required = SECTION_REQUIRED_FIELDS[section] || [];
    for (const field of required) {
      const hasField = Object.prototype.hasOwnProperty.call(record[section], field) &&
                       record[section][field] !== null &&
                       record[section][field] !== '';
      if (!hasField) {
        const msg = `${section}.${field} is required`;
        errors.push(msg);
        section_results[section].field_errors.push(field);
      }
    }
  }

  // 3. Policy-type validation
  if (record.policy && record.policy.policy_type) {
    if (!VALID_POLICY_TYPES.includes(record.policy.policy_type)) {
      errors.push(`policy.policy_type "${record.policy.policy_type}" not in openIDS v1.0 allowed values: ${VALID_POLICY_TYPES.join(', ')}`);
    }
  }

  // 4. Date ordering: effective < expiration
  if (record.policy && record.policy.effective_date && record.policy.expiration_date) {
    const eff = Date.parse(record.policy.effective_date);
    const exp = Date.parse(record.policy.expiration_date);
    if (!isNaN(eff) && !isNaN(exp) && eff >= exp) {
      errors.push('policy.effective_date must be before policy.expiration_date');
    }
  }

  // 5. Payment plan validation
  if (record.premium && record.premium.payment_plan) {
    if (!VALID_PAYMENT_PLANS.includes(record.premium.payment_plan.toLowerCase())) {
      errors.push(`premium.payment_plan "${record.premium.payment_plan}" not in openIDS v1.0 allowed values: ${VALID_PAYMENT_PLANS.join(', ')}`);
    }
  }

  // 6. Construction type validation
  if (record.insured_location && record.insured_location.construction_type) {
    if (!VALID_CONSTRUCTION_TYPES.includes(record.insured_location.construction_type.toLowerCase())) {
      warnings.push(`insured_location.construction_type "${record.insured_location.construction_type}" not in standard set: ${VALID_CONSTRUCTION_TYPES.join(', ')}`);
    }
  }

  // 7. Coverage limit positivity
  if (record.coverage) {
    const cov = record.coverage;
    const limitFields = ['dwelling_limit','other_structures_limit','personal_property_limit','liability_limit'];
    for (const f of limitFields) {
      if (cov[f] !== undefined && cov[f] !== null) {
        const v = Number(cov[f]);
        if (!isFinite(v) || v < 0) {
          errors.push(`coverage.${f} must be a non-negative number`);
        }
      }
    }
    // other_structures typically 10% of dwelling
    if (cov.dwelling_limit > 0 && cov.other_structures_limit > 0) {
      const ratio = cov.other_structures_limit / cov.dwelling_limit;
      if (ratio > 0.5) {
        warnings.push(`coverage.other_structures_limit is ${(ratio*100).toFixed(0)}% of dwelling_limit; typical openIDS v1.0 guidance is ≤10%`);
      }
    }
  }

  // 8. PII guard: flag if obvious PII fields present
  const pii_fields_found = [];
  const flat_keys = _flatKeys(record);
  const pii_patterns = ['ssn','social_security','tax_id','date_of_birth','dob','drivers_license','credit_score','income'];
  for (const k of flat_keys) {
    if (pii_patterns.some(pat => k.toLowerCase().includes(pat))) {
      pii_fields_found.push(k);
    }
  }
  if (pii_fields_found.length > 0) {
    warnings.push(`PII fields detected (should not appear in openIDS record): ${pii_fields_found.join(', ')}`);
  }

  const sections_present = REQUIRED_SECTIONS.filter(s => section_results[s] && section_results[s].present).length;
  const record_valid = errors.length === 0;

  return {
    record_valid,
    standard_version: STANDARD_VERSION,
    sections_present,
    sections_required: REQUIRED_SECTIONS.length,
    section_results,
    errors,
    warnings,
    pii_fields_found,
    error_count:   errors.length,
    warning_count: warnings.length,
    table_source:  TABLE_SOURCE,
    regulatory_basis:'openIDS Homeowners Data Standard v1.0 (AAIS / Linux Foundation, November 2025). First open (Apache-2.0) homeowners insurance data standard. NOT an ACORD validator -- ACORD XML/AL3 is membership-licensed and not reproduced here.',
    pii_note:        'ZERO PII: structural/field validation only. Record content is inspected for field presence and type; personal data is flagged as a warning, not stored or logged.',
    not_legal_advice:'Not legal or insurance regulatory advice. Insurance record format compliance must be verified by licensed insurance professionals and applicable state DOI requirements.',
  };
}

function _flatKeys(obj, prefix) {
  prefix = prefix || '';
  if (typeof obj !== 'object' || obj === null) return [];
  return Object.keys(obj).flatMap(k => {
    const full = prefix ? `${prefix}.${k}` : k;
    return typeof obj[k] === 'object' ? _flatKeys(obj[k], full) : [full];
  });
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const output_payload = compute(pp);
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
    compliance_flags: [],
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
