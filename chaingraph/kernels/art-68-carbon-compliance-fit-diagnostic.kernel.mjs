/**
 * art-68-carbon-compliance-fit-diagnostic.kernel.mjs
 * Wave 16 — Carbon & Climate Compliance Fit Diagnostic (D0).
 * Screens CBAM declarant status, EU Taxonomy scope, EuGB intent, climate-stress
 * applicability. Emits "do now" (CBAM in force 1 Jan 2026) vs "prepare-ahead"
 * (first declaration 30 Sep 2027, downstream scope 1 Jan 2028) checklists.
 * Routes to the right Wave-16 cbm-* chain.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Citations (verify before citing on any page):
 *   CBAM Reg. (EU) 2023/956 (consolidated) — definitive period 1 Jan 2026;
 *     50 t/yr threshold; first declaration + certificate surrender 30 Sep 2027;
 *     downstream-180 scope extension: Council position 12 Jun 2026, application 1 Jan 2028.
 *     https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism_en
 *   EU Taxonomy Reg. (EU) 2020/852 + Climate/Environmental Delegated Acts
 *     (Omnibus I revisions in force 28 Jan 2026). Verify current edition.
 *   EU Green Bond Standard Reg. (EU) 2023/2631 — applies since 21 Dec 2024.
 *   EDUCATIONAL: outputs are decision-support drafts, not legal filings or attestations.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-68-carbon-compliance-fit-diagnostic';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'run_carbon_compliance_fit',
  mandate_type: 'agent_guardrail_mandate',
  gpu:          false,
};

// ─── Scoring tables ──────────────────────────────────────────────────────────
const S = {
  imports_cbam_goods:            { none: 4, 'below-50t': 2, 'above-50t': 0 },
  declarant_status:              { authorised: 4, applied: 2, none: 0 },
  origin_carbon_price:           { yes: 4, partial: 2, none: 0 },
  taxonomy_scope:                { 'out': 4, financial: 2, 'non-financial': 2 },
  taxonomy_objectives_assessed:  { 'all-six': 4, 'climate-only': 2, none: 0 },
  eugb_intent:                   { none: 4, considering: 2, issuing: 0 },
  climate_stress_applicable:     { none: 4, insurer: 2, bank: 1 },
  emissions_data_basis:          { actual: 4, default: 2, unknown: 0 },
};

const pick   = (t, v, d = 0) => (v in t ? t[v] : d);
const letter = s => (s >= 85 ? 'A' : s >= 70 ? 'B' : s >= 55 ? 'C' : s >= 40 ? 'D' : 'F');

const WEIGHTS = {
  cbam:     0.35,
  taxonomy: 0.25,
  eugb:     0.20,
  climate:  0.20,
};

const CHAIN_ROUTES = {
  importer:    'cbm-liability',
  producer:    'cbm-precursor',
  undertaking: 'taxonomy-align',
  financial:   'taxonomy-kpi',
  issuer:      'eugb-conformance',
  bank:        'climate-scenario',
  audit:       'carbon-audit-pack',
};

const DO_NOW_ITEMS = {
  cbam_declarant:  'CBAM authorised-declarant obligation IN FORCE 1 Jan 2026. Imports of CBAM goods above 50 t/yr require authorised-declarant status. Register with your national CBAM authority. Run cbm-liability chain. Decision-support draft — verify against CBAM Reg. 2023/956.',
  taxonomy_scope:  'EU Taxonomy reporting (NFRD/CSRD scope). Taxonomy Regulation (EU) 2020/852 Delegated Acts apply to non-financial and financial undertakings in scope. Verify current Omnibus I revision status (in force 28 Jan 2026). Run taxonomy-align or taxonomy-kpi chain.',
  eugb_label:      'EU Green Bond Standard Reg. (EU) 2023/2631 applies since 21 Dec 2024. Use-of-proceeds 100% Taxonomy-aligned required for EuGB label. External-reviewer RTS 12 Mar 2026. Run eugb-conformance chain.',
  climate_stress:  'NGFS / ECB climate-stress obligations for banks/insurers. Apply NGFS Phase V scenarios. Run climate-scenario chain. Verify current ECB good-practices (May 2026).',
};

const PREPARE_AHEAD_ITEMS = {
  cbam_declaration: 'First CBAM declaration + certificate surrender deadline: 30 Sep 2027. Certificate sales open 1 Feb 2027. Downstream-180 scope extension (Council position 12 Jun 2026): application 1 Jan 2028. Prepare actual emissions data now — default-value markup penalty applies (+10% 2026, +20% 2027, +30% 2028+). Run cbm-liability chain.',
  embedded_data:    'Actual installation data collection for 2026 reporting year. Data agreements with CBAM goods suppliers. If using defaults, budget for the markup penalty. Run cbm-precursor for complex goods value chains.',
};

export function compute(pp) {
  const {
    imports_cbam_goods           = 'none',
    cbam_good_categories         = [],
    declarant_status             = 'none',
    origin_carbon_price          = 'none',
    taxonomy_scope               = 'out',
    taxonomy_objectives_assessed = 'none',
    eugb_intent                  = 'none',
    climate_stress_applicable    = 'none',
    emissions_data_basis         = 'unknown',
    // Informational
    entity_name   = '',
    eu_nexus      = true,
    reporting_year = 2026,
  } = pp;

  // ── CBAM dimension ──
  const cbam_declarant_required = imports_cbam_goods === 'above-50t';
  const cbam_declarant_verdict = cbam_declarant_required && declarant_status === 'none'
    ? 'CRITICAL — CBAM authorised-declarant obligation IN FORCE (1 Jan 2026). Register immediately.'
    : cbam_declarant_required && declarant_status === 'applied'
    ? 'WARNING — application pending; verify acceptance before 30 Sep 2027 declaration deadline.'
    : cbam_declarant_required
    ? 'PASS — authorised-declarant status confirmed. Prepare for 30 Sep 2027 declaration.'
    : 'N/A — imports below 50 t/yr threshold or no CBAM goods.';

  const cbam_raw = [
    pick(S.imports_cbam_goods, imports_cbam_goods),
    pick(S.declarant_status, declarant_status),
    pick(S.origin_carbon_price, origin_carbon_price),
    pick(S.emissions_data_basis, emissions_data_basis),
  ].reduce((a, b) => a + b, 0) / (4 * 4) * 100;

  // ── Taxonomy dimension ──
  const taxonomy_raw = [
    pick(S.taxonomy_scope, taxonomy_scope),
    pick(S.taxonomy_objectives_assessed, taxonomy_objectives_assessed),
  ].reduce((a, b) => a + b, 0) / (2 * 4) * 100;

  // ── EuGB dimension ──
  const eugb_raw = pick(S.eugb_intent, eugb_intent) / 4 * 100;

  // ── Climate dimension ──
  const climate_raw = pick(S.climate_stress_applicable, climate_stress_applicable) / 4 * 100;

  const dim_scores = {
    cbam:     { score: +cbam_raw.toFixed(1), grade: letter(cbam_raw) },
    taxonomy: { score: +taxonomy_raw.toFixed(1), grade: letter(taxonomy_raw) },
    eugb:     { score: +eugb_raw.toFixed(1), grade: letter(eugb_raw) },
    climate:  { score: +climate_raw.toFixed(1), grade: letter(climate_raw) },
  };

  const overall = +(
    cbam_raw * WEIGHTS.cbam +
    taxonomy_raw * WEIGHTS.taxonomy +
    eugb_raw * WEIGHTS.eugb +
    climate_raw * WEIGHTS.climate
  ).toFixed(1);
  const overall_grade = letter(overall);

  // ── Checklists ──
  const do_now_checklist = [];
  if (cbam_declarant_required) {
    do_now_checklist.push({ obligation: 'CBAM Authorised-Declarant Registration', status: 'IN FORCE 1 Jan 2026', action: DO_NOW_ITEMS.cbam_declarant });
  }
  if (taxonomy_scope !== 'out') {
    do_now_checklist.push({ obligation: 'EU Taxonomy Alignment Reporting', status: 'IN FORCE (Delegated Acts)', action: DO_NOW_ITEMS.taxonomy_scope });
  }
  if (eugb_intent === 'issuing') {
    do_now_checklist.push({ obligation: 'EU Green Bond Standard Conformance', status: 'IN FORCE since 21 Dec 2024', action: DO_NOW_ITEMS.eugb_label });
  }
  if (climate_stress_applicable !== 'none') {
    do_now_checklist.push({ obligation: 'NGFS / ECB Climate Scenario Stress', status: 'IN FORCE (supervisory expectation)', action: DO_NOW_ITEMS.climate_stress });
  }

  const prepare_ahead_checklist = [];
  if (imports_cbam_goods === 'above-50t') {
    prepare_ahead_checklist.push({ obligation: 'First CBAM Declaration + Certificate Surrender', target_date: '30 Sep 2027', action: PREPARE_AHEAD_ITEMS.cbam_declaration });
    if (cbam_good_categories.length > 0) {
      prepare_ahead_checklist.push({ obligation: 'Actual Embedded Emissions Data Collection', target_date: '2026 reporting year', action: PREPARE_AHEAD_ITEMS.embedded_data });
    }
  }

  // ── Primary recommendation ──
  let primary_recommendation;
  if (cbam_declarant_required && declarant_status !== 'authorised') {
    primary_recommendation = CHAIN_ROUTES.importer;
  } else if (taxonomy_scope === 'non-financial') {
    primary_recommendation = CHAIN_ROUTES.undertaking;
  } else if (taxonomy_scope === 'financial') {
    primary_recommendation = CHAIN_ROUTES.financial;
  } else if (eugb_intent === 'issuing' || eugb_intent === 'considering') {
    primary_recommendation = CHAIN_ROUTES.issuer;
  } else if (climate_stress_applicable !== 'none') {
    primary_recommendation = CHAIN_ROUTES.bank;
  } else {
    primary_recommendation = CHAIN_ROUTES.audit;
  }

  const secondary_recommendations = [
    CHAIN_ROUTES.importer,
    CHAIN_ROUTES.undertaking,
    CHAIN_ROUTES.issuer,
    CHAIN_ROUTES.audit,
  ].filter(r => r !== primary_recommendation);

  // ── Compliance flags ──
  const compliance_flags = [];
  if (cbam_declarant_required && declarant_status === 'none') compliance_flags.push('CBAM_DECLARANT_REQUIRED');
  if (cbam_declarant_required && declarant_status !== 'authorised') compliance_flags.push('NO_AUTHORISED_DECLARANT_STATUS');
  if (taxonomy_scope !== 'out' && taxonomy_objectives_assessed === 'none') compliance_flags.push('TAXONOMY_OBJECTIVES_INCOMPLETE');
  if (eugb_intent === 'issuing') compliance_flags.push('EUGB_CONFORMANCE_REQUIRED');
  if (eugb_intent === 'considering') compliance_flags.push('EUGB_NOT_READY');

  const output_payload = {
    cbam_declarant_verdict,
    cbam_declarant_required,
    taxonomy_scope,
    eugb_readiness: eugb_intent === 'issuing' ? 'ACTIVE' : eugb_intent === 'considering' ? 'PREPARING' : 'N/A',
    climate_stress_applicable,
    dim_scores,
    overall_score: overall,
    overall_grade,
    do_now_checklist,
    prepare_ahead_checklist,
    primary_recommendation,
    secondary_recommendations,
    cbam_dual_status: {
      in_force: 'CBAM definitive period — 1 Jan 2026',
      first_declaration: '30 Sep 2027',
      downstream_scope: '1 Jan 2028 (Council position 12 Jun 2026 — verify)',
    },
    note: 'DECISION-SUPPORT DRAFT — not a legal filing, tax advice, or regulatory attestation. '
      + 'CBAM regulatory acts are still evolving (downstream-180 extension Council position 12 Jun 2026). '
      + 'Verify all thresholds, deadlines, and rates against CBAM Reg. 2023/956 consolidated text and '
      + 'current Implementing Regulation edition at https://taxation-customs.ec.europa.eu/. '
      + 'EU Taxonomy Delegated Acts: verify Omnibus I revision status. '
      + 'EuGB Reg. 2023/2631: verify external-reviewer RTS applicability date.',
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
