import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-409-dpa-art28-completeness-checker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_dpa_gdpr_art28',
  mandate_type: 'compliance_mandate', gpu: false,
};

const ART28_ELEMENTS = [
  { id: 'subject_matter', label: 'Subject-matter of the processing' },
  { id: 'duration', label: 'Duration of the processing' },
  { id: 'nature_purpose', label: 'Nature and purpose of the processing' },
  { id: 'data_categories', label: 'Type of personal data and categories of data subjects' },
  { id: 'controller_instructions_only', label: 'Processing only on documented controller instructions' },
  { id: 'confidentiality', label: 'Confidentiality commitment for authorised persons' },
  { id: 'article32_security', label: 'Article 32 security measures' },
  { id: 'subprocessor_authorization', label: 'Sub-processor authorization (general or specific) + flow-down obligations' },
  { id: 'data_subject_rights_assistance', label: 'Assistance with data-subject-rights requests' },
  { id: 'breach_dpia_assistance', label: 'Assistance with Article 32-36 breach notification and DPIA' },
  { id: 'deletion_or_return', label: 'Deletion or return of personal data at end of processing' },
  { id: 'audit_rights', label: 'Information availability and audit/inspection rights' },
];

// GDPR Article 28(3) DPA completeness checker. Deterministic 11+1-point
// checklist against the mandatory processor-contract clauses -- reads a
// caller-declared per-element status (present/missing/weak) and returns a
// verdict + coverage stats. This node reads input only: it never assembles,
// vendors, or redistributes any third-party template body, so it carries no
// license exposure (BUILD-SPEC.md §1.1 item 3). Not legal advice -- a
// compliance reading over text the caller supplied.
export function compute(pp) {
  pp = pp || {};
  const clause_status = pp.clause_status && typeof pp.clause_status === 'object' ? pp.clause_status : {};

  const clauses = ART28_ELEMENTS.map((el) => {
    const raw = clause_status[el.id];
    const status = raw === 'present' || raw === 'weak' ? raw : 'missing';
    return { id: el.id, label: el.label, status };
  });

  const present_count = clauses.filter((c) => c.status === 'present').length;
  const weak_count = clauses.filter((c) => c.status === 'weak').length;
  const missing_count = clauses.filter((c) => c.status === 'missing').length;
  const total = clauses.length;
  const coverage_pct = total > 0 ? Math.round((present_count / total) * 10000) / 100 : 0;

  const missing_clause_ids = clauses.filter((c) => c.status === 'missing').map((c) => c.id);
  const weak_clause_ids = clauses.filter((c) => c.status === 'weak').map((c) => c.id);

  const art28_complete = missing_count === 0 && weak_count === 0;
  const verdict = art28_complete ? 'ART28_COMPLETE' : missing_count > 0 ? 'ART28_INCOMPLETE_MISSING_CLAUSES' : 'ART28_INCOMPLETE_WEAK_CLAUSES';

  const compliance_flags = [art28_complete ? 'DPA_ART28_COMPLETE' : 'DPA_ART28_GAPS_FOUND'];
  if (missing_count > 0) compliance_flags.push('DPA_MISSING_MANDATORY_CLAUSE');
  if (weak_count > 0) compliance_flags.push('DPA_WEAK_CLAUSE_LANGUAGE');

  const output_payload = {
    verdict,
    art28_complete,
    coverage_pct,
    present_count,
    weak_count,
    missing_count,
    total_elements: total,
    clauses,
    missing_clause_ids,
    weak_clause_ids,
    not_legal_advice: true,
    disclosure: 'This is a compliance reading over the text the caller supplied, not legal advice and not a determination that any agreement is compliant.',
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
