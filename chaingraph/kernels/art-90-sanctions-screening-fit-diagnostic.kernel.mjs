/**
 * art-90-sanctions-screening-fit-diagnostic.kernel.mjs
 * Wave 19 — Sanctions & Export-Control Screening Fit Diagnostic (D0).
 * 12-param A–F diagnostic scoping a firm's sanctions/export-control screening
 * program and routing to the right Wave-19 sanc-*/ec-* chain.
 * Operates on program config only — zero real customer data, zero PII.
 *
 * Citations (verify before citing):
 *   OFAC 50% Rule guidance — SDN constructive blocking via aggregate ownership.
 *   BIS Affiliates Rule (15 CFR Part 744) — in force 29 Sep 2025.
 *   EU 20th sanctions package — 23 Apr 2026 (anti-circumvention + no-Russia clause).
 *   EU dual-use Reg. 2021/821 + Annex I update in force 15 Nov 2025.
 *   OFSI Consolidated List closure → UK Sanctions List sole authority 28 Jan 2026.
 *   Wolfsberg Sanctions Screening Guidance (2019, verify for updates).
 *   EDUCATIONAL: outputs are decision-support drafts.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-90-sanctions-screening-fit-diagnostic';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'run_sanctions_screening_fit',
  mandate_type: 'agent_guardrail_mandate',
  gpu:          false,
};

// Key hard dates (verify against current official sources)
const BIS_AFFILIATES_RULE_DATE  = '2025-09-29';
const EU_20TH_PACKAGE_DATE      = '2026-04-23';
const EU_DUAL_USE_UPDATE_DATE   = '2025-11-15';
const UK_SANCTIONS_LIST_DATE    = '2026-01-28';

const PRESETS = {
  bank: {
    business_model: 'bank',
    sanctions_lists_screened: ['ofac_sdn', 'eu_consolidated', 'un', 'uk_sanctions'],
    ownership_screening: 'partial',
    export_control_exposure: 'none',
    fuzzy_match_governance: 'partial',
    circumvention_controls: 'none',
    jurisdictional_nexus: ['us', 'eu', 'uk'],
    screening_frequency: 'daily',
    sectoral_screening: 'partial',
    adverse_media: 'yes',
    pep_screening: 'yes',
    alert_review_sla: 'defined',
  },
  exporter: {
    business_model: 'exporter',
    sanctions_lists_screened: ['ofac_sdn', 'eu_consolidated', 'un'],
    ownership_screening: 'none',
    export_control_exposure: 'dual-use',
    fuzzy_match_governance: 'none',
    circumvention_controls: 'none',
    jurisdictional_nexus: ['us', 'eu'],
    screening_frequency: 'per_transaction',
    sectoral_screening: 'none',
    adverse_media: 'no',
    pep_screening: 'no',
    alert_review_sla: 'partial',
  },
  marketplace: {
    business_model: 'marketplace',
    sanctions_lists_screened: ['ofac_sdn', 'eu_consolidated'],
    ownership_screening: 'none',
    export_control_exposure: 'none',
    fuzzy_match_governance: 'none',
    circumvention_controls: 'none',
    jurisdictional_nexus: ['us'],
    screening_frequency: 'on_boarding',
    sectoral_screening: 'none',
    adverse_media: 'no',
    pep_screening: 'no',
    alert_review_sla: 'none',
  },
};

function gradeScore(pct) {
  if (pct >= 85) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 55) return 'C';
  if (pct >= 40) return 'D';
  return 'F';
}

export function compute(pp) {
  const {
    business_model          = 'bank',
    sanctions_lists_screened = [],
    ownership_screening     = 'none',
    export_control_exposure = 'none',
    fuzzy_match_governance  = 'none',
    circumvention_controls  = 'none',
    jurisdictional_nexus    = [],
    screening_frequency     = 'daily',
    sectoral_screening      = 'none',
    adverse_media           = 'no',
    pep_screening           = 'no',
    alert_review_sla        = 'none',
  } = pp;

  // --- Dimension 1: List coverage (0–25) ---
  const required_lists = ['ofac_sdn', 'eu_consolidated', 'un', 'uk_sanctions'];
  const covered = required_lists.filter(l => sanctions_lists_screened.includes(l)).length;
  const list_score = Math.round((covered / required_lists.length) * 25);

  // --- Dimension 2: Ownership 50%-rule (0–20) ---
  const owner_score =
    ownership_screening === '50pct-aware' ? 20 :
    ownership_screening === 'partial'     ? 10 : 0;

  // --- Dimension 3: Fuzzy match governance (0–20) ---
  const fuzzy_score =
    fuzzy_match_governance === 'calibrated' ? 20 :
    fuzzy_match_governance === 'partial'    ? 10 : 0;

  // --- Dimension 4: Circumvention controls (0–15) ---
  const circ_score =
    circumvention_controls === 'no-russia-clause' ? 15 :
    circumvention_controls === 'partial'           ? 7  : 0;

  // --- Dimension 5: Screening ops (0–20) ---
  const freq_score =
    screening_frequency === 'real_time' ? 8 :
    screening_frequency === 'daily'     ? 6 :
    screening_frequency === 'per_transaction' ? 5 :
    screening_frequency === 'on_boarding'     ? 2 : 0;
  const sla_score = alert_review_sla === 'defined' ? 6 : alert_review_sla === 'partial' ? 3 : 0;
  const media_score = adverse_media === 'yes' ? 3 : 0;
  const pep_score   = pep_screening  === 'yes' ? 3 : 0;
  const ops_score   = Math.min(20, freq_score + sla_score + media_score + pep_score);

  const raw_total   = list_score + owner_score + fuzzy_score + circ_score + ops_score;
  const program_grade = gradeScore(raw_total);

  // --- Flags ---
  const compliance_flags = [];
  if (ownership_screening === 'none')
    compliance_flags.push('NO_50PCT_RULE_SCREENING');
  if (fuzzy_match_governance === 'none')
    compliance_flags.push('UNCALIBRATED_FUZZY_MATCH');
  if (circumvention_controls === 'none' && export_control_exposure !== 'none')
    compliance_flags.push('NO_CIRCUMVENTION_CONTROLS');
  if (!sanctions_lists_screened.includes('uk_sanctions'))
    compliance_flags.push('UK_SANCTIONS_LIST_GAP');
  if (!sanctions_lists_screened.includes('eu_consolidated') && jurisdictional_nexus.includes('eu'))
    compliance_flags.push('EU_LIST_NEXUS_GAP');

  // --- Gaps ---
  const gaps = [];
  if (list_score < 25)
    gaps.push('Incomplete sanctions list coverage — missing: ' + required_lists.filter(l => !sanctions_lists_screened.includes(l)).join(', '));
  if (owner_score === 0)
    gaps.push('No 50%-rule ownership screening — OFAC/EU/BIS constructive-blocking logic absent');
  if (fuzzy_score === 0)
    gaps.push('Fuzzy-match engine uncalibrated — FPR/recall not governed');
  if (circ_score === 0 && export_control_exposure !== 'none')
    gaps.push('No no-Russia clause or anti-circumvention due-diligence controls');
  if (sla_score === 0)
    gaps.push('Alert review SLA not defined');

  // --- Routes ---
  const secondary = [];
  if (ownership_screening !== '50pct-aware')
    secondary.push('sanc-ownership');
  secondary.push('sanc-list-coverage');
  if (fuzzy_match_governance !== 'calibrated')
    secondary.push('sanc-fuzzy-calibration');
  if (export_control_exposure !== 'none') {
    secondary.push('ec-eccn-classify');
    secondary.push('ec-circumvention');
  }
  secondary.push('sanc-screening-quality');

  const primary_recommendation =
    program_grade === 'A' ? 'Program meets standards — schedule annual review and re-validate ownership screening against BIS Affiliates Rule' :
    program_grade === 'B' ? 'Address ownership 50%-rule gaps and calibrate fuzzy-match engine' :
    program_grade === 'C' ? 'Prioritise ownership screening, list coverage, and fuzzy-match calibration before next regulatory examination' :
    program_grade === 'D' ? 'Launch emergency screening program review — material gaps across ownership, list coverage, and controls' :
    'Immediate escalation — screening program does not meet minimum standards under OFAC/EU/BIS requirements';

  const output_payload = {
    program_grade,
    raw_score: raw_total,
    dim_scores: {
      list_coverage:        list_score,
      ownership_50pct:      owner_score,
      fuzzy_match:          fuzzy_score,
      circumvention:        circ_score,
      screening_operations: ops_score,
    },
    gaps,
    primary_recommendation,
    secondary_routes: secondary,
    always_route: ['sanc-audit-pack'],
    key_dates: {
      bis_affiliates_rule:  BIS_AFFILIATES_RULE_DATE,
      eu_20th_package:      EU_20TH_PACKAGE_DATE,
      eu_dual_use_update:   EU_DUAL_USE_UPDATE_DATE,
      uk_sanctions_list:    UK_SANCTIONS_LIST_DATE,
    },
    reference_version: '2026-06',
    note: 'DECISION-SUPPORT DRAFT. Operates on program config only. No real customer data processed. Verify all regulatory citations against current OFAC/BIS/EU/OFSI publications.',
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

export { PRESETS };
