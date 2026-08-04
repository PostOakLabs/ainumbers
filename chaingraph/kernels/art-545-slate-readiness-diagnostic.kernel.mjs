import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-545-slate-readiness-diagnostic';
const TOOL_VERSION = '1.0.0';
const OBLIGATION_CHECKLIST_VERSION = 'finra-rule-6540-obligation-checklist-2026.1';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'run_slate_reporting_fit',
  mandate_type: 'compliance_mandate', gpu: false,
  export_capability: ['json', 'pdf', 'vc'],
};

// Readiness diagnostic scoring a caller's declared reporting pipeline against the FINRA
// Rule 6540 obligation checklist (SEC 10c-1a implementation, SLATE reporting). Honestly
// scoped in the art-397 pattern: a declared-state checklist grade, not a conformance
// engine, and not a substitute for art-544's field-level structural validation of an
// actual report record. Validate-never-transmit: never calls fetch, never calls an RNSA,
// never simulates submission -- readiness is not submission.
//
// Compliance-date context (verify against a then-current SEC.gov release before treating
// as load-bearing): the SEC's 2025-12-03 exemptive order, issued after the Fifth Circuit's
// 2025-08-25 remand-without-vacatur in NAPFM v. SEC, sets the Rule 10c-1a reporting
// compliance date at 2028-09-28.
//
// Pure ECMA-262 arithmetic only -- no Date.now/argless new Date(), no Math.random. Finite
// gate: every check resolves to a boolean/array, never throws or yields NaN.

export function compute(pp) {
  pp = pp || {};
  const dims = {
    reporting_agent_registered: pp.reporting_agent_registered === true,
    same_day_capture_configured: pp.same_day_capture_configured === true,
    field_spec_mapping_complete: pp.field_spec_mapping_complete === true,
    unique_loan_identifier_scheme: pp.unique_loan_identifier_scheme === true,
    recordkeeping_retention_configured: pp.recordkeeping_retention_configured === true,
  };
  const gaps = Object.entries(dims).filter(([, v]) => v !== true).map(([k]) => k);
  const passed = 5 - gaps.length;
  const grade = ['F', 'E', 'D', 'C', 'B', 'A'][passed];
  const ready = gaps.length === 0;

  const compliance_flags = [];
  compliance_flags.push('SLATE_REPORTING_FIT_ASSESSED');
  compliance_flags.push(ready ? 'SLATE_REPORTING_READY' : 'SLATE_REPORTING_GAPS');

  const output_payload = {
    ready, grade, dimensions_passed: passed, gaps,
    obligation_checklist_version: OBLIGATION_CHECKLIST_VERSION,
    regulatory_basis: 'FINRA Rule 6540 (Securities Lending and Transparency Engine reporting, implementing SEC Rule 10c-1a) obligation checklist.',
    scope_note: 'Declared-state readiness diagnostic only -- scores a caller-declared reporting pipeline against the Rule 6540 obligation checklist. This is explicitly NOT a full SLATE conformance engine and does not replace art-544-slate-report-validator field-level structural validation of an actual report record. Validate-never-transmit: this tool never calls fetch, never calls an RNSA, and never simulates submission -- readiness is not submission.',
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
