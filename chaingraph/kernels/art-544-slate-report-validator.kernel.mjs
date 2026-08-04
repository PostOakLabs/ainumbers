import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-544-slate-report-validator';
const TOOL_VERSION = '1.0.0';
const FIELD_SPEC_VERSION = 'finra-rule-6540-6500-series-field-spec-2026.1';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_slate_report_fields',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Field-level structural validator for a covered-securities-loan report record against
// the FINRA Rule 6500-series field spec (loan terms, rate, collateral type, counterparty)
// that FINRA Rule 6540 (SEC 10c-1a implementation, SLATE reporting) requires. Honestly
// scoped in the art-397 pattern: this schema-validates structurally -- required fields,
// enum membership, numeric/date parseability -- and is explicitly NOT a full SLATE
// conformance engine. It does not check cross-record consistency, does not check
// regulatory timeliness, and never transmits, calls an RNSA, or simulates submission.
//
// Compliance-date context (verify against a then-current SEC.gov release before treating
// as load-bearing): the SEC's 2025-12-03 exemptive order, issued after the Fifth Circuit's
// 2025-08-25 remand-without-vacatur in NAPFM v. SEC, sets the Rule 10c-1a reporting
// compliance date at 2028-09-28.
//
// Pure ECMA-262 arithmetic only -- no Date.now/argless new Date(), no Math.random. Dates
// are parsed from caller-supplied ISO-8601 strings via Date.parse, a pure function of its
// input. Finite gate: every check resolves to a boolean/array, never throws or yields NaN.

function str(v) { return typeof v === 'string' ? v : ''; }
function arr(v) { return Array.isArray(v) ? v : []; }

const REQUIRED_FIELDS = [
  'loan_id', 'effective_date', 'rate_type', 'rate', 'collateral_type',
  'counterparty_id', 'security_identifier', 'quantity', 'loan_type',
];
const RATE_TYPES = ['FLAT', 'REBATE'];
const COLLATERAL_TYPES = ['CASH', 'SECURITIES', 'LETTER_OF_CREDIT'];
const LOAN_TYPES = ['NEW', 'MODIFICATION', 'TERMINATION'];

function lintReport(rec, idx) {
  rec = rec || {};
  const missing_fields = REQUIRED_FIELDS.filter((f) => rec[f] === undefined || rec[f] === null || rec[f] === '');
  const type_errors = [];

  if (rec.rate_type !== undefined && !RATE_TYPES.includes(rec.rate_type)) {
    type_errors.push('rate_type must be one of: ' + RATE_TYPES.join(', '));
  }
  if (rec.collateral_type !== undefined && !COLLATERAL_TYPES.includes(rec.collateral_type)) {
    type_errors.push('collateral_type must be one of: ' + COLLATERAL_TYPES.join(', '));
  }
  if (rec.loan_type !== undefined && !LOAN_TYPES.includes(rec.loan_type)) {
    type_errors.push('loan_type must be one of: ' + LOAN_TYPES.join(', '));
  }
  if (rec.rate !== undefined && !Number.isFinite(Number(rec.rate))) {
    type_errors.push('rate must be a finite number');
  }
  if (rec.quantity !== undefined && !(Number.isFinite(Number(rec.quantity)) && Number(rec.quantity) > 0)) {
    type_errors.push('quantity must be a positive number');
  }
  if (rec.collateral_value !== undefined && !(Number.isFinite(Number(rec.collateral_value)) && Number(rec.collateral_value) >= 0)) {
    type_errors.push('collateral_value must be a non-negative number');
  }
  if (rec.effective_date !== undefined && !Number.isFinite(Date.parse(str(rec.effective_date)))) {
    type_errors.push('effective_date must be a parseable ISO-8601 date string');
  }
  if (rec.security_identifier !== undefined) {
    const sid = str(rec.security_identifier);
    if (!(sid.length >= 6 && sid.length <= 12 && /^[A-Za-z0-9]+$/.test(sid))) {
      type_errors.push('security_identifier must be a 6-12 character alphanumeric string (CUSIP/ISIN-shaped)');
    }
  }

  return {
    index: idx,
    structurally_valid: missing_fields.length === 0 && type_errors.length === 0,
    missing_fields, type_errors,
  };
}

export function compute(pp) {
  pp = pp || {};
  const results = arr(pp.reports).map(lintReport);
  const valid_count = results.filter((r) => r.structurally_valid).length;
  const violations = results.filter((r) => !r.structurally_valid);

  const compliance_flags = [];
  if (results.length === 0) compliance_flags.push('NO_REPORTS_SUPPLIED');
  else compliance_flags.push(violations.length === 0 ? 'ALL_REPORTS_STRUCTURALLY_VALID' : 'STRUCTURAL_VIOLATIONS_FOUND');

  const output_payload = {
    reports_checked: results.length,
    reports_valid: valid_count,
    violations,
    field_spec_version: FIELD_SPEC_VERSION,
    regulatory_basis: 'FINRA Rule 6540 (Securities Lending and Transparency Engine reporting, implementing SEC Rule 10c-1a); Rule 6500-series field definitions (loan terms, rate, collateral type, counterparty).',
    scope_note: 'Field-level structural validator only -- schema-validates report records against the FINRA Rule 6500-series field spec. This is explicitly NOT a full SLATE conformance engine: no cross-record consistency check, no regulatory-timeliness check. Validate-never-transmit: this tool never calls fetch, never calls an RNSA, and never simulates submission -- readiness is not submission.',
    compliance_date_note: 'SEC exemptive order (2025-12-03), issued after the Fifth Circuit remand-without-vacatur in NAPFM v. SEC (2025-08-25), sets the Rule 10c-1a reporting compliance date at 2028-09-28 -- verify against a then-current SEC.gov release before treating this date as load-bearing.',
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
