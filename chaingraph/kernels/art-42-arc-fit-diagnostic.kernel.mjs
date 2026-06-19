/**
 * art-42-arc-fit-diagnostic.kernel.mjs
 * Arc Fit Diagnostic — 12-Q / 4-dimension A–F readiness scorer.
 * Routes to: arc-cpn-payment, arc-stablefx, arc-dvp-settlement,
 *            arc-agentic-commerce, arc-cctp-transfer.
 * Pure decision kernel — no DOM, no window, no Date.now().
 */

import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-42-arc-fit-diagnostic';
const TOOL_VERSION = '1.0.0';

// Scoring constant
const SCORE = { yes: 4, partial: 2, no: 0 };

// Dimensions: id → label, chain routing slug, 3-question list
const DIMS = [
  {
    id:    'cpn',
    label: 'CPN Payments',
    chain: 'arc-cpn-payment',
    questions: [
      'q1_cpn_connectivity',
      'q2_corridor_volume',
      'q3_settlement_cutoff_pain',
    ],
  },
  {
    id:    'stablefx',
    label: 'StableFX / FX Settlement',
    chain: 'arc-stablefx',
    questions: [
      'q4_fx_margin_pressure',
      'q5_herstatt_exposure',
      'q6_24_7_settlement_need',
    ],
  },
  {
    id:    'dvp',
    label: 'DvP / Capital Markets',
    chain: 'arc-dvp-settlement',
    questions: [
      'q7_dvp_trade_type',
      'q8_usyc_collateral_interest',
      'q9_prefunding_cost',
    ],
  },
  {
    id:    'commerce',
    label: 'Agentic Commerce',
    chain: 'arc-agentic-commerce',
    questions: [
      'q10_agent_payment_volume',
      'q11_gas_sensitivity',
      'q12_x402_ap2_adoption',
    ],
  },
];

const DIM_MAX   = 12; // 3 questions × 4 pts
const TOTAL_MAX = 48;

function grade(score) {
  if (score >= 40) return 'A';
  if (score >= 32) return 'B';
  if (score >= 24) return 'C';
  if (score >= 12) return 'D';
  return 'F';
}

function cctpBranch(dimResults) {
  return dimResults.filter(d => d.score > 0).length >= 2;
}

export function compute(pp) {
  const dimResults = DIMS.map(dim => {
    const dimScore = dim.questions.reduce(
      (acc, q) => acc + (SCORE[pp[q] ?? 'no'] ?? 0),
      0
    );
    return {
      id:    dim.id,
      label: dim.label,
      chain: dim.chain,
      score: dimScore,
      max:   DIM_MAX,
      pct:   Math.round((dimScore / DIM_MAX) * 100),
    };
  });

  const totalScore = dimResults.reduce((a, d) => a + d.score, 0);
  const totalPct   = Math.round((totalScore / TOTAL_MAX) * 100);

  const TIE_BREAK = ['cpn', 'stablefx', 'commerce', 'dvp'];
  const sorted = [...dimResults].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return TIE_BREAK.indexOf(a.id) - TIE_BREAK.indexOf(b.id);
  });
  const primaryDim = sorted[0];

  const overallGrade = grade(totalScore);
  const cctp_branch  = cctpBranch(dimResults);

  const compliance_flags = [];
  if (overallGrade === 'A' || overallGrade === 'B') {
    compliance_flags.push('ARC_FIT_CONFIRMED');
  } else if (overallGrade === 'C') {
    compliance_flags.push('ARC_PARTIAL_FIT');
  } else {
    compliance_flags.push('ARC_NOT_READY');
  }
  if (cctp_branch) compliance_flags.push('CCTP_ROUTING_RECOMMENDED');

  const output_payload = {
    verdict:       overallGrade,
    total_score:   totalScore,
    total_max:     TOTAL_MAX,
    total_pct:     totalPct,
    primary_chain: primaryDim.chain,
    primary_dim:   primaryDim.id,
    cctp_branch,
    dim_results:   dimResults,
    compliance_flags,
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    ap2_version:        '1.0.0',
    mandate_type:       'agent_guardrail_mandate',
    tool_id:            TOOL_ID,
    tool_version:       TOOL_VERSION,
    generated_at:       now ?? null,
    execution_hash:     hash,
    chain:              { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:  pp,
    output_payload,
    compliance_flags,
    compute_mode:       'server',
    audit_signature:    { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, gpu: false, mandate_type: 'agent_guardrail_mandate' };
