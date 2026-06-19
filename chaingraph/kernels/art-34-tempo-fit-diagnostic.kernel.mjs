/**
 * art-34-tempo-fit-diagnostic.kernel.mjs
 * Tempo Fit Diagnostic — 12-Q / 4-dimension readiness scorer.
 * Pure decision kernel — no DOM, no window, no Date.now().
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-34-tempo-fit-diagnostic';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'run_tempo_fit_diagnostic',
  mandate_type: 'agent_guardrail_mandate',
  gpu:          false,
};

// Scoring constant
const SCORE = { yes: 4, partial: 2, no: 0 };

// Dimensions: id → label, chain routing slug, question list
const DIMS = [
  {
    id: 'issue',
    label: 'Stablecoin Issuance',
    chain: 'tempo-issuance',
    questions: [
      'q1_regulatory_approval',
      'q2_reserve_management',
      'q3_attestation_readiness',
    ],
  },
  {
    id: 'payments',
    label: 'Payment Rails',
    chain: 'tempo-payments',
    questions: [
      'q4_payment_volume',
      'q5_cross_border_volume',
      'q6_settlement_latency_requirement',
    ],
  },
  {
    id: 'agent',
    label: 'Agent Payments (MPP)',
    chain: 'tempo-mpp-agent',
    questions: [
      'q7_agent_payments_live',
      'q8_mpp_integration',
      'q9_api_key_management',
    ],
  },
  {
    id: 'commerce',
    label: 'Merchant Commerce',
    chain: 'tempo-agentic-checkout',
    questions: [
      'q10_merchant_acceptance',
      'q11_checkout_flow',
      'q12_refund_handling',
    ],
  },
];

const DIM_MAX = 12; // 3 questions × 4 pts
const TOTAL_MAX = 48;

// Grade thresholds (raw score)
function grade(score) {
  if (score >= 40) return 'A';
  if (score >= 30) return 'B';
  if (score >= 20) return 'C';
  if (score >= 12) return 'D';
  return 'F';
}

export function compute(pp) {
  // pp keys: q1_regulatory_approval … q12_refund_handling (each 'yes'|'partial'|'no')
  const dimResults = DIMS.map(dim => {
    const dimScore = dim.questions.reduce(
      (acc, q) => acc + (SCORE[pp[q] ?? 'no'] ?? 0),
      0
    );
    return {
      id:      dim.id,
      label:   dim.label,
      chain:   dim.chain,
      score:   dimScore,
      max:     DIM_MAX,
      pct:     Math.round((dimScore / DIM_MAX) * 100),
    };
  });

  const totalScore = dimResults.reduce((a, d) => a + d.score, 0);
  const totalPct   = Math.round((totalScore / TOTAL_MAX) * 100);

  // Primary chain routing: highest dim score wins; tie-break order: agent > payments > commerce > issue
  const TIE_BREAK = ['agent', 'payments', 'commerce', 'issue'];
  const sorted = [...dimResults].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return TIE_BREAK.indexOf(a.id) - TIE_BREAK.indexOf(b.id);
  });
  const primaryDim = sorted[0];

  const overallGrade = grade(totalScore);

  const compliance_flags = [];
  if (overallGrade === 'A' || overallGrade === 'B') {
    compliance_flags.push('TEMPO_FIT_CONFIRMED');
  } else if (overallGrade === 'C') {
    compliance_flags.push('TEMPO_PARTIAL_FIT');
  } else {
    compliance_flags.push('TEMPO_NOT_READY');
  }

  const output_payload = {
    verdict:       overallGrade,
    total_score:   totalScore,
    total_max:     TOTAL_MAX,
    total_pct:     totalPct,
    primary_chain: primaryDim.chain,
    primary_dim:   primaryDim.id,
    dim_results:   dimResults,
  };
  return { output_payload, compliance_flags };
}

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
