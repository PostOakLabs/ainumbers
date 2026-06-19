/**
 * art-48-treasury-clearing-fit-diagnostic.kernel.mjs
 * Wave 11 — US Treasury Central Clearing (FICC) readiness diagnostic.
 * 12 questions → 6 weighted dimensions → A–F grade + routing to the right tcm-* chain.
 * Pure decision kernel — no DOM, no window, no Date.now() (deadline date is static;
 * the browser/page computes days-to-deadline).
 * Spec: WORKFLOW-CANDIDATES-WAVE11_2026-06-19.md §2.1.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-48-treasury-clearing-fit-diagnostic';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'run_treasury_clearing_fit',
  mandate_type: 'agent_guardrail_mandate',
  gpu:          false,
};

// SEC compliance dates (final rule 34-102487): cash 2026-12-31, repo 2027-06-30.
const DEADLINE_CASH = '2026-12-31';
const DEADLINE_REPO = '2027-06-30';

// Each answer → a 0..4 readiness sub-score (4 = most ready / least work).
const S = {
  activity_cash:    { none: 4, occasional: 2, core: 1 },
  activity_repo:    { none: 4, 'triparty-only': 2, bilateral: 1, both: 0 },
  current_access:   { 'direct-member': 4, sponsored: 3, agent: 3, none: 0 },
  im_funding_ready: { 'yes-segregated': 4, 'yes-omnibus': 3, unsure: 1, no: 0 },
  capital_constrained: { 'bank-SLR': 1, 'non-bank': 3, na: 4 },
  cross_product_hedges: { both: 4, 'cme-futures': 3, sofr: 3, none: 2 },
  agreements_status: { executed: 4, drafting: 2, 'not-started': 0 },
  connectivity:     { live: 4, 'in-progress': 2, none: 0 },
  intraday_liquidity: { strong: 4, adequate: 2, thin: 0 },
};
const pick = (table, val, dflt = 0) => (val in table ? table[val] : dflt);
const breadthScore = (n) => (n >= 6 ? 4 : n >= 3 ? 3 : n >= 1 ? 2 : 0);
const letter = (s) => (s >= 85 ? 'A' : s >= 70 ? 'B' : s >= 55 ? 'C' : s >= 40 ? 'D' : 'F');

// Dimension → the tcm-* chain that addresses a weak score there.
const ROUTE = {
  scope:     'tcm-access-model',
  access:    'tcm-access-model',
  margin:    'tcm-repo-margin',
  capital:   'tcm-capital-relief',
  ops:       'tcm-onboarding',
  liquidity: 'tcm-liquidity',
};
const WEIGHTS = { scope: 0.20, access: 0.20, margin: 0.15, capital: 0.15, ops: 0.15, liquidity: 0.15 };

export function compute(pp) {
  const {
    activity_cash = 'occasional', activity_repo = 'triparty-only', current_access = 'none',
    execution_breadth = 0, im_funding_ready = 'unsure', hqla_inventory_pct = 0,
    capital_constrained = 'non-bank', cross_product_hedges = 'none', agreements_status = 'not-started',
    connectivity = 'none', intraday_liquidity = 'adequate', primary_product = 'both',
  } = pp;

  const hqlaScore = Math.max(0, Math.min(4, (Number(hqla_inventory_pct) || 0) / 25)); // 0..4
  const sub = {
    scope:     [pick(S.activity_cash, activity_cash), pick(S.activity_repo, activity_repo)],
    access:    [pick(S.current_access, current_access), breadthScore(Number(execution_breadth) || 0)],
    margin:    [pick(S.im_funding_ready, im_funding_ready), hqlaScore],
    capital:   [pick(S.capital_constrained, capital_constrained), pick(S.cross_product_hedges, cross_product_hedges)],
    ops:       [pick(S.agreements_status, agreements_status), pick(S.connectivity, connectivity)],
    liquidity: [pick(S.intraday_liquidity, intraday_liquidity)],
  };

  const dim_scores = {};
  for (const k of Object.keys(sub)) {
    const avg = sub[k].reduce((a, b) => a + b, 0) / sub[k].length;     // 0..4
    dim_scores[k] = { score: +(avg / 4 * 100).toFixed(1), grade: letter(avg / 4 * 100) };
  }

  const overall = +Object.keys(WEIGHTS).reduce((acc, k) => acc + dim_scores[k].score * WEIGHTS[k], 0).toFixed(1);
  const overall_grade = letter(overall);

  // Routing: weakest actionable dimension drives the primary recommendation.
  const ranked = Object.keys(dim_scores).sort((a, b) => dim_scores[a].score - dim_scores[b].score);
  const primary_recommendation = ROUTE[ranked[0]];
  const secondary_recommendations = [];
  if (cross_product_hedges !== 'none') secondary_recommendations.push('tcm-cross-margin');
  if (activity_repo === 'bilateral' || activity_repo === 'both') secondary_recommendations.push('tcm-collateral');
  if (!secondary_recommendations.includes(ROUTE[ranked[1]]) && ROUTE[ranked[1]] !== primary_recommendation) {
    secondary_recommendations.push(ROUTE[ranked[1]]);
  }

  const remediation_checklist = [];
  for (const k of Object.keys(dim_scores)) {
    if (dim_scores[k].grade === 'D' || dim_scores[k].grade === 'F') {
      remediation_checklist.push({ dimension: k, grade: dim_scores[k].grade, action: REMEDIATION[k] });
    }
  }

  const compliance_deadline = primary_product === 'repo' ? DEADLINE_REPO : DEADLINE_CASH;
  const compliance_flags = [];
  if (current_access === 'none') compliance_flags.push('NO_ACCESS_MODEL_SELECTED');
  if ((Number(execution_breadth) || 0) >= 3) compliance_flags.push('DONE_AWAY_CANDIDATE');
  if (cross_product_hedges !== 'none') compliance_flags.push('CROSS_MARGIN_CANDIDATE');
  if (overall_grade === 'D' || overall_grade === 'F') compliance_flags.push('LOW_READINESS');
  compliance_flags.push(primary_product === 'repo' ? 'DEADLINE_REPO_2027_06_30' : 'DEADLINE_CASH_2026_12_31');

  const output_payload = {
    overall_score: overall,
    overall_grade,
    dim_scores,
    primary_recommendation,
    secondary_recommendations,
    remediation_checklist,
    compliance_deadline,
    note: 'Educational readiness diagnostic for the SEC US Treasury clearing mandate. Routes to the relevant tcm-* chain; not legal or clearing advice.',
  };
  return { output_payload, compliance_flags };
}

const REMEDIATION = {
  scope: 'Inventory in-scope UST cash and repo activity (bilateral + triparty) and quantify cleared vs uncleared notional.',
  access: 'Select an access model (Direct vs Sponsored done-with vs Agent done-away) — run tcm-access-model.',
  margin: 'Establish CCP initial-margin funding capability and HQLA inventory — run tcm-repo-margin.',
  capital: 'Model the SA-CCR/QCCP capital and RWA impact of clearing — run tcm-capital-relief.',
  ops: 'Execute clearing/sponsorship agreements and stand up CCP/triparty/vendor connectivity — run tcm-onboarding.',
  liquidity: 'Stress intraday liquidity for meeting CCP margin calls — run tcm-liquidity.',
};

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    ap2_version: '1.0.0',
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
