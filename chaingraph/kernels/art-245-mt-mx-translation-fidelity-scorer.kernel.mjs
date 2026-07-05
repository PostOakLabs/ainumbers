import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-245-mt-mx-translation-fidelity-scorer';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'score_mt_mx_translation_fidelity',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Scores ISO 15022 MT103 -> ISO 20022 pacs.008 translation fidelity.
// Checks field presence, format mapping correctness, and truncation risks
// for the CBPR+ Nov-2026 mandatory migration.
// table_version: "MT103-PACS008-FIELD-MAP-CBPR-V1"
// Source: SWIFT Standards Release Guide MT103 (swift.com/standards);
//         ISO 20022 pacs.008.001.10 message definition (iso20022.org);
//         SWIFT CBPR+ Translation Rules for MT103 to pacs.008 migration.

const TABLE_VERSION = 'MT103-PACS008-FIELD-MAP-CBPR-V1';
const TABLE_SOURCE = 'SWIFT Standards Release Guide MT103 (swift.com/standards); ISO 20022 pacs.008.001.10 message definition (iso20022.org); SWIFT CBPR+ Translation Rules for MT103 to pacs.008 migration';

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }
function safeNum(v) { const n = Number(v); return isFinite(n) ? n : 0; }

// MT103 field max lengths (key truncation-risk fields)
const MT_MAX_LENGTHS = {
  f20:  16, // Transaction reference
  f50k: 35, // Ordering customer name (and each address line)
  f59:  35, // Beneficiary name (and each address line)
  f70:  35, // Remittance info per line (4 lines max = 140 chars total)
  f72:  35, // Sender to receiver info per line
};

// pacs.008 field max lengths
const MX_MAX_LENGTHS = {
  nm:     140, // Debtor/Creditor Nm
  adrLine: 70, // PostalAddress24 AdrLine
  ustrd:  140, // RmtInf/Ustrd (total)
};

// ChargeBearer mapping
const CHARGE_BEARER_MAP = {
  'OUR': 'DEBT',
  'SHA': 'SHAR',
  'BEN': 'CRED',
};

export function compute(pp) {
  pp = pp || {};

  // MT103 input fields
  const mt_f20  = safeStr(pp.mt_f20);   // Transaction reference
  const mt_f23b = safeStr(pp.mt_f23b);  // Bank operation code
  const mt_f32a = safeStr(pp.mt_f32a);  // Value date + currency + amount
  const mt_f50  = safeStr(pp.mt_f50);   // Ordering customer (50K = name+address or 50A = account+BIC)
  const mt_f52a = safeStr(pp.mt_f52a);  // Ordering institution BIC
  const mt_f57a = safeStr(pp.mt_f57a);  // Account with institution BIC
  const mt_f59  = safeStr(pp.mt_f59);   // Beneficiary
  const mt_f70  = safeStr(pp.mt_f70);   // Remittance info
  const mt_f71a = safeStr(pp.mt_f71a).toUpperCase(); // Details of charges (OUR/SHA/BEN)

  // pacs.008 output fields
  const mx_uetr     = safeStr(pp.mx_uetr);     // End-to-end UETR
  const mx_dbtr_nm  = safeStr(pp.mx_dbtr_nm);  // Dbtr/Nm
  const mx_cdtr_nm  = safeStr(pp.mx_cdtr_nm);  // Cdtr/Nm
  const mx_cdtr_agt = safeStr(pp.mx_cdtr_agt); // CdtrAgt/BICFI
  const mx_dbtr_agt = safeStr(pp.mx_dbtr_agt); // DbtrAgt/BICFI
  const mx_rmt_ustrd = safeStr(pp.mx_rmt_ustrd); // RmtInf/Ustrd
  const mx_chrg_br  = safeStr(pp.mx_chrg_br).toUpperCase(); // ChrgBr

  const mapping_results = [];
  const truncation_risks = [];
  const issues = [];

  // --- Field mapping checks ---

  // :20: TRN -> UETR note (not a direct map but must be present in pacs.008)
  const f20_present = mt_f20.length > 0;
  const uetr_present = mx_uetr.length > 0;
  mapping_results.push({ mt_field: ':20: TRN', mx_field: 'UETR', mt_present: f20_present, mx_present: uetr_present, note: ':20: is the MT reference; pacs.008 requires a new UUIDv4 UETR (not a direct carry-over of :20:).' });
  if (!uetr_present) {
    issues.push({ code: 'UETR_ABSENT', severity: 'ERROR', field: 'mx_uetr', message: 'UETR absent in pacs.008 output. A new UUIDv4 UETR must be generated for each pacs.008 instruction (GPI mandatory).' });
  }

  // :50K/:50A -> Dbtr/Nm truncation risk
  const f50_present = mt_f50.length > 0;
  const dbtr_nm_present = mx_dbtr_nm.length > 0;
  mapping_results.push({ mt_field: ':50K/A OrderingCustomer', mx_field: 'Dbtr/Nm', mt_present: f50_present, mx_present: dbtr_nm_present, note: ':50K: 4 lines x 35 chars; Dbtr/Nm allows 140 chars. Name truncation risk if MT line contained both name and account on same line.' });
  if (f50_present && !dbtr_nm_present) {
    issues.push({ code: 'DBTR_NM_MISSING_FROM_MT50', severity: 'ERROR', field: 'mx_dbtr_nm', message: 'MT :50K/A present but Dbtr/Nm absent in pacs.008. Extract ordering customer name from MT field.' });
  }
  if (f50_present && mx_dbtr_nm.length > MX_MAX_LENGTHS.nm) {
    truncation_risks.push({ field: 'Dbtr/Nm', severity: 'WARNING', message: 'Dbtr/Nm exceeds ' + MX_MAX_LENGTHS.nm + ' chars (' + mx_dbtr_nm.length + '). ISO 20022 max name length is 140 chars.' });
  }

  // :59/:59A -> Cdtr/Nm
  const f59_present = mt_f59.length > 0;
  const cdtr_nm_present = mx_cdtr_nm.length > 0;
  mapping_results.push({ mt_field: ':59/A Beneficiary', mx_field: 'Cdtr/Nm', mt_present: f59_present, mx_present: cdtr_nm_present, note: ':59: 4 lines x 35 chars; Cdtr/Nm max 140 chars. Beneficiary name + address must be split into Nm and PostalAddress24 in pacs.008.' });
  if (f59_present && !cdtr_nm_present) {
    issues.push({ code: 'CDTR_NM_MISSING_FROM_MT59', severity: 'ERROR', field: 'mx_cdtr_nm', message: 'MT :59/:59A present but Cdtr/Nm absent in pacs.008.' });
  }

  // :52A -> DbtrAgt/BICFI
  const f52_present = mt_f52a.length > 0;
  const dbtr_agt_present = mx_dbtr_agt.length > 0;
  mapping_results.push({ mt_field: ':52A OrderingInstitution', mx_field: 'DbtrAgt/BICFI', mt_present: f52_present, mx_present: dbtr_agt_present, note: ':52A BIC carries directly to DbtrAgt/BICFI. Direct 1-to-1 mapping.' });
  if (f52_present && !dbtr_agt_present) {
    issues.push({ code: 'DBTR_AGT_MISSING', severity: 'WARNING', field: 'mx_dbtr_agt', message: ':52A present but DbtrAgt/BICFI absent in pacs.008.' });
  }

  // :57A -> CdtrAgt/BICFI
  const f57_present = mt_f57a.length > 0;
  const cdtr_agt_present = mx_cdtr_agt.length > 0;
  mapping_results.push({ mt_field: ':57A AccountWithInstitution', mx_field: 'CdtrAgt/BICFI', mt_present: f57_present, mx_present: cdtr_agt_present, note: ':57A BIC carries directly to CdtrAgt/BICFI. Direct 1-to-1 mapping.' });
  if (f57_present && !cdtr_agt_present) {
    issues.push({ code: 'CDTR_AGT_MISSING', severity: 'WARNING', field: 'mx_cdtr_agt', message: ':57A present but CdtrAgt/BICFI absent in pacs.008.' });
  }

  // :70: -> RmtInf/Ustrd truncation risk (4 x 35 = 140 chars MT; 140 chars pacs.008 Ustrd)
  const f70_present = mt_f70.length > 0;
  const rmt_present = mx_rmt_ustrd.length > 0;
  mapping_results.push({ mt_field: ':70: RemittanceInfo', mx_field: 'RmtInf/Ustrd', mt_present: f70_present, mx_present: rmt_present, note: ':70: allows 4 lines x 35 chars = 140 chars. RmtInf/Ustrd max 140 chars. Near-identical capacity but line concatenation must not lose data.' });
  if (f70_present && mx_rmt_ustrd.length > MX_MAX_LENGTHS.ustrd) {
    truncation_risks.push({ field: 'RmtInf/Ustrd', severity: 'ERROR', message: 'RmtInf/Ustrd exceeds ' + MX_MAX_LENGTHS.ustrd + ' chars (' + mx_rmt_ustrd.length + '). MT :70: 4-line content must fit within 140 chars.' });
    issues.push({ code: 'REMITTANCE_INFO_TRUNCATION', severity: 'ERROR', field: 'RmtInf/Ustrd', message: 'Remittance info ' + mx_rmt_ustrd.length + ' chars; pacs.008 RmtInf/Ustrd max is 140 chars. Truncation will lose data.' });
  }

  // :71A -> ChrgBr mapping
  const f71_present = mt_f71a.length > 0;
  const chrg_br_present = mx_chrg_br.length > 0;
  const expected_chrg_br = f71_present ? (CHARGE_BEARER_MAP[mt_f71a] || null) : null;
  const chrg_br_correct = expected_chrg_br !== null && mx_chrg_br === expected_chrg_br;
  mapping_results.push({ mt_field: ':71A DetailsOfCharges', mx_field: 'ChrgBr', mt_present: f71_present, mx_present: chrg_br_present, note: 'OUR->DEBT, SHA->SHAR, BEN->CRED. Direct table mapping.' });
  if (f71_present && expected_chrg_br === null) {
    issues.push({ code: 'CHARGE_BEARER_MT_UNKNOWN', severity: 'WARNING', field: 'mx_chrg_br', message: 'MT :71A value "' + mt_f71a + '" not in known mapping table (OUR/SHA/BEN). Verify correct pacs.008 ChrgBr value.' });
  } else if (f71_present && chrg_br_present && !chrg_br_correct) {
    issues.push({ code: 'CHARGE_BEARER_MISMATCH', severity: 'ERROR', field: 'mx_chrg_br', message: 'MT :71A "' + mt_f71a + '" should map to ChrgBr "' + expected_chrg_br + '" but found "' + mx_chrg_br + '".' });
  }

  // Scoring
  const scored_fields = mapping_results.filter(function(r) { return r.mt_present; });
  const correctly_mapped = scored_fields.filter(function(r) { return r.mx_present; }).length;
  const fidelity_score = scored_fields.length > 0 ? Math.round((correctly_mapped / scored_fields.length) * 100) : 0;
  const fidelity_tier = fidelity_score >= 90 ? 'HIGH' : fidelity_score >= 70 ? 'MEDIUM' : 'LOW';

  const error_count = issues.filter(function(i) { return i.severity === 'ERROR'; }).length;
  const compliant = error_count === 0 && truncation_risks.filter(function(r) { return r.severity === 'ERROR'; }).length === 0;

  const output_payload = {
    fidelity_score,
    fidelity_tier,
    compliant,
    error_count,
    mapping_results,
    truncation_risks,
    issues,
    charge_bearer_map: CHARGE_BEARER_MAP,
    cbpr_plus_deadline: '2026-11-14',
    pii_note: 'MT and pacs.008 field values are processed structurally (presence, length, code mapping). No real party PII processed. Use synthetic message fields for testing.',
    table_version: TABLE_VERSION,
    table_source: TABLE_SOURCE,
    regulatory_basis: 'SWIFT CBPR+ mandatory migration deadline 14 Nov 2026; SWIFT MT103 Standards Release Guide; ISO 20022 pacs.008.001.10',
  };

  const compliance_flags = [];
  if (!compliant) compliance_flags.push('MT_MX_TRANSLATION_NON_COMPLIANT');
  if (fidelity_tier === 'LOW') compliance_flags.push('LOW_TRANSLATION_FIDELITY');
  if (truncation_risks.some(function(r) { return r.severity === 'ERROR'; })) compliance_flags.push('TRUNCATION_DATA_LOSS_RISK');

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
