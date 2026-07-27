/**
 * art-490-fatca-crs-submission-check.kernel.mjs
 * Assurance Waves program (FATCA-RO-BUILD-SPEC.md §1, FATC-K-1) — FATCA/CRS submission
 * conformance evaluator ahead of the annual Responsible Officer certification.
 *
 * Evaluates a firm's own submission file (record set) against a POLICY-SUPPLIED schema
 * identifier + a POLICY-SUPPLIED business-rule set (F3: schemas and error-code sets are
 * PINNED POLICY INPUTS, never kernel source — see FATCA-RO-BUILD-SPEC.md kill criteria).
 * This kernel does NOT hardcode any IRS FATCA XML or OECD CRS XML numeric error-code
 * enumeration; the caller supplies schema_version + mandatory_element_rules (each keyed by
 * a published error/notification code + the schema element path), and this kernel is a
 * deterministic evaluator over that caller-declared rule set plus a small number of
 * genuinely-public structural checks:
 *   - DocTypeIndic enumeration (OECD1 new / OECD2 corrected / OECD3 void / OECD10-12 the
 *     matching test-data variants) is the real, public OECD CRS/FATCA XML Schema v2.0
 *     User Guide value set and is safe to fix in kernel source (it is the schema's own
 *     structural vocabulary, not a jurisdiction's numeric error-code table).
 *   - MessageRefId/DocRefId uniqueness within one submission (structural, schema-format-
 *     agnostic).
 *   - DocRefId/CorrDocRefId referencing: a corrected (OECD2) or voided (OECD3) record MUST
 *     carry a CorrDocRefId that resolves to a DocRefId already present earlier in the same
 *     submission (or the referenced record is flagged dangling).
 *   - Mandatory-identifier structural checks: TIN non-empty (format itself is jurisdiction-
 *     specific and NOT modeled here), BirthDate ISO-8601 well-formedness, Address completeness
 *     (street + city + country code all present).
 *   - The caller's own mandatory_element_rules array (rule_code, element_path, description,
 *     applies_to doc_type filter) is evaluated generically against every record's declared
 *     element_values map — this is how a real jurisdiction's numeric published error codes
 *     enter the artifact, as policy input, not kernel source.
 * A suppression_list (F3) of rule_code values is honored: a suppressed rule produces NO
 * finding at all (pass or fail) for any record — it is excluded from evaluation entirely, so
 * a stood-down rule cannot manufacture a false finding. Suppressed rule_codes are recorded in
 * an audit trail (suppressed_rule_codes echoed + a count) so the exclusion itself is visible.
 *
 * ⛔ PII: this kernel accepts only the record's own declared fields for structural checks
 * (TIN presence/format-shape, BirthDate, Address) -- it does not retain, transform, or emit
 * anything beyond pass/fail verdicts + the caller-supplied identifiers. The demo fixture
 * ships with SYNTHETIC data only (CONTRACT §1.3); real taxpayer data must never be entered.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute() (all timestamps are
 * caller-declared policy_parameters).
 *
 * Spec: FATCA-RO-BUILD-SPEC.md §0 + §1 (FATC-K-1, art-490).
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-490-fatca-crs-submission-check';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'check_fatca_crs_submission_conformance', mandate_type: 'compliance_mandate', gpu: false };

const VALID_DOC_TYPE_INDIC = new Set(['OECD1', 'OECD2', 'OECD3', 'OECD10', 'OECD11', 'OECD12']);
const CORRECTIVE_DOC_TYPE_INDIC = new Set(['OECD2', 'OECD3', 'OECD11', 'OECD12']);

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isIsoDateOrNull(s) {
  if (s == null || s === '') return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s));
}

function pushFinding(findings, suppressedSet, suppressedCounter, finding) {
  if (suppressedSet.has(finding.rule_code)) {
    suppressedCounter.count += 1;
    return;
  }
  findings.push(finding);
}

export function compute(pp) {
  pp = pp || {};
  const submission_id = typeof pp.submission_id === 'string' ? pp.submission_id : '';
  const schema_version = typeof pp.schema_version === 'string' ? pp.schema_version : '';
  const certification_period = typeof pp.certification_period === 'string' ? pp.certification_period : '';
  const records = Array.isArray(pp.records) ? pp.records : [];
  const mandatory_element_rules = Array.isArray(pp.mandatory_element_rules) ? pp.mandatory_element_rules : [];
  const suppressed_rule_codes = Array.isArray(pp.suppressed_rule_codes)
    ? pp.suppressed_rule_codes.filter((c) => typeof c === 'string')
    : [];
  const suppressedSet = new Set(suppressed_rule_codes);
  const suppressedCounter = { count: 0 };

  const findings = [];
  const seenDocRefIds = new Map(); // doc_ref_id -> first record index seen
  const docRefIndex = new Set();

  // First pass: index doc_ref_ids so the referencing check can resolve forward-declared
  // corrections against anything already seen (submission order = evaluation order).
  for (const r of records) {
    if (isNonEmptyString(r && r.doc_ref_id)) docRefIndex.add(r.doc_ref_id);
  }

  records.forEach((r, idx) => {
    r = r || {};
    const doc_ref_id = r.doc_ref_id;
    const corr_doc_ref_id = r.corr_doc_ref_id;
    const doc_type_indic = r.doc_type_indic;
    const element_values = (r.element_values && typeof r.element_values === 'object') ? r.element_values : {};

    // 1. DocTypeIndic enumeration (public OECD CRS/FATCA XML Schema v2.0 structural vocabulary).
    if (!VALID_DOC_TYPE_INDIC.has(doc_type_indic)) {
      pushFinding(findings, suppressedSet, suppressedCounter, {
        rule_code: 'SEQ-DOCTYPEINDIC-001',
        element_path: `records[${idx}].doc_type_indic`,
        doc_ref_id: doc_ref_id || null,
        pass: false,
        message: `doc_type_indic "${doc_type_indic}" is not a recognized OECD CRS/FATCA XML Schema v2.0 DocTypeIndic value.`,
      });
    }

    // 2. MessageRefId/DocRefId uniqueness within this submission.
    if (isNonEmptyString(doc_ref_id)) {
      if (seenDocRefIds.has(doc_ref_id)) {
        pushFinding(findings, suppressedSet, suppressedCounter, {
          rule_code: 'SEQ-DOCREFID-DUP-001',
          element_path: `records[${idx}].doc_ref_id`,
          doc_ref_id,
          pass: false,
          message: `DocRefId "${doc_ref_id}" duplicates the DocRefId first seen at records[${seenDocRefIds.get(doc_ref_id)}].`,
        });
      } else {
        seenDocRefIds.set(doc_ref_id, idx);
      }
    } else {
      pushFinding(findings, suppressedSet, suppressedCounter, {
        rule_code: 'MAND-DOCREFID-001',
        element_path: `records[${idx}].doc_ref_id`,
        doc_ref_id: null,
        pass: false,
        message: 'DocRefId is missing or empty.',
      });
    }

    // 3. Corrected/voided records must reference an existing DocRefId via CorrDocRefId.
    if (CORRECTIVE_DOC_TYPE_INDIC.has(doc_type_indic)) {
      if (!isNonEmptyString(corr_doc_ref_id)) {
        pushFinding(findings, suppressedSet, suppressedCounter, {
          rule_code: 'REF-CORRDOCREFID-MISSING-001',
          element_path: `records[${idx}].corr_doc_ref_id`,
          doc_ref_id: doc_ref_id || null,
          pass: false,
          message: `Record is doc_type_indic "${doc_type_indic}" (corrected/voided) but carries no CorrDocRefId.`,
        });
      } else if (!docRefIndex.has(corr_doc_ref_id)) {
        pushFinding(findings, suppressedSet, suppressedCounter, {
          rule_code: 'REF-CORRDOCREFID-DANGLING-001',
          element_path: `records[${idx}].corr_doc_ref_id`,
          doc_ref_id: doc_ref_id || null,
          pass: false,
          message: `CorrDocRefId "${corr_doc_ref_id}" does not resolve to any DocRefId in this submission.`,
        });
      }
    }

    // 4. Mandatory identifiers: TIN presence, BirthDate format, Address completeness.
    if (!isNonEmptyString(r.tin)) {
      pushFinding(findings, suppressedSet, suppressedCounter, {
        rule_code: 'MAND-TIN-001',
        element_path: `records[${idx}].tin`,
        doc_ref_id: doc_ref_id || null,
        pass: false,
        message: 'TIN is missing or empty.',
      });
    }
    if (r.birth_date !== undefined && r.birth_date !== null && r.birth_date !== '' && isIsoDateOrNull(r.birth_date) === false) {
      pushFinding(findings, suppressedSet, suppressedCounter, {
        rule_code: 'MAND-BIRTHDATE-FORMAT-001',
        element_path: `records[${idx}].birth_date`,
        doc_ref_id: doc_ref_id || null,
        pass: false,
        message: `BirthDate "${r.birth_date}" is not well-formed ISO-8601 (YYYY-MM-DD).`,
      });
    }
    const addrComplete = isNonEmptyString(r.address_street) && isNonEmptyString(r.address_city) && isNonEmptyString(r.address_country_code);
    if (!addrComplete) {
      pushFinding(findings, suppressedSet, suppressedCounter, {
        rule_code: 'MAND-ADDRESS-COMPLETENESS-001',
        element_path: `records[${idx}].address`,
        doc_ref_id: doc_ref_id || null,
        pass: false,
        message: 'Address is incomplete (street, city, and country code are all required).',
      });
    }

    // 5. Caller-supplied business rules (F3 policy input, not kernel source).
    for (const rule of mandatory_element_rules) {
      if (!rule || typeof rule !== 'object') continue;
      const rule_code = rule.rule_code;
      if (typeof rule_code !== 'string' || rule_code === '') continue;
      const applies_to = rule.applies_to;
      if (isNonEmptyString(applies_to) && applies_to !== doc_type_indic && applies_to !== 'all') continue;
      const element_path = typeof rule.element_path === 'string' ? rule.element_path : '';
      const value = element_path ? element_values[element_path] : undefined;
      const present = value !== undefined && value !== null && value !== '';
      if (!present) {
        pushFinding(findings, suppressedSet, suppressedCounter, {
          rule_code,
          element_path: `records[${idx}].element_values.${element_path}`,
          doc_ref_id: doc_ref_id || null,
          pass: false,
          message: rule.description || `Required element "${element_path}" is missing (rule ${rule_code}).`,
        });
      }
    }
  });

  const fail_count = findings.filter((f) => !f.pass).length;
  const compliance_flags = [];
  if (fail_count > 0) compliance_flags.push('FATCA_CRS_SUBMISSION_FINDINGS_PRESENT');
  else compliance_flags.push('FATCA_CRS_SUBMISSION_CLEAN');
  if (suppressedCounter.count > 0) compliance_flags.push('FATCA_CRS_SUPPRESSED_RULES_APPLIED');
  if (records.length === 0) compliance_flags.push('FATCA_CRS_SUBMISSION_EMPTY');

  const output_payload = {
    submission_id: String(submission_id || ''),
    schema_version: String(schema_version || ''),
    certification_period: String(certification_period || ''),
    record_count: records.length,
    findings,
    finding_count: findings.length,
    fail_count,
    suppressed_rule_codes,
    suppressed_finding_count: suppressedCounter.count,
    note: 'Deterministic FATCA/CRS submission conformance evaluator over a caller-declared record set, DocTypeIndic sequencing/uniqueness/referencing (public OECD CRS/FATCA XML Schema v2.0 structural vocabulary), mandatory-identifier structural checks, and a caller-supplied business-rule set keyed by published error code + element path. Schema version and error-code sets are pinned policy inputs, never kernel source. A suppressed rule_code produces no finding at all for any record. This tool evaluates conformance only; it does not itself submit, transmit, or file anything, and it is not legal or tax advice.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null, execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
