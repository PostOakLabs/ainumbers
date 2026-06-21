/**
 * art-77-t1-settlement-readiness-diagnostic.kernel.mjs
 * Wave 17 — T+1 Settlement Readiness Diagnostic (D0).
 * Scores a firm's readiness for the coordinated EU/UK/CH T+1 move (11 Oct 2027)
 * against the Industry Roadmap phases, grading trade-date allocation/confirmation
 * (the Dec-2026 23:00 CET machine-readable mandate), SSI automation, FX/funding
 * compression, corporate-actions, and CSDR-penalty exposure.
 * Routes to the right Wave-17 sd-* chain.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Citations (verify before citing on any page):
 *   EU T+1: CSDR amending text in OJ 14 Oct 2025, application 11 Oct 2027.
 *   ESMA CSDR SDR RTS — Final Report 13 Oct 2025 (ESMA74-2119945926-3430):
 *     same-day allocation/confirmation by 23:00 CET + machine-readable formats
 *     from Dec 2026.
 *   ESMA T+1 high-level roadmap (30 Jun 2025).
 *   UK-AST + Swiss Securities Post-Trade Council — same Oct 2027 date.
 *   EDUCATIONAL: outputs are decision-support drafts, not supervisory assessments.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-77-t1-settlement-readiness-diagnostic';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'run_t1_readiness_diagnostic',
  mandate_type: 'agent_guardrail_mandate',
  gpu:          false,
};

const S = {
  allocation_confirmation_timing: { 'same-day-automated': 4, partial: 2, 'T+1-manual': 0 },
  ssi_automation:                  { 'golden-source': 4, partial: 2, manual: 0 },
  matching_method:                 { auto: 4, partial: 2, manual: 0 },
  fx_funding_compression:          { ready: 4, partial: 2, none: 0 },
  corporate_actions_readiness:     { ready: 4, partial: 2, none: 0 },
  penalty_exposure_monitoring:     { live: 4, partial: 2, none: 0 },
  partial_settlement_enabled:      { yes: 4, no: 0 },
};

const pick   = (t, v, d = 0) => (v in t ? t[v] : d);
const letter = s => (s >= 85 ? 'A' : s >= 70 ? 'B' : s >= 55 ? 'C' : s >= 40 ? 'D' : 'F');

const WEIGHTS = {
  timing:      0.25,
  ssi:         0.25,
  matching:    0.15,
  funding:     0.15,
  corp_actions: 0.10,
  penalty:     0.10,
};

const CHAIN_ROUTES = {
  ssi:       'sd-ssi-hygiene',
  fails:     'sd-failpredict',
  penalty:   'sd-penalty',
  alloc:     'sd-alloc-affirm',
  messaging: 'sd-message-conformance',
  buyin:     'sd-buyin',
  audit:     'sd-audit-pack',
};

export function compute(pp) {
  const {
    jurisdictions                  = ['EU'],
    allocation_confirmation_timing = 'T+1-manual',
    ssi_automation                 = 'manual',
    matching_method                = 'manual',
    fx_funding_compression         = 'none',
    corporate_actions_readiness    = 'none',
    penalty_exposure_monitoring    = 'none',
    partial_settlement_enabled     = 'no',
    // Informational
    firm_type          = 'buy-side',
    instrument_classes = [],
    csd_participations = [],
  } = pp;

  const dim_raw = {
    timing:      pick(S.allocation_confirmation_timing, allocation_confirmation_timing),
    ssi:         pick(S.ssi_automation, ssi_automation),
    matching:    pick(S.matching_method, matching_method),
    funding:     pick(S.fx_funding_compression, fx_funding_compression),
    corp_actions: pick(S.corporate_actions_readiness, corporate_actions_readiness),
    penalty:     pick(S.penalty_exposure_monitoring, penalty_exposure_monitoring),
    partial:     pick(S.partial_settlement_enabled, partial_settlement_enabled),
  };

  const dim_scores = {};
  for (const [k, raw] of Object.entries(dim_raw)) {
    const score = +(raw / 4 * 100).toFixed(1);
    dim_scores[k] = { score, grade: letter(score) };
  }

  // Weighted overall (partial not in weights — informational only)
  const overall = +(Object.keys(WEIGHTS).reduce(
    (acc, k) => acc + dim_scores[k].score * WEIGHTS[k], 0
  )).toFixed(1);
  const readiness_grade = letter(overall);

  // ── Binding deadlines ──
  const binding_deadline = {
    allocation_confirmation: {
      date:   'Dec 2026',
      rule:   '23:00 CET trade-date allocation/confirmation + machine-readable formats',
      source: 'ESMA CSDR SDR RTS (13 Oct 2025, ESMA74-2119945926-3430)',
      status: allocation_confirmation_timing === 'same-day-automated' ? 'READY' : 'NOT_READY',
    },
    t1_go_live: {
      date:   '11 Oct 2027',
      rule:   'Coordinated EU/UK/CH T+1 securities-settlement cycle',
      source: 'CSDR amending text OJ 14 Oct 2025; UK-AST; Swiss SSPTC',
      status: overall >= 70 ? 'ON_TRACK' : overall >= 40 ? 'PARTIAL' : 'AT_RISK',
    },
  };

  // ── Gap checklist ──
  const gap_checklist = [];
  if (allocation_confirmation_timing !== 'same-day-automated') {
    gap_checklist.push({ gap: 'Same-day automated allocation/confirmation', priority: 'CRITICAL', deadline: 'Dec 2026', chain: CHAIN_ROUTES.alloc });
  }
  if (ssi_automation !== 'golden-source') {
    gap_checklist.push({ gap: 'SSI golden-source automation (~30% of fails)', priority: 'HIGH', deadline: '11 Oct 2027', chain: CHAIN_ROUTES.ssi });
  }
  if (matching_method !== 'auto') {
    gap_checklist.push({ gap: 'Automated matching / STP', priority: 'HIGH', deadline: '11 Oct 2027', chain: CHAIN_ROUTES.fails });
  }
  if (penalty_exposure_monitoring !== 'live') {
    gap_checklist.push({ gap: 'Live CSDR penalty monitoring', priority: 'MEDIUM', deadline: 'NOW (penalties live since Feb 2022)', chain: CHAIN_ROUTES.penalty });
  }
  if (partial_settlement_enabled !== 'yes') {
    gap_checklist.push({ gap: 'Auto-partial settlement capability', priority: 'MEDIUM', deadline: '11 Oct 2027 (CSDR Refit)', chain: CHAIN_ROUTES.audit });
  }

  // ── Primary recommendation ──
  let primary_recommendation;
  if (allocation_confirmation_timing !== 'same-day-automated') {
    primary_recommendation = CHAIN_ROUTES.alloc;
  } else if (ssi_automation === 'manual') {
    primary_recommendation = CHAIN_ROUTES.ssi;
  } else if (penalty_exposure_monitoring !== 'live') {
    primary_recommendation = CHAIN_ROUTES.penalty;
  } else {
    primary_recommendation = CHAIN_ROUTES.audit;
  }

  const secondary_recommendations = [
    CHAIN_ROUTES.ssi, CHAIN_ROUTES.fails, CHAIN_ROUTES.penalty, CHAIN_ROUTES.audit,
  ].filter(r => r !== primary_recommendation);

  // ── Compliance flags ──
  const compliance_flags = [];
  if (allocation_confirmation_timing !== 'same-day-automated') compliance_flags.push('ALLOCATION_TIMING_NOT_READY');
  if (ssi_automation === 'manual')                              compliance_flags.push('SSI_MANUAL');
  if (penalty_exposure_monitoring === 'none')                   compliance_flags.push('NO_PENALTY_MONITORING');
  if (matching_method === 'manual')                             compliance_flags.push('MANUAL_MATCHING');

  const output_payload = {
    readiness_grade,
    overall_score: overall,
    dim_scores,
    binding_deadline,
    gap_checklist,
    primary_recommendation,
    secondary_recommendations,
    firm_type,
    jurisdictions,
    dual_date_note: 'Allocation/confirmation timing rules binding DEC 2026 · T+1 go-live 11 OCT 2027 — verify current (CSDR Refit/RTS still finalising)',
    note: 'DECISION-SUPPORT DRAFT — not a regulatory assessment. Verify all deadlines and requirements against ESMA CSDR SDR RTS (13 Oct 2025) and current CSDR Refit final text. UK-AST and Swiss SSPTC coordination to be confirmed. CSDR Refit mandatory buy-in reform: verify adoption ~Q1 2026.',
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
