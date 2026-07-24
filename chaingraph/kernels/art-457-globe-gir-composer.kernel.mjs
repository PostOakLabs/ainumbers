import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-457-globe-gir-composer';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compose_globe_gir',
  mandate_type: 'compliance_control', gpu: false,
};

// OECD GloBE Information Return (GIR) composer kernel. Takes one row per
// jurisdiction -- each row carrying the trusted outputs of art-454
// (jurisdictional ETR), art-455 (SBIE / top-up), and, when evaluated,
// art-456 (transitional safe harbour verdict) -- and assembles the GIR's
// jurisdictional-summary shape. A jurisdiction whose safe_harbour_met is
// true is composed with top-up forced to zero (deemed_zero_topup), matching
// art-456's own semantics; a jurisdiction with no safe-harbour verdict
// carries its art-454/455 top-up figures through unchanged. This kernel
// assembles and formats only -- it never recomputes ETR, SBIE, or the
// safe-harbour tests, and its exports (OECD GIR XML rendering + a
// form-shaped JSON mirror) are explicitly marked NOT-SUBMITTABLE (national
// filing gateways vary in accepted schema version and transport). The OECD
// GIR schema version is a versioned policy_parameters input, pinned per
// call -- this kernel never chases draft schema revisions. NaN-safe. Zero
// network, zero PII.

function n(v, d) { const x = Number(v); return Number.isFinite(x) ? x : d; }
function s(v, d) { return typeof v === 'string' && v.length ? v : d; }

function composeJurisdictionRow(row) {
  row = row || {};
  const jurisdiction_code = s(row.jurisdiction_code, 'UNSPECIFIED');
  const jurisdictional_etr = n(row.jurisdictional_etr, null);
  const sbie_amount = n(row.sbie_amount, 0);
  const raw_topup_tax = n(row.topup_tax, 0);
  const safe_harbour_met = row.safe_harbour_met === true;
  const has_safe_harbour_result = row.safe_harbour_met === true || row.safe_harbour_met === false;

  const deemed_zero_topup = has_safe_harbour_result && safe_harbour_met;
  const composed_topup_tax = deemed_zero_topup ? 0 : raw_topup_tax;

  const constituent_entities = Array.isArray(row.constituent_entities) ? row.constituent_entities : [];
  const entity_topup_total = constituent_entities.reduce((acc, e) => acc + n(e && e.allocation_share, 0), 0);
  const allocation_ok = constituent_entities.length === 0 || Math.abs(entity_topup_total - 1) < 1e-6;
  const entity_allocations = constituent_entities.map((e) => {
    e = e || {};
    const share = n(e.allocation_share, 0);
    return {
      entity_name: s(e.entity_name, 'UNSPECIFIED'),
      allocation_share: share,
      allocated_topup_tax: composed_topup_tax * share,
    };
  });

  return {
    jurisdiction_code,
    jurisdictional_etr,
    sbie_amount,
    raw_topup_tax,
    deemed_zero_topup,
    composed_topup_tax,
    safe_harbour_status: has_safe_harbour_result ? (safe_harbour_met ? 'met' : 'not_met') : 'not_evaluated',
    constituent_entities: entity_allocations,
    allocation_sum_ok: allocation_ok,
  };
}

export function compute(pp) {
  pp = pp || {};

  const mne_group_name = s(pp.mne_group_name, 'UNSPECIFIED');
  const fiscal_year = Math.round(n(pp.fiscal_year, 2024));
  const gir_schema_version = s(pp.gir_schema_version, 'OECD-GIR-2023-07');
  const jurisdictions = Array.isArray(pp.jurisdictions) ? pp.jurisdictions : [];

  const compliance_flags = [];

  if (jurisdictions.length === 0) compliance_flags.push('NO_JURISDICTIONS_SUPPLIED');

  const jurisdiction_rows = jurisdictions.map(composeJurisdictionRow);

  const any_allocation_mismatch = jurisdiction_rows.some((r) => !r.allocation_sum_ok);
  if (any_allocation_mismatch) compliance_flags.push('CONSTITUENT_ENTITY_ALLOCATION_MISMATCH');

  const total_topup_tax = jurisdiction_rows.reduce((acc, r) => acc + r.composed_topup_tax, 0);
  const jurisdictions_with_deemed_zero = jurisdiction_rows.filter((r) => r.deemed_zero_topup).length;
  const jurisdictions_not_evaluated = jurisdiction_rows.filter((r) => r.safe_harbour_status === 'not_evaluated').length;

  compliance_flags.push('GIR_COMPOSED');
  compliance_flags.push('NOT_SUBMITTABLE_NATIONAL_GATEWAY_VARIES');
  if (jurisdictions_not_evaluated > 0) compliance_flags.push('JURISDICTIONS_MISSING_SAFE_HARBOUR_VERDICT');

  const gir_xml_summary = {
    schema_version: gir_schema_version,
    root_element: 'GIR',
    mne_group_name,
    fiscal_year,
    jurisdiction_count: jurisdiction_rows.length,
  };

  return {
    output_payload: {
      mne_group_name,
      fiscal_year,
      gir_schema_version,
      jurisdiction_rows,
      total_topup_tax,
      jurisdictions_with_deemed_zero,
      jurisdictions_not_evaluated,
      gir_xml_summary,
      submittable: false,
    },
    compliance_flags,
  };
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
