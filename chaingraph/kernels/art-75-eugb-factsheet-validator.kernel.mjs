/**
 * art-75-eugb-factsheet-validator.kernel.mjs
 * Wave 16 — EU Green Bond (EuGB) Factsheet & Allocation Validator.
 * Validates an EuGB factsheet (Annex I) + allocation report (Annex II) for
 * completeness and the proceeds → Taxonomy-alignment threshold.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Citations (verify before citing on any page):
 *   EuGB Reg. (EU) 2023/2631 Annexes I (factsheet) and II (allocation report);
 *     applies since 21 Dec 2024.
 *   External-reviewer RTS: Delegated Reg. 12 Mar 2026. Verify current edition.
 *   100% Taxonomy-alignment of use-of-proceeds required for EuGB label.
 *   EDUCATIONAL: outputs are decision-support drafts, not reviewer attestations.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-75-eugb-factsheet-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'validate_eugb_factsheet',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

// ─── Annex I required sections (EuGB Reg. 2023/2631) ────────────────────────
// Source: EuGB Reg. (EU) 2023/2631 Annex I. Verify current edition.
const ANNEX_I_SECTIONS = [
  'issuer_name_and_description',
  'bond_name_and_isin',
  'use_of_proceeds',
  'environmental_objective',
  'eligible_green_assets',
  'taxonomy_alignment_evidence',
  'external_review_information',
  'reporting_commitments',
];

// ─── Required threshold ───────────────────────────────────────────────────────
const PROCEEDS_THRESHOLD = 100.0; // 100% Taxonomy-aligned (EuGB Reg. Art 4)

export function compute(pp) {
  const {
    factsheet          = [],   // [{ section, status: 'complete'|'partial'|'missing' }]
    use_of_proceeds    = [],   // [{ activity_nace, amount, alignment_verdict }]
    allocation_report  = 'missing',  // 'complete' | 'partial' | 'missing'
    external_reviewer  = 'none',     // 'appointed' | 'pending' | 'none'
  } = pp;

  // ── Annex I completeness ──
  const annex_i_gaps = [];
  const factsheet_map = {};
  for (const item of factsheet) {
    factsheet_map[item.section] = item.status;
  }
  for (const section of ANNEX_I_SECTIONS) {
    const status = factsheet_map[section] ?? 'missing';
    if (status !== 'complete') {
      annex_i_gaps.push({ section, status });
    }
  }
  const annex_i_complete = annex_i_gaps.length === 0;

  // ── Use-of-proceeds alignment ──
  const total_proceeds = use_of_proceeds.reduce((s, u) => s + +(u.amount ?? 0), 0);
  const aligned_proceeds = use_of_proceeds
    .filter(u => String(u.alignment_verdict ?? '').startsWith('ALIGNED'))
    .reduce((s, u) => s + +(u.amount ?? 0), 0);

  const proceeds_aligned_pct = total_proceeds > 0
    ? +(aligned_proceeds / total_proceeds * 100).toFixed(2)
    : 0;

  const proceeds_threshold_met = proceeds_aligned_pct >= PROCEEDS_THRESHOLD;

  // ── Annex II ──
  const annex_ii_status = allocation_report;

  // ── External reviewer ──
  const reviewer_ready = external_reviewer === 'appointed';

  // ── Label readiness ──
  const label_ready = annex_i_complete && proceeds_threshold_met && annex_ii_status === 'complete' && reviewer_ready;

  // ── Conformance grade ──
  const score = [
    annex_i_complete ? 30 : (annex_i_gaps.length <= 2 ? 15 : 0),
    proceeds_threshold_met ? 40 : (proceeds_aligned_pct >= 85 ? 20 : 0),
    annex_ii_status === 'complete' ? 20 : (annex_ii_status === 'partial' ? 10 : 0),
    reviewer_ready ? 10 : (external_reviewer === 'pending' ? 5 : 0),
  ].reduce((a, b) => a + b, 0);

  const conformance_grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';

  // ── Compliance flags ──
  const compliance_flags = [];
  if (annex_i_gaps.length > 0)      compliance_flags.push('ANNEX_I_INCOMPLETE');
  if (!proceeds_threshold_met)       compliance_flags.push('PROCEEDS_BELOW_THRESHOLD');
  if (annex_ii_status !== 'complete') compliance_flags.push('ANNEX_II_INCOMPLETE');
  if (!reviewer_ready)               compliance_flags.push('NO_EXTERNAL_REVIEWER');

  const output_payload = {
    conformance_grade,
    conformance_score: score,
    annex_i_gaps,
    annex_i_complete,
    annex_ii_status,
    proceeds_aligned_pct,
    proceeds_threshold_pct: PROCEEDS_THRESHOLD,
    proceeds_threshold_met,
    label_ready,
    external_reviewer_status: external_reviewer,
    total_proceeds,
    aligned_proceeds: +aligned_proceeds.toFixed(2),
    reference: {
      regulation:      'EuGB Reg. (EU) 2023/2631 — applies since 21 Dec 2024',
      annex_i_source:  'EuGB Reg. Annex I — factsheet template',
      annex_ii_source: 'EuGB Reg. Annex II — allocation report template',
      reviewer_rts:    'External-reviewer RTS: Delegated Reg. 12 Mar 2026 — verify applicability date',
    },
    note: 'DECISION-SUPPORT DRAFT — not a reviewer attestation or official EuGB label approval. 100% Taxonomy-alignment of use-of-proceeds required for the EuGB label (EuGB Reg. Art 4). Annex I/II gap analysis is indicative; verify against current EuGB Reg. 2023/2631 template versions. External review appointment required before label use.',
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
