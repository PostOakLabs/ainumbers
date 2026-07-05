import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-247-prevalidation-readiness-scorer';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'prevalidation_readiness_scorer',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Aggregate CBPR+ pre-validation readiness check for a single pacs.008 payment instruction.
// Combines IBAN mod-97, BIC format, LEI format, UUIDv4 UETR, and PostalAddress24 structure checks
// into a single /ready boolean for STP gate use.
// This is the gate node for the cross-border-payment-prevalidation chain:
//   art-243 (purpose-code-requirement-checker) -> art-247 (prevalidation-readiness-scorer)
//   gate: /ready = true -> end (payment ready for STP); /ready = false -> end (remediation required).
// table_version: "CBPR-PLUS-PREVALIDATION-COMPOSITE-V1"
// Source: SWIFT CBPR+ Structured Address Migration Bulletin; BIS CPMI d218; ISO 13616 IBAN;
//         ISO 9362 BIC; ISO 17442 LEI; ISO 20022 pacs.008.001.10.

const TABLE_VERSION = 'CBPR-PLUS-PREVALIDATION-COMPOSITE-V1';
const TABLE_SOURCE = 'SWIFT CBPR+ Structured Address Migration Bulletin (swift.com/cbpr-plus-migration); BIS CPMI d218; ISO 13616:2020 IBAN; ISO 9362:2022 BIC; ISO 17442:2020 LEI; ISO 20022 pacs.008.001.10 (iso20022.org)';

// IBAN country lengths per ISO 13616 (representative set -- not exhaustive)
const IBAN_LENGTHS = {
  AD:24, AE:23, AL:28, AT:20, AZ:28, BA:20, BE:16, BG:22, BH:22, BR:29,
  BY:28, CH:21, CR:22, CY:28, CZ:24, DE:22, DK:18, DO:28, EE:20, EG:29,
  ES:24, FI:18, FK:18, FR:27, GB:22, GE:22, GI:23, GL:18, GR:27, GT:28,
  HR:21, HU:28, IE:22, IL:23, IQ:23, IS:26, IT:27, JO:30, KW:30, KZ:20,
  LB:28, LC:32, LI:21, LT:20, LU:20, LV:21, MC:27, MD:24, ME:22, MK:19,
  MR:27, MT:31, MU:30, NL:18, NO:15, PK:24, PL:28, PS:29, PT:25, QA:29,
  RO:24, RS:22, SA:24, SC:31, SD:18, SE:24, SI:19, SK:24, SM:27, ST:25,
  SV:28, TL:23, TN:24, TR:26, UA:29, VA:22, VG:24, XK:20,
};

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }

function charToDigits(c) {
  const code = c.charCodeAt(0);
  if (code >= 48 && code <= 57) return c;
  if (code >= 65 && code <= 90) return String(code - 55);
  return '';
}

// Iterative mod-97 -- no BigInt required
function mod97(numStr) {
  let remainder = 0;
  for (let i = 0; i < numStr.length; i++) {
    remainder = (remainder * 10 + Number(numStr[i])) % 97;
  }
  return remainder;
}

function validateIBAN(iban) {
  if (iban.length === 0) return { valid: null, error: 'Not provided' };
  const clean = iban.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(clean)) return { valid: false, error: 'IBAN "' + clean.slice(0, 8) + '..." malformed (must start with 2-letter country code + 2 check digits).' };
  const ctry = clean.slice(0, 2);
  const expected_len = IBAN_LENGTHS[ctry];
  if (expected_len && clean.length !== expected_len) return { valid: false, error: 'IBAN country ' + ctry + ' requires ' + expected_len + ' chars; got ' + clean.length + '.' };
  const rearranged = clean.slice(4) + clean.slice(0, 4);
  const numStr = rearranged.split('').map(charToDigits).join('');
  const rem = mod97(numStr);
  if (rem !== 1) return { valid: false, error: 'IBAN mod-97 check failed (remainder ' + rem + ', expected 1). Check digits invalid.' };
  return { valid: true, error: null };
}

function validateBIC(bic) {
  if (bic.length === 0) return { valid: null, error: 'Not provided' };
  const clean = bic.toUpperCase();
  if (/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(clean)) return { valid: true, error: null };
  return { valid: false, error: 'BIC "' + clean + '" not valid ISO 9362 format (4-letter institution + 2-letter country + 2-char location + optional 3-char branch).' };
}

function validateLEIFormat(lei) {
  if (lei.length === 0) return { valid: null, error: 'Not provided' };
  const clean = lei.toUpperCase();
  if (/^[A-Z0-9]{20}$/.test(clean)) return { valid: true, error: null };
  return { valid: false, error: 'LEI must be exactly 20 alphanumeric chars (ISO 17442 format). Got ' + clean.length + ' chars.' };
}

function validateUETR(uetr) {
  if (uetr.length === 0) return { valid: false, error: 'UETR absent -- required for SWIFT GPI.' };
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uetr)) return { valid: true, error: null };
  return { valid: false, error: 'UETR "' + uetr.slice(0, 8) + '..." is not a valid UUIDv4 (8-4-4-4-12 hex, version nibble=4, variant nibble in {8,9,a,b}).' };
}

function validateAddress(pp) {
  const strtNm   = safeStr(pp.address_street_name);
  const twnNm    = safeStr(pp.address_town_name);
  const ctry     = safeStr(pp.address_country).toUpperCase();
  const adrLines = Array.isArray(pp.address_lines) ? pp.address_lines : [];
  const hasStrtNm   = strtNm.length > 0;
  const hasTwnNm    = twnNm.length > 0;
  const hasCtry     = ctry.length === 2 && /^[A-Z]{2}$/.test(ctry);
  const hasAdrLine  = adrLines.length > 0;
  const structured_field_count = (hasStrtNm ? 1 : 0) + (safeStr(pp.address_building_number).length > 0 ? 1 : 0) + (safeStr(pp.address_post_code).length > 0 ? 1 : 0);

  if (!hasAdrLine && structured_field_count >= 1 && hasCtry) return { valid: true, type: 'FULLY_STRUCTURED', error: null };
  if (hasTwnNm && hasCtry && adrLines.length <= 2) {
    // Check silent-fail
    const structuredValues = [strtNm, twnNm].filter(function(v) { return v.length >= 3; });
    for (let i = 0; i < adrLines.length; i++) {
      const l = safeStr(adrLines[i]).toLowerCase();
      for (let j = 0; j < structuredValues.length; j++) {
        if (l.includes(structuredValues[j].toLowerCase())) {
          return { valid: false, type: 'HYBRID_SILENT_FAIL', error: 'CBPR+ hybrid address: AdrLine[' + i + '] duplicates structured value "' + structuredValues[j] + '" (silent-fail STP rejection). Remove duplicated component from AdrLine.' };
        }
      }
    }
    return { valid: true, type: 'HYBRID', error: null };
  }
  if (hasAdrLine && structured_field_count === 0 && !hasTwnNm) return { valid: false, type: 'UNSTRUCTURED', error: 'Unstructured address prohibited after 14 Nov 2026 (CBPR+ mandate). Migrate to hybrid or fully-structured format.' };
  if (!hasAdrLine && !hasCtry && structured_field_count === 0 && !hasTwnNm) return { valid: false, type: 'EMPTY', error: 'No address fields populated.' };
  return { valid: false, type: 'MIXED_INVALID', error: 'Address mix of structured and unstructured fields is invalid. Use fully-structured or hybrid format.' };
}

export function compute(pp) {
  pp = pp || {};

  const iban = safeStr(pp.iban);
  const bic  = safeStr(pp.bic).toUpperCase();
  const lei  = safeStr(pp.lei).toUpperCase();
  const uetr = safeStr(pp.uetr);

  const iban_result = validateIBAN(iban);
  const bic_result  = validateBIC(bic);
  const lei_result  = validateLEIFormat(lei);
  const uetr_result = validateUETR(uetr);
  const addr_result = validateAddress(pp);

  const checks = [
    { name: 'iban_mod97',       pass: iban_result.valid !== false, required: false, result: iban_result },
    { name: 'bic_format',       pass: bic_result.valid !== false,  required: false, result: bic_result },
    { name: 'lei_format',       pass: lei_result.valid !== false,  required: false, result: lei_result },
    { name: 'uetr_uuidv4',      pass: uetr_result.valid,           required: true,  result: uetr_result },
    { name: 'address_structure', pass: addr_result.valid !== false, required: true,  result: addr_result },
  ];

  const checks_passed = checks.filter(function(c) { return c.pass; }).length;
  const checks_total  = checks.length;
  const required_failed = checks.filter(function(c) { return c.required && !c.pass; });
  const optional_failed = checks.filter(function(c) { return !c.required && c.pass === false; });
  const readiness_pct = Math.round((checks_passed / checks_total) * 100);

  // /ready = true only if UETR is valid AND address is not unstructured/empty/invalid
  // (IBAN/BIC/LEI are optional -- only checked if provided)
  const ready = required_failed.length === 0 && optional_failed.length === 0;

  const check_details = {
    iban: { provided: iban.length > 0, valid: iban_result.valid, error: iban_result.error },
    bic: { provided: bic.length > 0, valid: bic_result.valid, error: bic_result.error },
    lei: { provided: lei.length > 0, valid: lei_result.valid, error: lei_result.error },
    uetr: { provided: uetr.length > 0, valid: uetr_result.valid, error: uetr_result.error },
    address: { type: addr_result.type || 'NOT_PROVIDED', valid: addr_result.valid, error: addr_result.error },
  };

  const remediation_actions = [];
  if (!uetr_result.valid) remediation_actions.push('Generate a new UUIDv4 UETR for this payment instruction (use RFC 4122 version 4 format).');
  if (addr_result.valid === false) remediation_actions.push('Fix address structure: ' + (addr_result.error || 'see check_details.address'));
  if (iban_result.valid === false) remediation_actions.push('Correct IBAN: ' + (iban_result.error || 'invalid'));
  if (bic_result.valid === false) remediation_actions.push('Correct BIC: ' + (bic_result.error || 'invalid'));
  if (lei_result.valid === false) remediation_actions.push('Correct LEI: ' + (lei_result.error || 'invalid. For full mod-97 check use lint_lei_payment_binding (art-246)'));

  const output_payload = {
    ready,
    checks_passed,
    checks_total,
    readiness_pct,
    check_details,
    remediation_actions,
    cbpr_plus_deadline: '2026-11-14',
    chain_gate_note: 'ready=true means this payment instruction passes CBPR+ pre-validation for STP; ready=false means one or more checks failed and remediation is required before submission.',
    pii_note: 'IBAN, BIC, and LEI are structural payment identifiers, not personal data. All checks are format/structure only. No real party PII processed -- use synthetic identifiers for testing.',
    table_version: TABLE_VERSION,
    table_source: TABLE_SOURCE,
    regulatory_basis: 'SWIFT CBPR+ Structured Address Migration Bulletin; BIS CPMI d218; ISO 13616 IBAN; ISO 9362 BIC; ISO 17442 LEI; ISO 20022 pacs.008.001.10',
  };

  const compliance_flags = [];
  if (!ready) compliance_flags.push('CBPR_PREVALIDATION_FAILED');
  if (!uetr_result.valid) compliance_flags.push('UETR_INVALID');
  if (addr_result.valid === false) compliance_flags.push('ADDRESS_INVALID');

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
