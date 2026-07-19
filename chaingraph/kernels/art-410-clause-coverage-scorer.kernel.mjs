import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-410-clause-coverage-scorer';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'score_clause_coverage',
  mandate_type: 'compliance_mandate', gpu: false,
};

const KNOWN_TAXONOMIES = {
  onesaas_52: 'oneSaaS 52-clause canonical set',
  common_paper_language_library: 'Common Paper Language Library',
  art28_set: 'GDPR Article 28(3) processor-clause set',
};

// Generalizes the P1 agreement-template linter into a scored coverage report
// against a named clause taxonomy (oneSaaS 52-clause set, Common Paper
// Language Library, GDPR Art-28 set). Reads caller-declared per-clause
// status (present/modified/extra/missing) against a caller-supplied clause
// list -- reads input only, never assembles or redistributes any
// third-party template body (BUILD-SPEC.md §1.1 item 4). Not legal advice.
export function compute(pp) {
  pp = pp || {};
  const taxonomy = typeof pp.taxonomy === 'string' && pp.taxonomy ? pp.taxonomy : 'custom';
  const taxonomy_label = KNOWN_TAXONOMIES[taxonomy] || 'Custom clause set';
  const clauses_raw = Array.isArray(pp.clauses) ? pp.clauses : [];

  const clauses = clauses_raw
    .filter((c) => c && typeof c.id === 'string' && c.id.length > 0)
    .map((c) => {
      const status = c.status === 'present' || c.status === 'modified' || c.status === 'extra' ? c.status : 'missing';
      return { id: c.id, status };
    });

  const declared_count = clauses.filter((c) => c.status !== 'extra').length;
  const present_count = clauses.filter((c) => c.status === 'present').length;
  const modified_count = clauses.filter((c) => c.status === 'modified').length;
  const extra_count = clauses.filter((c) => c.status === 'extra').length;
  const missing_count = clauses.filter((c) => c.status === 'missing').length;

  const coverage_pct = declared_count > 0 ? Math.round((present_count / declared_count) * 10000) / 100 : 0;
  const modification_pct = declared_count > 0 ? Math.round((modified_count / declared_count) * 10000) / 100 : 0;

  const missing_clause_ids = clauses.filter((c) => c.status === 'missing').map((c) => c.id);
  const modified_clause_ids = clauses.filter((c) => c.status === 'modified').map((c) => c.id);
  const extra_clause_ids = clauses.filter((c) => c.status === 'extra').map((c) => c.id);

  let maturity_tier;
  if (declared_count === 0) maturity_tier = 'unrated';
  else if (coverage_pct === 100) maturity_tier = 'full';
  else if (coverage_pct >= 80) maturity_tier = 'substantial';
  else if (coverage_pct >= 50) maturity_tier = 'partial';
  else maturity_tier = 'minimal';

  const compliance_flags = ['CLAUSE_COVERAGE_SCORED'];
  compliance_flags.push('COVERAGE_TIER_' + maturity_tier.toUpperCase());
  if (missing_count > 0) compliance_flags.push('CLAUSE_GAPS_FOUND');
  if (extra_count > 0) compliance_flags.push('EXTRA_CLAUSES_PRESENT');

  const output_payload = {
    taxonomy,
    taxonomy_label,
    coverage_pct,
    modification_pct,
    maturity_tier,
    declared_count,
    present_count,
    modified_count,
    extra_count,
    missing_count,
    missing_clause_ids,
    modified_clause_ids,
    extra_clause_ids,
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
