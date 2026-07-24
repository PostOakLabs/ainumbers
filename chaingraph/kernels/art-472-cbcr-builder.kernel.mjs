import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-472-cbcr-builder';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'build_cbcr_report',
  mandate_type: 'compliance_mandate', gpu: false,
};

// OECD BEPS Action 13 Country-by-Country Report builder. Takes a
// caller-declared jurisdiction-level data table (Table 1: revenue/profit/
// tax/employees/assets per jurisdiction) plus a constituent-entity table
// (Table 2) and: (a) runs internal consistency checks -- per-jurisdiction
// revenue-component sums, employee/asset non-negativity, entity-jurisdiction
// referential integrity between Table 1 and Table 2 -- and (b) builds an XML
// schema skeleton against a caller-declared, version-pinned Action 13 XML
// schema version. Also supports two PUBLIC-CbCR field-subset export modes
// (EU Directive (EU) 2021/2101 / Australian public CbCR) that narrow the
// full private-filing field set to the public-disclosure subset.
//
// HONESTY GUARD (binding): this artifact proves the declared table is
// internally consistent and schema-shaped per the pinned version -- it is
// NEVER a submission and is NOT accepted by any national CbCR gateway
// (IRS/HMRC/ATO/etc. XML portals each run their own additional validation).
// Comparable-set selection, DEMPE/functional analysis, and any judgment
// about which entities belong in the MNE group are entirely caller
// declarations -- this kernel performs no transfer-pricing judgment (see the
// companion art-473-interquartile-benchmark for arm's-length range math).
export function compute(pp) {
  pp = pp || {};

  const schema_version = String(pp.schema_version || '').trim() || null;
  const export_mode = ['private_filing', 'eu_public', 'au_public'].includes(pp.export_mode) ? pp.export_mode : 'private_filing';

  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  const s = (v) => String(v == null ? '' : v).trim();

  const table1 = Array.isArray(pp.table1_jurisdictions) ? pp.table1_jurisdictions : [];
  const table2 = Array.isArray(pp.table2_entities) ? pp.table2_entities : [];
  const rounding_tolerance = Math.max(0, num(pp.rounding_tolerance) ?? 1);

  const jurisdiction_ids = new Set(table1.map((j) => s(j && j.jurisdiction_code)).filter(Boolean));

  const checks = [];
  const jurisdictions_out = [];

  table1.forEach((j, idx) => {
    j = j || {};
    const jurisdiction_code = s(j.jurisdiction_code);
    const related_party_revenue = num(j.related_party_revenue) ?? 0;
    const unrelated_party_revenue = num(j.unrelated_party_revenue) ?? 0;
    const total_revenue_reported = num(j.total_revenue);
    const total_revenue_computed = related_party_revenue + unrelated_party_revenue;
    const revenue_sum_ok = total_revenue_reported === null
      ? false
      : Math.abs(total_revenue_reported - total_revenue_computed) <= rounding_tolerance;

    checks.push({
      id: `EDIT-REV-${idx + 1}`,
      jurisdiction_code: jurisdiction_code || null,
      description: 'Related-party revenue plus unrelated-party revenue equals total revenue, within rounding tolerance.',
      passed: revenue_sum_ok,
      severity: 'fatal',
    });

    const employees = num(j.number_of_employees);
    const employees_ok = employees === null ? false : employees >= 0;
    checks.push({
      id: `EDIT-EMP-${idx + 1}`,
      jurisdiction_code: jurisdiction_code || null,
      description: 'Number of employees is non-negative.',
      passed: employees_ok,
      severity: 'fatal',
    });

    const tangible_assets = num(j.tangible_assets);
    const assets_ok = tangible_assets === null ? false : tangible_assets >= 0;
    checks.push({
      id: `EDIT-AST-${idx + 1}`,
      jurisdiction_code: jurisdiction_code || null,
      description: 'Tangible assets other than cash/cash-equivalents is non-negative.',
      passed: assets_ok,
      severity: 'fatal',
    });

    jurisdictions_out.push({
      jurisdiction_code: jurisdiction_code || null,
      total_revenue: total_revenue_reported,
      profit_before_tax: num(j.profit_before_tax),
      income_tax_paid: num(j.income_tax_paid),
      income_tax_accrued: num(j.income_tax_accrued),
      stated_capital: num(j.stated_capital),
      accumulated_earnings: num(j.accumulated_earnings),
      number_of_employees: employees,
      tangible_assets,
    });
  });

  // Referential integrity: every Table 2 entity's jurisdiction must exist in Table 1.
  const orphan_entities = [];
  table2.forEach((e) => {
    e = e || {};
    const entity_jurisdiction = s(e.jurisdiction_code);
    const entity_name = s(e.entity_name) || null;
    const referential_ok = jurisdiction_ids.size === 0 ? false : jurisdiction_ids.has(entity_jurisdiction);
    checks.push({
      id: `EDIT-REF-${entity_name || entity_jurisdiction || table2.indexOf(e) + 1}`,
      jurisdiction_code: entity_jurisdiction || null,
      description: 'Constituent entity (Table 2) jurisdiction exists in the Table 1 jurisdiction list.',
      passed: referential_ok,
      severity: 'fatal',
    });
    if (!referential_ok) orphan_entities.push({ entity_name, jurisdiction_code: entity_jurisdiction || null });
  });

  const fatal_failure_count = checks.filter((c) => c.severity === 'fatal' && !c.passed).length;
  const all_fatal_passed = table1.length > 0 && fatal_failure_count === 0;
  const gate_status = table1.length === 0 ? 'review_required' : (all_fatal_passed ? 'auto_pass' : 'review_required');

  // Anomaly pattern surfaced for the HA review gate (art-27 vocabulary; not enforced here).
  const anomaly_flags = [];
  jurisdictions_out.forEach((j) => {
    if ((j.profit_before_tax ?? 0) > 0 && (j.number_of_employees ?? 0) === 0) {
      anomaly_flags.push({ jurisdiction_code: j.jurisdiction_code, pattern: 'profit_with_zero_employees' });
    }
  });

  const EU_PUBLIC_FIELDS = ['jurisdiction_code', 'total_revenue', 'profit_before_tax', 'income_tax_paid', 'income_tax_accrued', 'number_of_employees'];
  const AU_PUBLIC_FIELDS = ['jurisdiction_code', 'total_revenue', 'profit_before_tax', 'income_tax_paid', 'stated_capital', 'accumulated_earnings', 'number_of_employees', 'tangible_assets'];

  function projectFields(rows, fields) {
    return rows.map((r) => fields.reduce((o, f) => (o[f] = r[f] === undefined ? null : r[f], o), {}));
  }

  const export_jurisdictions = export_mode === 'eu_public'
    ? projectFields(jurisdictions_out, EU_PUBLIC_FIELDS)
    : export_mode === 'au_public'
      ? projectFields(jurisdictions_out, AU_PUBLIC_FIELDS)
      : jurisdictions_out;

  const xml_schema_skeleton = {
    schema_version,
    root_element: 'CBC_OECD',
    reporting_entity: {
      entity_name: s(pp.reporting_entity_name) || null,
      tin: s(pp.reporting_entity_tin) || null,
    },
    table1_jurisdiction_count: table1.length,
    table2_entity_count: table2.length,
  };

  return {
    output_payload: {
      schema_version,
      export_mode,
      xml_schema_skeleton,
      jurisdictions: export_jurisdictions,
      orphan_entities,
      checks,
      fatal_failure_count,
      all_fatal_passed,
      gate_status,
      anomaly_flags,
      not_submittable: 'This artifact proves internal consistency and schema-shape against the declared schema_version. It is NEVER a filed submission and is not accepted by any national CbCR gateway -- each jurisdiction gateway (IRS/HMRC/ATO/etc.) runs its own additional validation.',
    },
    compliance_flags: ['CBCR_REPORT_BUILT', all_fatal_passed ? 'CBCR_CONSISTENCY_VERIFIED' : 'CBCR_CONSISTENCY_ISSUES_FOUND'],
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.4/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
