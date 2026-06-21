/**
 * art-73-taxonomy-alignment-scorer.kernel.mjs
 * Wave 16 — EU Taxonomy Alignment Scorer.
 * Scores an economic activity against an environmental objective:
 * substantial-contribution + DNSH across the other five objectives
 * + minimum safeguards → aligned / eligible-but-not-aligned / not-eligible.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Citations (verify before citing on any page):
 *   EU Taxonomy Reg. (EU) 2020/852 Arts 3 (taxonomy alignment criteria),
 *     9 (environmental objectives), 10-15 (SC + DNSH per objective).
 *   Climate + Environmental Delegated Acts (consolidated, incl. Omnibus I
 *     revisions in force 28 Jan 2026). Verify current edition at eur-lex.europa.eu.
 *   EDUCATIONAL: outputs are decision-support drafts, not official disclosures.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-73-taxonomy-alignment-scorer';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'score_taxonomy_alignment',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

// ─── EU Taxonomy environmental objectives ────────────────────────────────────
const ALL_OBJECTIVES = [
  'climate_mitigation',
  'climate_adaptation',
  'water',
  'circular_economy',
  'pollution_prevention',
  'biodiversity',
];

export function compute(pp) {
  const {
    activity: {
      nace_code  = '',
      objective  = 'climate_mitigation',  // primary SC objective
    } = {},
    substantial_contribution = 'not-met',  // 'met' | 'partial' | 'not-met'
    criterion_refs           = [],         // array of regulation article refs
    dnsh                     = [],         // [{ objective, status: 'met'|'not-met' }]
    minimum_safeguards       = 'none',     // 'in-place' | 'partial' | 'none'
  } = pp;

  // ── Step 1: Substantial-contribution gate ──
  const sc_met = substantial_contribution === 'met';
  const sc_partial = substantial_contribution === 'partial';

  // ── Step 2: DNSH across other five objectives ──
  const dnsh_results = {};
  const dnsh_gaps    = [];
  const other_objectives = ALL_OBJECTIVES.filter(o => o !== objective);

  for (const obj of other_objectives) {
    const entry = (dnsh || []).find(d => d.objective === obj);
    const status = entry?.status ?? 'not-met';
    dnsh_results[obj] = status;
    if (status !== 'met') dnsh_gaps.push({ objective: obj, status });
  }

  // ── Step 3: Minimum-safeguards gate ──
  const safeguards_met = minimum_safeguards === 'in-place';
  const safeguards_status = minimum_safeguards;

  // ── Alignment verdict ──
  let alignment_verdict;
  if (!sc_met) {
    alignment_verdict = substantial_contribution === 'partial'
      ? 'ELIGIBLE_NOT_ALIGNED — Substantial contribution partially met. Activity may be Taxonomy-eligible but not aligned. Strengthen SC evidence.'
      : 'NOT_ELIGIBLE — Substantial contribution not met. Activity does not qualify for Taxonomy alignment.';
  } else if (dnsh_gaps.length > 0) {
    alignment_verdict = 'ELIGIBLE_NOT_ALIGNED — DNSH failure on ' + dnsh_gaps.map(g => g.objective).join(', ') + '. All DNSH criteria must pass.';
  } else if (!safeguards_met) {
    alignment_verdict = minimum_safeguards === 'partial'
      ? 'ELIGIBLE_NOT_ALIGNED — Minimum safeguards partially in place. Complete OECD Guidelines + UN Guiding Principles implementation.'
      : 'ELIGIBLE_NOT_ALIGNED — Minimum safeguards not in place (OECD Guidelines, UN Guiding Principles, ILO core conventions, Pillar II rights charter). Required for alignment.';
  } else {
    alignment_verdict = 'ALIGNED — Substantial contribution met, DNSH passed for all other objectives, minimum safeguards in place.';
  }

  const is_aligned = alignment_verdict.startsWith('ALIGNED');

  // ── Compliance flags ──
  const compliance_flags = [];
  if (dnsh_gaps.length > 0)           compliance_flags.push('DNSH_FAILURE');
  if (!safeguards_met)                 compliance_flags.push('SAFEGUARDS_INCOMPLETE');
  if (!sc_met && !sc_partial)          compliance_flags.push('SC_NOT_MET');
  if (!is_aligned && sc_met)           compliance_flags.push('ELIGIBLE_NOT_ALIGNED');

  const output_payload = {
    alignment_verdict,
    is_aligned,
    substantial_contribution_status: substantial_contribution,
    primary_objective:               objective,
    dnsh_results,
    dnsh_gaps,
    safeguards_status,
    criterion_refs: criterion_refs.length > 0 ? criterion_refs : ['Verify against applicable Climate/Environmental Delegated Act TSC for NACE code: ' + nace_code],
    nace_code,
    reference: {
      regulation:   'EU Taxonomy Reg. (EU) 2020/852',
      delegated_acts: 'Climate Delegated Act + Environmental Delegated Act (consolidated, Omnibus I revisions in force 28 Jan 2026). Verify current edition at eur-lex.europa.eu.',
    },
    note: 'DECISION-SUPPORT DRAFT — not an official Taxonomy disclosure. Technical Screening Criteria (SC + DNSH) are activity-specific and defined in the applicable Delegated Act annex for the NACE code. Minimum safeguards: Art 18 Taxonomy Reg. — OECD Guidelines, UN Guiding Principles, ILO core conventions, EU Charter fundamental rights. Verify all criteria against current Delegated Act edition.',
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
