/**
 * art-74-taxonomy-kpi-gar-aggregator.kernel.mjs
 * Wave 16 — Taxonomy KPI & Green Asset Ratio Aggregator.
 * Rolls activity-level alignment (from ART-73) into entity KPIs:
 * revenue / CapEx / OpEx aligned proportions, and for financial undertakings
 * the Green Asset Ratio (GAR).
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Citations (verify before citing on any page):
 *   EU Taxonomy Disclosures Delegated Act (EU) 2021/2178 (Art 8 non-financials);
 *   Taxonomy Disclosures Delegated Act for credit institutions — GAR methodology;
 *   Omnibus I revisions in force 28 Jan 2026. Verify current edition.
 *   EDUCATIONAL: outputs are decision-support drafts, not official disclosures.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-74-taxonomy-kpi-gar-aggregator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'aggregate_taxonomy_kpi_gar',
  mandate_type: 'model_governance',
  gpu:          false,
};

const safe = (n, d) => (d > 0 ? +(n / d * 100).toFixed(2) : 0);

export function compute(pp) {
  const {
    activities   = [],  // [{ nace_code, alignment_verdict, turnover, capex, opex }]
    entity_type  = 'non-financial',   // 'non-financial' | 'credit-institution' | 'insurer'
    // For financial undertakings:
    covered_assets    = 0,
    total_assets      = 0,
    gar_numerator_items = [],  // [{ asset_type, amount, aligned: bool }]
  } = pp;

  // ── Aggregate turnover/CapEx/OpEx ──
  let total_turnover = 0, aligned_turnover = 0;
  let total_capex    = 0, aligned_capex    = 0;
  let total_opex     = 0, aligned_opex     = 0;

  const kpi_breakdown = [];

  for (const act of activities) {
    const is_aligned = act.alignment_verdict === 'ALIGNED'
      || String(act.alignment_verdict ?? '').startsWith('ALIGNED');
    const tv = +(act.turnover ?? 0);
    const cv = +(act.capex ?? 0);
    const ov = +(act.opex ?? 0);

    total_turnover += tv;
    total_capex    += cv;
    total_opex     += ov;

    if (is_aligned) {
      aligned_turnover += tv;
      aligned_capex    += cv;
      aligned_opex     += ov;
    }

    kpi_breakdown.push({
      nace_code:        act.nace_code ?? '',
      alignment_verdict: act.alignment_verdict ?? '',
      is_aligned,
      turnover:          tv,
      capex:             cv,
      opex:              ov,
    });
  }

  const revenue_aligned_pct = safe(aligned_turnover, total_turnover);
  const capex_aligned_pct   = safe(aligned_capex, total_capex);
  const opex_aligned_pct    = safe(aligned_opex, total_opex);

  // ── Green Asset Ratio (financial undertakings) ──
  let green_asset_ratio = null;
  let gar_detail = null;

  if (entity_type === 'credit-institution' || entity_type === 'insurer') {
    const aligned_covered = gar_numerator_items
      .filter(i => i.aligned)
      .reduce((s, i) => s + +(i.amount ?? 0), 0);
    green_asset_ratio = total_assets > 0
      ? +(aligned_covered / total_assets * 100).toFixed(2)
      : 0;
    gar_detail = {
      aligned_covered_assets: +aligned_covered.toFixed(2),
      total_assets:           +total_assets,
      covered_assets:         +covered_assets,
      gar_denominator_basis:  'Total assets per Delegated Act Art 8. Verify denominator exclusions (Reg. 2021/2178 Annex V).',
    };
  }

  // ── Compliance flags ──
  const compliance_flags = [];
  if (entity_type !== 'non-financial' && total_assets <= 0) compliance_flags.push('GAR_DENOMINATOR_ASSUMPTION');
  if (activities.some(a => !a.turnover && !a.capex && !a.opex))    compliance_flags.push('KPI_PARTIAL_COVERAGE');
  if (revenue_aligned_pct === 0 && activities.length > 0)          compliance_flags.push('ZERO_TAXONOMY_ALIGNMENT');

  const output_payload = {
    revenue_aligned_pct,
    capex_aligned_pct,
    opex_aligned_pct,
    green_asset_ratio,
    gar_detail,
    entity_type,
    kpi_breakdown,
    activity_count:    activities.length,
    aligned_count:     kpi_breakdown.filter(k => k.is_aligned).length,
    reference: {
      non_financial: 'EU Taxonomy Disclosures Delegated Act (EU) 2021/2178, Art 8',
      financial:     'Taxonomy Delegated Act for credit institutions — GAR Annex V. Verify Omnibus I revisions (in force 28 Jan 2026).',
    },
    note: 'DECISION-SUPPORT DRAFT — not an official Taxonomy disclosure. KPI percentages depend on the scope of activities included. GAR denominator exclusions apply — verify against Reg. 2021/2178 Annex V. Omnibus I revisions (28 Jan 2026) may affect reporting thresholds; verify current edition.',
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
