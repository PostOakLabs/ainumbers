import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-400-check-official-statement-completeness';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_official_statement_completeness',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Checks a municipal-bond Official Statement (OS) disclosure-element checklist
// (element present / absent / incomplete) and continuing-disclosure undertaking
// presence, per MSRB Rule G-32 (primary market disclosure via EMMA) and SEC Rule
// 15c2-12 (continuing disclosure undertaking + material-event categories).
// Same present/absent checklist shape as the shipped GENIUS Sec 4 / MiCA-whitepaper
// linter (art-06, art-102).
// table_version: "MSRB-G32-15C2-12-OS-CHECKLIST-V1"

const TABLE_VERSION = 'MSRB-G32-15C2-12-OS-CHECKLIST-V1';
const TABLE_SOURCE = 'MSRB Rule G-32 (Disclosures in Connection with Primary Offerings, EMMA submission); SEC Rule 15c2-12 (17 CFR 240.15c2-12), including the (b)(5)(i)(C) material-event list.';

const REQUIRED_ELEMENTS = [
  'cover-page',
  'summary-statement',
  'description-of-securities',
  'use-of-proceeds',
  'sources-and-uses-of-funds',
  'description-of-issuer',
  'financial-statements',
  'tax-matters-legal-opinion',
  'risk-factors',
  'litigation-disclosure',
  'underwriting',
  'continuing-disclosure-undertaking',
];

// SEC Rule 15c2-12(b)(5)(i)(C) material-event categories (public statute text).
const MATERIAL_EVENT_CATEGORIES = [
  'principal-and-interest-payment-delinquencies',
  'non-payment-related-defaults',
  'unscheduled-draws-on-debt-service-reserves',
  'unscheduled-draws-on-credit-enhancements',
  'substitution-of-credit-or-liquidity-providers',
  'adverse-tax-opinions-or-irs-events',
  'modifications-to-rights-of-security-holders',
  'bond-calls',
  'defeasances',
  'release-substitution-or-sale-of-property-securing-repayment',
  'rating-changes',
  'bankruptcy-insolvency-receivership',
  'merger-consolidation-or-sale-of-substantially-all-assets',
  'appointment-of-successor-trustee',
  'incurrence-of-financial-obligation-or-agreement-to-covenants',
];

function statusOf(map, key) { return map[key] || 'absent'; }

export function compute(pp) {
  pp = pp || {};
  const { inputs = {} } = pp;
  const {
    os_elements = [],
    material_event_categories_covered = [],
    continuing_disclosure_undertaking_present = false,
  } = inputs;

  const elementMap = {};
  for (const entry of os_elements) {
    if (entry && entry.element) elementMap[entry.element] = entry.status;
  }

  const element_status = {};
  const gaps = [];
  for (const el of REQUIRED_ELEMENTS) {
    const status = statusOf(elementMap, el);
    element_status[el] = status;
    if (status !== 'complete') gaps.push(el);
  }

  const coveredSet = new Set(material_event_categories_covered);
  const material_event_gaps = MATERIAL_EVENT_CATEGORIES.filter((c) => !coveredSet.has(c));

  const elements_checked = REQUIRED_ELEMENTS.length;
  const gap_count = gaps.length;
  const cdu_gap = !continuing_disclosure_undertaking_present || elementMap['continuing-disclosure-undertaking'] !== 'complete';

  let completeness_grade;
  if (gap_count === 0 && material_event_gaps.length === 0) completeness_grade = 'A';
  else if (gap_count === 0 && material_event_gaps.length <= 3) completeness_grade = 'B';
  else if (gap_count >= 1 && gap_count <= 2) completeness_grade = 'C';
  else if (gap_count >= 3 && gap_count <= 5) completeness_grade = 'D';
  else completeness_grade = 'F';

  const compliant = gap_count === 0 && !cdu_gap;

  const output_payload = {
    compliant,
    completeness_grade,
    elements_checked,
    gap_count,
    gaps,
    element_status,
    continuing_disclosure_undertaking_present: !!continuing_disclosure_undertaking_present && elementMap['continuing-disclosure-undertaking'] === 'complete',
    material_event_categories_checked: MATERIAL_EVENT_CATEGORIES.length,
    material_event_gaps,
    disambiguation: 'check_official_statement_completeness checks that MSRB G-32 / SEC 15c2-12 disclosure ELEMENTS are declared present and well-formed -- it does not verify the truth of any disclosed fact (see the asserted-labelling note).',
    asserted_note: '"asserted" labelling applies throughout: this checks that declared OS elements and material-event categories are PRESENT and well-formed, not that the underlying disclosures are true or complete in substance.',
    table_version: TABLE_VERSION,
    table_source: TABLE_SOURCE,
    regulatory_basis: 'MSRB Rule G-32; SEC Rule 15c2-12 (17 CFR 240.15c2-12), including the (b)(5)(i)(C) material-event list.',
  };

  const compliance_flags = [];
  if (gap_count > 0) compliance_flags.push('OS_ELEMENTS_INCOMPLETE');
  if (cdu_gap) compliance_flags.push('CONTINUING_DISCLOSURE_UNDERTAKING_GAP');
  if (material_event_gaps.length > 0) compliance_flags.push('MATERIAL_EVENT_CATEGORIES_UNCOVERED');

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
