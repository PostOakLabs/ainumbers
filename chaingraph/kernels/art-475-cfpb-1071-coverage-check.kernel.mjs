import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-475-cfpb-1071-coverage-check';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_cfpb_1071_coverage',
  mandate_type: 'compliance_mandate', gpu: false,
};

// CFPB Section 1071 small business lending rule (Regulation B subpart B, revised final rule
// published 2026-05-01). Two independent deterministic checks:
//  (1) Coverage determination: an institution is a covered financial institution if it originated
//      at least 1,000 covered small-business-lending originations in EACH of the two preceding
//      calendar years (caller supplies both year counts; the 1,000 threshold is fixed by the rule,
//      not a policy input).
//  (2) SBLAR record validation: for each caller-supplied record, checks presence of every field in
//      a caller-supplied required-field list. The required-field schema is a POLICY INPUT, not a
//      hardcoded regulatory field list -- the kernel makes no claim about which fields the current
//      rule requires; it only checks the record against whatever schema the caller supplies.
// Fixed compliance-date reference values (collection start, first SBLAR due) are the two dates
// from the workspace's fact table, reported as-is -- not derived, not caller-editable.
//
// Pure ECMA-262 arithmetic/comparison only -- no Date.now/new Date(), no Math.random. Finite gate:
// no ratio math here, so no NaN/Infinity surface.

const THRESHOLD = 1000;
const COMPLIANCE_DATES = { data_collection_start: '2028-01-01', first_sblar_due: '2029-06-01' };

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function arr(v) { return Array.isArray(v) ? v : []; }
function str(v) { return typeof v === 'string' ? v : ''; }

function isPresent(v) {
  return v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '');
}

function validateRecord(record, requiredFields) {
  const fields = (record && record.fields && typeof record.fields === 'object') ? record.fields : {};
  const missing_fields = requiredFields.filter((f) => !isPresent(fields[f]));
  return {
    record_id: str(record && record.record_id),
    required_fields_count: requiredFields.length,
    present_fields_count: requiredFields.length - missing_fields.length,
    missing_fields,
    valid: missing_fields.length === 0,
  };
}

export function compute(pp) {
  pp = pp || {};

  const originationsYear1 = Math.max(0, Math.trunc(safeNum(pp.originations_year1_count, 0)));
  const originationsYear2 = Math.max(0, Math.trunc(safeNum(pp.originations_year2_count, 0)));
  const covered = originationsYear1 >= THRESHOLD && originationsYear2 >= THRESHOLD;

  const requiredFields = arr(pp.required_sblar_fields).map(str).filter((f) => f.length > 0);
  const records = arr(pp.sblar_records).map((r) => validateRecord(r, requiredFields));
  const valid_records = records.filter((r) => r.valid).length;
  const invalid_records = records.length - valid_records;

  const compliance_flags = [];
  compliance_flags.push(covered ? 'COVERED_INSTITUTION' : 'NOT_COVERED_INSTITUTION');
  if (records.length > 0) {
    compliance_flags.push(invalid_records === 0 ? 'ALL_SBLAR_RECORDS_VALID' : 'SBLAR_RECORDS_INVALID');
  }

  const output_payload = {
    threshold: THRESHOLD,
    originations_year1_count: originationsYear1,
    originations_year2_count: originationsYear2,
    covered,
    compliance_dates: COMPLIANCE_DATES,
    required_sblar_fields: requiredFields,
    sblar_records: records,
    sblar_summary: {
      total_records: records.length,
      valid_records,
      invalid_records,
    },
    regulatory_basis: 'CFPB Section 1071 small business lending rule, Regulation B subpart B, revised final rule published 2026-05-01: covered-institution threshold of 1,000 small-business-lending originations in each of the two preceding calendar years.',
    note: 'Coverage determination compares caller-supplied origination counts to the fixed 1,000-per-year threshold. SBLAR field validation checks presence only, against a caller-supplied required-field schema -- this kernel makes no claim about which fields the current rule requires. Not a filing or submission.',
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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
