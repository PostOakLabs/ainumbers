import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-246-lei-payment-binding-linter';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'lint_lei_payment_binding',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Full ISO 17442 LEI check-digit validation via ISO 7064 Mod 97-10 for pacs.008 party bindings.
// Also scores Wolfsberg Payment Transparency Standards for field completeness.
// LEIs are PUBLIC registry data (GLEIF global LEI database, gleif.org) -- no PII.
// table_version: "ISO17442-LEI-CHECK-2024 + WOLFSBERG-PAYMENT-TRANSPARENCY-2023"
// Source: ISO 17442:2020 Legal Entity Identifier (iso.org/standard/78829.html);
//         ISO 7064:2003 Mod 97-10 check digit algorithm;
//         Wolfsberg Payment Transparency Standards (wolfsberg-principles.com/documents/wolfsberg-payment-transparency-standards).

const TABLE_VERSION = 'ISO17442-LEI-CHECK-2024 + WOLFSBERG-PAYMENT-TRANSPARENCY-2023';
const TABLE_SOURCE = 'ISO 17442:2020 Legal Entity Identifier (iso.org/standard/78829.html); ISO 7064:2003 Mod 97-10 check digit algorithm; Wolfsberg Payment Transparency Standards 2023 (wolfsberg-principles.com/documents/wolfsberg-payment-transparency-standards)';

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }

// Convert char to numeric string for ISO 7064: digits pass through, A=10..Z=35
function charToDigits(c) {
  const code = c.charCodeAt(0);
  if (code >= 48 && code <= 57) return c;          // '0'..'9'
  if (code >= 65 && code <= 90) return String(code - 55); // 'A'=10..'Z'=35
  return '';
}

// Iterative mod-97 (safe for any string length -- no BigInt required)
function mod97(numStr) {
  let remainder = 0;
  for (let i = 0; i < numStr.length; i++) {
    remainder = (remainder * 10 + Number(numStr[i])) % 97;
  }
  return remainder;
}

function validateLEI(lei) {
  const clean = lei.trim().toUpperCase();
  if (clean.length === 0) return { valid: null, error: 'Not provided' };
  if (!/^[A-Z0-9]{20}$/.test(clean)) return { valid: false, error: 'LEI must be exactly 20 alphanumeric characters (ISO 17442 format). Got ' + clean.length + ' chars.' };
  const numericStr = clean.split('').map(charToDigits).join('');
  const rem = mod97(numericStr);
  if (rem !== 1) return { valid: false, error: 'ISO 17442 mod-97 check failed (remainder ' + rem + ', expected 1). LEI has invalid check digits.' };
  return { valid: true, error: null };
}

export function compute(pp) {
  pp = pp || {};

  const originator_lei     = safeStr(pp.originator_lei).toUpperCase();
  const beneficiary_lei    = safeStr(pp.beneficiary_lei).toUpperCase();
  const originator_name    = safeStr(pp.originator_name);
  const originator_account = safeStr(pp.originator_account);
  const beneficiary_name   = safeStr(pp.beneficiary_name);
  const beneficiary_account = safeStr(pp.beneficiary_account);

  const issues = [];

  const orig_result = validateLEI(originator_lei);
  const ben_result  = validateLEI(beneficiary_lei);

  const lei_results = {
    originator: { lei: originator_lei.length > 0 ? originator_lei : null, valid: orig_result.valid, error: orig_result.error },
    beneficiary: { lei: beneficiary_lei.length > 0 ? beneficiary_lei : null, valid: ben_result.valid, error: ben_result.error },
  };

  if (orig_result.valid === false) {
    issues.push({ code: 'ORIGINATOR_LEI_INVALID', severity: 'ERROR', field: 'Dbtr/Id/LEI', message: orig_result.error });
  }
  if (ben_result.valid === false) {
    issues.push({ code: 'BENEFICIARY_LEI_INVALID', severity: 'ERROR', field: 'Cdtr/Id/LEI', message: ben_result.error });
  }

  const error_count = issues.length;

  // Wolfsberg Payment Transparency Standards scoring
  // Fields and weights (total 110 points)
  const wolfsberg_fields = [
    { key: 'originator_name',     weight: 20, label: 'Originator name',     present: originator_name.length > 0 },
    { key: 'originator_account',  weight: 15, label: 'Originator account',  present: originator_account.length > 0 },
    { key: 'originator_lei',      weight: 20, label: 'Originator LEI',      present: originator_lei.length > 0 },
    { key: 'beneficiary_name',    weight: 20, label: 'Beneficiary name',    present: beneficiary_name.length > 0 },
    { key: 'beneficiary_account', weight: 15, label: 'Beneficiary account', present: beneficiary_account.length > 0 },
    { key: 'beneficiary_lei',     weight: 20, label: 'Beneficiary LEI',     present: beneficiary_lei.length > 0 },
  ];
  const total_weight = wolfsberg_fields.reduce(function(s, f) { return s + f.weight; }, 0);
  const achieved_weight = wolfsberg_fields.filter(function(f) { return f.present; }).reduce(function(s, f) { return s + f.weight; }, 0);
  const wolfsberg_transparency_score = Math.round((achieved_weight / total_weight) * 100);
  const wolfsberg_transparency_tier = wolfsberg_transparency_score >= 80 ? 'HIGH' : wolfsberg_transparency_score >= 50 ? 'MEDIUM' : 'LOW';
  const wolfsberg_field_results = wolfsberg_fields.map(function(f) { return { label: f.label, present: f.present, weight: f.weight }; });

  const lei_valid = error_count === 0 && (originator_lei.length === 0 || orig_result.valid === true) && (beneficiary_lei.length === 0 || ben_result.valid === true);

  const output_payload = {
    lei_valid,
    error_count,
    lei_results,
    wolfsberg_transparency_score,
    wolfsberg_transparency_tier,
    wolfsberg_field_results,
    issues,
    pii_note: 'LEIs are PUBLIC registry data (GLEIF global LEI database, gleif.org). Party names and account identifiers are processed structurally for presence/format only. No real PII processed -- use synthetic data for testing.',
    table_version: TABLE_VERSION,
    table_source: TABLE_SOURCE,
    regulatory_basis: 'ISO 17442:2020 Legal Entity Identifier; ISO 7064:2003 Mod 97-10; Wolfsberg Payment Transparency Standards 2023; CPMI d218 LEI mandate guidance',
  };

  const compliance_flags = [];
  if (!lei_valid) compliance_flags.push('LEI_INVALID');
  if (wolfsberg_transparency_tier === 'LOW') compliance_flags.push('WOLFSBERG_TRANSPARENCY_LOW');
  if (wolfsberg_transparency_tier === 'MEDIUM') compliance_flags.push('WOLFSBERG_TRANSPARENCY_MEDIUM');

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
