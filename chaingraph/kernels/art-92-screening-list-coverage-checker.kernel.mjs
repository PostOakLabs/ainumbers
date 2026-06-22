/**
 * art-92-screening-list-coverage-checker.kernel.mjs
 * Wave 19 — Screening List-Coverage Conformance Checker.
 * Validates a screening config against the required-coverage matrix for
 * OFAC SDN, EU consolidated, UN consolidated, and UK Sanctions List
 * (post-OFSI-closure 28 Jan 2026) with correct jurisdictional-nexus gating.
 *
 * Citations (verify before citing):
 *   OFAC SDN & Non-SDN lists — office.ofac.treas.gov (verify current).
 *   EU Consolidated Sanctions List — sanctionsmap.eu (verify current).
 *   UN Consolidated List — un.org/securitycouncil/sanctions/consolidated (verify current).
 *   UK Sanctions List — gov.uk/government/collections/financial-sanctions-uk (sole authority since 28 Jan 2026).
 *   OFSI Consolidated List closed 28 Jan 2026 — UK Sanctions List is now sole UK authority.
 *   Wolfsberg Sanctions Screening Guidance (2019) — threshold / refresh benchmarks.
 *   EDUCATIONAL: outputs are decision-support drafts.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-92-screening-list-coverage-checker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'check_screening_list_coverage',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

// UK Sanctions List became sole UK authority on this date (verify current)
const OFSI_CLOSURE_DATE = '2026-01-28';

// Coverage matrix: required lists per nexus combination
const REQUIRED_COVERAGE = {
  us:  ['ofac_sdn'],
  eu:  ['eu_consolidated', 'un_consolidated'],
  uk:  ['uk_sanctions_list'],
  all: ['ofac_sdn', 'eu_consolidated', 'un_consolidated', 'uk_sanctions_list'],
};

// Acceptable refresh frequencies in descending order
const REFRESH_RANK = { real_time: 4, daily: 3, weekly: 2, monthly: 1, ad_hoc: 0 };
const MIN_REFRESH_RANK = REFRESH_RANK['daily']; // Wolfsberg guidance benchmark

function gradeFromPct(pct) {
  if (pct >= 95) return 'A';
  if (pct >= 80) return 'B';
  if (pct >= 65) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
}

export function compute(pp) {
  const {
    config = {},
  } = pp;

  const {
    lists_screened   = [],          // string[] of list identifiers
    us_nexus_gating  = false,       // bool — has US nexus
    eu_nexus_gating  = false,       // bool — has EU nexus
    uk_nexus_gating  = false,       // bool — has UK nexus
    refresh_frequency = 'weekly',   // real_time | daily | weekly | monthly | ad_hoc
    sectoral_lists   = [],          // any sectoral/secondary lists screened
  } = config;

  // Determine applicable nexus set
  const nexuses = [];
  if (us_nexus_gating) nexuses.push('us');
  if (eu_nexus_gating) nexuses.push('eu');
  if (uk_nexus_gating) nexuses.push('uk');

  // Collect required lists for this nexus combination
  const required_set = new Set();
  if (nexuses.length === 0) {
    // No nexus declared — treat as all required (worst case)
    REQUIRED_COVERAGE.all.forEach(l => required_set.add(l));
  } else {
    nexuses.forEach(nx => (REQUIRED_COVERAGE[nx] || []).forEach(l => required_set.add(l)));
  }
  const required = Array.from(required_set);

  // Check coverage
  const missing_lists = required.filter(l => !lists_screened.includes(l));
  const covered_count = required.length - missing_lists.length;
  const coverage_pct  = required.length > 0 ? Math.round((covered_count / required.length) * 100) : 100;

  // Nexus gating accuracy
  const nexus_gaps = [];
  if (us_nexus_gating && !lists_screened.includes('ofac_sdn'))
    nexus_gaps.push('US nexus declared but OFAC SDN not screened');
  if (eu_nexus_gating && !lists_screened.includes('eu_consolidated'))
    nexus_gaps.push('EU nexus declared but EU Consolidated List not screened');
  if (eu_nexus_gating && !lists_screened.includes('un_consolidated'))
    nexus_gaps.push('EU nexus declared but UN Consolidated List not screened');
  if (uk_nexus_gating && !lists_screened.includes('uk_sanctions_list'))
    nexus_gaps.push('UK nexus declared but UK Sanctions List not screened (note: OFSI Consolidated List closed ' + OFSI_CLOSURE_DATE + ')');
  if (lists_screened.includes('ofsi_consolidated'))
    nexus_gaps.push('OFSI Consolidated List is no longer the sole UK authority (closed ' + OFSI_CLOSURE_DATE + ') — migrate to UK Sanctions List');

  // Refresh adequacy
  const refresh_rank  = REFRESH_RANK[refresh_frequency] ?? 0;
  const refresh_adequate = refresh_rank >= MIN_REFRESH_RANK;

  // Overall coverage grade (penalise for nexus gaps and stale refresh)
  let effective_pct = coverage_pct;
  if (nexus_gaps.length > 0)    effective_pct = Math.max(0, effective_pct - 15 * nexus_gaps.length);
  if (!refresh_adequate)        effective_pct = Math.max(0, effective_pct - 10);
  effective_pct = Math.min(100, effective_pct);

  const coverage_grade = gradeFromPct(effective_pct);

  // Flags
  const compliance_flags = [];
  if (missing_lists.length > 0)
    compliance_flags.push('LIST_COVERAGE_GAP');
  if (nexus_gaps.length > 0)
    compliance_flags.push('NEXUS_GATING_INCORRECT');
  if (!refresh_adequate)
    compliance_flags.push('STALE_LIST_REFRESH');

  const output_payload = {
    coverage_grade,
    coverage_pct: effective_pct,
    required_lists: required,
    missing_lists,
    nexus_gaps,
    refresh_adequate,
    refresh_frequency_assessed: refresh_frequency,
    sectoral_lists_screened: sectoral_lists,
    ofsi_migration_note: 'UK Sanctions List is the sole UK authority since ' + OFSI_CLOSURE_DATE + '. Remove OFSI Consolidated List from screening configs.',
    reference_version: '2026-06',
    note: 'DECISION-SUPPORT DRAFT. Verify OFAC/EU/UN/UK list identifiers and refresh requirements against current official guidance. OFSI Consolidated List closed 28 Jan 2026.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    compute_mode:       'server',
    mandate_type:       meta.mandate_type,
    tool_id:            TOOL_ID,
    tool_version:       TOOL_VERSION,
    generated_at:       now ?? null,
    execution_hash:     hash,
    chain:              { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:  pp,
    output_payload,
    compliance_flags,
    audit_signature:    { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
